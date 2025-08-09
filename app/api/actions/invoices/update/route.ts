// ==================================================================
// CALEA: app/api/actions/invoices/update/route.ts
// DESCRIERE: API pentru actualizarea facturilor
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
      stornoFacturaId,
      valoare_platita,
      data_plata,
      observatii,
      date_complete_json
    } = body;

    if (!facturaId) {
      return NextResponse.json(
        { error: 'ID factură lipsă' },
        { status: 400 }
      );
    }

    // Construiește câmpurile de actualizat
    const updateFields: string[] = [];
    const params: any = { facturaId };

    if (status !== undefined) {
      updateFields.push('status = @status');
      params.status = status;
    }

    if (stornoFacturaId !== undefined) {
      // ✅ NOU: Salvează ID-ul facturii de stornare în JSON
      updateFields.push(`
        date_complete_json = JSON_SET(
          IFNULL(date_complete_json, '{}'),
          '$.stornoFacturaId',
          @stornoFacturaId
        )
      `);
      params.stornoFacturaId = stornoFacturaId;
    }

    if (valoare_platita !== undefined) {
      updateFields.push('valoare_platita = @valoare_platita');
      params.valoare_platita = valoare_platita;
    }

    if (data_plata !== undefined) {
      updateFields.push('data_plata = @data_plata');
      params.data_plata = data_plata;
    }

    if (observatii !== undefined) {
      // ✅ CORECTAT: Actualizează observațiile în JSON
      updateFields.push(`
        date_complete_json = JSON_SET(
          IFNULL(date_complete_json, '{}'),
          '$.observatiiStornare',
          @observatii
        )
      `);
      params.observatii = observatii;
    }

    if (date_complete_json !== undefined) {
      updateFields.push('date_complete_json = @date_complete_json');
      params.date_complete_json = date_complete_json;
    }

    // Adaugă data actualizării
    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    if (updateFields.length === 1) { // Doar data_actualizare
      return NextResponse.json(
        { error: 'Nu există câmpuri de actualizat' },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET ${updateFields.join(', ')}
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateQuery,
      params,
      location: 'EU'
    });

    console.log(`✅ Factură ${facturaId} actualizată cu succes`);

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
