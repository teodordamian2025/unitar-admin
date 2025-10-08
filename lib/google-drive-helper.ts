// =====================================================
// GOOGLE DRIVE API HELPER
// Funcții helper pentru interacțiune cu Google Drive
// Data: 08.10.2025
// =====================================================

import { google } from 'googleapis';

/**
 * Inițializare client Google Drive cu service account
 */
export function getDriveClient() {
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!privateKey || !process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
    throw new Error('Missing Google Cloud credentials in .env.local');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Găsește folder după nume în parent folder
 */
export async function findFolder(folderName: string, parentId?: string) {
  const drive = getDriveClient();

  const query = parentId
    ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  return response.data.files?.[0] || null;
}

/**
 * Creează folder nou (sau returnează ID dacă există deja)
 */
export async function createFolder(folderName: string, parentId?: string) {
  const drive = getDriveClient();

  // Verifică dacă există deja
  const existingFolder = await findFolder(folderName, parentId);
  if (existingFolder) {
    console.log(`📁 Folder "${folderName}" există deja (ID: ${existingFolder.id})`);
    return existingFolder.id!;
  }

  // Creează folder nou
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name',
  });

  console.log(`✅ Folder "${folderName}" creat cu succes (ID: ${response.data.id})`);
  return response.data.id!;
}

/**
 * Creează structură folder ierarhică (ex: "Facturi Primite ANAF/2025/10")
 */
export async function createFolderPath(path: string, rootFolderId?: string) {
  const folders = path.split('/').filter(f => f.trim() !== '');
  let currentParentId = rootFolderId;

  for (const folderName of folders) {
    currentParentId = await createFolder(folderName, currentParentId);
  }

  return currentParentId;
}

/**
 * Upload fișier în Google Drive
 */
export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  parentFolderId?: string
) {
  const drive = getDriveClient();

  const fileMetadata: any = {
    name: fileName,
  };

  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const media = {
    mimeType: mimeType,
    body: require('stream').Readable.from(fileBuffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  console.log(`✅ Fișier "${fileName}" uploaded (ID: ${response.data.id})`);

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    webViewLink: response.data.webViewLink,
    downloadLink: response.data.webContentLink,
  };
}

/**
 * Download fișier din Google Drive
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Listează fișiere din folder
 */
export async function listFiles(folderId: string) {
  const drive = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
    orderBy: 'createdTime desc',
  });

  return response.data.files || [];
}

/**
 * Șterge fișier (move to trash)
 */
export async function deleteFile(fileId: string) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
  console.log(`🗑️ Fișier ${fileId} șters din Google Drive`);
}

/**
 * Obține metadata fișier
 */
export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents',
  });

  return response.data;
}

/**
 * Helper: Găsește folder rădăcină "Facturi Primite ANAF"
 */
export async function getRootFacturiFolder() {
  const folder = await findFolder('Facturi Primite ANAF');

  if (!folder) {
    throw new Error(
      'Folder "Facturi Primite ANAF" nu a fost găsit în Google Drive. ' +
      'Te rog să-l creezi manual și să dai permisiuni Editor la service account.'
    );
  }

  return folder.id!;
}

/**
 * Helper: Obține folder pentru an + lună (ex: "2025/10")
 * Creează automat dacă nu există
 */
export async function getMonthFolder(year: number, month: number) {
  const rootFolderId = await getRootFacturiFolder();

  // Creează/găsește folder an
  const yearFolderId = await createFolder(year.toString(), rootFolderId);

  // Creează/găsește folder lună (cu leading zero: "01", "02", etc.)
  const monthStr = month.toString().padStart(2, '0');
  const monthFolderId = await createFolder(monthStr, yearFolderId);

  return monthFolderId;
}
