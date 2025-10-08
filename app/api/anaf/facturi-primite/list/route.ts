// =====================================================
// API: Lista Facturi Primite
// Listare cu filtrare și paginare
// URL: GET /api/anaf/facturi-primite/list
// Data: 08.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type { FacturiPrimiteListResponse } from '@/lib/facturi-primite-types';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const FACTURI_TABLE = `${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2`;

/**
 * GET /api/anaf/facturi-primite/list
 * Query params:
 * - data_start: YYYY-MM-DD (default: 90 zile în urmă)
 * - data_end: YYYY-MM-DD (default: azi)
 * - cif_emitent: Filter CUI furnizor
 * - status_procesare: nou/descarcat/procesat/asociat/eroare
 * - asociat: true/false (doar asociate/neasociate)
 * - search: Caută în serie_numar, nume_emitent, observatii
 * - limit: Number (default 50)
 * - offset: Number (default 0)
 * - sort: field:direction (default: data_preluare:desc)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Parse filtere
    const filters = {
      data_start: searchParams.get('data_start') || getDefaultStartDate(),
      data_end: searchParams.get('data_end') || getDefaultEndDate(),
      cif_emitent: searchParams.get('cif_emitent') || null,
      status_procesare: searchParams.get('status_procesare') || null,
      asociat: searchParams.get('asociat') || null,
      search: searchParams.get('search') || null,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sort: searchParams.get('sort') || 'data_preluare:desc',
    };

    // Build WHERE clause
    const whereConditions: string[] = ['f.activ = TRUE'];
    const params: any = {
      data_start: filters.data_start,
      data_end: filters.data_end,
    };

    // Filter by data_factura (dacă există) SAU data_preluare
    whereConditions.push(
      `(f.data_factura BETWEEN @data_start AND @data_end OR DATE(f.data_preluare) BETWEEN @data_start AND @data_end)`
    );

    if (filters.cif_emitent) {
      whereConditions.push('f.cif_emitent = @cif_emitent');
      params.cif_emitent = filters.cif_emitent;
    }

    if (filters.status_procesare) {
      whereConditions.push('f.status_procesare = @status_procesare');
      params.status_procesare = filters.status_procesare;
    }

    if (filters.asociat === 'true') {
      whereConditions.push('f.cheltuiala_asociata_id IS NOT NULL');
    } else if (filters.asociat === 'false') {
      whereConditions.push('f.cheltuiala_asociata_id IS NULL');
    }

    if (filters.search) {
      whereConditions.push(
        `(
          LOWER(f.serie_numar) LIKE @search OR
          LOWER(f.nume_emitent) LIKE @search OR
          LOWER(f.observatii) LIKE @search
        )`
      );
      params.search = `%${filters.search.toLowerCase()}%`;
    }

    const whereClause = whereConditions.join(' AND ');

    // Parse sort
    const [sortField, sortDir] = filters.sort.split(':');
    const sortClause = `${sortField} ${sortDir.toUpperCase()}`;

    // Query principal
    const query = `
      SELECT
        f.*,
        ch.proiect_id,
        ch.subproiect_id,
        ch.descriere AS cheltuiala_descriere,
        p.Denumire_Proiect AS proiect_denumire,
        sp.Denumire AS subproiect_denumire
      FROM \`${FACTURI_TABLE}\` f
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\` ch
        ON f.cheltuiala_asociata_id = ch.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Proiecte_v2\` p
        ON ch.proiect_id = p.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte_v2\` sp
        ON ch.subproiect_id = sp.id
      WHERE ${whereClause}
      ORDER BY ${sortClause}
      LIMIT @limit OFFSET @offset
    `;

    params.limit = filters.limit;
    params.offset = filters.offset;

    // Query count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`${FACTURI_TABLE}\` f
      WHERE ${whereClause}
    `;

    // Execute queries
    const [rows] = await bigquery.query({ query, params });
    const [countRows] = await bigquery.query({
      query: countQuery,
      params: { ...params, limit: undefined, offset: undefined },
    });

    const total = countRows[0]?.total || 0;

    // Format response
    const response: FacturiPrimiteListResponse = {
      facturi: rows.map(formatFactura),
      total,
      limit: filters.limit,
      offset: filters.offset,
      has_more: filters.offset + filters.limit < total,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Eroare la listare facturi primite:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// === HELPERS ===

/**
 * Format factură row pentru response
 */
function formatFactura(row: any) {
  return {
    ...row,
    data_factura: row.data_factura?.value || row.data_factura,
    data_curs_valutar: row.data_curs_valutar?.value || row.data_curs_valutar,
  };
}

/**
 * Default start date: 90 zile în urmă
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

/**
 * Default end date: azi
 */
function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}
