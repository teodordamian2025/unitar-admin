// ==================================================================
// CALEA: app/api/analytics/daily-activity/route.ts
// CREAT: 14.09.2025 17:30 (ora României)
// DESCRIERE: API pentru extragerea activității zilnice pentru heatmap și analysis
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
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Daily Activity API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: TimeTracking${tableSuffix}, Sarcini${tableSuffix}, Proiecte${tableSuffix}`);

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
    const period = searchParams.get('period') || '30';
    const userId = searchParams.get('user_id');
    const proiectId = searchParams.get('proiect_id');
    const includeWeekends = searchParams.get('include_weekends') === 'true';
    const aggregateBy = searchParams.get('aggregate_by') || 'day'; // day, week, month
    const includeEfficiency = searchParams.get('include_efficiency') === 'true';

    // Query principal pentru activitatea zilnică
    const dailyActivityQuery = `
      WITH daily_base AS (
        SELECT 
          tt.data_lucru,
          tt.utilizator_uid,
          tt.utilizator_nume,
          tt.proiect_id,
          p.Denumire as proiect_nume,
          s.id as sarcina_id,
          s.titlu as sarcina_titlu,
          s.prioritate,
          s.timp_estimat_total_ore,
          
          -- Agregări zilnice
          SUM(tt.ore_lucrate) as ore_lucrate_total,
          COUNT(DISTINCT tt.sarcina_id) as sarcini_lucrate,
          COUNT(DISTINCT tt.proiect_id) as proiecte_lucrate,
          
          -- Calculez eficiența zilnică
          CASE 
            WHEN SUM(COALESCE(s.timp_estimat_total_ore, 0)) > 0 
            THEN ROUND(
              (SUM(tt.ore_lucrate) / SUM(COALESCE(s.timp_estimat_total_ore, tt.ore_lucrate))) * 100, 
              1
            )
            ELSE 100
          END as eficienta_zilnica,
          
          -- Distribuție pe priorități
          SUM(CASE WHEN s.prioritate = 'urgent' THEN tt.ore_lucrate ELSE 0 END) as ore_urgent,
          SUM(CASE WHEN s.prioritate = 'ridicata' THEN tt.ore_lucrate ELSE 0 END) as ore_ridicata,
          SUM(CASE WHEN s.prioritate = 'normala' THEN tt.ore_lucrate ELSE 0 END) as ore_normala,
          SUM(CASE WHEN s.prioritate = 'scazuta' THEN tt.ore_lucrate ELSE 0 END) as ore_scazuta,
          
          -- Informații context zilnice
          EXTRACT(DAYOFWEEK FROM tt.data_lucru) as zi_saptamana, -- 1=Sunday, 2=Monday, etc.
          EXTRACT(WEEK FROM tt.data_lucru) as saptamana_an,
          EXTRACT(MONTH FROM tt.data_lucru) as luna,
          
          -- Sarcini complete în ziua respectivă
          COUNT(CASE WHEN s.status = 'finalizata' AND s.data_finalizare = tt.data_lucru THEN 1 END) as sarcini_complete,
          
          -- Pattern de lucru (ore consecutive, pauze, etc.)
          MIN(tt.created_at) as prima_activitate,
          MAX(tt.created_at) as ultima_activitate,
          
          -- Calculez "focus time" - sesiuni continue pe aceeași sarcină
          COUNT(DISTINCT CASE 
            WHEN LAG(tt.sarcina_id) OVER (
              PARTITION BY tt.utilizator_uid, tt.data_lucru 
              ORDER BY tt.created_at
            ) = tt.sarcina_id 
            THEN NULL 
            ELSE tt.sarcina_id 
          END) as task_switches
          
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_SARCINI} s 
          ON tt.sarcina_id = s.id
        LEFT JOIN ${TABLE_PROIECTE} p 
          ON tt.proiect_id = p.ID_Proiect
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          AND tt.ore_lucrate > 0
          ${userId ? 'AND tt.utilizator_uid = @userId' : ''}
          ${proiectId ? 'AND tt.proiect_id = @proiectId' : ''}
          ${!includeWeekends ? 'AND EXTRACT(DAYOFWEEK FROM tt.data_lucru) NOT IN (1, 7)' : ''}
        GROUP BY 
          tt.data_lucru, tt.utilizator_uid, tt.utilizator_nume, 
          tt.proiect_id, p.Denumire
      ),
      
      enhanced_daily AS (
        SELECT 
          *,
          -- Calculez productivitatea relativă (comparație cu media utilizatorului)
          ore_lucrate_total / AVG(ore_lucrate_total) OVER (
            PARTITION BY utilizator_uid
          ) as factor_productivitate,
          
          -- Calculez "focus score" - cât de focused a fost utilizatorul
          CASE 
            WHEN task_switches = 0 THEN 100
            WHEN task_switches <= 2 THEN 80
            WHEN task_switches <= 4 THEN 60
            ELSE 40
          END as focus_score,
          
          -- Etichetez tipul zilei
          CASE 
            WHEN ore_lucrate_total > 10 THEN 'intensive'
            WHEN ore_lucrate_total >= 6 THEN 'normal'
            WHEN ore_lucrate_total >= 3 THEN 'light'
            ELSE 'minimal'
          END as tip_zi,
          
          -- Calculez work-life balance indicator
          CASE 
            WHEN zi_saptamana IN (1, 7) AND ore_lucrate_total > 4 THEN 'weekend_work'
            WHEN ore_lucrate_total > 12 THEN 'overtime'
            WHEN EXTRACT(HOUR FROM ultima_activitate) > 20 THEN 'late_work'
            ELSE 'normal'
          END as work_pattern,
          
          -- Rank zilele după productivitate pentru utilizator
          ROW_NUMBER() OVER (
            PARTITION BY utilizator_uid 
            ORDER BY ore_lucrate_total DESC
          ) as rank_productivitate
          
        FROM daily_base
      )
      
      SELECT 
        data_lucru as data,
        utilizator_uid,
        utilizator_nume,
        proiect_id,
        proiect_nume,
        ore_lucrate_total as ore_lucrate,
        sarcini_lucrate,
        proiecte_lucrate,
        eficienta_zilnica as eficienta,
        ore_urgent,
        ore_ridicata,
        ore_normala,
        ore_scazuta,
        sarcini_complete,
        task_switches,
        focus_score,
        tip_zi,
        work_pattern,
        factor_productivitate,
        rank_productivitate,
        zi_saptamana,
        saptamana_an,
        luna,
        
        -- Calculez diferite metrici pentru heatmap
        CASE 
          WHEN ore_lucrate_total = 0 THEN 0
          WHEN ore_lucrate_total <= 2 THEN 1
          WHEN ore_lucrate_total <= 4 THEN 2
          WHEN ore_lucrate_total <= 6 THEN 3
          WHEN ore_lucrate_total <= 8 THEN 4
          ELSE 5
        END as intensitate_heatmap,
        
        -- Pentru patterns săptămânale
        CASE 
          WHEN zi_saptamana = 2 THEN 'Monday'
          WHEN zi_saptamana = 3 THEN 'Tuesday'
          WHEN zi_saptamana = 4 THEN 'Wednesday'
          WHEN zi_saptamana = 5 THEN 'Thursday'
          WHEN zi_saptamana = 6 THEN 'Friday'
          WHEN zi_saptamana = 7 THEN 'Saturday'
          WHEN zi_saptamana = 1 THEN 'Sunday'
        END as nume_zi,
        
        -- Calculez "streak" de zile consecutive cu activitate
        ROW_NUMBER() OVER (
          PARTITION BY utilizator_uid,
          (DATE_DIFF(data_lucru, '1970-01-01', DAY) - ROW_NUMBER() OVER (
            PARTITION BY utilizator_uid 
            ORDER BY data_lucru
          ))
          ORDER BY data_lucru
        ) as streak_activitate
        
      FROM enhanced_daily
      ORDER BY data_lucru DESC, utilizator_nume ASC
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

    if (proiectId) {
      queryParams.push({ 
        name: 'proiectId', 
        parameterType: { type: 'STRING' }, 
        parameterValue: { value: proiectId } 
      });
    }

    const [rows] = await bigquery.query({
      query: dailyActivityQuery,
      location: 'EU',
      params: queryParams,
    });

    // Procesez datele pentru diferite agregări
    let processedData = rows;

    if (aggregateBy === 'week') {
      // Agregare săptămânală
      const weeklyData = new Map();
      
      rows.forEach(row => {
        const key = `${row.utilizator_uid}-${row.saptamana_an}`;
        if (!weeklyData.has(key)) {
          weeklyData.set(key, {
            data: `Săptămâna ${row.saptamana_an}`,
            utilizator_uid: row.utilizator_uid,
            utilizator_nume: row.utilizator_nume,
            ore_lucrate: 0,
            sarcini_lucrate: 0,
            sarcini_complete: 0,
            eficienta: 0,
            zile_active: 0
          });
        }
        
        const weekData = weeklyData.get(key);
        weekData.ore_lucrate += row.ore_lucrate;
        weekData.sarcini_lucrate += row.sarcini_lucrate;
        weekData.sarcini_complete += row.sarcini_complete;
        weekData.zile_active += 1;
      });
      
      processedData = Array.from(weeklyData.values()).map(week => ({
        ...week,
        eficienta: week.ore_lucrate > 0 ? Math.round(week.eficienta / week.zile_active) : 0
      }));
    }

    if (aggregateBy === 'month') {
      // Agregare lunară
      const monthlyData = new Map();
      
      rows.forEach(row => {
        const key = `${row.utilizator_uid}-${row.luna}`;
        if (!monthlyData.has(key)) {
          monthlyData.set(key, {
            data: `Luna ${row.luna}`,
            utilizator_uid: row.utilizator_uid,
            utilizator_nume: row.utilizator_nume,
            ore_lucrate: 0,
            sarcini_lucrate: 0,
            sarcini_complete: 0,
            eficienta: 0,
            zile_active: 0
          });
        }
        
        const monthData = monthlyData.get(key);
        monthData.ore_lucrate += row.ore_lucrate;
        monthData.sarcini_lucrate += row.sarcini_lucrate;
        monthData.sarcini_complete += row.sarcini_complete;
        monthData.zile_active += 1;
      });
      
      processedData = Array.from(monthlyData.values()).map(month => ({
        ...month,
        eficienta: month.ore_lucrate > 0 ? Math.round(month.eficienta / month.zile_active) : 0
      }));
    }

    // Calculez statistici pentru heatmap
    const heatmapStats = {
      max_ore_zi: Math.max(...rows.map(r => r.ore_lucrate), 0),
      min_ore_zi: Math.min(...rows.filter(r => r.ore_lucrate > 0).map(r => r.ore_lucrate), 0),
      avg_ore_zi: rows.length > 0 ? rows.reduce((sum, r) => sum + r.ore_lucrate, 0) / rows.length : 0,
      
      // Pattern analysis
      most_productive_day: rows.reduce((max, row) => 
        row.ore_lucrate > (max?.ore_lucrate || 0) ? row : max, null
      ),
      
      least_productive_day: rows.filter(r => r.ore_lucrate > 0).reduce((min, row) => 
        row.ore_lucrate < (min?.ore_lucrate || Infinity) ? row : min, null
      ),
      
      // Weekly patterns
      weekly_distribution: {
        Monday: rows.filter(r => r.nume_zi === 'Monday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Tuesday: rows.filter(r => r.nume_zi === 'Tuesday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Wednesday: rows.filter(r => r.nume_zi === 'Wednesday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Thursday: rows.filter(r => r.nume_zi === 'Thursday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Friday: rows.filter(r => r.nume_zi === 'Friday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Saturday: rows.filter(r => r.nume_zi === 'Saturday').reduce((sum, r) => sum + r.ore_lucrate, 0),
        Sunday: rows.filter(r => r.nume_zi === 'Sunday').reduce((sum, r) => sum + r.ore_lucrate, 0)
      },
      
      // Activity patterns
      intensive_days: rows.filter(r => r.tip_zi === 'intensive').length,
      normal_days: rows.filter(r => r.tip_zi === 'normal').length,
      light_days: rows.filter(r => r.tip_zi === 'light').length,
      minimal_days: rows.filter(r => r.tip_zi === 'minimal').length,
      
      // Work patterns
      weekend_work_days: rows.filter(r => r.work_pattern === 'weekend_work').length,
      overtime_days: rows.filter(r => r.work_pattern === 'overtime').length,
      late_work_days: rows.filter(r => r.work_pattern === 'late_work').length,
      
      // Focus analysis
      avg_focus_score: rows.length > 0 ? rows.reduce((sum, r) => sum + r.focus_score, 0) / rows.length : 0,
      avg_task_switches: rows.length > 0 ? rows.reduce((sum, r) => sum + r.task_switches, 0) / rows.length : 0
    };

    // Insights automate
    const insights: string[] = [];
    
    if (heatmapStats.weekend_work_days > 0) {
      insights.push(`📅 ${heatmapStats.weekend_work_days} zile de weekend cu activitate - monitorizează work-life balance`);
    }
    
    if (heatmapStats.overtime_days > parseInt(period) * 0.3) {
      insights.push(`⏰ ${heatmapStats.overtime_days} zile cu overtime - risc burnout`);
    }
    
    if (heatmapStats.avg_focus_score < 70) {
      insights.push(`🎯 Focus score scăzut (${heatmapStats.avg_focus_score.toFixed(1)}) - prea multe task switch-uri`);
    }
    
    const mostProductiveDay = Object.entries(heatmapStats.weekly_distribution)
      .reduce((max, [day, hours]) => hours > max.hours ? { day, hours } : max, { day: '', hours: 0 });
    
    if (mostProductiveDay.hours > 0) {
      insights.push(`📈 Cea mai productivă zi: ${mostProductiveDay.day} (${mostProductiveDay.hours}h total)`);
    }

    return NextResponse.json({
      success: true,
      data: processedData,
      heatmap_stats: heatmapStats,
      insights: insights,
      meta: {
        period: parseInt(period),
        aggregate_by: aggregateBy,
        user_id: userId,
        proiect_id: proiectId,
        include_weekends: includeWeekends,
        include_efficiency: includeEfficiency,
        total_records: processedData.length,
        date_range: {
          start: rows.length > 0 ? Math.min(...rows.map(r => new Date(r.data).getTime())) : null,
          end: rows.length > 0 ? Math.max(...rows.map(r => new Date(r.data).getTime())) : null
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare daily activity API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor de activitate zilnică' },
      { status: 500 }
    );
  }
}
