// ==================================================================
// CALEA: app/api/planificator/items/[id]/realizat/route.ts
// DATA: 28.09.2025 14:15 (ora României)
// DESCRIERE: API pentru marcarea realizării task-urilor în planificator
// FUNCȚIONALITATE: POST pentru toggle realizat status
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = 'PanouControlUnitar';
const TABLE_ID = 'PlanificatorPersonal';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Decodează token-ul Firebase și obține UID-ul real al utilizatorului
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { is_realizat } = body;

    if (typeof is_realizat !== 'boolean') {
      return NextResponse.json(
        { error: 'is_realizat must be a boolean' },
        { status: 400 }
      );
    }

    // Verifică dacă item-ul există și aparține utilizatorului
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE id = @id AND utilizator_uid = @userId AND activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { id, userId }
    });

    if (checkRows[0].count === 0) {
      return NextResponse.json(
        { error: 'Item not found or not authorized' },
        { status: 404 }
      );
    }

    // Pentru că nu avem coloana is_realizat în schema actuală,
    // vom stoca informația în comentariu_personal cu un marker special
    // Alternativ, putem adăuga această coloană la tabela BigQuery

    // SOLUȚIA TEMPORARĂ: folosim comentariu pentru a stoca starea realizat
    const currentItemQuery = `
      SELECT comentariu_personal
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE id = @id AND utilizator_uid = @userId
    `;

    const [currentRows] = await bigquery.query({
      query: currentItemQuery,
      params: { id, userId }
    });

    const currentComentariu = currentRows[0]?.comentariu_personal || '';
    const realizatMarker = '[REALIZAT]';

    let newComentariu;
    if (is_realizat) {
      // Adaugă marker-ul de realizat dacă nu există
      if (!currentComentariu.includes(realizatMarker)) {
        newComentariu = currentComentariu ? `${realizatMarker} ${currentComentariu}` : realizatMarker;
      } else {
        newComentariu = currentComentariu; // Deja este marcat
      }
    } else {
      // Elimină marker-ul de realizat
      newComentariu = currentComentariu.replace(realizatMarker, '').trim();
    }

    // Update în BigQuery
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      SET
        comentariu_personal = @comentariu,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        id,
        userId,
        comentariu: newComentariu
      }
    });

    return NextResponse.json({
      success: true,
      is_realizat,
      message: is_realizat ? 'Item marcat ca realizat' : 'Item marcat ca nerealizat'
    });

  } catch (error) {
    console.error('Error updating realizat status:', error);
    return NextResponse.json(
      { error: 'Failed to update realizat status' },
      { status: 500 }
    );
  }
}