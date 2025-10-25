// =====================================================
// API: Download PDFs pentru facturi existente (backfill)
// URL: POST /api/iapp/facturi-primite/download-pdfs
// Data: 25.10.2025
// Descarcă PDFs pentru facturi care nu au google_drive_file_id
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  fetchFacturaDetails,
  downloadPdfFromIapp,
  generatePdfFileName,
  uploadPdfToIappDrive,
} from '@/lib/iapp-facturi-primite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minut

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

/**
 * POST /api/iapp/facturi-primite/download-pdfs
 * Descarcă PDFs pentru facturi existente care nu au google_drive_file_id
 * Body: { limit: 50 } - câte facturi să proceseze (default 50)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('📥 [iapp.ro Backfill] ========== START PDF DOWNLOAD ==========');

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;

    console.log(`📊 [iapp.ro Backfill] Procesare max ${limit} facturi...`);

    // Step 1: Query facturi fără google_drive_file_id
    const query = `
      SELECT
        id,
        id_mesaj_anaf,
        serie_numar,
        nume_emitent,
        data_factura,
        observatii
      FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
      WHERE observatii LIKE '%iapp.ro%'
        AND (google_drive_file_id IS NULL OR google_drive_file_id = '')
        AND activ = TRUE
      ORDER BY data_factura DESC
      LIMIT @limit
    `;

    const [rows] = await bigquery.query({
      query,
      params: { limit },
      location: 'EU'
    });

    console.log(`📋 [iapp.ro Backfill] Găsite ${rows.length} facturi fără PDF în Drive`);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invoices without PDFs found',
        stats: {
          procesate: 0,
          descarcate: 0,
          erori: 0,
          processingTime: Date.now() - startTime
        }
      });
    }

    // Step 2: Process fiecare factură
    let descarcate = 0;
    let erori = 0;

    for (const factura of rows) {
      try {
        console.log(`📥 [iapp.ro Backfill] Process: ${factura.serie_numar} (ID: ${factura.id})`);

        // 1. Fetch detalii pentru link PDF
        const detalii = await fetchFacturaDetails(factura.id_mesaj_anaf);

        if (!detalii.pdf) {
          console.warn(`⚠️ [iapp.ro Backfill] Nu există link PDF pentru ${factura.serie_numar}`);
          erori++;
          continue;
        }

        // 2. Download PDF
        const pdfBuffer = await downloadPdfFromIapp(detalii.pdf);

        // 3. Generate filename
        const fileName = generatePdfFileName({
          nume_emitent: factura.nume_emitent,
          serie_numar: factura.serie_numar,
          data_factura: factura.data_factura
        });

        // 4. Extract year/month
        const dataStr = typeof factura.data_factura === 'object' && factura.data_factura?.value
          ? factura.data_factura.value
          : factura.data_factura;
        const [year, month] = dataStr.split('-');

        // 5. Upload to Drive
        const fileId = await uploadPdfToIappDrive(pdfBuffer, fileName, year, month);

        // 6. Update BigQuery
        const updateQuery = `
          UPDATE \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
          SET google_drive_file_id = @file_id
          WHERE id = @factura_id
        `;

        await bigquery.query({
          query: updateQuery,
          params: {
            file_id: fileId,
            factura_id: factura.id
          },
          location: 'EU'
        });

        descarcate++;
        console.log(`✅ [iapp.ro Backfill] ${factura.serie_numar}: PDF salvat (Drive ID: ${fileId})`);

        // Rate limiting: 500ms delay între download-uri
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        erori++;
        console.error(`❌ [iapp.ro Backfill] Eroare ${factura.serie_numar}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ [iapp.ro Backfill] ========== COMPLETED (${processingTime}ms) ==========`);
    console.log(`📊 [iapp.ro Backfill] Stats: Procesate=${rows.length}, Descărcate=${descarcate}, Erori=${erori}`);

    return NextResponse.json({
      success: true,
      message: `Downloaded ${descarcate} PDFs from ${rows.length} invoices`,
      stats: {
        procesate: rows.length,
        descarcate,
        erori,
        processingTime
      }
    });

  } catch (error: any) {
    console.error('❌ [iapp.ro Backfill] ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Backfill failed',
      details: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
}
