// ==================================================================
// CALEA: app/api/planificator/timer/stop/route.ts
// DATA: 29.09.2025 18:00 (ora României)
// DESCRIERE: API pentru oprirea timer-ului din planificator
// FUNCȚIONALITATE: Direct BigQuery operations pentru evitarea HTTP internal calls
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

    // Verifică autentificarea Firebase
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Găsește sesiunea activă direct din BigQuery
    const activeSessionQuery = `
      SELECT id, proiect_id, data_start, descriere_activitate, status
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.SesiuniLucru\`
      WHERE utilizator_uid = @userId
        AND data_stop IS NULL
        AND status IN ('activa', 'activ', 'pausat')
      ORDER BY data_start DESC
      LIMIT 1
    `;

    const [activeSessionRows] = await bigquery.query({
      query: activeSessionQuery,
      params: { userId }
    });

    if (activeSessionRows.length === 0) {
      return NextResponse.json({ error: 'No active timer session found' }, { status: 404 });
    }

    const activeSession = activeSessionRows[0];

    // Oprește sesiunea direct în BigQuery
    const stopSessionQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.SesiuniLucru\`
      SET
        data_stop = CURRENT_TIMESTAMP(),
        ore_lucrate = CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), data_start, SECOND) / 3600.0 AS NUMERIC),
        status = 'completat'
      WHERE id = @sessionId
    `;

    await bigquery.query({
      query: stopSessionQuery,
      params: { sessionId: activeSession.id }
    });

    // Calculează orele lucrate pentru răspuns
    const workedSeconds = Math.floor((new Date().getTime() - new Date(activeSession.data_start.value || activeSession.data_start).getTime()) / 1000);
    const workedHours = workedSeconds / 3600;

    return NextResponse.json({
      success: true,
      message: 'Timer stopped successfully from planificator',
      session_id: activeSession.id,
      worked_hours: workedHours,
      project_context: {
        proiect_id: activeSession.proiect_id,
        descriere_activitate: activeSession.descriere_activitate
      }
    });

  } catch (error) {
    console.error('Error stopping timer from planificator:', error);
    return NextResponse.json(
      { error: 'Failed to stop timer from planificator' },
      { status: 500 }
    );
  }
}