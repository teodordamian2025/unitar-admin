// =====================================================
// TEST ROUTE: Google Drive Upload
// Verifică dacă Google Drive API funcționează
// URL: /api/test/google-drive
// Data: 08.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getRootFacturiFolder,
  getMonthFolder,
  uploadFile,
  listFiles,
} from '@/lib/google-drive-helper';

export async function GET(req: NextRequest) {
  try {
    const results: any = {
      success: true,
      tests: [],
    };

    // Test 1: Găsește folder rădăcină
    console.log('1️⃣ Găsesc folder rădăcină "Facturi Primite ANAF"...');
    const rootFolderId = await getRootFacturiFolder();
    results.tests.push({
      name: 'Find root folder',
      status: 'success',
      data: { rootFolderId },
    });

    // Test 2: Creează folder 2025/10
    console.log('2️⃣ Creez folder 2025/10...');
    const monthFolderId = await getMonthFolder(2025, 10);
    results.tests.push({
      name: 'Create/find month folder 2025/10',
      status: 'success',
      data: { monthFolderId },
    });

    // Test 3: Upload fișier test
    console.log('3️⃣ Upload fișier test...');
    const testContent = `Test upload Google Drive - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');

    const uploadResult = await uploadFile(
      `test-upload-${Date.now()}.txt`,
      testBuffer,
      'text/plain',
      monthFolderId
    );

    results.tests.push({
      name: 'Upload test file',
      status: 'success',
      data: uploadResult,
    });

    // Test 4: Listează fișiere
    console.log('4️⃣ Listez fișiere din folder 2025/10...');
    const files = await listFiles(monthFolderId);
    results.tests.push({
      name: 'List files in folder',
      status: 'success',
      data: {
        total_files: files.length,
        files: files.map(f => ({
          name: f.name,
          id: f.id,
          mimeType: f.mimeType,
          createdTime: f.createdTime,
        })),
      },
    });

    results.message = '🎉 Toate testele au trecut cu succes! Google Drive API este funcțional.';

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    console.error('❌ Eroare la testare Google Drive:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
        troubleshooting: [
          '1. Verifică că Google Drive API este enabled în GCP Console',
          '2. Verifică că folder "Facturi Primite ANAF" există în Google Drive',
          '3. Verifică că service account are permisiuni Editor pe folder',
          '4. Verifică variabilele .env.local (GOOGLE_CLOUD_*)',
        ],
      },
      { status: 500 }
    );
  }
}
