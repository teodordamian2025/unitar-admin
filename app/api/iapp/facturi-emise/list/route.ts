// =====================================================
// API: Listare Facturi EMISE
// Returnează listă facturi emise cu filtrare și paginare
// URL: GET /api/iapp/facturi-emise/list
// Data: 29.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

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

const FACTURI_EMISE_TABLE = `${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2`;

/**
 * GET /api/iapp/facturi-emise/list
 *
 * Query Parameters:
 * - data_start: YYYY-MM-DD (default: 90 zile în urmă)
 * - data_end: YYYY-MM-DD (default: astăzi)
 * - status_anaf: CONFIRMAT | DESCARCAT | EROARE (opțional)
 * - cif_client: CUI client (opțional)
 * - search: text search în nume_client sau serie_numar (opțional)
 * - trimisa_de: Sistem | Extern | User name (opțional)
 * - limit: număr înregistrări (default: 50, max: 200)
 * - offset: offset paginare (default: 0)
 * - order_by: data_factura | valoare_totala (default: data_factura)
 * - order_dir: asc | desc (default: desc)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Parametri de filtrare
    const dataStart = searchParams.get('data_start') || getDefaultStartDate();
    const dataEnd = searchParams.get('data_end') || getDefaultEndDate();
    const statusAnaf = searchParams.get('status_anaf') || null;
    const cifClient = searchParams.get('cif_client') || null;
    const search = searchParams.get('search') || null;
    const trimisaDe = searchParams.get('trimisa_de') || null;

    // Parametri paginare
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parametri sortare
    const orderBy = searchParams.get('order_by') || 'data_factura';
    const orderDir = searchParams.get('order_dir') || 'desc';

    // Validare sortare
    const validOrderBy = ['data_factura', 'valoare_totala', 'data_preluare', 'serie_numar'];
    const validOrderDir = ['asc', 'desc'];

    if (!validOrderBy.includes(orderBy) || !validOrderDir.includes(orderDir.toLowerCase())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sort parameters'
      }, { status: 400 });
    }

    console.log(`📋 [iapp.ro Emise List] Fetching facturi: ${dataStart} → ${dataEnd}, limit=${limit}, offset=${offset}`);

    // Build query dinamică cu filtre
    let whereConditions: string[] = [
      'activ = TRUE',
      `DATE(data_factura) >= DATE('${dataStart}')`,
      `DATE(data_factura) <= DATE('${dataEnd}')`
    ];

    const queryParams: any = {};

    if (statusAnaf) {
      whereConditions.push('status_anaf = @status_anaf');
      queryParams.status_anaf = statusAnaf.toUpperCase();
    }

    if (cifClient) {
      whereConditions.push('cif_client = @cif_client');
      queryParams.cif_client = cifClient;
    }

    if (trimisaDe) {
      whereConditions.push('trimisa_de = @trimisa_de');
      queryParams.trimisa_de = trimisaDe;
    }

    if (search) {
      whereConditions.push(`(
        LOWER(nume_client) LIKE @search OR
        LOWER(serie_numar) LIKE @search OR
        cif_client LIKE @search
      )`);
      queryParams.search = `%${search.toLowerCase()}%`;
    }

    const whereClause = whereConditions.join(' AND ');

    // Query principal - include campuri pentru status achitare
    const query = `
      SELECT
        id,
        id_incarcare,
        id_descarcare,
        cif_client,
        nume_client,
        serie_numar,
        data_factura,
        valoare_totala,
        moneda,
        valoare_ron,
        status_anaf,
        mesaj_anaf,
        trimisa_de,
        tip_document,
        zip_file_id,
        pdf_file_id,
        factura_generata_id,
        data_preluare,
        data_incarcare_anaf,
        observatii,
        -- Campuri status achitare
        COALESCE(valoare_platita, 0) as valoare_platita,
        COALESCE(status_achitare, 'Neincasat') as status_achitare,
        data_ultima_plata,
        matched_tranzactie_id,
        matching_tip,
        -- Rest de plata calculat
        COALESCE(valoare_ron, valoare_totala) - COALESCE(valoare_platita, 0) as rest_de_plata
      FROM \`${FACTURI_EMISE_TABLE}\`
      WHERE ${whereClause}
      ORDER BY ${orderBy} ${orderDir.toUpperCase()}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Query count pentru total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`${FACTURI_EMISE_TABLE}\`
      WHERE ${whereClause}
    `;

    console.log(`🔍 [iapp.ro Emise List] Query: ${query.substring(0, 200)}...`);

    // Execute queries în paralel
    const [dataRows, countRows] = await Promise.all([
      bigquery.query({ query, params: queryParams, location: 'EU' }),
      bigquery.query({ query: countQuery, params: queryParams, location: 'EU' })
    ]);

    const facturi = dataRows[0] || [];
    const total = countRows[0][0]?.total || 0;

    console.log(`✅ [iapp.ro Emise List] Returnate ${facturi.length} facturi (total: ${total})`);

    return NextResponse.json({
      success: true,
      data: facturi,
      pagination: {
        total: parseInt(total),
        limit: limit,
        offset: offset,
        has_more: offset + limit < parseInt(total)
      },
      filters: {
        data_start: dataStart,
        data_end: dataEnd,
        status_anaf: statusAnaf,
        cif_client: cifClient,
        search: search,
        trimisa_de: trimisaDe
      }
    });

  } catch (error) {
    console.error('❌ [iapp.ro Emise List] Error:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch invoices',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper: Data start default (90 zile în urmă)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Data end default (astăzi)
 */
function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}
