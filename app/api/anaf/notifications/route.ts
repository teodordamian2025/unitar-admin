// ==================================================================
// CALEA: app/api/anaf/notifications/route.ts
// DESCRIERE: Email Notifications System pentru ANAF Error Monitoring
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import nodemailer from 'nodemailer';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ Notification Types din planul inițial
const NotificationType = {
  TOKEN_EXPIRY_WARNING: 'token_expiry_warning',    // Token expiră în 7 zile
  BULK_ERRORS: 'bulk_errors',                      // Facturi cu erori ANAF > 5
  HIGH_FAILURE_RATE: 'high_failure_rate',          // Upload failure rate > 10%
  CONNECTION_DOWN: 'connection_down',              // Conexiune ANAF down
  CRITICAL_ERROR: 'critical_error',                // Eroare critică imediată
  MANUAL_INTERVENTION: 'manual_intervention',      // Necesită intervenție manuală
  DAILY_SUMMARY: 'daily_summary',                  // Rezumatul zilnic
  SYSTEM_HEALTH: 'system_health'                   // Status general sistem
} as const;

type NotificationTypeType = typeof NotificationType[keyof typeof NotificationType];

interface NotificationContext {
  type: NotificationTypeType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: any;
  recipients?: string[];
  timestamp: string;
}

// ✅ SMTP Transporter Configuration
let transporter: nodemailer.Transporter | null = null;

function getEmailTransporter() {
  if (!transporter) {
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true pentru 465, false pentru alte porturi
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    transporter = nodemailer.createTransport(smtpConfig);
  }

  return transporter;
}

// ==================================================================
// POST: Trimite notificare specifică
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { type, data, forceNotification = false } = await request.json();

    if (!process.env.NOTIFICATION_ENABLED && !forceNotification) {
      return NextResponse.json({
        success: true,
        message: 'Notifications are disabled',
        sent: false
      });
    }

    let notificationContext: NotificationContext;

    switch (type) {
      case NotificationType.TOKEN_EXPIRY_WARNING:
        notificationContext = await buildTokenExpiryNotification(data);
        break;
      
      case NotificationType.BULK_ERRORS:
        notificationContext = await buildBulkErrorsNotification(data);
        break;
      
      case NotificationType.HIGH_FAILURE_RATE:
        notificationContext = await buildHighFailureRateNotification(data);
        break;
      
      case NotificationType.CONNECTION_DOWN:
        notificationContext = await buildConnectionDownNotification(data);
        break;
      
      case NotificationType.CRITICAL_ERROR:
        notificationContext = await buildCriticalErrorNotification(data);
        break;
      
      case NotificationType.MANUAL_INTERVENTION:
        notificationContext = await buildManualInterventionNotification(data);
        break;
      
      case NotificationType.DAILY_SUMMARY:
        notificationContext = await buildDailySummaryNotification();
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown notification type'
        }, { status: 400 });
    }

    // Trimite notificarea
    const sendResult = await sendNotification(notificationContext);
    
    // Log notificarea în BigQuery
    await logNotificationToDatabase(notificationContext, sendResult.success);

    return NextResponse.json({
      success: true,
      notificationSent: sendResult.success,
      recipients: notificationContext.recipients?.length || 0,
      error: sendResult.error
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to send notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// GET: Sistemul de monitoring automat și health checks
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'health_check';

    switch (action) {
      case 'health_check':
        return await performHealthCheck();
      
      case 'check_token_expiry':
        return await checkTokenExpiry();
      
      case 'check_error_rates':
        return await checkErrorRates();
      
      case 'test_email':
        return await testEmailConfiguration();
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in monitoring check:', error);
    return NextResponse.json({
      success: false,
      error: 'Monitoring check failed'
    }, { status: 500 });
  }
}

// ==================================================================
// Notification Builders
// ==================================================================

async function buildTokenExpiryNotification(data: any): Promise<NotificationContext> {
  const expiresInDays = Math.floor(data.expiresInMinutes / (60 * 24));
  
  return {
    type: NotificationType.TOKEN_EXPIRY_WARNING,
    severity: expiresInDays <= 3 ? 'error' : 'warning',
    title: `🔑 ANAF Token expiră în ${expiresInDays} zile`,
    message: `
Token-ul ANAF pentru e-factura va expira în ${expiresInDays} zile.

📅 Data expirare: ${new Date(data.expiresAt).toLocaleDateString('ro-RO')}
⏰ Timpul rămas: ${data.expiresInMinutes} minute

🔧 Acțiuni necesare:
- Accesează: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup
- Reîmprospătează token-ul OAuth ANAF
- Verifică că sistemul funcționează corect

💡 Pentru a evita întreruperea serviciilor de e-facturare, te rugăm să actualizezi token-ul cât mai curând.
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildBulkErrorsNotification(data: any): Promise<NotificationContext> {
  return {
    type: NotificationType.BULK_ERRORS,
    severity: 'error',
    title: `📄 ${data.errorCount} facturi cu erori ANAF`,
    message: `
Sistemul a detectat un numărul mare de erori ANAF.

📊 Statistici:
- Facturi cu erori: ${data.errorCount}
- Perioada: ultimele ${data.timeRange}
- Tipuri de erori: ${data.errorTypes?.join(', ') || 'Mixed'}

⚠️ Erori frecvente:
${data.topErrors?.map((err: any) => `- ${err.category}: ${err.count} erori`).join('\n') || 'N/A'}

🔧 Acțiuni recomandate:
- Verifică configurația ANAF OAuth
- Revizia datele facturilor cu probleme
- Contactează support-ul ANAF dacă persistă

🔗 Vezi detalii: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/rapoarte/facturi?status=error
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildHighFailureRateNotification(data: any): Promise<NotificationContext> {
  return {
    type: NotificationType.HIGH_FAILURE_RATE,
    severity: 'error',
    title: `📈 Rata de erori ridicată: ${data.failureRate.toFixed(1)}%`,
    message: `
Rata de erori pentru e-factura ANAF a depășit pragul critic.

📊 Metrici:
- Rata de erori: ${data.failureRate.toFixed(1)}%
- Facturi procesate: ${data.totalInvoices}
- Facturi cu erori: ${data.failedInvoices}
- Perioada: ${data.timeRange}

🎯 Praguri:
- Atenție: >10%
- Critic: >20%
- Actual: ${data.failureRate.toFixed(1)}% ${data.failureRate > 20 ? '🔴 CRITIC' : '🟡 ATENȚIE'}

🔧 Investigare necesară:
- Verifică conexiunea la ANAF
- Analizează tipurile de erori
- Possible probleme la nivel de sistem

🔗 Dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/monitoring
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildConnectionDownNotification(data: any): Promise<NotificationContext> {
  return {
    type: NotificationType.CONNECTION_DOWN,
    severity: 'critical',
    title: '🔴 Conexiunea ANAF este DOWN',
    message: `
Sistemul nu poate conecta la serviciile ANAF pentru e-factura.

⚠️ Status:
- Ultima conexiune reușită: ${data.lastSuccessfulConnection || 'Necunoscută'}
- Timp de down: ${data.downTime || 'Calculează...'}
- Încercări de reconectare: ${data.retryAttempts || 0}

🔧 Verificări automate în curs:
- Test conectivitate ANAF API
- Verificare status OAuth token
- Monitoring servicii ANAF

📞 Acțiuni:
1. Verifică status oficial ANAF: https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_files/API_efactura.htm
2. Testează manual: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?test=connection
3. Contactează echipa tehnică dacă persistă

⏰ Următoarea verificare: ${new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString('ro-RO')}
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildCriticalErrorNotification(data: any): Promise<NotificationContext> {
  return {
    type: NotificationType.CRITICAL_ERROR,
    severity: 'critical',
    title: `🚨 Eroare critică: ${data.category}`,
    message: `
O eroare critică a fost detectată în sistemul de e-facturare.

🔍 Detalii eroare:
- Categorie: ${data.category}
- Mesaj: ${data.message}
- Factură ID: ${data.facturaId || 'N/A'}
- Timp: ${new Date(data.timestamp).toLocaleString('ro-RO')}

📋 Context:
${data.stackTrace ? `Stack Trace: ${data.stackTrace.split('\n')[0]}` : 'Nu există stack trace'}

⚡ Acțiune imediată necesară:
${data.requiresManualIntervention ? '- Intervenție manuală necesară' : '- Sistem va încerca retry automat'}

🔧 Pași următori:
1. Verifică logs în ${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/monitoring
2. Investighează cauza principală
3. Aplică fix dacă este posibil
4. Monitorizează pentru recurență

ID Eroare: ${data.errorId}
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildManualInterventionNotification(data: any): Promise<NotificationContext> {
  return {
    type: NotificationType.MANUAL_INTERVENTION,
    severity: 'warning',
    title: `🔧 Intervenție manuală necesară: ${data.errorCount} erori`,
    message: `
Sistemul a detectat erori care necesită intervenție manuală.

📊 Sumar:
- Erori care necesită atenție: ${data.errorCount}
- Facturi afectate: ${data.affectedInvoices}
- Perioada: ultimele ${data.timeRange}

🎯 Tipuri de probleme:
${data.errorsByType?.map((error: any) => `- ${error.category}: ${error.count} cazuri`).join('\n') || 'Detalii indisponibile'}

📝 Acțiuni recomandate:
1. Revizia fiecare caz individual
2. Corectare date factură (dacă aplicabil)
3. Retestare trimitere la ANAF
4. Documentare soluții pentru viitor

🔗 Vezi toate cazurile: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/rapoarte/facturi?requiresIntervention=true

⏰ SLA: Te rugăm să rezolvi în maxim 4 ore lucrătoare.
    `,
    data,
    timestamp: new Date().toISOString()
  };
}

async function buildDailySummaryNotification(): Promise<NotificationContext> {
  // Calculează statistici pentru ultimele 24h
  const stats = await getDailyStatistics();
  
  return {
    type: NotificationType.DAILY_SUMMARY,
    severity: 'info',
    title: `📊 Raport zilnic ANAF e-Factura - ${new Date().toLocaleDateString('ro-RO')}`,
    message: `
Rezumatul activității ANAF e-Factura pentru ultimele 24 de ore.

📈 Statistici generale:
- Facturi procesate: ${stats.totalInvoices}
- Facturi cu succes: ${stats.successfulInvoices} (${stats.successRate?.toFixed(1)}%)
- Facturi cu erori: ${stats.failedInvoices}
- Rate de succes: ${stats.successRate > 90 ? '✅ Foarte bună' : stats.successRate > 80 ? '⚠️ Acceptabilă' : '🔴 Problematică'}

🔧 OAuth Status:
- Token valid: ${stats.tokenValid ? '✅ Da' : '❌ Nu'}
- Expiră în: ${stats.tokenExpiresInDays} zile

⚠️ Probleme identificate:
${stats.topErrors?.length > 0 ? 
  stats.topErrors.map((err: any) => `- ${err.category}: ${err.count} cazuri`).join('\n') :
  '✅ Nu au fost detectate probleme majore'
}

🎯 Recomandări:
${stats.recommendations?.join('\n- ') || '- Sistemul funcționează normal'}

📊 Dashboard complet: ${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/monitoring
    `,
    data: stats,
    timestamp: new Date().toISOString()
  };
}

// ==================================================================
// Monitoring Functions
// ==================================================================

async function performHealthCheck() {
  const checks = {
    tokenStatus: await checkTokenHealth(),
    errorRates: await getErrorRateStatus(),
    connectionStatus: await checkANAFConnection(),
    recentErrors: await getRecentCriticalErrors()
  };

  const overallHealth = 
    checks.tokenStatus.healthy && 
    checks.errorRates.healthy && 
    checks.connectionStatus.healthy &&
    checks.recentErrors.count < 5;

  return NextResponse.json({
    success: true,
    healthy: overallHealth,
    checks,
    timestamp: new Date().toISOString()
  });
}

async function checkTokenExpiry() {
  try {
    const query = `
      SELECT 
        id,
        expires_at,
        TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), MINUTE) as expires_in_minutes
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafTokens\`
      WHERE is_active = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active token found'
      });
    }

    const token = rows[0];
    const expiresInMinutes = parseInt(token.expires_in_minutes);
    const expiresInDays = Math.floor(expiresInMinutes / (60 * 24));

    // Trimite notificare dacă expiră în 7 zile
    if (expiresInDays <= 7 && expiresInDays > 0) {
      await sendNotification(await buildTokenExpiryNotification({
        expiresAt: token.expires_at,
        expiresInMinutes,
        tokenId: token.id
      }));
    }

    return NextResponse.json({
      success: true,
      tokenExpiry: {
        expiresInDays,
        expiresInMinutes,
        shouldNotify: expiresInDays <= 7
      }
    });

  } catch (error) {
    console.error('Error checking token expiry:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check token expiry'
    }, { status: 500 });
  }
}

async function checkErrorRates() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_invoices,
        COUNTIF(efactura_status IN ('error', 'anaf_error')) as failed_invoices,
        SAFE_DIVIDE(COUNTIF(efactura_status IN ('error', 'anaf_error')), COUNT(*)) * 100 as failure_rate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true 
        AND data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });
    
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        errorRate: 0,
        totalInvoices: 0
      });
    }

    const stats = rows[0];
    const failureRate = parseFloat(stats.failure_rate) || 0;

    // Trimite notificare dacă rata > 10%
    if (failureRate > 10) {
      await sendNotification(await buildHighFailureRateNotification({
        failureRate,
        totalInvoices: parseInt(stats.total_invoices),
        failedInvoices: parseInt(stats.failed_invoices),
        timeRange: '24h'
      }));
    }

    return NextResponse.json({
      success: true,
      errorRate: {
        failureRate,
        totalInvoices: parseInt(stats.total_invoices),
        failedInvoices: parseInt(stats.failed_invoices),
        shouldNotify: failureRate > 10
      }
    });

  } catch (error) {
    console.error('Error checking error rates:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check error rates'
    }, { status: 500 });
  }
}

async function testEmailConfiguration() {
  try {
    const transporter = getEmailTransporter();
    
    // Test configurația
    await transporter.verify();

    // Trimite email de test
    const testResult = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER, // trimite către noi înșine
      subject: '🧪 Test ANAF Notifications System',
      html: `
        <h2>✅ Sistemul de notificări ANAF funcționează!</h2>
        <p>Acest email confirmă că configurația SMTP este corectă.</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString('ro-RO')}</p>
        <p><strong>Sistem:</strong> UNITAR PROIECT - ANAF e-Factura</p>
      `
    });

    return NextResponse.json({
      success: true,
      testEmailSent: true,
      messageId: testResult.messageId
    });

  } catch (error) {
    console.error('Email configuration test failed:', error);
    return NextResponse.json({
      success: false,
      testEmailSent: false,
      error: error instanceof Error ? error.message : 'SMTP test failed'
    }, { status: 500 });
  }
}

// ==================================================================
// Email Sending Functions
// ==================================================================

async function sendNotification(context: NotificationContext) {
  try {
    const transporter = getEmailTransporter();
    
    const recipients = context.recipients || 
      process.env.NOTIFICATION_RECIPIENTS?.split(',') || 
      [process.env.SMTP_USER];

    const priorityMap = {
      'info': 'Low',
      'warning': 'Normal', 
      'error': 'High',
      'critical': 'Urgent'
    };

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      subject: `[ANAF ${context.severity.toUpperCase()}] ${context.title}`,
      html: generateEmailHTML(context),
      text: context.message,
      priority: priorityMap[context.severity] as any,
      headers: {
        'X-Priority': context.severity === 'critical' ? '1' : '3',
        'X-MSMail-Priority': context.severity === 'critical' ? 'High' : 'Normal'
      }
    });

    return {
      success: true,
      messageId: result.messageId,
      recipients: recipients.length
    };

  } catch (error) {
    console.error('❌ Failed to send notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email sending failed'
    };
  }
}

function generateEmailHTML(context: NotificationContext): string {
  const severityColor = {
    'info': '#2196F3',
    'warning': '#FF9800', 
    'error': '#F44336',
    'critical': '#D32F2F'
  };

  const severityEmoji = {
    'info': 'ℹ️',
    'warning': '⚠️',
    'error': '❌', 
    'critical': '🚨'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${context.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${severityColor[context.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">
                ${severityEmoji[context.severity]} ${context.title}
            </h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">
                UNITAR PROIECT - Sistem e-Factura ANAF
            </p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd;">
            <div style="background: white; padding: 20px; border-radius: 4px;">
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${context.message}</pre>
            </div>
        </div>
        
        <div style="background: #f0f0f0; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;">
            <p style="margin: 0;">
                <strong>Timestamp:</strong> ${new Date(context.timestamp).toLocaleString('ro-RO')}<br>
                <strong>Tip notificare:</strong> ${context.type}<br>
                <strong>Severity:</strong> ${context.severity.toUpperCase()}
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
            <p>Acest email a fost generat automat de sistemul UNITAR PROIECT.</p>
            <p>Pentru support tehnic: <a href="mailto:contact@unitarproiect.eu">contact@unitarproiect.eu</a></p>
        </div>
    </body>
    </html>
  `;
}

// ==================================================================
// Database & Statistics Functions
// ==================================================================

async function logNotificationToDatabase(context: NotificationContext, success: boolean) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('AnafNotificationLog');

    const record = [{
      id: crypto.randomUUID(),
      type: context.type,
      severity: context.severity,
      title: context.title,
      message: context.message,
      recipients: context.recipients?.join(',') || process.env.NOTIFICATION_RECIPIENTS,
      success: success,
      data: context.data ? JSON.stringify(context.data) : null,
      timestamp: context.timestamp,
      data_creare: new Date().toISOString()
    }];

    await table.insert(record);

  } catch (error) {
    console.error('❌ Failed to log notification:', error);
  }
}

async function getDailyStatistics() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_invoices,
        COUNTIF(efactura_status = 'validated') as successful_invoices,
        COUNTIF(efactura_status IN ('error', 'anaf_error')) as failed_invoices,
        SAFE_DIVIDE(COUNTIF(efactura_status = 'validated'), COUNT(*)) * 100 as success_rate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE efactura_enabled = true 
        AND data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });
    
    const stats = rows[0] || {
      total_invoices: 0,
      successful_invoices: 0,
      failed_invoices: 0,
      success_rate: 0
    };

    return {
      totalInvoices: parseInt(stats.total_invoices),
      successfulInvoices: parseInt(stats.successful_invoices),
      failedInvoices: parseInt(stats.failed_invoices),
      successRate: parseFloat(stats.success_rate) || 0,
      tokenValid: true, // TODO: check actual token status
      tokenExpiresInDays: 30, // TODO: calculate from actual token
      topErrors: [], // TODO: get from error log
      recommendations: []
    };

  } catch (error) {
    console.error('Error getting daily statistics:', error);
    return {
      totalInvoices: 0,
      successfulInvoices: 0,
      failedInvoices: 0,
      successRate: 0,
      tokenValid: false,
      tokenExpiresInDays: 0,
      topErrors: [],
      recommendations: ['Eroare la calcularea statisticilor']
    };
  }
}

// Helper functions for health checks
async function checkTokenHealth() {
  // TODO: Implement actual token health check
  return { healthy: true, message: 'Token is valid' };
}

async function getErrorRateStatus() {
  // TODO: Implement error rate checking
  return { healthy: true, rate: 5.2 };
}

async function checkANAFConnection() {
  // TODO: Implement ANAF connection check
  return { healthy: true, message: 'Connection is stable' };
}

async function getRecentCriticalErrors() {
  // TODO: Get recent critical errors count
  return { count: 0 };
}
