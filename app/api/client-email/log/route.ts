// ==================================================================
// CALEA: /app/api/client-email/log/route.ts
// DATA: 29.01.2026
// DESCRIERE: API pentru jurnalul email-urilor trimise către clienți
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TABLE_EMAIL_LOG = `\`${PROJECT_ID}.${DATASET}.EmailClientLog_v2\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Lista email-uri trimise
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');
    const clientId = searchParams.get('client_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `SELECT * FROM ${TABLE_EMAIL_LOG}`;
    const conditions: string[] = [];
    const params: any = {};

    if (proiectId) {
      conditions.push('proiect_id = @proiectId');
      params.proiectId = proiectId;
    }

    if (clientId) {
      conditions.push('client_id = @clientId');
      params.clientId = clientId;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY data_trimitere DESC LIMIT @limit OFFSET @offset`;
    params.limit = limit;
    params.offset = offset;

    const [rows] = await bigquery.query({
      query,
      params,
      location: 'EU',
    });

    // Count total
    let countQuery = `SELECT COUNT(*) as total FROM ${TABLE_EMAIL_LOG}`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countParams = { ...params };
    delete countParams.limit;
    delete countParams.offset;

    const [countResult] = await bigquery.query({
      query: countQuery,
      params: countParams,
      location: 'EU',
    });

    const total = countResult[0]?.total || 0;

    // Parse destinatari JSON
    const formattedRows = rows.map((row: any) => ({
      ...row,
      destinatari: row.destinatari ? JSON.parse(row.destinatari) : []
    }));

    return NextResponse.json({
      success: true,
      data: formattedRows,
      count: rows.length,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Eroare la încărcarea jurnalului email:', error);
    return NextResponse.json({
      error: 'Eroare la încărcarea jurnalului email',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
