// ==================================================================
// CALEA: app/api/planificator/items/[id]/comentariu/route.ts
// DATA: 27.09.2025 16:33 (ora României)
// DESCRIERE: API pentru update comentariu personal în planificator
// FUNCȚIONALITATE: POST pentru actualizare comentariu cu debounce
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const PLANIFICATOR_TABLE = `\`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\``;

console.log(`🔧 [Planificator Comentariu] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const itemId = params.id;

    const body = await request.json();
    const { comentariu_personal } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    // Verifică dacă item-ul aparține utilizatorului curent
    const checkQuery = `
      SELECT utilizator_uid
      FROM ${PLANIFICATOR_TABLE}
      WHERE id = @itemId AND activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { itemId }
    });

    if (checkRows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (checkRows[0].utilizator_uid !== userId) {
      return NextResponse.json({ error: 'Unauthorized to modify this item' }, { status: 403 });
    }

    // Verifică dacă comentariul curent are marker-ul [REALIZAT]
    const currentItemQuery = `
      SELECT comentariu_personal
      FROM ${PLANIFICATOR_TABLE}
      WHERE id = @itemId AND utilizator_uid = @userId
    `;

    const [currentRows] = await bigquery.query({
      query: currentItemQuery,
      params: { itemId, userId }
    });

    const currentComentariu = currentRows[0]?.comentariu_personal || '';
    const realizatMarker = '[REALIZAT]';
    const hasRealizatMarker = currentComentariu.includes(realizatMarker);

    // Păstrează marker-ul de realizat dacă există
    const finalComentariu = hasRealizatMarker
      ? `${realizatMarker} ${comentariu_personal || ''}`.trim()
      : comentariu_personal || '';

    // Update comentariu personal
    const updateQuery = `
      UPDATE ${PLANIFICATOR_TABLE}
      SET comentariu_personal = @comentariu_personal, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @itemId AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        itemId,
        userId,
        comentariu_personal: finalComentariu
      }
    });

    return NextResponse.json({
      success: true,
      comentariu_personal,
      message: 'Personal comment updated successfully'
    });

  } catch (error) {
    console.error('Error updating personal comment:', error);
    return NextResponse.json(
      { error: 'Failed to update personal comment' },
      { status: 500 }
    );
  }
}