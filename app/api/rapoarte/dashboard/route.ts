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
    const dataset = 'PanouControlUnitar';
    
    // Query pentru statistici paralele
    const queries = [
      // Statistici proiecte
      `SELECT 
        COUNT(*) as total,
        COUNTIF(Status IN ('Activ', 'În lucru')) as active,
        COUNTIF(Status = 'Finalizat') as finalizate
       FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``,
      
      // Statistici clienți
      `SELECT 
        COUNT(*) as total,
        COUNTIF(activ = true) as activi
       FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti\``,
      
      // Statistici contracte
      `SELECT 
        COUNT(*) as total,
        COUNTIF(Status = 'Activ') as active
       FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Contracte\``,
      
      // Statistici financiare
      `SELECT 
        SUM(CASE WHEN Tip = 'Intrare' THEN Suma ELSE 0 END) as venit_luna,
        SUM(CASE WHEN Tip = 'Iesire' AND Status = 'Pending' THEN Suma ELSE 0 END) as de_incasat
       FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.BancaTranzactii\`
       WHERE DATE(Data) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`
    ];

    // Execută toate query-urile în paralel
    const results = await Promise.all(
      queries.map(query => 
        bigquery.query({
          query: query,
          location: 'EU',
        })
      )
    );

    const [
      [proiecteRows],
      [clientiRows], 
      [contracteRows],
      [financiarRows]
    ] = results;

    const stats = {
      proiecte: {
        total: Number(proiecteRows[0]?.total || 0),
        active: Number(proiecteRows[0]?.active || 0),
        finalizate: Number(proiecteRows[0]?.finalizate || 0)
      },
      clienti: {
        total: Number(clientiRows[0]?.total || 0),
        activi: Number(clientiRows[0]?.activi || 0)
      },
      contracte: {
        total: Number(contracteRows[0]?.total || 0),
        active: Number(contracteRows[0]?.active || 0)
      },
      financiar: {
        venit_luna: Number(financiarRows[0]?.venit_luna || 0),
        de_incasat: Number(financiarRows[0]?.de_incasat || 0)
      }
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Eroare dashboard stats:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea statisticilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

