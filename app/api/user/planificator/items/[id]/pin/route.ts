// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/pin/route.ts
// DATA: 02.10.2025 (ora României) - FIXED: Adăugat unpinAll logic
// DESCRIERE: API pentru pin/unpin items planificator utilizatori normali
// FUNCȚIONALITATE: Toggle pin status cu validare că item aparține utilizatorului curent + unpinAll
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

console.log(`🔧 [Pin] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { is_pinned } = body;

    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned must be boolean' }, { status: 400 });
    }

    console.log(`📌 [User Pin API] - Request: userId=${userId}, itemId=${id}, is_pinned=${is_pinned}`);

    // Verifică că item-ul există și aparține utilizatorului curent
    const checkQuery = `
      SELECT id, utilizator_uid
      FROM \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      WHERE id = @id AND activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { id }
    });

    if (checkRows.length === 0) {
      console.warn(`⚠️ [User Pin API] - Item not found: ${id}`);
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (checkRows[0].utilizator_uid !== userId) {
      console.warn(`⚠️ [User Pin API] - Unauthorized: userId=${userId}, owner=${checkRows[0].utilizator_uid}`);
      return NextResponse.json({ error: 'Unauthorized to modify this item' }, { status: 403 });
    }

    // CRITICAL FIX: Dacă pinează, mai întâi elimină pin-ul de la toate celelalte items
    // (identic cu logica din admin API)
    if (is_pinned) {
      const unpinAllQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
        SET is_pinned = FALSE, data_actualizare = CURRENT_TIMESTAMP()
        WHERE utilizator_uid = @userId AND is_pinned = TRUE AND activ = TRUE AND id != @id
      `;

      const [unpinResult] = await bigquery.query({
        query: unpinAllQuery,
        params: { userId, id }
      });

      console.log(`🔧 [User Pin API] - Unpinned other items for user ${userId}`);
    }

    // Update pin pentru item-ul curent
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      SET is_pinned = @is_pinned, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id AND utilizator_uid = @userId
    `;

    const [result] = await bigquery.query({
      query: updateQuery,
      params: { id, userId, is_pinned }
    });

    console.log(`✅ [User Pin API] - Success: itemId=${id}, is_pinned=${is_pinned}`);

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