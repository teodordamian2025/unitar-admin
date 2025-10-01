// ==================================================================
// CALEA: app/api/user/dashboard/route.ts
// DATA: 21.09.2025 16:30 (ora României)
// DESCRIERE: API dashboard pentru utilizatori normali - date nefinanciare
// FUNCȚIONALITATE: Statistici proiecte, time tracking, sarcini fără informații financiare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

console.log(`🔧 User Dashboard API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, TimeTracking${tableSuffix}, Sarcini${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function GET(request: NextRequest) {
  try {
    console.log('Loading user dashboard statistics...');

    // Obține statistici pentru utilizatori normali - fără date financiare
    const proiecteStats = await getUserProiecteStats();
    const timeTrackingStats = await getUserTimeTrackingStats();
    const sarciniiStats = await getUserSarciniiStats();

    const stats = {
      proiecte: proiecteStats,
      timeTracking: timeTrackingStats,
      sarcini: sarciniiStats
    };

    console.log('User dashboard stats loaded:', stats);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Eroare la încărcarea statisticilor user dashboard:', error);
    return NextResponse.json({
      error: 'Eroare la încărcarea statisticilor user dashboard',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function getUserProiecteStats() {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(Status = 'Activ') as active,
        COUNTIF(Status = 'Finalizat') as finalizate,
        COUNTIF(Status = 'Suspendat') as suspendate,
        COUNTIF(status_predare = 'Predat') as predate,
        COUNTIF(status_predare = 'Nepredat') as nepredate
      FROM ${TABLE_PROIECTE}
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        total: parseInt(rows[0].total) || 0,
        active: parseInt(rows[0].active) || 0,
        finalizate: parseInt(rows[0].finalizate) || 0,
        suspendate: parseInt(rows[0].suspendate) || 0,
        predate: parseInt(rows[0].predate) || 0,
        nepredate: parseInt(rows[0].nepredate) || 0
      };
    }

    return { total: 0, active: 0, finalizate: 0, suspendate: 0, predate: 0, nepredate: 0 };
  } catch (error) {
    console.error('Eroare la statistici proiecte user:', error);
    return { total: 0, active: 0, finalizate: 0, suspendate: 0, predate: 0, nepredate: 0 };
  }
}

async function getUserTimeTrackingStats() {
  try {
    // Calculează orele săptămânii curente (luni-duminică)
    const query = `
      SELECT
        COALESCE(SUM(CAST(ore_lucrate AS FLOAT64)), 0) as ore_saptamana_curenta,
        COUNT(DISTINCT data_lucru) as zile_lucrate,
        COUNT(*) as total_inregistrari
      FROM ${TABLE_TIME_TRACKING}
      WHERE EXTRACT(WEEK FROM data_lucru) = EXTRACT(WEEK FROM CURRENT_DATE())
        AND EXTRACT(YEAR FROM data_lucru) = EXTRACT(YEAR FROM CURRENT_DATE())
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        ore_saptamana_curenta: parseFloat(rows[0].ore_saptamana_curenta) || 0,
        zile_lucrate: parseInt(rows[0].zile_lucrate) || 0,
        total_inregistrari: parseInt(rows[0].total_inregistrari) || 0
      };
    }

    return { ore_saptamana_curenta: 0, zile_lucrate: 0, total_inregistrari: 0 };
  } catch (error) {
    console.error('Eroare la statistici time tracking user:', error);
    // Dacă tabela nu există, returnează statistici implicite
    return { ore_saptamana_curenta: 0, zile_lucrate: 0, total_inregistrari: 0 };
  }
}

async function getUserSarciniiStats() {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(status = 'Neinceput') as neinceput,
        COUNTIF(status = 'In Progress') as in_progress,
        COUNTIF(status = 'Finalizat') as finalizate,
        COUNTIF(prioritate = 'Urgent') as urgente
      FROM ${TABLE_SARCINI}
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        total: parseInt(rows[0].total) || 0,
        neinceput: parseInt(rows[0].neinceput) || 0,
        in_progress: parseInt(rows[0].in_progress) || 0,
        finalizate: parseInt(rows[0].finalizate) || 0,
        urgente: parseInt(rows[0].urgente) || 0
      };
    }

    return { total: 0, neinceput: 0, in_progress: 0, finalizate: 0, urgente: 0 };
  } catch (error) {
    console.error('Eroare la statistici sarcini user:', error);
    // Dacă tabela nu există, returnează statistici implicite
    return { total: 0, neinceput: 0, in_progress: 0, finalizate: 0, urgente: 0 };
  }
}