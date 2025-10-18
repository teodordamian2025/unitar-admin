// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/test/route.ts
// DATA: 18.10.2025 (ora României)
// DESCRIERE: API test conexiune Smart Fintech
// FUNCȚIONALITATE: Test credentials → fetch accounts → return count
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';
import {
  authenticateSmartFintech,
  getSmartFintechAccounts,
  decryptToken
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

// ==================== POST - Test connection ====================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = await getUserIdFromToken(authHeader);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [Test] Loading Smart Fintech credentials...');

    // Load credentials
    const query = `
      SELECT
        client_id,
        client_secret
      FROM \`${PROJECT_ID}.${DATASET}.SmartFintechTokens${tableSuffix}\`
      WHERE is_active = TRUE
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No Smart Fintech configuration found' },
        { status: 404 }
      );
    }

    const config = rows[0];
    const client_id = config.client_id;
    const client_secret = decryptToken(config.client_secret);

    console.log('🔑 [Test] Authenticating...');

    // Authenticate
    const tokens = await authenticateSmartFintech({
      client_id,
      client_secret
    });

    console.log('✅ [Test] Authentication successful');

    // Fetch accounts
    console.log('🏦 [Test] Fetching accounts...');

    const accounts = await getSmartFintechAccounts(tokens.access_token);

    console.log(`✅ [Test] Found ${accounts.length} accounts`);

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      accounts_count: accounts.length,
      accounts: accounts.map(acc => ({
        iban: acc.iban,
        alias: acc.alias,
        bank: acc.bank,
        currency: acc.balance?.currency,
        amount: acc.balance?.amount
      }))
    });

  } catch (error: any) {
    console.error('❌ [Test] Connection test failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Connection test failed'
      },
      { status: 500 }
    );
  }
}
