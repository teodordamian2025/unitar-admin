// =====================================================
// API: Sincronizare Facturi EMISE iapp.ro
// Descarcă facturi emise în ANAF prin iapp.ro API
// URL: POST /api/iapp/facturi-emise/sync
// Data: 29.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  fetchFacturiEmiseIapp,
  mapIappFacturaEmisaToDatabase,
  facturaEmisaExistaDeja,
  getDateRange,
  getIappConfig,
  fetchFacturaEmisaDetails,
  downloadZipFacturaEmisa,
  generateZipFileName,
  uploadZipToEmiseDrive,
  type IappFacturaEmisaRaspuns
} from '@/lib/iapp-facturi-emise';

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

const FACTURI_EMISE_TABLE = `${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2`;

/**
 * POST /api/iapp/facturi-emise/sync
 * Body: { zile?: number } - default 7 zile
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔄 [iapp.ro Facturi Emise] ========== START SYNC ==========');

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const zile = body.zile || 7;

    console.log(`📅 [iapp.ro Emise] Sincronizare ultimele ${zile} zile...`);

    // Step 1: Verifică configurare
    let config;
    try {
      config = await getIappConfig();
      console.log(`✅ [iapp.ro Emise] Configurare găsită: email=${config.email_responsabil}`);
    } catch (error) {
      console.error('❌ [iapp.ro Emise] Configurare lipsă:', error);
      return NextResponse.json({
        success: false,
        error: 'iapp.ro configuration not found. Please configure in settings.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Step 2: Calculează interval date
    const { startDate, endDate } = getDateRange(zile);
    console.log(`📆 [iapp.ro Emise] Interval: ${startDate} → ${endDate}`);

    // Step 3: Fetch facturi de la iapp.ro API
    let facturiIapp: IappFacturaEmisaRaspuns[];
    try {
      facturiIapp = await fetchFacturiEmiseIapp(startDate, endDate, config.email_responsabil);
      console.log(`✅ [iapp.ro Emise] Primite ${facturiIapp.length} facturi de la API`);
    } catch (error) {
      console.error('❌ [iapp.ro Emise] Eroare fetch API:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch invoices from iapp.ro API',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    if (facturiIapp.length === 0) {
      console.log('ℹ️ [iapp.ro Emise] Nu există facturi noi în această perioadă');
      return NextResponse.json({
        success: true,
        message: 'No new invoices found',
        stats: {
          total_iapp: 0,
          facturi_noi: 0,
          facturi_duplicate: 0,
          facturi_salvate: 0,
          zips_descarcate: 0,
          facturi_erori_anaf: 0,
          facturi_confirmate: 0,
          processingTime: Date.now() - startTime
        }
      });
    }

    // Step 4: Filtrează facturi noi (nu există în DB)
    const facturiNoi: IappFacturaEmisaRaspuns[] = [];
    const facturiDuplicate: string[] = [];

    for (const factura of facturiIapp) {
      const idIncarcare = String(factura.id_incarcare);
      const exists = await facturaEmisaExistaDeja(idIncarcare);

      if (exists) {
        facturiDuplicate.push(idIncarcare);
        console.log(`⏭️ [iapp.ro Emise] Skip duplicat: ${factura.factura.client_name} (ID: ${idIncarcare})`);
      } else {
        facturiNoi.push(factura);
      }
    }

    console.log(`📋 [iapp.ro Emise] Facturi noi: ${facturiNoi.length}, Duplicate: ${facturiDuplicate.length}`);

    if (facturiNoi.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All invoices already exist in database',
        stats: {
          total_iapp: facturiIapp.length,
          facturi_noi: 0,
          facturi_duplicate: facturiDuplicate.length,
          facturi_salvate: 0,
          zips_descarcate: 0,
          facturi_erori_anaf: 0,
          facturi_confirmate: 0,
          processingTime: Date.now() - startTime
        }
      });
    }

    // Step 5: Mapare și fetch detalii + download ZIP + insert în BigQuery
    const recordsToInsert: any[] = [];
    const facturiSalvate: string[] = [];
    let zipsDescarcate = 0;
    let facturiEroriAnaf = 0;
    let facturiConfirmate = 0;

    for (const factura of facturiNoi) {
      try {
        // Mapare de bază
        const dbRecord = mapIappFacturaEmisaToDatabase(factura);

        // Contorizare statusuri
        if (factura.status === 'EROARE') {
          facturiEroriAnaf++;
        } else if (factura.status === 'CONFIRMAT') {
          facturiConfirmate++;
        }

        // Fetch detalii complete (XML + PDF link)
        let detalii: any = null;
        try {
          detalii = await fetchFacturaEmisaDetails(String(factura.id_incarcare));

          // Salvează JSON complet în xml_content (pentru afișare detalii în UI)
          dbRecord.xml_content = JSON.stringify(detalii);

          // Extrage serie/număr din detalii dacă e disponibil
          if (detalii.factura?.cbcID) {
            dbRecord.serie_numar = detalii.factura.cbcID;
          }

          console.log(`✅ [iapp.ro Emise] Detalii: ${factura.factura.client_name} - Status: ${factura.status}`);
        } catch (detailError) {
          console.warn(`⚠️ [iapp.ro Emise] Nu s-au putut prelua detalii pentru ID ${factura.id_incarcare}:`, detailError);
        }

        // Download ZIP în Google Drive (dacă flag activat)
        if (config.auto_download_pdfs_iapp && factura.id_descarcare) {
          try {
            console.log(`📥 [iapp.ro Emise] Start download ZIP pentru ID ${factura.id_incarcare}...`);

            // 1. Download ZIP
            const zipBuffer = await downloadZipFacturaEmisa(String(factura.id_descarcare));

            // 2. Generate filename
            const fileName = generateZipFileName({
              serie_numar: dbRecord.serie_numar,
              data_factura: dbRecord.data_factura,
              id_incarcare: dbRecord.id_incarcare
            });

            // 3. Extract year/month pentru folder structure
            const [year, month] = dbRecord.data_factura.split('-');

            // 4. Upload to Drive
            const fileId = await uploadZipToEmiseDrive(zipBuffer, fileName, year, month);

            // 5. Save file ID in record
            dbRecord.zip_file_id = fileId;

            zipsDescarcate++;
            console.log(`✅ [iapp.ro Emise] ZIP salvat: ${fileName} (Drive ID: ${fileId})`);

            // Small delay pentru rate limiting (500ms între download-uri)
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (zipError) {
            // Non-critical - continuăm fără ZIP
            console.warn(`⚠️ [iapp.ro Emise] Nu s-a putut descărca ZIP pentru ID ${factura.id_incarcare}:`, zipError);
          }
        } else if (!config.auto_download_pdfs_iapp) {
          console.log(`ℹ️ [iapp.ro Emise] Download ZIP dezactivat (flag OFF)`);
        }

        recordsToInsert.push(dbRecord);
        facturiSalvate.push(`${factura.factura.client_name} - ${factura.status}`);

        console.log(`✅ [iapp.ro Emise] Mapat: ${factura.factura.client_name} - ${factura.factura.total} - Status: ${factura.status}`);
      } catch (error) {
        console.error(`❌ [iapp.ro Emise] Eroare mapare factură ID ${factura.id_incarcare}:`, error);
      }
    }

    // Insert batch în BigQuery
    if (recordsToInsert.length > 0) {
      try {
        await bigquery.dataset(DATASET).table('FacturiEmiseANAF_v2').insert(recordsToInsert);
        console.log(`✅ [iapp.ro Emise] Salvate ${recordsToInsert.length} facturi în BigQuery`);
      } catch (error) {
        console.error('❌ [iapp.ro Emise] Eroare insert BigQuery:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to insert invoices into BigQuery',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ [iapp.ro Emise] ========== SYNC COMPLETED (${processingTime}ms) ==========`);
    console.log(`📊 [iapp.ro Emise] Stats: Total=${facturiIapp.length}, Noi=${facturiNoi.length}, Salvate=${recordsToInsert.length}, ZIPs=${zipsDescarcate}`);
    console.log(`   Confirmate=${facturiConfirmate}, Erori ANAF=${facturiEroriAnaf}`);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${recordsToInsert.length} new invoices from iapp.ro`,
      stats: {
        total_iapp: facturiIapp.length,
        facturi_noi: facturiNoi.length,
        facturi_duplicate: facturiDuplicate.length,
        facturi_salvate: recordsToInsert.length,
        zips_descarcate: zipsDescarcate,
        facturi_erori_anaf: facturiEroriAnaf,
        facturi_confirmate: facturiConfirmate,
        processingTime
      },
      facturi: facturiSalvate
    });

  } catch (error) {
    console.error('❌ [iapp.ro Emise] SYNC ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * GET /api/iapp/facturi-emise/sync
 * Returnează status ultimei sincronizări
 */
export async function GET(req: NextRequest) {
  try {
    const query = `
      SELECT
        COUNT(*) as total_facturi,
        COUNT(DISTINCT cif_client) as total_clienti,
        SUM(valoare_ron) as valoare_totala_ron,
        MAX(data_preluare) as ultima_sincronizare,
        COUNTIF(status_anaf = 'CONFIRMAT') as facturi_confirmate,
        COUNTIF(status_anaf = 'DESCARCAT') as facturi_descarcate,
        COUNTIF(status_anaf = 'EROARE') as facturi_erori
      FROM \`${FACTURI_EMISE_TABLE}\`
      WHERE activ = TRUE
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    const stats = rows[0] || {};

    return NextResponse.json({
      success: true,
      stats: {
        total_facturi: parseInt(stats.total_facturi) || 0,
        total_clienti: parseInt(stats.total_clienti) || 0,
        valoare_totala_ron: parseFloat(stats.valoare_totala_ron) || 0,
        ultima_sincronizare: stats.ultima_sincronizare || null,
        facturi_confirmate: parseInt(stats.facturi_confirmate) || 0,
        facturi_descarcate: parseInt(stats.facturi_descarcate) || 0,
        facturi_erori: parseInt(stats.facturi_erori) || 0
      }
    });

  } catch (error) {
    console.error('❌ [iapp.ro Emise] Error fetching sync status:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
