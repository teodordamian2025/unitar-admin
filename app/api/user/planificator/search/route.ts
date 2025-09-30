// ==================================================================
// CALEA: app/api/user/planificator/search/route.ts
// DATA: 01.10.2025 00:00 (ora României) - RESTAURAT din versiunea funcțională
// DESCRIERE: API pentru căutare proiecte în planificator (doar proiecte, nu subproiecte/sarcini)
// FUNCȚIONALITATE: GET cu query pentru adăugarea în planificator
// IMPORTANTE: Folosește tabel Subproiecte (nu SubProiecte) și exclude proiecte deja în planificator
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

    const searchPattern = `%${searchTerm.toLowerCase()}%`;

    // Query pentru căutarea doar a proiectelor (primul nivel al ierarhiei)
    const searchQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\`
        WHERE utilizator_uid = @userId AND activ = TRUE
      )

      SELECT
        'proiect' as tip,
        ID_Proiect as id,
        CONCAT(ID_Proiect, ' - ', Denumire) as nume,
        CAST(NULL AS STRING) as proiect_nume,
        1 as priority_order,
        -- Contorizare subproiecte și sarcini pentru feedback
        (
          SELECT COUNT(*)
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\`
          WHERE ID_Proiect = p.ID_Proiect AND activ = TRUE AND Status != 'Anulat'
        ) as subproiecte_count,
        (
          SELECT COUNT(*)
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\`
          WHERE proiect_id = p.ID_Proiect AND status NOT IN ('Finalizată', 'Anulată')
        ) as sarcini_count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
      WHERE (LOWER(Denumire) LIKE @searchPattern OR LOWER(ID_Proiect) LIKE @searchPattern)
        AND Status != 'Anulat'
        AND ID_Proiect NOT IN (
          SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'proiect'
        )
      ORDER BY Denumire ASC
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
      proiect_nume: row.proiect_nume,
      subproiecte_count: row.subproiecte_count || 0,
      sarcini_count: row.sarcini_count || 0
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