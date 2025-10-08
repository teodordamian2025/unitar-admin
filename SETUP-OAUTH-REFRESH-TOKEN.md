# 🔑 SETUP: OAuth 2.0 Refresh Token (Cont Personal Google)

**Use Case:** Cont personal Gmail cu storage plătit (Google One 200GB)
**Soluție:** OAuth 2.0 cu refresh token pentru acces permanent la Drive

**Avantaje:**
- ✅ Funcționează cu cont personal (nu necesită Workspace business)
- ✅ Folosește storage-ul tău de 200GB
- ✅ Zero cost adițional
- ✅ Refresh token valabil permanent (până la revocare)

---

## 📋 PAȘI SETUP (15 minute)

### **PASUL 1: Obține OAuth 2.0 Credentials**

1. Deschide [GCP Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Proiect: **hale-mode-464009-i6**
3. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
4. Application type: **"Web application"**
5. Name: `Facturi ANAF OAuth`
6. **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/oauth/callback
   https://admin.unitarproiect.eu/api/oauth/callback
   ```
7. Click **"CREATE"**
8. **Notează:**
   - `Client ID`: ceva gen `123456-abc.apps.googleusercontent.com`
   - `Client Secret`: ceva gen `GOCSPX-xyz123...`

### **PASUL 2: Enable Google Drive API**

1. În GCP Console → [API Library](https://console.cloud.google.com/apis/library)
2. Caută: **"Google Drive API"**
3. Click **"ENABLE"** (dacă nu e deja enabled)

### **PASUL 3: Creează OAuth Flow Endpoint**

Creează fișier: `/app/api/oauth/google-drive/route.ts`

```typescript
// OAuth Flow pentru Google Drive - Step 1: Authorization
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // IMPORTANT: refresh token
    scope: ['https://www.googleapis.com/auth/drive'],
    prompt: 'consent', // Forțează consent screen pentru refresh token
  });

  return NextResponse.redirect(authUrl);
}
```

Creează fișier: `/app/api/oauth/google-drive/callback/route.ts`

```typescript
// OAuth Flow pentru Google Drive - Step 2: Callback
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
    );

    // Exchange code pentru tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token received. Revoke app access and try again.' },
        { status: 400 }
      );
    }

    // Salvează refresh token în BigQuery (encrypted)
    const encryptedToken = encryptToken(tokens.refresh_token);

    await bigquery.query({
      query: `
        INSERT INTO \`PanouControlUnitar.GoogleDriveTokens\` (
          id, user_email, refresh_token, access_token,
          expires_at, data_creare, activ
        ) VALUES (
          GENERATE_UUID(),
          @user_email,
          @refresh_token,
          @access_token,
          TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 3600 SECOND),
          CURRENT_TIMESTAMP(),
          TRUE
        )
      `,
      params: {
        user_email: 'unitarproiect@gmail.com',
        refresh_token: encryptedToken,
        access_token: tokens.access_token || '',
      },
    });

    return NextResponse.json({
      success: true,
      message: '✅ Refresh token salvat! Google Drive API e gata de folosit.',
      token_preview: tokens.refresh_token.substring(0, 20) + '...',
    });

  } catch (error: any) {
    console.error('❌ OAuth callback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Encriptare token (refolosim logica ANAF)
function encryptToken(token: string): string {
  const crypto = require('crypto');
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}
```

### **PASUL 4: Creează Tabel BigQuery pentru Tokens**

```sql
CREATE TABLE `PanouControlUnitar.GoogleDriveTokens` (
  id STRING NOT NULL,
  user_email STRING,
  refresh_token STRING,
  access_token STRING,
  expires_at TIMESTAMP,
  data_creare TIMESTAMP,
  activ BOOLEAN
)
PARTITION BY DATE(data_creare)
CLUSTER BY user_email, activ;
```

### **PASUL 5: Update Google Drive Helper**

Modifică `/lib/google-drive-helper.ts`:

```typescript
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
      'Please authorize: https://admin.unitarproiect.eu/api/oauth/google-drive'
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
 * Inițializare client Google Drive cu OAuth refresh token
 */
export async function getDriveClient() {
  const auth = await getOAuthClient();
  return google.drive({ version: 'v3', auth });
}

// Helper: Decriptare token
function decryptToken(encryptedToken: string): string {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
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

// Restul funcțiilor rămân la fel (findFolder, createFolder, uploadFile, etc.)
```

### **PASUL 6: Configurare Environment Variables**

**Local (.env.local):**
```bash
# OAuth Google Drive
GOOGLE_OAUTH_CLIENT_ID=123456-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xyz123...
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=<64 char hex - generat mai jos>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Generează encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Vercel:**
1. Dashboard → Settings → Environment Variables
2. Add toate variabilele de mai sus
3. `NEXT_PUBLIC_BASE_URL` = `https://admin.unitarproiect.eu`

### **PASUL 7: Autorizare Inițială**

1. **Local:** Vizitează `http://localhost:3000/api/oauth/google-drive`
2. **Production:** Vizitează `https://admin.unitarproiect.eu/api/oauth/google-drive`
3. Login cu **unitarproiect@gmail.com**
4. Accept permissions (Google Drive access)
5. Redirect → vezi mesaj: "✅ Refresh token salvat!"

### **PASUL 8: Testare**

```bash
curl https://admin.unitarproiect.eu/api/test/google-drive
```

**Așteptat:** Upload fișier reușește, folosind storage-ul unitarproiect@gmail.com

---

## 🔐 SECURITATE

- ✅ Refresh token encriptat AES-256-CBC
- ✅ Stocat în BigQuery (nu în cod)
- ✅ Access token auto-refresh la expirare
- ✅ Encryption key în Vercel environment variables

---

## 🔄 REVOKE ACCESS (dacă e necesar)

1. Deschide [Google Account - Security](https://myaccount.google.com/permissions)
2. Găsește "Facturi ANAF OAuth"
3. Click "Remove Access"
4. Re-autorizează: `/api/oauth/google-drive`

---

## ✅ AVANTAJE vs Shared Drive

| Feature | OAuth Refresh Token | Shared Drive |
|---------|-------------------|--------------|
| Cont personal | ✅ DA | ❌ NU (doar business) |
| Folosește storage user | ✅ 200GB | ❌ Storage Drive |
| Setup complexity | 🟡 Medium | 🟢 Simple |
| Cost | ✅ Zero | ❌ Google Workspace |
| Securitate | ✅ Token encrypted | ✅ Permisiuni |

---

**Timp estimat:** 15 minute
**Autorizare:** O singură dată (refresh token valabil permanent)
**Storage folosit:** unitarproiect@gmail.com (200GB)

