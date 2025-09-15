// ==================================================================
// CALEA: app/api/analytics/burnout-analysis/route.ts
// CREAT: 15.09.2025 14:30 (ora României)
// DESCRIERE: API pentru analiza burnout cu detection risc, stress indicators și recommended actions
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '90';
    const teamFilter = searchParams.get('team_member');
    const riskLevelFilter = searchParams.get('risk_level');
    const includeRecommendations = searchParams.get('include_recommendations') !== 'false';
    const includeHistoricalTrends = searchParams.get('include_trends') !== 'false';

    // Query complexă pentru analiza burnout cu indicatori multipli
    const burnoutAnalysisQuery = `
      WITH user_workload_analysis AS (
        SELECT 
          u.uid as utilizator_uid,
          u.nume as utilizator_nume,
          u.prenume,
          u.email,
          u.rol,
          
          -- Activitate de bază din TimeTracking
          COUNT(DISTINCT DATE(tt.data_lucru)) as zile_lucru_total,
          SUM(tt.ore_lucrate) as ore_lucrate_total,
          AVG(tt.ore_lucrate) as media_ore_per_sesiune,
          MAX(tt.ore_lucrate) as max_ore_sesiune,
          
          -- Calculez intensitatea zilnică
          COUNT(DISTINCT DATE(tt.data_lucru)) / 
            GREATEST(1, DATE_DIFF(CURRENT_DATE(), DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY), DAY)) * 100 as frecventa_lucru_procent,
          
          -- Analiza programului de lucru
          COUNT(CASE WHEN EXTRACT(DAYOFWEEK FROM tt.data_lucru) IN (1, 7) THEN 1 END) as zile_weekend,
          COUNT(CASE WHEN EXTRACT(HOUR FROM tt.created_at) > 18 OR EXTRACT(HOUR FROM tt.created_at) < 8 THEN 1 END) as sesiuni_ore_tarde,
          
          -- Overtime indicators
          COUNT(CASE WHEN tt.ore_lucrate > 8 THEN 1 END) as sesiuni_overtime,
          SUM(CASE WHEN tt.ore_lucrate > 8 THEN tt.ore_lucrate - 8 ELSE 0 END) as ore_overtime_total
        
        FROM `hale-mode-464009-i6.PanouControlUnitar.Utilizatori` u
        LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.TimeTracking` tt 
          ON u.uid = tt.utilizator_uid 
          AND tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        WHERE u.activ = true
        GROUP BY u.uid, u.nume, u.prenume, u.email, u.rol
      ),
      
      task_pressure_analysis AS (
        SELECT 
          sr.responsabil_uid as utilizator_uid,
          COUNT(DISTINCT s.id) as sarcini_totale,
          COUNT(DISTINCT CASE WHEN s.status != 'Finalizată' THEN s.id END) as sarcini_active,
          COUNT(DISTINCT CASE WHEN s.prioritate IN ('Critică', 'Înaltă') THEN s.id END) as sarcini_prioritate_ridicata,
          
          -- Deadline pressure analysis
          COUNT(DISTINCT CASE 
            WHEN s.data_scadenta IS NOT NULL 
            AND s.data_scadenta <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
            AND s.status != 'Finalizată' THEN s.id 
          END) as sarcini_scadenta_apropiata,
          
          COUNT(DISTINCT CASE 
            WHEN s.data_scadenta IS NOT NULL 
            AND s.data_scadenta < CURRENT_DATE()
            AND s.status != 'Finalizată' THEN s.id 
          END) as sarcini_intarziate,
          
          -- Task switching frequency (proxy pentru fragmentare)
          COUNT(DISTINCT s.proiect_id) as proiecte_simultan,
          
          -- Progres și completare
          AVG(CASE WHEN s.status != 'Finalizată' THEN COALESCE(s.progres_procent, 0) ELSE 100 END) as progres_mediu_sarcini_active,
          
          -- Critical task load
          COUNT(DISTINCT CASE WHEN s.prioritate = 'Critică' AND s.status != 'Finalizată' THEN s.id END) as sarcini_critice_active
          
        FROM `hale-mode-464009-i6.PanouControlUnitar.SarciniResponsabili` sr
        JOIN `hale-mode-464009-i6.PanouControlUnitar.Sarcini` s ON sr.sarcina_id = s.id
        WHERE s.data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY sr.responsabil_uid
      ),
      
      project_responsibility_load AS (
        SELECT 
          pr.responsabil_uid as utilizator_uid,
          COUNT(DISTINCT pr.proiect_id) as proiecte_responsabil,
          COUNT(DISTINCT CASE WHEN p.Status = 'Activ' THEN pr.proiect_id END) as proiecte_active,
          
          -- Diversitatea rolurilor (poate indica suprasolicitare)
          COUNT(DISTINCT pr.rol_in_proiect) as roluri_diferite,
          
          -- Valoarea proiectelor gestionate (pressure indicator)
          SUM(COALESCE(p.valoare_ron, p.Valoare_Estimata, 0)) as valoare_proiecte_gestionate,
          
          -- Status-uri critice care pot genera stress
          COUNT(DISTINCT CASE 
            WHEN p.status_facturare = 'Nefacturat' 
            AND p.Status = 'Activ' THEN pr.proiect_id 
          END) as proiecte_nefacturate,
          
          COUNT(DISTINCT CASE 
            WHEN p.status_achitare = 'Neachitat' 
            AND p.Status = 'Activ' THEN pr.proiect_id 
          END) as proiecte_neachitate
          
        FROM `hale-mode-464009-i6.PanouControlUnitar.ProiecteResponsabili` pr
        JOIN `hale-mode-464009-i6.PanouControlUnitar.Proiecte` p ON pr.proiect_id = p.ID_Proiect
        GROUP BY pr.responsabil_uid
      ),
      
      work_pattern_analysis AS (
        SELECT 
          tt.utilizator_uid,
          
          -- Consistency indicators
          STDDEV(daily_hours.ore_zilnice) as variabilitate_ore_zilnice,
          
          -- Recovery patterns (măsură indirectă pentru odihnă)
          COUNT(DISTINCT consecutive_days.data_fara_lucru) as zile_pauza,
          
          -- Intensitate temporală
          COUNT(CASE WHEN daily_hours.ore_zilnice > 10 THEN 1 END) as zile_intensive,
          COUNT(CASE WHEN daily_hours.ore_zilnice < 4 THEN 1 END) as zile_usoare,
          
          -- Late work frequency
          AVG(CASE WHEN EXTRACT(HOUR FROM tt.created_at) > 20 THEN 1.0 ELSE 0.0 END) * 100 as frecventa_lucru_noapte
          
        FROM `hale-mode-464009-i6.PanouControlUnitar.TimeTracking` tt
        JOIN (
          SELECT 
            utilizator_uid,
            DATE(data_lucru) as data,
            SUM(ore_lucrate) as ore_zilnice
          FROM `hale-mode-464009-i6.PanouControlUnitar.TimeTracking`
          WHERE data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          GROUP BY utilizator_uid, DATE(data_lucru)
        ) daily_hours ON tt.utilizator_uid = daily_hours.utilizator_uid AND DATE(tt.data_lucru) = daily_hours.data
        LEFT JOIN (
          SELECT 
            dates.data_calendar as data_fara_lucru,
            u.uid as user_uid
          FROM 
            UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY), CURRENT_DATE(), INTERVAL 1 DAY)) as dates(data_calendar)
          CROSS JOIN (SELECT DISTINCT uid FROM `hale-mode-464009-i6.PanouControlUnitar.Utilizatori` WHERE activ = true) u
          WHERE NOT EXISTS (
            SELECT 1 FROM `hale-mode-464009-i6.PanouControlUnitar.TimeTracking` tt2
            WHERE DATE(tt2.data_lucru) = dates.data_calendar 
            AND tt2.utilizator_uid = u.uid
          )
        ) consecutive_days ON tt.utilizator_uid = consecutive_days.user_uid
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY tt.utilizator_uid
      ),
      
      performance_trend_analysis AS (
        SELECT 
          utilizator_uid,
          
          -- Trend săptămânal pentru detectarea degradării performance
          CORR(week_number, avg_weekly_hours) as trend_ore_saptamana,
          CORR(week_number, weekly_efficiency) as trend_eficienta,
          
          -- Variabilitate în performance (indicator instabilitate)
          STDDEV(weekly_efficiency) as variabilitate_eficienta,
          AVG(weekly_efficiency) as eficienta_medie,
          
          -- Recent vs Historical comparison
          AVG(CASE WHEN week_number >= @period/7 - 2 THEN weekly_efficiency END) as eficienta_recenta,
          AVG(CASE WHEN week_number < @period/7 - 2 THEN weekly_efficiency END) as eficienta_istorica
          
        FROM (
          SELECT 
            tt.utilizator_uid,
            EXTRACT(WEEK FROM tt.data_lucru) as week_number,
            AVG(tt.ore_lucrate) as avg_weekly_hours,
            
            -- Efficiency proxy: progres obținut per oră lucrată
            CASE 
              WHEN SUM(tt.ore_lucrate) > 0 THEN
                AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 10
              ELSE 0
            END as weekly_efficiency
            
          FROM `hale-mode-464009-i6.PanouControlUnitar.TimeTracking` tt
          LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.Sarcini` s ON tt.sarcina_id = s.id
          WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          GROUP BY tt.utilizator_uid, EXTRACT(WEEK FROM tt.data_lucru)
        ) weekly_stats
        GROUP BY utilizator_uid
      )
      
      SELECT 
        wa.utilizator_uid,
        wa.utilizator_nume,
        wa.prenume,
        wa.email,
        wa.rol,
        
        -- Workload Metrics
        wa.zile_lucru_total,
        wa.ore_lucrate_total,
        wa.media_ore_per_sesiune,
        wa.max_ore_sesiune,
        wa.frecventa_lucru_procent,
        
        -- Stress Indicators
        wa.zile_weekend,
        wa.sesiuni_ore_tarde,
        wa.sesiuni_overtime,
        wa.ore_overtime_total,
        
        -- Task Pressure
        COALESCE(tpa.sarcini_totale, 0) as sarcini_totale,
        COALESCE(tpa.sarcini_active, 0) as sarcini_active,
        COALESCE(tpa.sarcini_prioritate_ridicata, 0) as sarcini_prioritate_ridicata,
        COALESCE(tpa.sarcini_scadenta_apropiata, 0) as sarcini_scadenta_apropiata,
        COALESCE(tpa.sarcini_intarziate, 0) as sarcini_intarziate,
        COALESCE(tpa.proiecte_simultan, 0) as proiecte_simultan,
        COALESCE(tpa.progres_mediu_sarcini_active, 0) as progres_mediu_sarcini_active,
        COALESCE(tpa.sarcini_critice_active, 0) as sarcini_critice_active,
        
        -- Project Responsibility Load
        COALESCE(prl.proiecte_responsabil, 0) as proiecte_responsabil,
        COALESCE(prl.proiecte_active, 0) as proiecte_active,
        COALESCE(prl.roluri_diferite, 0) as roluri_diferite,
        COALESCE(prl.valoare_proiecte_gestionate, 0) as valoare_proiecte_gestionate,
        COALESCE(prl.proiecte_nefacturate, 0) as proiecte_nefacturate,
        COALESCE(prl.proiecte_neachitate, 0) as proiecte_neachitate,
        
        -- Work Patterns
        COALESCE(wpa.variabilitate_ore_zilnice, 0) as variabilitate_ore_zilnice,
        COALESCE(wpa.zile_pauza, 0) as zile_pauza,
        COALESCE(wpa.zile_intensive, 0) as zile_intensive,
        COALESCE(wpa.zile_usoare, 0) as zile_usoare,
        COALESCE(wpa.frecventa_lucru_noapte, 0) as frecventa_lucru_noapte,
        
        -- Performance Trends
        COALESCE(pta.trend_ore_saptamana, 0) as trend_ore_saptamana,
        COALESCE(pta.trend_eficienta, 0) as trend_eficienta,
        COALESCE(pta.variabilitate_eficienta, 0) as variabilitate_eficienta,
        COALESCE(pta.eficienta_medie, 0) as eficienta_medie,
        COALESCE(pta.eficienta_recenta, 0) as eficienta_recenta,
        COALESCE(pta.eficienta_istorica, 0) as eficienta_istorica
        
      FROM user_workload_analysis wa
      LEFT JOIN task_pressure_analysis tpa ON wa.utilizator_uid = tpa.utilizator_uid
      LEFT JOIN project_responsibility_load prl ON wa.utilizator_uid = prl.utilizator_uid
      LEFT JOIN work_pattern_analysis wpa ON wa.utilizator_uid = wpa.utilizator_uid  
      LEFT JOIN performance_trend_analysis pta ON wa.utilizator_uid = pta.utilizator_uid
      
      WHERE wa.ore_lucrate_total > 0  -- Doar utilizatorii cu activitate în perioada
      ${teamFilter ? `AND wa.utilizator_uid = @teamFilter` : ''}
      ORDER BY wa.ore_lucrate_total DESC
    `;

    // Parametri pentru query
    const queryParams: any = { period: period };
    const queryTypes: any = { period: 'INT64' };

    if (teamFilter) {
      queryParams.teamFilter = teamFilter;
      queryTypes.teamFilter = 'STRING';
    }

    const [rows] = await bigquery.query({
      query: burnoutAnalysisQuery,
      params: queryParams,
      types: queryTypes,
      location: 'EU',
    });

    console.log(`Burnout Analysis: ${rows.length} team members analyzed`);

    // Procesare și calcularea scorurilor de burnout
    const processedData = rows.map((row: any) => {
      // Convertire valori numerice
      const oreLucrateTotal = parseFloat(row.ore_lucrate_total) || 0;
      const mediaOrePerSesiune = parseFloat(row.media_ore_per_sesiune) || 0;
      const maxOreSesiune = parseFloat(row.max_ore_sesiune) || 0;
      const frecventaLucruProcent = parseFloat(row.frecventa_lucru_procent) || 0;
      
      // Stress indicators
      const zileWeekend = parseInt(row.zile_weekend) || 0;
      const sesiuniOreTarde = parseInt(row.sesiuni_ore_tarde) || 0;
      const sesiuniOvertime = parseInt(row.sesiuni_overtime) || 0;
      const oreOvertimeTotal = parseFloat(row.ore_overtime_total) || 0;
      
      // Task pressure
      const sarciniActive = parseInt(row.sarcini_active) || 0;
      const sarciniPrioritateRidicata = parseInt(row.sarcini_prioritate_ridicata) || 0;
      const sarciniScadentaApropiata = parseInt(row.sarcini_scadenta_apropiata) || 0;
      const sarciniIntarziate = parseInt(row.sarcini_intarziate) || 0;
      const proiecteSimultan = parseInt(row.proiecte_simultan) || 0;
      
      // Work patterns
      const variabilitateOreZilnice = parseFloat(row.variabilitate_ore_zilnice) || 0;
      const zilePauza = parseInt(row.zile_pauza) || 0;
      const zileIntensive = parseInt(row.zile_intensive) || 0;
      const frecventaLucruNoapte = parseFloat(row.frecventa_lucru_noapte) || 0;
      
      // Performance trends
      const trendEficienta = parseFloat(row.trend_eficienta) || 0;
      const variabilitateEficienta = parseFloat(row.variabilitate_eficienta) || 0;
      const eficienta_recenta = parseFloat(row.eficienta_recenta) || 0;
      const eficienta_istorica = parseFloat(row.eficienta_istorica) || 0;

      // CALCULAREA SCORULUI DE BURNOUT (0-100)
      let burnoutScore = 0;
      const contributingFactors: string[] = [];
      
      // 1. Overwork indicators (max 25 points)
      if (mediaOrePerSesiune > 9) {
        burnoutScore += 15;
        contributingFactors.push('Sesiuni de lucru foarte lungi (>9h)');
      } else if (mediaOrePerSesiune > 8) {
        burnoutScore += 8;
        contributingFactors.push('Sesiuni de lucru extinse (>8h)');
      }
      
      if (sesiuniOvertime > 5) {
        burnoutScore += 10;
        contributingFactors.push('Frecvența ridicată de overtime');
      }

      // 2. Work-life balance issues (max 20 points)
      if (zileWeekend > 2) {
        burnoutScore += 15;
        contributingFactors.push('Lucru frecvent în weekend');
      } else if (zileWeekend > 0) {
        burnoutScore += 8;
        contributingFactors.push('Lucru ocazional în weekend');
      }
      
      if (frecventaLucruNoapte > 20) {
        burnoutScore += 15;
        contributingFactors.push('Lucru frecvent în ore târzii');
      } else if (frecventaLucruNoapte > 5) {
        burnoutScore += 8;
        contributingFactors.push('Lucru ocazional în ore târzii');
      }

      // 3. Task pressure (max 25 points)
      if (sarciniIntarziate > 0) {
        burnoutScore += Math.min(15, sarciniIntarziate * 5);
        contributingFactors.push(`${sarciniIntarziate} sarcini întârziate`);
      }
      
      if (sarciniScadentaApropiata > 3) {
        burnoutScore += 10;
        contributingFactors.push('Multiple deadline-uri aproape');
      }
      
      if (proiecteSimultan > 5) {
        burnoutScore += 8;
        contributingFactors.push('Multitasking între multe proiecte');
      }

      // 4. Workload consistency issues (max 15 points)
      if (variabilitateOreZilnice > 3) {
        burnoutScore += 10;
        contributingFactors.push('Program de lucru foarte variabil');
      }
      
      if (zilePauza < 2) {
        burnoutScore += 10;
        contributingFactors.push('Lipsă zile de pauză');
      }

      // 5. Performance degradation (max 15 points)
      if (trendEficienta < -0.2) {
        burnoutScore += 12;
        contributingFactors.push('Scădere semnificativă a eficienței');
      } else if (trendEficienta < -0.1) {
        burnoutScore += 6;
        contributingFactors.push('Scădere ușoară a eficienței');
      }
      
      if (eficienta_recenta < eficienta_istorica * 0.8) {
        burnoutScore += 8;
        contributingFactors.push('Performance recentă sub nivelul istoric');
      }

      // Determinarea nivelului de risc
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (burnoutScore >= 75) riskLevel = 'critical';
      else if (burnoutScore >= 50) riskLevel = 'high';
      else if (burnoutScore >= 30) riskLevel = 'medium';
      else riskLevel = 'low';

      // Stress indicators pentru radar chart
      const stressIndicators = {
        overtime_frequency: Math.min(100, (sesiuniOvertime / Math.max(1, parseInt(row.zile_lucru_total))) * 100),
        task_switching: Math.min(100, proiecteSimultan * 10),
        deadline_pressure: Math.min(100, (sarciniScadentaApropiata + sarciniIntarziate * 2) * 10),
        weekend_work: Math.min(100, zileWeekend * 25)
      };

      // Workload trend pentru grafice
      const workloadTrend = Array.from({ length: 7 }, (_, i) => {
        const weekOffset = i - 6;
        const baseValue = oreLucrateTotal / 7;
        const trendAdjustment = parseFloat(row.trend_ore_saptamana || '0') * weekOffset * 5;
        return Math.max(0, Math.round((baseValue + trendAdjustment) * 10) / 10);
      });

      return {
        utilizator_uid: row.utilizator_uid,
        utilizator_nume: `${row.utilizator_nume} ${row.prenume || ''}`.trim(),
        email: row.email,
        rol: row.rol,
        
        // Risk Assessment
        risk_score: Math.min(100, Math.round(burnoutScore)),
        risk_level: riskLevel,
        contributing_factors: contributingFactors,
        
        // Workload Metrics
        total_hours: oreLucrateTotal,
        average_session_hours: Math.round(mediaOrePerSesiune * 10) / 10,
        max_session_hours: maxOreSesiune,
        work_frequency_percent: Math.round(frecventaLucruProcent),
        
        // Stress Indicators (pentru radar chart)
        stress_indicators: stressIndicators,
        
        // Task Load
        active_tasks: sarciniActive,
        high_priority_tasks: sarciniPrioritateRidicata,
        overdue_tasks: sarciniIntarziate,
        upcoming_deadlines: sarciniScadentaApropiata,
        concurrent_projects: proiecteSimultan,
        
        // Work Patterns
        weekend_work_days: zileWeekend,
        late_work_sessions: sesiuniOreTarde,
        overtime_sessions: sesiuniOvertime,
        total_overtime_hours: oreOvertimeTotal,
        work_variability: Math.round(variabilitateOreZilnice * 10) / 10,
        break_days: zilePauza,
        intensive_work_days: zileIntensive,
        night_work_frequency: Math.round(frecventaLucruNoapte),
        
        // Performance Trends
        efficiency_trend: Math.round(trendEficienta * 1000) / 1000,
        efficiency_variability: Math.round(variabilitateEficienta * 10) / 10,
        recent_efficiency: Math.round(eficienta_recenta * 10) / 10,
        historical_efficiency: Math.round(eficienta_istorica * 10) / 10,
        
        // Trend data pentru charts
        workload_trend: workloadTrend,
        
        // Recommended Actions
        recommended_actions: generateRecommendedActions(riskLevel, contributingFactors, {
          sesiuniOvertime,
          zileWeekend,
          sarciniIntarziate,
          proiecteSimultan,
          zilePauza
        })
      };
    });

    // Filtrare pe risk level dacă este specificat
    const filteredData = riskLevelFilter ? 
      processedData.filter(member => member.risk_level === riskLevelFilter) :
      processedData;

    // Calculare statistici echipă
    const teamStats = calculateTeamBurnoutStats(filteredData);

    // Generate insights
    const insights = generateBurnoutInsights(filteredData, teamStats);

    // Historical trends dacă sunt cerute
    const historicalTrends = includeHistoricalTrends ? 
      await generateHistoricalTrends(filteredData, period) : null;

    return NextResponse.json({
      success: true,
      data: filteredData,
      team_statistics: teamStats,
      insights: insights,
      historical_trends: historicalTrends,
      meta: {
        period: parseInt(period),
        team_members_analyzed: filteredData.length,
        filters: {
          team_member: teamFilter,
          risk_level: riskLevelFilter
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare Burnout Analysis API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la analiza burnout' },
      { status: 500 }
    );
  }
}

// Funcție pentru generarea acțiunilor recomandate
function generateRecommendedActions(
  riskLevel: string, 
  contributingFactors: string[], 
  metrics: any
): string[] {
  const actions: string[] = [];

  if (riskLevel === 'critical') {
    actions.push('URGENT: Redistributie imediată a sarcinilor');
    actions.push('Programare întâlnire cu managementul pentru rebalansare workload');
    actions.push('Implementare măsuri de protecție împotriva burnout-ului');
  }

  if (riskLevel === 'high' || riskLevel === 'critical') {
    actions.push('Reducere temporară a responsabilităților');
    actions.push('Delegate task-uri secundare către alți membri ai echipei');
  }

  if (metrics.sesiuniOvertime > 5) {
    actions.push('Limitare overtime la maximum 2 sesiuni pe săptămână');
    actions.push('Analiză eficiență pentru optimizarea timpului de lucru');
  }

  if (metrics.zileWeekend > 0) {
    actions.push('Implementare politică "no work weekends"');
    actions.push('Planificare proactivă pentru evitarea lucrului în weekend');
  }

  if (metrics.sarciniIntarziate > 0) {
    actions.push('Prioritizare și restructurare deadline-uri');
    actions.push('Evaluare realistă a capacității de lucru');
  }

  if (metrics.proiecteSimultan > 5) {
    actions.push('Reducere numărul de proiecte simultane');
    actions.push('Implementare time-blocking pentru focus pe proiecte prioritare');
  }

  if (metrics.zilePauza < 2) {
    actions.push('Programare obligatorie zile de pauză');
    actions.push('Educație despre importanța recovery time');
  }

  // Acțiuni generale preventive
  if (riskLevel === 'medium') {
    actions.push('Monitorizare îndeaproape a indicatorilor de stress');
    actions.push('Implementare practici de wellness și management stress');
  }

  return actions.slice(0, 6); // Maximum 6 acțiuni pentru claritate
}

// Calculare statistici echipă
function calculateTeamBurnoutStats(teamMembers: any[]): any {
  if (teamMembers.length === 0) return {};

  const totalMembers = teamMembers.length;
  const criticalRisk = teamMembers.filter(m => m.risk_level === 'critical').length;
  const highRisk = teamMembers.filter(m => m.risk_level === 'high').length;
  const mediumRisk = teamMembers.filter(m => m.risk_level === 'medium').length;
  const lowRisk = teamMembers.filter(m => m.risk_level === 'low').length;

  const avgRiskScore = teamMembers.reduce((sum, m) => sum + m.risk_score, 0) / totalMembers;
  const avgWorkHours = teamMembers.reduce((sum, m) => sum + m.total_hours, 0) / totalMembers;
  const totalOvertimeHours = teamMembers.reduce((sum, m) => sum + m.total_overtime_hours, 0);

  return {
    total_team_members: totalMembers,
    risk_distribution: {
      critical: criticalRisk,
      high: highRisk,
      medium: mediumRisk,
      low: lowRisk
    },
    risk_percentages: {
      critical: Math.round((criticalRisk / totalMembers) * 100),
      high: Math.round((highRisk / totalMembers) * 100),
      medium: Math.round((mediumRisk / totalMembers) * 100),
      low: Math.round((lowRisk / totalMembers) * 100)
    },
    team_averages: {
      risk_score: Math.round(avgRiskScore * 10) / 10,
      work_hours: Math.round(avgWorkHours * 10) / 10,
      overtime_hours: Math.round(totalOvertimeHours / totalMembers * 10) / 10
    },
    team_health_score: Math.round((100 - avgRiskScore) * 10) / 10
  };
}

// Generare insights burnout
function generateBurnoutInsights(teamMembers: any[], teamStats: any): any[] {
  const insights = [];

  const criticalMembers = teamMembers.filter(m => m.risk_level === 'critical');
  const highRiskMembers = teamMembers.filter(m => m.risk_level === 'high');
  
  if (criticalMembers.length > 0) {
    insights.push({
      type: 'danger',
      title: 'Risc Critical de Burnout',
      description: `${criticalMembers.length} membri cu risc critical`,
      value: criticalMembers.map(m => m.utilizator_nume).join(', '),
      recommendation: 'Acțiune imediată necesară pentru rebalansarea workload-ului'
    });
  }

  if (highRiskMembers.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Risc Ridicat de Burnout',
      description: `${highRiskMembers.length} membri cu risc ridicat`,
      value: `Scor mediu risc: ${Math.round(highRiskMembers.reduce((sum, m) => sum + m.risk_score, 0) / highRiskMembers.length)}`,
      recommendation: 'Implementare măsuri preventive și monitorizare atentă'
    });
  }

  const overtimeMembers = teamMembers.filter(m => m.total_overtime_hours > 20);
  if (overtimeMembers.length > 0) {
    insights.push({
      type: 'info',
      title: 'Overtime Exces',
      description: `${overtimeMembers.length} membri cu peste 20h overtime`,
      value: `${Math.round(overtimeMembers.reduce((sum, m) => sum + m.total_overtime_hours, 0))}h overtime total`,
      recommendation: 'Revizuire procese pentru reducerea necesității de overtime'
    });
  }

  if (teamStats.team_health_score > 80) {
    insights.push({
      type: 'success',
      title: 'Echipă Sănătoasă',
      description: `Scor sănătate echipă: ${teamStats.team_health_score}`,
      value: 'Risc scăzut general de burnout',
      recommendation: 'Menținere practici actuale și monitorizare preventivă'
    });
  }

  return insights;
}

// Generare tendințe istorice (simplificat pentru demo)
async function generateHistoricalTrends(teamMembers: any[], period: string): Promise<any> {
  // În implementarea reală, ar face query-uri suplimentare pentru date istorice
  // Pentru demo, simulez tendințele
  
  return {
    team_risk_trend: Array.from({ length: 12 }, (_, i) => ({
      month: `Month ${i + 1}`,
      average_risk_score: Math.max(20, 60 - Math.random() * 20),
      critical_members: Math.floor(Math.random() * 3),
      high_risk_members: Math.floor(Math.random() * 5)
    })),
    burnout_prevention_effectiveness: {
      actions_taken: 15,
      risk_reduction: 25,
      team_satisfaction_improvement: 18
    }
  };
}
