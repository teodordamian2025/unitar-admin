import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;
const TABLE_CONTRACTE_GENERATE = `\`${PROJECT_ID}.${DATASET}.ContracteGenerate${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;

console.log(`🔧 Dashboard API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, Clienti${tableSuffix}, ContracteGenerate${tableSuffix}, FacturiGenerate${tableSuffix}`);

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
    console.log('Loading dashboard statistics...');

    // Obține statistici despre proiecte
    const proiecteStats = await getProiecteStats();
    const clientiStats = await getClientiStats();
    const contracteStats = await getContracteStats();
    const facturiStats = await getFacturiStats();

    const stats = {
      proiecte: proiecteStats,
      clienti: clientiStats,
      contracte: contracteStats,
      facturi: facturiStats
    };

    console.log('Dashboard stats loaded:', stats);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Eroare la încărcarea statisticilor dashboard:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea statisticilor dashboard',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function getProiecteStats() {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(Status = 'Activ') as active,
        COUNTIF(Status = 'Finalizat') as finalizate,
        COUNTIF(Status = 'Suspendat') as suspendate
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
        suspendate: parseInt(rows[0].suspendate) || 0
      };
    }

    return { total: 0, active: 0, finalizate: 0, suspendate: 0 };
  } catch (error) {
    console.error('Eroare la statistici proiecte:', error);
    return { total: 0, active: 0, finalizate: 0, suspendate: 0 };
  }
}

async function getClientiStats() {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(activ = true) as activi,
        COUNTIF(sincronizat_factureaza = true) as sincronizati
      FROM ${TABLE_CLIENTI}
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        total: parseInt(rows[0].total) || 0,
        activi: parseInt(rows[0].activi) || 0,
        sincronizati: parseInt(rows[0].sincronizati) || 0
      };
    }

    return { total: 0, activi: 0, sincronizati: 0 };
  } catch (error) {
    console.error('Eroare la statistici clienți:', error);
    return { total: 0, activi: 0, sincronizati: 0 };
  }
}

async function getContracteStats() {
  try {
    // Verifică dacă există tabela ContracteGenerate
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(status = 'generat') as generate
      FROM ${TABLE_CONTRACTE_GENERATE}
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        total: parseInt(rows[0].total) || 0,
        generate: parseInt(rows[0].generate) || 0
      };
    }

    return { total: 0, generate: 0 };
  } catch (error) {
    console.error('Tabela contracte nu există sau eroare:', error);
    return { total: 0, generate: 0 };
  }
}

async function getFacturiStats() {
  try {
    // Verifică dacă există tabela FacturiGenerate
    const query = `
      SELECT
        COUNT(*) as total,
        SUM(valoare_platita) as valoare_incasata,
        SUM(total - valoare_platita) as valoare_de_incasat
      FROM ${TABLE_FACTURI_GENERATE}
      WHERE status != 'anulata'
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length > 0) {
      return {
        total: parseInt(rows[0].total) || 0,
        valoare_incasata: parseFloat(rows[0].valoare_incasata) || 0,
        valoare_de_incasat: parseFloat(rows[0].valoare_de_incasat) || 0
      };
    }

    return { total: 0, valoare_incasata: 0, valoare_de_incasat: 0 };
  } catch (error) {
    console.error('Tabela facturi nu există sau eroare:', error);
    return { total: 0, valoare_incasata: 0, valoare_de_incasat: 0 };
  }
}
