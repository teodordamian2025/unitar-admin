// ==================================================================
// CALEA: app/api/planificator/hierarchy/[proiect_id]/route.ts
// DATA: 28.09.2025 14:45 (ora României)
// DESCRIERE: API pentru încărcarea subproiectelor unui proiect specific
// FUNCȚIONALITATE: GET subproiecte pentru ierarhia planificatorului
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

const PLANIFICATOR_TABLE = `\`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\``;
const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

console.log(`🔧 [Planificator Hierarchy] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(
  request: NextRequest,
  { params }: { params: { proiect_id: string } }
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

    const { proiect_id } = params;

    if (!proiect_id) {
      return NextResponse.json({ error: 'Missing proiect_id parameter' }, { status: 400 });
    }

    // Query pentru subproiectele unui proiect specific
    const subproiecteQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM ${PLANIFICATOR_TABLE}
        WHERE utilizator_uid = @userId AND activ = TRUE
      )

      SELECT
        sp.ID_Subproiect as id,
        sp.Denumire as nume,
        sp.Data_Start,
        sp.Data_Final,
        sp.Status,
        sp.Responsabil,
        -- Contorizare sarcini pentru acest subproiect
        -- IMPORTANT: Sarcini de subproiect au proiect_id = ID_Subproiect, nu subproiect_id
        (
          SELECT COUNT(*)
          FROM ${SARCINI_TABLE}
          WHERE proiect_id = sp.ID_Subproiect AND status NOT IN ('Finalizată', 'Anulată')
        ) as sarcini_count,
        -- Verificare dacă este deja în planificator
        CASE
          WHEN sp.ID_Subproiect IN (SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'subproiect')
          THEN TRUE
          ELSE FALSE
        END as in_planificator
      FROM ${SUBPROIECTE_TABLE} sp
      WHERE sp.ID_Proiect = @proiect_id
        AND sp.activ = TRUE
        AND sp.Status != 'Anulat'
      ORDER BY sp.Denumire ASC
    `;

    // Query pentru sarcinile directe ale proiectului (fără subproiect)
    const sarciniDirecteQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM ${PLANIFICATOR_TABLE}
        WHERE utilizator_uid = @userId AND activ = TRUE
      )

      SELECT
        s.id,
        s.titlu as nume,
        s.descriere,
        s.prioritate,
        s.status,
        s.data_scadenta,
        s.progres_procent,
        -- Verificare dacă este deja în planificator
        CASE
          WHEN s.id IN (SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'sarcina')
          THEN TRUE
          ELSE FALSE
        END as in_planificator
      FROM ${SARCINI_TABLE} s
      WHERE s.proiect_id = @proiect_id
        AND (s.subproiect_id IS NULL OR s.subproiect_id = '')
        AND s.status NOT IN ('Finalizată', 'Anulată')
      ORDER BY
        CASE s.prioritate
          WHEN 'Critică' THEN 1
          WHEN 'Ridicată' THEN 2
          WHEN 'Medie' THEN 3
          ELSE 4
        END ASC,
        s.titlu ASC
    `;

    // Execută ambele query-uri în paralel
    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      params: { userId, proiect_id }
    });

    const [sarciniRows] = await bigquery.query({
      query: sarciniDirecteQuery,
      params: { userId, proiect_id }
    });

    // Procesează subproiectele
    const subproiecte = subproiecteRows.map((row: any) => ({
      id: row.id,
      tip: 'subproiect',
      nume: `${row.id} - ${row.nume}`,
      data_start: row.Data_Start?.value || row.Data_Start,
      data_final: row.Data_Final?.value || row.Data_Final,
      status: row.Status,
      responsabil: row.Responsabil,
      sarcini_count: row.sarcini_count || 0,
      in_planificator: row.in_planificator
    }));

    // Procesează sarcinile directe
    const sarcini = sarciniRows.map((row: any) => ({
      id: row.id,
      tip: 'sarcina',
      nume: row.nume,
      descriere: row.descriere,
      prioritate: row.prioritate,
      status: row.status,
      data_scadenta: row.data_scadenta?.value || row.data_scadenta,
      progres_procent: row.progres_procent || 0,
      in_planificator: row.in_planificator
    }));

    return NextResponse.json({
      subproiecte,
      sarcini_directe: sarcini
    });

  } catch (error) {
    console.error('Error loading project hierarchy:', error);
    return NextResponse.json(
      { error: 'Failed to load project hierarchy' },
      { status: 500 }
    );
  }
}