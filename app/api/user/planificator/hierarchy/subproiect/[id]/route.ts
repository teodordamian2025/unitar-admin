// ==================================================================
// CALEA: app/api/user/planificator/hierarchy/subproiect/[id]/route.ts
// DATA: 30.09.2025 00:38 (ora României)
// DESCRIERE: API hierarchy subproiect pentru utilizatori normali
// FUNCȚIONALITATE: Sarcini subproiect pentru utilizatori normali cu restricții
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Sarcini ale subproiectului
    const sarciniQuery = `
      SELECT DISTINCT
        s.id,
        'sarcina' as tip,
        s.Nume as nume,
        0 as sarcini_count,
        EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
               WHERE pp.item_id = s.id AND pp.tip_item = 'sarcina' AND pp.utilizator_uid = @userId) as in_planificator,
        TRUE as can_open_details,
        s.Urgenta as urgenta,
        s.Data_Scadenta as data_scadenta,
        s.Progres_Procent as progres_procent
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
      WHERE s.Proiect_ID = @subproiectId
        AND s.utilizator_uid = @userId
      ORDER BY s.Nume
    `;

    const [sarciniRows] = await bigquery.query({
      query: sarciniQuery,
      params: { subproiectId: id, userId }
    });

    const sarcini = sarciniRows.map((row: any) => ({
      id: row.id,
      tip: row.tip,
      nume: row.nume,
      sarcini_count: parseInt(row.sarcini_count) || 0,
      in_planificator: row.in_planificator,
      can_open_details: row.can_open_details,
      urgenta: row.urgenta,
      data_scadenta: row.data_scadenta?.value || row.data_scadenta,
      progres_procent: row.progres_procent
    }));

    return NextResponse.json({ sarcini });

  } catch (error) {
    console.error('Error loading subproject tasks for normal user:', error);
    return NextResponse.json(
      { error: 'Failed to load subproject tasks' },
      { status: 500 }
    );
  }
}