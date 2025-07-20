import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
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
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
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
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
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
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ContracteGenerate\`
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
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
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
