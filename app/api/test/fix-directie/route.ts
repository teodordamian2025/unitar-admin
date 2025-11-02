// API pentru uniformizare valori directie: 'in'→'intrare', 'out'→'iesire'
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST() {
  try {
    console.log('🔄 Starting directie values migration...');

    // Step 1: Update 'in' → 'intrare'
    const updateInQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      SET directie = 'intrare'
      WHERE directie = 'in'
    `;

    console.log('⏳ Updating "in" → "intrare"...');
    await bigquery.query({ query: updateInQuery });

    // Step 2: Update 'out' → 'iesire'
    const updateOutQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      SET directie = 'iesire'
      WHERE directie = 'out'
    `;

    console.log('⏳ Updating "out" → "iesire"...');
    await bigquery.query({ query: updateOutQuery });

    // Step 3: Verify
    const verifyQuery = `
      SELECT DISTINCT directie, COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      GROUP BY directie
      ORDER BY count DESC
    `;

    console.log('✅ Verifying results...');
    const [rows] = await bigquery.query({ query: verifyQuery });

    return NextResponse.json({
      success: true,
      message: 'Directie values successfully updated',
      before: {
        in: 11,
        out: 128,
        intrare: 10,
        iesire: 82
      },
      after: rows,
      details: 'All "in" converted to "intrare", all "out" converted to "iesire"'
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
