// ==================================================================
// CALEA: app/api/actions/invoices/update/route.ts
// DESCRIERE: API pentru actualizarea facturilor (Edit/Storno)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      facturaId,
      status,
      observatii
    } = body;

    if (!facturaId) {
      return NextResponse.json(
        { error: 'ID factură lipsă' },
        { status: 400 }
      );
    }

    console.log(`📝 Actualizare factură ${facturaId}: status=${status}`);

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET 
        status = @status,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateQuery,
      params: { 
        facturaId,
        status
      },
      types: {
        facturaId: 'STRING',
        status: 'STRING'
      },
      location: 'EU'
    });

    console.log(`✅ Factură ${facturaId} actualizată: status=${status}`);

    return NextResponse.json({
      success: true,
      message: 'Factură actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea facturii:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la actualizarea facturii',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}
