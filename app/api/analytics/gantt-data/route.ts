// ==================================================================
// CALEA: app/api/analytics/gantt-data/route.ts
// CREAT: 14.09.2025 16:00 (ora României)
// DESCRIERE: API pentru extragerea datelor Gantt Chart cu hierarhie și dependencies
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.ProiecteResponsabili${tableSuffix}\``;
const TABLE_SUBPROIECTE_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.SubproiecteResponsabili${tableSuffix}\``;
const TABLE_SARCINI_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.SarciniResponsabili${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_PROIECT_COMENTARII = `\`${PROJECT_ID}.${DATASET}.ProiectComentarii${tableSuffix}\``;
// ✅ 18.01.2026: Tabele pentru calcul timp economic
const TABLE_CHELTUIELI = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;
const TABLE_SETARI_COSTURI = `\`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\``;

console.log(`🔧 Gantt Data API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, Subproiecte${tableSuffix}, Sarcini${tableSuffix}, TimeTracking${tableSuffix}, EtapeContract${tableSuffix}, ProiectComentarii${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewMode = searchParams.get('view_mode') || 'weeks';
    const includeDependencies = searchParams.get('include_dependencies') === 'true';
    const includeResources = searchParams.get('include_resources') === 'true';

    // Validate and filter empty values
    const projectIdsRaw = searchParams.get('project_ids');
    const projectIdsFiltered = projectIdsRaw ? projectIdsRaw.split(',').filter(id => id.trim()) : [];
    const projectIds = projectIdsFiltered.length > 0 ? projectIdsFiltered : undefined;

    const userIdRaw = searchParams.get('user_id');
    const userId = userIdRaw && userIdRaw.trim() ? userIdRaw.trim() : undefined;

    const startDateRaw = searchParams.get('start_date');
    const startDate = startDateRaw && startDateRaw.trim() ? startDateRaw.trim() : undefined;

    const endDateRaw = searchParams.get('end_date');
    const endDate = endDateRaw && endDateRaw.trim() ? endDateRaw.trim() : undefined;

    let allTasks: any[] = [];

    // 1. PROIECTE - nivel principal în hierarchy
    // ✅ FIX 18.01.2026: Separat calculul orelor lucrate într-un CTE dedicat
    // pentru a evita multiplicarea rezultatelor din JOIN cu responsabili
    // ✅ 18.01.2026: Adăugat calcul timp economic (ore alocate din buget)
    const proiecteQuery = `
      -- CTE 1: Ore lucrate per proiect (FĂRĂ join cu responsabili)
      WITH time_tracking_stats AS (
        SELECT
          COALESCE(tt.proiect_id, s.proiect_id) as proiect_id,
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_SARCINI} s ON tt.sarcina_id = s.id
        WHERE tt.proiect_id IS NOT NULL OR s.proiect_id IS NOT NULL
        GROUP BY COALESCE(tt.proiect_id, s.proiect_id)
      ),
      -- CTE 2: Ore estimate per proiect (din sarcini)
      estimated_hours_stats AS (
        SELECT
          proiect_id,
          SUM(COALESCE(timp_estimat_total_ore, 0)) as total_estimated_hours,
          COUNT(DISTINCT id) as sarcini_count
        FROM ${TABLE_SARCINI}
        WHERE proiect_id IS NOT NULL
        GROUP BY proiect_id
      ),
      -- CTE 3: Responsabili per proiect (agregat separat)
      responsabili_stats AS (
        SELECT
          proiect_id,
          STRING_AGG(DISTINCT responsabil_nume, ', ') as all_responsabili
        FROM ${TABLE_PROIECTE_RESPONSABILI}
        GROUP BY proiect_id
      ),
      -- CTE 4: Subproiecte count
      subproiecte_stats AS (
        SELECT
          ID_Proiect,
          COUNT(DISTINCT ID_Subproiect) as subproiecte_count
        FROM ${TABLE_SUBPROIECTE}
        WHERE activ = true
        GROUP BY ID_Proiect
      ),
      -- CTE 5: Comentarii count
      comentarii_stats AS (
        SELECT
          proiect_id,
          COUNT(*) as comentarii_count
        FROM ${TABLE_PROIECT_COMENTARII}
        WHERE tip_proiect = 'proiect'
        GROUP BY proiect_id
      ),
      -- CTE 6: Cheltuieli per proiect (pentru calcul timp economic)
      cheltuieli_stats AS (
        SELECT
          proiect_id,
          SUM(COALESCE(valoare_ron, valoare, 0)) as total_cheltuieli_ron
        FROM ${TABLE_CHELTUIELI}
        WHERE activ = TRUE AND proiect_id IS NOT NULL
        GROUP BY proiect_id
      ),
      -- CTE 7: Setări costuri (o singură înregistrare activă, cu fallback la default)
      cost_settings AS (
        SELECT
          COALESCE(
            (SELECT cost_ora FROM ${TABLE_SETARI_COSTURI} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            40
          ) as cost_ora,
          COALESCE(
            (SELECT cost_zi FROM ${TABLE_SETARI_COSTURI} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            320
          ) as cost_zi,
          COALESCE(
            (SELECT ore_pe_zi FROM ${TABLE_SETARI_COSTURI} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            8
          ) as ore_pe_zi,
          COALESCE(
            (SELECT moneda FROM ${TABLE_SETARI_COSTURI} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            'EUR'
          ) as moneda_cost
      ),
      -- CTE 8: Date proiect de bază
      project_base AS (
        SELECT
          p.ID_Proiect,
          p.Denumire,
          p.Adresa,
          p.Data_Start,
          p.Data_Final,
          p.Status,
          COALESCE(p.Valoare_Estimata, 0) as Valoare_Estimata,
          COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) as valoare_ron,
          COALESCE(p.curs_valutar, 5) as curs_valutar,
          p.moneda,
          p.Responsabil,
          COALESCE(p.progres_procent, 0) as progress_from_column
        FROM ${TABLE_PROIECTE} p
        WHERE p.Data_Start IS NOT NULL
          AND p.Data_Final IS NOT NULL
          AND p.Status != 'Anulat'
          ${projectIds ? 'AND p.ID_Proiect IN UNNEST(@projectIds)' : ''}
          ${startDate ? 'AND CAST(p.Data_Final AS DATE) >= @startDate' : ''}
          ${endDate ? 'AND CAST(p.Data_Start AS DATE) <= @endDate' : ''}
      )
      SELECT
        pb.ID_Proiect as id,
        CONCAT(pb.ID_Proiect, ' - ', pb.Denumire) as name,
        pb.Adresa,
        pb.Data_Start as startDate,
        pb.Data_Final as endDate,
        pb.progress_from_column as progress,
        'proiect' as type,
        NULL as parentId,
        ARRAY<STRING>[] as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(COALESCE(rs.all_responsabili, pb.Responsabil), ',')) as r WHERE r != '') as resources,
        CASE
          WHEN DATE_DIFF(pb.Data_Final, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
          WHEN DATE_DIFF(pb.Data_Final, CURRENT_DATE(), DAY) <= 30 THEN 'ridicata'
          ELSE 'normala'
        END as priority,
        CASE
          WHEN pb.Status = 'Activ' THEN 'in_progress'
          WHEN pb.Status = 'Finalizat' THEN 'finalizata'
          WHEN pb.Status = 'Suspendat' THEN 'anulata'
          ELSE 'to_do'
        END as status,
        COALESCE(ehs.total_estimated_hours, 0) as estimatedHours,
        COALESCE(tts.total_worked_hours, 0) as workedHours,
        false as isCollapsed,
        0 as level,
        COALESCE(sps.subproiecte_count, 0) as subproiecte_count,
        COALESCE(ehs.sarcini_count, 0) as sarcini_count,
        COALESCE(cs.comentarii_count, 0) as comentarii_count,
        -- ✅ 18.01.2026: Câmpuri timp economic
        pb.Valoare_Estimata as valoare_proiect,
        pb.moneda as moneda_proiect,
        pb.curs_valutar,
        COALESCE(chs.total_cheltuieli_ron, 0) as total_cheltuieli_ron,
        -- Cheltuieli în moneda proiectului
        CASE
          WHEN pb.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
          ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pb.curs_valutar, 0)
        END as cheltuieli_in_moneda_proiect,
        -- Marja brută = Valoare - Cheltuieli
        pb.Valoare_Estimata - (
          CASE
            WHEN pb.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
            ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pb.curs_valutar, 0)
          END
        ) as marja_bruta,
        -- Ore alocate economic = Marja brută / Cost oră
        SAFE_DIVIDE(
          pb.Valoare_Estimata - (
            CASE
              WHEN pb.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
              ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pb.curs_valutar, 0)
            END
          ),
          csett.cost_ora
        ) as economicHoursAllocated,
        -- Ore rămase economic = Ore alocate - Ore lucrate
        SAFE_DIVIDE(
          pb.Valoare_Estimata - (
            CASE
              WHEN pb.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
              ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pb.curs_valutar, 0)
            END
          ),
          csett.cost_ora
        ) - COALESCE(tts.total_worked_hours, 0) as economicHoursRemaining,
        -- Progres economic (%)
        SAFE_DIVIDE(
          COALESCE(tts.total_worked_hours, 0) * 100,
          NULLIF(
            SAFE_DIVIDE(
              pb.Valoare_Estimata - (
                CASE
                  WHEN pb.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
                  ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pb.curs_valutar, 0)
                END
              ),
              csett.cost_ora
            ),
            0
          )
        ) as economicProgress,
        -- Setări cost folosite
        csett.cost_ora as cost_ora_setat,
        csett.ore_pe_zi as ore_pe_zi
      FROM project_base pb
      LEFT JOIN time_tracking_stats tts ON pb.ID_Proiect = tts.proiect_id
      LEFT JOIN estimated_hours_stats ehs ON pb.ID_Proiect = ehs.proiect_id
      LEFT JOIN responsabili_stats rs ON pb.ID_Proiect = rs.proiect_id
      LEFT JOIN subproiecte_stats sps ON pb.ID_Proiect = sps.ID_Proiect
      LEFT JOIN comentarii_stats cs ON pb.ID_Proiect = cs.proiect_id
      LEFT JOIN cheltuieli_stats chs ON pb.ID_Proiect = chs.proiect_id
      CROSS JOIN cost_settings csett
      ORDER BY pb.Data_Start ASC
    `;

    // Build params object using simplified format (key-value pairs)
    const proiecteParams: any = {};
    if (projectIds) {
      proiecteParams.projectIds = projectIds;
    }
    if (startDate) {
      proiecteParams.startDate = startDate;
    }
    if (endDate) {
      proiecteParams.endDate = endDate;
    }

    const proiecteQueryOptions: any = {
      query: proiecteQuery,
      location: 'EU',
    };

    // Only add params if there are any (BigQuery requires parameterMode for named params)
    if (Object.keys(proiecteParams).length > 0) {
      proiecteQueryOptions.params = proiecteParams;
      proiecteQueryOptions.types = {
        ...(projectIds ? { projectIds: ['STRING'] } : {}),
        ...(startDate ? { startDate: 'DATE' } : {}),
        ...(endDate ? { endDate: 'DATE' } : {})
      };
    }

    const [proiecteRows] = await bigquery.query(proiecteQueryOptions);

    allTasks = [...proiecteRows];

    // 2. SUBPROIECTE - nivel 1 în hierarchy
    // ✅ FIX 18.01.2026: Separat calculul orelor lucrate într-un CTE dedicat
    // pentru a evita multiplicarea rezultatelor din JOIN cu responsabili
    const subproiecteQuery = `
      -- CTE 1: Ore lucrate per subproiect (FĂRĂ join cu responsabili)
      WITH time_tracking_stats AS (
        SELECT
          COALESCE(tt.subproiect_id, s.subproiect_id) as subproiect_id,
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_SARCINI} s ON tt.sarcina_id = s.id
        WHERE tt.subproiect_id IS NOT NULL OR s.subproiect_id IS NOT NULL
        GROUP BY COALESCE(tt.subproiect_id, s.subproiect_id)
      ),
      -- CTE 2: Ore estimate per subproiect (din sarcini)
      estimated_hours_stats AS (
        SELECT
          COALESCE(proiect_id, subproiect_id) as subproiect_id,
          SUM(COALESCE(timp_estimat_total_ore, 0)) as total_estimated_hours,
          COUNT(DISTINCT id) as sarcini_count
        FROM ${TABLE_SARCINI}
        WHERE tip_proiect = 'subproiect'
        GROUP BY COALESCE(proiect_id, subproiect_id)
      ),
      -- CTE 3: Responsabili per subproiect (agregat separat)
      responsabili_stats AS (
        SELECT
          subproiect_id,
          STRING_AGG(DISTINCT responsabil_nume, ', ') as all_responsabili
        FROM ${TABLE_SUBPROIECTE_RESPONSABILI}
        GROUP BY subproiect_id
      ),
      -- CTE 4: Comentarii count
      comentarii_stats AS (
        SELECT
          proiect_id,
          COUNT(*) as comentarii_count
        FROM ${TABLE_PROIECT_COMENTARII}
        WHERE tip_proiect = 'subproiect'
        GROUP BY proiect_id
      ),
      -- CTE 5: Date subproiect de bază
      subproject_base AS (
        SELECT
          sp.ID_Subproiect,
          sp.ID_Proiect,
          sp.Denumire,
          sp.Data_Start,
          sp.Data_Final,
          sp.Status,
          sp.Valoare_Estimata,
          sp.Responsabil,
          COALESCE(sp.progres_procent, 0) as progress_from_column
        FROM ${TABLE_SUBPROIECTE} sp
        WHERE sp.Data_Start IS NOT NULL
          AND sp.Data_Final IS NOT NULL
          AND sp.Status != 'Anulat'
          AND sp.activ = true
          ${projectIds ? 'AND sp.ID_Proiect IN UNNEST(@projectIds)' : ''}
          ${startDate ? 'AND CAST(sp.Data_Final AS DATE) >= @startDate' : ''}
          ${endDate ? 'AND CAST(sp.Data_Start AS DATE) <= @endDate' : ''}
      )
      SELECT
        spb.ID_Subproiect as id,
        spb.Denumire as name,
        spb.Data_Start as startDate,
        spb.Data_Final as endDate,
        spb.progress_from_column as progress,
        'subproiect' as type,
        spb.ID_Proiect as parentId,
        ARRAY<STRING>[] as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(COALESCE(rs.all_responsabili, spb.Responsabil), ',')) as r WHERE r != '') as resources,
        CASE
          WHEN DATE_DIFF(spb.Data_Final, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
          WHEN DATE_DIFF(spb.Data_Final, CURRENT_DATE(), DAY) <= 15 THEN 'ridicata'
          ELSE 'normala'
        END as priority,
        CASE
          WHEN spb.Status = 'Activ' THEN 'in_progress'
          WHEN spb.Status = 'Finalizat' THEN 'finalizata'
          WHEN spb.Status = 'Suspendat' THEN 'anulata'
          ELSE 'to_do'
        END as status,
        COALESCE(ehs.total_estimated_hours, 0) as estimatedHours,
        COALESCE(tts.total_worked_hours, 0) as workedHours,
        false as isCollapsed,
        1 as level,
        COALESCE(ehs.sarcini_count, 0) as sarcini_count,
        COALESCE(cs.comentarii_count, 0) as comentarii_count
      FROM subproject_base spb
      LEFT JOIN time_tracking_stats tts ON spb.ID_Subproiect = tts.subproiect_id
      LEFT JOIN estimated_hours_stats ehs ON spb.ID_Subproiect = ehs.subproiect_id
      LEFT JOIN responsabili_stats rs ON spb.ID_Subproiect = rs.subproiect_id
      LEFT JOIN comentarii_stats cs ON spb.ID_Subproiect = cs.proiect_id
      ORDER BY spb.Data_Start ASC
    `;

    const subproiecteQueryOptions: any = {
      query: subproiecteQuery,
      location: 'EU',
    };

    // Reuse same params as proiecte (projectIds, startDate, endDate)
    if (Object.keys(proiecteParams).length > 0) {
      subproiecteQueryOptions.params = proiecteParams;
      subproiecteQueryOptions.types = {
        ...(projectIds ? { projectIds: ['STRING'] } : {}),
        ...(startDate ? { startDate: 'DATE' } : {}),
        ...(endDate ? { endDate: 'DATE' } : {})
      };
    }

    const [subproiecteRows] = await bigquery.query(subproiecteQueryOptions);

    allTasks = [...allTasks, ...subproiecteRows];

    // 3. SARCINI - nivel 2-3 în hierarchy
    // ✅ FIX 18.01.2026: Separat calculul orelor lucrate într-un CTE dedicat
    // pentru a evita multiplicarea rezultatelor din JOIN cu responsabili
    const sarciniQuery = `
      -- CTE 1: Ore lucrate per sarcină (FĂRĂ join cu responsabili)
      WITH time_tracking_stats AS (
        SELECT
          sarcina_id,
          SUM(COALESCE(ore_lucrate, 0)) as total_worked_hours
        FROM ${TABLE_TIME_TRACKING}
        WHERE sarcina_id IS NOT NULL
        GROUP BY sarcina_id
      ),
      -- CTE 2: Responsabili per sarcină (agregat separat)
      responsabili_stats AS (
        SELECT
          sarcina_id,
          STRING_AGG(DISTINCT responsabil_nume, ', ') as all_responsabili
        FROM ${TABLE_SARCINI_RESPONSABILI}
        GROUP BY sarcina_id
      ),
      -- CTE 3: Sarcini filtrate după user (dacă e cazul)
      ${userId ? `
      user_tasks AS (
        SELECT DISTINCT sarcina_id
        FROM ${TABLE_SARCINI_RESPONSABILI}
        WHERE responsabil_uid = @userId
      ),
      ` : ''}
      -- CTE 4: Date sarcină de bază
      task_base AS (
        SELECT
          s.id,
          s.proiect_id,
          s.tip_proiect,
          s.titlu,
          s.data_creare,
          s.data_scadenta,
          s.status,
          s.prioritate,
          s.timp_estimat_total_ore,
          COALESCE(s.progres_procent, 0) as progress_from_column
        FROM ${TABLE_SARCINI} s
        ${userId ? `INNER JOIN user_tasks ut ON s.id = ut.sarcina_id` : ''}
        WHERE s.data_scadenta IS NOT NULL
          AND s.status != 'anulata'
          ${projectIds ? 'AND s.proiect_id IN UNNEST(@projectIds)' : ''}
          ${startDate ? 'AND CAST(s.data_scadenta AS DATE) >= @startDate' : ''}
          ${endDate ? 'AND CAST(s.data_creare AS DATE) <= @endDate' : ''}
      ),
      -- CTE 5: Dependencies (sarcini cu deadline mai mic și finalizate)
      task_dependencies AS (
        SELECT
          tb.id as sarcina_id,
          ARRAY_AGG(DISTINCT dep.id IGNORE NULLS) as dependencies
        FROM task_base tb
        LEFT JOIN ${TABLE_SARCINI} dep
          ON tb.proiect_id = dep.proiect_id
          AND dep.data_scadenta < tb.data_scadenta
          AND dep.status = 'finalizata'
          AND dep.prioritate IN ('urgent', 'ridicata')
        GROUP BY tb.id
      )
      SELECT
        tb.id,
        tb.titlu as name,
        tb.data_creare as startDate,
        tb.data_scadenta as endDate,
        tb.progress_from_column as progress,
        'sarcina' as type,
        tb.proiect_id as parentId,
        COALESCE(td.dependencies, ARRAY<STRING>[]) as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(COALESCE(rs.all_responsabili, ''), ',')) as r WHERE r != '') as resources,
        tb.prioritate as priority,
        tb.status,
        tb.timp_estimat_total_ore as estimatedHours,
        COALESCE(tts.total_worked_hours, 0) as workedHours,
        false as isCollapsed,
        CASE
          WHEN tb.tip_proiect = 'subproiect' THEN 2
          ELSE 1
        END as level
      FROM task_base tb
      LEFT JOIN time_tracking_stats tts ON tb.id = tts.sarcina_id
      LEFT JOIN responsabili_stats rs ON tb.id = rs.sarcina_id
      LEFT JOIN task_dependencies td ON tb.id = td.sarcina_id
      ORDER BY tb.data_creare ASC
    `;

    // Build sarcini params (includes proiecte params + userId)
    const sarciniParams: any = { ...proiecteParams };
    if (userId) {
      sarciniParams.userId = userId;
    }

    const sarciniQueryOptions: any = {
      query: sarciniQuery,
      location: 'EU',
    };

    if (Object.keys(sarciniParams).length > 0) {
      sarciniQueryOptions.params = sarciniParams;
      sarciniQueryOptions.types = {
        ...(projectIds ? { projectIds: ['STRING'] } : {}),
        ...(startDate ? { startDate: 'DATE' } : {}),
        ...(endDate ? { endDate: 'DATE' } : {}),
        ...(userId ? { userId: 'STRING' } : {})
      };
    }

    const [sarciniRows] = await bigquery.query(sarciniQueryOptions);

    allTasks = [...allTasks, ...sarciniRows];

    // 4. MILESTONES din EtapeContract
    const milestonesQuery = `
      SELECT 
        CONCAT('milestone_', ec.ID_Etapa) as id,
        CONCAT('📍 ', ec.denumire) as name,
        ec.data_scadenta as startDate,
        ec.data_scadenta as endDate,
        CASE 
          WHEN ec.status_facturare = 'facturat' THEN 100
          WHEN ec.status_facturare = 'partial' THEN 50
          ELSE 0
        END as progress,
        'milestone' as type,
        ec.proiect_id as parentId,
        ARRAY<STRING>[] as dependencies,
        ARRAY<STRING>[] as resources,
        CASE 
          WHEN ec.valoare > 15000 THEN 'urgent'
          WHEN ec.valoare > 8000 THEN 'ridicata'
          ELSE 'normala'
        END as priority,
        CASE 
          WHEN ec.status_facturare = 'facturat' THEN 'finalizata'
          WHEN ec.status_facturare = 'partial' THEN 'in_progress'
          ELSE 'to_do'
        END as status,
        NULL as estimatedHours,
        NULL as workedHours,
        false as isCollapsed,
        1 as level
      FROM ${TABLE_ETAPE_CONTRACT} ec
      WHERE ec.data_scadenta IS NOT NULL
        AND ec.activ = true
        ${projectIds ? 'AND ec.proiect_id IN UNNEST(@projectIds)' : ''}
        ${startDate ? 'AND CAST(ec.data_scadenta AS DATE) >= @startDate' : ''}
        ${endDate ? 'AND CAST(ec.data_scadenta AS DATE) <= @endDate' : ''}
      ORDER BY ec.data_scadenta ASC
    `;

    const milestonesQueryOptions: any = {
      query: milestonesQuery,
      location: 'EU',
    };

    // Reuse same params as proiecte (projectIds, startDate, endDate)
    if (Object.keys(proiecteParams).length > 0) {
      milestonesQueryOptions.params = proiecteParams;
      milestonesQueryOptions.types = {
        ...(projectIds ? { projectIds: ['STRING'] } : {}),
        ...(startDate ? { startDate: 'DATE' } : {}),
        ...(endDate ? { endDate: 'DATE' } : {})
      };
    }

    const [milestonesRows] = await bigquery.query(milestonesQueryOptions);

    allTasks = [...allTasks, ...milestonesRows];

    // Sortare ierarhică și cleanup
    const sortTasksHierarchically = (tasks: any[]) => {
      const taskMap = new Map(tasks.map(task => [task.id, task]));
      const sorted: any[] = [];

      const addTaskAndChildren = (task: any) => {
        sorted.push(task);
        
        // Găsesc copiii și îi sortez
        const children = tasks
          .filter(t => t.parentId === task.id)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        
        children.forEach(child => addTaskAndChildren(child));
      };

      // Adaug task-urile root (fără parent)
      const rootTasks = tasks
        .filter(task => !task.parentId)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      rootTasks.forEach(task => addTaskAndChildren(task));

      return sorted;
    };

    const hierarchicalTasks = sortTasksHierarchically(allTasks);

    // Statistici pentru dashboard
    const stats = {
      total_tasks: hierarchicalTasks.length,
      proiecte_count: hierarchicalTasks.filter(t => t.type === 'proiect').length,
      subproiecte_count: hierarchicalTasks.filter(t => t.type === 'subproiect').length,
      sarcini_count: hierarchicalTasks.filter(t => t.type === 'sarcina').length,
      milestones_count: hierarchicalTasks.filter(t => t.type === 'milestone').length,
      
      // Status breakdown
      in_progress: hierarchicalTasks.filter(t => t.status === 'in_progress').length,
      completed: hierarchicalTasks.filter(t => t.status === 'finalizata').length,
      pending: hierarchicalTasks.filter(t => t.status === 'to_do').length,
      
      // Priority breakdown
      urgent_tasks: hierarchicalTasks.filter(t => t.priority === 'urgent').length,
      high_priority: hierarchicalTasks.filter(t => t.priority === 'ridicata').length,
      
      // Timeline stats
      earliest_start: hierarchicalTasks.length > 0 ? hierarchicalTasks.reduce((earliest, task) => 
        new Date(task.startDate) < new Date(earliest) ? task.startDate : earliest, 
        hierarchicalTasks[0].startDate
      ) : null,
      latest_end: hierarchicalTasks.length > 0 ? hierarchicalTasks.reduce((latest, task) => 
        new Date(task.endDate) > new Date(latest) ? task.endDate : latest, 
        hierarchicalTasks[0].endDate
      ) : null,
      
      // Work stats
      total_estimated_hours: hierarchicalTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      total_worked_hours: hierarchicalTasks.reduce((sum, t) => sum + (t.workedHours || 0), 0),
      
      // Resource stats
      unique_resources: Array.from(new Set(
        hierarchicalTasks.flatMap(t => t.resources || []).filter(r => r.trim() !== '')
      )).length
    };

    return NextResponse.json({
      success: true,
      data: hierarchicalTasks,
      stats: stats,
      meta: {
        view_mode: viewMode,
        include_dependencies: includeDependencies,
        include_resources: includeResources,
        project_ids: projectIds,
        user_id: userId,
        date_range: {
          start: startDate,
          end: endDate
        },
        total_records: hierarchicalTasks.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare Gantt data API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor Gantt' },
      { status: 500 }
    );
  }
}

// PUT pentru actualizare task-uri (drag & drop, progres, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, updates, task_type } = body;

    if (!task_id || !updates || !task_type) {
      return NextResponse.json({ 
        error: 'task_id, updates și task_type sunt obligatorii' 
      }, { status: 400 });
    }

    let updateQuery = '';
    let updateParams: any = {};
    let updateTypes: any = {};

    // Construiesc query-ul în funcție de tipul task-ului
    switch (task_type) {
      case 'proiect':
        const setClausesProiect: string[] = [];
        if (updates.startDate) {
          setClausesProiect.push('Data_Start = @startDate');
          updateParams.startDate = updates.startDate;
          updateTypes.startDate = 'DATE';
        }
        if (updates.endDate) {
          setClausesProiect.push('Data_Final = @endDate');
          updateParams.endDate = updates.endDate;
          updateTypes.endDate = 'DATE';
        }
        if (updates.status) {
          const statusMapping = {
            'to_do': 'Planificat',
            'in_progress': 'Activ',
            'finalizata': 'Finalizat',
            'anulata': 'Anulat'
          };
          setClausesProiect.push('Status = @status');
          updateParams.status = statusMapping[updates.status as keyof typeof statusMapping] || updates.status;
          updateTypes.status = 'STRING';
        }

        if (setClausesProiect.length === 0) {
          return NextResponse.json({ error: 'Nu sunt actualizări valide pentru proiect' }, { status: 400 });
        }

        updateParams.taskId = task_id;
        updateTypes.taskId = 'STRING';

        updateQuery = `
          UPDATE ${TABLE_PROIECTE}
          SET ${setClausesProiect.join(', ')}
          WHERE ID_Proiect = @taskId
        `;
        break;

      case 'subproiect':
        const setClausesSubproiect: string[] = [];
        if (updates.startDate) {
          setClausesSubproiect.push('Data_Start = @startDate');
          updateParams.startDate = updates.startDate;
          updateTypes.startDate = 'DATE';
        }
        if (updates.endDate) {
          setClausesSubproiect.push('Data_Final = @endDate');
          updateParams.endDate = updates.endDate;
          updateTypes.endDate = 'DATE';
        }
        if (updates.status) {
          const statusMapping = {
            'to_do': 'Planificat',
            'in_progress': 'Activ',
            'finalizata': 'Finalizat',
            'anulata': 'Anulat'
          };
          setClausesSubproiect.push('Status = @status');
          updateParams.status = statusMapping[updates.status as keyof typeof statusMapping] || updates.status;
          updateTypes.status = 'STRING';
        }

        updateParams.taskId = task_id;
        updateTypes.taskId = 'STRING';

        updateQuery = `
          UPDATE ${TABLE_SUBPROIECTE}
          SET ${setClausesSubproiect.join(', ')}
          WHERE ID_Subproiect = @taskId
        `;
        break;

      case 'sarcina':
        const setClausesSarcina: string[] = [];
        if (updates.startDate) {
          setClausesSarcina.push('data_creare = @startDate');
          updateParams.startDate = updates.startDate;
          updateTypes.startDate = 'DATE';
        }
        if (updates.endDate) {
          setClausesSarcina.push('data_scadenta = @endDate');
          updateParams.endDate = updates.endDate;
          updateTypes.endDate = 'DATE';
        }
        if (updates.status) {
          setClausesSarcina.push('status = @status');
          updateParams.status = updates.status;
          updateTypes.status = 'STRING';
        }
        if (updates.priority) {
          setClausesSarcina.push('prioritate = @priority');
          updateParams.priority = updates.priority;
          updateTypes.priority = 'STRING';
        }

        updateParams.taskId = task_id;
        updateTypes.taskId = 'STRING';

        updateQuery = `
          UPDATE ${TABLE_SARCINI}
          SET ${setClausesSarcina.join(', ')}
          WHERE id = @taskId
        `;
        break;

      case 'milestone':
        const milestoneId = task_id.replace('milestone_', '');
        if (updates.endDate) {
          updateParams.endDate = updates.endDate;
          updateTypes.endDate = 'DATE';
        }
        updateParams.taskId = milestoneId;
        updateTypes.taskId = 'STRING';

        updateQuery = `
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET data_scadenta = @endDate
          WHERE ID_Etapa = @taskId
        `;
        break;

      default:
        return NextResponse.json({ error: 'Tip task invalid' }, { status: 400 });
    }

    // Execute the update query with simplified params format
    await bigquery.query({
      query: updateQuery,
      location: 'EU',
      params: updateParams,
      types: updateTypes
    });

    return NextResponse.json({
      success: true,
      message: 'Task actualizat cu succes',
      updated_task: {
        id: task_id,
        type: task_type,
        updates: updates
      }
    });

  } catch (error) {
    console.error('Eroare actualizare Gantt task:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la actualizarea task-ului' },
      { status: 500 }
    );
  }
}
