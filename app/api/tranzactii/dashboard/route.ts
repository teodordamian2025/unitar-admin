// =================================================================
// API DASHBOARD TRANZACTII CU FILTRARE AVANSATA
// Generat: 18 septembrie 2025, 00:00 (Romania)
// Cale: app/api/tranzactii/dashboard/route.ts
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
  } : undefined,
});

const dataset = bigquery.dataset('PanouControlUnitar');

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

interface DashboardStats {
  totalTransactions: number;
  totalIncasari: number;
  totalPlati: number;
  sumaIncasari: number;
  sumaPlati: number;
  soldTotal: number;
  matchingRate: number;
  avgConfidence: number;
  pendingMatches: number;
  needsReview: number;
}

interface TranzactieDetail {
  id: string;
  data_procesare: string;
  suma: number;
  directie: string;
  tip_categorie: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  status: string;
  matching_tip: string;
  matching_confidence: number;
  // Matching details
  matched_target_type?: string;
  matched_target_id?: string;
  matched_confidence?: number;
  matched_details?: any;
  // Pentru display
  badge_color?: string;
  confidence_label?: string;
}

interface FilterParams {
  data_start?: string;
  data_end?: string;
  tip_tranzactie?: string;
  directie?: string;
  status?: string;
  matching_tip?: string;
  min_suma?: number;
  max_suma?: number;
  cui_contrapartida?: string;
  search_contrapartida?: string;
  min_confidence?: number;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Construiește WHERE clause pentru filtrare
 */
function buildWhereClause(filters: FilterParams): string {
  const conditions: string[] = [];

  if (filters.data_start) {
    conditions.push(`t.data_procesare >= DATE('${filters.data_start}')`);
  }
  
  if (filters.data_end) {
    conditions.push(`t.data_procesare <= DATE('${filters.data_end}')`);
  }
  
  if (filters.directie) {
    conditions.push(`t.directie = '${filters.directie}'`);
  }
  
  if (filters.tip_tranzactie) {
    conditions.push(`t.tip_categorie = '${filters.tip_tranzactie}'`);
  }
  
  if (filters.status) {
    conditions.push(`t.status = '${filters.status}'`);
  }
  
  if (filters.matching_tip) {
    if (filters.matching_tip === 'none') {
      conditions.push(`(t.matching_tip IS NULL OR t.matching_tip = 'none')`);
    } else {
      conditions.push(`t.matching_tip = '${filters.matching_tip}'`);
    }
  }
  
  if (filters.min_suma !== undefined) {
    conditions.push(`ABS(t.suma) >= ${filters.min_suma}`);
  }
  
  if (filters.max_suma !== undefined) {
    conditions.push(`ABS(t.suma) <= ${filters.max_suma}`);
  }
  
  if (filters.cui_contrapartida) {
    conditions.push(`t.cui_contrapartida = '${filters.cui_contrapartida}'`);
  }
  
  if (filters.search_contrapartida) {
    const searchTerm = filters.search_contrapartida.replace(/'/g, "\\'");
    conditions.push(`(
      LOWER(t.nume_contrapartida) LIKE LOWER('%${searchTerm}%') OR
      LOWER(t.detalii_tranzactie) LIKE LOWER('%${searchTerm}%')
    )`);
  }
  
  if (filters.min_confidence !== undefined) {
    conditions.push(`t.matching_confidence >= ${filters.min_confidence}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Determină culoarea badge-ului pentru status
 */
function getBadgeColor(status: string, matchingTip: string, confidence: number): string {
  if (status === 'matched') {
    if (confidence >= 90) return 'bg-green-100 text-green-800';
    if (confidence >= 75) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  }
  if (status === 'partial') return 'bg-orange-100 text-orange-800';
  if (status === 'nou') return 'bg-gray-100 text-gray-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Generează label pentru confidence
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 95) return 'Excelent';
  if (confidence >= 85) return 'Foarte bun';
  if (confidence >= 75) return 'Bun';
  if (confidence >= 60) return 'Acceptabil';
  if (confidence > 0) return 'Scăzut';
  return 'Fără match';
}

// =================================================================
// STATISTICI DASHBOARD
// =================================================================

/**
 * Calculează statisticile pentru dashboard
 */
async function getDashboardStats(filters: FilterParams): Promise<DashboardStats> {
  try {
    const whereClause = buildWhereClause(filters);
    
    const query = `
      WITH TransactionStats AS (
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN t.directie = 'in' THEN 1 ELSE 0 END) as total_incasari,
          SUM(CASE WHEN t.directie = 'out' THEN 1 ELSE 0 END) as total_plati,
          SUM(CASE WHEN t.directie = 'in' THEN t.suma ELSE 0 END) as suma_incasari,
          SUM(CASE WHEN t.directie = 'out' THEN ABS(t.suma) ELSE 0 END) as suma_plati,
          SUM(t.suma) as sold_total,
          SUM(CASE WHEN t.matching_tip IS NOT NULL AND t.matching_tip != 'none' THEN 1 ELSE 0 END) as matched_count,
          AVG(CASE WHEN t.matching_confidence > 0 THEN t.matching_confidence ELSE NULL END) as avg_confidence,
          SUM(CASE WHEN t.status = 'nou' AND t.matching_confidence >= 60 THEN 1 ELSE 0 END) as pending_matches,
          SUM(CASE WHEN t.needs_review = TRUE THEN 1 ELSE 0 END) as needs_review
        FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\` t
        ${whereClause}
      )
      SELECT 
        *,
        CASE 
          WHEN total_transactions > 0 THEN ROUND((matched_count * 100.0) / total_transactions, 2)
          ELSE 0 
        END as matching_rate
      FROM TransactionStats
    `;

    const [results] = await bigquery.query(query);
    
    if (results.length === 0) {
      return {
        totalTransactions: 0,
        totalIncasari: 0,
        totalPlati: 0,
        sumaIncasari: 0,
        sumaPlati: 0,
        soldTotal: 0,
        matchingRate: 0,
        avgConfidence: 0,
        pendingMatches: 0,
        needsReview: 0
      };
    }

    const stats = results[0];
    return {
      totalTransactions: parseInt(stats.total_transactions) || 0,
      totalIncasari: parseInt(stats.total_incasari) || 0,
      totalPlati: parseInt(stats.total_plati) || 0,
      sumaIncasari: parseFloat(stats.suma_incasari) || 0,
      sumaPlati: parseFloat(stats.suma_plati) || 0,
      soldTotal: parseFloat(stats.sold_total) || 0,
      matchingRate: parseFloat(stats.matching_rate) || 0,
      avgConfidence: Math.round(parseFloat(stats.avg_confidence) || 0),
      pendingMatches: parseInt(stats.pending_matches) || 0,
      needsReview: parseInt(stats.needs_review) || 0
    };

  } catch (error) {
    console.error('❌ Eroare calculare statistici:', error);
    throw new Error('Eroare la calcularea statisticilor dashboard');
  }
}

// =================================================================
// LISTARE TRANZACȚII CU PAGINARE
// =================================================================

/**
 * Obține lista tranzacțiilor cu filtrare și paginare
 */
async function getTransactionsList(filters: FilterParams): Promise<{
  transactions: TranzactieDetail[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}> {
  try {
    const whereClause = buildWhereClause(filters);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(10, filters.limit || 25));
    const offset = (page - 1) * limit;
    
    // Construim ORDER BY
    const sortBy = filters.sort_by || 'data_procesare';
    const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY t.${sortBy} ${sortOrder}, t.suma DESC`;

    // Query pentru count total
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\` t
      ${whereClause}
    `;

    // Query pentru date
    const dataQuery = `
      SELECT 
        t.id,
        t.data_procesare,
        t.suma,
        t.directie,
        t.tip_categorie,
        t.nume_contrapartida,
        t.cui_contrapartida,
        t.detalii_tranzactie,
        t.status,
        t.matching_tip,
        t.matching_confidence,
        
        -- Matching details din join
        m.target_type as matched_target_type,
        m.target_id as matched_target_id,
        m.confidence_score as matched_confidence,
        m.matching_details as matched_details
        
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\` t
      LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiMatching\` m
        ON t.id = m.tranzactie_id AND m.status = 'active'
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Executăm query-urile
    const [countResults] = await bigquery.query(countQuery);
    const [dataResults] = await bigquery.query(dataQuery);

    const totalCount = parseInt(countResults[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Procesăm rezultatele pentru display
    const transactions: TranzactieDetail[] = dataResults.map((row: any) => ({
      id: row.id,
      data_procesare: row.data_procesare,
      suma: parseFloat(row.suma) || 0,
      directie: row.directie,
      tip_categorie: row.tip_categorie,
      nume_contrapartida: row.nume_contrapartida || '',
      cui_contrapartida: row.cui_contrapartida || '',
      detalii_tranzactie: row.detalii_tranzactie || '',
      status: row.status,
      matching_tip: row.matching_tip || 'none',
      matching_confidence: parseFloat(row.matching_confidence) || 0,
      matched_target_type: row.matched_target_type,
      matched_target_id: row.matched_target_id,
      matched_confidence: parseFloat(row.matched_confidence) || 0,
      matched_details: row.matched_details,
      badge_color: getBadgeColor(row.status, row.matching_tip, parseFloat(row.matching_confidence) || 0),
      confidence_label: getConfidenceLabel(parseFloat(row.matching_confidence) || 0)
    }));

    return {
      transactions,
      totalCount,
      totalPages,
      currentPage: page
    };

  } catch (error) {
    console.error('❌ Eroare listare tranzacții:', error);
    throw new Error('Eroare la listarea tranzacțiilor');
  }
}

// =================================================================
// AGGREGĂRI PENTRU GRAFICE
// =================================================================

/**
 * Obține date pentru graficul de activitate zilnică
 */
async function getDailyActivityData(filters: FilterParams): Promise<any[]> {
  try {
    const whereClause = buildWhereClause(filters);
    
    const query = `
      SELECT 
        DATE(t.data_procesare) as data,
        COUNT(*) as total_tranzactii,
        SUM(CASE WHEN t.directie = 'in' THEN t.suma ELSE 0 END) as incasari,
        SUM(CASE WHEN t.directie = 'out' THEN ABS(t.suma) ELSE 0 END) as plati,
        SUM(CASE WHEN t.matching_tip IS NOT NULL AND t.matching_tip != 'none' THEN 1 ELSE 0 END) as matched_count,
        AVG(CASE WHEN t.matching_confidence > 0 THEN t.matching_confidence ELSE NULL END) as avg_confidence
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\` t
      ${whereClause}
      GROUP BY DATE(t.data_procesare)
      ORDER BY data DESC
      LIMIT 30
    `;

    const [results] = await bigquery.query(query);
    
    return results.map((row: any) => ({
      data: row.data,
      total_tranzactii: parseInt(row.total_tranzactii) || 0,
      incasari: Math.round(parseFloat(row.incasari) || 0),
      plati: Math.round(parseFloat(row.plati) || 0),
      matched_count: parseInt(row.matched_count) || 0,
      avg_confidence: Math.round(parseFloat(row.avg_confidence) || 0),
      matching_rate: row.total_tranzactii > 0 
        ? Math.round((row.matched_count * 100) / row.total_tranzactii)
        : 0
    }));

  } catch (error) {
    console.error('❌ Eroare date activitate zilnică:', error);
    return [];
  }
}

/**
 * Obține distribuția pe categorii de tranzacții
 */
async function getCategoryDistribution(filters: FilterParams): Promise<any[]> {
  try {
    const whereClause = buildWhereClause(filters);
    
    const query = `
      SELECT 
        t.tip_categorie,
        t.directie,
        COUNT(*) as count,
        SUM(ABS(t.suma)) as total_suma,
        AVG(CASE WHEN t.matching_confidence > 0 THEN t.matching_confidence ELSE NULL END) as avg_confidence
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\` t
      ${whereClause}
      GROUP BY t.tip_categorie, t.directie
      ORDER BY total_suma DESC
    `;

    const [results] = await bigquery.query(query);
    
    return results.map((row: any) => ({
      tip_categorie: row.tip_categorie,
      directie: row.directie,
      count: parseInt(row.count) || 0,
      total_suma: Math.round(parseFloat(row.total_suma) || 0),
      avg_confidence: Math.round(parseFloat(row.avg_confidence) || 0)
    }));

  } catch (error) {
    console.error('❌ Eroare distribuție categorii:', error);
    return [];
  }
}

// =================================================================
// ENDPOINT PRINCIPAL
// =================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extragem parametrii de filtrare
    const filters: FilterParams = {
      data_start: searchParams.get('data_start') || undefined,
      data_end: searchParams.get('data_end') || undefined,
      tip_tranzactie: searchParams.get('tip_tranzactie') || undefined,
      directie: searchParams.get('directie') || undefined,
      status: searchParams.get('status') || undefined,
      matching_tip: searchParams.get('matching_tip') || undefined,
      min_suma: searchParams.get('min_suma') ? parseFloat(searchParams.get('min_suma')!) : undefined,
      max_suma: searchParams.get('max_suma') ? parseFloat(searchParams.get('max_suma')!) : undefined,
      cui_contrapartida: searchParams.get('cui_contrapartida') || undefined,
      search_contrapartida: searchParams.get('search_contrapartida') || undefined,
      min_confidence: searchParams.get('min_confidence') ? parseFloat(searchParams.get('min_confidence')!) : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 25,
      sort_by: searchParams.get('sort_by') || 'data_procesare',
      sort_order: searchParams.get('sort_order') || 'desc'
    };

    const requestedData = searchParams.get('data') || 'all';

    console.log(`📊 Dashboard request: ${requestedData}, filters:`, filters);

    // Determină ce date să returneze
    const response: any = {
      success: true,
      filters: filters
    };

    if (requestedData === 'stats' || requestedData === 'all') {
      response.stats = await getDashboardStats(filters);
    }

    if (requestedData === 'transactions' || requestedData === 'all') {
      const transactionData = await getTransactionsList(filters);
      response.transactions = transactionData.transactions;
      response.pagination = {
        totalCount: transactionData.totalCount,
        totalPages: transactionData.totalPages,
        currentPage: transactionData.currentPage,
        limit: filters.limit || 25
      };
    }

    if (requestedData === 'charts' || requestedData === 'all') {
      const [dailyActivity, categoryDistribution] = await Promise.all([
        getDailyActivityData(filters),
        getCategoryDistribution(filters)
      ]);
      
      response.charts = {
        dailyActivity,
        categoryDistribution
      };
    }

    // Adăugăm metadata useful
    response.metadata = {
      timestamp: new Date().toISOString(),
      appliedFilters: Object.keys(filters).filter(key => filters[key as keyof FilterParams] !== undefined),
      dataRequested: requestedData
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Eroare dashboard API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare neașteptată la încărcarea dashboard-ului',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// =================================================================
// POST - OPERAȚIUNI BULK (UPDATE STATUS, ETC.)
// =================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, transaction_ids, new_status, remove_matches } = body;

    if (!action || !transaction_ids || !Array.isArray(transaction_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Parametri invalizi: action și transaction_ids sunt obligatorii'
      }, { status: 400 });
    }

    console.log(`🔧 Operațiune bulk: ${action} pentru ${transaction_ids.length} tranzacții`);

    const idsString = transaction_ids.map(id => `"${id}"`).join(',');
    let updatedCount = 0;

    switch (action) {
      case 'update_status':
        if (!new_status) {
          return NextResponse.json({
            success: false,
            error: 'new_status este obligatoriu pentru update_status'
          }, { status: 400 });
        }

        const [updateResult] = await bigquery.query(`
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\`
          SET 
            status = '${new_status}',
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE id IN (${idsString})
        `);
        
        updatedCount = updateResult.numDmlAffectedRows || 0;
        break;

      case 'remove_matches':
        // Marchează matching-urile ca 'removed'
        await bigquery.query(`
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiMatching\`
          SET 
            status = 'removed',
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE tranzactie_id IN (${idsString}) AND status = 'active'
        `);

        // Resetează tranzacțiile
        const [resetResult] = await bigquery.query(`
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\`
          SET 
            matching_tip = 'none',
            matching_confidence = 0,
            status = 'nou',
            processed = FALSE,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE id IN (${idsString})
        `);
        
        updatedCount = resetResult.numDmlAffectedRows || 0;
        break;

      case 'mark_review':
        const [reviewResult] = await bigquery.query(`
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare\`
          SET 
            needs_review = TRUE,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE id IN (${idsString})
        `);
        
        updatedCount = reviewResult.numDmlAffectedRows || 0;
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Acțiunea '${action}' nu este suportată`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Operațiunea '${action}' a fost aplicată cu succes`,
      updatedCount: updatedCount,
      processedIds: transaction_ids.length
    });

  } catch (error: any) {
    console.error('❌ Eroare operațiune bulk:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la executarea operațiunii bulk'
    }, { status: 500 });
  }
}
