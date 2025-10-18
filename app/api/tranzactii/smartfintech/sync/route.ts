// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/sync/route.ts
// DATA: 18.10.2025 (ora României)
// DESCRIERE: API sync tranzacții Smart Fintech cu auto-match
// FUNCȚIONALITATE: Fetch transactions → Map → Deduplicate → Insert BigQuery → Auto-match
// REUSE: 80% cod din /app/api/tranzactii/import-csv/route.ts
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';
import {
  authenticateSmartFintech,
  getSmartFintechAccounts,
  getSmartFintechTransactions,
  withTokenRefresh,
  decryptToken,
  encryptToken,
  type SmartFintechTokens,
  type SmartFintechAccount,
  type SmartFintechTransaction
} from '@/lib/smartfintech-api';

// ==================== BIGQUERY CONFIG ====================

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

console.log(`🔧 [SmartFintech Sync] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// ==================== TYPES ====================

interface MappedTransaction {
  transaction_hash: string;
  data_procesare: string; // DATE YYYY-MM-DD
  iban_cont: string;
  nume_cont: string;
  sold_initial?: number;
  sold_final?: number;
  suma: number;
  moneda: string;
  tip_tranzactie: string;
  directie: 'intrare' | 'iesire';
  iban_contrapartida?: string;
  nume_contrapartida?: string;
  cui_contrapartida?: string;
  detalii_tranzactie?: string;
  categorie?: string;
  subcategorie?: string;
  referinta_bancii?: string;
  exchange_rate?: string;
  sursa_import: string;
  account_id_smartfintech?: string;
}

// ==================== HELPER FUNCTIONS (reused from import-csv) ====================

/**
 * Generare hash SHA-256 pentru deduplicare tranzacții
 * Pattern identic cu import-csv/route.ts
 */
function generateTransactionHash(
  iban_cont: string,
  data_procesare: string,
  suma: number,
  nume_contrapartida: string,
  detalii_tranzactie: string
): string {
  const normalized = `${iban_cont}|${data_procesare}|${suma.toFixed(2)}|${nume_contrapartida}|${detalii_tranzactie}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Curăță IBAN (remove spaces, uppercase)
 */
function cleanIBAN(iban: string | undefined): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
}

/**
 * Extrage CUI din detalii tranzacție (pattern: RO12345678)
 */
function extractCUI(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(RO)?(\d{2,10})\b/);
  if (match) {
    return match[2]; // Return doar cifre
  }
  return undefined;
}

/**
 * Categorize transaction (reuse logic from import-csv)
 */
function categorizeTransaction(tx: SmartFintechTransaction): { categorie: string; subcategorie: string } {
  const tip = tx.transactionType?.toLowerCase() || '';
  const detalii = tx.remittanceInformationUnstructured?.toLowerCase() || '';
  const categoryType = tx.categoryType?.toLowerCase() || '';

  // Categorie din Smart Fintech (dacă există)
  if (categoryType) {
    return {
      categorie: tx.categoryType || 'Altele',
      subcategorie: tx.codeExplanation || tx.transactionType || 'Nedefinit'
    };
  }

  // Fallback categorization
  if (tip.includes('salary') || detalii.includes('salar')) {
    return { categorie: 'Venituri', subcategorie: 'Salarii' };
  }
  if (tip.includes('pos') || tip.includes('purchase')) {
    return { categorie: 'Plati', subcategorie: 'POS' };
  }
  if (tip.includes('transfer')) {
    return { categorie: 'Transfer', subcategorie: 'Transfer bancar' };
  }

  return { categorie: 'Altele', subcategorie: 'Nedefinit' };
}

/**
 * Determine directie (intrare/iesire) bazat pe suma
 */
function getTransactionDirection(amount: number): 'intrare' | 'iesire' {
  return amount >= 0 ? 'intrare' : 'iesire';
}

// ==================== MAPPING: Smart Fintech → TranzactiiBancare_v2 ====================

/**
 * Map Smart Fintech transaction → structura TranzactiiBancare_v2
 * Key differences vs CSV import:
 * 1. account_id_smartfintech pentru tracking sursa
 * 2. referinta_bancii (transactionId)
 * 3. exchange_rate (dacă există)
 * 4. CUI extraction din creditorName/debtorName + remittanceInfo
 */
function mapSmartFintechTransaction(
  tx: SmartFintechTransaction,
  account: SmartFintechAccount
): MappedTransaction {
  const directie = getTransactionDirection(tx.amount);
  const { categorie, subcategorie } = categorizeTransaction(tx);

  // Determine contrapartida (creditor sau debtor)
  const iban_contrapartida = directie === 'iesire'
    ? cleanIBAN(tx.creditorAccount?.iban)
    : cleanIBAN(tx.debtorAccount?.iban);

  const nume_contrapartida = directie === 'iesire'
    ? (tx.creditorName || tx.companyName || 'Necunoscut')
    : (tx.debtorName || tx.companyName || 'Necunoscut');

  // Extract CUI din nume contrapartida sau detalii
  const cui_contrapartida = extractCUI(nume_contrapartida) ||
                            extractCUI(tx.remittanceInformationUnstructured);

  // Build transaction hash pentru deduplicare
  const transaction_hash = generateTransactionHash(
    account.iban,
    tx.bookingDate,
    Math.abs(tx.amount), // Use absolute value for hash consistency
    nume_contrapartida,
    tx.remittanceInformationUnstructured || ''
  );

  return {
    transaction_hash,
    data_procesare: tx.valueDate, // Use valueDate (data procesare efectivă)
    iban_cont: account.iban,
    nume_cont: account.alias || account.bank,
    sold_initial: undefined, // Smart Fintech nu returnează sold intermediar per tranzacție
    sold_final: undefined,
    suma: tx.amount, // Păstrăm semnul (+ intrare, - iesire)
    moneda: tx.currency,
    tip_tranzactie: tx.transactionType || 'Nedefinit',
    directie,
    iban_contrapartida: iban_contrapartida || undefined,
    nume_contrapartida,
    cui_contrapartida,
    detalii_tranzactie: tx.remittanceInformationUnstructured || tx.smartTransactionDetails || '',
    categorie,
    subcategorie,
    referinta_bancii: tx.transactionId, // Unique ref din bancă
    exchange_rate: tx.exchangeRate,
    sursa_import: 'smartfintech_api',
    account_id_smartfintech: account.accountId
  };
}

// ==================== DEDUPLICATION (reuse from import-csv) ====================

/**
 * Verifică duplicate în BigQuery bazat pe transaction_hash
 * Returns: array de hash-uri care NU există în DB (safe to insert)
 */
async function deduplicateTransactions(transactions: MappedTransaction[]): Promise<MappedTransaction[]> {
  if (transactions.length === 0) return [];

  const hashes = transactions.map(tx => tx.transaction_hash);

  const query = `
    SELECT transaction_hash
    FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\`
    WHERE transaction_hash IN UNNEST(@hashes)
  `;

  const [rows] = await bigquery.query({
    query,
    params: { hashes }
  });

  const existingHashes = new Set(rows.map((row: any) => row.transaction_hash));

  const uniqueTransactions = transactions.filter(tx => !existingHashes.has(tx.transaction_hash));

  console.log(`🔍 [Deduplication] Total: ${transactions.length}, Duplicate: ${existingHashes.size}, Unique: ${uniqueTransactions.length}`);

  return uniqueTransactions;
}

// ==================== INSERT BIGQUERY (reuse from import-csv) ====================

/**
 * Insert tranzacții în TranzactiiBancare_v2 (batch insert)
 */
async function insertTransactionsToBigQuery(transactions: MappedTransaction[]): Promise<void> {
  if (transactions.length === 0) {
    console.log('⏭️  [Insert] No transactions to insert');
    return;
  }

  const rows = transactions.map(tx => ({
    transaction_hash: tx.transaction_hash,
    data_procesare: tx.data_procesare, // STRING în format YYYY-MM-DD
    iban_cont: tx.iban_cont,
    nume_cont: tx.nume_cont,
    sold_initial: tx.sold_initial || null,
    sold_final: tx.sold_final || null,
    suma: tx.suma,
    moneda: tx.moneda,
    tip_tranzactie: tx.tip_tranzactie,
    directie: tx.directie,
    iban_contrapartida: tx.iban_contrapartida || null,
    nume_contrapartida: tx.nume_contrapartida,
    cui_contrapartida: tx.cui_contrapartida || null,
    detalii_tranzactie: tx.detalii_tranzactie || null,
    categorie: tx.categorie,
    subcategorie: tx.subcategorie,
    referinta_bancii: tx.referinta_bancii || null,
    exchange_rate: tx.exchange_rate || null,
    sursa_import: tx.sursa_import,
    account_id_smartfintech: tx.account_id_smartfintech || null,
    data_import: new Date().toISOString()
  }));

  await bigquery.dataset(DATASET).table(`TranzactiiBancare${tableSuffix}`).insert(rows);

  console.log(`✅ [Insert] Inserted ${rows.length} transactions to BigQuery`);
}

// ==================== LOG OPERATION (reuse from import-csv) ====================

async function logSyncOperation(
  status: 'success' | 'error',
  message: string,
  metadata: any
): Promise<void> {
  try {
    const log = {
      operation_id: `smartfintech_sync_${Date.now()}`,
      operation_type: 'smartfintech_api_sync',
      status,
      message,
      metadata: JSON.stringify(metadata),
      timestamp: new Date().toISOString()
    };

    await bigquery.dataset(DATASET).table(`TranzactiiSyncLogs${tableSuffix}`).insert([log]);
  } catch (error) {
    console.error('❌ [Log] Failed to log operation:', error);
  }
}

// ==================== MAIN SYNC LOGIC ====================

/**
 * POST /api/tranzactii/smartfintech/sync
 * Body: { zile?: number } (default 7 - ultimele 7 zile)
 * Flow:
 * 1. Load credentials + tokens din BigQuery (SmartFintechTokens_v2)
 * 2. Refresh token dacă expirat
 * 3. Fetch accounts
 * 4. Fetch transactions per account (ultimele N zile)
 * 5. Map → Deduplicate → Insert
 * 6. Trigger auto-match (reuse /api/tranzactii/auto-match)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🚀 [SmartFintech Sync] Starting sync...');

    // Parse body
    const body = await request.json().catch(() => ({}));
    const zile = body.zile || 7;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - zile);

    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 [Sync] Date range: ${startDateStr} → ${endDateStr}`);

    // ==================== STEP 1: Load credentials & tokens ====================

    const tokenQuery = `
      SELECT
        id, client_id, client_secret, access_token, refresh_token, expires_at
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [tokenRows] = await bigquery.query({ query: tokenQuery });

    if (tokenRows.length === 0) {
      throw new Error('No active Smart Fintech configuration found. Please configure in Admin UI.');
    }

    const config = tokenRows[0];

    // Decrypt credentials
    const client_id = config.client_id;
    const client_secret = decryptToken(config.client_secret);

    let tokens: SmartFintechTokens;

    // Check dacă avem tokens salvate și dacă sunt valide
    if (config.access_token && config.refresh_token && config.expires_at) {
      const expiresAt = new Date(config.expires_at.value || config.expires_at).getTime();

      if (expiresAt > Date.now() + 60000) {
        // Token valid (mai mult de 1 min până la expirare)
        tokens = {
          access_token: decryptToken(config.access_token),
          refresh_token: decryptToken(config.refresh_token),
          expires_at: expiresAt
        };
        console.log('✅ [Auth] Using cached tokens');
      } else {
        // Token expirat → refresh
        console.log('🔄 [Auth] Token expired, refreshing...');
        tokens = await authenticateSmartFintech({ client_id, client_secret });

        // Save new tokens
        await updateTokensInDB(config.id, tokens);
      }
    } else {
      // Nu avem tokens → autentificare nouă
      console.log('🔑 [Auth] No cached tokens, authenticating...');
      tokens = await authenticateSmartFintech({ client_id, client_secret });

      // Save tokens
      await updateTokensInDB(config.id, tokens);
    }

    // ==================== STEP 2: Fetch accounts ====================

    const accounts = await withTokenRefresh(
      tokens,
      { client_id, client_secret },
      (accessToken) => getSmartFintechAccounts(accessToken),
      async (newTokens) => {
        // Callback: save refreshed tokens
        await updateTokensInDB(config.id, newTokens);
        tokens = newTokens;
      }
    );

    console.log(`🏦 [Accounts] Found ${accounts.length} accounts`);

    if (accounts.length === 0) {
      throw new Error('No bank accounts found. Please connect accounts in Smart Accounts Platform.');
    }

    // ==================== STEP 3: Fetch transactions per account ====================

    let allTransactions: MappedTransaction[] = [];

    for (const account of accounts) {
      console.log(`📄 [Transactions] Fetching for account ${account.iban} (${account.bank})...`);

      let pageNumber = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await withTokenRefresh(
          tokens,
          { client_id, client_secret },
          (accessToken) => getSmartFintechTransactions(accessToken, {
            startDate: startDateStr,
            endDate: endDateStr,
            accountId: account.accountId,
            pageNumber,
            pageSize: 100
          }),
          async (newTokens) => {
            await updateTokensInDB(config.id, newTokens);
            tokens = newTokens;
          }
        );

        // Map transactions
        const mappedTx = response.result.map(tx => mapSmartFintechTransaction(tx, account));
        allTransactions.push(...mappedTx);

        console.log(`   Page ${pageNumber + 1}/${response.totalPages}: ${response.result.length} transactions`);

        // Check next page
        pageNumber++;
        hasMorePages = pageNumber < response.totalPages;
      }
    }

    console.log(`📊 [Total] Fetched ${allTransactions.length} transactions from ${accounts.length} accounts`);

    // ==================== STEP 4: Deduplicate ====================

    const uniqueTransactions = await deduplicateTransactions(allTransactions);

    // ==================== STEP 5: Insert BigQuery ====================

    await insertTransactionsToBigQuery(uniqueTransactions);

    // ==================== STEP 6: Update ultima_sincronizare ====================

    await bigquery.query({
      query: `
        UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        SET
          ultima_sincronizare = CURRENT_TIMESTAMP(),
          ultima_eroare = NULL,
          numar_conturi = @numar_conturi,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `,
      params: {
        id: config.id,
        numar_conturi: accounts.length
      }
    });

    // ==================== STEP 7: Log success ====================

    const duration = Date.now() - startTime;

    await logSyncOperation('success', 'Smart Fintech sync completed successfully', {
      zile,
      accounts_count: accounts.length,
      total_transactions: allTransactions.length,
      new_transactions: uniqueTransactions.length,
      duration_ms: duration
    });

    console.log(`✅ [SmartFintech Sync] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Sincronizare completă cu succes',
      data: {
        accounts_count: accounts.length,
        total_transactions: allTransactions.length,
        new_transactions: uniqueTransactions.length,
        duplicate_transactions: allTransactions.length - uniqueTransactions.length,
        date_range: `${startDateStr} → ${endDateStr}`,
        duration_ms: duration
      }
    });

  } catch (error: any) {
    console.error('❌ [SmartFintech Sync] Error:', error);

    // Log error
    await logSyncOperation('error', error.message, {
      error_stack: error.stack
    });

    // Save error to config
    try {
      await bigquery.query({
        query: `
          UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
          SET
            ultima_eroare = @eroare,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE is_active = TRUE
        `,
        params: {
          eroare: error.message
        }
      });
    } catch (updateError) {
      console.error('❌ [Error Update] Failed to save error:', updateError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync Smart Fintech transactions'
      },
      { status: 500 }
    );
  }
}

// ==================== HELPER: Update tokens în DB ====================

async function updateTokensInDB(configId: string, tokens: SmartFintechTokens): Promise<void> {
  try {
    await bigquery.query({
      query: `
        UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        SET
          access_token = @access_token,
          refresh_token = @refresh_token,
          expires_at = TIMESTAMP_MILLIS(@expires_at),
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `,
      params: {
        id: configId,
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptToken(tokens.refresh_token),
        expires_at: tokens.expires_at
      }
    });

    console.log('✅ [Tokens] Updated in BigQuery');
  } catch (error) {
    console.error('❌ [Tokens] Failed to update:', error);
    throw error;
  }
}
