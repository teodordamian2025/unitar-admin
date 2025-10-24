// ==================================================================
// SCRIPT: fix-timetracking-names.js
// DATA: 24.10.2025
// DESCRIERE: Corectează înregistrările TimeTracking_v2 cu "Utilizator Normal"
//            cu numele real din Utilizatori_v2 (Nume Prenume)
// ==================================================================

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config({ path: '.env.local' });

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

console.log(`🔧 Fix TimeTracking Names - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);
console.log(`📊 Using tables: TimeTracking${tableSuffix}, Utilizatori${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

async function fixTimeTrackingNames() {
  try {
    console.log('\n=================================================================');
    console.log('🔍 VERIFICARE ÎNREGISTRĂRI CU "Utilizator Normal"');
    console.log('=================================================================\n');

    // 1. Verificare câte înregistrări au "Utilizator Normal"
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_TIME_TRACKING}
      WHERE utilizator_nume = 'Utilizator Normal'
    `;

    console.log('📊 Numărare înregistrări cu "Utilizator Normal"...');
    const [countRows] = await bigquery.query({
      query: countQuery,
      location: 'EU',
    });

    const totalToFix = parseInt(countRows[0].total);
    console.log(`✅ Găsite ${totalToFix} înregistrări cu "Utilizator Normal"\n`);

    if (totalToFix === 0) {
      console.log('✨ Nu există înregistrări de corectat. Script finalizat!');
      return;
    }

    // 2. Afișează câteva exemple înainte de update
    const sampleQuery = `
      SELECT
        tt.id,
        tt.utilizator_uid,
        tt.utilizator_nume as nume_vechi,
        CONCAT(u.nume, ' ', u.prenume) as nume_nou,
        tt.data_lucru,
        tt.ore_lucrate,
        tt.descriere_lucru
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
      WHERE tt.utilizator_nume = 'Utilizator Normal'
      LIMIT 5
    `;

    console.log('📋 Exemple de înregistrări care vor fi corectate:');
    console.log('--------------------------------------------------');
    const [sampleRows] = await bigquery.query({
      query: sampleQuery,
      location: 'EU',
    });

    sampleRows.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   UID: ${row.utilizator_uid}`);
      console.log(`   Nume vechi: "${row.nume_vechi}"`);
      console.log(`   Nume nou: "${row.nume_nou}"`);
      console.log(`   Data: ${row.data_lucru?.value || row.data_lucru}`);
      console.log(`   Ore: ${row.ore_lucrate}`);
    });

    console.log('\n=================================================================');
    console.log('🔧 ÎNCEPERE UPDATE');
    console.log('=================================================================\n');

    // 3. UPDATE cu MERGE pentru a corecta numele
    const updateQuery = `
      MERGE ${TABLE_TIME_TRACKING} AS tt
      USING ${TABLE_UTILIZATORI} AS u
      ON tt.utilizator_uid = u.uid
      WHEN MATCHED AND tt.utilizator_nume = 'Utilizator Normal' THEN
        UPDATE SET
          utilizator_nume = CONCAT(u.nume, ' ', u.prenume)
    `;

    console.log('⚙️  Executare UPDATE query...');
    console.log('📝 Query:', updateQuery.substring(0, 200) + '...\n');

    const [job] = await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('✅ UPDATE executat cu succes!\n');

    // 4. Verificare după update
    const verifyCountQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_TIME_TRACKING}
      WHERE utilizator_nume = 'Utilizator Normal'
    `;

    console.log('🔍 Verificare rezultate după update...');
    const [verifyRows] = await bigquery.query({
      query: verifyCountQuery,
      location: 'EU',
    });

    const remainingIncorrect = parseInt(verifyRows[0].total);

    console.log('\n=================================================================');
    console.log('📊 RAPORT FINAL');
    console.log('=================================================================');
    console.log(`📌 Înregistrări găsite inițial: ${totalToFix}`);
    console.log(`✅ Înregistrări corectate: ${totalToFix - remainingIncorrect}`);
    console.log(`⚠️  Înregistrări rămase cu "Utilizator Normal": ${remainingIncorrect}`);

    if (remainingIncorrect > 0) {
      console.log('\n⚠️  ATENȚIE: Mai există înregistrări necorectate!');
      console.log('Motiv posibil: utilizator_uid nu se găsește în tabela Utilizatori_v2');

      // Verifică care UID-uri nu au match
      const orphanQuery = `
        SELECT DISTINCT tt.utilizator_uid, COUNT(*) as count
        FROM ${TABLE_TIME_TRACKING} tt
        LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
        WHERE tt.utilizator_nume = 'Utilizator Normal'
          AND u.uid IS NULL
        GROUP BY tt.utilizator_uid
      `;

      const [orphanRows] = await bigquery.query({
        query: orphanQuery,
        location: 'EU',
      });

      if (orphanRows.length > 0) {
        console.log('\n❌ UID-uri fără corespondent în Utilizatori_v2:');
        orphanRows.forEach(row => {
          console.log(`   - ${row.utilizator_uid}: ${row.count} înregistrări`);
        });
      }
    } else {
      console.log('\n🎉 TOATE ÎNREGISTRĂRILE AU FOST CORECTATE CU SUCCES!');
    }

    // 5. Afișează câteva exemple după update
    const sampleAfterQuery = `
      SELECT
        id,
        utilizator_uid,
        utilizator_nume,
        data_lucru,
        ore_lucrate,
        tip_inregistrare
      FROM ${TABLE_TIME_TRACKING}
      WHERE tip_inregistrare = 'manual'
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('\n📋 Exemple de înregistrări manuale după corecție:');
    console.log('--------------------------------------------------');
    const [sampleAfterRows] = await bigquery.query({
      query: sampleAfterQuery,
      location: 'EU',
    });

    sampleAfterRows.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   UID: ${row.utilizator_uid}`);
      console.log(`   Nume: "${row.utilizator_nume}"`);
      console.log(`   Data: ${row.data_lucru?.value || row.data_lucru}`);
      console.log(`   Ore: ${row.ore_lucrate}`);
    });

    console.log('\n=================================================================');
    console.log('✅ SCRIPT FINALIZAT CU SUCCES!');
    console.log('=================================================================\n');

  } catch (error) {
    console.error('\n❌ EROARE LA EXECUTAREA SCRIPTULUI:');
    console.error(error);
    process.exit(1);
  }
}

// Rulează scriptul
console.log('\n🚀 START SCRIPT: Fix TimeTracking Names');
console.log('Data: ' + new Date().toLocaleString('ro-RO'));
console.log('');

fixTimeTrackingNames()
  .then(() => {
    console.log('🎉 Script finalizat cu succes!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script eșuat:', error);
    process.exit(1);
  });
