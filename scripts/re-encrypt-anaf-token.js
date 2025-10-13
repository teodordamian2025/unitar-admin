// ==================================================================
// SCRIPT: Re-criptare token ANAF cu key-ul corect din Vercel
// ==================================================================

require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Funcție decriptare cu OLD KEY (din .env.local vechi)
function decryptWithOldKey(encryptedToken, oldKey) {
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(oldKey, 'hex'), iv);

    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Funcție criptare cu NEW KEY (din .env.local curent)
function encryptWithNewKey(plainToken, newKey) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(newKey, 'hex'), iv);

    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

async function reEncryptToken() {
  try {
    console.log('🔧 Re-criptare token ANAF...\n');

    // 1. Citește OLD KEY din argumentele scriptului sau prompt
    const oldKey = process.argv[2];
    const newKey = process.env.ANAF_TOKEN_ENCRYPTION_KEY;

    if (!oldKey) {
      console.error('❌ ERROR: Trebuie să furnizezi OLD_KEY ca argument!');
      console.log('\nUtilizare:');
      console.log('node scripts/re-encrypt-anaf-token.js <OLD_ENCRYPTION_KEY_64_HEX>\n');
      process.exit(1);
    }

    if (!newKey || newKey.length !== 64) {
      console.error('❌ ERROR: ANAF_TOKEN_ENCRYPTION_KEY lipsește sau invalid în .env.local!');
      process.exit(1);
    }

    console.log('🔑 OLD KEY:', oldKey.substring(0, 20) + '...');
    console.log('🔑 NEW KEY:', newKey.substring(0, 20) + '...');

    // 2. Citește token-ul criptat din BigQuery
    const query = `
      SELECT id, access_token, refresh_token
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE is_active = true
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    console.log('\n📊 Citesc token din BigQuery...');
    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      console.error('❌ Niciun token activ găsit în BigQuery!');
      process.exit(1);
    }

    const tokenRow = rows[0];
    console.log('✅ Token găsit:', tokenRow.id);

    // 3. Decriptează cu OLD KEY
    console.log('\n🔓 Decriptez cu OLD KEY...');
    const accessTokenPlain = decryptWithOldKey(tokenRow.access_token, oldKey);
    const refreshTokenPlain = decryptWithOldKey(tokenRow.refresh_token, oldKey);

    console.log('✅ Access token decriptat:', accessTokenPlain.substring(0, 50) + '...');
    console.log('✅ Refresh token decriptat:', refreshTokenPlain.substring(0, 50) + '...');

    // Verificare format JWT
    if (!accessTokenPlain.startsWith('eyJ')) {
      console.error('❌ WARNING: Access token nu pare JWT (nu începe cu eyJ)!');
      console.log('Token decriptat:', accessTokenPlain.substring(0, 100));
    } else {
      console.log('✅ Access token e JWT valid!');
    }

    // 4. Re-criptează cu NEW KEY
    console.log('\n🔐 Re-criptez cu NEW KEY...');
    const accessTokenEncrypted = encryptWithNewKey(accessTokenPlain, newKey);
    const refreshTokenEncrypted = encryptWithNewKey(refreshTokenPlain, newKey);

    console.log('✅ Access token re-criptat:', accessTokenEncrypted.substring(0, 50) + '...');
    console.log('✅ Refresh token re-criptat:', refreshTokenEncrypted.substring(0, 50) + '...');

    // 5. Update în BigQuery
    console.log('\n💾 Salvez în BigQuery...');
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      SET
        access_token = @accessToken,
        refresh_token = @refreshToken,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @tokenId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        accessToken: accessTokenEncrypted,
        refreshToken: refreshTokenEncrypted,
        tokenId: tokenRow.id
      },
      location: 'EU'
    });

    console.log('✅ Token re-criptat și salvat cu succes!\n');
    console.log('🎯 Acum poți testa upload-ul factură din nou!');

  } catch (error) {
    console.error('❌ Eroare:', error.message);
    process.exit(1);
  }
}

reEncryptToken();
