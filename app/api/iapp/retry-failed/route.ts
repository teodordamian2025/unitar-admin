// ==================================================================
// CALEA: app/api/iapp/retry-failed/route.ts
// DESCRIERE: Procesează facturile iapp.ro eșuate și le retrimite
//            Chemat de GitHub Actions (on-demand dispatch)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const MAX_RETRIES = 3;

// Intervale de retry (în secunde): 60s, 120s, 300s
const RETRY_INTERVALS = [60, 120, 300];

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Funcții de criptare/decriptare (reutilizate din emit-invoice)
function decryptValue(encryptedValue: string): string {
  const key = process.env.IAPP_ENCRYPTION_KEY || process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const parts = encryptedValue.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

// ==================================================================
// POST: Procesează retry-uri pentru o factură specifică (on-demand)
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [iapp-retry] ========== START RETRY PROCESSING ==========');

    // Verifică autorizare
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [iapp-retry] Unauthorized request');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { factura_id } = body;

    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing factura_id'
      }, { status: 400 });
    }

    console.log('🔄 [iapp-retry] Processing factura_id:', factura_id);

    // Găsește ultima încercare eșuată pentru această factură
    const failedQuery = `
      SELECT * FROM \`${PROJECT_ID}.${DATASET}.IappFacturiEmise_v2\`
      WHERE factura_id = @factura_id
        AND status = 'error'
      ORDER BY data_transmitere DESC
      LIMIT 1
    `;

    const [failedRows] = await bigquery.query({
      query: failedQuery,
      params: { factura_id },
      location: 'EU'
    });

    if (failedRows.length === 0) {
      console.log('✅ [iapp-retry] No failed invoice found (may have succeeded)');
      return NextResponse.json({
        success: true,
        message: 'No failed invoice found for retry',
        factura_id
      });
    }

    const failedRecord = failedRows[0];
    const currentRetryCount = failedRecord.retry_count || 1;

    // Verifică dacă am depășit numărul maxim de retry-uri
    if (currentRetryCount >= MAX_RETRIES) {
      console.log(`⚠️ [iapp-retry] Max retries (${MAX_RETRIES}) reached for factura ${factura_id}`);

      // Trimite notificare admin
      await sendAdminNotification(factura_id, failedRecord);

      return NextResponse.json({
        success: false,
        message: `Max retries (${MAX_RETRIES}) reached`,
        factura_id,
        retry_count: currentRetryCount
      });
    }

    // Reîncearcă trimiterea
    console.log(`🔄 [iapp-retry] Attempt ${currentRetryCount + 1}/${MAX_RETRIES} for factura ${factura_id}`);

    const retryResult = await retryInvoiceEmission(factura_id, failedRecord, currentRetryCount);

    if (retryResult.success) {
      console.log('✅ [iapp-retry] Retry successful!');
      return NextResponse.json({
        success: true,
        message: 'Retry successful',
        factura_id,
        retry_count: currentRetryCount + 1,
        iapp_id_factura: retryResult.iapp_id_factura
      });
    } else {
      // Calculează următorul interval de retry
      const nextRetryCount = currentRetryCount + 1;
      const nextInterval = RETRY_INTERVALS[Math.min(nextRetryCount - 1, RETRY_INTERVALS.length - 1)];
      const nextRetryAt = new Date(Date.now() + nextInterval * 1000);

      // Update înregistrarea cu noul retry_count și next_retry_at
      await updateRetryInfo(failedRecord.id, nextRetryCount, nextRetryAt, retryResult.error);

      // Dacă nu am atins limita, declanșăm următorul retry
      if (nextRetryCount < MAX_RETRIES) {
        console.log(`⏳ [iapp-retry] Scheduling next retry in ${nextInterval}s`);
        await triggerNextRetry(factura_id, nextInterval * 1000);
      } else {
        // Am atins limita - trimite notificare admin
        console.log(`❌ [iapp-retry] All retries exhausted for factura ${factura_id}`);
        await sendAdminNotification(factura_id, { ...failedRecord, retry_count: nextRetryCount });
      }

      return NextResponse.json({
        success: false,
        message: 'Retry failed',
        factura_id,
        retry_count: nextRetryCount,
        next_retry_at: nextRetryCount < MAX_RETRIES ? nextRetryAt.toISOString() : null,
        error: retryResult.error
      });
    }

  } catch (error) {
    console.error('❌ [iapp-retry] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process retry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// GET: Verifică status retry-uri pentru o factură
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    // Verifică autorizare
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const factura_id = searchParams.get('factura_id');

    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing factura_id parameter'
      }, { status: 400 });
    }

    const query = `
      SELECT id, factura_id, status, retry_count, next_retry_at,
             efactura_mesaj_eroare, data_transmitere
      FROM \`${PROJECT_ID}.${DATASET}.IappFacturiEmise_v2\`
      WHERE factura_id = @factura_id
      ORDER BY data_transmitere DESC
      LIMIT 5
    `;

    const [rows] = await bigquery.query({
      query,
      params: { factura_id },
      location: 'EU'
    });

    return NextResponse.json({
      success: true,
      factura_id,
      attempts: rows,
      total_attempts: rows.length
    });

  } catch (error) {
    console.error('❌ [iapp-retry] Error getting retry status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get retry status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// HELPER: Reîncearcă trimiterea facturii la iapp.ro
// ==================================================================
async function retryInvoiceEmission(
  factura_id: string,
  failedRecord: any,
  currentRetryCount: number
): Promise<{ success: boolean; iapp_id_factura?: string; error?: string }> {
  try {
    // Reconstituie payload-ul din request_json salvat
    let originalPayload: any;
    try {
      originalPayload = typeof failedRecord.request_json === 'string'
        ? JSON.parse(failedRecord.request_json)
        : failedRecord.request_json;
    } catch {
      console.error('❌ [iapp-retry] Failed to parse original request_json');
      return { success: false, error: 'Failed to parse original request' };
    }

    // Citește configurarea iapp.ro
    const configQuery = `
      SELECT cod_firma, parola_api, email_responsabil
      FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      WHERE activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery, location: 'EU' });

    if (configRows.length === 0) {
      return { success: false, error: 'iapp.ro configuration not found' };
    }

    const config = configRows[0];
    const codFirma = decryptValue(config.cod_firma);
    const parolaApi = decryptValue(config.parola_api);

    // Determină API endpoint (v1 sau v2)
    const isPersoanaFizica = originalPayload.client?.cnp || originalPayload.client?.tip === 'pf';
    const apiUrl = isPersoanaFizica
      ? 'https://api.my.iapp.ro/emite/factura'
      : 'https://api.my.iapp.ro/emite/factura-v2';

    const authHeader = Buffer.from(`${codFirma}:${parolaApi}`).toString('base64');

    console.log(`📡 [iapp-retry] Retrying to ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(originalPayload)
    });

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📥 [iapp-retry] Response status: ${response.status}`);
    console.log(`📥 [iapp-retry] Response:`, JSON.stringify(responseData, null, 2));

    // Salvează încercarea în log
    const now = new Date().toISOString();
    const retryHistoryEntry = {
      attempt: currentRetryCount + 1,
      timestamp: now,
      status: response.ok ? 'success' : 'error',
      response_status: response.status,
      error_message: responseData.error || responseData.message || null
    };

    const logRecord = [{
      id: crypto.randomUUID(),
      factura_id,
      iapp_id_factura: responseData.id_factura || null,
      iapp_serie: responseData.serie || failedRecord.iapp_serie,
      iapp_numar: responseData.numar || null,
      tip_factura: failedRecord.tip_factura,
      client_cif: failedRecord.client_cif,
      client_nume: failedRecord.client_nume,
      valoare_totala: failedRecord.valoare_totala,
      moneda: failedRecord.moneda,
      status: response.ok ? 'trimisa' : 'error',
      efactura_upload_index: responseData.efactura_upload_index || null,
      efactura_status: responseData.efactura_status || null,
      efactura_mesaj_eroare: responseData.error || responseData.message || null,
      request_json: JSON.stringify(originalPayload),
      response_json: JSON.stringify(responseData),
      data_emitere: failedRecord.data_emitere,
      data_transmitere: now,
      data_actualizare: now,
      creat_de: 'retry-system',
      retry_count: currentRetryCount + 1,
      retry_history: JSON.stringify([retryHistoryEntry])
    }];

    await bigquery.dataset(DATASET).table('IappFacturiEmise_v2').insert(logRecord);

    if (response.ok && responseData.id_factura) {
      // Update FacturiGenerate_v2 cu succes
      const updateQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
        SET efactura_status = 'trimisa_iapp',
            anaf_upload_id = @iapp_id,
            data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @factura_id
      `;

      await bigquery.query({
        query: updateQuery,
        params: {
          factura_id,
          iapp_id: String(responseData.id_factura)
        },
        location: 'EU'
      });

      return {
        success: true,
        iapp_id_factura: responseData.id_factura
      };
    }

    return {
      success: false,
      error: responseData.error || responseData.message || `HTTP ${response.status}`
    };

  } catch (error) {
    console.error('❌ [iapp-retry] Error in retryInvoiceEmission:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================================================================
// HELPER: Update retry info în înregistrarea eșuată
// ==================================================================
async function updateRetryInfo(
  recordId: string,
  retryCount: number,
  nextRetryAt: Date,
  errorMessage?: string
): Promise<void> {
  try {
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.IappFacturiEmise_v2\`
      SET retry_count = @retry_count,
          next_retry_at = @next_retry_at,
          efactura_mesaj_eroare = COALESCE(@error_message, efactura_mesaj_eroare),
          data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @record_id
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        record_id: recordId,
        retry_count: retryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error_message: errorMessage || null
      },
      location: 'EU'
    });

    console.log(`✅ [iapp-retry] Updated retry info: count=${retryCount}, next_at=${nextRetryAt.toISOString()}`);

  } catch (error) {
    console.error('❌ [iapp-retry] Error updating retry info:', error);
  }
}

// ==================================================================
// HELPER: Declanșează următorul retry prin GitHub Actions
// ==================================================================
async function triggerNextRetry(factura_id: string, delayMs: number): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;
  const repoOwner = process.env.GITHUB_REPO_OWNER || 'teodordamian2025';
  const repoName = process.env.GITHUB_REPO_NAME || 'unitar-admin';

  if (!githubToken) {
    console.warn('⚠️ [iapp-retry] GITHUB_TOKEN not configured, cannot trigger next retry');
    return;
  }

  try {
    // Delay-ul se face în GitHub Actions workflow
    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'iapp-retry-invoice',
          client_payload: {
            factura_id,
            delay_seconds: Math.floor(delayMs / 1000)
          }
        })
      }
    );

    if (response.ok || response.status === 204) {
      console.log(`✅ [iapp-retry] GitHub workflow triggered for factura ${factura_id} with delay ${delayMs}ms`);
    } else {
      console.error(`❌ [iapp-retry] Failed to trigger GitHub workflow: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ [iapp-retry] Error triggering GitHub workflow:', error);
  }
}

// ==================================================================
// HELPER: Trimite notificare admin când toate retry-urile eșuează
// ==================================================================
async function sendAdminNotification(factura_id: string, failedRecord: any): Promise<void> {
  try {
    console.log(`📧 [iapp-retry] Sending admin notification for failed invoice ${factura_id}`);

    // Găsește factura pentru detalii
    const facturaQuery = `
      SELECT serie, numar, client_nume, client_cui, total
      FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
      WHERE id = @factura_id
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { factura_id },
      location: 'EU'
    });

    const factura = facturaRows[0] || {};
    const numarComplet = factura.serie ? `${factura.serie}-${factura.numar}` : factura.numar || factura_id;

    // Găsește adminii
    const adminQuery = `
      SELECT uid, email, nume FROM \`${PROJECT_ID}.${DATASET}.Utilizatori_v2\`
      WHERE rol = 'admin' AND activ = TRUE
    `;

    const [adminRows] = await bigquery.query({ query: adminQuery, location: 'EU' });

    // Creează notificări pentru fiecare admin
    const now = new Date();
    const notifications = adminRows.map((admin: any) => ({
      id: crypto.randomUUID(),
      tip_notificare: 'factura_iapp_esuat',
      user_id: admin.uid,
      factura_id,
      continut_json: JSON.stringify({
        numar_factura: numarComplet,
        client_nume: factura.client_nume || failedRecord.client_nume,
        client_cui: factura.client_cui || failedRecord.client_cif,
        valoare: factura.total || failedRecord.valoare_totala,
        retry_count: failedRecord.retry_count || MAX_RETRIES,
        ultima_eroare: failedRecord.efactura_mesaj_eroare,
        data_prima_incercare: failedRecord.data_transmitere
      }),
      titlu: `Factură ${numarComplet} - Trimitere iapp.ro eșuată definitiv`,
      mesaj: `Factura ${numarComplet} pentru ${factura.client_nume || failedRecord.client_nume} nu a putut fi trimisă la iapp.ro după ${MAX_RETRIES} încercări. Ultima eroare: ${failedRecord.efactura_mesaj_eroare || 'Necunoscută'}`,
      link_actiune: `/admin/rapoarte/proiecte?tab=facturi&search=${numarComplet}`,
      citita: false,
      trimis_email: false,
      data_creare: now.toISOString().split('T')[0],
      prioritate: 'high'
    }));

    if (notifications.length > 0) {
      await bigquery.dataset(DATASET).table('Notificari_v2').insert(notifications);
      console.log(`✅ [iapp-retry] Sent ${notifications.length} admin notifications`);
    }

    // Trimite și email prin sistemul de notificări
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.unitarproiect.eu';
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tip_notificare: 'factura_iapp_esuat',
          user_ids: adminRows.map((a: any) => a.uid),
          context: {
            factura_id,
            numar_factura: numarComplet,
            client_nume: factura.client_nume || failedRecord.client_nume,
            retry_count: failedRecord.retry_count || MAX_RETRIES,
            ultima_eroare: failedRecord.efactura_mesaj_eroare
          }
        })
      });
    } catch (emailError) {
      console.error('⚠️ [iapp-retry] Failed to send email notification:', emailError);
    }

  } catch (error) {
    console.error('❌ [iapp-retry] Error sending admin notification:', error);
  }
}
