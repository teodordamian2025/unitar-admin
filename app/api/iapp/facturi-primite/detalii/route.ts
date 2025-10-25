// =====================================================
// API: Returnare Detalii Factură Primită
// URL: GET /api/iapp/facturi-primite/detalii?factura_id=xxx
// Data: 25.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { fetchFacturaDetails } from '@/lib/iapp-facturi-primite';

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
 * GET /api/iapp/facturi-primite/detalii?factura_id=xxx
 * Returnează detalii complete factură (articole, PDF link)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facturaId = searchParams.get('factura_id');

    if (!facturaId) {
      return NextResponse.json({
        success: false,
        error: 'Missing factura_id parameter'
      }, { status: 400 });
    }

    console.log(`📋 [iapp.ro Detalii] Fetch detalii pentru factură ID: ${facturaId}`);

    // Citește factura din BigQuery
    const query = `
      SELECT
        id, id_mesaj_anaf, serie_numar, nume_emitent,
        xml_content, observatii
      FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
      WHERE id = @factura_id
        AND activ = TRUE
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { factura_id: facturaId },
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 });
    }

    const factura = rows[0];

    // Verifică dacă avem deja detalii salvate în xml_content
    if (factura.xml_content) {
      try {
        const detalii = JSON.parse(factura.xml_content);
        console.log(`✅ [iapp.ro Detalii] Detalii găsite în DB pentru ${factura.serie_numar}`);

        return NextResponse.json({
          success: true,
          source: 'database',
          detalii
        });
      } catch (parseError) {
        console.warn(`⚠️ [iapp.ro Detalii] Eroare parsare xml_content:`, parseError);
      }
    }

    // Dacă nu avem detalii salvate și e factură iapp.ro, fetch live
    if (factura.observatii?.includes('iapp.ro') && factura.id_mesaj_anaf) {
      console.log(`🔄 [iapp.ro Detalii] Fetch live pentru ${factura.serie_numar}`);

      try {
        const detalii = await fetchFacturaDetails(factura.id_mesaj_anaf);

        // Încercare să salveze detaliile în DB pentru viitor (non-critical)
        try {
          const updateQuery = `
            UPDATE \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
            SET xml_content = @xml_content
            WHERE id = @factura_id
          `;

          await bigquery.query({
            query: updateQuery,
            params: {
              factura_id: facturaId,
              xml_content: JSON.stringify(detalii)
            },
            location: 'EU'
          });

          console.log(`✅ [iapp.ro Detalii] Detalii salvate în DB pentru ${factura.serie_numar}`);
        } catch (updateError) {
          // Non-critical - poate fi în streaming buffer
          console.warn(`⚠️ [iapp.ro Detalii] Nu s-au putut salva detalii în DB (poate streaming buffer):`, updateError);
        }

        return NextResponse.json({
          success: true,
          source: 'live_fetch',
          detalii
        });
      } catch (fetchError) {
        console.error(`❌ [iapp.ro Detalii] Eroare fetch live:`, fetchError);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch invoice details',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // Factură ANAF sau fără detalii disponibile
    return NextResponse.json({
      success: false,
      error: 'Details not available for this invoice'
    }, { status: 404 });

  } catch (error: any) {
    console.error('❌ [iapp.ro Detalii] Error:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch invoice details',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
