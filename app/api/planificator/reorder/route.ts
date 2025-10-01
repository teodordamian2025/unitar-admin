// ==================================================================
// CALEA: app/api/planificator/reorder/route.ts
// DATA: 27.09.2025 16:35 (ora României)
// DESCRIERE: API pentru reordonare drag & drop în planificator
// FUNCȚIONALITATE: POST batch update pentru ordinea items
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
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

console.log(`🔧 [Reorder] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing or invalid items array' }, { status: 400 });
    }

    // Validare că toate items au id și ordine_pozitie
    for (const item of items) {
      if (!item.id || item.ordine_pozitie === undefined) {
        return NextResponse.json(
          { error: 'Each item must have id and ordine_pozitie' },
          { status: 400 }
        );
      }
    }

    // Verifică că toate items aparțin utilizatorului curent
    const itemIds = items.map(item => item.id);
    const checkQuery = `
      SELECT id, utilizator_uid
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      WHERE id IN UNNEST(@itemIds) AND activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { itemIds }
    });

    if (checkRows.length !== items.length) {
      return NextResponse.json({ error: 'Some items not found' }, { status: 404 });
    }

    // Verifică că toate items aparțin utilizatorului
    const unauthorizedItems = checkRows.filter((row: any) => row.utilizator_uid !== userId);
    if (unauthorizedItems.length > 0) {
      return NextResponse.json(
        { error: 'Unauthorized to reorder some items' },
        { status: 403 }
      );
    }

    // Batch update folosind MERGE statement pentru performance
    const mergeQuery = `
      MERGE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\` AS target
      USING UNNEST([
        ${items.map(item =>
          `STRUCT("${item.id}" AS id, ${item.ordine_pozitie} AS ordine_pozitie)`
        ).join(',\n        ')}
      ]) AS source
      ON target.id = source.id AND target.utilizator_uid = @userId
      WHEN MATCHED THEN
        UPDATE SET
          ordine_pozitie = source.ordine_pozitie,
          data_actualizare = CURRENT_TIMESTAMP()
    `;

    await bigquery.query({
      query: mergeQuery,
      params: { userId }
    });

    return NextResponse.json({
      success: true,
      updated_count: items.length,
      message: 'Items reordered successfully'
    });

  } catch (error) {
    console.error('Error reordering planificator items:', error);
    return NextResponse.json(
      { error: 'Failed to reorder planificator items' },
      { status: 500 }
    );
  }
}