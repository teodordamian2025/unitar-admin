// app/api/ai/memory/route.ts
// API pentru memoria persistentă a agentului AI (CRUD pe AI_Memory_v2)

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
const TABLE = 'AI_Memory_v2';

// GET - Recall memories (căutare cu filtre)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    const tip_memorie = searchParams.get('tip_memorie');
    const search = searchParams.get('search');
    const include_global = searchParams.get('include_global') !== 'false'; // default true
    const reminders_only = searchParams.get('reminders_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'user_id este obligatoriu' }, { status: 400 });
    }

    const conditions: string[] = ['activ = TRUE'];
    const params: any[] = [];

    // User memories + global
    if (include_global) {
      conditions.push(`(user_id = ? OR user_id = 'global')`);
      params.push(user_id);
    } else {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    // Exclude expired
    conditions.push(`(expira_la IS NULL OR expira_la > CURRENT_TIMESTAMP())`);

    if (entity_type) {
      conditions.push('entity_type = ?');
      params.push(entity_type);
    }
    if (entity_id) {
      conditions.push('entity_id = ?');
      params.push(entity_id);
    }
    if (tip_memorie) {
      conditions.push('tip_memorie = ?');
      params.push(tip_memorie);
    }
    if (reminders_only) {
      conditions.push(`tip_memorie = 'reminder'`);
      conditions.push('reminder_executat = FALSE');
      conditions.push(`reminder_data <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())`);
    }
    if (search) {
      conditions.push(`(LOWER(continut) LIKE LOWER(?) OR LOWER(tags) LIKE LOWER(?))`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    const query = `
      SELECT id, user_id, entity_type, entity_id, tip_memorie, continut, tags,
             prioritate, reminder_data, reminder_executat, creat_de,
             creat_la, actualizat_la
      FROM \`${DATASET}.${TABLE}\`
      WHERE ${conditions.join(' AND ')}
      ORDER BY prioritate DESC, creat_la DESC
      LIMIT ${limit}
    `;

    const [rows] = await bigquery.query({ query, params });

    return NextResponse.json({
      success: true,
      memories: rows || [],
      count: (rows || []).length,
    });

  } catch (error: any) {
    console.error('Eroare recall memory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la citire memorie' },
      { status: 500 }
    );
  }
}

// POST - Save memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, entity_type, entity_id, tip_memorie, continut, tags, prioritate, expira_la, reminder_data, creat_de } = body;

    if (!user_id || !continut || !tip_memorie) {
      return NextResponse.json(
        { success: false, error: 'Parametri obligatorii: user_id, tip_memorie, continut' },
        { status: 400 }
      );
    }

    const validTypes = ['nota', 'decizie', 'preferinta', 'reminder', 'context'];
    if (!validTypes.includes(tip_memorie)) {
      return NextResponse.json(
        { success: false, error: `tip_memorie invalid. Permise: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (tip_memorie === 'reminder' && !reminder_data) {
      return NextResponse.json(
        { success: false, error: 'reminder_data este obligatoriu pentru tip_memorie=reminder (format YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const id = `MEM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const row = {
      id,
      user_id,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      tip_memorie,
      continut,
      tags: tags || null,
      prioritate: prioritate || 5,
      activ: true,
      expira_la: expira_la ? new Date(expira_la).toISOString() : null,
      reminder_data: reminder_data || null,
      reminder_executat: false,
      creat_de: creat_de || 'ai_agent',
      creat_la: now,
      actualizat_la: now,
      data_creare: BigQuery.date(today),
    };

    await bigquery.dataset(DATASET).table(TABLE).insert([row]);

    return NextResponse.json({
      success: true,
      message: 'Memorie salvată cu succes',
      memoryId: id,
    });

  } catch (error: any) {
    console.error('Eroare save memory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la salvare memorie' },
      { status: 500 }
    );
  }
}

// PUT - Update memory (mark reminder as done, update content, deactivate)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, continut, prioritate, activ, reminder_executat, tags } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id este obligatoriu' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (continut !== undefined) {
      updates.push('continut = ?');
      params.push(continut);
    }
    if (prioritate !== undefined) {
      updates.push('prioritate = ?');
      params.push(prioritate);
    }
    if (activ !== undefined) {
      updates.push('activ = ?');
      params.push(activ);
    }
    if (reminder_executat !== undefined) {
      updates.push('reminder_executat = ?');
      params.push(reminder_executat);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Niciun câmp de actualizat' },
        { status: 400 }
      );
    }

    updates.push('actualizat_la = CURRENT_TIMESTAMP()');
    params.push(id);

    const query = `
      UPDATE \`${DATASET}.${TABLE}\`
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await bigquery.query({ query, params });

    return NextResponse.json({
      success: true,
      message: 'Memorie actualizată cu succes',
    });

  } catch (error: any) {
    console.error('Eroare update memory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la actualizare memorie' },
      { status: 500 }
    );
  }
}
