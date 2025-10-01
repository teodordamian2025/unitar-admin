// ==================================================================
// CALEA: app/api/analytics/skills-analysis/route.ts
// CREAT: 14.09.2025 18:00 (ora României)
// DESCRIERE: API pentru analiza skills și growth tracking pe categorii
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;

console.log(`🔧 Skills Analysis API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Sarcini${tableSuffix}, Proiecte${tableSuffix}, TimeTracking${tableSuffix}`);

// Tipuri pentru siguranță TypeScript
interface StrategicRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  skills: string[];
  actions: string[];
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
    const period = searchParams.get('period') || '90'; // Default 3 luni pentru trend analysis
    const userId = searchParams.get('user_id');
    const skillCategory = searchParams.get('skill_category');
    const includeGrowthTrend = searchParams.get('include_growth_trend') === 'true';
    const includeTeamComparison = searchParams.get('include_team_comparison') === 'true';

    // Query principal pentru analiza skills
    const skillsAnalysisQuery = `
      WITH skill_mapping AS (
        -- Mapare sarcini/proiecte la categorii de skills bazată pe keywords și tipuri
        SELECT 
          s.id as sarcina_id,
          s.titlu,
          s.descriere,
          s.proiect_id,
          p.Denumire as proiect_nume,
          
          -- Detectez skills bazat pe keywords în titlu și descriere
          CASE 
            WHEN LOWER(s.titlu) LIKE '%frontend%' OR LOWER(s.titlu) LIKE '%react%' 
              OR LOWER(s.titlu) LIKE '%vue%' OR LOWER(s.titlu) LIKE '%angular%'
              OR LOWER(s.titlu) LIKE '%css%' OR LOWER(s.titlu) LIKE '%html%'
              OR LOWER(s.titlu) LIKE '%javascript%' OR LOWER(s.titlu) LIKE '%typescript%'
            THEN 'Frontend Development'
            
            WHEN LOWER(s.titlu) LIKE '%backend%' OR LOWER(s.titlu) LIKE '%api%'
              OR LOWER(s.titlu) LIKE '%database%' OR LOWER(s.titlu) LIKE '%server%'
              OR LOWER(s.titlu) LIKE '%node%' OR LOWER(s.titlu) LIKE '%python%'
              OR LOWER(s.titlu) LIKE '%java%' OR LOWER(s.titlu) LIKE '%sql%'
            THEN 'Backend Development'
            
            WHEN LOWER(s.titlu) LIKE '%design%' OR LOWER(s.titlu) LIKE '%ui%'
              OR LOWER(s.titlu) LIKE '%ux%' OR LOWER(s.titlu) LIKE '%graphic%'
              OR LOWER(s.titlu) LIKE '%wireframe%' OR LOWER(s.titlu) LIKE '%prototype%'
              OR LOWER(s.titlu) LIKE '%figma%' OR LOWER(s.titlu) LIKE '%photoshop%'
            THEN 'Design & UX'
            
            WHEN LOWER(s.titlu) LIKE '%manage%' OR LOWER(s.titlu) LIKE '%plan%'
              OR LOWER(s.titlu) LIKE '%coordinate%' OR LOWER(s.titlu) LIKE '%lead%'
              OR LOWER(s.titlu) LIKE '%meeting%' OR LOWER(s.titlu) LIKE '%scrum%'
              OR LOWER(s.titlu) LIKE '%project%' OR s.prioritate = 'urgent'
            THEN 'Project Management'
            
            WHEN LOWER(s.titlu) LIKE '%test%' OR LOWER(s.titlu) LIKE '%qa%'
              OR LOWER(s.titlu) LIKE '%bug%' OR LOWER(s.titlu) LIKE '%debug%'
              OR LOWER(s.titlu) LIKE '%quality%' OR LOWER(s.titlu) LIKE '%automation%'
            THEN 'Quality Assurance'
            
            WHEN LOWER(s.titlu) LIKE '%devops%' OR LOWER(s.titlu) LIKE '%deploy%'
              OR LOWER(s.titlu) LIKE '%infrastructure%' OR LOWER(s.titlu) LIKE '%docker%'
              OR LOWER(s.titlu) LIKE '%kubernetes%' OR LOWER(s.titlu) LIKE '%aws%'
              OR LOWER(s.titlu) LIKE '%cloud%' OR LOWER(s.titlu) LIKE '%ci/cd%'
            THEN 'DevOps & Infrastructure'
            
            WHEN LOWER(s.titlu) LIKE '%analyz%' OR LOWER(s.titlu) LIKE '%data%'
              OR LOWER(s.titlu) LIKE '%report%' OR LOWER(s.titlu) LIKE '%metric%'
              OR LOWER(s.titlu) LIKE '%business%' OR LOWER(s.titlu) LIKE '%research%'
            THEN 'Business Analysis'
            
            WHEN LOWER(s.titlu) LIKE '%document%' OR LOWER(s.titlu) LIKE '%spec%'
              OR LOWER(s.titlu) LIKE '%requirement%' OR LOWER(s.titlu) LIKE '%write%'
              OR LOWER(s.titlu) LIKE '%manual%' OR LOWER(s.titlu) LIKE '%guide%'
            THEN 'Documentation'
            
            ELSE 'General Development'
          END as skill_category,
          
          -- Nivelul de complexitate bazat pe timp estimat și prioritate
          CASE 
            WHEN s.timp_estimat_total_ore > 40 THEN 'Expert'
            WHEN s.timp_estimat_total_ore > 16 THEN 'Advanced'
            WHEN s.timp_estimat_total_ore > 8 THEN 'Intermediate'
            ELSE 'Beginner'
          END as complexity_level
          
        FROM ${TABLE_SARCINI} s
        LEFT JOIN ${TABLE_PROIECTE} p 
          ON s.proiect_id = p.ID_Proiect
        WHERE s.data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
      ),
      
      user_skills AS (
        SELECT 
          tt.utilizator_uid,
          tt.utilizator_nume,
          sm.skill_category,
          sm.complexity_level,
          
          -- Agregări per skill category
          SUM(tt.ore_lucrate) as total_hours,
          COUNT(DISTINCT sm.sarcina_id) as tasks_completed,
          COUNT(DISTINCT sm.proiect_id) as projects_involved,
          
          -- Calculez eficiența pe skill
          CASE 
            WHEN SUM(COALESCE(s.timp_estimat_total_ore, 0)) > 0 
            THEN ROUND(
              (SUM(tt.ore_lucrate) / SUM(COALESCE(s.timp_estimat_total_ore, tt.ore_lucrate))) * 100, 
              1
            )
            ELSE 100
          END as skill_efficiency,
          
          -- Pentru calcul growth trend
          SUM(CASE 
            WHEN tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            THEN tt.ore_lucrate 
            ELSE 0 
          END) as recent_hours,
          SUM(CASE 
            WHEN tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
            AND tt.data_lucru < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            THEN tt.ore_lucrate 
            ELSE 0 
          END) as previous_period_hours,
          
          -- Experiență pe complexity levels
          SUM(CASE WHEN sm.complexity_level = 'Expert' THEN tt.ore_lucrate ELSE 0 END) as expert_hours,
          SUM(CASE WHEN sm.complexity_level = 'Advanced' THEN tt.ore_lucrate ELSE 0 END) as advanced_hours,
          SUM(CASE WHEN sm.complexity_level = 'Intermediate' THEN tt.ore_lucrate ELSE 0 END) as intermediate_hours,
          SUM(CASE WHEN sm.complexity_level = 'Beginner' THEN tt.ore_lucrate ELSE 0 END) as beginner_hours,
          
          -- Ultima activitate pe skill
          MAX(tt.data_lucru) as last_activity_date
          
        FROM ${TABLE_TIME_TRACKING} tt
        JOIN skill_mapping sm ON tt.sarcina_id = sm.sarcina_id
        LEFT JOIN ${TABLE_SARCINI} s 
          ON tt.sarcina_id = s.id
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          AND tt.ore_lucrate > 0
          ${userId ? 'AND tt.utilizator_uid = @userId' : ''}
          ${skillCategory ? 'AND sm.skill_category = @skillCategory' : ''}
        GROUP BY 
          tt.utilizator_uid, tt.utilizator_nume, sm.skill_category, sm.complexity_level
      ),
      
      skill_aggregated AS (
        SELECT 
          skill_category,
          
          -- Statistici generale per skill
          COUNT(DISTINCT utilizator_uid) as team_members,
          SUM(total_hours) as total_hours,
          ROUND(AVG(skill_efficiency), 1) as avg_efficiency,
          SUM(tasks_completed) as total_tasks,
          SUM(projects_involved) as total_projects,
          
          -- Growth trend calculation
          CASE 
            WHEN SUM(previous_period_hours) = 0 THEN 'stable'
            WHEN SUM(recent_hours) > SUM(previous_period_hours) * 1.2 THEN 'up'
            WHEN SUM(recent_hours) < SUM(previous_period_hours) * 0.8 THEN 'down'
            ELSE 'stable'
          END as growth_trend,
          
          -- Experiență distribution
          SUM(expert_hours) as total_expert_hours,
          SUM(advanced_hours) as total_advanced_hours,
          SUM(intermediate_hours) as total_intermediate_hours,
          SUM(beginner_hours) as total_beginner_hours,
          
          -- Team maturity pe skill
          CASE 
            WHEN SUM(expert_hours) / SUM(total_hours) > 0.4 THEN 'Expert Team'
            WHEN SUM(advanced_hours + expert_hours) / SUM(total_hours) > 0.6 THEN 'Advanced Team'
            WHEN SUM(intermediate_hours + advanced_hours + expert_hours) / SUM(total_hours) > 0.7 THEN 'Intermediate Team'
            ELSE 'Learning Team'
          END as team_maturity,
          
          -- Top performer per skill
          (SELECT utilizator_nume 
           FROM user_skills us2 
           WHERE us2.skill_category = user_skills.skill_category
           ORDER BY us2.total_hours DESC 
           LIMIT 1) as top_performer,
           
          -- Ultima activitate pe skill
          MAX(last_activity_date) as last_team_activity
          
        FROM user_skills
        GROUP BY skill_category
      ),
      
      individual_skill_summary AS (
        SELECT 
          utilizator_uid,
          utilizator_nume,
          
          -- Top 3 skills per utilizator
          ARRAY_AGG(
            STRUCT(
              skill_category,
              total_hours,
              skill_efficiency,
              CASE 
                WHEN expert_hours > advanced_hours + intermediate_hours + beginner_hours THEN 'Expert'
                WHEN advanced_hours > intermediate_hours + beginner_hours THEN 'Advanced'  
                WHEN intermediate_hours > beginner_hours THEN 'Intermediate'
                ELSE 'Beginner'
              END as skill_level
            )
            ORDER BY total_hours DESC 
            LIMIT 3
          ) as top_skills,
          
          -- Skill diversity score
          COUNT(DISTINCT skill_category) as skills_count,
          ROUND(STDDEV(total_hours), 1) as skill_balance_score,
          
          -- Growth momentum
          SUM(recent_hours) as total_recent_hours,
          SUM(previous_period_hours) as total_previous_hours,
          
          CASE 
            WHEN SUM(previous_period_hours) = 0 THEN 0
            ELSE ROUND(
              ((SUM(recent_hours) - SUM(previous_period_hours)) / SUM(previous_period_hours)) * 100, 
              1
            )
          END as growth_percentage
          
        FROM user_skills
        GROUP BY utilizator_uid, utilizator_nume
      )
      
      SELECT 
        sa.skill_category as skill_name,
        sa.total_hours,
        sa.avg_efficiency,
        sa.team_members,
        sa.growth_trend,
        sa.team_maturity,
        sa.top_performer,
        sa.last_team_activity,
        
        -- Distribution pe complexity
        sa.total_expert_hours,
        sa.total_advanced_hours, 
        sa.total_intermediate_hours,
        sa.total_beginner_hours,
        
        -- Calcul skill demand (bazat pe activitate recentă)
        CASE 
          WHEN sa.total_hours > 200 AND sa.growth_trend = 'up' THEN 'High Demand'
          WHEN sa.total_hours > 100 OR sa.growth_trend = 'up' THEN 'Medium Demand'
          WHEN sa.growth_trend = 'down' THEN 'Low Demand'
          ELSE 'Stable Demand'
        END as market_demand,
        
        -- Recommendations
        CASE 
          WHEN sa.team_members = 1 THEN 'Knowledge sharing risk - develop backup expertise'
          WHEN sa.avg_efficiency < 80 THEN 'Training needed - efficiency below standard'
          WHEN sa.growth_trend = 'down' THEN 'Declining usage - evaluate relevance'
          WHEN sa.total_expert_hours / sa.total_hours < 0.2 THEN 'Expert mentoring needed'
          ELSE 'Skill well-maintained'
        END as recommendation,
        
        -- Pentru individual analysis
        ${includeTeamComparison ? `
        (SELECT AVG(iss.skills_count) FROM individual_skill_summary iss) as avg_team_skills_count,
        (SELECT AVG(iss.growth_percentage) FROM individual_skill_summary iss) as avg_team_growth
        ` : 'NULL as avg_team_skills_count, NULL as avg_team_growth'}
        
      FROM skill_aggregated sa
      ORDER BY sa.total_hours DESC
    `;

    const queryParams: Record<string, any> = { period: period };
    const queryTypes: Record<string, string> = { period: 'INT64' };

    if (userId) {
  queryParams.userId = userId;
  queryTypes.userId = 'STRING';
}

if (skillCategory) {
  queryParams.skillCategory = skillCategory;
  queryTypes.skillCategory = 'STRING';
}

const [skillsRows] = await bigquery.query({
  query: skillsAnalysisQuery,
  params: queryParams,
  types: queryTypes,
  location: 'EU',
});

    // Query separat pentru individual skills dacă e specificat userId
    let individualSkills = null;
    if (userId) {
      const individualQuery = `
        SELECT * FROM individual_skill_summary 
        WHERE utilizator_uid = @userId
      `;
      
      const [individualRows] = await bigquery.query({
	  query: `
	    WITH ${skillsAnalysisQuery.substring(skillsAnalysisQuery.indexOf('skill_mapping AS'))}
	    
	    SELECT 
	      utilizator_uid,
	      utilizator_nume,
	      skills_count,
	      skill_balance_score,
	      growth_percentage,
	      top_skills
	    FROM individual_skill_summary
	    WHERE utilizator_uid = @userId
	  `,
	  params: { userId: userId, period: period },
	  types: { userId: 'STRING', period: 'INT64' },
	  location: 'EU',
	});
      
      individualSkills = individualRows[0] || null;
    }

    // Skills marketplace analysis
    const skillsMarketplace = {
      high_demand_skills: skillsRows.filter(s => s.market_demand === 'High Demand'),
      emerging_skills: skillsRows.filter(s => s.growth_trend === 'up' && s.total_hours < 100),
      at_risk_skills: skillsRows.filter(s => s.growth_trend === 'down' || s.team_members === 1),
      mature_skills: skillsRows.filter(s => s.team_maturity === 'Expert Team'),
      
      // Skill gaps identification
      skill_gaps: skillsRows.filter(s => s.avg_efficiency < 80 || s.recommendation.includes('Training needed')),
      knowledge_risks: skillsRows.filter(s => s.team_members === 1),
      
      // Team capabilities summary
      total_skills_tracked: skillsRows.length,
      avg_team_efficiency: skillsRows.reduce((sum, s) => sum + s.avg_efficiency, 0) / skillsRows.length,
      total_skill_hours: skillsRows.reduce((sum, s) => sum + s.total_hours, 0)
    };

    // Strategic recommendations
    const strategicRecommendations: StrategicRecommendation[] = [];
    
    if (skillsMarketplace.knowledge_risks.length > 0) {
      strategicRecommendations.push({
        priority: 'high',
        category: 'Risk Management',
        title: 'Knowledge Transfer Critical',
        description: `${skillsMarketplace.knowledge_risks.length} skills cu un singur expert`,
        skills: skillsMarketplace.knowledge_risks.map(s => s.skill_name),
        actions: ['Cross-training program', 'Documentation creation', 'Backup expert development']
      });
    }
    
    if (skillsMarketplace.skill_gaps.length > 0) {
      strategicRecommendations.push({
        priority: 'medium',
        category: 'Training & Development',
        title: 'Skill Enhancement Needed',
        description: `${skillsMarketplace.skill_gaps.length} skills sub eficiența optimă`,
        skills: skillsMarketplace.skill_gaps.map(s => s.skill_name),
        actions: ['Targeted training', 'Mentoring programs', 'External expertise']
      });
    }
    
    if (skillsMarketplace.emerging_skills.length > 0) {
      strategicRecommendations.push({
        priority: 'low',
        category: 'Innovation',
        title: 'Emerging Skills Investment',
        description: `${skillsMarketplace.emerging_skills.length} skills în creștere rapid`,
        skills: skillsMarketplace.emerging_skills.map(s => s.skill_name),
        actions: ['Resource allocation', 'Team expansion', 'R&D investment']
      });
    }

    return NextResponse.json({
      success: true,
      data: skillsRows,
      individual_skills: individualSkills,
      marketplace_analysis: skillsMarketplace,
      strategic_recommendations: strategicRecommendations,
      meta: {
        period: parseInt(period),
        user_id: userId,
        skill_category: skillCategory,
        include_growth_trend: includeGrowthTrend,
        include_team_comparison: includeTeamComparison,
        total_skills: skillsRows.length,
        analysis_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare skills analysis API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor de skills analysis' },
      { status: 500 }
    );
  }
}
