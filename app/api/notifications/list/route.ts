// CALEA: /app/api/notifications/list/route.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: API pentru listare notificări cu filtrare și paginare

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type {
  ListNotificationsResponse,
  Notificare,
  TipNotificare,
} from '@/lib/notifications/types';
import { extractDateValue } from '@/lib/notifications/types';

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
// GET: Lista notificări cu filtrare
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parametri
    const user_id = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const citita = searchParams.get('citita'); // "true", "false", sau null pentru toate
    const tip_notificare = searchParams.get('tip_notificare');
    const data_start = searchParams.get('data_start');
    const data_end = searchParams.get('data_end');

    // Validare
    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    if (limit > 200) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 200' },
        { status: 400 }
      );
    }

    // Build WHERE conditions
    const conditions: string[] = ['user_id = @user_id'];
    const params: Record<string, any> = { user_id };

    if (citita !== null) {
      conditions.push('citita = @citita');
      params.citita = citita === 'true';
    }

    if (tip_notificare) {
      conditions.push('tip_notificare = @tip_notificare');
      params.tip_notificare = tip_notificare;
    }

    if (data_start) {
      conditions.push('data_creare >= @data_start');
      params.data_start = data_start;
    }

    if (data_end) {
      conditions.push('data_creare <= @data_end');
      params.data_end = data_end;
    }

    const whereClause = conditions.join(' AND ');

    // Query pentru notificări
    const notificationsQuery = `
      SELECT *
      FROM ${TABLE_NOTIFICARI}
      WHERE ${whereClause}
      ORDER BY data_creare DESC, data_citire DESC
      LIMIT @limit
      OFFSET @offset
    `;

    const [notificationRows] = await bigquery.query({
      query: notificationsQuery,
      params: {
        ...params,
        limit,
        offset,
      },
    });

    // Query pentru total count
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM ${TABLE_NOTIFICARI}
      WHERE ${whereClause}
    `;

    const [countRows] = await bigquery.query({
      query: countQuery,
      params,
    });

    // Query pentru unread count
    const unreadQuery = `
      SELECT COUNT(*) as unread_count
      FROM ${TABLE_NOTIFICARI}
      WHERE user_id = @user_id AND citita = false
    `;

    const [unreadRows] = await bigquery.query({
      query: unreadQuery,
      params: { user_id },
    });

    const total_count = countRows[0]?.total_count || 0;
    const unread_count = unreadRows[0]?.unread_count || 0;

    // Parse continut_json pentru fiecare notificare
    const notifications: Notificare[] = notificationRows.map((row: any) => ({
      ...row,
      continut_json: typeof row.continut_json === 'string'
        ? JSON.parse(row.continut_json)
        : row.continut_json,
    }));

    const response: ListNotificationsResponse = {
      notifications,
      total_count,
      unread_count,
      has_more: offset + notificationRows.length < total_count,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ List notifications error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
