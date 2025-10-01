// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/comentariu/route.ts
// DATA: 30.09.2025 00:30 (ora României)
// DESCRIERE: API pentru update comentarii items planificator utilizatori normali
// FUNCȚIONALITATE: Actualizare comentariu personal cu validare că item aparține utilizatorului
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

console.log(`🔧 [Comentariu] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const { comentariu_personal } = body;

    if (typeof comentariu_personal !== 'string') {
      return NextResponse.json({ error: 'comentariu_personal must be string' }, { status: 400 });
    }

    // Actualizează doar pentru utilizatorul curent
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      SET comentariu_personal = @comentariu, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: { id, userId, comentariu: comentariu_personal }
    });

    return NextResponse.json({
      success: true,
      message: 'Comment updated successfully'
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}