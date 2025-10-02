// ==================================================================
// CALEA: app/api/planificator/items/[id]/pin/route.ts
// DATA: 02.10.2025 (ora României) - Enhanced: Adăugat logs debugging
// DESCRIERE: API pentru pin/unpin item în planificator
// FUNCȚIONALITATE: POST pentru toggle pin (doar unul activ pe utilizator) + logs
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

console.log(`🔧 [Planificator Pin] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const { is_pinned } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned must be boolean' }, { status: 400 });
    }

    console.log(`📌 [Admin Pin API] - Request: userId=${userId}, itemId=${itemId}, is_pinned=${is_pinned}`);

    // Verifică dacă item-ul aparține utilizatorului curent
    const checkQuery = `
      SELECT utilizator_uid
      FROM \`${PLANIFICATOR_TABLE}\`
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
      console.warn(`⚠️ [Admin Pin API] - Unauthorized: userId=${userId}, owner=${checkRows[0].utilizator_uid}`);
      return NextResponse.json({ error: 'Unauthorized to modify this item' }, { status: 403 });
    }

    // Dacă pinează, mai întâi elimină pin-ul de la toate celelalte items
    if (is_pinned) {
      const unpinAllQuery = `
        UPDATE \`${PLANIFICATOR_TABLE}\`
        SET is_pinned = FALSE, data_actualizare = CURRENT_TIMESTAMP()
        WHERE utilizator_uid = @userId AND is_pinned = TRUE AND activ = TRUE
      `;

      await bigquery.query({
        query: unpinAllQuery,
        params: { userId }
      });

      console.log(`🔧 [Admin Pin API] - Unpinned other items for user ${userId}`);
    }

    // Update pin pentru item-ul curent
    const updatePinQuery = `
      UPDATE \`${PLANIFICATOR_TABLE}\`
      SET is_pinned = @is_pinned, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @itemId AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updatePinQuery,
      params: { itemId, userId, is_pinned }
    });

    console.log(`✅ [Admin Pin API] - Success: itemId=${itemId}, is_pinned=${is_pinned}`);

    return NextResponse.json({
      success: true,
      is_pinned,
      message: is_pinned ? 'Item pinned successfully' : 'Item unpinned successfully'
    });

  } catch (error) {
    console.error('Error updating pin status:', error);
    return NextResponse.json(
      { error: 'Failed to update pin status' },
      { status: 500 }
    );
  }
}