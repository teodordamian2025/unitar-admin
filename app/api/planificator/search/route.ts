// ==================================================================
// CALEA: app/api/planificator/search/route.ts
// DATA: 27.09.2025 16:37 (ora României)
// DESCRIERE: API pentru căutare proiecte/subproiecte/sarcini
// FUNCȚIONALITATE: GET cu query pentru adăugarea în planificator
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
// Simple authentication pattern consistent with existing APIs
import { BigQuery } from '@google-cloud/bigquery';

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

    const token = authHeader.split('Bearer ')[1];
    // For development - in production this should verify Firebase token
    const userId = 'demo_user_id';

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('q');

    if (!searchTerm || searchTerm.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchPattern = `%${searchTerm.toLowerCase()}%`;

    // Query unificată pentru toate tipurile de items
    const searchQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\`
        WHERE utilizator_uid = @userId AND activ = TRUE
      ),

      ProiecteSearch AS (
        SELECT
          'proiect' as tip,
          ID_Proiect as id,
          Denumire as nume,
          CAST(NULL AS STRING) as proiect_nume,
          1 as priority_order
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\`
        WHERE (LOWER(Denumire) LIKE @searchPattern OR LOWER(ID_Proiect) LIKE @searchPattern)
          AND Status != 'Anulat'
          AND ID_Proiect NOT IN (
            SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'proiect'
          )
      ),

      SubproiecteSearch AS (
        SELECT
          'subproiect' as tip,
          sp.ID_Subproiect as id,
          sp.Denumire as nume,
          p.Denumire as proiect_nume,
          2 as priority_order
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` sp
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
          ON sp.ID_Proiect = p.ID_Proiect
        WHERE LOWER(sp.Denumire) LIKE @searchPattern
          AND sp.Status != 'Anulat'
          AND sp.activ = TRUE
          AND sp.ID_Subproiect NOT IN (
            SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'subproiect'
          )
      ),

      SarciniSearch AS (
        SELECT
          'sarcina' as tip,
          s.id as id,
          s.titlu as nume,
          p.Denumire as proiect_nume,
          CASE
            WHEN s.prioritate = 'Critică' THEN 1
            WHEN s.prioritate = 'Ridicată' THEN 2
            WHEN s.prioritate = 'Medie' THEN 3
            ELSE 4
          END as priority_order
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
          ON s.proiect_id = p.ID_Proiect
        WHERE (LOWER(s.titlu) LIKE @searchPattern OR LOWER(s.descriere) LIKE @searchPattern)
          AND s.status NOT IN ('Finalizată', 'Anulată')
          AND s.id NOT IN (
            SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'sarcina'
          )
      )

      SELECT tip, id, nume, proiect_nume, priority_order
      FROM (
        SELECT * FROM ProiecteSearch
        UNION ALL
        SELECT * FROM SubproiecteSearch
        UNION ALL
        SELECT * FROM SarciniSearch
      )
      ORDER BY priority_order ASC, nume ASC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({
      query: searchQuery,
      params: { userId, searchPattern }
    });

    const results = rows.map((row: any) => ({
      id: row.id,
      tip: row.tip,
      nume: row.nume,
      proiect_nume: row.proiect_nume
    }));

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error searching items:', error);
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    );
  }
}