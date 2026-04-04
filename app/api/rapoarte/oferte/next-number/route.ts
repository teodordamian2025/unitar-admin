// ==================================================================
// CALEA: app/api/rapoarte/oferte/next-number/route.ts
// DATA: 04.04.2026
// DESCRIERE: Generare numar secvential pentru oferte (OF-YYYY-NNNN)
// ==================================================================

import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;

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
    const year = new Date().getFullYear();

    const [rows] = await bigquery.query({
      query: `
        SELECT MAX(CAST(REGEXP_EXTRACT(numar_oferta, r'OF-\\d{4}-(\\d+)') AS INT64)) as max_num
        FROM ${TABLE_OFERTE}
        WHERE serie_oferta = 'OF'
          AND EXTRACT(YEAR FROM data_creare) = ${year}
      `,
      location: 'EU',
    });

    const maxNum = rows[0]?.max_num ? parseInt(String(rows[0].max_num)) : 0;
    const nextNum = maxNum + 1;
    const numar_oferta = `OF-${year}-${String(nextNum).padStart(4, '0')}`;

    return NextResponse.json({
      success: true,
      numar_oferta,
      next_number: nextNum,
      year,
    });

  } catch (error) {
    console.error('Eroare next-number oferte:', error);
    return NextResponse.json({
      error: 'Eroare la generarea numarului de oferta',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
