// ==================================================================
// CALEA: app/api/planificator/timer/start/route.ts
// DATA: 27.09.2025 16:45 (ora României)
// DESCRIERE: API pentru pornirea timer-ului din planificator
// FUNCȚIONALITATE: POST start timer cu integrare SesiuniLucru și pin activ
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
// Simple authentication pattern consistent with existing APIs
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const DATASET_ID = 'PanouControlUnitar';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    // For development - in production this should verify Firebase token
    const userId = 'demo_user_id';

    const body = await request.json();
    const { planificator_item_id, descriere_activitate } = body;

    if (!planificator_item_id) {
      return NextResponse.json(
        { error: 'Missing planificator_item_id' },
        { status: 400 }
      );
    }

    // Găsește item-ul din planificator și datele asociate
    const planificatorQuery = `
      SELECT
        p.id,
        p.tip_item,
        p.item_id,
        p.is_pinned,

        -- Date proiecte
        pr.ID_Proiect as proiect_id,
        pr.Denumire as proiect_nume,

        -- Date subproiecte (iau proiectul părinte)
        sp.ID_Proiect as subproiect_proiect_id,
        sp.Denumire as subproiect_nume,
        pr2.Denumire as subproiect_proiect_nume,

        -- Date sarcini
        s.id as sarcina_id,
        s.titlu as sarcina_nume,
        s.proiect_id as sarcina_proiect_id,
        pr3.Denumire as sarcina_proiect_nume

      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` p

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr
        ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` sp
        ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr2
        ON sp.ID_Proiect = pr2.ID_Proiect

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        ON p.tip_item = 'sarcina' AND p.item_id = s.id
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr3
        ON s.proiect_id = pr3.ID_Proiect

      WHERE p.id = @planificator_item_id
        AND p.utilizator_uid = @userId
        AND p.activ = TRUE
    `;

    const [planificatorRows] = await bigquery.query({
      query: planificatorQuery,
      params: { planificator_item_id, userId }
    });

    if (planificatorRows.length === 0) {
      return NextResponse.json(
        { error: 'Planificator item not found or unauthorized' },
        { status: 404 }
      );
    }

    const item = planificatorRows[0];

    // Determină proiect_id și descrierea pentru sesiunea de lucru
    let finalProiectId = null;
    let finalDescriereActivitate = descriere_activitate || '';

    if (item.tip_item === 'proiect') {
      finalProiectId = item.proiect_id;
      finalDescriereActivitate = finalDescriereActivitate || `Lucrez la proiectul: ${item.proiect_nume}`;
    } else if (item.tip_item === 'subproiect') {
      finalProiectId = item.subproiect_proiect_id;
      finalDescriereActivitate = finalDescriereActivitate || `Lucrez la subproiectul: ${item.subproiect_nume} (${item.subproiect_proiect_nume})`;
    } else if (item.tip_item === 'sarcina') {
      finalProiectId = item.sarcina_proiect_id;
      finalDescriereActivitate = finalDescriereActivitate || `Lucrez la sarcina: ${item.sarcina_nume} (${item.sarcina_proiect_nume})`;
    }

    if (!finalProiectId) {
      return NextResponse.json(
        { error: 'Cannot determine project ID for timer session' },
        { status: 400 }
      );
    }

    // Verifică dacă utilizatorul are deja o sesiune activă
    const activeSessionQuery = `
      SELECT id, proiect_id, data_start, descriere_activitate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SesiuniLucru\`
      WHERE utilizator_uid = @userId
        AND data_stop IS NULL
        AND status = 'activa'
      ORDER BY data_start DESC
      LIMIT 1
    `;

    const [activeSessionRows] = await bigquery.query({
      query: activeSessionQuery,
      params: { userId }
    });

    // Dacă are sesiune activă, o oprește
    if (activeSessionRows.length > 0) {
      const activeSession = activeSessionRows[0];

      const stopSessionQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SesiuniLucru\`
        SET
          data_stop = CURRENT_TIMESTAMP(),
          ore_lucrate = TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), data_start, SECOND) / 3600.0,
          status = 'finalizata'
        WHERE id = @sessionId
      `;

      await bigquery.query({
        query: stopSessionQuery,
        params: { sessionId: activeSession.id }
      });
    }

    // Generare ID pentru noua sesiune
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Creează o nouă sesiune de lucru
    const createSessionQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SesiuniLucru\`
      (id, utilizator_uid, proiect_id, data_start, descriere_activitate, status, created_at)
      VALUES (@sessionId, @userId, @proiectId, CURRENT_TIMESTAMP(), @descriereActivitate, 'activa', CURRENT_TIMESTAMP())
    `;

    await bigquery.query({
      query: createSessionQuery,
      params: {
        sessionId,
        userId,
        proiectId: finalProiectId,
        descriereActivitate: finalDescriereActivitate
      }
    });

    // Dacă item-ul nu este deja pin-at, îl pin-ează automat
    if (!item.is_pinned) {
      // Elimină pin-ul de la toate celelalte items
      const unpinAllQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\`
        SET is_pinned = FALSE, data_actualizare = CURRENT_TIMESTAMP()
        WHERE utilizator_uid = @userId AND is_pinned = TRUE AND activ = TRUE
      `;

      await bigquery.query({
        query: unpinAllQuery,
        params: { userId }
      });

      // Pin-ează item-ul curent
      const pinCurrentQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\`
        SET is_pinned = TRUE, data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @planificator_item_id AND utilizator_uid = @userId
      `;

      await bigquery.query({
        query: pinCurrentQuery,
        params: { planificator_item_id, userId }
      });
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      proiect_id: finalProiectId,
      descriere_activitate: finalDescriereActivitate,
      item_pinned: true,
      previous_session_stopped: activeSessionRows.length > 0,
      message: 'Timer started successfully'
    });

  } catch (error) {
    console.error('Error starting timer from planificator:', error);
    return NextResponse.json(
      { error: 'Failed to start timer from planificator' },
      { status: 500 }
    );
  }
}