// ==================================================================
// CALEA: app/api/planificator/items/[id]/route.ts
// DATA: 27.09.2025 16:30 (ora României)
// DESCRIERE: API pentru DELETE individual item din planificator
// FUNCȚIONALITATE: DELETE cu validare utilizator
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

export async function DELETE(
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