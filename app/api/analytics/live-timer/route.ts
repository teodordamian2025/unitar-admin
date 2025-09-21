// ==================================================================
// CALEA: app/api/analytics/live-timer/route.ts
// CREAT: 21.09.2025 21:30 (ora României)
// DESCRIERE: API pentru management live timer sessions cu real-time tracking - CORECTAT
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

// GET - Obținere sesiuni active și statistici
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const includeCompleted = searchParams.get('include_completed') === 'true';
    const teamView = searchParams.get('team_view') !== 'false';

    // Query optimizat pentru sesiuni active
    const activeSessionsQuery = `
      WITH active_sessions AS (
        SELECT 
          sl.id,
          sl.utilizator_uid,
          COALESCE(CONCAT(u.nume, ' ', u.prenume), 'Test User') as utilizator_nume,
          sl.proiect_id,
          COALESCE(p.Denumire, 'Proiect necunoscut') as proiect_nume,
          sl.descriere_activitate as sarcina_titlu,
          'normala' as prioritate,
          sl.data_start,
          sl.data_stop,
          sl.status,
          sl.descriere_activitate as descriere_sesiune,
          
          -- Calculez timpul elapsed în secunde
          CASE
            WHEN sl.status = 'activ' THEN
              TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sl.data_start, SECOND)
            WHEN sl.status = 'pausat' AND sl.data_stop IS NOT NULL THEN
              TIMESTAMP_DIFF(sl.data_stop, sl.data_start, SECOND)
            WHEN sl.status = 'completat' AND sl.data_stop IS NOT NULL THEN
              TIMESTAMP_DIFF(sl.data_stop, sl.data_start, SECOND)
            ELSE 0
          END as timp_elapsed_seconds,

          -- Ultima activitate
          COALESCE(sl.data_stop, sl.data_start) as ultima_activitate,
          
          -- Calculez productivitatea
          CASE 
            WHEN sl.status = 'activ' THEN 85
            WHEN sl.status = 'pausat' THEN 50
            ELSE 65
          END as productivity_score,
          
          -- Break time calculation
          CASE
            WHEN sl.status = 'pausat' THEN
              TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), COALESCE(sl.data_stop, sl.data_start), SECOND)
            ELSE 0
          END as break_time_seconds
          
        FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\` sl
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u 
          ON sl.utilizator_uid = u.uid
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p 
          ON sl.proiect_id = p.ID_Proiect
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
        timp_elapsed_seconds as elapsed_seconds,
        ultima_activitate,
        productivity_score,
        break_time_seconds as break_time,
        
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
          COALESCE(p2.Denumire, 'Proiect necunoscut') as proiect_nume,
          sl2.descriere_activitate as sarcina_titlu, 
          'normala' as prioritate, 
          sl2.data_start, 
          sl2.data_stop,
          'completat' as status, 
          sl2.descriere_activitate as descriere_sesiune,
          TIMESTAMP_DIFF(sl2.data_stop, sl2.data_start, SECOND) as elapsed_seconds,
          sl2.data_stop as ultima_activitate, 
          85 as productivity_score, 
          0 as break_time,
          FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', sl2.data_start) as data_start_formatted,
          FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', sl2.data_stop) as ultima_activitate_formatted
        FROM \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\` sl2
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u2 
          ON sl2.utilizator_uid = u2.uid
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p2 
          ON sl2.proiect_id = p2.ID_Proiect
        WHERE sl2.status = 'completat'
          AND sl2.data_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)
          ${userId ? `AND sl2.utilizator_uid = @userId` : ''}
      ` : ''}
    `;

    const queryOptions: any = {
      query: activeSessionsQuery,
      location: 'EU'
    };

    // Adăug parametrii doar dacă userId există
    if (userId) {
      queryOptions.params = { userId: userId };
    }

    const [sessionsRows] = await bigquery.query(queryOptions);

    // Calculez statistici pentru dashboard
    const stats = {
      total_active_sessions: sessionsRows.filter((s: any) => s.status === 'activ').length,
      total_paused_sessions: sessionsRows.filter((s: any) => s.status === 'pausat').length,
      total_users_online: new Set(
        sessionsRows.filter((s: any) => s.status === 'activ').map((s: any) => s.utilizator_uid)
      ).size,
      total_time_today: sessionsRows.reduce((sum: number, s: any) => sum + (s.elapsed_seconds || 0), 0),
      total_hours_today: sessionsRows.reduce((sum: number, s: any) => sum + (s.elapsed_seconds || 0), 0) / 3600,
      avg_session_length: sessionsRows.length > 0 ? 
        sessionsRows.reduce((sum: number, s: any) => sum + (s.elapsed_seconds || 0), 0) / sessionsRows.length : 0,
      avg_session_duration: sessionsRows.length > 0 ? 
        (sessionsRows.reduce((sum: number, s: any) => sum + (s.elapsed_seconds || 0), 0) / sessionsRows.length) / 60 : 0,
      
      // Utilizatorul cel mai activ
      most_active_user: sessionsRows.length > 0 ? 
        sessionsRows.reduce((prev: any, current: any) => 
          (prev.elapsed_seconds || 0) > (current.elapsed_seconds || 0) ? prev : current
        ).utilizator_nume : '',
        
      // Proiectul cel mai activ
      most_active_project: (() => {
        const projectTimes = sessionsRows.reduce((acc: any, session: any) => {
          const projectName = session.proiect_nume || 'Necunoscut';
          acc[projectName] = (acc[projectName] || 0) + (session.elapsed_seconds || 0);
          return acc;
        }, {});
        
        return Object.keys(projectTimes).length > 0 ? 
          Object.keys(projectTimes).reduce((a, b) => projectTimes[a] > projectTimes[b] ? a : b) : '';
      })(),
      
      break_time_total: sessionsRows.reduce((sum: number, s: any) => sum + (s.break_time || 0), 0),
      productivity_avg: sessionsRows.length > 0 ? 
        sessionsRows.reduce((sum: number, s: any) => sum + (s.productivity_score || 0), 0) / sessionsRows.length : 0,
        
      // Active users count
      active_users_count: new Set(
        sessionsRows.filter((s: any) => s.status === 'activ').map((s: any) => s.utilizator_uid)
      ).size,
      
      // Longest session today
      longest_session: sessionsRows.length > 0 ? Math.max(...sessionsRows.map((s: any) => s.elapsed_seconds || 0)) : 0
    };

    // IMPORTANT: Returnez "data" în loc de "active_sessions" pentru compatibilitatea cu frontend-ul
    return NextResponse.json({
      success: true,
      data: sessionsRows, // Schimbat din active_sessions
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

        // Creez sesiunea nouă
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
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
            descriere_sesiune: descriere_sesiune || 'Sesiune de lucru'
          }
        });

        result = {
          session: {
            id: sessionId,
            utilizator_uid: utilizator_uid,
            proiect_id: proiect_id,
            status: 'activ',
            data_start: new Date().toISOString(),
            elapsed_seconds: 0
          }
        };
        break;

      case 'stop':
        if (!session_id) {
          return NextResponse.json({ error: 'session_id este obligatoriu pentru stop' }, { status: 400 });
        }

        // Opresc sesiunea
        const stopSessionQuery = `
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.SesiuniLucru\`
          SET
            status = 'completat',
            data_stop = CURRENT_TIMESTAMP()
          WHERE id = @session_id
        `;

        await bigquery.query({
          query: stopSessionQuery,
          location: 'EU',
          params: { session_id: session_id }
        });

        result = { message: 'Sesiune oprită și timp înregistrat cu succes' };
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
