// app/api/ai/triggers/route.ts
// API pentru triggers/reacții proactive ale agentului AI
// GET - listare triggers active pentru un user
// POST - creare trigger nou (de la hook-uri sau AI)
// PUT - update status trigger (acceptat, refuzat, amânat)

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = 'PanouControlUnitar';
const TABLE = 'AI_Triggers_v2';

// GET - Listare triggers active pentru un user (folosit de context injection + UI)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status') || 'activ';
    const include_scheduled = searchParams.get('include_scheduled') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'user_id este obligatoriu' }, { status: 400 });
    }

    let statusFilter = '';
    if (status === 'all') {
      statusFilter = `status IN ('activ', 'afisat', 'amanat')`;
    } else {
      statusFilter = `status = '${status}'`;
    }

    // Triggers imediate + programate cu data <= azi
    const scheduleFilter = include_scheduled
      ? `AND (programare_data IS NULL OR programare_data <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE()))`
      : `AND programare_data IS NULL`;

    // Include și triggers amânate cu data expirată
    const amanatFilter = `OR (status = 'amanat' AND amanat_pana_la IS NOT NULL AND amanat_pana_la <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE()))`;

    const query = `
      SELECT id, tip_trigger, eveniment, actiune_sugerata, mesaj_utilizator,
             user_id, entity_type, entity_id, entity_name, context_json,
             prioritate, status, programare_data, amanat_pana_la,
             creat_de, creat_la
      FROM \`${DATASET}.${TABLE}\`
      WHERE user_id = @user_id
        AND ((${statusFilter} ${scheduleFilter}) ${amanatFilter})
      ORDER BY prioritate DESC, creat_la DESC
      LIMIT @limit
    `;

    const [rows] = await bigquery.query({
      query,
      params: { user_id, limit },
    });

    return NextResponse.json({
      success: true,
      triggers: rows || [],
      count: (rows || []).length,
    });

  } catch (error: any) {
    console.error('Eroare listare triggers:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la listare triggers' },
      { status: 500 }
    );
  }
}

// POST - Creare trigger nou
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tip_trigger, eveniment, actiune_sugerata, mesaj_utilizator,
      user_id, entity_type, entity_id, entity_name,
      context_json, prioritate, programare_data, creat_de
    } = body;

    if (!tip_trigger || !eveniment || !actiune_sugerata || !mesaj_utilizator || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Parametri obligatorii: tip_trigger, eveniment, actiune_sugerata, mesaj_utilizator, user_id' },
        { status: 400 }
      );
    }

    // Verifică dacă există deja un trigger activ similar (evită duplicate)
    const checkQuery = `
      SELECT COUNT(*) as cnt FROM \`${DATASET}.${TABLE}\`
      WHERE user_id = @user_id
        AND eveniment = @eveniment
        AND entity_id = @entity_id
        AND status IN ('activ', 'afisat')
    `;
    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { user_id, eveniment, entity_id: entity_id || '' },
    });

    if (checkRows[0]?.cnt > 0) {
      return NextResponse.json({
        success: true,
        message: 'Trigger similar deja existent - nu s-a creat duplicat',
        duplicate: true,
      });
    }

    const id = `TRIG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const row = {
      id,
      tip_trigger,
      eveniment,
      actiune_sugerata,
      mesaj_utilizator,
      user_id,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      entity_name: entity_name || null,
      context_json: context_json ? JSON.stringify(context_json) : null,
      prioritate: prioritate || 5,
      status: 'activ',
      programare_data: programare_data || null,
      amanat_pana_la: null,
      raspuns_utilizator: null,
      creat_de: creat_de || 'system',
      procesat_la: null,
      creat_la: now,
      actualizat_la: now,
      data_creare: BigQuery.date(today),
    };

    await bigquery.dataset(DATASET).table(TABLE).insert([row]);

    return NextResponse.json({
      success: true,
      message: 'Trigger creat cu succes',
      triggerId: id,
    });

  } catch (error: any) {
    console.error('Eroare creare trigger:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la creare trigger' },
      { status: 500 }
    );
  }
}

// PUT - Update status trigger (acceptat, refuzat, amânat)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, raspuns_utilizator, amanat_pana_la } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Parametri obligatorii: id, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['activ', 'afisat', 'acceptat', 'refuzat', 'amanat', 'executat', 'expirat'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status invalid. Permise: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updates: string[] = [`status = '${status}'`, 'actualizat_la = CURRENT_TIMESTAMP()'];
    if (raspuns_utilizator) {
      updates.push(`raspuns_utilizator = '${raspuns_utilizator.replace(/'/g, "\\'")}'`);
    }
    if (status === 'amanat' && amanat_pana_la) {
      updates.push(`amanat_pana_la = '${amanat_pana_la}'`);
    }
    if (['acceptat', 'refuzat', 'executat'].includes(status)) {
      updates.push('procesat_la = CURRENT_TIMESTAMP()');
    }

    const query = `
      UPDATE \`${DATASET}.${TABLE}\`
      SET ${updates.join(', ')}
      WHERE id = @id
    `;

    await bigquery.query({ query, params: { id } });

    return NextResponse.json({
      success: true,
      message: `Trigger actualizat: ${status}`,
    });

  } catch (error: any) {
    console.error('Eroare update trigger:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la actualizare trigger' },
      { status: 500 }
    );
  }
}
