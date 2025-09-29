// ==================================================================
// CALEA: app/api/user/planificator/search/route.ts
// DATA: 30.09.2025 00:35 (ora României)
// DESCRIERE: API search pentru utilizatori normali cu restricții
// FUNCȚIONALITATE: Căutare proiecte/subproiecte/sarcini pentru utilizatori normali
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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('q');

    if (!searchTerm || searchTerm.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchQuery = `
      WITH ProiecteSearch AS (
        SELECT DISTINCT
          p.id,
          'proiect' as tip,
          p.Nume as nume,
          NULL as proiect_nume,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` sub
           WHERE sub.ProiectParinte_ID = p.id AND sub.utilizator_uid = @userId) as subproiecte_count,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
           WHERE s.Proiect_ID = p.id AND s.utilizator_uid = @userId) as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = p.id AND pp.tip_item = 'proiect' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          NULL as urgenta,
          NULL as data_scadenta,
          NULL as progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
        WHERE p.utilizator_uid = @userId
          AND UPPER(p.Nume) LIKE UPPER(@searchPattern)
          AND (p.ProiectParinte_ID IS NULL OR p.ProiectParinte_ID = '')
      ),
      SubproiecteSearch AS (
        SELECT DISTINCT
          sp.id,
          'subproiect' as tip,
          sp.Nume as nume,
          p.Nume as proiect_nume,
          0 as subproiecte_count,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
           WHERE s.Proiect_ID = sp.id AND s.utilizator_uid = @userId) as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = sp.id AND pp.tip_item = 'subproiect' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          NULL as urgenta,
          NULL as data_scadenta,
          NULL as progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` sp
        JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p ON sp.ProiectParinte_ID = p.id
        WHERE sp.utilizator_uid = @userId
          AND sp.ProiectParinte_ID IS NOT NULL
          AND sp.ProiectParinte_ID != ''
          AND UPPER(sp.Nume) LIKE UPPER(@searchPattern)
      ),
      SarciniSearch AS (
        SELECT DISTINCT
          s.id,
          'sarcina' as tip,
          s.Nume as nume,
          p.Nume as proiect_nume,
          0 as subproiecte_count,
          0 as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = s.id AND pp.tip_item = 'sarcina' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          s.Urgenta as urgenta,
          s.Data_Scadenta as data_scadenta,
          s.Progres_Procent as progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p ON s.Proiect_ID = p.id
        WHERE s.utilizator_uid = @userId
          AND UPPER(s.Nume) LIKE UPPER(@searchPattern)
      )
      SELECT * FROM ProiecteSearch
      UNION ALL
      SELECT * FROM SubproiecteSearch
      UNION ALL
      SELECT * FROM SarciniSearch
      ORDER BY
        CASE tip
          WHEN 'proiect' THEN 1
          WHEN 'subproiect' THEN 2
          WHEN 'sarcina' THEN 3
        END,
        nume
      LIMIT 50
    `;

    const [rows] = await bigquery.query({
      query: searchQuery,
      params: {
        userId,
        searchPattern: `%${searchTerm}%`
      }
    });

    const results = rows.map((row: any) => ({
      id: row.id,
      tip: row.tip,
      nume: row.nume,
      proiect_nume: row.proiect_nume,
      subproiecte_count: parseInt(row.subproiecte_count) || 0,
      sarcini_count: parseInt(row.sarcini_count) || 0,
      in_planificator: row.in_planificator,
      can_open_details: row.can_open_details,
      urgenta: row.urgenta,
      data_scadenta: row.data_scadenta?.value || row.data_scadenta,
      progres_procent: row.progres_procent
    }));

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error searching items for normal user:', error);
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    );
  }
}