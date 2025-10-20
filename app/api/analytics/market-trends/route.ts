// ==================================================================
// CALEA: app/api/analytics/market-trends/route.ts
// CREAT: 16.09.2025 12:50 (ora României)
// DESCRIERE: API pentru market trends și skills investment cu demand analysis și strategic recommendations
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
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;

console.log(`🔧 Market Trends API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Sarcini${tableSuffix}, TimeTracking${tableSuffix}`);

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
    const period = searchParams.get('period') || '180'; // 6 luni pentru trend analysis
    const skillCategory = searchParams.get('skill_category');
    const includeForecasts = searchParams.get('include_forecasts') !== 'false';
    const includeCompetitorAnalysis = searchParams.get('include_competitor_analysis') !== 'false';
    const region = searchParams.get('region') || 'Romania';

    // Query pentru analiza market trends
    const marketTrendsQuery = `
      WITH skills_taxonomy AS (
        SELECT 
          skill_name,
          skill_category,
          base_market_rate,
          demand_multiplier,
          complexity_level,
          market_saturation
        FROM UNNEST([
          STRUCT('Frontend Development' as skill_name, 'Technical' as skill_category, 120.0 as base_market_rate, 1.4 as demand_multiplier, 'High' as complexity_level, 0.7 as market_saturation),
          STRUCT('Backend Development', 'Technical', 135.0, 1.6, 'High', 0.6),
          STRUCT('Full Stack Development', 'Technical', 150.0, 1.8, 'Expert', 0.5),
          STRUCT('UI/UX Design', 'Creative', 110.0, 1.3, 'Medium', 0.8),
          STRUCT('Mobile Development', 'Technical', 145.0, 1.7, 'High', 0.4),
          STRUCT('DevOps/Infrastructure', 'Technical', 160.0, 1.9, 'Expert', 0.3),
          STRUCT('Data Science', 'Analytical', 175.0, 2.1, 'Expert', 0.2),
          STRUCT('Machine Learning', 'Analytical', 190.0, 2.3, 'Expert', 0.15),
          STRUCT('Cloud Architecture', 'Technical', 180.0, 2.0, 'Expert', 0.25),
          STRUCT('Cybersecurity', 'Technical', 170.0, 1.95, 'Expert', 0.2),
          STRUCT('Project Management', 'Management', 100.0, 1.2, 'Medium', 0.9),
          STRUCT('Product Management', 'Management', 130.0, 1.5, 'High', 0.6),
          STRUCT('Business Analysis', 'Analytical', 105.0, 1.25, 'Medium', 0.8),
          STRUCT('Quality Assurance', 'Technical', 90.0, 1.1, 'Medium', 0.85),
          STRUCT('Technical Writing', 'Communication', 85.0, 1.0, 'Medium', 0.9),
          STRUCT('Sales & Marketing', 'Business', 95.0, 1.15, 'Medium', 0.85),
          STRUCT('General Development', 'Technical', 100.0, 1.0, 'Medium', 1.0)
        ])
      ),
      
      internal_skills_analysis AS (
        SELECT 
          CASE 
            WHEN LOWER(s.titlu) LIKE '%frontend%' OR LOWER(s.titlu) LIKE '%react%' OR LOWER(s.titlu) LIKE '%javascript%' OR LOWER(s.titlu) LIKE '%vue%' OR LOWER(s.titlu) LIKE '%angular%' THEN 'Frontend Development'
            WHEN LOWER(s.titlu) LIKE '%backend%' OR LOWER(s.titlu) LIKE '%api%' OR LOWER(s.titlu) LIKE '%database%' OR LOWER(s.titlu) LIKE '%server%' THEN 'Backend Development'
            WHEN LOWER(s.titlu) LIKE '%fullstack%' OR LOWER(s.titlu) LIKE '%full stack%' OR LOWER(s.titlu) LIKE '%full-stack%' THEN 'Full Stack Development'
            WHEN LOWER(s.titlu) LIKE '%design%' OR LOWER(s.titlu) LIKE '%ui%' OR LOWER(s.titlu) LIKE '%ux%' OR LOWER(s.titlu) LIKE '%figma%' THEN 'UI/UX Design'
            WHEN LOWER(s.titlu) LIKE '%mobile%' OR LOWER(s.titlu) LIKE '%android%' OR LOWER(s.titlu) LIKE '%ios%' OR LOWER(s.titlu) LIKE '%flutter%' THEN 'Mobile Development'
            WHEN LOWER(s.titlu) LIKE '%devops%' OR LOWER(s.titlu) LIKE '%infra%' OR LOWER(s.titlu) LIKE '%deploy%' OR LOWER(s.titlu) LIKE '%docker%' OR LOWER(s.titlu) LIKE '%kubernetes%' THEN 'DevOps/Infrastructure'
            WHEN LOWER(s.titlu) LIKE '%data%' OR LOWER(s.titlu) LIKE '%analytic%' OR LOWER(s.titlu) LIKE '%science%' OR LOWER(s.titlu) LIKE '%python%' THEN 'Data Science'
            WHEN LOWER(s.titlu) LIKE '%machine%' OR LOWER(s.titlu) LIKE '%ai%' OR LOWER(s.titlu) LIKE '%ml%' OR LOWER(s.titlu) LIKE '%artificial%' THEN 'Machine Learning'
            WHEN LOWER(s.titlu) LIKE '%cloud%' OR LOWER(s.titlu) LIKE '%aws%' OR LOWER(s.titlu) LIKE '%azure%' OR LOWER(s.titlu) LIKE '%gcp%' THEN 'Cloud Architecture'
            WHEN LOWER(s.titlu) LIKE '%security%' OR LOWER(s.titlu) LIKE '%cyber%' OR LOWER(s.titlu) LIKE '%auth%' THEN 'Cybersecurity'
            WHEN LOWER(s.titlu) LIKE '%manage%' OR LOWER(s.titlu) LIKE '%plan%' OR LOWER(s.titlu) LIKE '%coordon%' OR LOWER(s.titlu) LIKE '%scrum%' THEN 'Project Management'
            WHEN LOWER(s.titlu) LIKE '%product%' OR LOWER(s.titlu) LIKE '%roadmap%' OR LOWER(s.titlu) LIKE '%strategy%' THEN 'Product Management'
            WHEN LOWER(s.titlu) LIKE '%analiz%' OR LOWER(s.titlu) LIKE '%research%' OR LOWER(s.titlu) LIKE '%requirement%' THEN 'Business Analysis'
            WHEN LOWER(s.titlu) LIKE '%test%' OR LOWER(s.titlu) LIKE '%qa%' OR LOWER(s.titlu) LIKE '%quality%' THEN 'Quality Assurance'
            WHEN LOWER(s.titlu) LIKE '%document%' OR LOWER(s.titlu) LIKE '%write%' OR LOWER(s.titlu) LIKE '%content%' THEN 'Technical Writing'
            WHEN LOWER(s.titlu) LIKE '%sales%' OR LOWER(s.titlu) LIKE '%marketing%' OR LOWER(s.titlu) LIKE '%client%' THEN 'Sales & Marketing'
            ELSE 'General Development'
          END as skill_category,
          
          COUNT(*) as internal_tasks_count,
          COUNT(DISTINCT tt.utilizator_uid) as internal_specialists,
          SUM(tt.ore_lucrate) as total_hours_invested,
          AVG(tt.ore_lucrate) as avg_hours_per_task,
          
          CASE 
            WHEN AVG(COALESCE(s.progres_procent, 0)) >= 95 THEN 10
            WHEN AVG(COALESCE(s.progres_procent, 0)) >= 85 THEN 8
            WHEN AVG(COALESCE(s.progres_procent, 0)) >= 75 THEN 7
            WHEN AVG(COALESCE(s.progres_procent, 0)) >= 65 THEN 6
            WHEN AVG(COALESCE(s.progres_procent, 0)) >= 50 THEN 5
            ELSE 3
          END as team_expertise_level,
          
          COUNT(CASE WHEN tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN 1 END) as recent_tasks,
          COUNT(CASE WHEN tt.data_lucru BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) 
                                          AND DATE_SUB(CURRENT_DATE(), INTERVAL 31 DAY) THEN 1 END) as previous_tasks,
          
          CASE 
            WHEN SUM(tt.ore_lucrate) > 0 THEN
              AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 100
            ELSE 0
          END as skill_efficiency,
          
          AVG(
            CASE 
              WHEN s.prioritate = 'Critică' THEN 5
              WHEN s.prioritate = 'Înaltă' THEN 4
              WHEN s.prioritate = 'Medie' THEN 3
              ELSE 2
            END
          ) as avg_project_complexity,
          
          COUNT(*) * 
          CASE 
            WHEN LOWER(s.titlu) LIKE '%machine%' OR LOWER(s.titlu) LIKE '%ai%' THEN 190.0
            WHEN LOWER(s.titlu) LIKE '%cloud%' OR LOWER(s.titlu) LIKE '%devops%' THEN 170.0
            WHEN LOWER(s.titlu) LIKE '%fullstack%' OR LOWER(s.titlu) LIKE '%backend%' THEN 140.0
            ELSE 110.0
          END as estimated_revenue_impact
          
        FROM ${TABLE_SARCINI} s
        JOIN ${TABLE_TIME_TRACKING} tt ON s.id = tt.sarcina_id
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY skill_category
      ),
      
      market_demand_simulation AS (
        SELECT 
          st.skill_name as skill_category,
          st.skill_category as category_type,
          st.base_market_rate,
          st.demand_multiplier,
          st.complexity_level,
          st.market_saturation,
          
          CASE 
            WHEN st.skill_name IN ('Machine Learning', 'Data Science', 'Cloud Architecture') THEN 'rising'
            WHEN st.skill_name IN ('DevOps/Infrastructure', 'Cybersecurity', 'Mobile Development') THEN 'rising'
            WHEN st.skill_name IN ('Frontend Development', 'Backend Development', 'Full Stack Development') THEN 'stable'
            WHEN st.skill_name IN ('Project Management', 'Quality Assurance') THEN 'stable'
            ELSE 'declining'
          END as market_trend,
          
          st.base_market_rate * 
          CASE 
            WHEN @region = 'Romania' THEN 0.6
            WHEN @region = 'Europe' THEN 0.85
            ELSE 1.0
          END as adjusted_market_value,
          
          LEAST(100, GREATEST(10, 
            CAST(st.demand_multiplier * 35 + (1 - st.market_saturation) * 45 + 
            CASE st.complexity_level 
              WHEN 'Expert' THEN 20
              WHEN 'High' THEN 15
              WHEN 'Medium' THEN 10
              ELSE 5
            END AS FLOAT64)
          )) as market_demand_score,
          
          CASE 
            WHEN st.demand_multiplier > 1.8 AND st.market_saturation < 0.4 THEN 'high'
            WHEN st.demand_multiplier > 1.4 AND st.market_saturation < 0.7 THEN 'medium'
            ELSE 'low'
          END as investment_priority,
          
          CASE st.skill_name
            WHEN 'Machine Learning' THEN 'Creștere 45% în următorii 2 ani'
            WHEN 'Cloud Architecture' THEN 'Creștere 35% cu focus pe multi-cloud'
            WHEN 'Cybersecurity' THEN 'Creștere 40% datorită amenințărilor crescute'
            WHEN 'DevOps/Infrastructure' THEN 'Creștere 30% pentru automatizare'
            WHEN 'Data Science' THEN 'Creștere 25% în toate industriile'
            WHEN 'Mobile Development' THEN 'Creștere 20% cu focus pe cross-platform'
            WHEN 'Full Stack Development' THEN 'Stabil cu creștere 15%'
            WHEN 'Frontend Development' THEN 'Stabil cu evoluție către modern frameworks'
            WHEN 'Backend Development' THEN 'Stabil cu migrare către microservices'
            ELSE 'Creștere moderată 10-15%'
          END as market_projection
          
        FROM skills_taxonomy st
      ),
      
      competitive_analysis AS (
        SELECT 
          skill_category,
          
          CASE 
            WHEN skill_category IN ('Machine Learning', 'Data Science') THEN 85.0
            WHEN skill_category IN ('Cloud Architecture', 'DevOps/Infrastructure') THEN 75.0
            WHEN skill_category IN ('Frontend Development', 'Backend Development') THEN 90.0
            WHEN skill_category IN ('Cybersecurity', 'Mobile Development') THEN 60.0
            ELSE 70.0
          END as market_competition_intensity,
          
          CASE 
            WHEN skill_category LIKE '%Management%' THEN 'Medium - Experience required'
            WHEN skill_category IN ('Machine Learning', 'Data Science', 'Cloud Architecture') THEN 'High - Specialized knowledge needed'
            WHEN skill_category IN ('Frontend Development', 'Backend Development') THEN 'Low - Many resources available'
            ELSE 'Medium - Standard technical skills'
          END as entry_barriers,
          
          CASE 
            WHEN skill_category = 'Machine Learning' THEN '["AI consultancy", "Process automation", "Predictive analytics"]'
            WHEN skill_category = 'Cloud Architecture' THEN '["Cloud migration", "Multi-cloud strategy", "Cost optimization"]'
            WHEN skill_category = 'Cybersecurity' THEN '["Security audits", "Compliance consulting", "Incident response"]'
            WHEN skill_category = 'Mobile Development' THEN '["Cross-platform apps", "IoT integration", "AR/VR applications"]'
            ELSE '["Custom development", "Consulting services", "Training programs"]'
          END as market_opportunities
          
        FROM market_demand_simulation
      )
      
      SELECT 
        mds.skill_category,
        mds.category_type,
        mds.adjusted_market_value as market_value,
        mds.market_trend as demand_trend,
        mds.market_demand_score,
        mds.investment_priority,
        mds.market_projection,
        
        COALESCE(isa.team_expertise_level, 2) as team_expertise,
        COALESCE(isa.internal_specialists, 0) as internal_specialists_count,
        COALESCE(isa.total_hours_invested, 0) as internal_hours_invested,
        COALESCE(isa.skill_efficiency, 0) as internal_efficiency,
        COALESCE(isa.estimated_revenue_impact, 0) as estimated_revenue_impact,
        
        CASE 
          WHEN COALESCE(isa.recent_tasks, 0) > COALESCE(isa.previous_tasks, 1) THEN 'increasing'
          WHEN COALESCE(isa.recent_tasks, 0) < COALESCE(isa.previous_tasks, 0) THEN 'decreasing'  
          ELSE 'stable'
        END as internal_trend,
        
        CASE 
          WHEN COALESCE(isa.previous_tasks, 0) > 0 THEN
            ROUND((COALESCE(isa.recent_tasks, 0) - COALESCE(isa.previous_tasks, 0)) / COALESCE(isa.previous_tasks, 0) * 100)
          ELSE 0
        END as internal_growth_rate,
        
        CASE 
          WHEN mds.investment_priority = 'high' AND COALESCE(isa.team_expertise_level, 2) < 6 THEN 'critical_gap'
          WHEN mds.investment_priority = 'high' AND COALESCE(isa.team_expertise_level, 2) >= 6 THEN 'scale_opportunity'
          WHEN mds.investment_priority = 'medium' AND COALESCE(isa.team_expertise_level, 2) < 4 THEN 'development_needed'
          WHEN mds.investment_priority = 'low' AND COALESCE(isa.team_expertise_level, 2) > 7 THEN 'overinvestment_risk'
          ELSE 'balanced'
        END as strategic_position,
        
        ca.market_competition_intensity,
        ca.entry_barriers,
        ca.market_opportunities,
        
        CASE 
          WHEN mds.investment_priority = 'high' THEN
            GREATEST(0, (mds.adjusted_market_value * mds.demand_multiplier * 12) - (COALESCE(isa.internal_specialists, 1) * 60000))
          WHEN mds.investment_priority = 'medium' THEN  
            GREATEST(0, (mds.adjusted_market_value * mds.demand_multiplier * 8) - (COALESCE(isa.internal_specialists, 1) * 45000))
          ELSE
            GREATEST(0, (mds.adjusted_market_value * mds.demand_multiplier * 4) - (COALESCE(isa.internal_specialists, 1) * 30000))
        END as projected_annual_roi,
        
        CASE 
          WHEN mds.investment_priority = 'high' AND COALESCE(isa.team_expertise_level, 2) < 6 THEN
            '["Urgent hiring pentru acest skill", "Training intensiv echipa existentă", "Partnership cu specialiști externi"]'
          WHEN mds.investment_priority = 'high' AND COALESCE(isa.team_expertise_level, 2) >= 6 THEN
            '["Scalare echipa cu 2-3 specialiști", "Dezvoltare expertise avansată", "Marketing specializat pe acest nișă"]'
          WHEN mds.investment_priority = 'medium' THEN
            '["Cross-training membri echipei", "Selective hiring", "Monitorizare trend piață"]'
          ELSE
            '["Menținere nivel curent", "Realocarea resurse către skills prioritare", "Evaluare periodică relevanță"]'
        END as recommended_actions
        
      FROM market_demand_simulation mds
      LEFT JOIN internal_skills_analysis isa ON mds.skill_category = isa.skill_category
      LEFT JOIN competitive_analysis ca ON mds.skill_category = ca.skill_category
      
      WHERE 1=1
      ${skillCategory ? `AND mds.skill_category = @skillCategory` : ''}
      
      ORDER BY 
        mds.market_demand_score DESC,
        mds.investment_priority DESC,
        COALESCE(isa.team_expertise_level, 0) ASC
    `;

    // Parametri pentru query
    const queryParams: any = { 
      period: period,
      region: region 
    };
    const queryTypes: any = { 
      period: 'INT64',
      region: 'STRING'
    };

    if (skillCategory) {
      queryParams.skillCategory = skillCategory;
      queryTypes.skillCategory = 'STRING';
    }

    const [rows] = await bigquery.query({
      query: marketTrendsQuery,
      params: queryParams,
      types: queryTypes,
      location: 'EU',
    });

    console.log(`Market Trends Analysis: ${rows.length} skills analyzed`);

    // Procesare și îmbunătățire date
    const processedData = rows.map((row: any) => {
      const marketValue = parseFloat(row.market_value) || 0;
      const marketDemandScore = parseFloat(row.market_demand_score) || 0;
      const teamExpertise = parseInt(row.team_expertise) || 0;
      const internalGrowthRate = parseFloat(row.internal_growth_rate) || 0;
      const projectedROI = parseFloat(row.projected_annual_roi) || 0;
      const competitionIntensity = parseFloat(row.market_competition_intensity) || 50;

      // Parse JSON arrays pentru opportunities și actions
      let marketOpportunities: string[] = [];
      let recommendedActions: string[] = [];
      
      try {
        marketOpportunities = JSON.parse(row.market_opportunities || '[]');
        recommendedActions = JSON.parse(row.recommended_actions || '[]');
      } catch (e) {
        console.warn('Error parsing JSON fields:', e);
        marketOpportunities = ['Standard consulting services'];
        recommendedActions = ['Evaluate market position'];
      }

      return {
        skill_category: row.skill_category,
        category_type: row.category_type,
        
        // Market Analysis
        market_value: Math.round(marketValue),
        demand_trend: row.demand_trend,
        market_demand_score: Math.round(marketDemandScore),
        investment_priority: row.investment_priority,
        market_projection: row.market_projection,
        
        // Team Capabilities  
        team_expertise: teamExpertise,
        internal_specialists_count: parseInt(row.internal_specialists_count) || 0,
        internal_hours_invested: parseFloat(row.internal_hours_invested) || 0,
        internal_efficiency: Math.round((parseFloat(row.internal_efficiency) || 0) * 10) / 10,
        
        // Growth Analysis
        internal_trend: row.internal_trend,
        internal_growth_rate: internalGrowthRate,
        strategic_position: row.strategic_position,
        
        // Financial Projections
        estimated_revenue_impact: Math.round(parseFloat(row.estimated_revenue_impact) || 0),
        projected_annual_roi: Math.round(projectedROI),
        
        // Market Intelligence
        market_competition_intensity: Math.round(competitionIntensity),
        entry_barriers: row.entry_barriers,
        market_opportunities: marketOpportunities,
        
        // Strategic Recommendations
        recommended_actions: recommendedActions,
        
        // Computed insights
        market_attractiveness: calculateMarketAttractiveness(marketDemandScore, competitionIntensity, marketValue),
        skill_gap_severity: calculateSkillGap(row.investment_priority, teamExpertise),
        investment_urgency: calculateInvestmentUrgency(row.strategic_position, internalGrowthRate, marketDemandScore)
      };
    });

    // Calculare insights și statistici
    const marketStats = calculateMarketStats(processedData);
    const strategicInsights = generateStrategicInsights(processedData, marketStats);
    
    // Market forecasts dacă sunt cerute
    const marketForecasts = includeForecasts ? 
      generateMarketForecasts(processedData) : null;

    return NextResponse.json({
      success: true,
      data: processedData,
      market_statistics: marketStats,
      strategic_insights: strategicInsights,
      market_forecasts: marketForecasts,
      meta: {
        period: parseInt(period),
        region: region,
        skills_analyzed: processedData.length,
        filters: {
          skill_category: skillCategory
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare Market Trends API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la analiza market trends' },
      { status: 500 }
    );
  }
}

// Funcții helper pentru calcule avansate

function calculateMarketAttractiveness(demandScore: number, competition: number, marketValue: number): number {
  // Formula: (Demand Score * 0.4) + ((100 - Competition) * 0.3) + (Market Value / 2000 * 30)
  const demandComponent = demandScore * 0.4;
  const competitionComponent = (100 - competition) * 0.3;
  const valueComponent = Math.min(30, (marketValue / 2000) * 30);
  
  return Math.round(demandComponent + competitionComponent + valueComponent);
}

function calculateSkillGap(investmentPriority: string, teamExpertise: number): string {
  if (investmentPriority === 'high' && teamExpertise < 4) return 'critical';
  if (investmentPriority === 'high' && teamExpertise < 6) return 'high';
  if (investmentPriority === 'medium' && teamExpertise < 5) return 'medium';
  if (investmentPriority === 'low' && teamExpertise > 8) return 'overinvested';
  return 'balanced';
}

function calculateInvestmentUrgency(strategicPosition: string, growthRate: number, demandScore: number): string {
  if (strategicPosition === 'critical_gap') return 'immediate';
  if (strategicPosition === 'scale_opportunity' && demandScore > 80) return 'high';
  if (growthRate < -20 && demandScore > 60) return 'high';
  if (strategicPosition === 'development_needed') return 'medium';
  return 'low';
}

function calculateMarketStats(skills: any[]): any {
  const highPrioritySkills = skills.filter(s => s.investment_priority === 'high');
  const criticalGaps = skills.filter(s => s.skill_gap_severity === 'critical');
  const scaleOpportunities = skills.filter(s => s.strategic_position === 'scale_opportunity');
  
  const avgMarketValue = skills.reduce((sum, s) => sum + s.market_value, 0) / skills.length;
  const totalPotentialROI = skills.reduce((sum, s) => sum + s.projected_annual_roi, 0);
  
  return {
    total_skills_analyzed: skills.length,
    high_priority_skills: highPrioritySkills.length,
    critical_skill_gaps: criticalGaps.length,
    scale_opportunities: scaleOpportunities.length,
    average_market_value: Math.round(avgMarketValue),
    total_potential_roi: Math.round(totalPotentialROI),
    top_growth_skills: skills
      .filter(s => s.demand_trend === 'rising')
      .sort((a, b) => b.market_demand_score - a.market_demand_score)
      .slice(0, 5)
      .map(s => s.skill_category),
    investment_distribution: {
      immediate: skills.filter(s => s.investment_urgency === 'immediate').length,
      high: skills.filter(s => s.investment_urgency === 'high').length,
      medium: skills.filter(s => s.investment_urgency === 'medium').length,
      low: skills.filter(s => s.investment_urgency === 'low').length
    }
  };
}

function generateStrategicInsights(skills: any[], stats: any): any[] {
  const insights: Array<{
    type: string;
    title: string;
    description: string;
    value: string;
    recommendation: string;
  }> = [];
  
  const emergingTech = skills.filter(s => 
    ['Machine Learning', 'Data Science', 'Cloud Architecture'].includes(s.skill_category)
  );
  
  if (emergingTech.some(s => s.skill_gap_severity === 'critical')) {
    insights.push({
      type: 'danger',
      title: 'Gap Critic în Tehnologii Emergente',
      description: 'Lipsă expertiza în AI/ML și Cloud',
      value: emergingTech.filter(s => s.skill_gap_severity === 'critical').map(s => s.skill_category).join(', '),
      recommendation: 'Investiție urgentă în training și hiring pentru tehnologii de viitor'
    });
  }
  
  const highROIOpportunities = skills.filter(s => s.projected_annual_roi > 100000);
  if (highROIOpportunities.length > 0) {
    insights.push({
      type: 'success',
      title: 'Oportunități High-ROI Identificate',
      description: `${highROIOpportunities.length} skills cu ROI > 100k EUR/an`,
      value: `${Math.round(highROIOpportunities.reduce((sum, s) => sum + s.projected_annual_roi, 0) / 1000)}k EUR potențial total`,
      recommendation: 'Prioritizare investiții în aceste skills pentru maximizarea rentabilității'
    });
  }
  
  const risingTrends = skills.filter(s => s.demand_trend === 'rising' && s.team_expertise < 6);
  if (risingTrends.length > 0) {
    insights.push({
      type: 'info',
      title: 'Trenduri Ascendente Ratate',
      description: `${risingTrends.length} skills în creștere cu expertise internă scăzută`,
      value: risingTrends.map(s => s.skill_category).join(', '),
      recommendation: 'Dezvoltare rapidă a acestor competențe pentru a nu rata trendul'
    });
  }
  
  if (stats.total_potential_roi > 500000) {
    insights.push({
      type: 'success',
      title: 'Potențial de Creștere Masiv',
      description: `ROI potențial total: ${Math.round(stats.total_potential_roi / 1000)}k EUR/an`,
      value: 'Investiții strategice pot transforma compania',
      recommendation: 'Dezvoltare plan de investiții pe 2-3 ani pentru capturarea acestui potențial'
    });
  }
  
  return insights;
}

function generateMarketForecasts(skills: any[]): any {
  const nextYearGrowth = skills.map(skill => ({
    skill_category: skill.skill_category,
    current_market_value: skill.market_value,
    forecast_market_value: Math.round(skill.market_value * (
      skill.demand_trend === 'rising' ? 1.25 :
      skill.demand_trend === 'stable' ? 1.1 : 0.95
    )),
    growth_percentage: skill.demand_trend === 'rising' ? 25 :
                      skill.demand_trend === 'stable' ? 10 : -5,
    confidence_level: skill.market_demand_score > 80 ? 'high' : 
                      skill.market_demand_score > 60 ? 'medium' : 'low'
  }));
  
  return {
    forecast_period: '2025-2026',
    skills_forecast: nextYearGrowth,
    market_summary: {
      total_market_growth: Math.round(nextYearGrowth.reduce((sum, f) => sum + f.growth_percentage, 0) / nextYearGrowth.length),
      highest_growth_skill: nextYearGrowth.reduce((max, curr) => 
        curr.growth_percentage > max.growth_percentage ? curr : max
      ),
      investment_recommendation: nextYearGrowth
        .filter(f => f.growth_percentage > 20)
        .sort((a, b) => b.growth_percentage - a.growth_percentage)
        .slice(0, 3)
        .map(f => f.skill_category)
    }
  };
}
