// =====================================================
// TEST GOOGLE DRIVE UPLOAD
// Verifică dacă Google Drive API funcționează corect
// Data: 08.10.2025
// =====================================================

import {
  getRootFacturiFolder,
  getMonthFolder,
  uploadFile,
  listFiles,
  createFolderPath,
} from '../lib/google-drive-helper';

async function testGoogleDrive() {
  console.log('🔍 Testare Google Drive API...\n');

  try {
    // Test 1: Găsește folder rădăcină
    console.log('1️⃣ Găsesc folder rădăcină "Facturi Primite ANAF"...');
    const rootFolderId = await getRootFacturiFolder();
    console.log(`✅ Găsit: ${rootFolderId}\n`);

    // Test 2: Creează folder 2025/10
    console.log('2️⃣ Creez folder 2025/10...');
    const monthFolderId = await getMonthFolder(2025, 10);
    console.log(`✅ Folder 2025/10 ID: ${monthFolderId}\n`);

    // Test 3: Upload fișier test
    console.log('3️⃣ Upload fișier test...');
    const testContent = `Test upload Google Drive - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');

    const uploadResult = await uploadFile(
      'test-upload.txt',
      testBuffer,
      'text/plain',
      monthFolderId
    );

    console.log(`✅ Fișier uploaded:`, uploadResult);
    console.log(`🔗 Link vizualizare: ${uploadResult.webViewLink}\n`);

    // Test 4: Listează fișiere din folder
    console.log('4️⃣ Listez fișiere din folder 2025/10...');
    const files = await listFiles(monthFolderId);
    console.log(`✅ Găsite ${files.length} fișiere:`);
    files.forEach(file => {
      console.log(`   - ${file.name} (${file.mimeType}) - ${file.id}`);
    });

    console.log('\n🎉 Toate testele au trecut cu succes!');
    console.log('✅ Google Drive API este funcțional și configurată corect.');
    console.log('\n📝 Următorii pași:');
    console.log('   1. Verifică fișierul test în Google Drive');
    console.log('   2. Dacă ai Google Drive Desktop, ar trebui să apară automat în sync');
    console.log('   3. Poți continua cu implementarea API-urilor ANAF');

  } catch (error: any) {
    console.error('\n❌ Eroare la testare Google Drive:', error.message);
    console.error('\n🔧 Verifică:');
    console.error('   1. Google Drive API este enabled în GCP Console');
    console.error('   2. Folder "Facturi Primite ANAF" există în Google Drive');
    console.error('   3. Service account are permisiuni Editor pe folder');
    console.error('   4. Variabilele .env.local sunt corecte (GOOGLE_CLOUD_*)');
    process.exit(1);
  }
}

// Rulează test
testGoogleDrive();
