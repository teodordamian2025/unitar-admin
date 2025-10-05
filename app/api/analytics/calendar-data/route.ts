// ==================================================================
// CALEA: app/api/analytics/calendar-data/route.ts
// CREAT: 14.09.2025 15:00 (ora României)
// DESCRIERE: API pentru extragerea datelor de calendar (sarcini, deadlines, proiecte)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SARCINI_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.SarciniResponsabili${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;

console.log(`🔧 Calendar Data API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Sarcini${tableSuffix}, Proiecte${tableSuffix}, SarciniResponsabili${tableSuffix}, TimeTracking${tableSuffix}, EtapeContract${tableSuffix}`);

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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const userId = searchParams.get('user_id');
    const includeProiecte = searchParams.get('include_proiecte') === 'true';
    const includeSarcini = searchParams.get('include_sarcini') === 'true';
    const includeTimeTracking = searchParams.get('include_timetracking') === 'true';
    const proiectId = searchParams.get('proiect_id');

    if (!startDate || !endDate) {
      return NextResponse.json({ 
        error: 'start_date și end_date sunt obligatorii' 
      }, { status: 400 });
    }

    let allEvents: any[] = [];

    // 1. SARCINI - cu deadline-uri și milestone-uri
    if (includeSarcini) {
      const sarciniQuery = `
        WITH sarcini_data AS (
          SELECT 
            s.id,
            s.titlu,
            s.descriere,
            s.prioritate,
            s.status,
            s.data_scadenta,
            s.data_creare,
            s.data_finalizare,
            s.proiect_id,
            s.timp_estimat_total_ore,
            p.Denumire as proiect_nume,
            p.Status as proiect_status,
            
            -- Responsabili (concatenați)
            STRING_AGG(DISTINCT sr.responsabil_nume, ', ') as responsabili,

            -- Ore lucrate din TimeTracking
            COALESCE(SUM(tt.ore_lucrate), 0) as ore_lucrate_total,

            -- ✅ CITEȘTE DIRECT din Sarcini_v2.progres_procent (05.10.2025)
            COALESCE(s.progres_procent, 0) as progres_procent
            
          FROM ${TABLE_SARCINI} s
          LEFT JOIN ${TABLE_PROIECTE} p 
            ON s.proiect_id = p.ID_Proiect
          LEFT JOIN ${TABLE_SARCINI_RESPONSABILI} sr 
            ON s.id = sr.sarcina_id
          LEFT JOIN ${TABLE_TIME_TRACKING} tt 
            ON s.id = tt.sarcina_id
          WHERE s.data_scadenta IS NOT NULL
            AND s.data_scadenta >= '${startDate}'
            AND s.data_scadenta <= '${endDate}'
            ${userId ? `AND sr.responsabil_uid = '${userId}'` : ''}
            ${proiectId ? `AND s.proiect_id = '${proiectId}'` : ''}
          GROUP BY s.id, s.titlu, s.descriere, s.prioritate, s.status,
                   s.data_scadenta, s.data_creare, s.data_finalizare,
                   s.proiect_id, s.timp_estimat_total_ore, s.progres_procent, p.Denumire, p.Status
        )
        SELECT 
          id,
          titlu,
          proiect_nume,
          proiect_id,
          data_scadenta,
          data_creare,
          data_finalizare,
          prioritate,
          status,
          responsabili as responsabil_nume,
          'sarcina' as tip_eveniment,
          timp_estimat_total_ore as ore_estimate,
          ore_lucrate_total as ore_lucrate,
          progres_procent,
          CASE 
            WHEN data_scadenta < CURRENT_DATE() AND status != 'finalizata' THEN 'overdue'
            WHEN DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) <= 3 AND status != 'finalizata' THEN 'urgent'
            ELSE 'normal'
          END as urgency_status
        FROM sarcini_data
        ORDER BY data_scadenta ASC
      `;

      const sarciniParams = [
        { name: 'startDate', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } },
        { name: 'endDate', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } }
      ];

      if (userId) {
        sarciniParams.push({ name: 'userId', parameterType: { type: 'STRING' }, parameterValue: { value: userId } });
      }

      if (proiectId) {
        sarciniParams.push({ name: 'proiectId', parameterType: { type: 'STRING' }, parameterValue: { value: proiectId } });
      }

      const [sarciniRows] = await bigquery.query({
        query: sarciniQuery,
        location: 'EU',
        params: sarciniParams,
      });

      allEvents = [...allEvents, ...sarciniRows];
    }

    // 2. PROIECTE - deadline-uri și milestone-uri
    if (includeProiecte) {
      const proiecteQuery = `
        SELECT 
          p.ID_Proiect as id,
          CONCAT('Deadline: ', p.Denumire) as titlu,
          p.Denumire as proiect_nume,
          p.ID_Proiect as proiect_id,
          p.Data_Final as data_scadenta,
          p.Data_Start as data_start,
          p.Data_Final as data_final,
          CASE 
            WHEN DATE_DIFF(p.Data_Final, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
            WHEN DATE_DIFF(p.Data_Final, CURRENT_DATE(), DAY) <= 30 THEN 'ridicata'
            ELSE 'normala'
          END as prioritate,
          p.Status as status,
          p.Responsabil as responsabil_nume,
          'deadline_proiect' as tip_eveniment,
          NULL as ore_estimate,
          NULL as ore_lucrate,
          CASE 
            WHEN p.Data_Final < CURRENT_DATE() AND p.Status != 'Finalizat' THEN 'overdue'
            WHEN DATE_DIFF(p.Data_Final, CURRENT_DATE(), DAY) <= 7 AND p.Status != 'Finalizat' THEN 'urgent'
            ELSE 'normal'
          END as urgency_status
        FROM ${TABLE_PROIECTE} p
        WHERE p.Data_Final IS NOT NULL
          AND p.Data_Final >= '${startDate}'
          AND p.Data_Final <= '${endDate}'
          AND p.Status != 'Anulat'
          ${proiectId ? `AND p.ID_Proiect = '${proiectId}'` : ''}
      `;

      const proiecteParams = [
        { name: 'startDate', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } },
        { name: 'endDate', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } }
      ];

      if (proiectId) {
        proiecteParams.push({ name: 'proiectId', parameterType: { type: 'STRING' }, parameterValue: { value: proiectId } });
      }

      const [proiecteRows] = await bigquery.query({
        query: proiecteQuery,
        location: 'EU',
        params: proiecteParams,
      });

      allEvents = [...allEvents, ...proiecteRows];
    }

    // 3. TIME TRACKING - sesiuni de lucru pentru vizualizare
    if (includeTimeTracking) {
      const timeTrackingQuery = `
        SELECT DISTINCT
          CONCAT('tt_', tt.data_lucru, '_', tt.proiect_id) as id,
          CONCAT('Lucru: ', COALESCE(s.titlu, p.Denumire)) as titlu,
          p.Denumire as proiect_nume,
          tt.proiect_id,
          tt.data_lucru as data_scadenta,
          tt.data_lucru as data_start,
          tt.data_lucru as data_final,
          'normala' as prioritate,
          'finalizata' as status,
          tt.utilizator_nume as responsabil_nume,
          'time_tracking' as tip_eveniment,
          NULL as ore_estimate,
          SUM(tt.ore_lucrate) as ore_lucrate,
          'completed' as urgency_status
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_PROIECTE} p 
          ON tt.proiect_id = p.ID_Proiect
        LEFT JOIN ${TABLE_SARCINI} s 
          ON tt.sarcina_id = s.id
        WHERE tt.data_lucru >= '${startDate}'
          AND tt.data_lucru <= '${endDate}'
          AND tt.ore_lucrate > 0
          ${userId ? `AND tt.utilizator_uid = '${userId}'` : ''}
          ${proiectId ? `AND tt.proiect_id = '${proiectId}'` : ''}
        GROUP BY tt.data_lucru, tt.proiect_id, p.Denumire, s.titlu, tt.utilizator_nume
        ORDER BY tt.data_lucru DESC
      `;

      const timeTrackingParams = [
        { name: 'startDate', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } },
        { name: 'endDate', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } }
      ];

      if (userId) {
        timeTrackingParams.push({ name: 'userId', parameterType: { type: 'STRING' }, parameterValue: { value: userId } });
      }

      if (proiectId) {
        timeTrackingParams.push({ name: 'proiectId', parameterType: { type: 'STRING' }, parameterValue: { value: proiectId } });
      }

      const [timeTrackingRows] = await bigquery.query({
        query: timeTrackingQuery,
        location: 'EU',
        params: timeTrackingParams,
      });

      allEvents = [...allEvents, ...timeTrackingRows];
    }

    // 4. MILESTONES din Contracte/Etape
    const milestonesQuery = `
      SELECT 
        CONCAT('milestone_', ec.ID_Etapa) as id,
        CONCAT('Milestone: ', ec.denumire) as titlu,
        p.Denumire as proiect_nume,
        ec.proiect_id,
        ec.data_scadenta,
        ec.data_scadenta as data_start,
        ec.data_scadenta as data_final,
        CASE 
          WHEN ec.valoare > 10000 THEN 'urgent'
          WHEN ec.valoare > 5000 THEN 'ridicata'
          ELSE 'normala'
        END as prioritate,
        COALESCE(ec.status_facturare, 'to_do') as status,
        NULL as responsabil_nume,
        'milestone' as tip_eveniment,
        NULL as ore_estimate,
        NULL as ore_lucrate,
        CASE 
          WHEN ec.data_scadenta < CURRENT_DATE() AND COALESCE(ec.status_facturare, 'to_do') != 'facturat' THEN 'overdue'
          WHEN DATE_DIFF(ec.data_scadenta, CURRENT_DATE(), DAY) <= 7 THEN 'urgent'
          ELSE 'normal'
        END as urgency_status
      FROM ${TABLE_ETAPE_CONTRACT} ec
      LEFT JOIN ${TABLE_PROIECTE} p 
        ON ec.proiect_id = p.ID_Proiect
      WHERE ec.data_scadenta IS NOT NULL
        AND ec.data_scadenta >= '${startDate}'
        AND ec.data_scadenta <= '${endDate}'
        AND ec.activ = true
        ${proiectId ? `AND ec.proiect_id = '${proiectId}'` : ''}
    `;

    const milestonesParams = [
      { name: 'startDate', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } },
      { name: 'endDate', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } }
    ];

    if (proiectId) {
      milestonesParams.push({ name: 'proiectId', parameterType: { type: 'STRING' }, parameterValue: { value: proiectId } });
    }

    const [milestonesRows] = await bigquery.query({
      query: milestonesQuery,
      location: 'EU',
      params: milestonesParams,
    });

    allEvents = [...allEvents, ...milestonesRows];

    // Sortare finală și formatare
    const sortedEvents = allEvents.sort((a, b) => {
      const dateA = new Date(a.data_scadenta || a.data_start);
      const dateB = new Date(b.data_scadenta || b.data_start);
      return dateA.getTime() - dateB.getTime();
    });

    // Statistici pentru dashboard
    const stats = {
      total_events: sortedEvents.length,
      urgent_count: sortedEvents.filter(e => e.prioritate === 'urgent' || e.urgency_status === 'urgent').length,
      overdue_count: sortedEvents.filter(e => e.urgency_status === 'overdue').length,
      completed_count: sortedEvents.filter(e => e.status === 'finalizata' || e.status === 'facturat').length,
      
      // Breakdown pe tipuri
      sarcini_count: sortedEvents.filter(e => e.tip_eveniment === 'sarcina').length,
      proiecte_count: sortedEvents.filter(e => e.tip_eveniment === 'deadline_proiect').length,
      milestones_count: sortedEvents.filter(e => e.tip_eveniment === 'milestone').length,
      timetracking_count: sortedEvents.filter(e => e.tip_eveniment === 'time_tracking').length,
      
      // Ore statistici
      total_estimated_hours: sortedEvents.reduce((sum, e) => sum + (parseFloat(e.ore_estimate) || 0), 0),
      total_worked_hours: sortedEvents.reduce((sum, e) => sum + (parseFloat(e.ore_lucrate) || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: sortedEvents,
      stats: stats,
      meta: {
        start_date: startDate,
        end_date: endDate,
        user_id: userId,
        proiect_id: proiectId,
        filters_applied: {
          include_proiecte: includeProiecte,
          include_sarcini: includeSarcini,
          include_timetracking: includeTimeTracking
        },
        total_records: sortedEvents.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare calendar data API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor de calendar' },
      { status: 500 }
    );
  }
}

// POST pentru actualizare evenimente (replanificare)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, new_date, tip_eveniment } = body;

    if (!event_id || !new_date || !tip_eveniment) {
      return NextResponse.json({ 
        error: 'event_id, new_date și tip_eveniment sunt obligatorii' 
      }, { status: 400 });
    }

    let updateQuery = '';
    let updateParams: any[] = [];

    switch (tip_eveniment) {
      case 'sarcina':
        updateQuery = `
          UPDATE ${TABLE_SARCINI}
          SET data_scadenta = '${new_date}'
          WHERE id = '${event_id}'
        `;
        break;

      case 'deadline_proiect':
        updateQuery = `
          UPDATE ${TABLE_PROIECTE}
          SET Data_Final = '${new_date}'
          WHERE ID_Proiect = '${event_id}'
        `;
        break;

      case 'milestone':
        const milestoneId = event_id.replace('milestone_', '');
        updateQuery = `
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET data_scadenta = '${new_date}'
          WHERE ID_Etapa = '${milestoneId}'
        `;
        break;

      default:
        return NextResponse.json({ 
          error: 'Tip eveniment invalid pentru actualizare' 
        }, { status: 400 });
    }

    updateParams = [
      { name: 'newDate', parameterType: { type: 'DATE' }, parameterValue: { value: new_date } },
      { name: 'eventId', parameterType: { type: 'STRING' }, parameterValue: { value: event_id } }
    ];

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
      params: updateParams,
    });

    return NextResponse.json({
      success: true,
      message: 'Eveniment actualizat cu succes',
      updated_event: {
        id: event_id,
        new_date: new_date,
        tip_eveniment: tip_eveniment
      }
    });

  } catch (error) {
    console.error('Eroare actualizare calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la actualizarea evenimentului' },
      { status: 500 }
    );
  }
}
