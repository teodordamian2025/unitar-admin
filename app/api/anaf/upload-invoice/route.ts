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

// ✅ ANAF API Endpoints
const ANAF_API_BASE = 'https://api.anaf.ro/prod/FCTEL/rest';
const ANAF_UPLOAD_ENDPOINT = `${ANAF_API_BASE}/upload`;
const ANAF_DOWNLOAD_ENDPOINT = `${ANAF_API_BASE}/descarcare`;

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

    // 6. Trimite notificare admin dacă max retries depășit
    if (uploadResult.attemptNumber && uploadResult.attemptNumber >= 3 && !uploadResult.success) {
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

    // Decrypt access token
    const accessToken = decryptToken(token.access_token);

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
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY || 'default-key-change-this';
    const algorithm = 'aes-256-cbc';

    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      return encryptedToken; // Already decrypted
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    console.error('Error decrypting token:', error);
    return encryptedToken;
  }
}

async function uploadToANAF(
  xmlContent: string,
  accessToken: string,
  facturaId: string,
  attemptNumber: number
): Promise<UploadResult> {
  try {
    console.log(`🚀 Attempting upload to ANAF (attempt ${attemptNumber + 1}/3)...`);

    // Create form data pentru upload
    const formData = new FormData();
    const xmlBlob = new Blob([xmlContent], { type: 'text/xml' });
    formData.append('file', xmlBlob, 'factura.xml');
    formData.append('cif', process.env.UNITAR_CUI || '35639210');
    formData.append('standard', 'UBL'); // Standard UBL 2.1

    const response = await fetch(ANAF_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // Nu setăm Content-Type pentru FormData - browser-ul îl setează automat cu boundary
      },
      body: formData
    });

    const responseData = await response.json();

    console.log(`📥 ANAF Response (status ${response.status}):`, responseData);

    // Success case
    if (response.ok && responseData.upload_index) {
      return {
        success: true,
        facturaId,
        anafUploadId: responseData.upload_index,
        status: 'anaf_processing',
        message: 'Factura uploaded successfully to ANAF',
        attemptNumber: attemptNumber + 1
      };
    }

    // Error cases
    const errorCategory = categorizeANAFError(response.status, responseData);
    const retryAfter = getRetryInterval(attemptNumber, errorCategory);

    return {
      success: false,
      facturaId,
      status: 'anaf_error',
      message: responseData.message || responseData.error || 'ANAF upload failed',
      errorCategory,
      retryAfter,
      attemptNumber: attemptNumber + 1
    };

  } catch (error) {
    console.error('❌ ANAF upload exception:', error);

    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const errorCategory = errorMessage.includes('timeout') ? 'anaf_timeout' : 'anaf_connection';

    return {
      success: false,
      facturaId,
      status: 'error',
      message: errorMessage,
      errorCategory,
      retryAfter: getRetryInterval(attemptNumber, errorCategory),
      attemptNumber: attemptNumber + 1
    };
  }
}

function categorizeANAFError(statusCode: number, responseData: any): string {
  if (statusCode === 401 || statusCode === 403) {
    return 'oauth_expired';
  }
  if (statusCode === 408 || statusCode === 504) {
    return 'anaf_timeout';
  }
  if (statusCode >= 500) {
    return 'anaf_server_error';
  }
  if (statusCode === 400) {
    if (responseData.message?.includes('XML')) {
      return 'xml_validation';
    }
    return 'anaf_business_error';
  }
  return 'unknown_error';
}

function getRetryInterval(attemptNumber: number, errorCategory: string): number {
  // Retry intervals based on error category (în minute)
  const retryStrategies: Record<string, number[]> = {
    'oauth_expired': [1, 5, 15],
    'anaf_connection': [5, 15, 60],
    'anaf_timeout': [5, 15, 60],
    'anaf_server_error': [60, 240, 1440], // 1h, 4h, 24h
    'xml_validation': [0, 0, 0], // Nu retry pentru validare XML
    'anaf_business_error': [0, 0, 0], // Nu retry pentru erori business
    'unknown_error': [10, 30, 60]
  };

  const strategy = retryStrategies[errorCategory] || [10, 30, 60];
  return strategy[Math.min(attemptNumber, strategy.length - 1)];
}

async function updateFacturaStatus(facturaId: string, uploadResult: UploadResult) {
  try {
    const dataset = bigquery.dataset(DATASET);

    // Update AnafEFactura
    const updateEfacturaQuery = `
      UPDATE ${TABLE_ANAF_EFACTURA}
      SET
        anaf_status = @anafStatus,
        anaf_upload_id = @anafUploadId,
        retry_count = @retryCount,
        error_message = @errorMessage,
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
        facturaId
      },
      types: {
        anafUploadId: 'STRING',
        errorMessage: 'STRING'
      },
      location: 'EU'
    });

    // Update FacturiGenerate (doar dacă nu e în streaming buffer - >= 90s după creare)
    // Pentru siguranță, nu facem UPDATE aici - va fi făcut de cron job după 2 minute
    console.log(`✅ Updated AnafEFactura status for ${facturaId}`);

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
