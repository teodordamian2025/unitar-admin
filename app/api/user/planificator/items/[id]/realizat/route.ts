// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/realizat/route.ts
// DATA: 30.09.2025 00:25 (ora României)
// DESCRIERE: API pentru marchează ca realizat items planificator utilizatori normali
// FUNCȚIONALITATE: Toggle realizat status prin modificarea comentariului cu marker [REALIZAT]
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

console.log(`🔧 [Realizat] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const { is_realizat } = body;

    if (typeof is_realizat !== 'boolean') {
      return NextResponse.json({ error: 'is_realizat must be boolean' }, { status: 400 });
    }

    // Obține comentariul curent
    const getCurrentQuery = `
      SELECT comentariu_personal
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      WHERE id = @id AND utilizator_uid = @userId
    `;

    const [currentRows] = await bigquery.query({
      query: getCurrentQuery,
      params: { id, userId }
    });

    if (currentRows.length === 0) {
      return NextResponse.json({ error: 'Item not found or access denied' }, { status: 404 });
    }

    const currentComment = currentRows[0].comentariu_personal || '';
    const realizatMarker = '[REALIZAT]';

    let newComment;
    if (is_realizat) {
      // Adaugă marker-ul dacă nu există
      if (!currentComment.includes(realizatMarker)) {
        newComment = currentComment ? `${currentComment} ${realizatMarker}` : realizatMarker;
      } else {
        newComment = currentComment; // Deja există
      }
    } else {
      // Elimină marker-ul
      newComment = currentComment.replace(realizatMarker, '').trim();
    }

    // Actualizează comentariul
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      SET comentariu_personal = @new_comment, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: { id, userId, new_comment: newComment }
    });

    return NextResponse.json({
      success: true,
      message: is_realizat ? 'Item marked as completed' : 'Item marked as not completed'
    });

  } catch (error) {
    console.error('Error updating realizat status:', error);
    return NextResponse.json(
      { error: 'Failed to update realizat status' },
      { status: 500 }
    );
  }
}