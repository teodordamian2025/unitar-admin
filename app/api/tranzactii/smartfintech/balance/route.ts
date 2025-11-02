// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/balance/route.ts
// DATA: 02.11.2025 (ora României)
// DESCRIERE: API pentru extragere sold disponibil din Smart Fintech
// FUNCȚIONALITATE: GET - returnează sold total din toate conturile
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import {
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
        token_expires_at,
        is_active
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery });

    if (configRows.length === 0) {
      console.error('❌ [Balance] No active Smart Fintech configuration found');
      return NextResponse.json(
        {
          success: false,
          error: 'Smart Fintech nu este configurat. Mergi la Setări → Smart Fintech API.',
          balance: null,
        },
        { status: 404 }
      );
    }

    const config = configRows[0];

    // 2. Decrypt credentials și tokens
    const credentials: SmartFintechCredentials = {
      client_id: config.client_id,
      client_secret: decryptToken(config.client_secret),
    };

    let tokens: SmartFintechTokens = {
      access_token: config.access_token ? decryptToken(config.access_token) : '',
      refresh_token: config.refresh_token ? decryptToken(config.refresh_token) : '',
      expires_at: config.token_expires_at || 0,
    };

    // Dacă nu avem token valid, returnăm eroare
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('❌ [Balance] No valid tokens found. Need to authenticate first.');
      return NextResponse.json(
        {
          success: false,
          error: 'Token-uri expirate. Mergi la Setări → Smart Fintech API și reconectează.',
          balance: null,
        },
        { status: 401 }
      );
    }

    // 3. Fetch accounts cu token refresh automat
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
            token_expires_at = @expires_at,
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

    // 4. Calculate total balance (sumă RON + conversie pentru alte valute)
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

    // 5. Update ultima_sincronizare în BigQuery
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

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Eroare la extragerea soldului disponibil',
        balance: null,
      },
      { status: 500 }
    );
  }
}
