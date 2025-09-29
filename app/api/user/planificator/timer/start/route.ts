// ==================================================================
// CALEA: app/api/user/planificator/timer/start/route.ts
// DATA: 30.09.2025 00:45 (ora României)
// DESCRIERE: API start timer pentru utilizatori normali
// FUNCȚIONALITATE: Pornește timer pentru item planificator utilizatori normali
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

    const body = await request.json();
    const { planificator_item_id, descriere_activitate } = body;

    if (!planificator_item_id || !descriere_activitate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verifică că item-ul aparține utilizatorului
    const validateQuery = `
      SELECT id, tip_item, item_id
      FROM \`hale-mode-464009-i6.${DATASET_ID}.PlanificatorPersonal\`
      WHERE id = ? AND utilizator_uid = ?
    `;

    const [validateRows] = await bigquery.query({
      query: validateQuery,
      location: 'EU',
      params: [planificator_item_id, userId]
    });

    if (validateRows.length === 0) {
      return NextResponse.json({ error: 'Item not found or access denied' }, { status: 404 });
    }

    const planificatorItem = validateRows[0];

    // Verifică dacă există deja o sesiune activă pentru acest utilizator
    const checkActiveQuery = `
      SELECT id
      FROM \`hale-mode-464009-i6.${DATASET_ID}.SesiuniLucru\`
      WHERE utilizator_uid = ?
        AND (status = 'activ' OR status = 'activa' OR status = 'pausat')
      LIMIT 1
    `;

    const [activeRows] = await bigquery.query({
      query: checkActiveQuery,
      location: 'EU',
      params: [userId]
    });

    if (activeRows.length > 0) {
      return NextResponse.json({ error: 'You already have an active timer session today' }, { status: 400 });
    }

    // Generează session ID unic
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determină proiect_id bazat pe tip_item
    let proiect_id = planificatorItem.item_id;

    if (planificatorItem.tip_item === 'sarcina') {
      // Pentru sarcini, obține proiect_id din tabela Sarcini
      const taskQuery = `
        SELECT Proiect_ID
        FROM \`hale-mode-464009-i6.${DATASET_ID}.Sarcini\`
        WHERE id = ? AND utilizator_uid = ?
      `;

      const [taskRows] = await bigquery.query({
        query: taskQuery,
        location: 'EU',
        params: [planificatorItem.item_id, userId]
      });

      if (taskRows.length > 0) {
        proiect_id = taskRows[0].Proiect_ID;
      }
    }

    // Creează sesiunea de timer în SesiuniLucru
    const insertQuery = `
      INSERT INTO \`hale-mode-464009-i6.${DATASET_ID}.SesiuniLucru\`
      (id, utilizator_uid, proiect_id, data_start, status, descriere_activitate, created_at)
      VALUES
      (?, ?, ?, CURRENT_TIMESTAMP(), 'activ', ?, CURRENT_TIMESTAMP())
    `;

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
      params: [sessionId, userId, proiect_id, descriere_activitate]
    });

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      message: 'Timer started successfully',
      project_id: proiect_id,
      description: descriere_activitate
    });

  } catch (error) {
    console.error('Error starting timer for normal user:', error);
    return NextResponse.json(
      { error: 'Failed to start timer' },
      { status: 500 }
    );
  }
}