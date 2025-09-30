// ==================================================================
// CALEA: app/api/user/planificator/search/route.ts
// DATA: 30.09.2025 23:45 (ora României) - FIX schema BigQuery reală
// DESCRIERE: API search pentru utilizatori cu schema corectă BigQuery
// FUNCȚIONALITATE: Căutare în ID_Proiect, Denumire, Adresa din tabelele reale
// FIX: Eliminat utilizator_uid (proiecte sunt company-wide, nu per-user)
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
          p.ID_Proiect as id,
          'proiect' as tip,
          p.Denumire as nume,
          NULL as proiect_nume,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SubProiecte\` sub
           WHERE sub.ID_Proiect = p.ID_Proiect) as subproiecte_count,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
           WHERE s.proiect_id = p.ID_Proiect) as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = p.ID_Proiect AND pp.tip_item = 'proiect' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          NULL as urgenta,
          NULL as data_scadenta,
          NULL as progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
        WHERE (
          UPPER(p.ID_Proiect) LIKE UPPER(@searchPattern)
          OR UPPER(p.Denumire) LIKE UPPER(@searchPattern)
          OR UPPER(p.Adresa) LIKE UPPER(@searchPattern)
        )
      ),
      SubproiecteSearch AS (
        SELECT DISTINCT
          sp.ID_Subproiect as id,
          'subproiect' as tip,
          sp.Denumire as nume,
          p.Denumire as proiect_nume,
          0 as subproiecte_count,
          (SELECT COUNT(*) FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
           WHERE s.subproiect_id = sp.ID_Subproiect) as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = sp.ID_Subproiect AND pp.tip_item = 'subproiect' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          NULL as urgenta,
          NULL as data_scadenta,
          NULL as progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SubProiecte\` sp
        JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p ON sp.ID_Proiect = p.ID_Proiect
        WHERE UPPER(sp.Denumire) LIKE UPPER(@searchPattern)
      ),
      SarciniSearch AS (
        SELECT DISTINCT
          s.id,
          'sarcina' as tip,
          s.titlu as nume,
          COALESCE(sp.Denumire, p.Denumire) as proiect_nume,
          0 as subproiecte_count,
          0 as sarcini_count,
          EXISTS(SELECT 1 FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` pp
                 WHERE pp.item_id = s.id AND pp.tip_item = 'sarcina' AND pp.utilizator_uid = @userId) as in_planificator,
          TRUE as can_open_details,
          s.urgenta,
          s.data_scadenta,
          s.progres_procent
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SubProiecte\` sp ON s.subproiect_id = sp.ID_Subproiect
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p ON s.proiect_id = p.ID_Proiect
        WHERE UPPER(s.titlu) LIKE UPPER(@searchPattern)
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