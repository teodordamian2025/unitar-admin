// CALEA: /app/api/notifications/settings/route.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: API pentru CRUD setări notificări (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';
import type {
  NotificareSetting,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@/lib/notifications/types';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_NOTIFICARI_SETARI = `\`${PROJECT_ID}.${DATASET}.NotificariSetari${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =====================================================
// HELPER: Verifică dacă user e admin
// =====================================================

async function isUserAdmin(user_id: string): Promise<boolean> {
  const query = `
    SELECT rol
    FROM ${TABLE_UTILIZATORI}
    WHERE uid = @user_id
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { user_id },
  });

  return rows.length > 0 && rows[0].rol === 'admin';
}

// =====================================================
// GET: Lista toate setările
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const activ_only = searchParams.get('activ_only') === 'true';
    const categorie = searchParams.get('categorie');

    // Verificare admin (opțional pentru GET - putem permite citire)
    if (user_id) {
      const isAdmin = await isUserAdmin(user_id);
      if (!isAdmin) {
        // Permitem citirea setărilor active pentru toți utilizatorii
        // return NextResponse.json(
        //   { error: 'Unauthorized: Admin access required' },
        //   { status: 403 }
        // );
      }
    }

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (activ_only) {
      conditions.push('activ = true');
    }

    if (categorie) {
      conditions.push('categorie = @categorie');
      params.categorie = categorie;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM ${TABLE_NOTIFICARI_SETARI}
      ${whereClause}
      ORDER BY categorie, tip_notificare
    `;

    const [rows] = await bigquery.query({
      query,
      params,
    });

    return NextResponse.json({
      success: true,
      settings: rows,
      count: rows.length,
    });

  } catch (error: any) {
    console.error('❌ Get settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT: Update setare existentă (admin only)
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateSettingsRequest = await request.json();
    const { setting_id, updates, user_id } = body;

    // Validare
    if (!setting_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: setting_id, user_id' },
        { status: 400 }
      );
    }

    // Verificare admin
    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Build UPDATE fields
    const updateFields: string[] = [];
    const params: Record<string, any> = { setting_id, user_id };

    if (updates.activ !== undefined) {
      updateFields.push('activ = @activ');
      params.activ = updates.activ;
    }

    if (updates.canal_email !== undefined) {
      updateFields.push('canal_email = @canal_email');
      params.canal_email = updates.canal_email;
    }

    if (updates.canal_clopotel !== undefined) {
      updateFields.push('canal_clopotel = @canal_clopotel');
      params.canal_clopotel = updates.canal_clopotel;
    }

    if (updates.canal_push !== undefined) {
      updateFields.push('canal_push = @canal_push');
      params.canal_push = updates.canal_push;
    }

    if (updates.template_subiect) {
      updateFields.push('template_subiect = @template_subiect');
      params.template_subiect = updates.template_subiect;
    }

    if (updates.template_continut) {
      updateFields.push('template_continut = @template_continut');
      params.template_continut = updates.template_continut;
    }

    if (updates.template_html) {
      updateFields.push('template_html = @template_html');
      params.template_html = updates.template_html;
    }

    if (updates.destinatari_rol) {
      updateFields.push('destinatari_rol = @destinatari_rol');
      params.destinatari_rol = updates.destinatari_rol;
    }

    if (updates.conditii_json) {
      updateFields.push('conditii_json = @conditii_json');
      params.conditii_json = JSON.stringify(updates.conditii_json);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    // Add metadata updates
    updateFields.push('data_modificare = CURRENT_TIMESTAMP()');
    updateFields.push('modificat_de = @user_id');
    updateFields.push('versiune = versiune + 1');

    const updateQuery = `
      UPDATE ${TABLE_NOTIFICARI_SETARI}
      SET ${updateFields.join(', ')}
      WHERE id = @setting_id
    `;

    await bigquery.query({
      query: updateQuery,
      params,
    });

    // Fetch updated setting
    const selectQuery = `
      SELECT *
      FROM ${TABLE_NOTIFICARI_SETARI}
      WHERE id = @setting_id
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: selectQuery,
      params: { setting_id },
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Setting not found after update' },
        { status: 404 }
      );
    }

    const response: UpdateSettingsResponse = {
      success: true,
      updated_setting: rows[0],
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Update settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST: Creare setare nouă (admin only)
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...settingData } = body;

    // Validare
    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id' },
        { status: 400 }
      );
    }

    if (!settingData.tip_notificare || !settingData.nume_setare) {
      return NextResponse.json(
        { error: 'Missing required fields: tip_notificare, nume_setare' },
        { status: 400 }
      );
    }

    // Verificare admin
    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Creare ID nou
    const setting_id = uuidv4();

    const insertQuery = `
      INSERT INTO ${TABLE_NOTIFICARI_SETARI} (
        id, tip_notificare, nume_setare, descriere, categorie,
        activ, canal_email, canal_clopotel, canal_push,
        template_subiect, template_continut, template_html,
        destinatari_rol, exclude_creator, conditii_json,
        data_creare, data_modificare, modificat_de, versiune
      ) VALUES (
        @id, @tip_notificare, @nume_setare, @descriere, @categorie,
        @activ, @canal_email, @canal_clopotel, @canal_push,
        @template_subiect, @template_continut, @template_html,
        @destinatari_rol, @exclude_creator, @conditii_json,
        CURRENT_DATE(), CURRENT_TIMESTAMP(), @user_id, 1
      )
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: setting_id,
        tip_notificare: settingData.tip_notificare,
        nume_setare: settingData.nume_setare,
        descriere: settingData.descriere || null,
        categorie: settingData.categorie || 'sistem',
        activ: settingData.activ !== false,
        canal_email: settingData.canal_email !== false,
        canal_clopotel: settingData.canal_clopotel !== false,
        canal_push: settingData.canal_push || false,
        template_subiect: settingData.template_subiect || '',
        template_continut: settingData.template_continut || '',
        template_html: settingData.template_html || '',
        destinatari_rol: settingData.destinatari_rol || ['admin', 'normal'],
        exclude_creator: settingData.exclude_creator !== false,
        conditii_json: JSON.stringify(settingData.conditii_json || {}),
        user_id,
      },
    });

    // Fetch created setting
    const selectQuery = `
      SELECT *
      FROM ${TABLE_NOTIFICARI_SETARI}
      WHERE id = @setting_id
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: selectQuery,
      params: { setting_id },
    });

    return NextResponse.json({
      success: true,
      created_setting: rows[0],
    });

  } catch (error: any) {
    console.error('❌ Create settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
