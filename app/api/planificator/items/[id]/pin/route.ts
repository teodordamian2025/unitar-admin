// ==================================================================
// CALEA: app/api/planificator/items/[id]/pin/route.ts
// DATA: 27.09.2025 16:32 (ora României)
// DESCRIERE: API pentru pin/unpin item în planificator
// FUNCȚIONALITATE: POST pentru toggle pin (doar unul activ pe utilizator)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
// Simple authentication pattern consistent with existing APIs
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
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

    const token = authHeader.split('Bearer ')[1];
    // For development - in production this should verify Firebase token
    const userId = 'demo_user_id';
    const itemId = params.id;

    const body = await request.json();
    const { is_pinned } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned must be boolean' }, { status: 400 });
    }

    // Verifică dacă item-ul aparține utilizatorului curent
    const checkQuery = `
      SELECT utilizator_uid
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
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

    // Dacă pinează, mai întâi elimină pin-ul de la toate celelalte items
    if (is_pinned) {
      const unpinAllQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        SET is_pinned = FALSE, data_actualizare = CURRENT_TIMESTAMP()
        WHERE utilizator_uid = @userId AND is_pinned = TRUE AND activ = TRUE
      `;

      await bigquery.query({
        query: unpinAllQuery,
        params: { userId }
      });
    }

    // Update pin pentru item-ul curent
    const updatePinQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      SET is_pinned = @is_pinned, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @itemId AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updatePinQuery,
      params: { itemId, userId, is_pinned }
    });

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