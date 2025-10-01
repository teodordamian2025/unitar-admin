// ==================================================================
// CALEA: app/api/analytics/sarcina-proiect/route.ts
// DATA: 30.09.2025 14:35 (ora României)
// DESCRIERE: API pentru a obține proiect_id dintr-o sarcină
// FUNCȚIONALITATE: Găsește proiect_id (sau subproiect_id) pentru o sarcină
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

console.log(`🔧 Sarcina Proiect API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: Sarcini${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = DATASET;

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
    const { sarcina_id } = body;

    if (!sarcina_id) {
      return NextResponse.json({ error: 'sarcina_id is required' }, { status: 400 });
    }

    // Obține proiect_id și subproiect_id din tabela Sarcini
    const sarcinaQuery = `
      SELECT proiect_id, subproiect_id
      FROM \`${TABLE_SARCINI}\`
      WHERE id = @sarcina_id
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: sarcinaQuery,
      location: 'EU',
      params: { sarcina_id }
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Sarcina not found' }, { status: 404 });
    }

    const sarcina = rows[0];

    // Dacă are subproiect_id, returnează subproiect_id, altfel proiect_id
    const finalProiectId = sarcina.subproiect_id || sarcina.proiect_id;

    return NextResponse.json({
      success: true,
      proiect_id: finalProiectId,
      has_subproiect: !!sarcina.subproiect_id
    });

  } catch (error) {
    console.error('Error fetching sarcina proiect_id:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sarcina proiect_id' },
      { status: 500 }
    );
  }
}