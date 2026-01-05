// =====================================================
// API: Asociere Manuală Factură → Cheltuială / Tranzacție
// URL: POST /api/anaf/facturi-primite/associate
// Data: 08.10.2025 (Updated: 2026-01-05)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { manualAssociate, findMatches, findTranzactiiMatches } from '@/lib/facturi-primite-matcher';
import type { AssociateInvoiceRequest } from '@/lib/facturi-primite-types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/anaf/facturi-primite/associate
 * Body: { factura_id, cheltuiala_id, user_id, observatii? }
 */
export async function POST(req: NextRequest) {
  try {
    const body: AssociateInvoiceRequest = await req.json();

    if (!body.factura_id || !body.cheltuiala_id || !body.user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`🔗 Asociere manuală: Factură ${body.factura_id} → Cheltuială ${body.cheltuiala_id}`);

    await manualAssociate(
      body.factura_id,
      body.cheltuiala_id,
      body.user_id,
      body.observatii
    );

    // TODO: Trigger notificare către responsabil proiect
    // await sendNotification({
    //   tip: 'factura_primita_asociata',
    //   user_id: responsabil_proiect_id,
    //   context: { factura_id, cheltuiala_id, proiect_id }
    // });

    return NextResponse.json({
      success: true,
      message: 'Factură asociată cu succes',
    });

  } catch (error: any) {
    console.error('❌ Eroare la asociere manuală:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/anaf/facturi-primite/associate?factura_id=xxx
 * Returnează sugestii de match-uri pentru o factură (cheltuieli + tranzacții)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const facturaId = searchParams.get('factura_id');

    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'Missing factura_id' },
        { status: 400 }
      );
    }

    // Fetch factură din DB
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const query = `
      SELECT *
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiPrimiteANAF_v2\`
      WHERE id = @id
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, params: { id: facturaId } });

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Factură nu a fost găsită' },
        { status: 404 }
      );
    }

    const factura = rows[0];

    // Găsește match-uri în paralel (threshold 50%)
    const [cheltuieliMatches, tranzactiiMatches] = await Promise.all([
      findMatches(factura, 0.5),
      findTranzactiiMatches(factura, 0.5)
    ]);

    return NextResponse.json({
      success: true,
      matches: cheltuieliMatches, // Pentru compatibilitate cu UI-ul existent
      tranzactii: tranzactiiMatches, // Nou: tranzacții bancare găsite
      summary: {
        cheltuieli_count: cheltuieliMatches.length,
        tranzactii_count: tranzactiiMatches.length,
        total_matches: cheltuieliMatches.length + tranzactiiMatches.length
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare la găsire match-uri:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
