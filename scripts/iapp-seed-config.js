// ==================================================================
// SCRIPT: Seed configurare iapp.ro în BigQuery
// RUN: node scripts/iapp-seed-config.js
// ==================================================================

const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Funcție de criptare (aceeași cu ANAF)
function encryptValue(value) {
  const key = process.env.IAPP_ENCRYPTION_KEY || process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key - set IAPP_ENCRYPTION_KEY in .env.local');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function seedIappConfig() {
  console.log('🔧 Seeding iapp.ro configuration...\n');

  // Credențiale primite de la iapp.ro
  const COD_FIRMA = '39136-33663-6A368-36135-43623-68367-36136-83613-6A367-36536-2';
  const PAROLA = 'HDqtgdLelycbn.UCE41pPO9;N';
  const EMAIL = 'contact@unitarproiect.eu';

  try {
    // Criptează credențialele
    const encryptedCodFirma = encryptValue(COD_FIRMA);
    const encryptedParola = encryptValue(PAROLA);

    console.log('✅ Credențiale criptate cu succes');
    console.log('   Cod firmă encrypted length:', encryptedCodFirma.length);
    console.log('   Parolă encrypted length:', encryptedParola.length);
    console.log();

    // Verifică dacă există deja configurare
    const checkQuery = `
      SELECT id FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      WHERE activ = TRUE
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({ query: checkQuery, location: 'EU' });

    if (existingRows.length > 0) {
      console.log('⚠️  Configurare iapp.ro deja există!');
      console.log('   ID:', existingRows[0].id);
      console.log();
      console.log('💡 Pentru a actualiza, rulează:');
      console.log('   UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`');
      console.log('   SET cod_firma = "' + encryptedCodFirma + '",');
      console.log('       parola_api = "' + encryptedParola + '",');
      console.log('       data_actualizare = CURRENT_TIMESTAMP()');
      console.log('   WHERE id = "' + existingRows[0].id + '";');
      return;
    }

    // Inserează configurare nouă
    const configRecord = [{
      id: crypto.randomUUID(),
      cod_firma: encryptedCodFirma,
      parola_api: encryptedParola,
      email_responsabil: EMAIL,
      activ: true,
      tip_facturare: 'iapp',
      auto_transmite_efactura: true,
      serie_default: 'SERIE_TEST',
      moneda_default: 'RON',
      footer_intocmit_name: 'Administrator UNITAR',
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      creat_de: 'script_seed',
      actualizat_de: 'script_seed'
    }];

    await bigquery.dataset(DATASET).table('IappConfig_v2').insert(configRecord);

    console.log('✅ Configurare iapp.ro seed-uită cu succes!');
    console.log('   ID:', configRecord[0].id);
    console.log('   Email responsabil:', EMAIL);
    console.log('   Serie default:', configRecord[0].serie_default);
    console.log('   Auto transmite e-Factura:', configRecord[0].auto_transmite_efactura);
    console.log();
    console.log('🎉 GATA! Poți folosi API-ul /api/iapp/emit-invoice');

  } catch (error) {
    console.error('❌ Eroare seed configurare:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Rulează seed
seedIappConfig();
