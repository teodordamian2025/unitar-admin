// ==================================================================
// CALEA: app/api/user/sarcini/[id]/route.ts
// DATA: 23.09.2025 18:50 (ora României)
// DESCRIERE: API pentru editare sarcină individuală utilizatori - IDENTIC cu admin
// FUNCȚIONALITATE: PUT pentru actualizare sarcină cu sincronizare progres/status
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});

const dataset = bigquery.dataset('PanouControlUnitar');

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sarcinaId = params.id;
    const updateData = await request.json();

    if (!sarcinaId) {
      return NextResponse.json({ error: 'ID sarcină lipsește' }, { status: 400 });
    }

    // Validări de bază
    if (!updateData.titlu?.trim()) {
      return NextResponse.json({ error: 'Titlul sarcinii este obligatoriu' }, { status: 400 });
    }

    // Calculează timp total estimat în ore
    const zile = Number(updateData.timp_estimat_zile) || 0;
    const ore = Number(updateData.timp_estimat_ore) || 0;
    const timpTotalOre = (zile * 8) + ore;

    // Update sarcină în BigQuery - IDENTIC cu admin
    const updateSarcinaQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
      SET
        titlu = @titlu,
        descriere = @descriere,
        status = @status,
        prioritate = @prioritate,
        progres_procent = @progres_procent,
        progres_descriere = @progres_descriere,
        data_scadenta = @data_scadenta,
        observatii = @observatii,
        timp_estimat_zile = @timp_estimat_zile,
        timp_estimat_ore = @timp_estimat_ore,
        timp_estimat_total_ore = @timp_estimat_total_ore,
        data_modificare = CURRENT_TIMESTAMP()
      WHERE id = @sarcina_id
    `;

    await bigquery.query({
      query: updateSarcinaQuery,
      params: {
        sarcina_id: sarcinaId,
        titlu: updateData.titlu.trim(),
        descriere: updateData.descriere?.trim() || null,
        status: updateData.status || 'De făcut',
        prioritate: updateData.prioritate || 'Medie',
        progres_procent: Number(updateData.progres_procent) || 0,
        progres_descriere: updateData.progres_descriere?.trim() || null,
        data_scadenta: updateData.data_scadenta || null,
        observatii: updateData.observatii?.trim() || null,
        timp_estimat_zile: zile,
        timp_estimat_ore: ore,
        timp_estimat_total_ore: timpTotalOre
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Sarcină actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea sarcinii:', error);
    return NextResponse.json(
      { error: 'Eroare la actualizarea sarcinii' },
      { status: 500 }
    );
  }
}