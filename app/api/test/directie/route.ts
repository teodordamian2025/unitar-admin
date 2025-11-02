// Test API pentru verificare valori directie
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

export async function GET() {
  try {
    const query = `
      SELECT DISTINCT directie, COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      GROUP BY directie
      ORDER BY count DESC
      LIMIT 10
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json({
      success: true,
      data: rows,
      message: 'Valori distincte din coloana directie'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
