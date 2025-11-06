// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/balance-force-update/route.ts
// DATA: 06.11.2025
// DESCRIERE: FORCE UPDATE endpoint - șterge cache vechi și forțează fetch fresh
// FUNCȚIONALITATE: Bypass complet cache, salvează metadata nouă (size redus)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  authenticateSmartFintech,
  getSmartFintechAccounts,
  withTokenRefresh,
  withRetry,
  decryptToken,
  encryptToken,
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('🚀 [Force Update] Starting FORCED balance update...');

    // STEP 1: Load config
    logs.push('📋 [Step 1] Loading config from BigQuery');
    const configQuery = `
      SELECT
        id,
        client_id,
        client_secret,
        access_token,
        refresh_token,
        expires_at,
        is_active,
        metadata
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery });

    if (configRows.length === 0) {
      throw new Error('No active Smart Fintech configuration found');
    }

    const config = configRows[0];
    logs.push(`✅ Config loaded: ${config.id}`);

    // STEP 2: DELETE old metadata cache FIRST (force fresh)
    logs.push('🗑️ [Step 2] Deleting old metadata cache...');
    const deleteMetadataQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      SET
        metadata = NULL,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteMetadataQuery,
      params: { id: config.id }
    });

    logs.push('✅ Old cache deleted');

    // STEP 3: Authenticate/Refresh tokens
    logs.push('🔑 [Step 3] Checking tokens...');
    const credentials: SmartFintechCredentials = {
      client_id: config.client_id,
      client_secret: decryptToken(config.client_secret),
    };

    let tokens: SmartFintechTokens;

    if (config.access_token && config.refresh_token && config.expires_at) {
      const expiresAt = new Date(config.expires_at.value || config.expires_at).getTime();

      if (expiresAt > Date.now() + 60000) {
        tokens = {
          access_token: decryptToken(config.access_token),
          refresh_token: decryptToken(config.refresh_token),
          expires_at: expiresAt
        };
        logs.push('✅ Using cached tokens');
      } else {
        logs.push('🔄 Token expired, re-authenticating...');
        tokens = await authenticateSmartFintech(credentials);

        // Save new tokens
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
            id: config.id,
            access_token: encryptToken(tokens.access_token),
            refresh_token: encryptToken(tokens.refresh_token),
            expires_at: tokens.expires_at
          }
        });

        logs.push('✅ Re-authenticated successfully');
      }
    } else {
      logs.push('🔑 No tokens, authenticating...');
      tokens = await authenticateSmartFintech(credentials);
      logs.push('✅ Authenticated successfully');
    }

    // STEP 4: Fetch accounts (FRESH)
    logs.push('🏦 [Step 4] Fetching FRESH accounts from Smart Fintech...');

    const accounts = await withRetry(
      () => withTokenRefresh(
        tokens,
        credentials,
        (accessToken) => getSmartFintechAccounts(accessToken),
        async (newTokens) => {
          logs.push('🔄 Token refreshed during fetch');

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
              id: config.id,
              access_token: encryptToken(newTokens.access_token),
              refresh_token: encryptToken(newTokens.refresh_token),
              expires_at: newTokens.expires_at
            }
          });
        }
      ),
      3,
      2000
    );

    logs.push(`✅ Fetched ${accounts.length} accounts`);

    // STEP 5: Calculate total balance
    logs.push('💰 [Step 5] Calculating total balance...');
    let totalBalanceRON = 0;
    const accountBalances: { iban: string; alias: string; amount: number; currency: string }[] = [];

    for (const account of accounts) {
      const { balance, iban, alias } = account;

      accountBalances.push({
        iban,
        alias,
        amount: balance.amount,
        currency: balance.currency,
      });

      if (balance.currency === 'RON') {
        totalBalanceRON += balance.amount;
      } else if (balance.currency === 'EUR') {
        totalBalanceRON += balance.amount * 5.0;
      } else if (balance.currency === 'USD') {
        totalBalanceRON += balance.amount * 4.5;
      } else {
        totalBalanceRON += balance.amount;
      }
    }

    logs.push(`✅ Total balance: ${totalBalanceRON.toFixed(2)} RON`);

    // STEP 6: Save NEW metadata (REDUCED SIZE)
    logs.push('💾 [Step 6] Saving NEW metadata (reduced size)...');

    const metadataToSave = {
      balance: {
        total: totalBalanceRON,
        currency: 'RON',
        lastSync: new Date().toISOString(),
        accounts_count: accounts.length // DOAR count, NU array
      }
    };

    const metadataSize = JSON.stringify(metadataToSave).length;
    logs.push(`📊 Metadata size: ${metadataSize} bytes (reduced from old cache)`);

    await bigquery.query({
      query: `
        UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        SET
          metadata = PARSE_JSON(@metadata),
          ultima_sincronizare = CURRENT_TIMESTAMP(),
          numar_conturi = @numar_conturi,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `,
      params: {
        id: config.id,
        metadata: JSON.stringify(metadataToSave),
        numar_conturi: accounts.length
      }
    });

    logs.push('✅ Metadata saved successfully!');

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Force update completed successfully',
      balance: {
        total: totalBalanceRON,
        currency: 'RON',
        accounts: accountBalances,
        lastSync: new Date().toISOString(),
        cached: false // Fresh data
      },
      metadata: {
        old_cache_deleted: true,
        new_cache_saved: true,
        metadata_size_bytes: metadataSize
      },
      duration_ms: duration,
      logs
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logs.push(`❌ Error: ${error.message}`);

    return NextResponse.json({
      success: false,
      error: error.message,
      duration_ms: duration,
      logs
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
