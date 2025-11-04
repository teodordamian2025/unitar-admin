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
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;

console.log(`🔧 Dashboard API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, Clienti${tableSuffix}, Contracte${tableSuffix}, FacturiGenerate${tableSuffix}`);

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
        COUNTIF(activ = true) as activi
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
        sincronizati: 0  // ✅ Removed sincronizat_factureaza column (not in Clienti_v2)
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
    // ✅ Fixed: Using Contracte_v2 instead of ContracteGenerate_v2
    const query = `
      SELECT
        COUNT(*) as total,
        COUNTIF(status = 'generat') as generate
      FROM ${TABLE_CONTRACTE}
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
    // ✅ Query corectată: folosește EtapeFacturi_v2 pentru moneda corectă
    // Grupează pe monedă și factura_id pentru a calcula valorile corecte
    const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;

    const query = `
      WITH FacturiCuMoneda AS (
        SELECT
          fg.id,
          fg.status,
          fg.subtotal,
          fg.valoare_platita,
          ef.moneda,
          -- Calculează total per factură per monedă (sumă etape)
          SUM(ef.valoare) as valoare_etape
        FROM ${TABLE_FACTURI_GENERATE} fg
        LEFT JOIN ${TABLE_ETAPE_FACTURI} ef ON fg.id = ef.factura_id
        WHERE fg.status != 'anulata'
          AND ef.activ = true
        GROUP BY fg.id, fg.status, fg.subtotal, fg.valoare_platita, ef.moneda
      )
      SELECT
        moneda,
        COUNT(DISTINCT id) as numar_facturi,
        -- Suma valorilor neplatite (folosim valoare_etape care este în moneda originală)
        SUM(CAST(valoare_etape AS NUMERIC) - COALESCE(CAST(valoare_platita AS NUMERIC), 0)) as total_neplatit
      FROM FacturiCuMoneda
      WHERE (CAST(valoare_etape AS NUMERIC) - COALESCE(CAST(valoare_platita AS NUMERIC), 0)) > 0
      GROUP BY moneda
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    // Grupează facturile pe monede
    const facturePerMoneda: { [moneda: string]: { neplatite: number, subtotal: number } } = {};
    let totalFacturi = 0;

    rows.forEach((row: any) => {
      const moneda = row.moneda || 'RON';
      const numarFacturi = parseInt(row.numar_facturi) || 0;
      const totalNeplatit = parseFloat(row.total_neplatit) || 0;

      facturePerMoneda[moneda] = {
        neplatite: numarFacturi,
        subtotal: totalNeplatit
      };

      totalFacturi += numarFacturi;
    });

    // Verifică dacă există facturi fără etape (edge case)
    const queryFacturiFaraEtape = `
      SELECT COUNT(DISTINCT id) as facturi_fara_etape
      FROM ${TABLE_FACTURI_GENERATE} fg
      WHERE fg.status != 'anulata'
        AND NOT EXISTS (
          SELECT 1 FROM ${TABLE_ETAPE_FACTURI} ef
          WHERE ef.factura_id = fg.id AND ef.activ = true
        )
    `;

    const [rowsFaraEtape] = await bigquery.query({
      query: queryFacturiFaraEtape,
      location: 'EU',
    });

    const facturiFaraEtape = parseInt(rowsFaraEtape[0]?.facturi_fara_etape) || 0;
    if (facturiFaraEtape > 0) {
      console.warn(`⚠️ Există ${facturiFaraEtape} facturi fără etape asociate`);
    }

    return {
      total: totalFacturi + facturiFaraEtape,
      facturePerMoneda: facturePerMoneda,
      // Backwards compatibility - folosește RON pentru valori vechi
      valoare_de_incasat: facturePerMoneda['RON']?.subtotal || 0
    };

  } catch (error) {
    console.error('Tabela facturi nu există sau eroare:', error);
    return { total: 0, facturePerMoneda: {}, valoare_de_incasat: 0 };
  }
}
