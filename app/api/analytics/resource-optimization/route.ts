// ==================================================================
// CALEA: app/api/analytics/resource-optimization/route.ts
// CREAT: 16.09.2025 12:55 (ora României)
// DESCRIERE: API pentru optimizarea resurselor cu bottleneck detection, utilization analysis și reallocation suggestions
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
    const resourceType = searchParams.get('resource_type'); // utilizator, skill, proiect
    const minUtilization = searchParams.get('min_utilization');
    const maxUtilization = searchParams.get('max_utilization');
    const includeReallocation = searchParams.get('include_reallocation') !== 'false';
    const includeForecasts = searchParams.get('include_forecasts') !== 'false';

    // Query pentru analiza optimizării resurselor
    const resourceOptimizationQuery = `
      WITH resource_utilization_analysis AS (
        SELECT 
          'utilizator' as resource_type,
          u.uid as resource_id,
          CONCAT(u.nume, ' ', COALESCE(u.prenume, '')) as resource_name,
          u.rol as resource_category,
          u.email as resource_contact,
          
          COALESCE(SUM(tt.ore_lucrate), 0) as ore_utilizate,
          COUNT(DISTINCT DATE(tt.data_lucru)) as zile_active,
          COUNT(DISTINCT tt.proiect_id) as proiecte_active,
          COUNT(DISTINCT tt.sarcina_id) as sarcini_active,
          
          @period * 8.0 * (5.0/7.0) as capacitate_totala_estimata,
          
          CASE 
            WHEN (@period * 8.0 * (5.0/7.0)) > 0 THEN
              (COALESCE(SUM(tt.ore_lucrate), 0) / (@period * 8.0 * (5.0/7.0))) * 100
            ELSE 0
          END as utilizare_procent,
          
          CASE 
            WHEN SUM(tt.ore_lucrate) > 0 THEN
              AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 10
            ELSE 0
          END as eficienta_score,
          
          COUNT(DISTINCT s.prioritate) as diversitate_prioritati,
          COUNT(DISTINCT s.tip_proiect) as diversitate_tipuri_proiect,
          
          STDDEV(daily_hours.ore_zilnice) as variabilitate_zilnica,
          MAX(daily_hours.ore_zilnice) as max_ore_zi,
          MIN(CASE WHEN daily_hours.ore_zilnice > 0 THEN daily_hours.ore_zilnice END) as min_ore_zi,
          
          MODE() OVER (PARTITION BY u.uid ORDER BY s.prioritate) as prioritate_dominanta,
          
          COUNT(CASE WHEN s.data_scadenta <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) 
                     AND s.status != 'Finalizată' THEN 1 END) as sarcini_deadline_apropiat,
          COUNT(CASE WHEN s.prioritate IN ('Critică', 'Înaltă') 
                     AND s.status != 'Finalizată' THEN 1 END) as sarcini_prioritare_active
          
        FROM \`hale-mode-464009-i6.PanouControlUnitar.Utilizatori\` u
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt 
          ON u.uid = tt.utilizator_uid 
          AND tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Sarcini\` s 
          ON tt.sarcina_id = s.id
        LEFT JOIN (
          SELECT 
            tt_inner.utilizator_uid,
            DATE(tt_inner.data_lucru) as data,
            SUM(tt_inner.ore_lucrate) as ore_zilnice
          FROM \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt_inner
          WHERE tt_inner.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          GROUP BY tt_inner.utilizator_uid, DATE(tt_inner.data_lucru)
        ) daily_hours ON u.uid = daily_hours.utilizator_uid
        WHERE u.activ = true
        GROUP BY u.uid, u.nume, u.prenume, u.rol, u.email
        
        UNION ALL
        
        SELECT 
          'skill' as resource_type,
          skill_analysis.skill_name as resource_id,
          skill_analysis.skill_name as resource_name,
          skill_analysis.skill_category as resource_category,
          skill_analysis.skill_name as resource_contact,
          
          skill_analysis.ore_lucrate_skill,
          skill_analysis.zile_active_skill,
          skill_analysis.proiecte_cu_skill,
          skill_analysis.utilizatori_cu_skill,
          
          skill_analysis.capacitate_skill,
          
          CASE 
            WHEN skill_analysis.capacitate_skill > 0 THEN
              (skill_analysis.ore_lucrate_skill / skill_analysis.capacitate_skill) * 100
            ELSE 0
          END as utilizare_procent,
          
          skill_analysis.eficienta_skill,
          skill_analysis.diversitate_prioritati,
          skill_analysis.diversitate_tipuri_proiect,
          skill_analysis.variabilitate_zilnica,
          skill_analysis.max_ore_zi,
          skill_analysis.min_ore_zi,
          skill_analysis.prioritate_dominanta,
          skill_analysis.sarcini_deadline_apropiat,
          skill_analysis.sarcini_prioritare_active
          
        FROM (
          SELECT 
            CASE 
              WHEN LOWER(s.titlu) LIKE '%frontend%' OR LOWER(s.titlu) LIKE '%react%' OR LOWER(s.titlu) LIKE '%javascript%' THEN 'Frontend Development'
              WHEN LOWER(s.titlu) LIKE '%backend%' OR LOWER(s.titlu) LIKE '%api%' OR LOWER(s.titlu) LIKE '%database%' THEN 'Backend Development'
              WHEN LOWER(s.titlu) LIKE '%design%' OR LOWER(s.titlu) LIKE '%ui%' OR LOWER(s.titlu) LIKE '%ux%' THEN 'UI/UX Design'
              WHEN LOWER(s.titlu) LIKE '%test%' OR LOWER(s.titlu) LIKE '%qa%' THEN 'Quality Assurance'
              WHEN LOWER(s.titlu) LIKE '%manage%' OR LOWER(s.titlu) LIKE '%plan%' OR LOWER(s.titlu) LIKE '%coordon%' THEN 'Project Management'
              WHEN LOWER(s.titlu) LIKE '%analiz%' OR LOWER(s.titlu) LIKE '%research%' THEN 'Business Analysis'
              WHEN LOWER(s.titlu) LIKE '%deploy%' OR LOWER(s.titlu) LIKE '%devops%' OR LOWER(s.titlu) LIKE '%infra%' THEN 'DevOps/Infrastructure'
              ELSE 'General Development'
            END as skill_name,
            
            CASE 
              WHEN LOWER(s.titlu) LIKE '%frontend%' OR LOWER(s.titlu) LIKE '%backend%' OR LOWER(s.titlu) LIKE '%devops%' THEN 'Technical'
              WHEN LOWER(s.titlu) LIKE '%design%' OR LOWER(s.titlu) LIKE '%ui%' THEN 'Creative'
              WHEN LOWER(s.titlu) LIKE '%manage%' OR LOWER(s.titlu) LIKE '%analiz%' THEN 'Management'
              ELSE 'Mixed'
            END as skill_category,
            
            SUM(tt.ore_lucrate) as ore_lucrate_skill,
            COUNT(DISTINCT DATE(tt.data_lucru)) as zile_active_skill,
            COUNT(DISTINCT tt.proiect_id) as proiecte_cu_skill,
            COUNT(DISTINCT tt.utilizator_uid) as utilizatori_cu_skill,
            
            COUNT(DISTINCT tt.utilizator_uid) * (@period * 8.0 * (5.0/7.0)) as capacitate_skill,
            
            CASE 
              WHEN SUM(tt.ore_lucrate) > 0 THEN
                AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 10
              ELSE 0
            END as eficienta_skill,
            
            COUNT(DISTINCT s.prioritate) as diversitate_prioritati,
            COUNT(DISTINCT s.tip_proiect) as diversitate_tipuri_proiect,
            0 as variabilitate_zilnica,
            MAX(tt.ore_lucrate) as max_ore_zi,
            MIN(tt.ore_lucrate) as min_ore_zi,
            MODE() OVER (ORDER BY s.prioritate) as prioritate_dominanta,
            
            COUNT(CASE WHEN s.data_scadenta <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) 
                       AND s.status != 'Finalizată' THEN 1 END) as sarcini_deadline_apropiat,
            COUNT(CASE WHEN s.prioritate IN ('Critică', 'Înaltă') 
                       AND s.status != 'Finalizată' THEN 1 END) as sarcini_prioritare_active
            
          FROM \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt
          JOIN \`hale-mode-464009-i6.PanouControlUnitar.Sarcini\` s ON tt.sarcina_id = s.id
          WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          GROUP BY skill_name, skill_category
        ) skill_analysis
        
        UNION ALL
        
        SELECT 
          'proiect' as resource_type,
          p.ID_Proiect as resource_id,
          p.Denumire as resource_name,
          p.Status as resource_category,
          p.Client as resource_contact,
          
          COALESCE(SUM(tt.ore_lucrate), 0) as ore_alocate_proiect,
          COUNT(DISTINCT DATE(tt.data_lucru)) as zile_active_proiect,
          COUNT(DISTINCT tt.utilizator_uid) as utilizatori_alocati,
          COUNT(DISTINCT tt.sarcina_id) as sarcini_proiect,
          
          COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) / 100.0 as capacitate_buget_ore,
          
          CASE 
            WHEN COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) > 0 THEN
              (COALESCE(SUM(tt.ore_lucrate), 0) * 100) / COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) * 100
            ELSE 0
          END as utilizare_buget_procent,
          
          CASE 
            WHEN SUM(tt.ore_lucrate) > 0 THEN
              AVG(COALESCE(s.progres_procent, 0)) / SUM(tt.ore_lucrate) * 10
            ELSE 0
          END as eficienta_proiect,
          
          COUNT(DISTINCT s.prioritate) as diversitate_prioritati,
          1 as diversitate_tipuri_proiect,
          STDDEV(daily_project_hours.ore_zilnice) as variabilitate_zilnica,
          MAX(daily_project_hours.ore_zilnice) as max_ore_zi,
          MIN(CASE WHEN daily_project_hours.ore_zilnice > 0 THEN daily_project_hours.ore_zilnice END) as min_ore_zi,
          MODE() OVER (PARTITION BY p.ID_Proiect ORDER BY s.prioritate) as prioritate_dominanta,
          
          COUNT(CASE WHEN s.data_scadenta <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) 
                     AND s.status != 'Finalizată' THEN 1 END) as sarcini_deadline_apropiat,
          COUNT(CASE WHEN s.prioritate IN ('Critică', 'Înaltă') 
                     AND s.status != 'Finalizată' THEN 1 END) as sarcini_prioritare_active
          
        FROM \`hale-mode-464009-i6.PanouControlUnitar.Proiecte\` p
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt 
          ON p.ID_Proiect = tt.proiect_id 
          AND tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Sarcini\` s 
          ON tt.sarcina_id = s.id
        LEFT JOIN (
          SELECT 
            tt_proj.proiect_id,
            DATE(tt_proj.data_lucru) as data,
            SUM(tt_proj.ore_lucrate) as ore_zilnice
          FROM \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt_proj
          WHERE tt_proj.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          GROUP BY tt_proj.proiect_id, DATE(tt_proj.data_lucru)
        ) daily_project_hours ON p.ID_Proiect = daily_project_hours.proiect_id
        WHERE p.Data_Start >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
        GROUP BY p.ID_Proiect, p.Denumire, p.Status, p.Client, p.valoare_ron, p.Valoare_Estimata
      ),
      
      bottleneck_analysis AS (
        SELECT 
          resource_type,
          resource_id,
          resource_name,
          utilizare_procent,
          eficienta_score,
          
          CASE 
            WHEN utilizare_procent > 90 AND sarcini_prioritare_active > 5 THEN 95
            WHEN utilizare_procent > 85 AND sarcini_deadline_apropiat > 3 THEN 85
            WHEN utilizare_procent > 80 AND eficienta_score < 5 THEN 75
            WHEN utilizare_procent > 75 THEN 60
            WHEN utilizare_procent < 30 AND eficienta_score > 8 THEN -20
            ELSE GREATEST(0, utilizare_procent * 0.8 + (sarcini_prioritare_active * 5))
          END as bottleneck_risk_score,
          
          CASE 
            WHEN utilizare_procent > 85 THEN (utilizare_procent - 75) * 0.8
            WHEN utilizare_procent < 40 THEN (65 - utilizare_procent) * 0.6
            ELSE ABS(70 - utilizare_procent) * 0.3
          END as optimization_potential,
          
          sarcini_prioritare_active,
          sarcini_deadline_apropiat
          
        FROM resource_utilization_analysis
      ),
      
      reallocation_opportunities AS (
        SELECT 
          over_utilized.resource_type,
          over_utilized.resource_id as from_resource_id,
          over_utilized.resource_name as from_resource_name,
          under_utilized.resource_id as to_resource_id,
          under_utilized.resource_name as to_resource_name,
          
          (over_utilized.utilizare_procent - 75) + (65 - under_utilized.utilizare_procent) as total_reallocation_benefit,
          
          CASE 
            WHEN over_utilized.resource_category = under_utilized.resource_category THEN 100
            WHEN over_utilized.prioritate_dominanta = under_utilized.prioritate_dominanta THEN 80
            ELSE 60
          END as compatibility_score,
          
          LEAST(over_utilized.sarcini_prioritare_active, 3) as suggested_task_transfer
          
        FROM resource_utilization_analysis over_utilized
        CROSS JOIN resource_utilization_analysis under_utilized
        WHERE over_utilized.resource_type = under_utilized.resource_type
        AND over_utilized.utilizare_procent > 80
        AND under_utilized.utilizare_procent < 50
        AND over_utilized.resource_id != under_utilized.resource_id
        AND (over_utilized.utilizare_procent - 75) + (65 - under_utilized.utilizare_procent) > 20
      )
      
      SELECT 
        rua.resource_type,
        rua.resource_id,
        rua.resource_name,
        rua.resource_category,
        rua.resource_contact,
        
        rua.ore_utilizate as current_allocation,
        rua.capacitate_totala_estimata as total_capacity,
        rua.utilizare_procent as utilization_rate,
        
        CASE 
          WHEN rua.utilizare_procent > 85 THEN rua.ore_utilizate * 0.85
          WHEN rua.utilizare_procent < 40 THEN rua.ore_utilizate * 1.6
          ELSE rua.ore_utilizate * (70.0 / GREATEST(1, rua.utilizare_procent))
        END as optimal_allocation,
        
        rua.eficienta_score as efficiency_score,
        rua.diversitate_prioritati as skill_diversity,
        rua.variabilitate_zilnica as workload_variability,
        
        ba.bottleneck_risk_score,
        CASE 
          WHEN ba.bottleneck_risk_score > 80 THEN 'critical'
          WHEN ba.bottleneck_risk_score > 60 THEN 'high'
          WHEN ba.bottleneck_risk_score > 30 THEN 'medium'
          WHEN ba.bottleneck_risk_score < 0 THEN 'under-utilized'
          ELSE 'optimal'
        END as bottleneck_status,
        
        ba.optimization_potential as expected_improvement,
        
        CASE 
          WHEN rua.utilizare_procent > 85 THEN 'Redistribute high-priority tasks to reduce overload'
          WHEN rua.utilizare_procent < 40 THEN 'Allocate additional responsibilities to increase utilization'
          WHEN rua.eficienta_score < 5 THEN 'Provide training or process optimization to improve efficiency'
          WHEN ba.sarcini_deadline_apropiat > 3 THEN 'Urgent: Redistribute upcoming deadline tasks'
          ELSE 'Monitor and maintain current allocation level'
        END as reallocation_suggestion,
        
        rua.proiecte_active as active_projects,
        rua.sarcini_active as active_tasks,
        ba.sarcini_prioritare_active as high_priority_tasks,
        ba.sarcini_deadline_apropiat as urgent_tasks,
        
        (SELECT COUNT(*) FROM reallocation_opportunities ro 
         WHERE ro.from_resource_id = rua.resource_id 
         OR ro.to_resource_id = rua.resource_id) as reallocation_opportunities_count
        
      FROM resource_utilization_analysis rua
      JOIN bottleneck_analysis ba ON rua.resource_id = ba.resource_id AND rua.resource_type = ba.resource_type
      
      WHERE 1=1
      ${resourceType ? `AND rua.resource_type = @resourceType` : ''}
      ${minUtilization ? `AND rua.utilizare_procent >= @minUtilization` : ''}
      ${maxUtilization ? `AND rua.utilizare_procent <= @maxUtilization` : ''}
      
      ORDER BY ba.bottleneck_risk_score DESC, rua.utilizare_procent DESC
    `;

    // Parametri pentru query
    const queryParams: any = { period: period };
    const queryTypes: any = { period: 'INT64' };

    if (resourceType) {
      queryParams.resourceType = resourceType;
      queryTypes.resourceType = 'STRING';
    }

    if (minUtilization) {
      queryParams.minUtilization = parseFloat(minUtilization);
      queryTypes.minUtilization = 'FLOAT64';
    }

    if (maxUtilization) {
      queryParams.maxUtilization = parseFloat(maxUtilization);
      queryTypes.maxUtilization = 'FLOAT64';
    }

    const [rows] = await bigquery.query({
      query: resourceOptimizationQuery,
      params: queryParams,
      types: queryTypes,
      location: 'EU',
    });

    console.log(`Resource Optimization: ${rows.length} resources analyzed`);

    // Procesare și îmbunătățire date
    const processedData = rows.map((row: any) => {
      const currentAllocation = parseFloat(row.current_allocation) || 0;
      const totalCapacity = parseFloat(row.total_capacity) || 1;
      const utilizationRate = parseFloat(row.utilization_rate) || 0;
      const optimalAllocation = parseFloat(row.optimal_allocation) || currentAllocation;
      const bottleneckRisk = parseFloat(row.bottleneck_risk_score) || 0;
      const expectedImprovement = parseFloat(row.expected_improvement) || 0;

      // Calculare metrici avansate
      const utilizationGap = utilizationRate - 70; // Target optimal: 70%
      const efficiencyScore = Math.round((parseFloat(row.efficiency_score) || 0) * 10) / 10;
      const workloadVariability = Math.round((parseFloat(row.workload_variability) || 0) * 10) / 10;

      // Classification pentru UI
      let resourceStatus: 'overloaded' | 'optimal' | 'underutilized' | 'critical';
      if (bottleneckRisk > 80) resourceStatus = 'critical';
      else if (utilizationRate > 85) resourceStatus = 'overloaded';
      else if (utilizationRate < 40) resourceStatus = 'underutilized';
      else resourceStatus = 'optimal';

      // Recomandări specifice
      const recommendations = generateOptimizationRecommendations(
        row.resource_type,
        utilizationRate,
        efficiencyScore,
        parseInt(row.high_priority_tasks) || 0,
        parseInt(row.urgent_tasks) || 0,
        row.bottleneck_status
      );

      return {
        resource_type: row.resource_type,
        resource_name: row.resource_name,
        resource_category: row.resource_category,
        resource_contact: row.resource_contact,
        
        // Allocation Analysis
        current_allocation: Math.round(currentAllocation * 10) / 10,
        optimal_allocation: Math.round(optimalAllocation * 10) / 10,
        total_capacity: Math.round(totalCapacity * 10) / 10,
        utilization_rate: Math.round(utilizationRate * 10) / 10,
        utilization_gap: Math.round(utilizationGap * 10) / 10,
        
        // Performance Metrics
        efficiency_score: efficiencyScore,
        workload_variability: workloadVariability,
        skill_diversity: parseInt(row.skill_diversity) || 0,
        
        // Risk Assessment
        bottleneck_risk: Math.round(bottleneckRisk),
        bottleneck_status: row.bottleneck_status,
        resource_status: resourceStatus,
        
        // Improvement Potential
        expected_improvement: Math.round(expectedImprovement * 10) / 10,
        reallocation_suggestion: row.reallocation_suggestion,
        recommendations: recommendations,
        
        // Context Data
        active_projects: parseInt(row.active_projects) || 0,
        active_tasks: parseInt(row.active_tasks) || 0,
        high_priority_tasks: parseInt(row.high_priority_tasks) || 0,
        urgent_tasks: parseInt(row.urgent_tasks) || 0,
        reallocation_opportunities: parseInt(row.reallocation_opportunities_count) || 0
      };
    });

    // Calculare statistici sumar
    const optimizationStats = calculateOptimizationStats(processedData);

    // Generate insights
    const insights = generateOptimizationInsights(processedData, optimizationStats);

    // Reallocation plan dacă este cerut
    const reallocationPlan = includeReallocation ? 
      await generateReallocationPlan(processedData) : null;

    // Capacity forecasts dacă sunt cerute
    const capacityForecasts = includeForecasts ? 
      generateCapacityForecasts(processedData) : null;

    return NextResponse.json({
      success: true,
      data: processedData,
      optimization_statistics: optimizationStats,
      insights: insights,
      reallocation_plan: reallocationPlan,
      capacity_forecasts: capacityForecasts,
      meta: {
        period: parseInt(period),
        resources_analyzed: processedData.length,
        filters: {
          resource_type: resourceType,
          min_utilization: minUtilization,
          max_utilization: maxUtilization
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare Resource Optimization API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la optimizarea resurselor' },
      { status: 500 }
    );
  }
}

// Funcție pentru generarea recomandărilor de optimizare
function generateOptimizationRecommendations(
  resourceType: string,
  utilizationRate: number,
  efficiencyScore: number,
  highPriorityTasks: number,
  urgentTasks: number,
  bottleneckStatus: string
): string[] {
  const recommendations: string[] = [];

  // Recomandări specifice tipului de resursă
  if (resourceType === 'utilizator') {
    if (utilizationRate > 90) {
      recommendations.push('Redistributie imediată a sarcinilor pentru prevenirea burnout-ului');
      recommendations.push('Delegare task-uri de prioritate medie către colegii mai puțin ocupați');
    }
    
    if (utilizationRate < 40) {
      recommendations.push('Alocare responsabilități suplimentare pentru optimizarea capacității');
      recommendations.push('Cross-training pe proiecte cu cerințe ridicate');
    }
    
    if (efficiencyScore < 5) {
      recommendations.push('Training specializat pentru îmbunătățirea productivității');
      recommendations.push('Analiză procese pentru identificarea blocajelor');
    }
  }

  if (resourceType === 'skill') {
    if (utilizationRate > 85) {
      recommendations.push('Dezvoltarea acestui skill la membrii echipei suplimentari');
      recommendations.push('Considerare outsourcing temporar pentru acest skill');
    }
    
    if (utilizationRate < 45) {
      recommendations.push('Redirecționare proiecte pentru utilizarea optimă a acestui skill');
      recommendations.push('Evaluare necesitate păstrare expertiza în echipă');
    }
  }

  if (resourceType === 'proiect') {
    if (utilizationRate > 80) {
      recommendations.push('Realocare resurse din proiecte cu prioritate mai mică');
      recommendations.push('Evaluare extensie deadline pentru reducerea presiunii');
    }
    
    if (utilizationRate < 50) {
      recommendations.push('Accelerare executie prin alocare resurse suplimentare');
      recommendations.push('Considerare early delivery pentru client satisfaction');
    }
  }

  // Recomandări bazate pe urgent tasks
  if (urgentTasks > 3) {
    recommendations.push('URGENT: Redistributie task-urilor cu deadline apropiat');
    recommendations.push('Escaladare la management pentru support suplimentar');
  }

  // Recomandări bazate pe high priority tasks
  if (highPriorityTasks > 5) {
    recommendations.push('Prioritizare agresivă și deprioritizare task-uri secundare');
    recommendations.push('Time-blocking pentru focus pe prioritățile critice');
  }

  // Recomandări generale pe bottleneck status
  if (bottleneckStatus === 'critical') {
    recommendations.push('CRITICA: Intervenție imediată pentru evitarea blocajelor sistemice');
  }

  return recommendations.slice(0, 5); // Limitează la 5 recomandări pentru claritate
}

// Calculare statistici optimizare
function calculateOptimizationStats(resources: any[]): any {
  if (resources.length === 0) return {};

  const overloadedResources = resources.filter(r => r.resource_status === 'overloaded');
  const underutilizedResources = resources.filter(r => r.resource_status === 'underutilized');
  const optimalResources = resources.filter(r => r.resource_status === 'optimal');
  const criticalResources = resources.filter(r => r.resource_status === 'critical');

  const avgUtilization = resources.reduce((sum, r) => sum + r.utilization_rate, 0) / resources.length;
  const avgEfficiency = resources.reduce((sum, r) => sum + r.efficiency_score, 0) / resources.length;
  const totalImprovementPotential = resources.reduce((sum, r) => sum + r.expected_improvement, 0);

  return {
    total_resources: resources.length,
    resource_distribution: {
      optimal: optimalResources.length,
      overloaded: overloadedResources.length,
      underutilized: underutilizedResources.length,
      critical: criticalResources.length
    },
    utilization_stats: {
      average: Math.round(avgUtilization * 10) / 10,
      optimal_range: '60-80%',
      resources_in_optimal_range: resources.filter(r => r.utilization_rate >= 60 && r.utilization_rate <= 80).length
    },
    efficiency_stats: {
      average: Math.round(avgEfficiency * 10) / 10,
      high_efficiency_resources: resources.filter(r => r.efficiency_score > 7).length,
      low_efficiency_resources: resources.filter(r => r.efficiency_score < 5).length
    },
    optimization_potential: {
      total_improvement: Math.round(totalImprovementPotential * 10) / 10,
      high_impact_opportunities: resources.filter(r => r.expected_improvement > 15).length,
      reallocation_opportunities: resources.reduce((sum, r) => sum + r.reallocation_opportunities, 0)
    }
  };
}

// Generare insights optimizare
function generateOptimizationInsights(resources: any[], stats: any): any[] {
  const insights = [];

  const criticalBottlenecks = resources.filter(r => r.bottleneck_risk > 80);
  const highImpactOpportunities = resources.filter(r => r.expected_improvement > 20);

  if (criticalBottlenecks.length > 0) {
    insights.push({
      type: 'danger',
      title: 'Bottlenecks Critice Detectate',
      description: `${criticalBottlenecks.length} resurse cu risc critic de bottleneck`,
      value: criticalBottlenecks.map(r => r.resource_name).join(', '),
      recommendation: 'Intervenție imediată necesară pentru evitarea blocării workflow-ului'
    });
  }

  if (highImpactOpportunities.length > 0) {
    insights.push({
      type: 'success',
      title: 'Oportunități de Optimizare Major',
      description: `${highImpactOpportunities.length} resurse cu potențial mare de îmbunătățire`,
      value: `${Math.round(highImpactOpportunities.reduce((sum, r) => sum + r.expected_improvement, 0))}% îmbunătățire totală`,
      recommendation: 'Implementare plan de realocarea pentru maximizarea beneficiilor'
    });
  }

  if (stats.utilization_stats.average < 60) {
    insights.push({
      type: 'info',
      title: 'Subutilizare Generală',
      description: `Utilizarea medie ${stats.utilization_stats.average}% sub optim`,
      value: 'Capacitate nevaloricată disponibilă',
      recommendation: 'Evaluare alocare proiecte noi sau accelerare delivery'
    });
  }

  if (stats.utilization_stats.average > 85) {
    insights.push({
      type: 'warning',
      title: 'Suprasolicitare Echipă',
      description: `Utilizarea medie ${stats.utilization_stats.average}% peste recomandări`,
      value: 'Risc de burnout și scădere calitate',
      recommendation: 'Angajări noi sau redistribuire workload urgentă'
    });
  }

  return insights;
}

// Generare plan realocoare (simplificat)
async function generateReallocationPlan(resources: any[]): Promise<any> {
  const overloaded = resources.filter(r => r.utilization_rate > 85);
  const underutilized = resources.filter(r => r.utilization_rate < 50);

  const reallocationSuggestions = [];

  overloaded.forEach(over => {
    const suitable = underutilized.find(under => 
      under.resource_type === over.resource_type &&
      under.resource_category === over.resource_category
    );
    
    if (suitable) {
      reallocationSuggestions.push({
        from: over.resource_name,
        to: suitable.resource_name,
        resource_type: over.resource_type,
        suggested_transfer: Math.min(over.high_priority_tasks, 3),
        expected_balance_improvement: Math.round(((over.utilization_rate - 75) + (65 - suitable.utilization_rate)) / 2)
      });
    }
  });

  return {
    total_suggestions: reallocationSuggestions.length,
    suggestions: reallocationSuggestions.slice(0, 10),
    implementation_priority: reallocationSuggestions
      .sort((a, b) => b.expected_balance_improvement - a.expected_balance_improvement)
      .slice(0, 5)
  };
}

// Generare prognoze capacitate
function generateCapacityForecasts(resources: any[]): any {
  const totalCurrentCapacity = resources.reduce((sum, r) => sum + r.total_capacity, 0);
  const totalCurrentUtilization = resources.reduce((sum, r) => sum + r.current_allocation, 0);
  
  return {
    current_capacity_utilization: Math.round((totalCurrentUtilization / totalCurrentCapacity) * 100),
    projected_optimal_utilization: 70,
    capacity_gap: Math.round((totalCurrentCapacity * 0.7) - totalCurrentUtilization),
    growth_recommendations: {
      immediate_actions: resources.filter(r => r.bottleneck_risk > 70).length,
      mid_term_hiring_needs: Math.max(0, resources.filter(r => r.utilization_rate > 90).length - 2),
      skill_development_priorities: ['Frontend Development', 'Backend Development', 'Project Management']
    }
  };
}
