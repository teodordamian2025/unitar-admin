// =====================================================
// API: Listare Facturi EMISE
// Returnează listă facturi emise cu filtrare și paginare
// URL: GET /api/iapp/facturi-emise/list
// Data: 29.10.2025
// ACTUALIZAT: 10.01.2026 - Sincronizare status plată cu FacturiGenerate_v2
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
const FACTURI_GENERATE_TABLE = `${PROJECT_ID}.${DATASET}.FacturiGenerate_v2`;
const ETAPE_FACTURI_TABLE = `${PROJECT_ID}.${DATASET}.EtapeFacturi_v2`;

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

    // Build query dinamică cu filtre - folosim prefix fe. pentru tabel FacturiEmiseANAF_v2
    let whereConditions: string[] = [
      'fe.activ = TRUE',
      `DATE(fe.data_factura) >= DATE('${dataStart}')`,
      `DATE(fe.data_factura) <= DATE('${dataEnd}')`
    ];

    const queryParams: any = {};

    if (statusAnaf) {
      whereConditions.push('fe.status_anaf = @status_anaf');
      queryParams.status_anaf = statusAnaf.toUpperCase();
    }

    if (cifClient) {
      whereConditions.push('fe.cif_client = @cif_client');
      queryParams.cif_client = cifClient;
    }

    if (trimisaDe) {
      whereConditions.push('fe.trimisa_de = @trimisa_de');
      queryParams.trimisa_de = trimisaDe;
    }

    if (search) {
      whereConditions.push(`(
        LOWER(fe.nume_client) LIKE @search OR
        LOWER(fe.serie_numar) LIKE @search OR
        fe.cif_client LIKE @search
      )`);
      queryParams.search = `%${search.toLowerCase()}%`;
    }

    const whereClause = whereConditions.join(' AND ');

    // Query principal - JOIN cu FacturiGenerate_v2 și EtapeFacturi_v2 pentru status real de plată
    // IMPORTANT: Încercăm match în ordinea: factura_generata_id direct, apoi serie_numar
    const query = `
      WITH incasari_facturi AS (
        -- Agregăm încasările din EtapeFacturi pentru fiecare factură generată
        SELECT
          factura_id,
          SUM(COALESCE(valoare_incasata, 0)) as total_incasat,
          MAX(data_incasare) as ultima_data_incasare,
          MAX(status_incasare) as status_incasare_ef
        FROM \`${ETAPE_FACTURI_TABLE}\`
        WHERE activ = true AND factura_id IS NOT NULL
        GROUP BY factura_id
      )
      SELECT
        fe.id,
        fe.id_incarcare,
        fe.id_descarcare,
        fe.cif_client,
        fe.nume_client,
        fe.serie_numar,
        fe.data_factura,
        fe.valoare_totala,
        fe.moneda,
        fe.valoare_ron,
        fe.status_anaf,
        fe.mesaj_anaf,
        fe.trimisa_de,
        fe.tip_document,
        fe.zip_file_id,
        fe.pdf_file_id,
        fe.factura_generata_id,
        fe.data_preluare,
        fe.data_incarcare_anaf,
        fe.observatii,
        -- Campuri status achitare - PRIORITATE: EtapeFacturi > FacturiGenerate > FacturiEmiseANAF
        -- Folosim COALESCE pentru a lua prima valoare non-null din: match direct, match serie_numar, valoarea locală
        COALESCE(
          inc_direct.total_incasat,
          fg_direct.valoare_platita,
          inc_serie.total_incasat,
          fg_serie.valoare_platita,
          fe.valoare_platita,
          0
        ) as valoare_platita,
        -- Status achitare calculat pe baza valorilor reale
        CASE
          WHEN COALESCE(inc_direct.total_incasat, fg_direct.valoare_platita, inc_serie.total_incasat, fg_serie.valoare_platita, fe.valoare_platita, 0) >=
               COALESCE(fe.valoare_ron, fe.valoare_totala) * 0.99 THEN 'Incasat'
          WHEN COALESCE(inc_direct.total_incasat, fg_direct.valoare_platita, inc_serie.total_incasat, fg_serie.valoare_platita, fe.valoare_platita, 0) > 0 THEN 'Partial'
          ELSE 'Neincasat'
        END as status_achitare,
        -- Convertim toate datele la TIMESTAMP pentru COALESCE
        COALESCE(
          TIMESTAMP(inc_direct.ultima_data_incasare),
          fg_direct.data_plata,
          TIMESTAMP(inc_serie.ultima_data_incasare),
          fg_serie.data_plata,
          fe.data_ultima_plata
        ) as data_ultima_plata,
        fe.matched_tranzactie_id,
        fe.matching_tip,
        -- Rest de plata calculat corect
        COALESCE(fe.valoare_ron, fe.valoare_totala) -
          COALESCE(inc_direct.total_incasat, fg_direct.valoare_platita, inc_serie.total_incasat, fg_serie.valoare_platita, fe.valoare_platita, 0) as rest_de_plata,
        -- Info despre sursa datelor de plată
        CASE
          WHEN inc_direct.total_incasat IS NOT NULL THEN 'EtapeFacturi (direct)'
          WHEN fg_direct.valoare_platita IS NOT NULL THEN 'FacturiGenerate (direct)'
          WHEN inc_serie.total_incasat IS NOT NULL THEN 'EtapeFacturi (serie)'
          WHEN fg_serie.valoare_platita IS NOT NULL THEN 'FacturiGenerate (serie)'
          ELSE 'FacturiEmiseANAF'
        END as sursa_status_plata,
        -- ID factură generată găsită (pentru debugging)
        COALESCE(fe.factura_generata_id, fg_serie.id) as factura_generata_id_resolved
      FROM \`${FACTURI_EMISE_TABLE}\` fe
      -- Match direct prin factura_generata_id
      LEFT JOIN \`${FACTURI_GENERATE_TABLE}\` fg_direct
        ON fe.factura_generata_id = fg_direct.id
      LEFT JOIN incasari_facturi inc_direct
        ON fe.factura_generata_id = inc_direct.factura_id
      -- Match prin serie_numar când factura_generata_id nu există
      LEFT JOIN \`${FACTURI_GENERATE_TABLE}\` fg_serie
        ON fe.factura_generata_id IS NULL
        AND fe.serie_numar = CONCAT(fg_serie.serie, '-', fg_serie.numar)
      LEFT JOIN incasari_facturi inc_serie
        ON fe.factura_generata_id IS NULL
        AND fg_serie.id = inc_serie.factura_id
      WHERE ${whereClause}
      ORDER BY fe.${orderBy} ${orderDir.toUpperCase()}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Query count pentru total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`${FACTURI_EMISE_TABLE}\` fe
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
