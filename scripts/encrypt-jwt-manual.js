// ==================================================================
// SCRIPT: Manual JWT Encryption cu Buffer.concat (COD CORECT)
// ==================================================================
//
// SCOP: Criptează JWT plain cu AES-256-CBC folosind pattern-ul corect
//       pentru a fixa token-ul corupt din BigQuery
//
// UTILIZARE:
//   node scripts/encrypt-jwt-manual.js <JWT_PLAIN>
//
// EXEMPLU:
//   node scripts/encrypt-jwt-manual.js "eyJhbGciOiJSUzI1NiI..."
//
// OUTPUT:
//   - Token criptat în format: IV:encrypted
//   - SQL UPDATE command pentru BigQuery
// ==================================================================

const crypto = require('crypto');

// Encryption key din .env.local (Vercel)
const ENCRYPTION_KEY = '599aba34872cd6c46e44dfecea4544ba8aa4cbb5522331e0e23e16293823a8bb';

function encryptJWT(plainJWT) {
  try {
    // Validare input
    if (!plainJWT || typeof plainJWT !== 'string') {
      throw new Error('JWT plain is required');
    }

    if (!plainJWT.startsWith('eyJ')) {
      console.warn('⚠️  WARNING: JWT token usually starts with "eyJ" (base64-encoded JSON)');
      console.warn('   Your input starts with:', plainJWT.substring(0, 10));
      console.warn('   Are you sure this is a valid JWT?');
    }

    console.log('🔐 ENCRYPTION cu AES-256-CBC + Buffer.concat (COD CORECT)\n');
    console.log('📝 Input JWT length:', plainJWT.length, 'characters');
    console.log('📝 Input preview:', plainJWT.substring(0, 50) + '...\n');

    // Convert key to Buffer
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: ${keyBuffer.length} bytes (expected 32 for AES-256)`);
    }

    // Generate random IV (16 bytes for AES-256-CBC)
    const iv = crypto.randomBytes(16);
    console.log('🔑 Generated IV:', iv.toString('hex'));
    console.log('🔑 Key length:', keyBuffer.length, 'bytes (32 = AES-256) ✅\n');

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

    // Encrypt using Buffer.concat (CORRECT PATTERN)
    const encrypted = Buffer.concat([
      cipher.update(plainJWT, 'utf8'),
      cipher.final()
    ]);

    // Format: IV:encrypted (both in hex)
    const encryptedToken = iv.toString('hex') + ':' + encrypted.toString('hex');

    console.log('✅ ENCRYPTION SUCCESS!\n');
    console.log('📦 Encrypted token length:', encryptedToken.length, 'characters');
    console.log('📦 Format: IV (32 hex) : encrypted data (hex)');
    console.log('📦 IV length:', iv.toString('hex').length, 'hex chars (16 bytes)');
    console.log('📦 Encrypted data length:', encrypted.toString('hex').length, 'hex chars\n');

    // Test decryption pentru verificare
    console.log('🧪 VERIFICATION: Testing decryption...\n');
    const parts = encryptedToken.split(':');
    const ivTest = Buffer.from(parts[0], 'hex');
    const encryptedDataTest = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivTest);
    const decrypted = Buffer.concat([
      decipher.update(encryptedDataTest),
      decipher.final()
    ]);
    const decryptedText = decrypted.toString('utf8');

    if (decryptedText === plainJWT) {
      console.log('✅ VERIFICATION PASSED: Decryption matches original JWT!');
      console.log('✅ Decrypted length:', decryptedText.length);
      console.log('✅ Starts with eyJ:', decryptedText.startsWith('eyJ') ? 'YES ✅' : 'NO ❌');
    } else {
      console.error('❌ VERIFICATION FAILED: Decryption does NOT match!');
      process.exit(1);
    }

    return encryptedToken;

  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    process.exit(1);
  }
}

// ==================================================================
// MAIN
// ==================================================================

console.log('═'.repeat(70));
console.log('  MANUAL JWT ENCRYPTION - FIX ANAF TOKEN CORRUPTION');
console.log('═'.repeat(70));
console.log();

// Get JWT from command line argument
const jwtPlain = process.argv[2];

if (!jwtPlain) {
  console.error('❌ ERROR: JWT plain token is required\n');
  console.log('USAGE:');
  console.log('  node scripts/encrypt-jwt-manual.js "<JWT_TOKEN>"\n');
  console.log('EXAMPLE:');
  console.log('  node scripts/encrypt-jwt-manual.js "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."\n');
  console.log('WHERE TO GET JWT:');
  console.log('  1. Re-autorizează OAuth ANAF');
  console.log('  2. Check Vercel logs pentru: 🔓🔓🔓 JWT PLAIN ACCESS TOKEN');
  console.log('  3. Copiază JWT-ul complet (fără quotes)');
  console.log('  4. Run acest script cu JWT-ul ca argument\n');
  process.exit(1);
}

// Encrypt JWT
const encryptedToken = encryptJWT(jwtPlain);

// Print results
console.log('\n' + '═'.repeat(70));
console.log('  REZULTATE FINALE');
console.log('═'.repeat(70));
console.log();
console.log('📋 ENCRYPTED TOKEN (pentru BigQuery):');
console.log(encryptedToken);
console.log();
console.log('📋 SQL UPDATE COMMAND (copy-paste în BigQuery Console):');
console.log();
console.log('UPDATE `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`');
console.log(`SET access_token = '${encryptedToken}',`);
console.log('    data_actualizare = CURRENT_TIMESTAMP()');
console.log('WHERE is_active = true;');
console.log();
console.log('═'.repeat(70));
console.log('  NEXT STEPS');
console.log('═'.repeat(70));
console.log();
console.log('1. ✅ Copiază SQL UPDATE command de mai sus');
console.log('2. ✅ Mergi în BigQuery Console');
console.log('3. ✅ Paste și RUN query-ul');
console.log('4. ✅ Verifică: 1 row updated');
console.log('5. ✅ Test upload factură → SUCCESS! 🎉');
console.log('6. ✅ REVERT commit cu log JWT (securitate!)');
console.log();
console.log('═'.repeat(70));
console.log();
