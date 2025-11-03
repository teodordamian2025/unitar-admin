// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/balance/route.ts
// DATA: 02.11.2025 (ora României)
// MODIFICAT: 03.11.2025 - FIX: Adăugată verificare expirare token + fallback la client_credentials
// DESCRIERE: API pentru extragere sold disponibil din Smart Fintech
// FUNCȚIONALITATE: GET - returnează sold total din toate conturile
// FIX: Copiază pattern din sync/route.ts pentru token management robust
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
  authenticateSmartFintech,
  getSmartFintechAccounts,
  withTokenRefresh,
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
    console.log('💰 [Balance] Fetching available balance from Smart Fintech...');

    // 1. Încarcă configurația activă din BigQuery
    const configQuery = `
      SELECT
        id,
        client_id,
        client_secret,
        access_token,
        refresh_token,
        expires_at,
        is_active
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery });

    if (configRows.length === 0) {
      console.warn('⚠️ [Balance] No active Smart Fintech configuration found. Card will not be displayed.');
      return NextResponse.json({
        success: true,
        balance: null,
        message: 'Smart Fintech nu este configurat.',
      });
    }

    const config = configRows[0];

    // 2. Decrypt credentials
    const credentials: SmartFintechCredentials = {
      client_id: config.client_id,
      client_secret: decryptToken(config.client_secret),
    };

    let tokens: SmartFintechTokens;

    // 3. Verificare și refresh tokens (PATTERN IDENTIC CU SYNC) - FIX PRINCIPAL
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

    // 4. Fetch accounts cu token refresh automat (backup layer)
    const accounts = await withTokenRefresh(
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
    );

    console.log(`✅ [Balance] Fetched ${accounts.length} accounts`);

    // 5. Calculate total balance (sumă RON + conversie pentru alte valute)
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

    // 6. Update ultima_sincronizare în BigQuery
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

    return NextResponse.json({
      success: true,
      balance: {
        total: totalBalanceRON,
        currency: 'RON',
        accounts: accountBalances,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [Balance] Error fetching balance:', error);

    // Returnăm success: true cu balance: null pentru a nu afișa cardul, nu eroare
    return NextResponse.json({
      success: true,
      balance: null,
      message: 'Nu s-a putut încărca soldul disponibil. Verifică configurația Smart Fintech.',
    });
  }
}
