// ==================================================================
// CALEA: app/api/user/planificator/hierarchy/subproiect/[id]/route.ts
// DATA: 01.10.2025 00:12 (ora României) - FIX schema reală BigQuery
// DESCRIERE: API pentru încărcarea sarcinilor unui subproiect
// FUNCȚIONALITATE: Returnează sarcini care aparțin unui subproiect specific
// FIX: Folosește s.subproiect_id, s.titlu, s.prioritate (nu s.Proiect_ID, s.Nume, s.Urgenta)
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

console.log(`🔧 [[id]] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Sarcini de subproiect - IMPORTANT: folosesc proiect_id = ID_Subproiect!
    const sarciniQuery = `
      SELECT
        s.id,
        'sarcina' as tip,
        s.titlu as nume,
        0 as sarcini_count,
        EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\` pp
               WHERE pp.item_id = s.id AND pp.tip_item = 'sarcina' AND pp.utilizator_uid = @userId) as in_planificator,
        s.prioritate as urgenta,
        s.data_scadenta,
        s.progres_procent
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\` s
      WHERE s.proiect_id = @subproiectId
        AND s.status NOT IN ('Finalizată', 'Anulată')
      ORDER BY s.titlu
    `;

    const [sarciniRows] = await bigquery.query({
      query: sarciniQuery,
      params: { subproiectId: id, userId }
    });

    const sarcini = sarciniRows.map((row: any) => ({
      id: row.id,
      tip: row.tip,
      nume: row.nume,
      sarcini_count: row.sarcini_count || 0,
      in_planificator: row.in_planificator,
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