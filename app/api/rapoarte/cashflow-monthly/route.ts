// ==================================================================
// CALEA: app/api/rapoarte/cashflow-monthly/route.ts
// DATA: 01.05.2026 (Faza 1 mobil)
// DESCRIERE: Returnează datele lunare pentru graficul mobil dashboard:
//            facturi emise, încasări (intrări), plăți (ieșiri) — ultimele 12 luni.
// FUNCȚIONALITATE: Citește FacturiGenerate_v2 + TranzactiiBancare_v2,
//                  agregare lunară, totaluri în RON.
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_FACTURI = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_TRANZACTII = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

interface MonthlyRow {
  year_month: string;
  facturi_emise: number;
  incasari: number;
  plati: number;
}

export async function GET(_request: NextRequest) {
  try {
    const monthsBack = 12;

    // Construim un calendar de 12 luni (luna curentă + 11 anterioare) pentru a avea
    // și lunile fără date. CTE separat folosit cu LEFT JOIN.
    const query = `
      WITH calendar AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL m MONTH), MONTH)) AS year_month
        FROM UNNEST(GENERATE_ARRAY(0, ${monthsBack - 1})) AS m
      ),
      facturi_lunar AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE_TRUNC(data_factura, MONTH)) AS year_month,
          SUM(COALESCE(total, 0)) AS facturi_emise
        FROM ${TABLE_FACTURI}
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL ${monthsBack} MONTH)
          AND data_factura IS NOT NULL
        GROUP BY year_month
      ),
      tranzactii_lunar AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE_TRUNC(data_procesare, MONTH)) AS year_month,
          SUM(CASE WHEN directie = 'intrare' THEN suma ELSE 0 END) AS incasari,
          SUM(CASE WHEN directie = 'iesire' THEN ABS(suma) ELSE 0 END) AS plati
        FROM ${TABLE_TRANZACTII}
        WHERE data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY year_month
      )
      SELECT
        c.year_month,
        COALESCE(f.facturi_emise, 0) AS facturi_emise,
        COALESCE(t.incasari, 0) AS incasari,
        COALESCE(t.plati, 0) AS plati
      FROM calendar c
      LEFT JOIN facturi_lunar f ON f.year_month = c.year_month
      LEFT JOIN tranzactii_lunar t ON t.year_month = c.year_month
      ORDER BY c.year_month ASC
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    const data: MonthlyRow[] = rows.map((row: any) => ({
      year_month: row.year_month,
      facturi_emise: Number(row.facturi_emise) || 0,
      incasari: Number(row.incasari) || 0,
      plati: Number(row.plati) || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Eroare cashflow-monthly:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Eroare la încărcarea datelor lunare',
        details: error instanceof Error ? error.message : 'Eroare necunoscută',
      },
      { status: 500 }
    );
  }
}
