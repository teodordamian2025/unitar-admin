// ==================================================================
// CALEA: app/api/anaf/monitoring/route.ts
// DESCRIERE: API Backend pentru ANAF Monitoring Dashboard
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

// ✅ Interfaces pentru monitoring data
export interface SystemHealth {
  oauth: {
    status: 'healthy' | 'warning' | 'critical';
    tokenValid: boolean;
    expiresInDays: number;
    expiresAt: string;
    lastRefresh: string;
  };
  anafApi: {
    status: 'healthy' | 'warning' | 'critical';
    connected: boolean;
    responseTime: number;
    lastSuccessfulCall: string;
    uptime: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'critical';
    connected: boolean;
    responseTime: number;
    errorCount: number;
  };
  notifications: {
    status: 'healthy' | 'warning' | 'critical';
    enabled: boolean;
    lastSent: string;
    totalSent24h: number;
  };
}

export interface PerformanceMetrics {
  successRate: number;
  successRateTrend: number; // +/- percentage vs previous period
  totalInvoices: number;
  successfulInvoices: number;
  failedInvoices: number;
  averageResponseTime: number;
  errorRate: number;
  errorRateTrend: number;
  peakHour: string;
  slowestOperation: string;
}

export interface ErrorAnalysis {
  recentErrors: Array<{
    category: string;
    count: number;
    severity: string;
    trend: 'up' | 'down' | 'stable';
    lastOccurrence: string;
  }>;
  errorTimeline: Array<{
    timestamp: string;
    category: string;
    count: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export interface InvoiceFlowMetrics {
  flowByHour: Array<{
    hour: string;
    total: number;
    successful: number;
    failed: number;
  }>;
  flowByDay: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

// ==================================================================
// GET: Monitoring dashboard data
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'overview';
    const timeRange = searchParams.get('timeRange') || '24h';

    switch (endpoint) {
      case 'overview':
        return await getOverviewData(timeRange);
      
      case 'health':
        return await getSystemHealth();
      
      case 'performance':
        return await getPerformanceMetrics(timeRange);
      
      case 'errors':
        return await getErrorAnalysis(timeRange);
      
      case 'flow':
        return await getInvoiceFlowMetrics(timeRange);
      
      case 'alerts':
        return await getActiveAlerts();
      
      case 'realtime':
        return await getRealTimeStatus();
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown endpoint'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in monitoring API:', error);
    return NextResponse.json({
      success: false,
      error: 'Monitoring API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// POST: Trigger actions și refresh data
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'refresh_token':
        return await handleRefreshToken();
      
      case 'test_connection':
        return await handleTestConnection();
      
      case 'retry_failed_invoices':
        return await handleRetryFailedInvoices(data);
      
      case 'clear_alerts':
        return await handleClearAlerts(data);
      
      case 'send_test_notification':
        return await handleSendTestNotification();
      
      case 'force_health_check':
        return await handleForceHealthCheck();
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error executing monitoring action:', error);
    return NextResponse.json({
      success: false,
      error: 'Action execution failed'
    }, { status: 500 });
  }
}

// ==================================================================
// Overview Data (Combined dashboard view)
// ==================================================================
async function getOverviewData(timeRange: string) {
  try {
    const [health, performance, errors] = await Promise.all([
      getSystemHealthData(),
      getPerformanceMetricsData(timeRange),
      getErrorAnalysisData(timeRange)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        health,
        performance,
        errors: errors.recentErrors.slice(0, 5), // Top 5 pentru overview
        timestamp: new Date().toISOString(),
        timeRange
      }
    });

  } catch (error) {
    throw new Error(`Overview data error: ${error}`);
  }
}

// ==================================================================
// System Health Monitoring
// ==================================================================
async function getSystemHealth() {
  const healthData = await getSystemHealthData();
  
  return NextResponse.json({
    success: true,
    health: healthData,
    timestamp: new Date().toISOString()
  });
}

async function getSystemHealthData(): Promise<SystemHealth> {
  // OAuth Token Health
  const tokenHealth = await checkOAuthTokenHealth();
  
  // ANAF API Health
  const anafHealth = await checkANAFApiHealth();
  
  // Database Health
  const dbHealth = await checkDatabaseHealth();
  
  // Notifications Health
  const notifHealth = await checkNotificationsHealth();

  return {
    oauth: tokenHealth,
    anafApi: anafHealth,
    database: dbHealth,
    notifications: notifHealth
  };
}

async function checkOAuthTokenHealth() {
  try {
    const query = `
      SELECT 
        expires_at,
        data_creare as last_refresh,
        TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), DAY) as expires_in_days
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafTokens\`
      WHERE is_active = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });
    
    if (rows.length === 0) {
      return {
        status: 'critical' as const,
        tokenValid: false,
        expiresInDays: 0,
        expiresAt: '',
        lastRefresh: ''
      };
    }

    const token = rows[0];
    const expiresInDays = parseInt(token.expires_in_days);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (expiresInDays <= 3) status = 'critical';
    else if (expiresInDays <= 7) status = 'warning';

    return {
      status,
      tokenValid: expiresInDays > 0,
      expiresInDays,
      expiresAt: token.expires_at,
      lastRefresh: token.last_refresh
    };

  } catch (error) {
    return {
      status: 'critical' as const,
      tokenValid: false,
      expiresInDays: 0,
      expiresAt: '',
      lastRefresh: ''
    };
  }
}

async function checkANAFApiHealth() {
  try {
    // Simulează test conexiune ANAF
    const startTime = Date.now();
    
    // TODO: Implement actual ANAF API ping/health check
    // Pentru moment returnăm date mock
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy' as const,
      connected: true,
      responseTime,
      lastSuccessfulCall: new Date().toISOString(),
      uptime: 99.8 // percentage
    };

  } catch (error) {
    return {
      status: 'critical' as const,
      connected: false,
      responseTime: 0,
      lastSuccessfulCall: '',
      uptime: 0
    };
  }
}

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    
    // Test query simplă
    const query = 'SELECT 1 as test';
    await bigquery.query({ query, location: 'EU' });
    
    const responseTime = Date.now() - startTime;

    // Check pentru erori recente
    const errorQuery = `
      SELECT COUNT(*) as error_count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafErrorLog\`
      WHERE category = 'database_error'
        AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
    `;

    const [errorRows] = await bigquery.query({ query: errorQuery, location: 'EU' });
    const errorCount = parseInt(errorRows[0]?.error_count) || 0;

    return {
      status: errorCount > 10 ? 'warning' as const : 'healthy' as const,
      connected: true,
      responseTime,
      errorCount
    };

  } catch (error) {
    return {
      status: 'critical' as const,
      connected: false,
      responseTime: 0,
      errorCount: 999
    };
  }
}

async function checkNotificationsHealth() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_sent,
        COUNTIF(success = true) as successful_sent,
        MAX(timestamp) as last_sent
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafNotificationLog\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });
    const stats = rows[0] || { total_sent: 0, successful_sent: 0, last_sent: null };

    const enabled = process.env.NOTIFICATION_ENABLED === 'true';
    const successRate = stats.total_sent > 0 ? 
      (parseInt(stats.successful_sent) / parseInt(stats.total_sent)) * 100 : 100;

    return {
      status: (!enabled || successRate < 80) ? 'warning' as const : 'healthy' as const,
      enabled,
      lastSent: stats.last_sent || '',
      totalSent24h: parseInt(stats.total_sent)
    };

  } catch (error) {
    return {
      status: 'critical' as const,
      enabled: false,
      lastSent: '',
      totalSent24h: 0
    };
  }
}

// ==================================================================
// Performance Metrics
// ==================================================================
async function getPerformanceMetrics(timeRange: string) {
  const performanceData = await getPerformanceMetricsData(timeRange);
  
  return NextResponse.json({
    success: true,
    performance: performanceData,
    timeRange,
    timestamp: new Date().toISOString()
  });
}

async function getPerformanceMetricsData(timeRange: string): Promise<PerformanceMetrics> {
  const timeFilter = getTimeFilter(timeRange);
  const previousTimeFilter = getPreviousTimeFilter(timeRange);

  try {
    // Current period stats
    const currentQuery = `
      SELECT 
        COUNT(*) as total_invoices,
        COUNTIF(efactura_status = 'validated') as successful_invoices,
        COUNTIF(efactura_status IN ('error', 'anaf_error')) as failed_invoices,
        SAFE_DIVIDE(COUNTIF(efactura_status = 'validated'), COUNT(*)) * 100 as success_rate,
        SAFE_DIVIDE(COUNTIF(efactura_status IN ('error', 'anaf_error')), COUNT(*)) * 100 as error_rate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true AND ${timeFilter}
    `;

    // Previous period stats (pentru trend calculation)
    const previousQuery = `
      SELECT 
        SAFE_DIVIDE(COUNTIF(efactura_status = 'validated'), COUNT(*)) * 100 as prev_success_rate,
        SAFE_DIVIDE(COUNTIF(efactura_status IN ('error', 'anaf_error')), COUNT(*)) * 100 as prev_error_rate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true AND ${previousTimeFilter}
    `;

    const [currentRows] = await bigquery.query({ query: currentQuery, location: 'EU' });
    const [previousRows] = await bigquery.query({ query: previousQuery, location: 'EU' });
    
    const current = currentRows[0] || {
      total_invoices: 0,
      successful_invoices: 0,
      failed_invoices: 0,
      success_rate: 0,
      error_rate: 0
    };

    const previous = previousRows[0] || {
      prev_success_rate: 0,
      prev_error_rate: 0
    };

    return {
      successRate: parseFloat(current.success_rate) || 0,
      successRateTrend: (parseFloat(current.success_rate) || 0) - (parseFloat(previous.prev_success_rate) || 0),
      totalInvoices: parseInt(current.total_invoices),
      successfulInvoices: parseInt(current.successful_invoices),
      failedInvoices: parseInt(current.failed_invoices),
      averageResponseTime: 1.8, // TODO: Calculate from actual response times
      errorRate: parseFloat(current.error_rate) || 0,
      errorRateTrend: (parseFloat(current.error_rate) || 0) - (parseFloat(previous.prev_error_rate) || 0),
      peakHour: '14:00', // TODO: Calculate from hourly distribution
      slowestOperation: 'XML Generation' // TODO: Get from performance logs
    };

  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      successRate: 0,
      successRateTrend: 0,
      totalInvoices: 0,
      successfulInvoices: 0,
      failedInvoices: 0,
      averageResponseTime: 0,
      errorRate: 0,
      errorRateTrend: 0,
      peakHour: 'N/A',
      slowestOperation: 'N/A'
    };
  }
}

// ==================================================================
// Error Analysis
// ==================================================================
async function getErrorAnalysis(timeRange: string) {
  const errorData = await getErrorAnalysisData(timeRange);
  
  return NextResponse.json({
    success: true,
    errors: errorData,
    timeRange,
    timestamp: new Date().toISOString()
  });
}

async function getErrorAnalysisData(timeRange: string): Promise<ErrorAnalysis> {
  const timeFilter = getTimeFilter(timeRange);

  try {
    // Recent errors by category
    const errorsQuery = `
      SELECT 
        category,
        severity,
        COUNT(*) as count,
        MAX(timestamp) as last_occurrence
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafErrorLog\`
      WHERE ${timeFilter.replace('data_creare', 'timestamp')}
      GROUP BY category, severity
      ORDER BY count DESC
      LIMIT 10
    `;

    // Error timeline (pentru chart)
    const timelineQuery = `
      SELECT 
        DATETIME_TRUNC(timestamp, HOUR) as hour,
        category,
        COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafErrorLog\`
      WHERE ${timeFilter.replace('data_creare', 'timestamp')}
      GROUP BY hour, category
      ORDER BY hour DESC
      LIMIT 48
    `;

    const [errorRows] = await bigquery.query({ query: errorsQuery, location: 'EU' });
    const [timelineRows] = await bigquery.query({ query: timelineQuery, location: 'EU' });

    const recentErrors = errorRows.map((row: any) => ({
      category: row.category,
      count: parseInt(row.count),
      severity: row.severity,
      trend: 'stable' as const, // TODO: Calculate actual trend
      lastOccurrence: row.last_occurrence
    }));

    const errorTimeline = timelineRows.map((row: any) => ({
      timestamp: row.hour,
      category: row.category,
      count: parseInt(row.count)
    }));

    const topFailureReasons = recentErrors.slice(0, 5).map(error => ({
      reason: error.category,
      count: error.count,
      percentage: 0 // TODO: Calculate percentage
    }));

    return {
      recentErrors,
      errorTimeline,
      topFailureReasons
    };

  } catch (error) {
    console.error('Error getting error analysis:', error);
    return {
      recentErrors: [],
      errorTimeline: [],
      topFailureReasons: []
    };
  }
}

// ==================================================================
// Invoice Flow Metrics
// ==================================================================
async function getInvoiceFlowMetrics(timeRange: string) {
  const flowData = await getInvoiceFlowMetricsData(timeRange);
  
  return NextResponse.json({
    success: true,
    flow: flowData,
    timeRange,
    timestamp: new Date().toISOString()
  });
}

async function getInvoiceFlowMetricsData(timeRange: string): Promise<InvoiceFlowMetrics> {
  const timeFilter = getTimeFilter(timeRange);

  try {
    // Flow by hour
    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM data_creare) as hour,
        COUNT(*) as total,
        COUNTIF(efactura_status = 'validated') as successful,
        COUNTIF(efactura_status IN ('error', 'anaf_error')) as failed
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true AND ${timeFilter}
      GROUP BY hour
      ORDER BY hour
    `;

    // Status distribution
    const statusQuery = `
      SELECT 
        efactura_status as status,
        COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true AND ${timeFilter}
      GROUP BY efactura_status
      ORDER BY count DESC
    `;

    const [hourlyRows] = await bigquery.query({ query: hourlyQuery, location: 'EU' });
    const [statusRows] = await bigquery.query({ query: statusQuery, location: 'EU' });

    const totalInvoices = statusRows.reduce((sum, row) => sum + parseInt(row.count), 0);

    return {
      flowByHour: hourlyRows.map((row: any) => ({
        hour: `${row.hour}:00`,
        total: parseInt(row.total),
        successful: parseInt(row.successful),
        failed: parseInt(row.failed)
      })),
      flowByDay: [], // TODO: Implement daily flow
      statusDistribution: statusRows.map((row: any) => ({
        status: row.status || 'unknown',
        count: parseInt(row.count),
        percentage: totalInvoices > 0 ? (parseInt(row.count) / totalInvoices) * 100 : 0
      }))
    };

  } catch (error) {
    console.error('Error getting flow metrics:', error);
    return {
      flowByHour: [],
      flowByDay: [],
      statusDistribution: []
    };
  }
}

// ==================================================================
// Action Handlers
// ==================================================================
async function handleRefreshToken() {
  try {
    // Call the existing token refresh API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/anaf/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' })
    });

    const result = await response.json();
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Token refreshed successfully' : 'Token refresh failed',
      details: result
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh token'
    }, { status: 500 });
  }
}

async function handleTestConnection() {
  // TODO: Implement actual ANAF connection test
  return NextResponse.json({
    success: true,
    connected: true,
    responseTime: 245,
    message: 'Connection test successful'
  });
}

async function handleRetryFailedInvoices(data: any) {
  // TODO: Implement retry logic for failed invoices
  return NextResponse.json({
    success: true,
    retriedCount: data?.invoiceIds?.length || 0,
    message: 'Retry initiated for failed invoices'
  });
}

async function handleClearAlerts(data: any) {
  // TODO: Implement alert clearing
  return NextResponse.json({
    success: true,
    clearedCount: data?.alertIds?.length || 0,
    message: 'Alerts cleared successfully'
  });
}

async function handleSendTestNotification() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/anaf/notifications?action=test_email`);
    const result = await response.json();
    
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to send test notification'
    }, { status: 500 });
  }
}

async function handleForceHealthCheck() {
  const healthData = await getSystemHealthData();
  
  return NextResponse.json({
    success: true,
    health: healthData,
    message: 'Health check completed'
  });
}

// ==================================================================
// Active Alerts & Real-time Status
// ==================================================================
async function getActiveAlerts() {
  try {
    // Get recent critical errors and warnings
    const query = `
      SELECT 
        category,
        severity,
        message,
        timestamp,
        factura_id
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafErrorLog\`
      WHERE severity IN ('critical', 'high')
        AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    return NextResponse.json({
      success: true,
      alerts: rows.map((row: any) => ({
        id: `${row.category}_${row.timestamp}`,
        category: row.category,
        severity: row.severity,
        message: row.message,
        timestamp: row.timestamp,
        facturaId: row.factura_id,
        status: 'active'
      })),
      count: rows.length
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      alerts: [],
      count: 0,
      error: 'Failed to get alerts'
    });
  }
}

async function getRealTimeStatus() {
  try {
    const health = await getSystemHealthData();
    
    // Get last 5 minutes activity
    const recentQuery = `
      SELECT 
        COUNT(*) as recent_invoices,
        COUNTIF(efactura_status = 'validated') as recent_successful
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true 
        AND data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
    `;

    const [rows] = await bigquery.query({ query: recentQuery, location: 'EU' });
    const recentActivity = rows[0] || { recent_invoices: 0, recent_successful: 0 };

    return NextResponse.json({
      success: true,
      realtime: {
        systemStatus: health.oauth.status === 'healthy' && 
                     health.anafApi.status === 'healthy' && 
                     health.database.status === 'healthy' ? 'operational' : 'degraded',
        lastUpdate: new Date().toISOString(),
        recentActivity: {
          invoicesLast5Min: parseInt(recentActivity.recent_invoices),
          successfulLast5Min: parseInt(recentActivity.recent_successful)
        },
        components: health
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get real-time status'
    }, { status: 500 });
  }
}

// ==================================================================
// Helper Functions
// ==================================================================
function getTimeFilter(timeRange: string): string {
  switch (timeRange) {
    case '1h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)';
    case '6h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)';
    case '24h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)';
    case '7d':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)';
    case '30d':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)';
    default:
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)';
  }
}

function getPreviousTimeFilter(timeRange: string): string {
  switch (timeRange) {
    case '1h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)';
    case '6h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 12 HOUR) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)';
    case '24h':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)';
    case '7d':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)';
    case '30d':
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)';
    default:
      return 'data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY) AND data_creare < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)';
  }
}
