// ==================================================================
// CALEA: app/api/analytics/roi-analysis/route.ts
// CREAT: 15.09.2025 14:00 (ora României)
// DESCRIERE: API pentru analiza ROI cu cost analysis, completion probability și risk assessment
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_PROIECTE_CHELTUIELI = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;

console.log(`🔧 ROI Analysis API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, TimeTracking${tableSuffix}, Sarcini${tableSuffix}, FacturiGenerate${tableSuffix}, Contracte${tableSuffix}, ProiecteCheltuieli${tableSuffix}`);

// Tipuri pentru siguranță TypeScript
interface ROIInsight {
  type: 'success' | 'warning' | 'info' | 'danger';
  title: string;
  description: string;
  value: string;
  recommendation: string;
}

interface SummaryStats {
  total_projects: number;
  total_investment: number;
  total_revenue: number;
  net_profit: number;
  average_roi: number;
  high_performers: number;
  under_performers: number;
  high_risk_projects: number;
  success_rate: number;
  completion_rate: number;
}

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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '90';
    const projectFilter = searchParams.get('project_id');
    const clientFilter = searchParams.get('client');
    const statusFilter = searchParams.get('status');
    const minROI = searchParams.get('min_roi');
    const includeForecasts = searchParams.get('include_forecasts') !== 'false';

    // Query complexă pentru analiza ROI cu multiple surse de date
    const roiAnalysisQuery = `
      WITH project_financials AS (
        SELECT 
          p.ID_Proiect as proiect_id,
          p.Denumire as proiect_nume,
          p.Client as client_nume,
          p.Status as proiect_status,
          p.Data_Start,
          p.Data_Final,
          
          -- Investiții și costuri
          COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) as valoare_estimata,
          p.moneda,
          COALESCE(p.curs_valutar, 1) as curs_valutar,
          
          -- Calculez investiția totală din multiple surse
          COALESCE(p.valoare_ron, p.Valoare_Estimata * COALESCE(p.curs_valutar, 1), 0) as investitie_totala,
          
          -- Status tracking pentru risk assessment
          COALESCE(p.status_predare, 'Nepredat') as status_predare,
          COALESCE(p.status_contract, 'Nu e cazul') as status_contract,
          COALESCE(p.status_facturare, 'Nefacturat') as status_facturare,
          COALESCE(p.status_achitare, 'Neachitat') as status_achitare
          
        FROM ${TABLE_PROIECTE} p
        WHERE p.Data_Start >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
      ),
      
      time_investment AS (
        SELECT 
          tt.proiect_id,
          SUM(tt.ore_lucrate) as total_ore_lucrate,
          COUNT(DISTINCT tt.utilizator_uid) as utilizatori_implicati,
          COUNT(DISTINCT tt.sarcina_id) as sarcini_lucrate,
          AVG(tt.ore_lucrate) as media_ore_per_sesiune,
          
          -- Calculez costul pe oră (estimare bazată pe complexitate)
          CASE 
            WHEN COUNT(DISTINCT s.prioritate) > 0 THEN
              AVG(CASE 
                WHEN s.prioritate = 'Critică' THEN 150.0
                WHEN s.prioritate = 'Înaltă' THEN 120.0
                WHEN s.prioritate = 'Medie' THEN 100.0
                WHEN s.prioritate = 'Scăzută' THEN 80.0
                ELSE 100.0
              END)
            ELSE 100.0
          END as cost_mediu_per_ora,
          
          -- Eficiența calculată din progres vs timp
          CASE 
            WHEN SUM(tt.ore_lucrate) > 0 THEN
              AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 10
            ELSE 0
          END as efficiency_factor
          
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_SARCINI} s 
          ON tt.sarcina_id = s.id
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY tt.proiect_id
      ),
      
      revenue_tracking AS (
        SELECT 
          fg.proiect_id,
          SUM(COALESCE(fg.total, 0)) as venituri_facturate,
          SUM(COALESCE(fg.valoare_platita, 0)) as venituri_incasate,
          COUNT(*) as numar_facturi,
          
          -- Calculez rata de colectare
          CASE 
            WHEN SUM(COALESCE(fg.total, 0)) > 0 THEN
              SUM(COALESCE(fg.valoare_platita, 0)) / SUM(COALESCE(fg.total, 0)) * 100
            ELSE 0
          END as rata_colectare,
          
          -- Status facturi pentru risk assessment
          AVG(CASE 
            WHEN fg.status = 'platita' THEN 100
            WHEN fg.status = 'trimisa' THEN 50
            WHEN fg.status = 'draft' THEN 10
            ELSE 0
          END) as status_mediu_facturi
          
        FROM ${TABLE_FACTURI_GENERATE} fg
        WHERE fg.data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY fg.proiect_id
      ),
      
      project_progress AS (
        SELECT 
          s.proiect_id,
          AVG(COALESCE(s.progres_procent, 0)) as progres_mediu,
          COUNT(*) as total_sarcini,
          COUNT(CASE WHEN s.status = 'Finalizată' THEN 1 END) as sarcini_finalizate,
          
          -- Calculez completion probability
          CASE 
            WHEN COUNT(*) > 0 THEN
              COUNT(CASE WHEN s.status = 'Finalizată' THEN 1 END) / COUNT(*) * 100
            ELSE 0
          END as completion_rate,
          
          -- Deadline adherence pentru risk
          COUNT(CASE 
            WHEN s.data_scadenta IS NOT NULL 
            AND s.data_scadenta < CURRENT_DATE() 
            AND s.status != 'Finalizată' THEN 1 
          END) as sarcini_intarziate,
          
          -- Priority distribution
          COUNT(CASE WHEN s.prioritate = 'Critică' THEN 1 END) as sarcini_critice
          
        FROM ${TABLE_SARCINI} s
        WHERE s.data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY s.proiect_id
      ),
      
      contract_value AS (
        SELECT 
          c.proiect_id,
          SUM(COALESCE(c.valoare_ron, c.Valoare, 0)) as valoare_contractuala,
          COUNT(*) as numar_contracte,
          
          -- Status contracte pentru risk
          AVG(CASE 
            WHEN c.Status = 'Semnat' THEN 100
            WHEN c.Status = 'Draft' THEN 30
            ELSE 10
          END) as maturitate_contractuala
          
        FROM ${TABLE_CONTRACTE} c
        WHERE c.data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY c.proiect_id
      ),
      
      expense_tracking AS (
        SELECT 
          pc.proiect_id,
          SUM(COALESCE(pc.valoare_ron, pc.valoare, 0)) as cheltuieli_totale,
          COUNT(*) as numar_cheltuieli,
          
          -- Breakdown pe tipuri de cheltuieli
          SUM(CASE WHEN pc.tip_cheltuiala LIKE '%subcontract%' THEN COALESCE(pc.valoare_ron, pc.valoare, 0) ELSE 0 END) as cheltuieli_subcontractare,
          SUM(CASE WHEN pc.tip_cheltuiala LIKE '%material%' THEN COALESCE(pc.valoare_ron, pc.valoare, 0) ELSE 0 END) as cheltuieli_materiale
          
        FROM ${TABLE_PROIECTE_CHELTUIELI} pc
        WHERE pc.data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY pc.proiect_id
      )
      
      SELECT 
        pf.proiect_id,
        pf.proiect_nume,
        pf.client_nume,
        pf.proiect_status,
        pf.Data_Start,
        pf.Data_Final,
        
        -- Investment Analysis
        pf.investitie_totala as total_investment,
        pf.valoare_estimata as estimated_value,
        COALESCE(rt.venituri_incasate, cv.valoare_contractuala, pf.investitie_totala) as actual_revenue,
        
        -- Cost Breakdown
        COALESCE(ti.total_ore_lucrate, 0) as hours_invested,
        COALESCE(ti.cost_mediu_per_ora, 100) as cost_per_hour,
        COALESCE(ti.total_ore_lucrate * ti.cost_mediu_per_ora, 0) as labor_costs,
        COALESCE(et.cheltuieli_totale, 0) as material_costs,
        
        -- ROI Calculation
        CASE 
          WHEN pf.investitie_totala > 0 THEN
            ((COALESCE(rt.venituri_incasate, cv.valoare_contractuala, pf.investitie_totala) - pf.investitie_totala) / pf.investitie_totala) * 100
          ELSE 0
        END as roi_percentage,
        
        -- Efficiency Metrics
        COALESCE(ti.efficiency_factor, 0) as efficiency_score,
        COALESCE(pp.progres_mediu, 0) as progress_percentage,
        COALESCE(pp.completion_rate, 0) as completion_probability,
        
        -- Risk Assessment
        CASE 
          WHEN pp.sarcini_intarziate > pp.total_sarcini * 0.3 THEN 'high'
          WHEN pp.sarcini_critice > 0 OR pf.status_achitare = 'Neachitat' THEN 'medium'
          ELSE 'low'
        END as risk_level,
        
        -- Financial Health Indicators
        COALESCE(rt.rata_colectare, 0) as collection_rate,
        COALESCE(rt.venituri_facturate, 0) as billed_amount,
        COALESCE(cv.maturitate_contractuala, 0) as contract_maturity,
        
        -- Project Metrics
        COALESCE(ti.utilizatori_implicati, 0) as team_size,
        COALESCE(pp.total_sarcini, 0) as total_tasks,
        COALESCE(pp.sarcini_finalizate, 0) as completed_tasks,
        
        -- Time Analysis
        DATE_DIFF(COALESCE(pf.Data_Final, CURRENT_DATE()), pf.Data_Start, DAY) as project_duration_days,
        DATE_DIFF(CURRENT_DATE(), pf.Data_Start, DAY) as days_elapsed,
        
        -- Status tracking
        pf.status_predare,
        pf.status_contract,
        pf.status_facturare,
        pf.status_achitare
        
      FROM project_financials pf
      LEFT JOIN time_investment ti ON pf.proiect_id = ti.proiect_id
      LEFT JOIN revenue_tracking rt ON pf.proiect_id = rt.proiect_id
      LEFT JOIN project_progress pp ON pf.proiect_id = pp.proiect_id
      LEFT JOIN contract_value cv ON pf.proiect_id = cv.proiect_id
      LEFT JOIN expense_tracking et ON pf.proiect_id = et.proiect_id
      
      WHERE 1=1
      ${projectFilter ? `AND pf.proiect_id = @projectFilter` : ''}
      ${clientFilter ? `AND LOWER(pf.client_nume) LIKE LOWER(@clientFilter)` : ''}
      ${statusFilter ? `AND pf.proiect_status = @statusFilter` : ''}
      
      ORDER BY 
        CASE 
          WHEN pf.investitie_totala > 0 THEN
            ((COALESCE(rt.venituri_incasate, cv.valoare_contractuala, pf.investitie_totala) - pf.investitie_totala) / pf.investitie_totala) * 100
          ELSE 0
        END DESC
    `;

    // Parametri pentru query
    const queryParams: Record<string, any> = { period: period };
    const queryTypes: Record<string, string> = { period: 'INT64' };

    if (projectFilter) {
      queryParams.projectFilter = projectFilter;
      queryTypes.projectFilter = 'STRING';
    }

    if (clientFilter) {
      queryParams.clientFilter = `%${clientFilter}%`;
      queryTypes.clientFilter = 'STRING';
    }

    if (statusFilter) {
      queryParams.statusFilter = statusFilter;
      queryTypes.statusFilter = 'STRING';
    }

    const [rows] = await bigquery.query({
      query: roiAnalysisQuery,
      params: queryParams,
      types: queryTypes,
      location: 'EU',
    });

    console.log(`ROI Analysis: ${rows.length} projects analyzed`);

    // Procesare și îmbunătățire date
    const processedData = rows.map((row: any) => {
      const roi = parseFloat(row.roi_percentage) || 0;
      const completionProb = parseFloat(row.completion_probability) || 0;
      const progressPct = parseFloat(row.progress_percentage) || 0;
      const totalInvestment = parseFloat(row.total_investment) || 0;
      const actualRevenue = parseFloat(row.actual_revenue) || 0;
      const laborCosts = parseFloat(row.labor_costs) || 0;
      const materialCosts = parseFloat(row.material_costs) || 0;

      // Calculate enhanced metrics
      const totalCosts = laborCosts + materialCosts;
      const netProfit = actualRevenue - totalInvestment - totalCosts;
      const profitMargin = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

      // Risk scoring algorithm
      let riskScore = 0;
      if (row.risk_level === 'high') riskScore += 30;
      if (row.risk_level === 'medium') riskScore += 15;
      if (completionProb < 50) riskScore += 20;
      if (progressPct < 25) riskScore += 15;
      if (parseFloat(row.collection_rate) < 70) riskScore += 10;
      if (row.status_achitare === 'Neachitat') riskScore += 10;

      const finalRiskLevel = riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low';

      // Efficiency calculation
      const hoursInvested = parseFloat(row.hours_invested) || 1;
      const daysElapsed = parseInt(row.days_elapsed) || 1;
      const efficiencyScore = Math.min(100, (progressPct / hoursInvested) * 10 + (completionProb / daysElapsed) * 20);

      return {
        proiect_id: row.proiect_id,
        proiect_nume: row.proiect_nume,
        client_nume: row.client_nume,
        proiect_status: row.proiect_status,
        
        // Investment & Revenue
        total_investment: totalInvestment,
        estimated_value: parseFloat(row.estimated_value) || 0,
        actual_revenue: actualRevenue,
        net_profit: netProfit,
        
        // ROI Metrics
        roi_percentage: roi,
        profit_margin: profitMargin,
        
        // Cost Analysis
        hours_invested: hoursInvested,
        cost_per_hour: parseFloat(row.cost_per_hour) || 100,
        labor_costs: laborCosts,
        material_costs: materialCosts,
        total_costs: totalCosts,
        
        // Efficiency & Completion
        efficiency_score: Math.round(efficiencyScore),
        progress_percentage: progressPct,
        completion_probability: completionProb,
        
        // Risk Assessment
        risk_level: finalRiskLevel,
        risk_score: riskScore,
        risk_factors: getRiskFactors(row, roi, completionProb, progressPct),
        
        // Financial Health
        collection_rate: parseFloat(row.collection_rate) || 0,
        billed_amount: parseFloat(row.billed_amount) || 0,
        contract_maturity: parseFloat(row.contract_maturity) || 0,
        
        // Project Info
        team_size: parseInt(row.team_size) || 0,
        total_tasks: parseInt(row.total_tasks) || 0,
        completed_tasks: parseInt(row.completed_tasks) || 0,
        project_duration_days: parseInt(row.project_duration_days) || 0,
        days_elapsed: daysElapsed,
        
        // Status
        status_predare: row.status_predare,
        status_contract: row.status_contract,
        status_facturare: row.status_facturare,
        status_achitare: row.status_achitare
      };
    });

    // Filtrare pe ROI minim dacă este specificat
    const filteredData = minROI ? 
      processedData.filter(project => project.roi_percentage >= parseFloat(minROI)) :
      processedData;

    // Calculare statistici sumar
    const summaryStats = calculateSummaryStats(filteredData);

    // Generate insights
    const insights = generateROIInsights(filteredData);

    // Forecasts dacă sunt cerute
    const forecasts = includeForecasts ? generateROIForecasts(filteredData) : null;

    return NextResponse.json({
      success: true,
      data: filteredData,
      summary: summaryStats,
      insights: insights,
      forecasts: forecasts,
      meta: {
        period: parseInt(period),
        projects_analyzed: filteredData.length,
        filters: {
          project_id: projectFilter,
          client: clientFilter,
          status: statusFilter,
          min_roi: minROI
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare ROI Analysis API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la analiza ROI' },
      { status: 500 }
    );
  }
}

// Funcție pentru identificarea factorilor de risc
function getRiskFactors(projectData: any, roi: number, completionProb: number, progress: number): string[] {
  const factors: string[] = [];

  if (roi < 50) factors.push('ROI sub așteptări');
  if (completionProb < 60) factors.push('Probabilitate scăzută de finalizare');
  if (progress < 30) factors.push('Progres lent');
  if (projectData.status_achitare === 'Neachitat') factors.push('Plăți în întârziere');
  if (parseFloat(projectData.collection_rate) < 70) factors.push('Rata de colectare scăzută');
  if (parseInt(projectData.days_elapsed) > parseInt(projectData.project_duration_days)) factors.push('Depășire termen');
  if (parseFloat(projectData.labor_costs) > parseFloat(projectData.total_investment) * 0.7) factors.push('Costuri de muncă ridicate');

  return factors;
}

// Calculare statistici sumar
function calculateSummaryStats(projects: any[]): SummaryStats {
  if (projects.length === 0) return {
    total_projects: 0,
    total_investment: 0,
    total_revenue: 0,
    net_profit: 0,
    average_roi: 0,
    high_performers: 0,
    under_performers: 0,
    high_risk_projects: 0,
    success_rate: 0,
    completion_rate: 0
  };

  const totalInvestment = projects.reduce((sum, p) => sum + p.total_investment, 0);
  const totalRevenue = projects.reduce((sum, p) => sum + p.actual_revenue, 0);
  const avgROI = projects.reduce((sum, p) => sum + p.roi_percentage, 0) / projects.length;

  const highPerformers = projects.filter(p => p.roi_percentage > 150);
  const underPerformers = projects.filter(p => p.roi_percentage < 80);
  const highRiskProjects = projects.filter(p => p.risk_level === 'high');

  return {
    total_projects: projects.length,
    total_investment: totalInvestment,
    total_revenue: totalRevenue,
    net_profit: totalRevenue - totalInvestment,
    average_roi: Math.round(avgROI * 100) / 100,
    high_performers: highPerformers.length,
    under_performers: underPerformers.length,
    high_risk_projects: highRiskProjects.length,
    success_rate: Math.round((highPerformers.length / projects.length) * 100),
    completion_rate: Math.round(projects.reduce((sum, p) => sum + p.completion_probability, 0) / projects.length)
  };
}

// Generare insights ROI
function generateROIInsights(projects: any[]): ROIInsight[] {
  const insights: ROIInsight[] = [];

  const avgROI = projects.reduce((sum, p) => sum + p.roi_percentage, 0) / projects.length;
  const highPerformers = projects.filter(p => p.roi_percentage > 150);
  const underPerformers = projects.filter(p => p.roi_percentage < 80);

  if (highPerformers.length > 0) {
    insights.push({
      type: 'success',
      title: 'Proiecte High-Performance',
      description: `${highPerformers.length} proiecte cu ROI > 150%`,
      value: `${Math.round(highPerformers.reduce((sum, p) => sum + p.roi_percentage, 0) / highPerformers.length)}% ROI mediu`,
      recommendation: 'Analizează metodologiile acestor proiecte pentru replicare'
    });
  }

  if (underPerformers.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Proiecte Sub-Performance',
      description: `${underPerformers.length} proiecte cu ROI < 80%`,
      value: `${Math.round(underPerformers.reduce((sum, p) => sum + p.roi_percentage, 0) / underPerformers.length)}% ROI mediu`,
      recommendation: 'Revizuiește strategia și aloca resurse suplimentare'
    });
  }

  if (avgROI > 120) {
    insights.push({
      type: 'info',
      title: 'Portfolio Sănătos',
      description: `ROI mediu de ${Math.round(avgROI)}%`,
      value: 'Performance peste medie',
      recommendation: 'Menține strategia curentă și scalează proiectele de succes'
    });
  }

  return insights;
}

// Generare prognoze ROI
function generateROIForecasts(projects: any[]): {
  active_projects: number;
  forecasts: any[];
  portfolio_forecast: {
    expected_avg_roi: number;
    high_confidence_projects: number;
  };
} {
  const activeProjects = projects.filter(p => p.proiect_status === 'Activ');
  
  const forecastData = activeProjects.map(project => {
    const currentProgress = project.progress_percentage;
    const timeElapsed = project.days_elapsed;
    const totalDuration = project.project_duration_days;
    
    // Estimare completion time
    const estimatedCompletion = currentProgress > 0 ? 
      Math.ceil((100 - currentProgress) / currentProgress * timeElapsed) : 
      totalDuration - timeElapsed;
    
    // Forecast final ROI
    const progressRatio = Math.min(1, currentProgress / 100);
    const forecastROI = project.roi_percentage + (project.roi_percentage * (1 - progressRatio) * 0.5);

    return {
      proiect_id: project.proiect_id,
      current_roi: project.roi_percentage,
      forecast_roi: Math.round(forecastROI * 100) / 100,
      estimated_completion_days: estimatedCompletion,
      confidence_level: project.completion_probability
    };
  });

  return {
    active_projects: activeProjects.length,
    forecasts: forecastData,
    portfolio_forecast: {
      expected_avg_roi: Math.round(forecastData.reduce((sum, f) => sum + f.forecast_roi, 0) / forecastData.length * 100) / 100,
      high_confidence_projects: forecastData.filter(f => f.confidence_level > 80).length
    }
  };
}
