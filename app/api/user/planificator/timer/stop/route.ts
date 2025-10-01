// ==================================================================
// CALEA: app/api/user/planificator/timer/stop/route.ts
// DATA: 30.09.2025 00:46 (ora României)
// DESCRIERE: API stop timer pentru utilizatori normali
// FUNCȚIONALITATE: Oprește timer activ pentru utilizatori normali
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

console.log(`🔧 [Stop] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Găsește sesiunea activă pentru utilizator din SesiuniLucru (nu TimeTracking!)
    const findActiveQuery = `
      SELECT id, data_start, proiect_id, descriere_activitate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.SesiuniLucru\`
      WHERE utilizator_uid = ?
        AND (status = 'activ' OR status = 'activa' OR status = 'pausat')
      ORDER BY data_start DESC
      LIMIT 1
    `;

    const [activeRows] = await bigquery.query({
      query: findActiveQuery,
      location: 'EU',
      params: [userId]
    });

    if (activeRows.length === 0) {
      return NextResponse.json({ error: 'No active timer session found' }, { status: 404 });
    }

    const activeSession = activeRows[0];
    const startTime = new Date(activeSession.data_start.value || activeSession.data_start);
    const endTime = new Date();
    const workedMilliseconds = endTime.getTime() - startTime.getTime();
    const workedHours = workedMilliseconds / (1000 * 60 * 60); // Convert to hours
    const workedHoursString = (Math.round(workedHours * 100) / 100).toString(); // String for NUMERIC

    // Minimum 1 minute requirement
    if (workedHours < (1/60)) { // Less than 1 minute
      return NextResponse.json({
        error: 'Timer session must be at least 1 minute long'
      }, { status: 400 });
    }

    // 1. Update sesiunea ca finalizată în SesiuniLucru
    const updateSessionQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.SesiuniLucru\`
      SET
        status = 'completat',
        data_stop = CURRENT_TIMESTAMP(),
        ore_lucrate = CAST(@ore_lucrate AS NUMERIC)
      WHERE id = @session_id AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateSessionQuery,
      location: 'EU',
      params: {
        session_id: activeSession.id,
        userId: userId,
        ore_lucrate: workedHoursString
      }
    });

    // 2. Obține numele utilizatorului pentru TimeTracking
    let utilizatorNume = 'User';
    try {
      const userQuery = `
        SELECT CONCAT(nume, ' ', prenume) as nume_complet
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Utilizatori\`
        WHERE uid = ?
      `;
      const [userRows] = await bigquery.query({
        query: userQuery,
        location: 'EU',
        params: [userId]
      });
      if (userRows.length > 0) {
        utilizatorNume = userRows[0].nume_complet || 'User';
      }
    } catch (error) {
      console.warn('Could not fetch user name:', error);
    }

    // 3. Creează înregistrarea în TimeTracking (ca la celelalte cronometrele)
    const timeTrackingId = `tt_planificator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insertTimeTrackingQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.TimeTracking\`
      (id, utilizator_uid, utilizator_nume, proiect_id, data_lucru, ore_lucrate, descriere_lucru, tip_inregistrare, created_at, sarcina_id)
      VALUES (
        @id,
        @utilizator_uid,
        @utilizator_nume,
        @proiect_id,
        CURRENT_DATE(),
        CAST(@ore_lucrate AS NUMERIC),
        @descriere_lucru,
        'planificator_timer',
        CURRENT_TIMESTAMP(),
        'activitate_generala'
      )
    `;

    await bigquery.query({
      query: insertTimeTrackingQuery,
      location: 'EU',
      params: {
        id: timeTrackingId,
        utilizator_uid: userId,
        utilizator_nume: utilizatorNume,
        proiect_id: activeSession.proiect_id,
        ore_lucrate: workedHoursString,
        descriere_lucru: activeSession.descriere_activitate || 'Sesiune Planificator'
      },
      types: {
        id: 'STRING',
        utilizator_uid: 'STRING',
        utilizator_nume: 'STRING',
        proiect_id: 'STRING',
        ore_lucrate: 'STRING',
        descriere_lucru: 'STRING'
      }
    });

    // Obține numele proiectului pentru răspuns
    let projectName = 'Unknown Project';
    try {
      const projectQuery = `
        SELECT Denumire
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Proiecte\`
        WHERE ID_Proiect = ?
      `;

      const [projectRows] = await bigquery.query({
        query: projectQuery,
        location: 'EU',
        params: [activeSession.proiect_id]
      });

      if (projectRows.length > 0) {
        projectName = projectRows[0].Denumire;
      }
    } catch (error) {
      console.warn('Could not fetch project name:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Timer stopped and saved to both tables successfully',
      session_id: activeSession.id,
      time_tracking_id: timeTrackingId,
      worked_hours: Math.round(workedHours * 100) / 100,
      project_id: activeSession.proiect_id,
      project_name: projectName,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });

  } catch (error) {
    console.error('Error stopping timer for normal user:', error);
    return NextResponse.json(
      { error: 'Failed to stop timer' },
      { status: 500 }
    );
  }
}