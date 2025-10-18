// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/config/route.ts
// DATA: 18.10.2025 (ora României)
// DESCRIERE: API CRUD pentru configurație Smart Fintech
// FUNCȚIONALITATE: GET - citire config, POST - salvare/update config
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';
import { encryptToken, decryptToken } from '@/lib/smartfintech-api';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

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

// ==================== GET - Load config ====================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = await getUserIdFromToken(authHeader);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check if user is admin
    // For now, allow all authenticated users

    const query = `
      SELECT
        id,
        client_id,
        is_active,
        ultima_sincronizare,
        ultima_eroare,
        numar_conturi,
        data_creare,
        data_actualizare
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return NextResponse.json(
        { config: null, message: 'No configuration found' },
        { status: 404 }
      );
    }

    const config = rows[0];

    // Format dates (handle BigQuery DATE objects)
    const formatDate = (date: any) => {
      if (!date) return null;
      if (date.value) return new Date(date.value).toISOString();
      return new Date(date).toISOString();
    };

    return NextResponse.json({
      config: {
        id: config.id,
        client_id: config.client_id,
        is_active: config.is_active,
        ultima_sincronizare: formatDate(config.ultima_sincronizare),
        ultima_eroare: config.ultima_eroare || null,
        numar_conturi: config.numar_conturi || 0,
        data_creare: formatDate(config.data_creare),
        data_actualizare: formatDate(config.data_actualizare)
      }
    });

  } catch (error: any) {
    console.error('Error loading Smart Fintech config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

// ==================== POST - Save/Update config ====================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = await getUserIdFromToken(authHeader);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check if user is admin

    const body = await request.json();
    const { client_id, client_secret } = body;

    if (!client_id || !client_secret) {
      return NextResponse.json(
        { error: 'Client ID and Client Secret are required' },
        { status: 400 }
      );
    }

    // Check dacă există configurație activă
    const checkQuery = `
      SELECT id
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({ query: checkQuery });

    if (existingRows.length > 0) {
      // UPDATE configurație existentă
      const configId = existingRows[0].id;

      const updateQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        SET
          client_id = @client_id,
          client_secret = @client_secret,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `;

      await bigquery.query({
        query: updateQuery,
        params: {
          id: configId,
          client_id,
          client_secret: encryptToken(client_secret)
        }
      });

      console.log('✅ [Config] Updated existing configuration');

      return NextResponse.json({
        success: true,
        message: 'Configuration updated successfully',
        config_id: configId
      });

    } else {
      // INSERT configurație nouă
      const newId = `smartfintech_${Date.now()}`;

      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        (id, client_id, client_secret, is_active, data_creare, data_actualizare, creat_de)
        VALUES (@id, @client_id, @client_secret, TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), @userId)
      `;

      await bigquery.query({
        query: insertQuery,
        params: {
          id: newId,
          client_id,
          client_secret: encryptToken(client_secret),
          userId
        }
      });

      console.log('✅ [Config] Created new configuration');

      return NextResponse.json({
        success: true,
        message: 'Configuration created successfully',
        config_id: newId
      });
    }

  } catch (error: any) {
    console.error('Error saving Smart Fintech config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
