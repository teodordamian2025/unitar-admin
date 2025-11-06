// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/balance/route.ts
// DATA: 02.11.2025 (ora României)
// MODIFICAT: 04.11.2025 - Adăugat cache logic în metadata (refresh la 6 ore)
// DESCRIERE: API pentru extragere sold disponibil din Smart Fintech
// FUNCȚIONALITATE: GET - returnează sold total din toate conturile (cu cache)
// CACHE: Salvează în SmartFintechTokens_v2.metadata, valid 6 ore
// FORCE REFRESH: Query param ?force_refresh=true pentru bypass cache
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Update tokens în BigQuery după refresh/reautentificare
 * Pattern identic cu sync/route.ts
 */
async function updateTokensInDB(configId: string, tokens: SmartFintechTokens): Promise<void> {
  try {
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      SET
        access_token = @access_token,
        refresh_token = @refresh_token,
        expires_at = TIMESTAMP_MILLIS(@expires_at),
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        id: configId,
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptToken(tokens.refresh_token),
        expires_at: tokens.expires_at,
      },
    });

    console.log('✅ [Balance] Tokens updated in BigQuery');
  } catch (error) {
    console.error('❌ [Balance] Failed to update tokens:', error);
    throw error;
  }
}

// ==================== GET - Sold disponibil ====================

export async function GET(request: NextRequest) {
  try {
    // SOLUȚIE #4: Debug logs pentru troubleshooting
    console.log('💰 [Balance] API HIT - Request received at:', new Date().toISOString());
    console.log('💰 [Balance] Headers:', {
      'user-agent': request.headers.get('user-agent'),
      'cache-control': request.headers.get('cache-control'),
      'if-none-match': request.headers.get('if-none-match'),
      'if-modified-since': request.headers.get('if-modified-since')
    });

    // Parse query params
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    console.log(`💰 [Balance] Fetching available balance (force_refresh=${forceRefresh})...`);

    // 1. Încarcă configurația activă din BigQuery
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
      console.warn('⚠️ [Balance] No active Smart Fintech configuration found. Card will not be displayed.');
      // SOLUȚIE #1: No-Cache headers
      return NextResponse.json({
        success: true,
        balance: null,
        message: 'Smart Fintech nu este configurat.',
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    const config = configRows[0];

    // 2. Check cache în metadata (dacă nu e force refresh)
    if (!forceRefresh && config.metadata) {
      // BigQuery might return JSON as object already, no need to parse
      const metadata = typeof config.metadata === 'string'
        ? JSON.parse(config.metadata)
        : config.metadata;

      if (metadata.balance && metadata.balance.lastSync) {
        const lastSyncTime = new Date(metadata.balance.lastSync).getTime();
        const now = Date.now();
        const sixHoursInMs = 6 * 60 * 60 * 1000; // 6 ore în millisecunde

        // SOLUȚIE #2: Fix validare cache - 0 este valid! (sold poate fi 0 RON real)
        if (metadata.balance.total == null || isNaN(metadata.balance.total)) {
          console.log('⚠️ [Balance] Cache contains invalid total (null or NaN), forcing fresh fetch...');
          // Continue cu fetch live în loc să returneze cache invalid
        } else if (now - lastSyncTime < sixHoursInMs) {
          // Cache valid cu date reale
          const cacheAgeMinutes = Math.floor((now - lastSyncTime) / 60000);
          console.log(`✅ [Balance] Returning cached balance (${cacheAgeMinutes} minutes old)`);

          // SOLUȚIE #1: Adaugă No-Cache headers pentru a preveni HTTP 304
          return NextResponse.json({
            success: true,
            balance: {
              total: metadata.balance.total,
              currency: metadata.balance.currency,
              accounts: metadata.balance.accounts || [], // Poate să lipsească în cache nou
              accounts_count: metadata.balance.accounts_count || (metadata.balance.accounts?.length || 0),
              lastSync: metadata.balance.lastSync,
              cached: true,
              cacheAgeMinutes
            }
          }, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
        } else {
          console.log('⏰ [Balance] Cache expired (>6 hours), fetching fresh data...');
        }
      }
    }

    // 3. Decrypt credentials
    const credentials: SmartFintechCredentials = {
      client_id: config.client_id,
      client_secret: decryptToken(config.client_secret),
    };

    let tokens: SmartFintechTokens;

    // 4. Verificare și refresh tokens (PATTERN IDENTIC CU SYNC) - FIX PRINCIPAL
    // Check dacă avem tokens salvate și dacă sunt valide
    if (config.access_token && config.refresh_token && config.expires_at) {
      const expiresAt = new Date(config.expires_at.value || config.expires_at).getTime();

      if (expiresAt > Date.now() + 60000) {
        // Token valid (mai mult de 1 min până la expirare) → folosește-l direct
        tokens = {
          access_token: decryptToken(config.access_token),
          refresh_token: decryptToken(config.refresh_token),
          expires_at: expiresAt
        };
        console.log('✅ [Balance] Using cached tokens');
      } else {
        // Token expirat → reautentificare cu client_credentials (FALLBACK LA SYNC)
        console.log('🔄 [Balance] Token expired, re-authenticating with client_credentials...');
        tokens = await authenticateSmartFintech({
          client_id: credentials.client_id,
          client_secret: credentials.client_secret
        });

        // Save new tokens
        await updateTokensInDB(config.id, tokens);
      }
    } else {
      // Nu avem tokens → autentificare nouă
      console.log('🔑 [Balance] No cached tokens, authenticating...');
      tokens = await authenticateSmartFintech({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret
      });

      // Save tokens
      await updateTokensInDB(config.id, tokens);
    }

    // 5. Fetch accounts cu token refresh automat (backup layer) + retry logic
    const accounts = await withRetry(
      () => withTokenRefresh(
        tokens,
        credentials,
        (accessToken) => getSmartFintechAccounts(accessToken),
        async (newTokens) => {
          // Save new tokens în BigQuery
          console.log('🔄 [Balance] Saving refreshed tokens...');

          const updateQuery = `
            UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
            SET
              access_token = @access_token,
              refresh_token = @refresh_token,
              expires_at = TIMESTAMP_MILLIS(@expires_at),
              data_actualizare = CURRENT_TIMESTAMP()
            WHERE id = @id
          `;

          await bigquery.query({
            query: updateQuery,
            params: {
              id: config.id,
              access_token: encryptToken(newTokens.access_token),
              refresh_token: encryptToken(newTokens.refresh_token),
              expires_at: newTokens.expires_at,
            },
          });
        }
      ),
      3, // Max 3 retry-uri
      2000 // 2s delay între retry-uri
    );

    console.log(`✅ [Balance] Fetched ${accounts.length} accounts`);

    // 6. Calculate total balance (sumă RON + conversie pentru alte valute)
    let totalBalanceRON = 0;
    const accountBalances: { iban: string; alias: string; amount: number; currency: string }[] = [];

    for (const account of accounts) {
      const { balance, iban, alias, bank } = account;

      accountBalances.push({
        iban,
        alias,
        amount: balance.amount,
        currency: balance.currency,
      });

      // Pentru simplitate, considerăm toate sumele ca RON
      // TODO: Conversie valutară pentru EUR, USD, etc. (folosind BNR API)
      if (balance.currency === 'RON') {
        totalBalanceRON += balance.amount;
      } else if (balance.currency === 'EUR') {
        // Conversie simplă EUR → RON (rate aproximativ 5.0)
        // În producție, ar trebui să folosești BNR API pentru rate live
        totalBalanceRON += balance.amount * 5.0;
      } else if (balance.currency === 'USD') {
        // Conversie simplă USD → RON (rate aproximativ 4.5)
        totalBalanceRON += balance.amount * 4.5;
      } else {
        // Alte valute - presupunem RON
        totalBalanceRON += balance.amount;
      }
    }

    console.log(`💰 [Balance] Total balance: ${totalBalanceRON.toFixed(2)} RON`);

    const balanceData = {
      total: totalBalanceRON,
      currency: 'RON',
      accounts: accountBalances,
      lastSync: new Date().toISOString()
    };

    // 7. Salvează balance în metadata pentru cache (TRY ONLY - nu bloca response-ul)
    // FIX: Reduce metadata size (nu salva accounts array - prea mare pentru BigQuery)
    try {
      const metadataToSave = {
        balance: {
          total: totalBalanceRON,
          currency: 'RON',
          lastSync: balanceData.lastSync,
          accounts_count: accountBalances.length // Doar count, nu array
        }
      };

      const updateMetadataQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        SET
          metadata = PARSE_JSON(@metadata),
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `;

      await bigquery.query({
        query: updateMetadataQuery,
        params: {
          id: config.id,
          metadata: JSON.stringify(metadataToSave)
        }
      });

      console.log('✅ [Balance] Saved to metadata cache');
    } catch (metadataError: any) {
      // ⚠️ IGNORE metadata save error - returnează fresh data oricum!
      console.warn('⚠️ [Balance] Failed to save metadata (ignored):', metadataError.message);
      console.warn('   Fresh balance will still be returned to client');
    }

    // 8. Update ultima_sincronizare în BigQuery
    const updateSyncQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      SET
        ultima_sincronizare = CURRENT_TIMESTAMP(),
        numar_conturi = @numar_conturi
      WHERE id = @id
    `;

    await bigquery.query({
      query: updateSyncQuery,
      params: {
        id: config.id,
        numar_conturi: accounts.length,
      },
    });

    // SOLUȚIE #1: No-Cache headers pentru fresh data
    return NextResponse.json({
      success: true,
      balance: {
        ...balanceData,
        cached: false // Fresh data, not from cache
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('❌ [Balance] Error fetching balance:', error);

    // ✅ FALLBACK: Dacă există cache vechi (chiar expirat) cu sold valid, returnează-l cu warning
    try {
      // Încearcă să citești config din nou pentru metadata actualizat
      const fallbackQuery = `
        SELECT metadata
        FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
        WHERE is_active = TRUE
        ORDER BY data_actualizare DESC
        LIMIT 1
      `;

      const [fallbackRows] = await bigquery.query({ query: fallbackQuery });

      if (fallbackRows.length > 0 && fallbackRows[0].metadata) {
        const metadata = typeof fallbackRows[0].metadata === 'string'
          ? JSON.parse(fallbackRows[0].metadata)
          : fallbackRows[0].metadata;

        // FIX: Permite și sold 0 în fallback (nu doar > 0)
        if (metadata.balance?.total != null && !isNaN(metadata.balance.total)) {
          console.warn('⚠️ [Balance] Fetch failed, returning stale cache as fallback');
          // SOLUȚIE #1: No-Cache headers pentru fallback stale cache
          return NextResponse.json({
            success: true,
            balance: {
              total: metadata.balance.total,
              currency: metadata.balance.currency,
              accounts: metadata.balance.accounts || [], // Poate să lipsească în cache nou
              accounts_count: metadata.balance.accounts_count || (metadata.balance.accounts?.length || 0),
              lastSync: metadata.balance.lastSync,
              cached: true,
              stale: true, // Flag pentru UI că e cache expirat
              cacheAgeMinutes: metadata.balance.lastSync
                ? Math.floor((Date.now() - new Date(metadata.balance.lastSync).getTime()) / 60000)
                : null
            },
            warning: 'Sold din cache (posibil expirat). Eroare la actualizare: ' + error.message
          }, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
        }
      }
    } catch (fallbackError) {
      console.error('❌ [Balance] Fallback to cache also failed:', fallbackError);
    }

    // Dacă nu există cache valid, returnează null
    // SOLUȚIE #1: No-Cache headers pentru error response
    return NextResponse.json({
      success: true,
      balance: null,
      message: 'Nu s-a putut încărca soldul disponibil. Verifică configurația Smart Fintech.',
      error: error.message
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
