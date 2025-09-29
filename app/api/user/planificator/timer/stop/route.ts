// ==================================================================
// CALEA: app/api/user/planificator/timer/stop/route.ts
// DATA: 30.09.2025 00:46 (ora României)
// DESCRIERE: API stop timer pentru utilizatori normali
// FUNCȚIONALITATE: Oprește timer activ pentru utilizatori normali
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = 'PanouControlUnitar';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Găsește sesiunea activă pentru utilizator
    const findActiveQuery = `
      SELECT id, data_start, proiect_id, descriere_sesiune
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.TimeTracking\`
      WHERE utilizator_uid = @userId
        AND (status = 'activ' OR status = 'activa' OR status = 'pausat')
      ORDER BY data_start DESC
      LIMIT 1
    `;

    const [activeRows] = await bigquery.query({
      query: findActiveQuery,
      params: { userId }
    });

    if (activeRows.length === 0) {
      return NextResponse.json({ error: 'No active timer session found' }, { status: 404 });
    }

    const activeSession = activeRows[0];
    const startTime = new Date(activeSession.data_start.value || activeSession.data_start);
    const endTime = new Date();
    const workedMilliseconds = endTime.getTime() - startTime.getTime();
    const workedHours = workedMilliseconds / (1000 * 60 * 60); // Convert to hours

    // Minimum 1 minute requirement
    if (workedHours < (1/60)) { // Less than 1 minute
      return NextResponse.json({
        error: 'Timer session must be at least 1 minute long'
      }, { status: 400 });
    }

    // Update sesiunea ca finalizată
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.TimeTracking\`
      SET
        status = 'finalizat',
        data_end = CURRENT_TIMESTAMP(),
        ore_lucrate = @workedHours,
        rate_per_hour = 0,
        valoare_totala = 0,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @sessionId AND utilizator_uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        sessionId: activeSession.id,
        userId,
        workedHours
      }
    });

    // Obține numele proiectului pentru răspuns
    let projectName = 'Unknown Project';
    try {
      const projectQuery = `
        SELECT Nume
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\`
        WHERE id = @projectId AND utilizator_uid = @userId
      `;

      const [projectRows] = await bigquery.query({
        query: projectQuery,
        params: { projectId: activeSession.proiect_id, userId }
      });

      if (projectRows.length > 0) {
        projectName = projectRows[0].Nume;
      }
    } catch (error) {
      console.warn('Could not fetch project name:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Timer stopped successfully',
      session_id: activeSession.id,
      worked_hours: Math.round(workedHours * 100) / 100, // Round to 2 decimal places
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