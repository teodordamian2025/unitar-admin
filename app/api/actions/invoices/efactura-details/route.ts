// CALEA: app/api/actions/invoices/efactura-details/route.ts
// DESCRIERE: Detalii e-factura cu timeline din BigQuery
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;

console.log(`🔧 EFactura Details API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: AnafEFactura${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ Interface pentru evenimentele din timeline
interface TimelineEvent {
  data: string;
  eveniment: string;
  status: 'success' | 'error' | 'pending';
  detalii: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaId = searchParams.get('facturaId');
    
    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId este obligatoriu' }, { status: 400 });
    }
    
    // Query pentru detalii e-factura din AnafEFactura
    const query = `
      SELECT
        anaf_upload_id,
        anaf_status,
        error_message,
        error_code,
        data_upload,
        data_validare,
        retry_count,
        anaf_response,
        data_creare,
        data_actualizare
      FROM ${TABLE_ANAF_EFACTURA}
      WHERE factura_id = @facturaId
      ORDER BY data_creare DESC
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { facturaId },
      location: 'EU'
    });
    
    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu s-au găsit detalii e-factura pentru această factură'
      }, { status: 404 });
    }
    
    const efacturaData = rows[0];
    
    // ✅ Construiește timeline-ul cu tip explicit
    const timeline: TimelineEvent[] = [];
    
    // Eveniment creare XML
    timeline.push({
      data: efacturaData.data_creare,
      eveniment: 'XML e-factura generat',
      status: 'success',
      detalii: `XML ID: ${efacturaData.anaf_upload_id}`
    });
    
    // Eveniment upload la ANAF (dacă există)
    if (efacturaData.data_upload) {
      timeline.push({
        data: efacturaData.data_upload,
        eveniment: 'Trimis la ANAF',
        status: 'success',
        detalii: 'E-factura a fost încărcată în sistemul ANAF'
      });
    }
    
    // Eveniment validare ANAF (dacă există)
    if (efacturaData.data_validare) {
      timeline.push({
        data: efacturaData.data_validare,
        eveniment: 'Validat de ANAF',
        status: efacturaData.anaf_status === 'validated' ? 'success' : 'error',
        detalii: efacturaData.error_message || 'E-factura a fost procesată de ANAF'
      });
    }
    
    // Eveniment eroare (dacă există)
    if (efacturaData.error_message) {
      timeline.push({
        data: efacturaData.data_actualizare,
        eveniment: 'Eroare ANAF',
        status: 'error',
        detalii: `${efacturaData.error_code}: ${efacturaData.error_message}`
      });
    }
    
    return NextResponse.json({
      success: true,
      xmlId: efacturaData.anaf_upload_id,
      status: efacturaData.anaf_status,
      errorMessage: efacturaData.error_message,
      errorCode: efacturaData.error_code,
      dataUpload: efacturaData.data_upload,
      dataValidare: efacturaData.data_validare,
      retryCount: efacturaData.retry_count,
      timeline: timeline.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    });
    
  } catch (error) {
    console.error('Eroare detalii e-factura:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la preluarea detaliilor e-factura'
    }, { status: 500 });
  }
}
