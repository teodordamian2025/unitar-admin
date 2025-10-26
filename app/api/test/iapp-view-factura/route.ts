// =====================================================
// API TEST: Test iapp.ro /e-factura/view-furnizori endpoint
// URL: GET /api/test/iapp-view-factura?id_solicitare=xxx
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getIappAuthHeaders, getIappConfig } from '@/lib/iapp-facturi-primite';
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

/**
 * GET /api/test/iapp-view-factura
 * Test endpoint pentru a vedea ce returnează view-furnizori
 * Query params: id_solicitare (opțional - ia prima factură din DB dacă nu e specificat)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let idSolicitare = searchParams.get('id_solicitare');

    // Dacă nu avem ID, ia prima factură iapp.ro din DB
    if (!idSolicitare) {
      const query = `
        SELECT id_mesaj_anaf, serie_numar, nume_emitent
        FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
        WHERE observatii LIKE '%iapp.ro%'
          AND activ = TRUE
        ORDER BY data_preluare DESC
        LIMIT 1
      `;

      const [rows] = await bigquery.query({ query, location: 'EU' });

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No iapp.ro invoices found in database. Run sync first.'
        }, { status: 404 });
      }

      idSolicitare = rows[0].id_mesaj_anaf;
      console.log(`📋 [TEST] Using first iapp.ro invoice: ${rows[0].serie_numar} (${rows[0].nume_emitent}), ID: ${idSolicitare}`);
    }

    // Get config și auth
    const config = await getIappConfig();
    const authHeaders = await getIappAuthHeaders();

    console.log(`🧪 [TEST] Calling view-furnizori with id_solicitare: ${idSolicitare}`);

    // Call API view-furnizori
    const response = await fetch('https://api.my.iapp.ro/e-factura/view-furnizori', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        email_responsabil: config.email_responsabil,
        id_incarcare: String(idSolicitare)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`iapp.ro API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(`✅ [TEST] API Response status: ${data.status}`);
    console.log(`📄 [TEST] Full response structure:`, JSON.stringify(data, null, 2));

    // Analizează structura răspunsului
    const analysis = {
      has_line_items: !!data.data?.factura?.articole || !!data.data?.factura?.items || !!data.data?.factura?.linii,
      has_xml_content: !!data.data?.xml || !!data.data?.xml_content,
      has_pdf_link: !!data.data?.pdf_url || !!data.data?.pdf_link,
      has_zip_link: !!data.data?.zip_url || !!data.data?.zip_link,
      response_keys: data.data ? Object.keys(data.data) : [],
      factura_keys: data.data?.factura ? Object.keys(data.data.factura) : []
    };

    return NextResponse.json({
      success: true,
      id_solicitare: idSolicitare,
      analysis,
      full_response: data
    });

  } catch (error: any) {
    console.error('❌ [TEST] Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed',
      details: error.stack
    }, { status: 500 });
  }
}
