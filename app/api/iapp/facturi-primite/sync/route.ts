// =====================================================
// API: Sincronizare Facturi Primite iapp.ro
// Descarcă facturi primite de la furnizori prin iapp.ro API
// URL: POST /api/iapp/facturi-primite/sync
// Data: 25.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  fetchFacturiPrimiteIapp,
  mapIappFacturaToDatabase,
  facturaExistaDeja,
  getDateRange,
  getIappConfig,
  fetchFacturaDetails,
  type IappFacturaRaspuns
} from '@/lib/iapp-facturi-primite';
import { autoAssociate } from '@/lib/facturi-primite-matcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minut pentru sincronizare

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const FACTURI_PRIMITE_TABLE = `${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2`;

/**
 * POST /api/iapp/facturi-primite/sync
 * Body: { zile?: number } - default 7 zile
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔄 [iapp.ro Facturi Primite] ========== START SYNC ==========');

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const zile = body.zile || 7;

    console.log(`📅 [iapp.ro] Sincronizare ultimele ${zile} zile...`);

    // Step 1: Verifică configurare
    let config;
    try {
      config = await getIappConfig();
      console.log(`✅ [iapp.ro] Configurare găsită: email=${config.email_responsabil}`);
    } catch (error) {
      console.error('❌ [iapp.ro] Configurare lipsă:', error);
      return NextResponse.json({
        success: false,
        error: 'iapp.ro configuration not found. Please configure in settings.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Step 2: Calculează interval date
    const { startDate, endDate } = getDateRange(zile);
    console.log(`📆 [iapp.ro] Interval: ${startDate} → ${endDate}`);

    // Step 3: Fetch facturi de la iapp.ro API
    let facturiIapp: IappFacturaRaspuns[];
    try {
      facturiIapp = await fetchFacturiPrimiteIapp(startDate, endDate, config.email_responsabil);
      console.log(`✅ [iapp.ro] Primite ${facturiIapp.length} facturi de la API`);
    } catch (error) {
      console.error('❌ [iapp.ro] Eroare fetch API:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch invoices from iapp.ro API',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    if (facturiIapp.length === 0) {
      console.log('ℹ️ [iapp.ro] Nu există facturi noi în această perioadă');
      return NextResponse.json({
        success: true,
        message: 'No new invoices found',
        stats: {
          total_iapp: 0,
          facturi_noi: 0,
          facturi_duplicate: 0,
          facturi_salvate: 0,
          facturi_asociate: 0,
          processingTime: Date.now() - startTime
        }
      });
    }

    // Step 4: Filtrează facturi noi (nu există în DB)
    const facturiNoi: IappFacturaRaspuns[] = [];
    const facturiDuplicate: string[] = [];

    for (const factura of facturiIapp) {
      const idSolicitare = String(factura.id_solicitare);
      const exists = await facturaExistaDeja(idSolicitare);

      if (exists) {
        facturiDuplicate.push(idSolicitare);
        console.log(`⏭️ [iapp.ro] Skip duplicat: ${factura.factura.serie_numar} (ID: ${idSolicitare})`);
      } else {
        facturiNoi.push(factura);
      }
    }

    console.log(`📋 [iapp.ro] Facturi noi: ${facturiNoi.length}, Duplicate: ${facturiDuplicate.length}`);

    if (facturiNoi.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All invoices already exist in database',
        stats: {
          total_iapp: facturiIapp.length,
          facturi_noi: 0,
          facturi_duplicate: facturiDuplicate.length,
          facturi_salvate: 0,
          facturi_asociate: 0,
          processingTime: Date.now() - startTime
        }
      });
    }

    // Step 5: Mapare și fetch detalii complete + insert în BigQuery
    const recordsToInsert: any[] = [];
    const facturiSalvate: string[] = [];

    for (const factura of facturiNoi) {
      try {
        // Mapare de bază
        const dbRecord = mapIappFacturaToDatabase(factura);

        // Fetch detalii complete (articole + PDF link)
        try {
          const detalii = await fetchFacturaDetails(String(factura.id_solicitare));

          // Salvează JSON complet în xml_content (pentru afișare detalii în UI)
          dbRecord.xml_content = JSON.stringify(detalii);

          // Adaugă link PDF în observatii
          if (detalii.pdf) {
            dbRecord.observatii = `${dbRecord.observatii}\nPDF: ${detalii.pdf}`;
          }

          console.log(`✅ [iapp.ro] Detalii: ${factura.factura.furnizor_name} - ${factura.factura.serie_numar} - ${detalii.continut?.length || 0} articole`);
        } catch (detailError) {
          // Nu e critică eroarea de fetch detalii, continuăm cu datele de bază
          console.warn(`⚠️ [iapp.ro] Nu s-au putut prelua detalii pentru ${factura.factura.serie_numar}:`, detailError);
        }

        recordsToInsert.push(dbRecord);
        facturiSalvate.push(String(factura.factura.serie_numar));

        console.log(`✅ [iapp.ro] Mapat: ${factura.factura.furnizor_name} - ${factura.factura.serie_numar} - ${factura.factura.total}`);
      } catch (error) {
        console.error(`❌ [iapp.ro] Eroare mapare factură ${factura.factura.serie_numar}:`, error);
      }
    }

    // Insert batch în BigQuery
    if (recordsToInsert.length > 0) {
      try {
        await bigquery.dataset(DATASET).table('FacturiPrimiteANAF_v2').insert(recordsToInsert);
        console.log(`✅ [iapp.ro] Salvate ${recordsToInsert.length} facturi în BigQuery`);
      } catch (error) {
        console.error('❌ [iapp.ro] Eroare insert BigQuery:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to insert invoices into BigQuery',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // Step 6: Auto-asociere cu cheltuieli (opțional)
    let facturiAsociate = 0;
    try {
      console.log('🔍 [iapp.ro] Pornesc auto-asociere cu cheltuieli...');

      for (const record of recordsToInsert) {
        try {
          // autoAssociate primește obiectul factura, nu ID-ul
          const matchResult = await autoAssociate(record as any);
          if (matchResult) {
            facturiAsociate++;
            console.log(`🤖 [iapp.ro] Auto-asociat: ${record.serie_numar} → cheltuiala_id: ${matchResult.cheltuiala_id}`);
          }
        } catch (error) {
          // Nu e critică eroarea de auto-match, continuăm
          console.warn(`⚠️ [iapp.ro] Auto-match failed pentru ${record.serie_numar}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ [iapp.ro] Auto-asociere skip (non-critical):', error);
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ [iapp.ro] ========== SYNC COMPLETED (${processingTime}ms) ==========`);
    console.log(`📊 [iapp.ro] Stats: Total=${facturiIapp.length}, Noi=${facturiNoi.length}, Salvate=${recordsToInsert.length}, Asociate=${facturiAsociate}`);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${recordsToInsert.length} new invoices from iapp.ro`,
      stats: {
        total_iapp: facturiIapp.length,
        facturi_noi: facturiNoi.length,
        facturi_duplicate: facturiDuplicate.length,
        facturi_salvate: recordsToInsert.length,
        facturi_asociate: facturiAsociate,
        processingTime
      },
      facturi: facturiSalvate
    });

  } catch (error) {
    console.error('❌ [iapp.ro] SYNC ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * GET /api/iapp/facturi-primite/sync
 * Returnează status ultimei sincronizări
 */
export async function GET(req: NextRequest) {
  try {
    const query = `
      SELECT
        COUNT(*) as total_facturi,
        COUNT(DISTINCT cif_emitent) as total_furnizori,
        SUM(valoare_ron) as valoare_totala_ron,
        MAX(data_preluare) as ultima_sincronizare
      FROM \`${FACTURI_PRIMITE_TABLE}\`
      WHERE activ = TRUE
        AND observatii LIKE '%iapp.ro%'
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    const stats = rows[0] || {};

    return NextResponse.json({
      success: true,
      stats: {
        total_facturi: parseInt(stats.total_facturi) || 0,
        total_furnizori: parseInt(stats.total_furnizori) || 0,
        valoare_totala_ron: parseFloat(stats.valoare_totala_ron) || 0,
        ultima_sincronizare: stats.ultima_sincronizare || null
      }
    });

  } catch (error) {
    console.error('❌ [iapp.ro] Error fetching sync status:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
