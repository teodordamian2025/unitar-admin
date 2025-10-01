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

console.log(`🔧 Gantt Data API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, Subproiecte${tableSuffix}, Sarcini${tableSuffix}, TimeTracking${tableSuffix}, EtapeContract${tableSuffix}`);

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
    const projectIds = searchParams.get('project_ids')?.split(',');
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let allTasks: any[] = [];

    // 1. PROIECTE - nivel principal în hierarchy
    const proiecteQuery = `
      WITH project_stats AS (
        SELECT
          p.ID_Proiect,
          p.Denumire,
          p.Adresa,
          p.Data_Start,
          p.Data_Final,
          p.Status,
          p.Valoare_Estimata,
          p.moneda,
          p.Responsabil,
          
          -- Calculez progres bazat pe subproiecte și sarcini
          COALESCE(
            ROUND(
              (COUNT(CASE WHEN s.status = 'finalizata' THEN 1 END) * 100.0) / 
              NULLIF(COUNT(s.id), 0), 
              1
            ), 
            0
          ) as progress_from_sarcini,
          
          -- Ore estimate și lucrate
          SUM(COALESCE(s.timp_estimat_total_ore, 0)) as total_estimated_hours,
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours,
          
          -- Count subproiecte și sarcini
          COUNT(DISTINCT sp.ID_Subproiect) as subproiecte_count,
          COUNT(DISTINCT s.id) as sarcini_count,
          
          -- Responsabili (agregat)
          STRING_AGG(DISTINCT COALESCE(pr.responsabil_nume, p.Responsabil), ', ') as all_responsabili
          
        FROM ${TABLE_PROIECTE} p
        LEFT JOIN ${TABLE_SUBPROIECTE} sp 
          ON p.ID_Proiect = sp.ID_Proiect AND sp.activ = true
        LEFT JOIN ${TABLE_SARCINI} s 
          ON p.ID_Proiect = s.proiect_id
        LEFT JOIN ${TABLE_TIME_TRACKING} tt 
          ON s.id = tt.sarcina_id
        LEFT JOIN ${TABLE_PROIECTE_RESPONSABILI} pr 
          ON p.ID_Proiect = pr.proiect_id
        WHERE p.Data_Start IS NOT NULL 
          AND p.Data_Final IS NOT NULL
          AND p.Status != 'Anulat'
          ${projectIds ? 'AND p.ID_Proiect IN UNNEST(@projectIds)' : ''}
          ${startDate ? 'AND p.Data_Final >= @startDate' : ''}
          ${endDate ? 'AND p.Data_Start <= @endDate' : ''}
        GROUP BY p.ID_Proiect, p.Denumire, p.Adresa, p.Data_Start, p.Data_Final,
                 p.Status, p.Valoare_Estimata, p.moneda, p.Responsabil
      )
      SELECT
        ID_Proiect as id,
        CONCAT(ID_Proiect, ' - ', Denumire) as name,
        Adresa,
        Data_Start as startDate,
        Data_Final as endDate,
        progress_from_sarcini as progress,
        'proiect' as type,
        NULL as parentId,
        ARRAY<STRING>[] as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(all_responsabili, ',')) as r WHERE r != '') as resources,
        CASE 
          WHEN DATE_DIFF(Data_Final, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
          WHEN DATE_DIFF(Data_Final, CURRENT_DATE(), DAY) <= 30 THEN 'ridicata'
          ELSE 'normala'
        END as priority,
        CASE 
          WHEN Status = 'Activ' THEN 'in_progress'
          WHEN Status = 'Finalizat' THEN 'finalizata'
          WHEN Status = 'Suspendat' THEN 'anulata'
          ELSE 'to_do'
        END as status,
        total_estimated_hours as estimatedHours,
        total_worked_hours as workedHours,
        false as isCollapsed,
        0 as level,
        subproiecte_count,
        sarcini_count
      FROM project_stats
      ORDER BY Data_Start ASC
    `;

    const proiecteParams: any[] = [];
    if (projectIds) {
      proiecteParams.push({ 
        name: 'projectIds', 
        parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, 
        parameterValue: { arrayValues: projectIds.map(id => ({ value: id })) }
      });
    }
    if (startDate) {
      proiecteParams.push({ name: 'startDate', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } });
    }
    if (endDate) {
      proiecteParams.push({ name: 'endDate', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } });
    }

    const [proiecteRows] = await bigquery.query({
      query: proiecteQuery,
      location: 'EU',
      params: proiecteParams,
    });

    allTasks = [...proiecteRows];

    // 2. SUBPROIECTE - nivel 1 în hierarchy
    const subproiecteQuery = `
      WITH subproject_stats AS (
        SELECT 
          sp.ID_Subproiect,
          sp.ID_Proiect,
          sp.Denumire,
          sp.Data_Start,
          sp.Data_Final,
          sp.Status,
          sp.Valoare_Estimata,
          sp.Responsabil,
          
          -- Progres din sarcini
          COALESCE(
            ROUND(
              (COUNT(CASE WHEN s.status = 'finalizata' THEN 1 END) * 100.0) / 
              NULLIF(COUNT(s.id), 0), 
              1
            ), 
            0
          ) as progress_from_sarcini,
          
          -- Ore
          SUM(COALESCE(s.timp_estimat_total_ore, 0)) as total_estimated_hours,
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours,
          
          -- Count sarcini
          COUNT(DISTINCT s.id) as sarcini_count,
          
          -- Responsabili
          STRING_AGG(DISTINCT COALESCE(spr.responsabil_nume, sp.Responsabil), ', ') as all_responsabili
          
        FROM ${TABLE_SUBPROIECTE} sp
        LEFT JOIN ${TABLE_SARCINI} s 
          ON sp.ID_Subproiect = s.proiect_id AND s.tip_proiect = 'subproiect'
        LEFT JOIN ${TABLE_TIME_TRACKING} tt 
          ON s.id = tt.sarcina_id
        LEFT JOIN ${TABLE_SUBPROIECTE_RESPONSABILI} spr 
          ON sp.ID_Subproiect = spr.subproiect_id
        WHERE sp.Data_Start IS NOT NULL 
          AND sp.Data_Final IS NOT NULL
          AND sp.Status != 'Anulat'
          AND sp.activ = true
          ${projectIds ? 'AND sp.ID_Proiect IN UNNEST(@projectIds)' : ''}
          ${startDate ? 'AND sp.Data_Final >= @startDate' : ''}
          ${endDate ? 'AND sp.Data_Start <= @endDate' : ''}
        GROUP BY sp.ID_Subproiect, sp.ID_Proiect, sp.Denumire, sp.Data_Start, 
                 sp.Data_Final, sp.Status, sp.Valoare_Estimata, sp.Responsabil
      )
      SELECT 
        ID_Subproiect as id,
        Denumire as name,
        Data_Start as startDate,
        Data_Final as endDate,
        progress_from_sarcini as progress,
        'subproiect' as type,
        ID_Proiect as parentId,
        ARRAY<STRING>[] as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(all_responsabili, ',')) as r WHERE r != '') as resources,
        CASE 
          WHEN DATE_DIFF(Data_Final, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
          WHEN DATE_DIFF(Data_Final, CURRENT_DATE(), DAY) <= 15 THEN 'ridicata'
          ELSE 'normala'
        END as priority,
        CASE 
          WHEN Status = 'Activ' THEN 'in_progress'
          WHEN Status = 'Finalizat' THEN 'finalizata'
          WHEN Status = 'Suspendat' THEN 'anulata'
          ELSE 'to_do'
        END as status,
        total_estimated_hours as estimatedHours,
        total_worked_hours as workedHours,
        false as isCollapsed,
        1 as level,
        sarcini_count
      FROM subproject_stats
      ORDER BY Data_Start ASC
    `;

    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      location: 'EU',
      params: proiecteParams, // Same params as projects
    });

    allTasks = [...allTasks, ...subproiecteRows];

    // 3. SARCINI - nivel 2-3 în hierarchy
    const sarciniQuery = `
      WITH task_stats AS (
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
          
          -- Progres din ore lucrate vs estimate
          CASE 
            WHEN s.timp_estimat_total_ore > 0 
            THEN LEAST(100, ROUND((SUM(COALESCE(tt.ore_lucrate, 0)) / s.timp_estimat_total_ore) * 100, 1))
            ELSE CASE WHEN s.status = 'finalizata' THEN 100 ELSE 0 END
          END as calculated_progress,
          
          -- Ore lucrate
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours,
          
          -- Responsabili
          STRING_AGG(DISTINCT sr.responsabil_nume, ', ') as all_responsabili,
          
          -- Dependencies (din alte sarcini cu deadline mai mic)
          ARRAY_AGG(DISTINCT dep.id IGNORE NULLS) as task_dependencies
          
        FROM ${TABLE_SARCINI} s
        LEFT JOIN ${TABLE_TIME_TRACKING} tt 
          ON s.id = tt.sarcina_id
        LEFT JOIN ${TABLE_SARCINI_RESPONSABILI} sr 
          ON s.id = sr.sarcina_id
        LEFT JOIN ${TABLE_SARCINI} dep 
          ON s.proiect_id = dep.proiect_id 
          AND dep.data_scadenta < s.data_scadenta 
          AND dep.status = 'finalizata'
          AND dep.prioritate IN ('urgent', 'ridicata')
        WHERE s.data_scadenta IS NOT NULL
          AND s.status != 'anulata'
          ${projectIds ? 'AND s.proiect_id IN UNNEST(@projectIds)' : ''}
          ${userId ? 'AND sr.responsabil_uid = @userId' : ''}
          ${startDate ? 'AND s.data_scadenta >= @startDate' : ''}
          ${endDate ? 'AND s.data_creare <= @endDate' : ''}
        GROUP BY s.id, s.proiect_id, s.tip_proiect, s.titlu, s.data_creare, 
                 s.data_scadenta, s.status, s.prioritate, s.timp_estimat_total_ore
      )
      SELECT 
        id,
        titlu as name,
        data_creare as startDate,
        data_scadenta as endDate,
        calculated_progress as progress,
        'sarcina' as type,
        proiect_id as parentId,
        COALESCE(task_dependencies, ARRAY<STRING>[]) as dependencies,
        ARRAY(SELECT TRIM(r) FROM UNNEST(SPLIT(all_responsabili, ',')) as r WHERE r != '') as resources,
        prioritate as priority,
        status,
        timp_estimat_total_ore as estimatedHours,
        total_worked_hours as workedHours,
        false as isCollapsed,
        CASE 
          WHEN tip_proiect = 'subproiect' THEN 2
          ELSE 1
        END as level
      FROM task_stats
      ORDER BY data_creare ASC
    `;

    const sarciniParams = [...proiecteParams];
    if (userId) {
      sarciniParams.push({ name: 'userId', parameterType: { type: 'STRING' }, parameterValue: { value: userId } });
    }

    const [sarciniRows] = await bigquery.query({
      query: sarciniQuery,
      location: 'EU',
      params: sarciniParams,
    });

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
        ${startDate ? 'AND ec.data_scadenta >= @startDate' : ''}
        ${endDate ? 'AND ec.data_scadenta <= @endDate' : ''}
      ORDER BY ec.data_scadenta ASC
    `;

    const [milestonesRows] = await bigquery.query({
      query: milestonesQuery,
      location: 'EU',
      params: proiecteParams,
    });

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
    let updateParams: Array<{
	  name: string;
	  parameterType: any;
	  parameterValue: any;
	}> = [];

    // Construiesc query-ul în funcție de tipul task-ului
    switch (task_type) {
      case 'proiect':
        const setClausesProiect: string[] = [];
        if (updates.startDate) setClausesProiect.push('Data_Start = @startDate');
        if (updates.endDate) setClausesProiect.push('Data_Final = @endDate');
        if (updates.status) {
          const statusMapping = {
            'to_do': 'Planificat',
            'in_progress': 'Activ', 
            'finalizata': 'Finalizat',
            'anulata': 'Anulat'
          };
          setClausesProiect.push('Status = @status');
          updateParams.push({ 
            name: 'status', 
            parameterType: { type: 'STRING' }, 
            parameterValue: { value: statusMapping[updates.status as keyof typeof statusMapping] || updates.status }
          });
        }

        if (setClausesProiect.length === 0) {
          return NextResponse.json({ error: 'Nu sunt actualizări valide pentru proiect' }, { status: 400 });
        }

        updateQuery = `
          UPDATE ${TABLE_PROIECTE}
          SET ${setClausesProiect.join(', ')}
          WHERE ID_Proiect = @taskId
        `;
        break;

      case 'subproiect':
        const setClausesSubproiect: string[] = [];
        if (updates.startDate) setClausesSubproiect.push('Data_Start = @startDate');
        if (updates.endDate) setClausesSubproiect.push('Data_Final = @endDate');
        if (updates.status) {
          const statusMapping = {
            'to_do': 'Planificat',
            'in_progress': 'Activ',
            'finalizata': 'Finalizat', 
            'anulata': 'Anulat'
          };
          setClausesSubproiect.push('Status = @status');
          updateParams.push({ 
            name: 'status', 
            parameterType: { type: 'STRING' }, 
            parameterValue: { value: statusMapping[updates.status as keyof typeof statusMapping] || updates.status }
          });
        }

        updateQuery = `
          UPDATE ${TABLE_SUBPROIECTE}
          SET ${setClausesSubproiect.join(', ')}
          WHERE ID_Subproiect = @taskId
        `;
        break;

      case 'sarcina':
        const setClausesSarcina: string[] = [];
        if (updates.startDate) setClausesSarcina.push('data_creare = @startDate');
        if (updates.endDate) setClausesSarcina.push('data_scadenta = @endDate');
        if (updates.status) setClausesSarcina.push('status = @status');
        if (updates.priority) setClausesSarcina.push('prioritate = @priority');

        updateQuery = `
          UPDATE ${TABLE_SARCINI}
          SET ${setClausesSarcina.join(', ')}
          WHERE id = @taskId
        `;
        break;

      case 'milestone':
        const milestoneId = task_id.replace('milestone_', '');
        updateQuery = `
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET data_scadenta = @endDate
          WHERE ID_Etapa = @taskId
        `;
        updateParams.push({ 
          name: 'taskId', 
          parameterType: { type: 'STRING' }, 
          parameterValue: { value: milestoneId }
        });
        break;

      default:
        return NextResponse.json({ error: 'Tip task invalid' }, { status: 400 });
    }

    // Adaug parametrii comuni
    if (updates.startDate && task_type !== 'milestone') {
      updateParams.push({ 
        name: 'startDate', 
        parameterType: { type: 'DATE' }, 
        parameterValue: { value: updates.startDate }
      });
    }
    if (updates.endDate) {
      updateParams.push({ 
        name: 'endDate', 
        parameterType: { type: 'DATE' }, 
        parameterValue: { value: updates.endDate }
      });
    }
    if (updates.priority && task_type === 'sarcina') {
      updateParams.push({ 
        name: 'priority', 
        parameterType: { type: 'STRING' }, 
        parameterValue: { value: updates.priority }
      });
    }
    if (task_type !== 'milestone') {
      updateParams.push({ 
        name: 'taskId', 
        parameterType: { type: 'STRING' }, 
        parameterValue: { value: task_id }
      });
    }

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
      params: updateParams,
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
