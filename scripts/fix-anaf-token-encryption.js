// ==================================================================
// SCRIPT: Fix ANAF token encryption - re-criptare cu key corect
// ==================================================================

require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const { BigQuery } = require('@google-cloud/bigquery');
const readline = require('readline');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Funcție criptare cu NEW KEY
function encryptWithKey(plainToken, key) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

async function fixTokenEncryption() {
  try {
    console.log('🔧 Fix ANAF Token Encryption\n');

    const newKey = process.env.ANAF_TOKEN_ENCRYPTION_KEY;

    if (!newKey || newKey.length !== 64) {
      console.error('❌ ERROR: ANAF_TOKEN_ENCRYPTION_KEY lipsește sau invalid în .env.local!');
      console.error('   Key length:', newKey?.length || 0, '(trebuie să fie 64)');
      process.exit(1);
    }

    console.log('🔑 NEW KEY (din .env.local):', newKey.substring(0, 20) + '...\n');

    // 1. Citește token-ul din BigQuery
    const query = `
      SELECT id, access_token, refresh_token
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE is_active = true
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    console.log('📊 Citesc token din BigQuery...');
    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      console.error('❌ Niciun token activ găsit în BigQuery!');
      process.exit(1);
    }

    const tokenRow = rows[0];
    console.log('✅ Token găsit:', tokenRow.id);
    console.log('📦 Access token preview:', tokenRow.access_token.substring(0, 50) + '...');
    console.log('📦 Access token length:', tokenRow.access_token.length);
    console.log('📦 Contains IV separator (:):', tokenRow.access_token.includes(':') ? 'YES' : 'NO\n');

    // 2. Prompt user pentru JWT token plain
    console.log('\n🔍 OPȚIUNI:');
    console.log('1. Token-ul din BigQuery pare criptat (193 chars cu :)');
    console.log('2. Dar decriptarea returnează doar 64 chars hex');
    console.log('3. Asta înseamnă că token-ul e criptat cu ALT KEY\n');

    console.log('📋 SOLUȚIA: Trebuie să furnizezi JWT-ul plain (necriptat)');
    console.log('   Unde găsești JWT-ul:');
    console.log('   - Din browser DevTools când te-ai autentificat ultima dată');
    console.log('   - Sau din backup vechi .env.local');
    console.log('   - Sau din logs Vercel când a fost generat token-ul\n');

    const plainAccessToken = await question('📝 Introdu access_token JWT plain (începe cu eyJ...): ');

    if (!plainAccessToken || !plainAccessToken.startsWith('eyJ')) {
      console.error('\n❌ ERROR: Token-ul trebuie să înceapă cu "eyJ" (JWT format)!');
      rl.close();
      process.exit(1);
    }

    const plainRefreshToken = await question('📝 Introdu refresh_token JWT plain (începe cu eyJ...): ');

    if (!plainRefreshToken || !plainRefreshToken.startsWith('eyJ')) {
      console.error('\n❌ ERROR: Refresh token-ul trebuie să înceapă cu "eyJ" (JWT format)!');
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ JWT tokens received:');
    console.log('   Access token:', plainAccessToken.substring(0, 50) + '...');
    console.log('   Refresh token:', plainRefreshToken.substring(0, 50) + '...');

    // 3. Criptează cu NEW KEY
    console.log('\n🔐 Criptez cu NEW KEY...');
    const accessTokenEncrypted = encryptWithKey(plainAccessToken, newKey);
    const refreshTokenEncrypted = encryptWithKey(plainRefreshToken, newKey);

    console.log('✅ Access token re-criptat:', accessTokenEncrypted.substring(0, 50) + '...');
    console.log('✅ Refresh token re-criptat:', refreshTokenEncrypted.substring(0, 50) + '...');

    // 4. Confirmă update
    const confirm = await question('\n⚠️  Vrei să salvezi în BigQuery? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Anulat de user.');
      rl.close();
      process.exit(0);
    }

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
    console.log('   Logs Vercel ar trebui să arate: "✅ Decrypted token preview: eyJ..."\n');

    rl.close();

  } catch (error) {
    console.error('❌ Eroare:', error.message);
    rl.close();
    process.exit(1);
  }
}

fixTokenEncryption();
