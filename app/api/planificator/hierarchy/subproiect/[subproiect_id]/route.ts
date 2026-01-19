// ==================================================================
// CALEA: app/api/planificator/hierarchy/subproiect/[subproiect_id]/route.ts
// DATA: 28.09.2025 14:50 (ora României)
// DESCRIERE: API pentru încărcarea sarcinilor unui subproiect specific
// FUNCȚIONALITATE: GET sarcini pentru ierarhia planificatorului
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
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const PROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;

console.log(`🔧 [Planificator Subproiect] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(
  request: NextRequest,
  { params }: { params: { subproiect_id: string } }
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

    const { subproiect_id } = params;

    if (!subproiect_id) {
      return NextResponse.json({ error: 'Missing subproiect_id parameter' }, { status: 400 });
    }

    // Query pentru sarcinile unui subproiect specific
    // NOTA: Pentru sarcini de subproiect, s.proiect_id = ID_Subproiect
    // Trebuie să obținem parent proiect_id din tabelul Subproiecte
    const sarciniQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM ${PLANIFICATOR_TABLE}
        WHERE utilizator_uid = @userId AND activ = TRUE
      ),
      SubproiectInfo AS (
        SELECT ID_Subproiect, ID_Proiect, Denumire
        FROM ${SUBPROIECTE_TABLE}
        WHERE ID_Subproiect = @subproiect_id
      )

      SELECT
        s.id,
        s.titlu as nume,
        s.descriere,
        s.prioritate,
        s.status,
        s.data_scadenta,
        s.progres_procent,
        s.timp_estimat_ore,
        s.created_by,
        -- Parent project info (via Subproiecte table)
        sp_info.ID_Proiect as parent_proiect_id,
        p.Denumire as proiect_nume,
        sp_info.Denumire as subproiect_nume,
        -- Verificare dacă este deja în planificator
        CASE
          WHEN s.id IN (SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'sarcina')
          THEN TRUE
          ELSE FALSE
        END as in_planificator,
        -- Calculare urgență pe baza deadline-ului
        CASE
          WHEN s.data_scadenta IS NOT NULL THEN
            DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY)
          ELSE 999
        END as zile_pana_scadenta
      FROM ${SARCINI_TABLE} s
      CROSS JOIN SubproiectInfo sp_info
      LEFT JOIN ${PROIECTE_TABLE} p
        ON sp_info.ID_Proiect = p.ID_Proiect
      WHERE s.proiect_id = @subproiect_id
        AND s.status NOT IN ('Finalizată', 'Anulată')
      ORDER BY
        -- Prioritate + urgență pentru sortare inteligentă
        CASE s.prioritate
          WHEN 'Critică' THEN 1
          WHEN 'Ridicată' THEN 2
          WHEN 'Medie' THEN 3
          ELSE 4
        END ASC,
        CASE
          WHEN s.data_scadenta IS NOT NULL THEN
            DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY)
          ELSE 999
        END ASC,
        s.titlu ASC
    `;

    const [rows] = await bigquery.query({
      query: sarciniQuery,
      params: { userId, subproiect_id }
    });

    // Procesează sarcinile cu informații complete
    const sarcini = rows.map((row: any) => {
      const zile = row.zile_pana_scadenta || 999;
      let urgenta = 'scazuta';
      if (zile <= 0) urgenta = 'critica';
      else if (zile <= 3) urgenta = 'ridicata';
      else if (zile <= 7) urgenta = 'medie';

      return {
        id: row.id,
        tip: 'sarcina',
        nume: row.nume,
        descriere: row.descriere,
        prioritate: row.prioritate,
        status: row.status,
        data_scadenta: row.data_scadenta?.value || row.data_scadenta,
        progres_procent: row.progres_procent || 0,
        timp_estimat_ore: row.timp_estimat_ore || 0,
        created_by: row.created_by,
        // Parent project ID și denumire
        parent_proiect_id: row.parent_proiect_id,
        proiect_nume: row.proiect_nume,
        subproiect_nume: row.subproiect_nume,
        in_planificator: row.in_planificator,
        zile_pana_scadenta: zile,
        urgenta,
        // Flag pentru butonul de deschidere
        can_open_details: true
      };
    });

    return NextResponse.json({ sarcini });

  } catch (error) {
    console.error('Error loading subproject tasks:', error);
    return NextResponse.json(
      { error: 'Failed to load subproject tasks' },
      { status: 500 }
    );
  }
}