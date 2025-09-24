// ==================================================================
// CALEA: app/api/user/comentarii/route.ts
// DATA: 23.09.2025 18:55 (ora României)
// DESCRIERE: API pentru comentarii utilizatori normali - IDENTIC cu admin
// FUNCȚIONALITATE: GET și POST pentru comentarii pe proiecte
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

const dataset = bigquery.dataset('PanouControlUnitar');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiect_id = searchParams.get('proiect_id');

    if (!proiect_id) {
      return NextResponse.json({ error: 'proiect_id este obligatoriu' }, { status: 400 });
    }

    // Query pentru comentarii - IDENTIC cu admin
    const comentariiQuery = `
      SELECT
        id,
        proiect_id,
        tip_comentariu,
        comentariu,
        autor_uid,
        autor_nume,
        data_comentariu
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ProiectComentarii\`
      WHERE proiect_id = @proiect_id
      ORDER BY data_comentariu DESC
    `;

    const [rows] = await bigquery.query({
      query: comentariiQuery,
      params: { proiect_id }
    });

    return NextResponse.json({
      success: true,
      comentarii: rows
    });

  } catch (error) {
    console.error('Eroare la încărcarea comentariilor:', error);
    return NextResponse.json(
      { error: 'Eroare la încărcarea comentariilor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const comentariuData = await request.json();

    // Validări de bază
    if (!comentariuData.proiect_id || !comentariuData.comentariu?.trim() || !comentariuData.autor_uid) {
      return NextResponse.json({
        error: 'Date lipsă: proiect_id, comentariu și autor_uid sunt obligatorii'
      }, { status: 400 });
    }

    // Generează ID pentru comentariu
    const comentariuId = `COMMENT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Inserare comentariu în BigQuery - IDENTIC cu admin
    const insertComentariuQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ProiectComentarii\`
      (
        id, proiect_id, tip_comentariu, comentariu, autor_uid, autor_nume, data_comentariu
      )
      VALUES
      (
        @id, @proiect_id, @tip_comentariu, @comentariu, @autor_uid, @autor_nume, CURRENT_TIMESTAMP()
      )
    `;

    await bigquery.query({
      query: insertComentariuQuery,
      params: {
        id: comentariuId,
        proiect_id: comentariuData.proiect_id,
        tip_comentariu: comentariuData.tip_comentariu || 'General',
        comentariu: comentariuData.comentariu.trim(),
        autor_uid: comentariuData.autor_uid,
        autor_nume: comentariuData.autor_nume || 'Utilizator necunoscut'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Comentariu adăugat cu succes',
      comentariu_id: comentariuId
    });

  } catch (error) {
    console.error('Eroare la adăugarea comentariului:', error);
    return NextResponse.json(
      { error: 'Eroare la adăugarea comentariului' },
      { status: 500 }
    );
  }
}