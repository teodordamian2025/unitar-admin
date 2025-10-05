// CALEA: /app/api/notifications/mark-read/route.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: API pentru marcare notificări ca citite

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type { MarkReadRequest, MarkReadResponse } from '@/lib/notifications/types';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_NOTIFICARI = `\`${PROJECT_ID}.${DATASET}.Notificari${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =====================================================
// POST: Marchează notificări ca citite
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body: MarkReadRequest = await request.json();
    const { notification_ids, user_id } = body;

    // Validare
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid notification_ids array' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    // Update notificări ca citite
    const updateQuery = `
      UPDATE ${TABLE_NOTIFICARI}
      SET citita = true,
          data_citire = CURRENT_TIMESTAMP()
      WHERE id IN UNNEST(@notification_ids)
        AND user_id = @user_id
        AND citita = false
    `;

    const [job] = await bigquery.query({
      query: updateQuery,
      params: {
        notification_ids,
        user_id,
      },
    });

    // BigQuery nu returnează număr de rânduri updatate direct
    // Verificăm cu un SELECT câte au fost updatate
    const verifyQuery = `
      SELECT COUNT(*) as marked_count
      FROM ${TABLE_NOTIFICARI}
      WHERE id IN UNNEST(@notification_ids)
        AND user_id = @user_id
        AND citita = true
    `;

    const [rows] = await bigquery.query({
      query: verifyQuery,
      params: {
        notification_ids,
        user_id,
      },
    });

    const marked_count = rows[0]?.marked_count || 0;

    const response: MarkReadResponse = {
      success: true,
      marked_count,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Mark read error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT: Marchează TOATE notificările ca citite pentru user
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    // Update toate notificările necitite
    const updateQuery = `
      UPDATE ${TABLE_NOTIFICARI}
      SET citita = true,
          data_citire = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id
        AND citita = false
    `;

    await bigquery.query({
      query: updateQuery,
      params: { user_id },
    });

    // Verifică câte au fost updatate
    const verifyQuery = `
      SELECT COUNT(*) as marked_count
      FROM ${TABLE_NOTIFICARI}
      WHERE user_id = @user_id
        AND citita = true
        AND data_citire >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MINUTE)
    `;

    const [rows] = await bigquery.query({
      query: verifyQuery,
      params: { user_id },
    });

    const marked_count = rows[0]?.marked_count || 0;

    const response: MarkReadResponse = {
      success: true,
      marked_count,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Mark all read error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
