// ==================================================================
// CALEA: app/api/actions/invoices/list/route.ts
// DATA: 05.10.2025 00:15 (ora României)
// MODIFICAT: Fix CRITICAL - Folosire corectă tabele _v2 cu suffix dinamic
// CAUZA: Query-urile foloseau hard-coded tabele fără _v2, citind din tabele vechi
// FIX: Înlocuit toate referințele cu variabilele TABLE_* definite cu tableSuffix
// PĂSTRATE: Toate funcționalitățile existente
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;

console.log(`🔧 Invoices List API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, Proiecte${tableSuffix}, EtapeFacturi${tableSuffix}, Subproiecte${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = 'PanouControlUnitar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiectId');
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    // ✅ FIX 24.01.2026: Adăugat parametru search pentru căutare server-side
    const search = searchParams.get('search');
    // ✅ FIX 24.01.2026: Mărit limita default la 100 și adăugat support pentru "all"
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 10000 : parseInt(limitParam || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // ✅ FIX PERFORMANȚĂ 14.12.2025: Query unic cu COUNT(*) OVER() pentru a elimina al doilea query
    // Aceasta reduce timpul de răspuns cu ~50% (un singur round-trip la BigQuery)
    let query = `
      WITH incasari_facturi AS (
        -- Agregăm încasările din EtapeFacturi pentru fiecare factură
        SELECT
          factura_id,
          SUM(COALESCE(valoare_incasata, 0)) as total_incasat,
          MAX(data_incasare) as ultima_data_incasare,
          MAX(status_incasare) as status_incasare_ef
        FROM ${TABLE_ETAPE_FACTURI}
        WHERE activ = true AND factura_id IS NOT NULL
        GROUP BY factura_id
      ),
      facturi_filtrate AS (
        SELECT
          fg.id,
          fg.serie,
          fg.numar,
          fg.data_factura,
          fg.data_scadenta,
          fg.client_nume,
          fg.client_cui,
          fg.subtotal,
          fg.total_tva,
          fg.total,

          -- ✅ FIX: Folosim valoarea încasată din EtapeFacturi (sursa corectă)
          COALESCE(inc.total_incasat, fg.valoare_platita, 0) as valoare_platita,

          fg.status,
          fg.data_creare,
          fg.data_actualizare,
          fg.date_complete_json,

          -- ✅ CRUCIAL: Include proiect_id din BigQuery pentru Edit/Storno
          fg.proiect_id,

          -- ✅ Date proiect din JOIN
          p.Denumire as proiect_denumire,
          p.Status as proiect_status,

          -- ✅ Corespondențe cu Subproiecte și Etape
          ef.subproiect_id,
          s.Denumire as subproiect_denumire,
          ef.tip_etapa,
          ef.etapa_id,
          ef.anexa_id,

          -- ✅ Date încasare din EtapeFacturi
          inc.ultima_data_incasare as data_incasare,
          inc.status_incasare_ef,

          -- ✅ Câmpuri e-factura
          fg.efactura_enabled,
          fg.efactura_status,
          fg.anaf_upload_id,

          -- ✅ Mock mode indicator
          CASE
            WHEN fg.efactura_status = 'mock_pending' THEN true
            ELSE false
          END as efactura_mock_mode,

          -- ✅ STORNO TRACKING (14.01.2026)
          COALESCE(fg.is_storno, false) as is_storno,
          fg.storno_pentru_factura_id,
          fg.stornata_de_factura_id,

          -- ✅ EXCLUDE NOTIFICĂRI PLATĂ (23.01.2026) - pentru facturi vechi importate retroactiv
          COALESCE(fg.exclude_notificari_plata, false) as exclude_notificari_plata,

          -- ✅ Calcule utile
          (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) as rest_de_plata,
          DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) as zile_pana_scadenta,

          -- ✅ Status scadență (fără diacritice pentru match cu frontend filters)
          -- ✅ STORNO: Facturi stornate sau de stornare au status special
          CASE
            WHEN COALESCE(fg.is_storno, false) = true THEN 'Storno'
            WHEN fg.stornata_de_factura_id IS NOT NULL THEN 'Stornata'
            WHEN fg.data_scadenta < CURRENT_DATE() AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'Expirata'
            WHEN DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) <= 7 AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'Expira curand'
            WHEN (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) <= 0 THEN 'Platita'
            ELSE 'In regula'
          END as status_scadenta,

          -- ✅ Status încasări (pentru filtru frontend)
          -- ✅ STORNO: Facturi stornate/de stornare nu au status încasări relevant
          CASE
            WHEN COALESCE(fg.is_storno, false) = true THEN 'storno'
            WHEN fg.stornata_de_factura_id IS NOT NULL THEN 'stornata'
            WHEN (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) <= 0 OR COALESCE(inc.total_incasat, fg.valoare_platita, 0) >= fg.total THEN 'incasat_complet'
            WHEN COALESCE(inc.total_incasat, fg.valoare_platita, 0) > 0 AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'incasat_partial'
            ELSE 'neincasat'
          END as status_incasari

        FROM ${TABLE_FACTURI_GENERATE} fg
        LEFT JOIN ${TABLE_PROIECTE} p
          ON fg.proiect_id = p.ID_Proiect
        LEFT JOIN ${TABLE_ETAPE_FACTURI} ef
          ON fg.id = ef.factura_id AND ef.activ = true
        LEFT JOIN ${TABLE_SUBPROIECTE} s
          ON ef.subproiect_id = s.ID_Subproiect AND s.activ = true
        LEFT JOIN incasari_facturi inc
          ON fg.id = inc.factura_id
        WHERE 1=1
    `;

    const params: any = {};
    const types: any = {};

    if (proiectId) {
      query += ' AND fg.proiect_id = @proiectId';
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (clientId) {
      query += ' AND fg.client_id = @clientId';
      params.clientId = clientId;
      types.clientId = 'STRING';
    }

    if (status) {
      query += ' AND fg.status = @status';
      params.status = status;
      types.status = 'STRING';
    }

    // ✅ FIX 24.01.2026: Adăugat căutare server-side pentru search
    if (search && search.trim()) {
      query += ` AND (
        LOWER(fg.serie) LIKE LOWER(@search) OR
        LOWER(CAST(fg.numar AS STRING)) LIKE LOWER(@search) OR
        LOWER(CONCAT(COALESCE(fg.serie, ''), '-', CAST(fg.numar AS STRING))) LIKE LOWER(@search) OR
        LOWER(fg.client_nume) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Denumire, '')) LIKE LOWER(@search) OR
        LOWER(fg.proiect_id) LIKE LOWER(@search)
      )`;
      params.search = `%${search.trim()}%`;
      types.search = 'STRING';
    }

    // ✅ FIX PERFORMANȚĂ: Închide CTE și adaugă COUNT(*) OVER() pentru total count într-un singur query
    query += `
      )
      SELECT
        *,
        COUNT(*) OVER() as total_count
      FROM facturi_filtrate
      ORDER BY data_creare DESC
    `;

    if (limit > 0) {
      query += ` LIMIT @limit OFFSET @offset`;
      params.limit = limit;
      params.offset = offset;
      types.limit = 'INT64';
      types.offset = 'INT64';
    }

    console.log('📋 Query facturi optimizat (single query)');

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU'
    });

    // ✅ Extrage total_count din primul row (sau 0 dacă nu sunt rezultate)
    const totalCount = rows.length > 0 ? (rows[0].total_count || 0) : 0;

    // ✅ Curăță total_count din rezultate (nu e nevoie în frontend)
    const cleanRows = rows.map(({ total_count, ...rest }: any) => rest);

    // ✅ DEBUGGING: Verifică prima factură
    if (cleanRows.length > 0) {
      console.log('🔍 DEBUG: Prima factură returnată:', {
        id: cleanRows[0]?.id,
        serie: cleanRows[0]?.serie,
        numar: cleanRows[0]?.numar,
        proiect_id: cleanRows[0]?.proiect_id,
        proiect_denumire: cleanRows[0]?.proiect_denumire,
        are_date_complete_json: !!cleanRows[0]?.date_complete_json
      });
    }

    return NextResponse.json({
      success: true,
      facturi: cleanRows,
      pagination: {
        total: parseInt(totalCount),
        limit,
        offset,
        hasMore: (offset + limit) < parseInt(totalCount)
      }
    });

  } catch (error) {
    console.error('Eroare preluare facturi:', error);
    return NextResponse.json(
      {
        error: 'Eroare la preluarea facturilor',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}

// ==================================================================
// API pentru statistici facturi (folosit în dashboard) - ACTUALIZAT CU E-FACTURA
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const { perioada = '30' } = await request.json(); // ultimele 30 zile default
    
    const statsQuery = `
      WITH facturi_stats AS (
        SELECT
          COUNT(*) as total_facturi,
          COUNTIF(status = 'pdf_generated') as facturi_pdf,
          COUNTIF(status = 'anaf_success') as facturi_anaf,
          COUNTIF(status = 'anaf_error') as facturi_eroare,

          -- ✅ NOU: Statistici e-factura
          COUNTIF(efactura_enabled = true) as facturi_efactura_enabled,
          COUNTIF(efactura_status = 'uploaded') as facturi_efactura_uploaded,
          COUNTIF(efactura_status = 'accepted') as facturi_efactura_accepted,
          COUNTIF(efactura_status = 'rejected') as facturi_efactura_rejected,
          COUNTIF(efactura_status = 'mock_pending') as facturi_efactura_mock,

          SUM(total) as valoare_totala,
          SUM(COALESCE(valoare_platita, 0)) as valoare_platita,
          SUM(total - COALESCE(valoare_platita, 0)) as rest_de_plata,

          -- Facturi expirate
          COUNTIF(data_scadenta < CURRENT_DATE() AND (total - COALESCE(valoare_platita, 0)) > 0) as facturi_expirate,

          -- Facturi care expira in 7 zile
          COUNTIF(
            DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) <= 7
            AND DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) >= 0
            AND (total - COALESCE(valoare_platita, 0)) > 0
          ) as facturi_expira_curand

        FROM ${TABLE_FACTURI_GENERATE}
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
      ),

      top_clienti AS (
        SELECT
          client_nume,
          COUNT(*) as nr_facturi,
          SUM(total) as valoare_totala
        FROM ${TABLE_FACTURI_GENERATE}
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
        GROUP BY client_nume
        ORDER BY valoare_totala DESC
        LIMIT 5
      )

      SELECT
        (SELECT AS STRUCT * FROM facturi_stats) as statistici,
        ARRAY(SELECT AS STRUCT * FROM top_clienti) as top_clienti
    `;
    
    const [rows] = await bigquery.query({
      query: statsQuery,
      params: { perioada: parseInt(perioada) },
      types: { perioada: 'INT64' },
      location: 'EU'
    });
    
    const result = rows[0];
    
    return NextResponse.json({
      success: true,
      statistici: result.statistici,
      topClienti: result.top_clienti,
      perioada: parseInt(perioada)
    });
    
  } catch (error) {
    console.error('Eroare statistici facturi:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la calcularea statisticilor',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}
