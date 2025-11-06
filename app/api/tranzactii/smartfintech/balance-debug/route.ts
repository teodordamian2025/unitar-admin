// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/balance-debug/route.ts
// DATA: 06.11.2025
// DESCRIERE: DEBUG endpoint pentru diagnosticare probleme balance sync
// FUNCȚIONALITATE: Returnează detalii complete despre cache, tokens, fetch status
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  authenticateSmartFintech,
  getSmartFintechAccounts,
  withTokenRefresh,
  withRetry,
  decryptToken,
  SmartFintechTokens,
  SmartFintechCredentials,
} from '@/lib/smartfintech-api';

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

export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    step: '',
    error: null,
    config: null,
    cache: null,
    tokens: null,
    freshFetch: null,
    result: null
  };

  try {
    // STEP 1: Load config
    debugInfo.step = '1. Loading config from BigQuery';
    const configQuery = `
      SELECT
        id,
        client_id,
        client_secret,
        access_token,
        refresh_token,
        expires_at,
        is_active,
        metadata,
        ultima_sincronizare
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery });

    if (configRows.length === 0) {
      debugInfo.error = 'No active Smart Fintech configuration found';
      return NextResponse.json(debugInfo);
    }

    const config = configRows[0];

    debugInfo.config = {
      id: config.id,
      client_id: config.client_id,
      has_access_token: !!config.access_token,
      has_refresh_token: !!config.refresh_token,
      expires_at: config.expires_at?.value || config.expires_at,
      expires_at_readable: config.expires_at
        ? new Date(config.expires_at.value || config.expires_at).toISOString()
        : null,
      is_token_expired: config.expires_at
        ? new Date(config.expires_at.value || config.expires_at).getTime() < Date.now()
        : true,
      ultima_sincronizare: config.ultima_sincronizare?.value || config.ultima_sincronizare
    };

    // STEP 2: Check cache in metadata
    debugInfo.step = '2. Checking cache in metadata';
    if (config.metadata) {
      const metadata = typeof config.metadata === 'string'
        ? JSON.parse(config.metadata)
        : config.metadata;

      if (metadata.balance) {
        const cacheAge = Date.now() - new Date(metadata.balance.lastSync).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        debugInfo.cache = {
          exists: true,
          total: metadata.balance.total,
          currency: metadata.balance.currency,
          lastSync: metadata.balance.lastSync,
          cacheAgeHours: cacheAgeHours.toFixed(2),
          isExpired: cacheAgeHours > 6,
          accounts: metadata.balance.accounts
        };
      } else {
        debugInfo.cache = { exists: false };
      }
    } else {
      debugInfo.cache = { exists: false };
    }

    // STEP 3: Try fresh fetch
    debugInfo.step = '3. Attempting fresh fetch from Smart Fintech API';

    const credentials: SmartFintechCredentials = {
      client_id: config.client_id,
      client_secret: decryptToken(config.client_secret),
    };

    let tokens: SmartFintechTokens;

    // Check dacă avem tokens și dacă sunt valide
    if (config.access_token && config.refresh_token && config.expires_at) {
      const expiresAt = new Date(config.expires_at.value || config.expires_at).getTime();

      if (expiresAt > Date.now() + 60000) {
        tokens = {
          access_token: decryptToken(config.access_token),
          refresh_token: decryptToken(config.refresh_token),
          expires_at: expiresAt
        };
        debugInfo.tokens = { status: 'using_cached', expires_in_minutes: ((expiresAt - Date.now()) / 60000).toFixed(2) };
      } else {
        debugInfo.tokens = { status: 'expired_reauthenticating' };
        tokens = await authenticateSmartFintech({
          client_id: credentials.client_id,
          client_secret: credentials.client_secret
        });
        debugInfo.tokens.reauthenticated = true;
      }
    } else {
      debugInfo.tokens = { status: 'no_tokens_authenticating' };
      tokens = await authenticateSmartFintech({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret
      });
      debugInfo.tokens.authenticated = true;
    }

    // Fetch accounts
    debugInfo.step = '4. Fetching accounts from Smart Fintech';

    try {
      const accounts = await withRetry(
        () => withTokenRefresh(
          tokens,
          credentials,
          (accessToken) => getSmartFintechAccounts(accessToken),
          async (newTokens) => {
            debugInfo.tokens.refreshed_during_fetch = true;
          }
        ),
        3,
        2000
      );

      debugInfo.freshFetch = {
        success: true,
        accounts_count: accounts.length,
        accounts: accounts.map(acc => ({
          iban: acc.iban,
          alias: acc.alias,
          balance: acc.balance.amount,
          currency: acc.balance.currency,
          bank: acc.bank
        }))
      };

      // Calculate total
      let totalBalanceRON = 0;
      for (const account of accounts) {
        if (account.balance.currency === 'RON') {
          totalBalanceRON += account.balance.amount;
        } else if (account.balance.currency === 'EUR') {
          totalBalanceRON += account.balance.amount * 5.0;
        } else if (account.balance.currency === 'USD') {
          totalBalanceRON += account.balance.amount * 4.5;
        } else {
          totalBalanceRON += account.balance.amount;
        }
      }

      debugInfo.freshFetch.total_balance_ron = totalBalanceRON;

    } catch (fetchError: any) {
      debugInfo.freshFetch = {
        success: false,
        error: fetchError.message,
        stack: fetchError.stack
      };
    }

    // STEP 5: Result comparison
    debugInfo.step = '5. Comparison - Cache vs Fresh';
    debugInfo.result = {
      cache_value: debugInfo.cache?.total || null,
      fresh_value: debugInfo.freshFetch?.total_balance_ron || null,
      difference: debugInfo.cache?.total && debugInfo.freshFetch?.total_balance_ron
        ? (debugInfo.freshFetch.total_balance_ron - debugInfo.cache.total).toFixed(2)
        : null,
      should_update: debugInfo.freshFetch?.success &&
                     debugInfo.freshFetch.total_balance_ron !== debugInfo.cache?.total
    };

    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    debugInfo.error = {
      message: error.message,
      stack: error.stack,
      step: debugInfo.step
    };

    return NextResponse.json(debugInfo, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
