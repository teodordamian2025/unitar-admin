// ==================================================================
// CALEA: lib/smartfintech-api.ts
// DATA: 18.10.2025 (ora României)
// DESCRIERE: Helper library pentru Smart Fintech API (Smart Accounts Platform)
// FUNCȚIONALITATE: OAuth 2.0, token management, fetch accounts & transactions
// API DOCS: /docs/sa-v2.yaml (OpenAPI 3.0.1)
// ==================================================================

import crypto from 'crypto';

// ==================== TYPES ====================

export interface SmartFintechTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
}

export interface SmartFintechCredentials {
  client_id: string;
  client_secret: string; // Plain text (va fi encrypt la save în DB)
}

export interface SmartFintechAccount {
  accountId: string;
  iban: string;
  alias: string;
  balance: {
    id: number;
    currency: string;
    amount: number;
  };
  bank: string;
  remainingDays: number;
  consentStatus: string;
  balancesLastSync: number; // Unix timestamp milliseconds
  transactionsLastSync: number;
}

export interface SmartFintechTransaction {
  id: number;
  transactionId: string;
  bookingDate: string; // YYYY-MM-DD
  valueDate: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  transactionType: string;
  creditorAccount?: { iban: string };
  creditorName?: string;
  debtorAccount?: { iban: string };
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  smartTransactionDetails?: string;
  companyName?: string;
  bank: string;
  exchangeRate?: string;
  categoryType?: string;
  codeType?: string;
  codeExplanation?: string;
}

export interface SmartFintechTransactionsResponse {
  message: string;
  result: SmartFintechTransaction[];
  totalPages: number;
  totalElements: number;
}

// ==================== ENCRYPTION (pattern ANAF) ====================

const ENCRYPTION_KEY = process.env.ANAF_TOKEN_ENCRYPTION_KEY || 'default-key-32-characters-long!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Criptează text (client_secret, tokens) pentru stocare BigQuery
 */
export function encryptToken(text: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ [SmartFintech] Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decriptează text (client_secret, tokens) din BigQuery
 */
export function decryptToken(encryptedText: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ [SmartFintech] Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

// ==================== API CONSTANTS ====================

const SMARTFINTECH_BASE_URL = 'https://appsmartaccounts.eu/sacc-web-gateway';

const ENDPOINTS = {
  TOKEN: '/ryke-authenticate-api/rest/api/authenticate/sacc-web/tokens',
  ACCOUNTS: '/ryke-accounts/rest/api/ais/sacc-web/export/aisp-accounts',
  TRANSACTIONS: '/ryke-accounts/rest/api/ais/sacc-web/export/aisp-transactions'
};

// ==================== API FUNCTIONS ====================

/**
 * 1. Autentificare cu client_id + client_secret → Access Token + Refresh Token
 * Endpoint: POST /ryke-authenticate-api/rest/api/authenticate/sacc-web/tokens
 * Grant Type: client_credentials
 */
export async function authenticateSmartFintech(
  credentials: SmartFintechCredentials
): Promise<SmartFintechTokens> {
  try {
    console.log('🔑 [SmartFintech] Authenticating with client_id:', credentials.client_id);

    const response = await fetch(`${SMARTFINTECH_BASE_URL}${ENDPOINTS.TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SmartFintech] Auth failed:', response.status, errorText);
      throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.status?.includes('400') || data.status?.includes('401')) {
      throw new Error(data.message || 'Authentication failed - invalid credentials');
    }

    if (!data.result?.accessToken || !data.result?.refreshToken) {
      throw new Error('Missing tokens in response');
    }

    // Calculate expires_at (default 1 hour if not provided)
    const expiresIn = 3600; // 1 hour in seconds
    const expiresAt = Date.now() + (expiresIn * 1000);

    console.log('✅ [SmartFintech] Authentication successful');

    return {
      access_token: data.result.accessToken,
      refresh_token: data.result.refreshToken,
      expires_at: expiresAt
    };

  } catch (error) {
    console.error('❌ [SmartFintech] Authentication error:', error);
    throw error;
  }
}

/**
 * 2. Refresh token când access_token expiră
 * Endpoint: POST /ryke-authenticate-api/rest/api/authenticate/sacc-web/tokens
 * Grant Type: refresh_token
 */
export async function refreshSmartFintechToken(
  credentials: SmartFintechCredentials,
  refreshToken: string
): Promise<SmartFintechTokens> {
  try {
    console.log('🔄 [SmartFintech] Refreshing token...');

    const response = await fetch(`${SMARTFINTECH_BASE_URL}${ENDPOINTS.TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SmartFintech] Token refresh failed:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.result?.accessToken || !data.result?.refreshToken) {
      throw new Error('Missing tokens in refresh response');
    }

    const expiresIn = 3600; // 1 hour
    const expiresAt = Date.now() + (expiresIn * 1000);

    console.log('✅ [SmartFintech] Token refreshed successfully');

    return {
      access_token: data.result.accessToken,
      refresh_token: data.result.refreshToken,
      expires_at: expiresAt
    };

  } catch (error) {
    console.error('❌ [SmartFintech] Token refresh error:', error);
    throw error;
  }
}

/**
 * 3. Fetch lista conturi bancare autorizate
 * Endpoint: GET /ryke-accounts/rest/api/ais/sacc-web/export/aisp-accounts
 * Requires: Authorization header cu access_token
 */
export async function getSmartFintechAccounts(
  accessToken: string
): Promise<SmartFintechAccount[]> {
  try {
    console.log('🏦 [SmartFintech] Fetching accounts...');

    const response = await fetch(`${SMARTFINTECH_BASE_URL}${ENDPOINTS.ACCOUNTS}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SmartFintech] Get accounts failed:', response.status, errorText);

      // Token expirat → throw special error pentru retry cu refresh
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }

      throw new Error(`Get accounts failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.message !== 'SUCCESS') {
      throw new Error(`API error: ${data.message}`);
    }

    console.log(`✅ [SmartFintech] Fetched ${data.result?.length || 0} accounts`);

    return data.result || [];

  } catch (error) {
    console.error('❌ [SmartFintech] Get accounts error:', error);
    throw error;
  }
}

/**
 * 4. Fetch tranzacții bancare cu filtre
 * Endpoint: GET /ryke-accounts/rest/api/ais/sacc-web/export/aisp-transactions
 * Query params: startDate, endDate, accountId (optional), pageNumber, pageSize
 * Requires: Authorization header cu access_token
 */
export async function getSmartFintechTransactions(
  accessToken: string,
  options: {
    startDate: string; // YYYY-MM-DD (mandatory)
    endDate: string; // YYYY-MM-DD (mandatory)
    accountId?: string; // Optional filter
    pageNumber?: number; // Default 0
    pageSize?: number; // Default 50
  }
): Promise<SmartFintechTransactionsResponse> {
  try {
    const { startDate, endDate, accountId, pageNumber = 0, pageSize = 50 } = options;

    console.log(`📄 [SmartFintech] Fetching transactions: ${startDate} → ${endDate}, page ${pageNumber}`);

    // Build query string
    const params = new URLSearchParams({
      startDate,
      endDate,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    });

    if (accountId) {
      params.append('accountId', accountId);
    }

    const url = `${SMARTFINTECH_BASE_URL}${ENDPOINTS.TRANSACTIONS}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SmartFintech] Get transactions failed:', response.status, errorText);

      // Token expirat → throw special error pentru retry cu refresh
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }

      throw new Error(`Get transactions failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.message !== 'SUCCESS') {
      throw new Error(`API error: ${data.message}`);
    }

    console.log(`✅ [SmartFintech] Fetched ${data.result?.length || 0} transactions (page ${pageNumber + 1}/${data.totalPages || 1})`);

    return {
      message: data.message,
      result: data.result || [],
      totalPages: data.totalPages || 1,
      totalElements: data.totalElements || 0
    };

  } catch (error) {
    console.error('❌ [SmartFintech] Get transactions error:', error);
    throw error;
  }
}

// ==================== HELPER: Token Auto-Refresh Wrapper ====================

/**
 * Wrapper function care face retry cu refresh token dacă get API returnează 401
 * Usage: await withTokenRefresh(tokens, credentials, () => getSmartFintechAccounts(tokens.access_token))
 *
 * Flow:
 * 1. Try cu access_token cached
 * 2. Dacă 401 → refresh cu refresh_token
 * 3. Dacă refresh eșuează → FALLBACK la client_credentials (re-autentificare completă)
 */
export async function withTokenRefresh<T>(
  currentTokens: SmartFintechTokens,
  credentials: SmartFintechCredentials,
  apiCall: (accessToken: string) => Promise<T>,
  onTokenRefreshed?: (newTokens: SmartFintechTokens) => Promise<void>
): Promise<T> {
  try {
    // Try cu token curent
    return await apiCall(currentTokens.access_token);

  } catch (error: any) {
    // Dacă e TOKEN_EXPIRED, refresh și retry
    if (error.message === 'TOKEN_EXPIRED') {
      console.log('🔄 [SmartFintech] Token expired, attempting refresh...');

      try {
        // STEP 1: Încearcă refresh cu refresh_token
        const newTokens = await refreshSmartFintechToken(credentials, currentTokens.refresh_token);

        // Callback pentru salvare token nou în DB (opțional)
        if (onTokenRefreshed) {
          await onTokenRefreshed(newTokens);
        }

        console.log('✅ [SmartFintech] Token refreshed successfully');

        // Retry cu token nou
        return await apiCall(newTokens.access_token);

      } catch (refreshError: any) {
        // STEP 2: Dacă refresh eșuează → FALLBACK la client_credentials
        console.warn('⚠️ [SmartFintech] Refresh failed, falling back to client_credentials re-authentication');
        console.error('   Refresh error:', refreshError.message);

        const newTokens = await authenticateSmartFintech(credentials);

        // Callback pentru salvare token nou în DB
        if (onTokenRefreshed) {
          await onTokenRefreshed(newTokens);
        }

        console.log('✅ [SmartFintech] Re-authenticated with client_credentials successfully');

        // Retry cu token nou
        return await apiCall(newTokens.access_token);
      }

    } else {
      // Alte erori → throw
      throw error;
    }
  }
}

// ==================== EXPORT ====================

export default {
  authenticateSmartFintech,
  refreshSmartFintechToken,
  getSmartFintechAccounts,
  getSmartFintechTransactions,
  withTokenRefresh,
  encryptToken,
  decryptToken
};
