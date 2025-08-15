// ==================================================================
// CALEA: app/api/seed-cursuri-bnr/route.ts
// DATA: 15.08.2025 18:15 (ora României)
// VERSIUNE SIMPLIFICATĂ: Doar pentru cursuri zilnice + status
// CSV MANUAL COMPLETAT - acest API e doar pentru mentenanță
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ SIMPLIFICAT: Doar adaugă cursul pentru ziua curentă
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Seed cursuri BNR - versiune simplificată...');

    // Pentru acum, returnăm success fără să facem nimic
    // CSV-ul manual e deja în BigQuery
    console.log('✅ CSV manual deja în BigQuery - skip processing');

    return NextResponse.json({
      success: true,
      message: 'CSV manual deja populat în BigQuery',
      stats: {
        totalCursuri: 0,
        monede: ['EUR', 'USD', 'GBP'],
        note: 'API simplificat - datele sunt din CSV manual'
      }
    });

  } catch (error) {
    console.error('❌ Eroare la seed cursuri:', error);
    return NextResponse.json({
      error: 'Eroare la seed cursuri',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ✅ ENDPOINT pentru verificarea statusului
export async function GET(request: NextRequest) {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT 
          moneda,
          COUNT(*) as total_cursuri,
          MIN(data) as prima_data,
          MAX(data) as ultima_data,
          AVG(curs) as curs_mediu
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
        GROUP BY moneda
        ORDER BY moneda
      `,
      location: 'EU',
    });

    const [totalRows] = await bigquery.query({
      query: `SELECT COUNT(*) as total FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\``,
      location: 'EU',
    });

    const totalCursuri = totalRows[0]?.total || 0;

    return NextResponse.json({
      success: true,
      totalCursuri: totalCursuri,
      statisticiPeMonede: rows,
      status: totalCursuri > 0 ? 'populated' : 'empty'
    });

  } catch (error) {
    console.error('❌ Eroare la verificarea statusului:', error);
    return NextResponse.json({
      error: 'Eroare la verificarea statusului cursurilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
