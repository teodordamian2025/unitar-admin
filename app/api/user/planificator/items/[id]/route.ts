// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/route.ts
// DATA: 30.09.2025 22:15 (ora României)
// DESCRIERE: API pentru DELETE individual item din planificator (utilizatori normali)
// FUNCȚIONALITATE: DELETE cu validare utilizator - identic cu admin
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

export async function DELETE(
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

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
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
      return NextResponse.json({ error: 'Unauthorized to delete this item' }, { status: 403 });
    }

    // Soft delete - marchează ca inactiv
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      SET activ = FALSE, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @itemId AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { itemId, userId }
    });

    return NextResponse.json({
      success: true,
      message: 'Item removed from planificator successfully'
    });

  } catch (error) {
    console.error('Error deleting planificator item:', error);
    return NextResponse.json(
      { error: 'Failed to delete planificator item' },
      { status: 500 }
    );
  }
}
