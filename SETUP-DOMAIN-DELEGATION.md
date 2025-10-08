# 🔐 SETUP: Domain-Wide Delegation (Google Workspace Personal)

**Use Case:** Cont Google personal cu storage plătit (200GB), fără Shared Drive
**Soluție:** Service account impersonează user-ul și folosește storage-ul lui

---

## 📋 PAȘI SETUP (10 minute)

### **1. Enable Domain-Wide Delegation în GCP**

1. Deschide [GCP Console](https://console.cloud.google.com)
2. Proiect: **hale-mode-464009-i6**
3. Navigare: **IAM & Admin** → **Service Accounts**
4. Găsește: `serviceaccount1@hale-mode-464009-i6.iam.gserviceaccount.com`
5. Click pe service account → Tab **"Details"**
6. Section **"Advanced settings"** → Click **"Enable Google Workspace Domain-wide Delegation"**
7. Notează **Client ID** (un număr lung, ex: `1234567890123456789`)

### **2. Configurare OAuth Scopes (doar pentru Workspace Organizations)**

**❗ IMPORTANT:** Acest pas e doar pentru **Google Workspace Organizations** (business).

Dacă ai cont **personal Google** (gmail.com cu storage plătit via Google One), **sari peste acest pas** - nu ai acces la Admin Console.

<details>
<summary>Click aici DOAR dacă ai Google Workspace (business)</summary>

1. Deschide [Google Admin Console](https://admin.google.com)
2. Navigare: **Security** → **Access and data control** → **API Controls**
3. Section **"Domain-wide delegation"** → Click **"Manage Domain Wide Delegation"**
4. Click **"Add new"**
5. **Client ID**: (cel notat la pasul 1)
6. **OAuth Scopes**:
   ```
   https://www.googleapis.com/auth/drive
   ```
7. Click **"Authorize"**

</details>

### **3. Configurare Code (Impersonation)**

Modifică `/lib/google-drive-helper.ts`:

```typescript
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
    scopes: ['https://www.googleapis.com/auth/drive'],
    // ADAUGĂ IMPERSONATION:
    clientOptions: {
      subject: process.env.GOOGLE_DRIVE_USER_EMAIL, // unitarproiect@gmail.com
    },
  });

  return google.drive({ version: 'v3', auth });
}
```

### **4. Configurare Environment Variables**

**Local (.env.local):**
```bash
GOOGLE_DRIVE_USER_EMAIL=unitarproiect@gmail.com
```

**Vercel:**
1. Dashboard → Settings → Environment Variables
2. Add: `GOOGLE_DRIVE_USER_EMAIL` = `unitarproiect@gmail.com`
3. Redeploy

---

## ✅ TESTARE

```bash
curl https://admin.unitarproiect.eu/api/test/google-drive
```

**Așteptat:** Upload fișier test reușește, folosind storage-ul unitarproiect@gmail.com

---

## ⚠️ LIMITĂRI

**Dacă ai cont PERSONAL (nu Workspace):**
- Domain-wide delegation necesită Google Admin Console (doar business)
- Alternative: OAuth 2.0 cu refresh token (vezi Opțiunea 2)

