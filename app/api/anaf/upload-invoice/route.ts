// ==================================================================
// CALEA: app/api/anaf/upload-invoice/route.ts
// DESCRIERE: API pentru trimiterea efectivă a facturilor la ANAF e-Factura
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_ANAF_TOKENS = `\`${PROJECT_ID}.${DATASET}.AnafTokens${tableSuffix}\``;
const TABLE_ANAF_ERROR_LOG = `AnafErrorLog${tableSuffix}`;

console.log(`🔧 ANAF Upload Invoice API - Tables Mode: ${useV2Tables ? 'V2 (Optimized)' : 'V1 (Standard)'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ ANAF API Endpoints (sandbox sau production)
const isSandbox = process.env.ANAF_SANDBOX_MODE === 'true';
const ANAF_API_BASE = isSandbox
  ? 'https://api.anaf.ro/test/FCTEL/rest'
  : 'https://api.anaf.ro/prod/FCTEL/rest';
const ANAF_UPLOAD_ENDPOINT = `${ANAF_API_BASE}/upload`;
const ANAF_DOWNLOAD_ENDPOINT = `${ANAF_API_BASE}/descarcare`;

console.log(`🔧 ANAF Upload Invoice API - Mode: ${isSandbox ? 'SANDBOX (test)' : 'PRODUCTION'}, Tables: ${useV2Tables ? 'V2' : 'V1'}`);

// ✅ Interfaces
interface UploadResult {
  success: boolean;
  facturaId: string;
  anafUploadId?: string;
  status: 'validated' | 'anaf_processing' | 'anaf_error' | 'error';
  message: string;
  errorCategory?: string;
  retryAfter?: number; // minutes
  attemptNumber?: number;
  shouldRetry?: boolean; // NEW: TRUE dacă trebuie continuat retry
  nextRetryAt?: Date | null; // NEW: Timestamp când trebuie făcut următorul retry
}

// ==================================================================
// POST: Upload factura la ANAF
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { facturaId, isManualRetry = false } = await request.json();

    if (!facturaId) {
      return NextResponse.json({
        success: false,
        error: 'Factura ID is required'
      }, { status: 400 });
    }

    console.log(`📤 Starting ANAF upload for factura: ${facturaId} ${isManualRetry ? '(MANUAL RETRY)' : '(AUTO)'}`);

    // 1. Get factura data and XML
    const facturaData = await getFacturaWithXml(facturaId);

    if (!facturaData.success) {
      return NextResponse.json({
        success: false,
        error: facturaData.error
      }, { status: 404 });
    }

    // 2. Check OAuth token
    const tokenData = await getValidOAuthToken();

    if (!tokenData.success || !tokenData.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'OAuth token invalid or expired',
        errorCategory: 'oauth_expired',
        retryAfter: 5 // retry în 5 minute
      }, { status: 401 });
    }

    // 3. Upload la ANAF
    const uploadResult = await uploadToANAF(
      facturaData.xml,
      tokenData.accessToken,
      facturaId,
      facturaData.attemptNumber || 0
    );

    // 4. Update status în BigQuery
    await updateFacturaStatus(facturaId, uploadResult);

    // 5. Log în error handler dacă a eșuat
    if (!uploadResult.success && uploadResult.errorCategory) {
      await logErrorToHandler({
        facturaId,
        error: uploadResult.message,
        category: uploadResult.errorCategory,
        anafResponse: uploadResult
      });
    }

    // 6. Trimite notificare admin dacă max retries depășit (shouldRetry = FALSE)
    if (!uploadResult.success && uploadResult.shouldRetry === false) {
      await sendMaxRetriesNotification(facturaId, uploadResult);
    }

    return NextResponse.json({
      success: uploadResult.success,
      facturaId: uploadResult.facturaId,
      status: uploadResult.status,
      message: uploadResult.message,
      anafUploadId: uploadResult.anafUploadId,
      retryAfter: uploadResult.retryAfter,
      attemptNumber: uploadResult.attemptNumber
    });

  } catch (error) {
    console.error('❌ Error in upload-invoice API:', error);
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// Helper Functions
// ==================================================================

async function getFacturaWithXml(facturaId: string) {
  try {
    const query = `
      SELECT
        ae.id as xml_id,
        ae.xml_content,
        ae.retry_count,
        fg.numar as factura_numar,
        fg.serie as factura_serie,
        fg.efactura_status
      FROM ${TABLE_ANAF_EFACTURA} ae
      JOIN ${TABLE_FACTURI_GENERATE} fg ON ae.factura_id = fg.id
      WHERE ae.factura_id = @facturaId
        AND ae.anaf_status IN ('draft', 'error')
      ORDER BY ae.data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { facturaId },
      location: 'EU'
    });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Factura not found or already uploaded'
      };
    }

    const row = rows[0];

    return {
      success: true,
      xml: row.xml_content,
      xmlId: row.xml_id,
      facturaNumar: row.factura_numar,
      facturaSerie: row.factura_serie,
      attemptNumber: parseInt(row.retry_count) || 0,
      currentStatus: row.efactura_status
    };

  } catch (error) {
    console.error('Error fetching factura:', error);
    return {
      success: false,
      error: 'Database error fetching factura'
    };
  }
}

async function getValidOAuthToken() {
  try {
    const query = `
      SELECT access_token, expires_at
      FROM ${TABLE_ANAF_TOKENS}
      WHERE is_active = true
        AND expires_at > CURRENT_TIMESTAMP()
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'No valid OAuth token found'
      };
    }

    const token = rows[0];

    console.log(`🔐 Encrypted token preview: ${token.access_token.substring(0, 50)}...`);

    // Decrypt access token
    const accessToken = decryptToken(token.access_token);

    console.log(`✅ Decrypted token preview: ${accessToken.substring(0, 50)}...`);
    console.log(`🔍 Token format check: ${accessToken.startsWith('eyJ') ? '✅ JWT format correct' : '❌ NOT JWT format!'}`);

    return {
      success: true,
      accessToken,
      expiresAt: token.expires_at
    };

  } catch (error) {
    console.error('Error fetching OAuth token:', error);
    return {
      success: false,
      error: 'Failed to retrieve OAuth token'
    };
  }
}

function decryptToken(encryptedToken: string): string {
  try {
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('Invalid encryption key - must be 64 hex characters');
    }

    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format - missing IV separator');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Error decrypting ANAF token:', error);
    throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function uploadToANAF(
  xmlContent: string,
  accessToken: string, // OAuth JWT token din BigQuery
  facturaId: string,
  attemptNumber: number
): Promise<UploadResult> {
  try {
    console.log(`🚀 Uploading directly to ANAF with OAuth token (attempt ${attemptNumber + 1})...`);

    // Verifică că avem OAuth token
    if (!accessToken) {
      throw new Error('OAuth access token is required');
    }

    // Creează FormData cu XML NESEMNAT (conform documentație ANAF OAuth 2.0)
    // Folosim form-data (Node.js) pentru compatibility cu API routes
    const FormDataNode = (await import('form-data')).default;
    const formData = new FormDataNode();

    formData.append('file', Buffer.from(xmlContent, 'utf8'), {
      filename: 'factura.xml',
      contentType: 'text/xml'
    });
    formData.append('cif', process.env.UNITAR_CUI || '35639210');
    formData.append('standard', 'UBL');

    console.log(`📤 Sending to ${ANAF_UPLOAD_ENDPOINT} with Authorization: Bearer ${accessToken.substring(0, 20)}...`);

    // Trimite DIRECT la ANAF cu OAuth token în header
    // form-data returnează un Stream care e compatibil cu fetch
    const response = await fetch(ANAF_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${accessToken}` // ⭐ CHEIA SUCCESULUI - conform doc ANAF
      },
      // @ts-expect-error - form-data Stream e compatibil cu fetch body la runtime
      body: formData,
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📥 ANAF Response (status ${response.status}):`, responseData);

    // Success case
    if (response.ok && responseData.upload_index) {
      return {
        success: true,
        facturaId,
        anafUploadId: responseData.upload_index,
        status: 'anaf_processing',
        message: 'Factura uploaded successfully to ANAF',
        attemptNumber: attemptNumber + 1,
        shouldRetry: false, // Success → STOP retry
        nextRetryAt: null
      };
    }

    // Error cases
    const errorCategory = categorizeANAFError(response.status, responseData);
    const newAttemptNumber = attemptNumber + 1;
    const retryAfter = getRetryInterval(newAttemptNumber, errorCategory);
    const shouldRetry = !shouldStopRetrying(newAttemptNumber, errorCategory, false);
    const nextRetryAt = shouldRetry ? calculateNextRetryAt(newAttemptNumber, errorCategory) : null;

    return {
      success: false,
      facturaId,
      status: 'anaf_error',
      message: responseData.message || responseData.error || `ANAF upload failed (HTTP ${response.status})`,
      errorCategory,
      retryAfter,
      attemptNumber: newAttemptNumber,
      shouldRetry,
      nextRetryAt
    };

  } catch (error) {
    console.error('❌ ANAF upload exception:', error);

    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const errorCategory = errorMessage.includes('timeout') ? 'anaf_timeout' : 'anaf_connection';
    const newAttemptNumber = attemptNumber + 1;
    const retryAfter = getRetryInterval(newAttemptNumber, errorCategory);
    const shouldRetry = !shouldStopRetrying(newAttemptNumber, errorCategory, false);
    const nextRetryAt = shouldRetry ? calculateNextRetryAt(newAttemptNumber, errorCategory) : null;

    return {
      success: false,
      facturaId,
      status: 'error',
      message: errorMessage,
      errorCategory,
      retryAfter,
      attemptNumber: newAttemptNumber,
      shouldRetry,
      nextRetryAt
    };
  }
}

function categorizeANAFError(statusCode: number, responseData: any): string {
  // Erori autentificare OAuth
  if (statusCode === 401 || statusCode === 403) {
    return 'oauth_expired'; // Token JWT expirat sau invalid
  }

  // Erori timeout
  if (statusCode === 408 || statusCode === 504) {
    return 'anaf_timeout';
  }

  // Erori server ANAF
  if (statusCode >= 500) {
    return 'anaf_server_error';
  }

  // Erori validare XML sau business
  if (statusCode === 400) {
    if (responseData.message?.includes('XML') || responseData.error?.includes('XML')) {
      return 'xml_validation';
    }
    return 'anaf_business_error';
  }

  return 'unknown_error';
}

// ✅ Strategii exponential backoff pentru retry (în minute)
function getRetryStrategy(errorCategory: string): number[] {
  const retryStrategies: Record<string, number[]> = {
    // Erori OAuth - STOP imediat (necesită re-autorizare)
    'oauth_expired': [], // Token JWT expirat - admin trebuie să re-autorizeze

    // Erori ANAF temporare - retry cu exponential backoff
    'anaf_connection': [0, 5, 10, 20, 40, 120], // Exponențial - 6 încercări
    'anaf_timeout': [0, 5, 10, 20, 40, 120], // Exponențial - 6 încercări
    'anaf_server_error': [0, 60, 240, 1440], // Lent (1h, 4h, 24h) - 4 încercări

    // Erori permanente - STOP imediat
    'xml_validation': [], // XML invalid - necesită corectare manuală
    'anaf_business_error': [], // Eroare business ANAF - necesită verificare

    // Erori necunoscute - retry moderat
    'unknown_error': [0, 10, 30, 60, 120] // Medium - 5 încercări
  };

  return retryStrategies[errorCategory] || [0, 10, 30, 60];
}

function getRetryInterval(attemptNumber: number, errorCategory: string): number {
  const strategy = getRetryStrategy(errorCategory);
  return strategy[Math.min(attemptNumber, strategy.length - 1)] || 0;
}

// ✅ NEW: Determină dacă trebuie continuat retry sau stop
function shouldStopRetrying(attemptNumber: number, errorCategory: string, success: boolean): boolean {
  // 1. Succes → STOP
  if (success) return true;

  // 2. Erori permanente → STOP imediat
  const permanentErrors = ['oauth_expired', 'xml_validation', 'anaf_business_error'];
  if (permanentErrors.includes(errorCategory)) return true;

  // 3. Max retries pentru categoria respectivă → STOP
  const strategy = getRetryStrategy(errorCategory);
  if (attemptNumber >= strategy.length) return true;

  // 4. Continuă retry pentru erori temporare
  return false;
}

// ✅ NEW: Calculează next_retry_at timestamp
function calculateNextRetryAt(attemptNumber: number, errorCategory: string): Date | null {
  const strategy = getRetryStrategy(errorCategory);

  // Dacă am depășit numărul de încercări disponibile → NULL
  if (attemptNumber >= strategy.length) {
    return null;
  }

  const minutes = strategy[attemptNumber];
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function updateFacturaStatus(facturaId: string, uploadResult: UploadResult) {
  try {
    const dataset = bigquery.dataset(DATASET);

    // Update AnafEFactura cu noile coloane: should_retry, next_retry_at, error_category
    const updateEfacturaQuery = `
      UPDATE ${TABLE_ANAF_EFACTURA}
      SET
        anaf_status = @anafStatus,
        anaf_upload_id = @anafUploadId,
        retry_count = @retryCount,
        error_message = @errorMessage,
        error_category = @errorCategory,
        should_retry = @shouldRetry,
        next_retry_at = @nextRetryAt,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE factura_id = @facturaId
        AND anaf_status IN ('draft', 'error')
    `;

    await bigquery.query({
      query: updateEfacturaQuery,
      params: {
        anafStatus: uploadResult.success ? 'processing' : 'error',
        anafUploadId: uploadResult.anafUploadId || null,
        retryCount: uploadResult.attemptNumber || 1,
        errorMessage: uploadResult.success ? null : uploadResult.message,
        errorCategory: uploadResult.errorCategory || null,
        shouldRetry: uploadResult.shouldRetry !== undefined ? uploadResult.shouldRetry : true,
        nextRetryAt: uploadResult.nextRetryAt || null,
        facturaId
      },
      types: {
        anafUploadId: 'STRING',
        errorMessage: 'STRING',
        errorCategory: 'STRING',
        nextRetryAt: 'TIMESTAMP'
      },
      location: 'EU'
    });

    console.log(`✅ Updated AnafEFactura status for ${facturaId} - shouldRetry: ${uploadResult.shouldRetry}, nextRetryAt: ${uploadResult.nextRetryAt?.toISOString() || 'NULL'}`);

    // Update FacturiGenerate (doar dacă nu e în streaming buffer - >= 90s după creare)
    // Pentru siguranță, nu facem UPDATE aici - va fi făcut de cron job după 2 minute

  } catch (error) {
    console.error('❌ Error updating factura status:', error);
    // Nu throw error - upload-ul a reușit, doar update-ul local a eșuat
  }
}

async function logErrorToHandler(errorData: any) {
  try {
    // Call error-handler API pentru logging
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anaf/error-handler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: errorData.error },
        facturaId: errorData.facturaId,
        anafResponse: errorData.anafResponse,
        additionalContext: {
          source: 'upload-invoice-api',
          category: errorData.category
        }
      })
    });
  } catch (error) {
    console.error('Failed to log error to handler:', error);
  }
}

async function sendMaxRetriesNotification(facturaId: string, uploadResult: UploadResult) {
  try {
    console.log(`📧 Sending max retries notification for factura ${facturaId}`);

    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anaf/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'manual_intervention',
        data: {
          errorCount: 1,
          affectedInvoices: 1,
          timeRange: '24h',
          errorsByType: [{
            category: uploadResult.errorCategory || 'unknown',
            count: uploadResult.attemptNumber
          }]
        },
        forceNotification: true
      })
    });
  } catch (error) {
    console.error('Failed to send max retries notification:', error);
  }
}
