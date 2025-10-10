// ==================================================================
// CALEA: app/api/anaf/retry-invoices/cron/route.ts
// DESCRIERE: Cron Job pentru retry automat facturi failed la ANAF
// RULARE: La fiecare 10 minute (Vercel Cron)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;

console.log(`🔧 ANAF Retry Invoices Cron - Tables Mode: ${useV2Tables ? 'V2 (Optimized)' : 'V1 (Standard)'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ Retry intervals (în minute)
const RETRY_INTERVALS = {
  attempt_1: 5,   // 5 min
  attempt_2: 15,  // 15 min
  attempt_3: 60   // 1h
};

// ==================================================================
// GET: Cron job endpoint (rulează automat la 10 min)
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting ANAF retry invoices cron job...');

    // 1. Get facturi care necesită retry
    const facturasPendingRetry = await getFacturasPendingRetry();

    if (facturasPendingRetry.length === 0) {
      console.log('✅ No invoices pending retry');
      return NextResponse.json({
        success: true,
        message: 'No invoices pending retry',
        processed: 0
      });
    }

    console.log(`📋 Found ${facturasPendingRetry.length} invoices pending retry`);

    // 2. Process each factura
    const results = await Promise.allSettled(
      facturasPendingRetry.map(factura => retryFacturaUpload(factura))
    );

    // 3. Count successes și failures
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`✅ Retry complete: ${successful} successful, ${failed} failed`);

    // 4. Update FacturiGenerate status (doar cele create cu > 2 minute în urmă - evită streaming buffer)
    await updateFacturiGenerateStatus();

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} invoices`,
      processed: results.length,
      successful,
      failed,
      details: results.map((r, i) => ({
        facturaId: facturasPendingRetry[i].factura_id,
        success: r.status === 'fulfilled' && r.value.success,
        message: r.status === 'fulfilled' ? r.value.message : 'Processing error'
      }))
    });

  } catch (error) {
    console.error('❌ Error in retry invoices cron:', error);
    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// Helper Functions
// ==================================================================

async function getFacturasPendingRetry() {
  try {
    const query = `
      SELECT
        ae.factura_id,
        ae.retry_count,
        ae.data_actualizare,
        ae.error_message,
        fg.numar as factura_numar,
        fg.serie as factura_serie
      FROM ${TABLE_ANAF_EFACTURA} ae
      JOIN ${TABLE_FACTURI_GENERATE} fg ON ae.factura_id = fg.id
      WHERE ae.anaf_status IN ('draft', 'error')
        AND ae.retry_count < 3
        AND (
          -- Prima încercare (5 min) - inclusiv draft-uri noi
          (ae.retry_count = 0 AND ae.data_creare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE))
          OR
          -- A doua încercare (15 min)
          (ae.retry_count = 1 AND ae.data_actualizare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE))
          OR
          -- A treia încercare (60 min)
          (ae.retry_count = 2 AND ae.data_actualizare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 MINUTE))
        )
      ORDER BY ae.retry_count ASC, ae.data_actualizare ASC
      LIMIT 50
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    return rows.map((row: any) => ({
      factura_id: row.factura_id,
      retry_count: parseInt(row.retry_count) || 0,
      last_retry_at: row.data_actualizare, // folosim data_actualizare în loc de last_retry_at
      error_message: row.error_message,
      factura_numar: row.factura_numar,
      factura_serie: row.factura_serie
    }));

  } catch (error) {
    console.error('Error fetching facturi pending retry:', error);
    return [];
  }
}

async function retryFacturaUpload(factura: any) {
  try {
    console.log(`🔄 Retrying upload for factura ${factura.factura_serie}${factura.factura_numar} (attempt ${factura.retry_count + 1}/3)`);

    // Call upload-invoice API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anaf/upload-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facturaId: factura.factura_id,
        isManualRetry: false
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Retry successful for factura ${factura.factura_id}`);
      return {
        success: true,
        facturaId: factura.factura_id,
        message: result.message
      };
    } else {
      console.log(`⚠️ Retry failed for factura ${factura.factura_id}: ${result.message}`);
      return {
        success: false,
        facturaId: factura.factura_id,
        message: result.message
      };
    }

  } catch (error) {
    console.error(`❌ Error retrying factura ${factura.factura_id}:`, error);
    return {
      success: false,
      facturaId: factura.factura_id,
      message: error instanceof Error ? error.message : 'Retry error'
    };
  }
}

async function updateFacturiGenerateStatus() {
  try {
    // Update FacturiGenerate pentru facturi care au status actualizat în AnafEFactura
    // Doar pentru rânduri create cu > 2 minute în urmă (evită streaming buffer)
    // ✅ Folosim MERGE cu JOIN pentru a evita correlated subquery errors
    const updateQuery = `
      MERGE ${TABLE_FACTURI_GENERATE} fg
      USING (
        SELECT
          ae.factura_id,
          CASE
            WHEN ae.anaf_status = 'processing' THEN 'pending'
            WHEN ae.anaf_status = 'validated' THEN 'validated'
            WHEN ae.anaf_status = 'error' AND ae.retry_count >= 3 THEN 'anaf_error'
            WHEN ae.anaf_status = 'error' THEN 'pending'
            ELSE 'draft'
          END as new_efactura_status,
          ae.anaf_upload_id,
          ROW_NUMBER() OVER (PARTITION BY ae.factura_id ORDER BY ae.data_creare DESC) as rn
        FROM ${TABLE_ANAF_EFACTURA} ae
        WHERE ae.data_actualizare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
      ) ae_latest
      ON fg.id = ae_latest.factura_id
        AND ae_latest.rn = 1
        AND fg.efactura_enabled = true
        AND fg.data_creare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 MINUTE)
      WHEN MATCHED THEN
        UPDATE SET
          efactura_status = ae_latest.new_efactura_status,
          anaf_upload_id = ae_latest.anaf_upload_id,
          data_actualizare = CURRENT_TIMESTAMP()
    `;

    await bigquery.query({ query: updateQuery, location: 'EU' });

    console.log('✅ Updated FacturiGenerate status for recent uploads');

  } catch (error) {
    console.error('❌ Error updating FacturiGenerate status:', error);
    // Nu throw - job-ul poate continua
  }
}

// ==================================================================
// POST: Manual trigger pentru retry (din UI)
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { facturaIds } = await request.json();

    if (!facturaIds || !Array.isArray(facturaIds)) {
      return NextResponse.json({
        success: false,
        error: 'facturaIds array is required'
      }, { status: 400 });
    }

    console.log(`🔄 Manual retry triggered for ${facturaIds.length} invoices`);

    // Get facturi data
    const query = `
      SELECT
        ae.factura_id,
        ae.retry_count,
        fg.numar as factura_numar,
        fg.serie as factura_serie
      FROM ${TABLE_ANAF_EFACTURA} ae
      JOIN ${TABLE_FACTURI_GENERATE} fg ON ae.factura_id = fg.id
      WHERE ae.factura_id IN UNNEST(@facturaIds)
        AND ae.anaf_status IN ('draft', 'error')
    `;

    const [rows] = await bigquery.query({
      query,
      params: { facturaIds },
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No eligible invoices found for retry'
      }, { status: 404 });
    }

    // Retry each factura
    const results = await Promise.allSettled(
      rows.map((row: any) => retryFacturaUpload({
        factura_id: row.factura_id,
        retry_count: parseInt(row.retry_count) || 0,
        factura_numar: row.factura_numar,
        factura_serie: row.factura_serie
      }))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      message: `Manual retry complete: ${successful} successful, ${failed} failed`,
      processed: results.length,
      successful,
      failed,
      details: results.map((r, i) => ({
        facturaId: rows[i].factura_id,
        success: r.status === 'fulfilled' && r.value.success,
        message: r.status === 'fulfilled' ? r.value.message : 'Processing error'
      }))
    });

  } catch (error) {
    console.error('❌ Error in manual retry:', error);
    return NextResponse.json({
      success: false,
      error: 'Manual retry failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
