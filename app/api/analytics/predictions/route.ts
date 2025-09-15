// ==================================================================
// CALEA: app/api/analytics/predictions/route.ts
// CREAT: 14.09.2025 20:00 (ora României)
// DESCRIERE: API pentru predictive analytics cu ML algorithms și trend forecasting
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
    const predictionHorizon = searchParams.get('horizon') || '30'; // zile în viitor
    const modelType = searchParams.get('model') || 'time_series'; // time_series, linear, seasonal
    const includeConfidence = searchParams.get('include_confidence') !== 'false';
    const granularity = searchParams.get('granularity') || 'weekly'; // daily, weekly, monthly

    // Query pentru extragerea datelor istorice pentru training
    const historicalDataQuery = `
      WITH daily_aggregates AS (
        SELECT 
          DATE(tt.data_lucru) as data,
          SUM(tt.ore_lucrate) as total_ore,
          COUNT(DISTINCT tt.utilizator_uid) as utilizatori_activi,
          COUNT(DISTINCT tt.proiect_id) as proiecte_active,
          COUNT(DISTINCT tt.sarcina_id) as sarcini_lucrate,
          AVG(tt.ore_lucrate) as media_ore_per_sesiune,
          
          -- Factori context
          EXTRACT(DAYOFWEEK FROM tt.data_lucru) as zi_saptamana,
          EXTRACT(WEEK FROM tt.data_lucru) as saptamana_an,
          EXTRACT(MONTH FROM tt.data_lucru) as luna,
          EXTRACT(QUARTER FROM tt.data_lucru) as trimestru,
          
          -- Indicatori calitate
          COUNT(CASE WHEN s.status = 'finalizata' AND s.data_finalizare = tt.data_lucru THEN 1 END) as sarcini_finalizate,
          COUNT(CASE WHEN s.prioritate = 'urgent' THEN 1 END) as sarcini_urgente,
          
          -- Workload indicators
          COUNT(CASE WHEN tt.ore_lucrate > 8 THEN 1 END) as sesiuni_overtime,
          COUNT(CASE WHEN EXTRACT(DAYOFWEEK FROM tt.data_lucru) IN (1, 7) THEN 1 END) as activitate_weekend
          
        FROM \`hale-mode-464009-i6.PanouControlUnitar.TimeTracking\` tt
        LEFT JOIN \`hale-mode-464009-i6.PanouControlUnitar.Sarcini\` s 
          ON tt.sarcina_id = s.id
        WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL @period DAY)
          AND tt.data_lucru <= CURRENT_DATE()
          AND tt.ore_lucrate > 0
        GROUP BY DATE(tt.data_lucru)
        ORDER BY data ASC
      ),
      
      weekly_aggregates AS (
        SELECT 
          DATE_TRUNC(data, WEEK(MONDAY)) as saptamana,
          SUM(total_ore) as total_ore_saptamana,
          AVG(utilizatori_activi) as avg_utilizatori,
          AVG(proiecte_active) as avg_proiecte,
          SUM(sarcini_lucrate) as total_sarcini,
          SUM(sarcini_finalizate) as total_finalizate,
          SUM(sesiuni_overtime) as total_overtime,
          SUM(activitate_weekend) as total_weekend,
          
          -- Calculez eficiența săptămânală
          SAFE_DIVIDE(SUM(sarcini_finalizate), SUM(sarcini_lucrate)) * 100 as eficienta_saptamana,
          
          -- Trend calculation (YoY/MoM)
          LAG(SUM(total_ore), 1) OVER (ORDER BY DATE_TRUNC(data, WEEK(MONDAY))) as ore_saptamana_precedenta,
          LAG(SUM(total_ore), 4) OVER (ORDER BY DATE_TRUNC(data, WEEK(MONDAY))) as ore_aceeasi_saptamana_luna_trecuta
          
        FROM daily_aggregates
        GROUP BY DATE_TRUNC(data, WEEK(MONDAY))
        ORDER BY saptamana ASC
      ),
      
      trend_analysis AS (
        SELECT 
          *,
          -- Calculez trendul pe baza regresiei liniare simple
          (total_ore_saptamana - ore_saptamana_precedenta) / NULLIF(ore_saptamana_precedenta, 0) * 100 as trend_saptamanal,
          
          -- Seasonal patterns
          CASE 
            WHEN total_weekend > 0 THEN 'high_activity'
            WHEN total_overtime > total_ore_saptamana * 0.2 THEN 'overload'
            WHEN eficienta_saptamana > 80 THEN 'high_efficiency'
            ELSE 'normal'
          END as pattern_type,
          
          -- Moving averages pentru smoothing
          AVG(total_ore_saptamana) OVER (
            ORDER BY saptamana 
            ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
          ) as moving_avg_4weeks,
          
          STDDEV(total_ore_saptamana) OVER (
            ORDER BY saptamana 
            ROWS BETWEEN 7 PRECEDING AND CURRENT ROW
          ) as volatility_8weeks
          
        FROM weekly_aggregates
        WHERE ore_saptamana_precedenta IS NOT NULL
      )
      
      SELECT 
        saptamana,
        total_ore_saptamana,
        avg_utilizatori,
        avg_proiecte,
        eficienta_saptamana,
        trend_saptamanal,
        pattern_type,
        moving_avg_4weeks,
        volatility_8weeks,
        total_overtime,
        total_weekend,
        
        -- Linear regression pentru predicții simple
        -- Slope calculation pentru trend extrapolation
        (SELECT 
          (COUNT(*) * SUM(pos * total_ore_saptamana) - SUM(pos) * SUM(total_ore_saptamana)) /
          (COUNT(*) * SUM(pos * pos) - SUM(pos) * SUM(pos))
         FROM (
           SELECT 
             ROW_NUMBER() OVER (ORDER BY saptamana) as pos,
             total_ore_saptamana
           FROM trend_analysis t2 
           WHERE t2.saptamana <= trend_analysis.saptamana
         ) regression_data
        ) as trend_slope,
        
        -- Seasonality factor
        AVG(total_ore_saptamana) OVER (
          PARTITION BY EXTRACT(WEEK FROM saptamana)
        ) as seasonal_average
        
      FROM trend_analysis
      ORDER BY saptamana ASC
    `;

    const [historicalRows] = await bigquery.query({
      query: historicalDataQuery,
      location: 'EU',
      params: [{ 
        name: 'period', 
        parameterType: { type: 'INT64' }, 
        parameterValue: { value: period } 
      }]
    });

    // Implementez algoritmii de predicție
    const predictions = generatePredictions(
      historicalRows, 
      parseInt(predictionHorizon), 
      modelType,
      granularity
    );

    // Calculez confidence intervals
    const predictionsWithConfidence = includeConfidence ? 
      addConfidenceIntervals(predictions, historicalRows) : 
      predictions;

    // Calculez accuracy pentru predicțiile anterioare (backtesting)
    const accuracyMetrics = calculateAccuracy(historicalRows);

    // Generate insights bazate pe predicții
    const insights = generatePredictiveInsights(predictionsWithConfidence, historicalRows);

    return NextResponse.json({
      success: true,
      data: predictionsWithConfidence,
      accuracy_metrics: accuracyMetrics,
      insights: insights,
      meta: {
        period: parseInt(period),
        prediction_horizon: parseInt(predictionHorizon),
        model_type: modelType,
        granularity: granularity,
        include_confidence: includeConfidence,
        data_points_used: historicalRows.length,
        last_actual_date: historicalRows.length > 0 ? historicalRows[historicalRows.length - 1].saptamana : null,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Eroare predictive analytics API:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la generarea predicțiilor' },
      { status: 500 }
    );
  }
}

// Funcție pentru generarea predicțiilor
function generatePredictions(
  historicalData: any[], 
  horizonDays: number, 
  modelType: string,
  granularity: string
): any[] {
  if (historicalData.length < 4) {
    // Fallback pentru date insuficiente
    return generateFallbackPredictions(horizonDays, granularity);
  }

  const predictions = [];
  const lastDataPoint = historicalData[historicalData.length - 1];
  const periodsToPredict = granularity === 'weekly' ? Math.ceil(horizonDays / 7) : 
                          granularity === 'monthly' ? Math.ceil(horizonDays / 30) : horizonDays;

  for (let i = 1; i <= periodsToPredict; i++) {
    let predictedValue = 0;
    let trend = 'stable';

    switch (modelType) {
      case 'linear':
        // Linear trend extrapolation
        const avgSlope = historicalData
          .filter(d => d.trend_slope)
          .reduce((sum, d) => sum + d.trend_slope, 0) / 
          Math.max(1, historicalData.filter(d => d.trend_slope).length);
        
        predictedValue = lastDataPoint.total_ore_saptamana + (avgSlope * i);
        trend = avgSlope > 5 ? 'up' : avgSlope < -5 ? 'down' : 'stable';
        break;

      case 'seasonal':
        // Seasonal decomposition cu trend
        const seasonalFactor = lastDataPoint.seasonal_average / lastDataPoint.moving_avg_4weeks;
        const trendComponent = lastDataPoint.moving_avg_4weeks * (1 + (lastDataPoint.trend_saptamanal || 0) / 100);
        
        predictedValue = trendComponent * seasonalFactor * (1 + Math.random() * 0.1 - 0.05); // Add small noise
        trend = lastDataPoint.trend_saptamanal > 10 ? 'up' : lastDataPoint.trend_saptamanal < -10 ? 'down' : 'stable';
        break;

      default: // time_series
        // Simple exponential smoothing cu trend
        const alpha = 0.3; // Smoothing parameter
        const beta = 0.2;  // Trend parameter
        
        const recentTrend = historicalData.slice(-4).reduce((sum, d, idx) => {
          if (idx === 0) return 0;
          return sum + (d.total_ore_saptamana - historicalData[historicalData.length - 4 + idx - 1].total_ore_saptamana);
        }, 0) / 3;

        predictedValue = lastDataPoint.total_ore_saptamana + (recentTrend * i * beta);
        trend = recentTrend > 2 ? 'up' : recentTrend < -2 ? 'down' : 'stable';
        break;
    }

    // Ensure realistic bounds
    predictedValue = Math.max(0, Math.min(predictedValue, lastDataPoint.total_ore_saptamana * 2));

    const futureDate = new Date();
    if (granularity === 'weekly') {
      futureDate.setDate(futureDate.getDate() + (i * 7));
    } else if (granularity === 'monthly') {
      futureDate.setMonth(futureDate.getMonth() + i);
    } else {
      futureDate.setDate(futureDate.getDate() + i);
    }

    predictions.push({
      period: futureDate.toISOString().split('T')[0],
      predicted_hours: Math.round(predictedValue * 100) / 100,
      trend: trend,
      model_type: modelType
    });
  }

  return predictions;
}

// Funcție pentru calcularea confidence intervals
function addConfidenceIntervals(predictions: any[], historicalData: any[]): any[] {
  if (historicalData.length < 4) {
    return predictions.map(p => ({
      ...p,
      confidence_interval: {
        lower: p.predicted_hours * 0.8,
        upper: p.predicted_hours * 1.2
      }
    }));
  }

  // Calculez variabilitatea istorică
  const recentData = historicalData.slice(-8);
  const mean = recentData.reduce((sum, d) => sum + d.total_ore_saptamana, 0) / recentData.length;
  const variance = recentData.reduce((sum, d) => sum + Math.pow(d.total_ore_saptamana - mean, 2), 0) / recentData.length;
  const stdDev = Math.sqrt(variance);

  return predictions.map((prediction, index) => {
    // Confidence interval se lărgește cu timpul
    const timeDecay = 1 + (index * 0.1);
    const margin = stdDev * 1.96 * timeDecay; // 95% confidence interval

    return {
      ...prediction,
      confidence_interval: {
        lower: Math.max(0, prediction.predicted_hours - margin),
        upper: prediction.predicted_hours + margin
      }
    };
  });
}

// Funcție pentru calcularea accuracy
function calculateAccuracy(historicalData: any[]): any {
  if (historicalData.length < 8) {
    return {
      mape: null, // Mean Absolute Percentage Error
      mae: null,  // Mean Absolute Error
      rmse: null, // Root Mean Square Error
      directional_accuracy: null
    };
  }

  // Simulez predicții pentru ultimele 4 săptămâni și compar cu actualul
  const testPeriod = historicalData.slice(-4);
  const trainingData = historicalData.slice(0, -4);
  
  if (trainingData.length < 4) return { mape: null, mae: null, rmse: null, directional_accuracy: null };

  const predictions = generatePredictions(trainingData, 28, 'time_series', 'weekly');
  
  let totalError = 0;
  let totalPercentError = 0;
  let squaredErrors = 0;
  let correctDirections = 0;

  testPeriod.forEach((actual, index) => {
    if (predictions[index]) {
      const error = Math.abs(actual.total_ore_saptamana - predictions[index].predicted_hours);
      const percentError = error / actual.total_ore_saptamana * 100;
      
      totalError += error;
      totalPercentError += percentError;
      squaredErrors += error * error;

      // Directional accuracy
      if (index > 0) {
        const actualDirection = actual.total_ore_saptamana > testPeriod[index - 1].total_ore_saptamana;
        const predictedDirection = predictions[index].predicted_hours > predictions[index - 1].predicted_hours;
        if (actualDirection === predictedDirection) correctDirections++;
      }
    }
  });

  return {
    mape: totalPercentError / testPeriod.length,
    mae: totalError / testPeriod.length,
    rmse: Math.sqrt(squaredErrors / testPeriod.length),
    directional_accuracy: testPeriod.length > 1 ? (correctDirections / (testPeriod.length - 1)) * 100 : null
  };
}

// Funcție pentru generarea insights
function generatePredictiveInsights(predictions: any[], historicalData: any[]): any[] {
  const insights = [];

  if (predictions.length === 0) return insights;

  // Trend analysis
  const upTrends = predictions.filter(p => p.trend === 'up').length;
  const downTrends = predictions.filter(p => p.trend === 'down').length;
  
  if (upTrends > downTrends) {
    insights.push({
      type: 'trend',
      severity: 'info',
      title: 'Workload crescător',
      description: `Se anticipează o creștere a workload-ului în următoarele ${predictions.length} perioade`,
      recommendation: 'Pregătește resurse suplimentare și planifică capacity scaling'
    });
  } else if (downTrends > upTrends) {
    insights.push({
      type: 'trend',
      severity: 'warning',
      title: 'Workload descrescător',
      description: `Se anticipează o scădere a activității în următoarele ${predictions.length} perioade`,
      recommendation: 'Evaluează realocarea resurselor sau planifică noi proiecte'
    });
  }

  // Capacity analysis
  if (historicalData.length > 0) {
    const maxPredicted = Math.max(...predictions.map(p => p.predicted_hours));
    const recentAverage = historicalData.slice(-4).reduce((sum, d) => sum + d.total_ore_saptamana, 0) / 4;
    
    if (maxPredicted > recentAverage * 1.3) {
      insights.push({
        type: 'capacity',
        severity: 'warning',
        title: 'Risc depășire capacitate',
        description: `Predicția maximă (${maxPredicted.toFixed(1)}h) depășește cu 30% media recentă`,
        recommendation: 'Planifică hiring sau redistribuire workload'
      });
    }
  }

  // Volatility analysis
  const volatility = predictions.reduce((sum, p, idx) => {
    if (idx === 0) return 0;
    return sum + Math.abs(p.predicted_hours - predictions[idx - 1].predicted_hours);
  }, 0) / Math.max(1, predictions.length - 1);

  if (volatility > 10) {
    insights.push({
      type: 'volatility',
      severity: 'info',
      title: 'Volatilitate ridicată',
      description: `Se anticipează fluctuații mari în workload (±${volatility.toFixed(1)}h)`,
      recommendation: 'Implementează strategie flexibilă de resource management'
    });
  }

  return insights;
}

// Fallback pentru date insuficiente
function generateFallbackPredictions(horizonDays: number, granularity: string): any[] {
  const predictions = [];
  const periodsToPredict = granularity === 'weekly' ? Math.ceil(horizonDays / 7) : 
                          granularity === 'monthly' ? Math.ceil(horizonDays / 30) : horizonDays;

  for (let i = 1; i <= periodsToPredict; i++) {
    const futureDate = new Date();
    if (granularity === 'weekly') {
      futureDate.setDate(futureDate.getDate() + (i * 7));
    } else if (granularity === 'monthly') {
      futureDate.setMonth(futureDate.getMonth() + i);
    } else {
      futureDate.setDate(futureDate.getDate() + i);
    }

    predictions.push({
      period: futureDate.toISOString().split('T')[0],
      predicted_hours: 40 + (Math.random() * 20 - 10), // Base 40h ± 10h
      trend: 'stable',
      confidence_interval: {
        lower: 30,
        upper: 60
      },
      model_type: 'fallback'
    });
  }

  return predictions;
}
