// ==================================================================
// CALEA: app/api/analytics/live-timer/route.ts
// DATA: 28.09.2025 00:15 (ora României)
// DESCRIERE: API pentru management live timer sessions cu suport pentru ierarhie proiecte/subproiecte
// MODIFICAT: Adăugată logica pentru tip_proiect și gestionarea corectă a proiect_id
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru a extrage valoarea din obiectele BigQuery
function extractBigQueryValue(field: any): any {
  if (field && typeof field === 'object' && 'value' in field) {
    return field.value;
  }
  return field;
}

// Helper function pentru a procesa rândurile BigQuery
function processBigQueryRows(rows: any[]): any[] {
  return rows.map(row => {
    const processedRow: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      processedRow[key] = extractBigQueryValue(value);
    }
    
    return processedRow;
  });
}

// Helper function pentru a calcula ore lucrate ca string pentru NUMERIC
function calculateWorkedHoursAsString(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const roundedHours = Math.round(diffHours * 100) / 100;
  return roundedHours.toString();
}

// Helper function pentru a determina contextul proiectului/subproiectului
async function getProjectContext(proiectId: string): Promise<{
  tip_proiect: 'proiect' | 'subproiect';
  proiect_principal_id?: string;
  nume_complet: string;
}> {
  try {
    // Verific dacă este subproiect
    const subproiectQuery = `
      SELECT 
        s.ID_Subproiect,
        s.ID_Proiect as proiect_principal_id,
        s.Denumire as subproiect_nume,
        p.Denumire as proiect_nume
      FROM \`hale-mode-464009-i6.PanouControlUnitar.Subproiecte\` s
      LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p
        ON s.ID_Proiect = p.ID_Proiect
      WHERE s.ID_Subproiect = @proiect_id
    `;

    const [subproiectRows] = await bigquery.query({
      query: subproiectQuery,
      location: 'EU',
      params: { proiect_id: proiectId }
    });

    if (subproiectRows.length > 0) {
      const subproiect = processBigQueryRows(subproiectRows)[0];
      return {
        tip_proiect: 'subproiect',
        proiect_principal_id: subproiect.proiect_principal_id,
        nume_complet: `${subproiect.proiect_nume} → ${subproiect.subproiect_nume}`
      };
    }

    // Dacă nu este subproiect, verific dacă este proiect principal
    const proiectQuery = `
      SELECT 
        ID_Proiect,
        Denumire
      FROM \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @proiect_id
    `;

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      location: 'EU',
      params: { proiect_id: proiectId }
    });

    if (proiectRows.length > 0) {
      const proiect = processBigQueryRows(proiectRows)[0];
      return {
        tip_proiect: 'proiect',
        nume_complet: proiect.Denumire
      };
    }

    throw new Error(`Proiectul/Subproiectul cu ID ${proiectId} nu a fost găsit`);

  } catch (error) {
    console.error('Eroare la determinarea contextului proiectului:', error);
    throw error;
  }
}

// GET - Obținere sesiuni active și statistici
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const includeCompleted = searchParams.get('include_completed') === 'true';
    const teamView = searchParams.get('team_view') !== 'false';

    // Query optimizat cu ierarhie corectă
    const activeSessionsQuery = `
      WITH active_sessions AS (
        SELECT 
          sl.id,
          sl.utilizator_uid,
          COALESCE(CONCAT(u.nume, ' ', u.prenume), 'Test User') as utilizator_nume,
          sl.proiect_id,
          
          -- Determinare nume proiect bazat pe context (proiect sau subproiect)
          CASE
            WHEN sub.ID_Subproiect IS NOT NULL THEN
              CONCAT(p_parent.ID_Proiect, ' → ', sub.ID_Subproiect)
            ELSE
              COALESCE(p.ID_Proiect, sl.proiect_id)
          END as proiect_nume,
          
          -- Titlu sarcină sau activitate generală
          CASE
            WHEN sl.descriere_activitate IS NOT NULL AND sl.descriere_activitate != '' THEN
              sl.descriere_activitate
            ELSE
              'Activitate generală'
          END as sarcina_titlu,
          
          'normala' as prioritate,
          sl.data_start,
          sl.data_stop,
          sl.status,
          sl.descriere_activitate as descriere_sesiune,
          sl.ore_lucrate,
          
          -- Calculez timpul elapsed în secunde
          CAST(
            CASE
              WHEN sl.status = 'activ' THEN
                TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sl.data_start, SECOND)
              WHEN sl.status = 'pausat' AND sl.data_stop IS NOT NULL THEN
                TIMESTAMP_DIFF(sl.data_stop, sl.data_start, SECOND)
              WHEN sl.status = 'completat' AND sl.data_stop IS NOT NULL THEN
                TIMESTAMP_DIFF(sl.data_stop, sl.data_start, SECOND)
              ELSE 0
            END AS INT64
          ) as elapsed_seconds,

          -- Ultima activitate
          COALESCE(sl.data_stop, sl.data_start) as ultima_activitate,
          
          -- Calculez productivitatea
          CASE 
            WHEN sl.status = 'activ' THEN 85
            WHEN sl.status = 'pausat' THEN 50
            ELSE 65
          END as productivity_score,
          
          -- Break time calculation
          CAST(
            CASE
              WHEN sl.status = 'pausat' THEN
                TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), COALESCE(sl.data_stop, sl.data_start), SECOND)
              ELSE 0
            END AS INT64
          ) as break_time_seconds
          
        FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\` sl
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u 
          ON sl.utilizator_uid = u.uid
        -- Join cu proiecte principale
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p 
          ON sl.proiect_id = p.ID_Proiect
        -- Join cu subproiecte (dacă proiect_id este de fapt un subproiect)
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Subproiecte\` sub 
          ON sl.proiect_id = sub.ID_Subproiect
        -- Join pentru numele proiectului principal al subproiectului
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p_parent 
          ON sub.ID_Proiect = p_parent.ID_Proiect
        WHERE sl.status IN ('activ', 'pausat')
          AND sl.data_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
          ${userId ? `AND sl.utilizator_uid = @userId` : ''}
        ORDER BY sl.data_start DESC
      )
      
      SELECT
        id,
        utilizator_uid,
        utilizator_nume,
        proiect_id,
        proiect_nume,
        sarcina_titlu,
        prioritate,
        data_start,
        data_stop,
        status,
        descriere_sesiune,
        ore_lucrate,
        elapsed_seconds,
        ultima_activitate,
        productivity_score,
        break_time_seconds,
        
        -- Format pentru frontend
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', data_start) as data_start_formatted,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', ultima_activitate) as ultima_activitate_formatted
        
      FROM active_sessions
      ${includeCompleted ? `
        UNION ALL
        SELECT 
          sl2.id, sl2.utilizator_uid, 
          COALESCE(CONCAT(u2.nume, ' ', u2.prenume), 'Test User') as utilizator_nume, 
          sl2.proiect_id, 
          CASE
            WHEN sub2.ID_Subproiect IS NOT NULL THEN
              CONCAT(p2_parent.ID_Proiect, ' → ', sub2.ID_Subproiect)
            ELSE
              COALESCE(p2.ID_Proiect, sl2.proiect_id)
          END as proiect_nume,
          COALESCE(sl2.descriere_activitate, 'Activitate generală') as sarcina_titlu, 
          'normala' as prioritate, 
          sl2.data_start, 
          sl2.data_stop,
          'completat' as status, 
          sl2.descriere_activitate as descriere_sesiune,
          sl2.ore_lucrate,
          CAST(TIMESTAMP_DIFF(sl2.data_stop, sl2.data_start, SECOND) AS INT64) as elapsed_seconds,
          sl2.data_stop as ultima_activitate, 
          85 as productivity_score, 
          0 as break_time_seconds,
          FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', sl2.data_start) as data_start_formatted,
          FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', sl2.data_stop) as ultima_activitate_formatted
        FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\` sl2
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u2 
          ON sl2.utilizator_uid = u2.uid
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p2 
          ON sl2.proiect_id = p2.ID_Proiect
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Subproiecte\` sub2 
          ON sl2.proiect_id = sub2.ID_Subproiect
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p2_parent 
          ON sub2.ID_Proiect = p2_parent.ID_Proiect
        WHERE sl2.status = 'completat'
          AND sl2.data_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)
          ${userId ? `AND sl2.utilizator_uid = @userId` : ''}
      ` : ''}
    `;

    const queryOptions: any = {
      query: activeSessionsQuery,
      location: 'EU'
    };

    if (userId) {
      queryOptions.params = { userId: userId };
    }

    const [rawRows] = await bigquery.query(queryOptions);
    const sessionsRows = processBigQueryRows(rawRows);

    // Calculez statistici pentru dashboard cu valori procesate
    const stats = {
      total_active_sessions: sessionsRows.filter((s: any) => s.status === 'activ').length,
      total_paused_sessions: sessionsRows.filter((s: any) => s.status === 'pausat').length,
      total_users_online: new Set(
        sessionsRows.filter((s: any) => s.status === 'activ').map((s: any) => s.utilizator_uid)
      ).size,
      total_time_today: sessionsRows.reduce((sum: number, s: any) => {
        const elapsedSeconds = typeof s.elapsed_seconds === 'number' ? s.elapsed_seconds : 0;
        return sum + elapsedSeconds;
      }, 0),
      total_hours_today: sessionsRows.reduce((sum: number, s: any) => {
        const elapsedSeconds = typeof s.elapsed_seconds === 'number' ? s.elapsed_seconds : 0;
        return sum + elapsedSeconds;
      }, 0) / 3600,
      avg_session_length: sessionsRows.length > 0 ? 
        sessionsRows.reduce((sum: number, s: any) => {
          const elapsedSeconds = typeof s.elapsed_seconds === 'number' ? s.elapsed_seconds : 0;
          return sum + elapsedSeconds;
        }, 0) / sessionsRows.length : 0,
      avg_session_duration: sessionsRows.length > 0 ? 
        (sessionsRows.reduce((sum: number, s: any) => {
          const elapsedSeconds = typeof s.elapsed_seconds === 'number' ? s.elapsed_seconds : 0;
          return sum + elapsedSeconds;
        }, 0) / sessionsRows.length) / 60 : 0,
      
      most_active_user: sessionsRows.length > 0 ? 
        sessionsRows.reduce((prev: any, current: any) => {
          const prevElapsed = typeof prev.elapsed_seconds === 'number' ? prev.elapsed_seconds : 0;
          const currentElapsed = typeof current.elapsed_seconds === 'number' ? current.elapsed_seconds : 0;
          return prevElapsed > currentElapsed ? prev : current;
        }).utilizator_nume : '',
        
      most_active_project: (() => {
        const projectTimes = sessionsRows.reduce((acc: any, session: any) => {
          const projectName = session.proiect_nume || 'Necunoscut';
          const elapsedSeconds = typeof session.elapsed_seconds === 'number' ? session.elapsed_seconds : 0;
          acc[projectName] = (acc[projectName] || 0) + elapsedSeconds;
          return acc;
        }, {});
        
        return Object.keys(projectTimes).length > 0 ? 
          Object.keys(projectTimes).reduce((a, b) => projectTimes[a] > projectTimes[b] ? a : b) : '';
      })(),
      
      break_time_total: sessionsRows.reduce((sum: number, s: any) => {
        const breakTime = typeof s.break_time_seconds === 'number' ? s.break_time_seconds : 0;
        return sum + breakTime;
      }, 0),
      productivity_avg: sessionsRows.length > 0 ? 
        sessionsRows.reduce((sum: number, s: any) => {
          const productivity = typeof s.productivity_score === 'number' ? s.productivity_score : 0;
          return sum + productivity;
        }, 0) / sessionsRows.length : 0,
        
      active_users_count: new Set(
        sessionsRows.filter((s: any) => s.status === 'activ').map((s: any) => s.utilizator_uid)
      ).size,
      
      longest_session: sessionsRows.length > 0 ? Math.max(...sessionsRows.map((s: any) => {
        return typeof s.elapsed_seconds === 'number' ? s.elapsed_seconds : 0;
      })) : 0
    };

    return NextResponse.json({
      success: true,
      data: sessionsRows,
      stats: stats,
      meta: {
        user_id: userId,
        include_completed: includeCompleted,
        team_view: teamView,
        total_sessions: sessionsRows.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare GET live timer:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la obținerea sesiunilor active' },
      { status: 500 }
    );
  }
}

// POST - Acțiuni timer (start, stop, pause, resume)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, proiect_id, sarcina_id, session_id, descriere_sesiune, utilizator_uid } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action este obligatoriu' }, { status: 400 });
    }

    let result: any = {};

    switch (action) {
      case 'start':
        if (!proiect_id || !utilizator_uid) {
          return NextResponse.json({ 
            error: 'proiect_id și utilizator_uid sunt obligatorii pentru start' 
          }, { status: 400 });
        }
      // Normalizare sarcina_id pentru BigQuery compatibility
	let processedSarcinaId = sarcina_id;
	if (!sarcina_id || sarcina_id === 'general' || sarcina_id === 'default_task') {
	  processedSarcinaId = 'activitate_generala'; // String în loc de NULL
	}

        // Verific dacă utilizatorul are deja o sesiune activă
        const checkActiveQuery = `
          SELECT id FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          WHERE utilizator_uid = @utilizator_uid
            AND status IN ('activ', 'pausat')
        `;

        const [activeCheck] = await bigquery.query({
          query: checkActiveQuery,
          location: 'EU',
          params: { utilizator_uid: utilizator_uid }
        });

        if (activeCheck.length > 0) {
          return NextResponse.json({ 
            error: 'Există deja o sesiune activă. Oprește sesiunea curentă înainte de a începe una nouă.' 
          }, { status: 400 });
        }

        // Obțin contextul proiectului pentru a determina tipul
        let projectContext;
        try {
          projectContext = await getProjectContext(proiect_id);
        } catch (error) {
          return NextResponse.json({ 
            error: `Proiectul/Subproiectul specificat nu există: ${proiect_id}` 
          }, { status: 400 });
        }

        // Creez sesiunea nouă
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Construiesc descrierea completă
        let finalDescription = descriere_sesiune || 'Sesiune de lucru';
        if (sarcina_id && sarcina_id !== 'general') {
          try {
            // Încerc să obțin titlul sarcinii
            const sarcinaQuery = `
              SELECT titlu FROM \`hale-mode-464009-i6.PanouControlUnitar.Sarcini\`
              WHERE id = @sarcina_id
            `;
            const [sarcinaRows] = await bigquery.query({
              query: sarcinaQuery,
              location: 'EU',
              params: { sarcina_id: sarcina_id }
            });
            
            if (sarcinaRows.length > 0) {
              const sarcinaTitlu = extractBigQueryValue(sarcinaRows[0].titlu);
              finalDescription = `${finalDescription} - ${sarcinaTitlu}`;
            }
          } catch (error) {
            console.warn('Nu s-a putut obține titlul sarcinii:', error);
          }
        }
        
        const insertSessionQuery = `
          INSERT INTO \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          (id, utilizator_uid, proiect_id, data_start, status, descriere_activitate, created_at, ore_lucrate)
          VALUES (@sessionId, @utilizator_uid, @proiect_id, CURRENT_TIMESTAMP(), 'activ', @descriere_sesiune, CURRENT_TIMESTAMP(), NULL)
        `;

        await bigquery.query({
	  query: insertSessionQuery,
	  location: 'EU',
	  params: {
	    sessionId: sessionId,
	    utilizator_uid: utilizator_uid,
	    proiect_id: proiect_id,
	    descriere_sesiune: finalDescription
	  },
	  types: {
	    sessionId: 'STRING',
	    utilizator_uid: 'STRING',
	    proiect_id: 'STRING',
	    descriere_sesiune: 'STRING'
	  }
	});

        result = {
          session: {
            id: sessionId,
            utilizator_uid: utilizator_uid,
            proiect_id: proiect_id,
            sarcina_id: sarcina_id || null,
            status: 'activ',
            data_start: new Date().toISOString(),
            elapsed_seconds: 0,
            descriere_sesiune: finalDescription,
            project_context: projectContext
          }
        };
        break;

      case 'stop':
        if (!session_id) {
          return NextResponse.json({ error: 'session_id este obligatoriu pentru stop' }, { status: 400 });
        }

        // Obțin datele sesiunii pentru calcule
        const getSessionQuery = `
          SELECT 
            sl.id,
            sl.utilizator_uid,
            sl.proiect_id,
            sl.data_start,
            sl.data_stop,
            sl.descriere_activitate,
            COALESCE(CONCAT(u.nume, ' ', u.prenume), 'Test User') as utilizator_nume
          FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\` sl
          LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u 
            ON sl.utilizator_uid = u.uid
          WHERE sl.id = @session_id
        `;

        const [sessionData] = await bigquery.query({
          query: getSessionQuery,
          location: 'EU',
          params: { session_id: session_id }
        });

        if (sessionData.length === 0) {
          return NextResponse.json({ error: 'Sesiunea nu a fost găsită' }, { status: 404 });
        }

        const session = processBigQueryRows(sessionData)[0];
        const currentTimestamp = new Date();
        
        // Calculez ore lucrate ca string pentru NUMERIC
        const startTime = new Date(session.data_start);
        const workedHoursString = calculateWorkedHoursAsString(startTime.toISOString(), currentTimestamp.toISOString());

        // Opresc sesiunea
        const stopSessionQuery = `
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          SET
            status = 'completat',
            data_stop = CURRENT_TIMESTAMP(),
            ore_lucrate = CAST(@ore_lucrate AS NUMERIC)
          WHERE id = @session_id
        `;

        await bigquery.query({
          query: stopSessionQuery,
          location: 'EU',
          params: { 
            session_id: session_id,
            ore_lucrate: workedHoursString
          }
        });

        // Determin contextul pentru TimeTracking
        let sessionProjectContext;
        try {
          sessionProjectContext = await getProjectContext(session.proiect_id);
        } catch (error) {
          console.warn('Nu s-a putut determina contextul proiectului pentru TimeTracking:', error);
          sessionProjectContext = { tip_proiect: 'proiect', nume_complet: 'Proiect necunoscut' };
        }

        // Creez înregistrarea în TimeTracking cu logica corectă pentru proiect_id și subproiect_id
        const timeTrackingId = `tt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const insertTimeTrackingQuery = `
          INSERT INTO \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\`
          (id, utilizator_uid, utilizator_nume, proiect_id, subproiect_id, data_lucru, ore_lucrate, descriere_lucru, tip_inregistrare, created_at, sarcina_id)
          VALUES (
            @id,
            @utilizator_uid,
            @utilizator_nume,
            @proiect_id,
            @subproiect_id,
            CURRENT_DATE(),
            CAST(@ore_lucrate AS NUMERIC),
            @descriere_lucru,
            'live_timer',
            CURRENT_TIMESTAMP(),
            'live_session'
          )
        `;

        // Construiește params și types pentru a gestiona NULL values
	const queryParams: any = {
	  id: timeTrackingId,
	  utilizator_uid: session.utilizator_uid,
	  utilizator_nume: session.utilizator_nume,
	  proiect_id: sessionProjectContext.tip_proiect === 'subproiect' 
	    ? sessionProjectContext.proiect_principal_id 
	    : session.proiect_id,
	  ore_lucrate: workedHoursString,
	  descriere_lucru: session.descriere_activitate || 'Sesiune Live Timer',
	  sarcina_id: processedSarcinaId || 'activitate_generala'
	};

	const queryTypes: any = {
	  id: 'STRING',
	  utilizator_uid: 'STRING',
	  utilizator_nume: 'STRING',
	  proiect_id: 'STRING',
	  ore_lucrate: 'STRING',
	  descriere_lucru: 'STRING',
	  sarcina_id: 'STRING'
	};

	// Gestionează subproiect_id care poate fi NULL
	if (sessionProjectContext.tip_proiect === 'subproiect') {
	  queryParams.subproiect_id = session.proiect_id;
	  queryTypes.subproiect_id = 'STRING';
	}

	await bigquery.query({
	  query: insertTimeTrackingQuery,
	  location: 'EU',
	  params: queryParams,
	  types: queryTypes
	});

        result = { 
          message: 'Sesiune oprită și timp înregistrat cu succes',
          worked_hours: parseFloat(workedHoursString),
          time_tracking_id: timeTrackingId,
          project_context: sessionProjectContext
        };
        break;

      case 'pause':
        if (!session_id) {
          return NextResponse.json({ error: 'session_id este obligatoriu pentru pause' }, { status: 400 });
        }

        const pauseSessionQuery = `
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          SET
            status = 'pausat',
            data_stop = CURRENT_TIMESTAMP()
          WHERE id = @session_id AND status = 'activ'
        `;

        await bigquery.query({
          query: pauseSessionQuery,
          location: 'EU',
          params: { session_id: session_id }
        });

        result = { message: 'Sesiune pusă în pauză' };
        break;

      case 'resume':
        if (!session_id) {
          return NextResponse.json({ error: 'session_id este obligatoriu pentru resume' }, { status: 400 });
        }

        const resumeSessionQuery = `
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          SET
            status = 'activ',
            data_stop = NULL
          WHERE id = @session_id AND status = 'pausat'
        `;

        await bigquery.query({
          query: resumeSessionQuery,
          location: 'EU',
          params: { session_id: session_id }
        });

        result = { message: 'Sesiune reluată' };
        break;

      case 'update_description':
        if (!session_id || !descriere_sesiune) {
          return NextResponse.json({ 
            error: 'session_id și descriere_sesiune sunt obligatorii pentru update' 
          }, { status: 400 });
        }

        const updateDescriptionQuery = `
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          SET descriere_activitate = @descriere_sesiune
          WHERE id = @session_id
        `;

        await bigquery.query({
          query: updateDescriptionQuery,
          location: 'EU',
          params: { 
            session_id: session_id,
            descriere_sesiune: descriere_sesiune 
          }
        });

        result = { message: 'Descriere actualizată' };
        break;

      default:
        return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action: action,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Eroare POST live timer:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la procesarea acțiunii timer' },
      { status: 500 }
    );
  }
}

// DELETE - Anulare sesiune (fără înregistrare timp)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id este obligatoriu' }, { status: 400 });
    }

    const deleteSessionQuery = `
      DELETE FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
      WHERE id = @session_id AND status IN ('activ', 'pausat')
    `;

    await bigquery.query({
      query: deleteSessionQuery,
      location: 'EU',
      params: { session_id: sessionId }
    });

    return NextResponse.json({
      success: true,
      message: 'Sesiune anulată (fără înregistrare timp)',
      deleted_session_id: sessionId
    });

  } catch (error) {
    console.error('Eroare DELETE live timer:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la anularea sesiunii' },
      { status: 500 }
    );
  }
}
