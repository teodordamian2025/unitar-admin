// ==================================================================
// CALEA: app/api/user/planificator/reorder/route.ts
// DATA: 30.09.2025 00:36 (ora României)
// DESCRIERE: API reorder pentru utilizatori normali
// FUNCȚIONALITATE: Reordonare items planificator pentru utilizatori normali
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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Validează că toate items aparțin utilizatorului curent
    const itemIds = items.map(item => item.id);
    const validateQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE id IN UNNEST(@itemIds) AND utilizator_uid = @userId
    `;

    const [validateRows] = await bigquery.query({
      query: validateQuery,
      params: { itemIds, userId }
    });

    if (validateRows[0].count !== items.length) {
      return NextResponse.json({ error: 'Access denied - some items do not belong to user' }, { status: 403 });
    }

    // Update ordinea pentru fiecare item
    const updatePromises = items.map(async (item: any) => {
      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        SET ordine_pozitie = @ordine, data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id AND utilizator_uid = @userId
      `;

      return bigquery.query({
        query: updateQuery,
        params: {
          id: item.id,
          ordine: item.ordine_pozitie,
          userId
        }
      });
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Reordered ${items.length} items successfully`
    });

  } catch (error) {
    console.error('Error reordering items for normal user:', error);
    return NextResponse.json(
      { error: 'Failed to reorder items' },
      { status: 500 }
    );
  }
}