// =====================================================
// API: Dezasociază factură ANAF de la cheltuială
// URL: POST /api/anaf/facturi-primite/disassociate
// Data: 31.01.2026
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

const FACTURI_TABLE = `${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2`;
const CHELTUIELI_TABLE = `${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2`;

/**
 * POST /api/anaf/facturi-primite/disassociate
 * Body: { factura_id, cheltuiala_id }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { factura_id, cheltuiala_id } = body;

    if (!factura_id || !cheltuiala_id) {
      return NextResponse.json(
        { success: false, error: 'factura_id și cheltuiala_id sunt obligatorii' },
        { status: 400 }
      );
    }

    console.log(`🔓 [Disassociate] Factura: ${factura_id}, Cheltuiala: ${cheltuiala_id}`);

    // 1. Resetează asocierea pe factură
    const updateFacturaQuery = `
      UPDATE \`${FACTURI_TABLE}\`
      SET
        cheltuiala_asociata_id = NULL,
        asociere_automata = NULL,
        asociere_confidence = NULL,
        asociere_manual_user_id = NULL,
        status_procesare = 'procesat',
        data_asociere = NULL
      WHERE id = @factura_id
    `;

    await bigquery.query({
      query: updateFacturaQuery,
      params: { factura_id },
      location: 'EU',
    });

    // 2. Resetează status_facturare pe cheltuială
    const updateCheltuialaQuery = `
      UPDATE \`${CHELTUIELI_TABLE}\`
      SET
        status_facturare = 'Nefacturat',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @cheltuiala_id
    `;

    await bigquery.query({
      query: updateCheltuialaQuery,
      params: { cheltuiala_id },
      location: 'EU',
    });

    console.log(`✅ [Disassociate] Dezasociere completă`);

    return NextResponse.json({
      success: true,
      message: 'Factură dezasociată cu succes',
    });

  } catch (error: any) {
    console.error('❌ Eroare la dezasociere:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
