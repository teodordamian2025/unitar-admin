// ==================================================================
// CALEA: app/api/planificator/timer/start/route.ts
// DATA: 27.09.2025 16:45 (ora României)
// DESCRIERE: API pentru pornirea timer-ului din planificator
// FUNCȚIONALITATE: POST start timer cu integrare SesiuniLucru și pin activ
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

    // Decodează token-ul Firebase și obține UID-ul real al utilizatorului
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

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
        pr3.Denumire as sarcina_proiect_nume,
        s.subproiect_id as sarcina_subproiect_id,
        s_sub.Denumire as sarcina_subproiect_nume

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
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` s_sub
        ON s.subproiect_id = s_sub.ID_Subproiect

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

    // Determină proiect_id și construiește titlul ierarhic standard
    let finalProiectId = null;
    let finalDescriereActivitate = descriere_activitate || '';
    let titluIerarhic = '';

    if (item.tip_item === 'proiect') {
      finalProiectId = item.proiect_id;
      titluIerarhic = `${item.proiect_id} - ${item.proiect_nume}`;
    } else if (item.tip_item === 'subproiect') {
      finalProiectId = item.subproiect_proiect_id;
      titluIerarhic = `${item.subproiect_proiect_id} → ${item.subproiect_nume}`;
    } else if (item.tip_item === 'sarcina') {
      finalProiectId = item.sarcina_proiect_id;
      // Construiește titlul cu hierarhia completă pentru sarcină
      if (item.sarcina_subproiect_id && item.sarcina_subproiect_nume) {
        // Sarcină la nivel de subproiect: proiect_id → subproiect_denumire → sarcina_titlu
        titluIerarhic = `${item.sarcina_proiect_id} → ${item.sarcina_subproiect_nume} → ${item.sarcina_nume}`;
      } else {
        // Sarcină la nivel de proiect: proiect_id → sarcina_titlu
        titluIerarhic = `${item.sarcina_proiect_id} → ${item.sarcina_nume}`;
      }
    }

    // Dacă nu s-a trimis descriere din planificator, folosește titlul ierarhic
    if (!finalDescriereActivitate) {
      finalDescriereActivitate = titluIerarhic;
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
          ore_lucrate = CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), data_start, SECOND) / 3600.0 AS NUMERIC),
          status = 'completat'
        WHERE id = @sessionId
      `;

      await bigquery.query({
        query: stopSessionQuery,
        params: { sessionId: activeSession.id }
      });
    }

    // Generare ID pentru noua sesiune
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Creează o nouă sesiune de lucru compatibilă cu live-timer
    const createSessionQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.SesiuniLucru\`
      (id, utilizator_uid, proiect_id, data_start, descriere_activitate, status, created_at)
      VALUES (@sessionId, @userId, @proiectId, CURRENT_TIMESTAMP(), @descriereActivitate, 'activ', CURRENT_TIMESTAMP())
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

    // Timer și Pin sunt acum independente - nu mai se dă pin automat

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      proiect_id: finalProiectId,
      descriere_activitate: finalDescriereActivitate,
      titlu_ierarhic: titluIerarhic, // Titlu standardizat pentru afișare
      item_pinned: item.is_pinned, // Returnează starea reală de pin
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