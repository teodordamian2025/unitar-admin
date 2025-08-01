// ==================================================================
// CALEA: app/api/anaf/error-handler/route.ts
// DESCRIERE: Centralized Error Handling & Categorization pentru ANAF
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

// ✅ Error Categories - Complete din planul inițial
const ErrorCategory = {
  // OAuth Errors
  OAUTH_EXPIRED: 'oauth_expired',
  OAUTH_INVALID: 'oauth_invalid', 
  OAUTH_REVOKED: 'oauth_revoked',
  
  // XML Errors
  XML_GENERATION: 'xml_generation',
  XML_VALIDATION: 'xml_validation',
  XML_BUSINESS_RULES: 'xml_business_rules',
  
  // Upload Errors
  ANAF_CONNECTION: 'anaf_connection',
  ANAF_TIMEOUT: 'anaf_timeout',
  ANAF_SERVER_ERROR: 'anaf_server_error',
  ANAF_BUSINESS_ERROR: 'anaf_business_error',
  
  // System Errors
  DATABASE_ERROR: 'database_error',
  NETWORK_ERROR: 'network_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN_ERROR: 'unknown_error'
} as const;

type ErrorCategoryType = typeof ErrorCategory[keyof typeof ErrorCategory];

// ✅ Error Severity Levels
const ErrorSeverity = {
  LOW: 'low',           // Info/Warning
  MEDIUM: 'medium',     // Recoverable errors
  HIGH: 'high',         // Business impact
  CRITICAL: 'critical'  // System down
} as const;

type ErrorSeverityType = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// ✅ Retry Strategy Configuration
interface RetryConfig {
  shouldRetry: boolean;
  maxRetries: number;
  backoffIntervals: number[]; // în minute
  requiresManualIntervention: boolean;
}

// ✅ Error Context Interface
interface ErrorContext {
  category: ErrorCategoryType;
  severity: ErrorSeverityType;
  message: string;
  details?: any;
  facturaId?: string;
  userId?: string;
  timestamp: string;
  retryConfig: RetryConfig;
  stackTrace?: string;
  anafResponse?: any;
}

// ✅ Retry Strategy Mapping
const RETRY_STRATEGIES: Record<ErrorCategoryType, RetryConfig> = {
  // OAuth errors: Refresh token automat
  [ErrorCategory.OAUTH_EXPIRED]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [1, 5, 15], // 1min, 5min, 15min
    requiresManualIntervention: false
  },
  [ErrorCategory.OAUTH_INVALID]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  [ErrorCategory.OAUTH_REVOKED]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  
  // Connection errors: Retry după 5min, 15min, 1h
  [ErrorCategory.ANAF_CONNECTION]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [5, 15, 60], // 5min, 15min, 1h
    requiresManualIntervention: false
  },
  [ErrorCategory.ANAF_TIMEOUT]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [5, 15, 60],
    requiresManualIntervention: false
  },
  
  // Server errors: Retry după 1h, 4h, 24h
  [ErrorCategory.ANAF_SERVER_ERROR]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [60, 240, 1440], // 1h, 4h, 24h
    requiresManualIntervention: false
  },
  
  // Business errors: Nu retry, necesită intervenție manuală
  [ErrorCategory.XML_BUSINESS_RULES]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  [ErrorCategory.ANAF_BUSINESS_ERROR]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  
  // XML errors: Limitată retry pentru generare
  [ErrorCategory.XML_GENERATION]: {
    shouldRetry: true,
    maxRetries: 2,
    backoffIntervals: [2, 10], // 2min, 10min
    requiresManualIntervention: false
  },
  [ErrorCategory.XML_VALIDATION]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  
  // System errors
  [ErrorCategory.DATABASE_ERROR]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [2, 10, 30],
    requiresManualIntervention: false
  },
  [ErrorCategory.NETWORK_ERROR]: {
    shouldRetry: true,
    maxRetries: 3,
    backoffIntervals: [5, 15, 60],
    requiresManualIntervention: false
  },
  [ErrorCategory.VALIDATION_ERROR]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffIntervals: [],
    requiresManualIntervention: true
  },
  [ErrorCategory.UNKNOWN_ERROR]: {
    shouldRetry: true,
    maxRetries: 1,
    backoffIntervals: [10],
    requiresManualIntervention: true
  }
};

// ✅ Severity Mapping
const SEVERITY_MAPPING: Record<ErrorCategoryType, ErrorSeverityType> = {
  [ErrorCategory.OAUTH_EXPIRED]: ErrorSeverity.MEDIUM,
  [ErrorCategory.OAUTH_INVALID]: ErrorSeverity.HIGH,
  [ErrorCategory.OAUTH_REVOKED]: ErrorSeverity.CRITICAL,
  [ErrorCategory.XML_GENERATION]: ErrorSeverity.MEDIUM,
  [ErrorCategory.XML_VALIDATION]: ErrorSeverity.HIGH,
  [ErrorCategory.XML_BUSINESS_RULES]: ErrorSeverity.HIGH,
  [ErrorCategory.ANAF_CONNECTION]: ErrorSeverity.HIGH,
  [ErrorCategory.ANAF_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCategory.ANAF_SERVER_ERROR]: ErrorSeverity.HIGH,
  [ErrorCategory.ANAF_BUSINESS_ERROR]: ErrorSeverity.HIGH,
  [ErrorCategory.DATABASE_ERROR]: ErrorSeverity.HIGH,
  [ErrorCategory.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCategory.VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCategory.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
};

// ==================================================================
// POST: Log și procesează erori
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const {
      error,
      facturaId,
      userId,
      anafResponse,
      additionalContext
    } = await request.json();

    // Categorizează eroarea
    const errorContext = categorizeError(error, {
      facturaId,
      userId,
      anafResponse,
      additionalContext
    });

    // Salvează în BigQuery pentru monitoring
    const saveResult = await logErrorToDatabase(errorContext);
    
    if (!saveResult.success) {
      console.error('❌ Failed to log error to database:', saveResult.error);
    }

    // Determină dacă trebuie trimisă notificare
    const shouldNotify = shouldSendNotification(errorContext);

    // Returnează recomandările pentru handling
    return NextResponse.json({
      success: true,
      errorContext,
      recommendations: {
        shouldRetry: errorContext.retryConfig.shouldRetry,
        nextRetryIn: errorContext.retryConfig.shouldRetry ? 
          errorContext.retryConfig.backoffIntervals[0] : null,
        requiresManualIntervention: errorContext.retryConfig.requiresManualIntervention,
        shouldNotify,
        severity: errorContext.severity
      },
      errorId: saveResult.errorId
    });

  } catch (processingError) {
    console.error('❌ Error processing error (meta-error):', processingError);
    return NextResponse.json({
      success: false,
      error: 'Failed to process error',
      details: processingError instanceof Error ? processingError.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// GET: Retrieve error statistics și trends
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');

    const stats = await getErrorStatistics(timeRange, category, severity);

    return NextResponse.json({
      success: true,
      statistics: stats,
      timeRange,
      filters: { category, severity }
    });

  } catch (error) {
    console.error('❌ Error retrieving statistics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve error statistics'
    }, { status: 500 });
  }
}

// ==================================================================
// Helper Functions
// ==================================================================

function categorizeError(error: any, context: any): ErrorContext {
  const timestamp = new Date().toISOString();
  
  // Determine category based on error characteristics
  let category: ErrorCategoryType = ErrorCategory.UNKNOWN_ERROR;
  
  // OAuth-related errors
  if (error.message?.includes('token') || error.message?.includes('oauth')) {
    if (error.message.includes('expired')) {
      category = ErrorCategory.OAUTH_EXPIRED;
    } else if (error.message.includes('invalid')) {
      category = ErrorCategory.OAUTH_INVALID;
    } else if (error.message.includes('revoked')) {
      category = ErrorCategory.OAUTH_REVOKED;
    }
  }
  
  // XML-related errors
  else if (error.message?.includes('xml') || error.message?.includes('XML')) {
    if (error.message.includes('generation') || error.message.includes('generat')) {
      category = ErrorCategory.XML_GENERATION;
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      category = ErrorCategory.XML_VALIDATION;
    } else if (error.message.includes('business') || error.message.includes('rules')) {
      category = ErrorCategory.XML_BUSINESS_RULES;
    }
  }
  
  // ANAF API errors
  else if (context.anafResponse) {
    if (context.anafResponse.status >= 500) {
      category = ErrorCategory.ANAF_SERVER_ERROR;
    } else if (context.anafResponse.status === 408 || error.message?.includes('timeout')) {
      category = ErrorCategory.ANAF_TIMEOUT;
    } else if (context.anafResponse.status >= 400) {
      category = ErrorCategory.ANAF_BUSINESS_ERROR;
    }
  }
  
  // Connection errors
  else if (error.message?.includes('connect') || error.message?.includes('network')) {
    category = ErrorCategory.ANAF_CONNECTION;
  }
  
  // Database errors
  else if (error.message?.includes('BigQuery') || error.message?.includes('database')) {
    category = ErrorCategory.DATABASE_ERROR;
  }
  
  // Validation errors
  else if (error.message?.includes('validation') || error.message?.includes('required')) {
    category = ErrorCategory.VALIDATION_ERROR;
  }

  const severity = SEVERITY_MAPPING[category];
  const retryConfig = RETRY_STRATEGIES[category];

  return {
    category,
    severity,
    message: error.message || 'Unknown error occurred',
    details: {
      originalError: error,
      ...context.additionalContext
    },
    facturaId: context.facturaId,
    userId: context.userId,
    timestamp,
    retryConfig,
    stackTrace: error.stack,
    anafResponse: context.anafResponse
  };
}

async function logErrorToDatabase(errorContext: ErrorContext) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('AnafErrorLog');

    const errorRecord = [{
      id: crypto.randomUUID(),
      category: errorContext.category,
      severity: errorContext.severity,
      message: errorContext.message,
      details: JSON.stringify(errorContext.details),
      factura_id: errorContext.facturaId,
      user_id: errorContext.userId,
      timestamp: errorContext.timestamp,
      should_retry: errorContext.retryConfig.shouldRetry,
      max_retries: errorContext.retryConfig.maxRetries,
      requires_manual_intervention: errorContext.retryConfig.requiresManualIntervention,
      stack_trace: errorContext.stackTrace,
      anaf_response: errorContext.anafResponse ? JSON.stringify(errorContext.anafResponse) : null,
      data_creare: new Date().toISOString()
    }];

    await table.insert(errorRecord);

    return {
      success: true,
      errorId: errorRecord[0].id
    };

  } catch (error) {
    console.error('❌ Error logging to database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database logging failed'
    };
  }
}

function shouldSendNotification(errorContext: ErrorContext): boolean {
  // Critical errors: always notify
  if (errorContext.severity === ErrorSeverity.CRITICAL) {
    return true;
  }

  // High severity errors that require manual intervention
  if (errorContext.severity === ErrorSeverity.HIGH && 
      errorContext.retryConfig.requiresManualIntervention) {
    return true;
  }

  // OAuth errors (business critical)
  if (errorContext.category.startsWith('oauth_')) {
    return true;
  }

  return false;
}

async function getErrorStatistics(timeRange: string, category?: string, severity?: string) {
  try {
    let timeFilter = '';
    switch (timeRange) {
      case '1h':
        timeFilter = "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)";
        break;
      case '24h':
        timeFilter = "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)";
        break;
      case '7d':
        timeFilter = "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)";
        break;
      case '30d':
        timeFilter = "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)";
        break;
      default:
        timeFilter = "timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)";
    }

    const query = `
      SELECT 
        category,
        severity,
        COUNT(*) as error_count,
        COUNT(DISTINCT factura_id) as affected_invoices,
        AVG(CASE WHEN should_retry THEN max_retries ELSE 0 END) as avg_retries,
        SUM(CASE WHEN requires_manual_intervention THEN 1 ELSE 0 END) as manual_interventions_needed
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafErrorLog\`
      WHERE ${timeFilter}
        ${category ? `AND category = @category` : ''}
        ${severity ? `AND severity = @severity` : ''}
      GROUP BY category, severity
      ORDER BY error_count DESC
    `;

    const params: any = {};
    if (category) params.category = category;
    if (severity) params.severity = severity;

    const [rows] = await bigquery.query({
      query,
      params,
      location: 'EU'
    });

    return {
      errorsByCategory: rows,
      totalErrors: rows.reduce((sum, row) => sum + parseInt(row.error_count), 0),
      criticalErrors: rows.filter(row => row.severity === 'critical').length,
      manualInterventionsNeeded: rows.reduce((sum, row) => sum + parseInt(row.manual_interventions_needed || 0), 0)
    };

  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    return {
      errorsByCategory: [],
      totalErrors: 0,
      criticalErrors: 0,
      manualInterventionsNeeded: 0,
      error: error instanceof Error ? error.message : 'Statistics error'
    };
  }
}
