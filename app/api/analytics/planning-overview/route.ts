// ==================================================================
// CALEA: app/api/analytics/planning-overview/route.ts
// DATA: 18.01.2026
// DESCRIERE: API pentru vizualizare planning toți utilizatorii
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_PLANIFICARI = `\`${PROJECT_ID}.${DATASET}.PlanificariZilnice${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;

console.log(`🔧 Planning Overview API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Obține planificările pentru toți utilizatorii într-o perioadă
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data_start = searchParams.get('data_start');
    const data_end = searchParams.get('data_end');
    const proiect_id = searchParams.get('proiect_id');
    const echipa = searchParams.get('echipa'); // viitor - filtrare pe echipă

    // Validare date obligatorii
    if (!data_start || !data_end) {
      return NextResponse.json({
        success: false,
        error: 'data_start și data_end sunt obligatorii'
      }, { status: 400 });
    }

    // 1. Obține toți utilizatorii activi
    // NOTA: Utilizatori_v2 nu are coloana 'echipa', folosim 'departament' în schimb
    // Concatenăm prenume + nume pentru afișare completă
    const utilizatoriQuery = `
      SELECT
        uid,
        CONCAT(COALESCE(prenume, ''), ' ', COALESCE(nume, '')) as nume,
        email,
        rol,
        departament as echipa
      FROM ${TABLE_UTILIZATORI}
      WHERE activ = TRUE
      ORDER BY prenume ASC, nume ASC
    `;

    const [utilizatoriRows] = await bigquery.query({
      query: utilizatoriQuery,
      location: 'EU'
    });

    // 2. Obține planificările pentru perioada specificată
    // NOTA: Proiecte_v2 folosește ID_Proiect (nu id) și nu are coloana culoare
    // Folosim DATE() function pentru conversie corectă STRING -> DATE în BigQuery
    // JOIN cu Sarcini și Subproiecte pentru a obține proiect_id părinte pentru sarcini
    // ACTUALIZAT 22.01.2026: Adăugat progres_procent și progres_economic pentru proiecte și subproiecte
    let planificariQuery = `
      WITH cost_settings AS (
        SELECT COALESCE(cost_ora, 50) as cost_ora
        FROM \`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\`
        WHERE activ = TRUE
        LIMIT 1
      ),
      -- Time tracking per proiect
      time_tracking_proiecte AS (
        SELECT
          proiect_id,
          SUM(COALESCE(CAST(ore_lucrate AS FLOAT64), 0)) as total_worked_hours
        FROM \`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\`
        WHERE proiect_id IS NOT NULL
        GROUP BY proiect_id
      ),
      -- Time tracking per subproiect
      time_tracking_subproiecte AS (
        SELECT
          subproiect_id,
          SUM(COALESCE(CAST(ore_lucrate AS FLOAT64), 0)) as total_worked_hours
        FROM \`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\`
        WHERE subproiect_id IS NOT NULL
        GROUP BY subproiect_id
      ),
      -- Cheltuieli per proiect
      cheltuieli_proiecte AS (
        SELECT
          proiect_id,
          SUM(COALESCE(CAST(valoare_ron AS FLOAT64), 0)) as total_cheltuieli_ron
        FROM \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\`
        WHERE activ = TRUE AND proiect_id IS NOT NULL
        GROUP BY proiect_id
      ),
      -- Cheltuieli per subproiect
      cheltuieli_subproiecte AS (
        SELECT
          subproiect_id,
          SUM(COALESCE(CAST(valoare_ron AS FLOAT64), 0)) as total_cheltuieli_ron
        FROM \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\`
        WHERE activ = TRUE AND subproiect_id IS NOT NULL
        GROUP BY subproiect_id
      )
      SELECT
        pz.id,
        pz.data_planificare,
        pz.utilizator_uid,
        pz.utilizator_nume,
        pz.proiect_id,
        pz.subproiect_id,
        pz.sarcina_id,
        pz.proiect_denumire,
        pz.subproiect_denumire,
        pz.sarcina_titlu,
        pz.ore_planificate,
        pz.prioritate,
        pz.observatii,
        '#3b82f6' as proiect_culoare,
        -- Pentru sarcini, obținem proiect_id părinte via JOIN
        -- Dacă sarcina este directă pe proiect, s.proiect_id este proiect_id
        -- Dacă sarcina este pe subproiect, sp2.ID_Proiect este proiect_id
        CASE
          WHEN pz.sarcina_id IS NOT NULL AND pz.sarcina_id != '' THEN
            COALESCE(sp2.ID_Proiect, s.proiect_id)
          ELSE NULL
        END as sarcina_proiect_id,
        -- Progres general pentru proiect (direct din tabela Proiecte)
        COALESCE(p.progres_procent, 0) as proiect_progres_procent,
        -- Progres economic pentru proiect (calculat din time tracking și cheltuieli)
        CASE
          WHEN p.ID_Proiect IS NOT NULL THEN
            ROUND(
              SAFE_DIVIDE(
                COALESCE(ttp.total_worked_hours, 0) * 100,
                NULLIF(
                  SAFE_DIVIDE(
                    COALESCE(CAST(p.Valoare_Estimata AS FLOAT64), 0) - (
                      CASE
                        WHEN p.moneda = 'RON' THEN COALESCE(chp.total_cheltuieli_ron, 0)
                        ELSE COALESCE(chp.total_cheltuieli_ron, 0) / NULLIF(CAST(p.curs_valutar AS FLOAT64), 0)
                      END
                    ),
                    csett.cost_ora
                  ),
                  0
                )
              ),
              1
            )
          ELSE 0
        END as proiect_progres_economic,
        -- Progres general pentru subproiect (direct din tabela Subproiecte)
        COALESCE(sp.progres_procent, 0) as subproiect_progres_procent,
        -- Progres economic pentru subproiect (calculat din time tracking și cheltuieli)
        CASE
          WHEN sp.ID_Subproiect IS NOT NULL THEN
            ROUND(
              SAFE_DIVIDE(
                COALESCE(tts.total_worked_hours, 0) * 100,
                NULLIF(
                  SAFE_DIVIDE(
                    COALESCE(CAST(sp.Valoare_Estimata AS FLOAT64), 0) - (
                      CASE
                        WHEN sp.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
                        ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(CAST(sp.curs_valutar AS FLOAT64), 0)
                      END
                    ),
                    csett.cost_ora
                  ),
                  0
                )
              ),
              1
            )
          ELSE 0
        END as subproiect_progres_economic,
        -- ID-ul proiectului părinte pentru subproiecte și sarcini
        CASE
          WHEN pz.subproiect_id IS NOT NULL AND pz.subproiect_id != '' THEN sp.ID_Proiect
          WHEN pz.sarcina_id IS NOT NULL AND pz.sarcina_id != '' THEN COALESCE(sp2.ID_Proiect, s.proiect_id)
          ELSE NULL
        END as parent_proiect_id
      FROM ${TABLE_PLANIFICARI} pz
      LEFT JOIN ${TABLE_SARCINI} s ON pz.sarcina_id = s.id
      LEFT JOIN ${TABLE_SUBPROIECTE} sp2 ON s.proiect_id = sp2.ID_Subproiect
      LEFT JOIN ${TABLE_PROIECTE} p ON pz.proiect_id = p.ID_Proiect
      LEFT JOIN ${TABLE_SUBPROIECTE} sp ON pz.subproiect_id = sp.ID_Subproiect
      LEFT JOIN time_tracking_proiecte ttp ON p.ID_Proiect = ttp.proiect_id
      LEFT JOIN cheltuieli_proiecte chp ON p.ID_Proiect = chp.proiect_id
      LEFT JOIN time_tracking_subproiecte tts ON sp.ID_Subproiect = tts.subproiect_id
      LEFT JOIN cheltuieli_subproiecte chs ON sp.ID_Subproiect = chs.subproiect_id
      CROSS JOIN cost_settings csett
      WHERE pz.activ = TRUE
        AND pz.data_planificare >= DATE(@data_start)
        AND pz.data_planificare <= DATE(@data_end)
    `;

    const params: any = { data_start, data_end };
    const types: any = { data_start: 'STRING', data_end: 'STRING' };

    if (proiect_id) {
      planificariQuery += ` AND (pz.proiect_id = @proiect_id OR pz.subproiect_id = @proiect_id OR pz.sarcina_id = @proiect_id)`;
      params.proiect_id = proiect_id;
      types.proiect_id = 'STRING';
    }

    planificariQuery += ` ORDER BY pz.data_planificare ASC, pz.utilizator_nume ASC`;

    const [planificariRows] = await bigquery.query({
      query: planificariQuery,
      params,
      types,
      location: 'EU'
    });

    // 3. Procesează datele pentru format calendar
    const utilizatori = utilizatoriRows.map((u: any) => ({
      uid: u.uid,
      nume: u.nume,
      email: u.email,
      rol: u.rol,
      echipa: u.echipa
    }));

    // Creează map pentru planificări per utilizator per zi
    const planificariMap: Record<string, Record<string, any[]>> = {};
    const orePerZiPerUtilizator: Record<string, Record<string, number>> = {};

    for (const row of planificariRows as any[]) {
      const dataStr = row.data_planificare?.value || row.data_planificare;
      const uid = row.utilizator_uid;

      if (!planificariMap[uid]) {
        planificariMap[uid] = {};
        orePerZiPerUtilizator[uid] = {};
      }

      if (!planificariMap[uid][dataStr]) {
        planificariMap[uid][dataStr] = [];
        orePerZiPerUtilizator[uid][dataStr] = 0;
      }

      // Determină progres-ul corect în funcție de tipul de alocare
      let progres_procent = 0;
      let progres_economic = 0;
      let parent_proiect_id: string | null = null;

      if (row.proiect_id && !row.subproiect_id && !row.sarcina_id) {
        // Alocare directă pe proiect
        progres_procent = parseFloat(row.proiect_progres_procent) || 0;
        progres_economic = parseFloat(row.proiect_progres_economic) || 0;
        parent_proiect_id = row.proiect_id;
      } else if (row.subproiect_id) {
        // Alocare pe subproiect
        progres_procent = parseFloat(row.subproiect_progres_procent) || 0;
        progres_economic = parseFloat(row.subproiect_progres_economic) || 0;
        parent_proiect_id = row.parent_proiect_id || null;
      } else if (row.sarcina_id) {
        // Alocare pe sarcină - folosim progres-ul proiectului/subproiectului părinte
        // sau progresul sarcinii dacă există
        progres_procent = parseFloat(row.proiect_progres_procent) || parseFloat(row.subproiect_progres_procent) || 0;
        progres_economic = parseFloat(row.proiect_progres_economic) || parseFloat(row.subproiect_progres_economic) || 0;
        parent_proiect_id = row.sarcina_proiect_id || row.parent_proiect_id || null;
      }

      planificariMap[uid][dataStr].push({
        id: row.id,
        proiect_id: row.proiect_id,
        subproiect_id: row.subproiect_id,
        sarcina_id: row.sarcina_id,
        proiect_denumire: row.proiect_denumire,
        subproiect_denumire: row.subproiect_denumire,
        sarcina_titlu: row.sarcina_titlu,
        sarcina_proiect_id: row.sarcina_proiect_id || null, // ID proiect părinte pentru sarcini
        ore_planificate: parseFloat(row.ore_planificate) || 0,
        prioritate: row.prioritate,
        observatii: row.observatii,
        proiect_culoare: row.proiect_culoare,
        // Progres - ADĂUGAT 22.01.2026
        progres_procent,
        progres_economic,
        parent_proiect_id
      });

      orePerZiPerUtilizator[uid][dataStr] += parseFloat(row.ore_planificate) || 0;
    }

    // 4. Generează lista de zile în perioadă
    const zile: string[] = [];
    const startDate = new Date(data_start);
    const endDate = new Date(data_end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      zile.push(d.toISOString().split('T')[0]);
    }

    // 5. Calculează statistici
    const statistici = {
      total_utilizatori: utilizatori.length,
      total_planificari: (planificariRows as any[]).length,
      zile_in_perioada: zile.length,
      ore_totale_planificate: (planificariRows as any[]).reduce(
        (sum: number, r: any) => sum + (parseFloat(r.ore_planificate) || 0),
        0
      )
    };

    // 6. Calculează status alocare per utilizator per zi
    const ORA_STANDARD = 8; // ore de lucru standard pe zi
    const alocareStatus: Record<string, Record<string, string>> = {};

    for (const uid of Object.keys(orePerZiPerUtilizator)) {
      alocareStatus[uid] = {};
      for (const data of Object.keys(orePerZiPerUtilizator[uid])) {
        const ore = orePerZiPerUtilizator[uid][data];
        if (ore > ORA_STANDARD) {
          alocareStatus[uid][data] = 'supraalocat'; // > 8h
        } else if (ore === ORA_STANDARD) {
          alocareStatus[uid][data] = 'complet'; // exact 8h
        } else if (ore > 0) {
          alocareStatus[uid][data] = 'partial'; // < 8h
        } else {
          alocareStatus[uid][data] = 'liber'; // 0h
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        utilizatori,
        planificariMap,
        orePerZiPerUtilizator,
        alocareStatus,
        zile,
        statistici
      }
    });

  } catch (error) {
    console.error('Eroare obținere planning overview:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea datelor de planning',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
