#!/usr/bin/env node
/**
 * ==========================================
 * DIAGNOSTIC COMPLET TOKEN ANAF
 * ==========================================
 * Verifică starea token-ului ANAF și testează conexiunea
 */

const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Funcție decriptare (exact ca în cod - FIXED version)
function decryptToken(encryptedToken) {
  try {
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('Invalid encryption key - trebuie să fie 64 caractere hex');
    }

    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format - missing IV separator');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Eroare decriptare:', error.message);
    throw error; // Re-throw pentru debugging
  }
}

async function main() {
  console.log('🔍 DIAGNOSTIC COMPLET TOKEN ANAF\n');
  console.log('='.repeat(60));

  // PAS 1: Verifică environment variables
  console.log('\n📋 PAS 1: Verificare Environment Variables');
  console.log('─'.repeat(60));

  const envVars = {
    'ANAF_CLIENT_ID': process.env.ANAF_CLIENT_ID?.substring(0, 20) + '...',
    'ANAF_CLIENT_SECRET': process.env.ANAF_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
    'ANAF_TOKEN_ENCRYPTION_KEY': process.env.ANAF_TOKEN_ENCRYPTION_KEY?.length === 64 ? '✓ Valid (64 chars)' : '✗ Invalid',
    'ANAF_OAUTH_BASE': process.env.ANAF_OAUTH_BASE,
    'ANAF_API_BASE': process.env.ANAF_API_BASE,
    'UNITAR_CUI': process.env.UNITAR_CUI,
  };

  console.table(envVars);

  // PAS 2: Verifică token-urile din BigQuery
  console.log('\n📊 PAS 2: Interogare Token-uri din BigQuery');
  console.log('─'.repeat(60));

  const query = `
    SELECT
      id,
      client_id,
      SUBSTRING(access_token, 1, 50) as access_token_preview,
      SUBSTRING(refresh_token, 1, 50) as refresh_token_preview,
      expires_at,
      TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), DAY) as days_until_expiry,
      TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), HOUR) as hours_until_expiry,
      is_active,
      data_creare,
      data_actualizare,
      CASE
        WHEN expires_at < CURRENT_TIMESTAMP() THEN 'EXPIRED'
        WHEN TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), DAY) < 7 THEN 'EXPIRING_SOON'
        ELSE 'VALID'
      END as status
    FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
    ORDER BY data_creare DESC
    LIMIT 5
  `;

  try {
    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      console.log('❌ NU EXISTĂ TOKEN-URI ÎN BAZA DE DATE!');
      console.log('   → Trebuie să autorizezi aplicația din /admin/anaf/setup');
      process.exit(1);
    }

    console.log(`✅ Găsite ${rows.length} token-uri:\n`);

    rows.forEach((token, index) => {
      const daysLeft = parseInt(token.days_until_expiry);
      const hoursLeft = parseInt(token.hours_until_expiry);
      const isExpired = token.status === 'EXPIRED';
      const statusEmoji = isExpired ? '🔴' : (token.status === 'EXPIRING_SOON' ? '🟡' : '🟢');

      console.log(`${statusEmoji} Token #${index + 1}:`);
      console.log(`   ID: ${token.id}`);
      console.log(`   Client ID: ${token.client_id.substring(0, 20)}...`);
      console.log(`   Access Token (preview): ${token.access_token_preview}...`);
      console.log(`   Refresh Token (preview): ${token.refresh_token_preview}...`);
      console.log(`   Expires At: ${token.expires_at.value || token.expires_at}`);
      console.log(`   Time Left: ${daysLeft} zile, ${hoursLeft % 24} ore`);
      console.log(`   Status: ${token.status} (is_active: ${token.is_active})`);
      console.log(`   Created: ${token.data_creare.value || token.data_creare}`);
      console.log(`   Updated: ${token.data_actualizare.value || token.data_actualizare}`);
      console.log('');
    });

    // PAS 3: Testează decriptarea (cu token-ul COMPLET din BigQuery)
    console.log('\n🔐 PAS 3: Testare Decriptare Token');
    console.log('─'.repeat(60));

    const activeToken = rows.find(r => r.is_active) || rows[0];

    if (!activeToken) {
      console.log('❌ Nu există token activ!');
      process.exit(1);
    }

    console.log(`Testez decriptarea pentru token ID: ${activeToken.id}\n`);

    // Fetch complete token from BigQuery (nu doar preview)
    const completeTokenQuery = `
      SELECT access_token, refresh_token
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE id = @tokenId
    `;

    const [completeTokenRows] = await bigquery.query({
      query: completeTokenQuery,
      params: { tokenId: activeToken.id },
      location: 'EU'
    });

    if (completeTokenRows.length === 0) {
      console.log('❌ Nu am putut prelua token-ul complet!');
      process.exit(1);
    }

    const fullToken = completeTokenRows[0];

    try {
      const decryptedAccess = decryptToken(fullToken.access_token);
      console.log('✅ Access Token decriptat cu succes!');
      console.log(`   Length: ${decryptedAccess.length} chars`);
      console.log(`   Preview: ${decryptedAccess.substring(0, 50)}...`);
      console.log(`   Format: ${decryptedAccess.startsWith('ey') ? 'JWT Token' : 'Standard Bearer Token'}`);
    } catch (error) {
      console.log('❌ Decriptare access_token EȘUATĂ!');
      console.log(`   Error: ${error.message}`);
      console.log('   → Verifică ANAF_TOKEN_ENCRYPTION_KEY în .env.local');
      process.exit(1);
    }

    // PAS 4: Verifică query-ul folosit în upload-invoice
    console.log('\n🔍 PAS 4: Simulare Query din upload-invoice');
    console.log('─'.repeat(60));

    const uploadQuery = `
      SELECT access_token, expires_at
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE is_active = true
        AND expires_at > CURRENT_TIMESTAMP()
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    console.log('Query rulat de upload-invoice:\n');
    console.log(uploadQuery);
    console.log('\nResultat:');

    const [uploadRows] = await bigquery.query({ query: uploadQuery, location: 'EU' });

    if (uploadRows.length === 0) {
      console.log('\n🔴 PROBLEMA GĂSITĂ! Query-ul returnează 0 rezultate!');
      console.log('   Cauze posibile:');
      console.log('   1. ✗ Nici un token cu is_active = TRUE');
      console.log('   2. ✗ TOATE token-urile au expirat (expires_at < CURRENT_TIMESTAMP())');
      console.log('\n💡 SOLUȚIE: Trebuie să reautorizezi aplicația la ANAF!');
      console.log('   → Du-te la https://admin.unitarproiect.eu/admin/anaf/setup');
      console.log('   → Click "Autorizează cu ANAF"');
      console.log('   → Selectează certificatul digital');
      process.exit(1);
    }

    console.log('✅ Query-ul returnează 1 token valid!\n');

    const validToken = uploadRows[0];
    const expiresAt = new Date(validToken.expires_at.value || validToken.expires_at);
    const now = new Date();
    const hoursUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60));

    console.log(`   Expires at: ${expiresAt.toISOString()}`);
    console.log(`   Time until expiry: ${hoursUntilExpiry} ore (${Math.floor(hoursUntilExpiry / 24)} zile)`);

    // PAS 5: Test API ANAF cu token-ul
    console.log('\n🌐 PAS 5: Test Conexiune ANAF API');
    console.log('─'.repeat(60));

    console.log('⚠️  ATENȚIE: Pentru test complet cu API ANAF, rulează:');
    console.log('   node scripts/test-anaf-connection.js');

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLET!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ EROARE la interogare BigQuery:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
