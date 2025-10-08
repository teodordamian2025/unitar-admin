// =====================================================
// GOOGLE DRIVE API HELPER
// Funcții helper pentru interacțiune cu Google Drive
// Update 08.10.2025: OAuth refresh token pentru cont personal
// =====================================================

import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

/**
 * Obține OAuth client cu refresh token din BigQuery
 */
async function getOAuthClient() {
  // Fetch refresh token din BigQuery
  const [rows] = await bigquery.query({
    query: `
      SELECT refresh_token, access_token, expires_at
      FROM \`PanouControlUnitar.GoogleDriveTokens\`
      WHERE user_email = 'unitarproiect@gmail.com'
        AND activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `,
  });

  if (rows.length === 0) {
    throw new Error(
      'No Google Drive OAuth token found. ' +
      'Please authorize at: ' +
      (process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.unitarproiect.eu') +
      '/api/oauth/google-drive'
    );
  }

  const token = rows[0];
  const decryptedRefreshToken = decryptToken(token.refresh_token);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
  );

  oauth2Client.setCredentials({
    refresh_token: decryptedRefreshToken,
    access_token: token.access_token,
  });

  // Auto-refresh access token când expiră
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      console.log('🔄 Refreshing Google Drive access token...');
      await bigquery.query({
        query: `
          UPDATE \`PanouControlUnitar.GoogleDriveTokens\`
          SET access_token = @access_token,
              expires_at = TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 3600 SECOND)
          WHERE user_email = 'unitarproiect@gmail.com' AND activ = TRUE
        `,
        params: { access_token: tokens.access_token },
      });
    }
  });

  return oauth2Client;
}

/**
 * Decriptează refresh token din BigQuery
 */
function decryptToken(encryptedToken: string): string {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error('Invalid GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (must be 64 hex chars)');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Inițializare client Google Drive cu OAuth refresh token
 */
export async function getDriveClient() {
  const auth = await getOAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Găsește folder după nume în parent folder
 */
export async function findFolder(folderName: string, parentId?: string) {
  const drive = await getDriveClient();

  const query = parentId
    ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  console.log(`🔍 Searching for folder: "${folderName}"${parentId ? ` in parent ${parentId}` : ''}`);
  console.log(`📝 Query: ${query}`);

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  console.log(`📂 Found ${response.data.files?.length || 0} folders matching query`);

  return response.data.files?.[0] || null;
}

/**
 * Creează folder nou (sau returnează ID dacă există deja)
 */
export async function createFolder(folderName: string, parentId?: string) {
  const drive = await getDriveClient();

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
  const drive = await getDriveClient();

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
  const drive = await getDriveClient();

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
  const drive = await getDriveClient();

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
  const drive = await getDriveClient();
  await drive.files.delete({ fileId });
  console.log(`🗑️ Fișier ${fileId} șters din Google Drive`);
}

/**
 * Obține metadata fișier
 */
export async function getFileMetadata(fileId: string) {
  const drive = await getDriveClient();

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
