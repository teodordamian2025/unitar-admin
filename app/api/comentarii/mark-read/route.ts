// ==================================================================
// CALEA: app/api/comentarii/mark-read/route.ts
// DATA: 06.01.2026
// DESCRIERE: API pentru marcarea comentariilor ca citite
// FUNCȚIONALITATE: POST - marchează comentarii citite, GET - obține count necitite
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// Helper pentru escape SQL
const escapeString = (value: string): string => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
};

// GET - Obține count comentarii necitite pentru un user și/sau proiect
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const proiect_id = searchParams.get('proiect_id');

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'user_id este obligatoriu'
      }, { status: 400 });
    }

    console.log('📬 GET /api/comentarii/mark-read - Params:', { user_id, proiect_id });

    // Query pentru count comentarii necitite
    // Exclude comentariile proprii (autor_uid = user_id)
    let query = `
      SELECT
        c.proiect_id,
        COUNT(*) as necitite_count
      FROM \`${PROJECT_ID}.${DATASET}.ProiectComentarii${tableSuffix}\` c
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.ComentariiCitite${tableSuffix}\` cc
        ON c.id = cc.comentariu_id AND cc.user_id = @user_id
      WHERE cc.id IS NULL
        AND c.autor_uid != @user_id
    `;

    const params: any = { user_id };
    const types: any = { user_id: 'STRING' };

    if (proiect_id) {
      query += ` AND c.proiect_id = @proiect_id`;
      params.proiect_id = proiect_id;
      types.proiect_id = 'STRING';
    }

    query += ` GROUP BY c.proiect_id`;

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU',
    });

    // Calculează total necitite
    const totalNecitite = rows.reduce((sum: number, row: any) => sum + (parseInt(row.necitite_count) || 0), 0);

    // Convertește în map pentru acces rapid
    const necititePerProiect: Record<string, number> = {};
    rows.forEach((row: any) => {
      necititePerProiect[row.proiect_id] = parseInt(row.necitite_count) || 0;
    });

    console.log(`✅ Necitite count: total=${totalNecitite}, proiecte=${rows.length}`);

    return NextResponse.json({
      success: true,
      data: {
        total_necitite: totalNecitite,
        necitite_per_proiect: necititePerProiect,
        proiecte_cu_necitite: rows.length
      }
    });

  } catch (error) {
    console.error('❌ Eroare GET /api/comentarii/mark-read:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea count-ului comentarii necitite',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Marchează comentarii ca citite
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, proiect_id, comentariu_ids } = body;

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'user_id este obligatoriu'
      }, { status: 400 });
    }

    if (!proiect_id && (!comentariu_ids || comentariu_ids.length === 0)) {
      return NextResponse.json({
        success: false,
        error: 'Trebuie specificat proiect_id sau comentariu_ids'
      }, { status: 400 });
    }

    console.log('📬 POST /api/comentarii/mark-read - Body:', { user_id, proiect_id, comentariu_ids_count: comentariu_ids?.length });

    let insertQuery: string;

    if (proiect_id) {
      // Marchează TOATE comentariile din proiect ca citite
      // Exclude comentariile deja citite și cele proprii
      insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.ComentariiCitite${tableSuffix}\`
        (id, user_id, comentariu_id, proiect_id, data_citire, data_creare)
        SELECT
          GENERATE_UUID(),
          '${escapeString(user_id)}',
          c.id,
          c.proiect_id,
          CURRENT_TIMESTAMP(),
          CURRENT_DATE()
        FROM \`${PROJECT_ID}.${DATASET}.ProiectComentarii${tableSuffix}\` c
        LEFT JOIN \`${PROJECT_ID}.${DATASET}.ComentariiCitite${tableSuffix}\` cc
          ON c.id = cc.comentariu_id AND cc.user_id = '${escapeString(user_id)}'
        WHERE c.proiect_id = '${escapeString(proiect_id)}'
          AND cc.id IS NULL
          AND c.autor_uid != '${escapeString(user_id)}'
      `;
    } else {
      // Marchează doar comentariile specificate
      const escapedIds = comentariu_ids.map((id: string) => `'${escapeString(id)}'`).join(',');

      insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.ComentariiCitite${tableSuffix}\`
        (id, user_id, comentariu_id, proiect_id, data_citire, data_creare)
        SELECT
          GENERATE_UUID(),
          '${escapeString(user_id)}',
          c.id,
          c.proiect_id,
          CURRENT_TIMESTAMP(),
          CURRENT_DATE()
        FROM \`${PROJECT_ID}.${DATASET}.ProiectComentarii${tableSuffix}\` c
        LEFT JOIN \`${PROJECT_ID}.${DATASET}.ComentariiCitite${tableSuffix}\` cc
          ON c.id = cc.comentariu_id AND cc.user_id = '${escapeString(user_id)}'
        WHERE c.id IN (${escapedIds})
          AND cc.id IS NULL
          AND c.autor_uid != '${escapeString(user_id)}'
      `;
    }

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log('✅ Comentarii marcate ca citite');

    return NextResponse.json({
      success: true,
      message: 'Comentarii marcate ca citite'
    });

  } catch (error) {
    console.error('❌ Eroare POST /api/comentarii/mark-read:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la marcarea comentariilor ca citite',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
