// ==================================================================
// CALEA: app/api/analytics/team-performance/route.ts
// CREAT: 14.09.2025 17:00 (ora României)
// DESCRIERE: API extins pentru analiza detaliată performance echipă
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
    const period = searchParams.get('period') || '30';
    const detailed = searchParams.get('detailed') === 'true';
    const userId = searchParams.get('user_id');
    const includeInsights = searchParams.get('include_insights') === 'true';
    const includeTrends = searchParams.get('include_trends') === 'true';

    // Query principal cu toate calculele avansate
    const teamPerformanceQuery = `
      WITH base_stats AS (
        SELECT 
          u.uid as utilizator_uid,
          CONCAT(u.nume, ' ', u.prenume) as utilizator_nume,
          u.rol,
          
          -- Time tracking stats
          COALESCE(SUM(tt.ore_lucrate), 0) as total_ore,
          COALESCE(AVG(tt.ore_lucrate), 0) as media_ore_zilnic,
          COUNT(DISTINCT tt.data_lucru) as zile_active,
          
          -- Proiecte și sarcini
          COUNT(DISTINCT tt.proiect_id) as proiecte_lucrate,
          COUNT(DISTINCT s.id) as sarcini_lucrate,
          
          -- Distribuție priorități
          SUM(CASE WHEN s.prioritate = 'urgent' THEN COALESCE(tt.ore_lucrate, 0) ELSE 0 END) as ore_urgent,
          SUM(CASE WHEN s.prioritate = 'ridicata' THEN COALESCE(tt.ore_lucrate, 0) ELSE 0 END) as ore_ridicata,
          SUM(CASE WHEN s.prioritate = 'normala' THEN COALESCE(tt.ore_lucrate, 0) ELSE 0 END) as ore_normala,
          SUM(CASE WHEN s.prioritate = 'scazuta' THEN COALESCE(tt.ore_lucrate, 0) ELSE 0 END) as ore_scazuta,
          
          -- Calcul eficiență (ore lucrate vs estimate)
          CASE 
            WHEN SUM(COALESCE(s.timp_estimat_total_ore, 0)) > 0 
            THEN ROUND(
              (SUM(COALESCE(tt.ore_lucrate, 0)) / SUM(COALESCE(s.timp_estimat_total_ore, 1))) * 100, 
              1
            )
            ELSE 100
          END as eficienta_procent,
          
          -- Sarcini la timp vs întârziate
          COUNT(CASE 
            WHEN s.data_scadenta >= s.data_finalizare OR s.status = 'finalizata'
            THEN 1 
          END) as sarcini_la_timp,
          COUNT(CASE 
            WHEN s.data_scadenta < CURRENT_DATE() AND s.status != 'finalizata'
            THEN 1 
          END) as sarcini_intarziate,
          
          -- Pentru calcul burnout și workload
          SUM(COALESCE(tt.ore_lucrate, 0)) / NULLIF(COUNT(DISTINCT tt.data_lucru), 0) as media_ore_per_zi_activa,
          
          -- Pentru trend săptămânal (compară ultima săptămână cu penultima)
          SUM(CASE 
            WHEN tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            THEN COALESCE(tt.ore_lucrate, 0) 
            ELSE 0 
          END) as ore_ultima_saptamana,
          SUM(CASE 
            WHEN tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
            AND tt.data_lucru < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            THEN COALESCE(tt.ore_lucrate, 0) 
            ELSE 0 
          END) as ore_penultima_saptamana
          
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\` u
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.TimeTracking\` tt 
          ON u.uid = tt.utilizator_uid 
          AND tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\` s 
          ON tt.sarcina_id = s.id
        WHERE u.activ = true
          AND u.rol IN ('admin', 'manager', 'developer', 'designer', 'analyst')
          ${userId ? 'AND u.uid = @userId' : ''}
        GROUP BY u.uid, u.nume, u.prenume, u.rol
        HAVING total_ore > 0  -- Doar utilizatori cu activitate
      ),
      
      team_averages AS (
        SELECT 
          AVG(eficienta_procent) as media_eficienta_echipa,
          AVG(media_ore_per_zi_activa) as media_ore_echipa,
          AVG(total_ore / zile_active) as media_productivitate_echipa
        FROM base_stats
      ),
      
      enhanced_stats AS (
        SELECT 
          bs.*,
          ta.media_eficienta_echipa,
          ta.media_ore_echipa,
          
          -- Trend calculation
          CASE 
            WHEN bs.ore_penultima_saptamana = 0 THEN 'stable'
            WHEN bs.ore_ultima_saptamana > bs.ore_penultima_saptamana * 1.1 THEN 'up'
            WHEN bs.ore_ultima_saptamana < bs.ore_penultima_saptamana * 0.9 THEN 'down'
            ELSE 'stable'
          END as trend_saptamanal,
          
          -- Workload status calculation
          CASE 
            WHEN bs.media_ore_per_zi_activa < 6 THEN 'under'
            WHEN bs.media_ore_per_zi_activa > 9 THEN 'over'
            ELSE 'optimal'
          END as workload_status,
          
          -- Burnout risk calculation (multiple factors)
          CASE 
            WHEN bs.media_ore_per_zi_activa > 10 
              OR (bs.ore_urgent + bs.ore_ridicata) / bs.total_ore > 0.7
              OR bs.sarcini_intarziate > bs.sarcini_la_timp 
            THEN 'high'
            WHEN bs.media_ore_per_zi_activa > 8.5 
              OR (bs.ore_urgent + bs.ore_ridicata) / bs.total_ore > 0.5
              OR bs.eficienta_procent < 70
            THEN 'medium'
            ELSE 'low'
          END as burnout_risk
          
        FROM base_stats bs
        CROSS JOIN team_averages ta
      )
      
      SELECT 
        utilizator_uid,
        utilizator_nume,
        rol,
        total_ore,
        media_ore_zilnic,
        zile_active,
        proiecte_lucrate,
        sarcini_lucrate,
        eficienta_procent,
        ore_urgent,
        ore_ridicata,
        ore_normala,
        ore_scazuta,
        sarcini_la_timp,
        sarcini_intarziate,
        ROUND(media_eficienta_echipa, 1) as media_echipa,
        trend_saptamanal,
        workload_status,
        burnout_risk,
        
        -- Skills categories simulare (în viitor din tabel dedicat)
        JSON_OBJECT(
          'Frontend', ROUND(ore_normala / total_ore * 100, 1),
          'Backend', ROUND(ore_ridicata / total_ore * 100, 1),
          'Management', ROUND(ore_urgent / total_ore * 100, 1),
          'Design', ROUND(ore_scazuta / total_ore * 100, 1)
        ) as skill_categories,
        
        -- Performance insights
        ${detailed ? `
        ARRAY[
          CASE 
            WHEN eficienta_procent > media_eficienta_echipa + 20 
            THEN 'Top performer - consideră responsabilități suplimentare'
            WHEN eficienta_procent < media_eficienta_echipa - 20 
            THEN 'Necesită suport - revizuire procese sau training'
            WHEN workload_status = 'over' 
            THEN 'Risc overload - redistribuie sarcini'
            WHEN burnout_risk = 'high' 
            THEN 'Alert burnout - planifică pauze și reducere presiune'
            WHEN sarcini_intarziate > sarcini_la_timp 
            THEN 'Probleme deadline - optimizare time management'
            ELSE 'Performance în parametri normali'
          END
        ] as insights,
        ` : ''}
        
        -- Comparison metrics
        ROUND(eficienta_procent - media_eficienta_echipa, 1) as delta_eficienta,
        ROUND(media_ore_per_zi_activa - media_ore_echipa, 1) as delta_productivitate,
        
        -- Weekly comparison
        ore_ultima_saptamana,
        ore_penultima_saptamana,
        CASE 
          WHEN ore_penultima_saptamana > 0 
          THEN ROUND(((ore_ultima_saptamana - ore_penultima_saptamana) / ore_penultima_saptamana) * 100, 1)
          ELSE 0 
        END as procent_schimbare_saptamanala
        
      FROM enhanced_stats
      ORDER BY eficienta_procent DESC, total_ore DESC
    `;

    const queryParams = [
      { name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }
    ];

    if (userId) {
      queryParams.push({ 
        name: 'userId', 
        parameterType: { type: 'STRING' }, 
        parameterValue: { value: userId } 
      });
    }

    const [rows] = await bigquery.query({
      query: teamPerformanceQuery,
      location: 'EU',
      params: queryParams,
    });

    // Calculez statistici agregat pentru echipă
    const teamStats = {
      total_members: rows.length,
      avg_efficiency: rows.length > 0 ? rows.reduce((sum, member) => sum + member.eficienta_procent, 0) / rows.length : 0,
      total_hours: rows.reduce((sum, member) => sum + member.total_ore, 0),
      active_projects: new Set(rows.flatMap(member => Array(member.proiecte_lucrate).fill(member.utilizator_uid))).size,
      
      // Distribution analysis
      high_performers: rows.filter(m => m.eficienta_procent > 120).length,
      average_performers: rows.filter(m => m.eficienta_procent >= 80 && m.eficienta_procent <= 120).length,
      needs_support: rows.filter(m => m.eficienta_procent < 80).length,
      
      // Risk analysis
      burnout_high_risk: rows.filter(m => m.burnout_risk === 'high').length,
      burnout_medium_risk: rows.filter(m => m.burnout_risk === 'medium').length,
      overloaded_members: rows.filter(m => m.workload_status === 'over').length,
      underutilized_members: rows.filter(m => m.workload_status === 'under').length,
      
      // Trend analysis
      improving_trend: rows.filter(m => m.trend_saptamanal === 'up').length,
      declining_trend: rows.filter(m => m.trend_saptamanal === 'down').length,
      stable_trend: rows.filter(m => m.trend_saptamanal === 'stable').length
    };

    // Team-level insights
    const teamInsights = [];
    
    if (teamStats.burnout_high_risk > teamStats.total_members * 0.3) {
      teamInsights.push('⚠️ Risc burnout ridicat în echipă - redistribuie workload-ul');
    }
    
    if (teamStats.needs_support > teamStats.total_members * 0.25) {
      teamInsights.push('📚 Mai mulți membri necesită training sau suport suplimentar');
    }
    
    if (teamStats.declining_trend > teamStats.improving_trend) {
      teamInsights.push('📉 Trend descendent general - investighează cauzele');
    }
    
    if (teamStats.overloaded_members > 0) {
      teamInsights.push('🔄 Echilibrează distribuția sarcinilor între membri');
    }
    
    if (teamStats.high_performers > 0) {
      teamInsights.push('🌟 Valorifică experiența top performers pentru mentoring');
    }

    // Recommendations pe baza analizei
    const recommendations = [];
    
    if (teamStats.avg_efficiency < 90) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        title: 'Îmbunătățire Eficiență',
        description: 'Eficiența echipei sub standardele optime. Revizuire procese și optimizare workflow.',
        actions: ['Review procese de lucru', 'Training time management', 'Optimizare tools și resurse']
      });
    }

    if (teamStats.burnout_high_risk > 0) {
      recommendations.push({
        type: 'wellbeing',
        priority: 'urgent',
        title: 'Prevenire Burnout',
        description: `${teamStats.burnout_high_risk} membri cu risc ridicat de burnout.`,
        actions: ['Redistribuie sarcinile', 'Planifică pauze', 'One-on-one check-ins']
      });
    }

    if (teamStats.underutilized_members > 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Optimizare Resurse',
        description: `${teamStats.underutilized_members} membri subutilizați.`,
        actions: ['Realocă responsabilități', 'Proiecte suplimentare', 'Training cross-functional']
      });
    }

    return NextResponse.json({
      success: true,
      data: rows,
      team_stats: teamStats,
      team_insights: teamInsights,
      recommendations: recommendations,
      meta: {
        period: parseInt(period),
        detailed: detailed,
        user_id: userId,
        total_members: rows.length,
        analysis_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare team performance API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor de performance echipă' },
      { status: 500 }
    );
  }
}
