import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabelă cu suffix dinamic
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;

console.log(`🔧 Facturi Last Number API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: FacturiGenerate${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { serie, separator, pattern } = await request.json();
    
    // Query pentru ultimul număr folosit cu această serie
    const query = `
      SELECT 
        numar,
        CAST(
          REGEXP_EXTRACT(
            numar, 
            r'${serie}${separator}([0-9]+)'
          ) AS INT64
        ) as numar_extras
      FROM ${TABLE_FACTURI_GENERATE}
      WHERE numar LIKE '${serie}${separator}%'
      ORDER BY numar_extras DESC NULLS LAST
      LIMIT 1
    `;

    console.log('Query ultimul număr:', query);

    const [rows] = await bigquery.query({
      query,
      location: 'EU'
    });

    if (rows.length > 0 && rows[0].numar_extras) {
      console.log(`✅ Ultimul număr găsit: ${rows[0].numar} (extras: ${rows[0].numar_extras})`);
      
      return NextResponse.json({
        success: true,
        lastNumber: rows[0].numar_extras,
        lastInvoice: rows[0].numar
      });
    }

    // Dacă nu găsim niciun număr, începem de la 1001
    console.log('ℹ️ Nu s-a găsit niciun număr anterior, începem de la 1001');
    
    return NextResponse.json({
      success: true,
      lastNumber: 1000, // Va deveni 1001
      lastInvoice: null
    });

  } catch (error) {
    console.error('Eroare la obținerea ultimului număr:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea ultimului număr',
      lastNumber: 1000 // Fallback
    }, { status: 500 });
  }
}
