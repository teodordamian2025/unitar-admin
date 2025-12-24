/**
 * Script pentru corectarea CUI-ului Electromontaj S.A. în TranzactiiBancare_v2
 * Problema: Tranzacțiile au CUI-uri greșite (929827049, 929058363) în loc de 566
 *
 * Rulare: node scripts/fix-electromontaj-cui.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config({ path: '.env.local' });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const CUI_CORECT = '566';

async function main() {
  console.log('🔍 Căutare tranzacții Electromontaj cu CUI incorect...\n');

  // 1. Găsește tranzacțiile de încasări (intrare) de la Electromontaj
  const findQuery = `
    SELECT id, nume_contrapartida, cui_contrapartida, suma, data_procesare, directie
    FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
    WHERE LOWER(nume_contrapartida) LIKE '%electromontaj%'
      AND directie = 'intrare'
    ORDER BY data_procesare DESC
  `;

  const [rows] = await bigquery.query({ query: findQuery, location: 'EU' });

  console.log(`📊 Găsite ${rows.length} tranzacții de încasări de la Electromontaj:\n`);

  let toUpdate = [];
  for (const row of rows) {
    const dataProcesare = row.data_procesare?.value || row.data_procesare;
    const cuiActual = row.cui_contrapartida || 'NULL';
    const needsUpdate = cuiActual !== CUI_CORECT;

    console.log(`  ${needsUpdate ? '❌' : '✅'} ${dataProcesare} | ${row.nume_contrapartida}`);
    console.log(`     Suma: ${row.suma} | CUI: ${cuiActual} ${needsUpdate ? `→ ${CUI_CORECT}` : '(OK)'}`);
    console.log(`     ID: ${row.id}\n`);

    if (needsUpdate) {
      toUpdate.push(row.id);
    }
  }

  if (toUpdate.length === 0) {
    console.log('✅ Toate tranzacțiile au deja CUI-ul corect (566). Nimic de actualizat.');
    return;
  }

  console.log(`\n🔧 ${toUpdate.length} tranzacții necesită actualizare CUI → ${CUI_CORECT}\n`);

  // 2. Actualizare CUI
  const updateQuery = `
    UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
    SET cui_contrapartida = '${CUI_CORECT}',
        data_actualizare = CURRENT_TIMESTAMP()
    WHERE id IN UNNEST(@ids)
  `;

  console.log('⏳ Executare UPDATE...');

  const [job] = await bigquery.createQueryJob({
    query: updateQuery,
    params: { ids: toUpdate },
    location: 'EU'
  });

  const [result] = await job.getQueryResults();

  console.log(`\n✅ UPDATE executat cu succes!`);
  console.log(`   Tranzacții actualizate: ${toUpdate.length}`);
  console.log(`   CUI nou: ${CUI_CORECT}`);

  // 3. Verificare
  console.log('\n🔍 Verificare după actualizare...\n');

  const verifyQuery = `
    SELECT id, nume_contrapartida, cui_contrapartida, suma, data_procesare
    FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
    WHERE id IN UNNEST(@ids)
  `;

  const [verified] = await bigquery.query({
    query: verifyQuery,
    params: { ids: toUpdate },
    location: 'EU'
  });

  for (const row of verified) {
    const dataProcesare = row.data_procesare?.value || row.data_procesare;
    console.log(`  ✅ ${dataProcesare} | CUI: ${row.cui_contrapartida} | ${row.nume_contrapartida}`);
  }

  console.log('\n🎉 Corectare finalizată cu succes!');
}

main().catch(err => {
  console.error('❌ Eroare:', err);
  process.exit(1);
});
