// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/route.ts
// DATA: 30.09.2025 22:15 (ora României)
// DESCRIERE: API pentru DELETE individual item din planificator (utilizatori normali)
// FUNCȚIONALITATE: DELETE cu validare utilizator - identic cu admin
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

console.log(`🔧 [[id]] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
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
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
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
