// ==================================================================
// CALEA: app/api/actions/invoices/list/route.ts
// DESCRIERE: Lista facturilor generate (hibride) - VERSIUNE CORECTATĂ
// ==================================================================

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

const dataset = 'PanouControlUnitar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiectId');
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = `
      SELECT 
        fg.id,
        fg.numar,
        fg.data_factura,
        fg.data_scadenta,
        fg.client_nume,
        fg.client_cui,
        fg.subtotal,
        fg.total_tva,
        fg.total,
        fg.valoare_platita,
        fg.status,
        fg.data_creare,
        fg.data_actualizare,
        p.Denumire as proiect_denumire,
        p.Status as proiect_status,
        
        -- Calcule utile
        (fg.total - COALESCE(fg.valoare_platita, 0)) as rest_de_plata,
        DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) as zile_pana_scadenta,
        
        CASE 
          WHEN fg.data_scadenta < CURRENT_DATE() AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0 THEN 'Expirată'
          WHEN DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) <= 7 AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0 THEN 'Expiră curând'
          WHEN (fg.total - COALESCE(fg.valoare_platita, 0)) <= 0 THEN 'Plătită'
          ELSE 'În regulă'
        END as status_scadenta
        
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` fg
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON fg.proiect_id = p.ID_Proiect
      WHERE 1=1
    `;
    
    const params: any = {};
    
    if (proiectId) {
      query += ' AND fg.proiect_id = @proiectId';
      params.proiectId = proiectId;
    }
    
    if (clientId) {
      query += ' AND fg.client_id = @clientId';
      params.clientId = clientId;
    }
    
    if (status) {
      query += ' AND fg.status = @status';
      params.status = status;
    }
    
    query += ' ORDER BY fg.data_creare DESC';
    
    if (limit > 0) {
      query += ` LIMIT @limit OFFSET @offset`;
      params.limit = limit;
      params.offset = offset;
    }
    
    console.log('Query facturi:', query);
    console.log('Params:', params);
    
    const [rows] = await bigquery.query({
      query,
      params,
      location: 'EU'
    });
    
    // Query pentru total count (pentru paginare)
    let countQuery = `
      SELECT COUNT(*) as total_count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` fg
      WHERE 1=1
    `;
    
    const countParams: any = {};
    
    if (proiectId) {
      countQuery += ' AND fg.proiect_id = @proiectId';
      countParams.proiectId = proiectId;
    }
    
    if (clientId) {
      countQuery += ' AND fg.client_id = @clientId';
      countParams.clientId = clientId;
    }
    
    if (status) {
      countQuery += ' AND fg.status = @status';
      countParams.status = status;
    }
    
    const [countRows] = await bigquery.query({
      query: countQuery,
      params: countParams,
      location: 'EU'
    });
    
    const totalCount = countRows[0]?.total_count || 0;
    
    return NextResponse.json({
      success: true,
      facturi: rows,
      pagination: {
        total: parseInt(totalCount),
        limit,
        offset,
        hasMore: (offset + limit) < parseInt(totalCount)
      }
    });
    
  } catch (error) {
    console.error('Eroare preluare facturi:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la preluarea facturilor',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}

// ==================================================================
// API pentru statistici facturi (folosit în dashboard)
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const { perioada = '30' } = await request.json(); // ultimele 30 zile default
    
    const statsQuery = `
      WITH facturi_stats AS (
        SELECT 
          COUNT(*) as total_facturi,
          COUNTIF(status = 'pdf_generated') as facturi_pdf,
          COUNTIF(status = 'anaf_success') as facturi_anaf,
          COUNTIF(status = 'anaf_error') as facturi_eroare,
          SUM(total) as valoare_totala,
          SUM(COALESCE(valoare_platita, 0)) as valoare_platita,
          SUM(total - COALESCE(valoare_platita, 0)) as rest_de_plata,
          
          -- Facturi expirate
          COUNTIF(data_scadenta < CURRENT_DATE() AND (total - COALESCE(valoare_platita, 0)) > 0) as facturi_expirate,
          
          -- Facturi care expira in 7 zile
          COUNTIF(
            DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) <= 7 
            AND DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) >= 0
            AND (total - COALESCE(valoare_platita, 0)) > 0
          ) as facturi_expira_curand
          
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
      ),
      
      top_clienti AS (
        SELECT 
          client_nume,
          COUNT(*) as nr_facturi,
          SUM(total) as valoare_totala
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
        GROUP BY client_nume
        ORDER BY valoare_totala DESC
        LIMIT 5
      )
      
      SELECT 
        (SELECT AS STRUCT * FROM facturi_stats) as statistici,
        ARRAY(SELECT AS STRUCT * FROM top_clienti) as top_clienti
    `;
    
    const [rows] = await bigquery.query({
      query: statsQuery,
      params: { perioada: parseInt(perioada) },
      location: 'EU'
    });
    
    const result = rows[0];
    
    return NextResponse.json({
      success: true,
      statistici: result.statistici,
      topClienti: result.top_clienti,
      perioada: parseInt(perioada)
    });
    
  } catch (error) {
    console.error('Eroare statistici facturi:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la calcularea statisticilor',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}
