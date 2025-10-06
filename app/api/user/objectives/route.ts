// ==================================================================
// CALEA: app/api/user/objectives/route.ts
// DATA: 25.09.2025 17:45 (ora României)
// DESCRIERE: API pentru obiective ierarhice time tracking - utilizatori normali
// FUNCȚIONALITATE: returnează structură ierarhică Proiecte → Subproiecte → Sarcini
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

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

const PROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const PROIECTE_RESPONSABILI_TABLE = `\`${PROJECT_ID}.${DATASET}.ProiecteResponsabili${tableSuffix}\``;
const SARCINI_RESPONSABILI_TABLE = `\`${PROJECT_ID}.${DATASET}.SarciniResponsabili${tableSuffix}\``;

console.log(`🔧 [User Objectives] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'user_id este obligatoriu' }, { status: 400 });
    }

    // Query pentru proiecte cu subproiecte și sarcini - structură ierarhică
    const objectivesQuery = `
      WITH UserProjects AS (
        SELECT DISTINCT p.ID_Proiect, p.Denumire, p.Status, p.Data_Start, p.Data_Final
        FROM ${PROIECTE_TABLE} p
        LEFT JOIN ${PROIECTE_RESPONSABILI_TABLE} pr
          ON p.ID_Proiect = pr.proiect_id
        WHERE (p.Status != 'Inchis' OR p.Status IS NULL)
      ),
      ProjectSubprojects AS (
        SELECT
          sp.ID_Subproiect,
          sp.ID_Proiect,
          sp.Denumire,
          sp.Status,
          sp.Data_Start,
          sp.Data_Final
        FROM ${SUBPROIECTE_TABLE} sp
        INNER JOIN UserProjects up ON sp.ID_Proiect = up.ID_Proiect
        WHERE (sp.Status != 'Inchis' OR sp.Status IS NULL)
      ),
      ProjectTasks AS (
        SELECT
          s.id,
          s.proiect_id,
          s.tip_proiect,
          CASE
            WHEN s.tip_proiect = 'proiect' THEN NULL
            WHEN s.tip_proiect = 'subproiect' THEN s.proiect_id
            ELSE NULL
          END as subproiect_id,
          CASE
            WHEN s.tip_proiect = 'proiect' THEN s.proiect_id
            WHEN s.tip_proiect = 'subproiect' THEN
              (SELECT sp.ID_Proiect FROM ${SUBPROIECTE_TABLE} sp WHERE sp.ID_Subproiect = s.proiect_id)
            ELSE s.proiect_id
          END as actual_proiect_id,
          s.titlu,
          s.status,
          s.prioritate,
          s.data_scadenta
        FROM ${SARCINI_TABLE} s
        LEFT JOIN ${SARCINI_RESPONSABILI_TABLE} sr
          ON s.id = sr.sarcina_id
        WHERE (s.status != 'Finalizata' OR s.status IS NULL)
      ),
      FilteredProjectTasks AS (
        SELECT pt.*
        FROM ProjectTasks pt
        INNER JOIN UserProjects up ON pt.actual_proiect_id = up.ID_Proiect
      )

      SELECT
        'proiect' as tip_obiectiv,
        up.ID_Proiect as proiect_id,
        NULL as subproiect_id,
        NULL as sarcina_id,
        up.Denumire as nume,
        up.Status as status,
        up.Data_Start as data_start,
        up.Data_Final as data_final,
        NULL as prioritate,
        NULL as data_scadenta
      FROM UserProjects up

      UNION ALL

      SELECT
        'subproiect' as tip_obiectiv,
        psp.ID_Proiect as proiect_id,
        psp.ID_Subproiect as subproiect_id,
        NULL as sarcina_id,
        psp.Denumire as nume,
        psp.Status as status,
        psp.Data_Start as data_start,
        psp.Data_Final as data_final,
        NULL as prioritate,
        NULL as data_scadenta
      FROM ProjectSubprojects psp

      UNION ALL

      SELECT
        'sarcina' as tip_obiectiv,
        pt.actual_proiect_id as proiect_id,
        pt.subproiect_id,
        pt.id as sarcina_id,
        pt.titlu as nume,
        pt.status,
        NULL as data_start,
        NULL as data_final,
        pt.prioritate,
        pt.data_scadenta
      FROM FilteredProjectTasks pt

      ORDER BY tip_obiectiv, proiect_id, subproiect_id, nume
    `;

    const [rows] = await bigquery.query({
      query: objectivesQuery,
      params: { user_id }
    });

    console.log(`[Objectives API] User: ${user_id} - BigQuery returned: ${rows.length} rows`);

    // Debug: Verifică ce tipuri de obiective returnează
    const tipuriObiective = rows.map(r => r.tip_obiectiv);
    const sarcinCount = tipuriObiective.filter(tip => tip === 'sarcina').length;
    console.log(`[Objectives API] Breakdown: ${tipuriObiective.filter(tip => tip === 'proiect').length} proiecte, ${tipuriObiective.filter(tip => tip === 'subproiect').length} subproiecte, ${sarcinCount} sarcini`);

    // Organizează rezultatele în structură ierarhică
    const objectives = {
      proiecte: [] as any[]
    };

    const proiecteMap = new Map();

    rows.forEach((row: any) => {
      if (row.tip_obiectiv === 'proiect') {
        const proiect = {
          id: row.proiect_id,
          nume: row.nume,
          status: row.status,
          data_start: row.data_start,
          data_final: row.data_final,
          subproiecte: [],
          sarcini: []
        };
        objectives.proiecte.push(proiect);
        proiecteMap.set(row.proiect_id, proiect);
      }
    });

    rows.forEach((row: any) => {
      const proiect = proiecteMap.get(row.proiect_id);
      if (!proiect) return;

      if (row.tip_obiectiv === 'subproiect') {
        proiect.subproiecte.push({
          id: row.subproiect_id,
          nume: row.nume,
          status: row.status,
          data_start: row.data_start,
          data_final: row.data_final,
          sarcini: []
        });
      } else if (row.tip_obiectiv === 'sarcina') {
        const target = row.subproiect_id ?
          proiect.subproiecte.find((sp: any) => sp.id === row.subproiect_id) :
          proiect;

        if (target) {
          target.sarcini.push({
            id: row.sarcina_id,
            nume: row.nume,
            status: row.status,
            prioritate: row.prioritate,
            data_scadenta: row.data_scadenta
          });
        }
      }
    });

    console.log(`[Objectives API] Final structure: ${objectives.proiecte.length} proiecte, ${objectives.proiecte.reduce((acc, p) => acc + p.subproiecte.length, 0)} subproiecte total`);

    return NextResponse.json({
      success: true,
      objectives
    });

  } catch (error) {
    console.error('Eroare la încărcarea obiectivelor:', error);
    return NextResponse.json(
      { error: 'Eroare la încărcarea obiectivelor' },
      { status: 500 }
    );
  }
}