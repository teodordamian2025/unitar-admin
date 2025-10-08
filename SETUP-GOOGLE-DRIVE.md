# 📁 SETUP GOOGLE DRIVE - Facturi Primite ANAF

**Data:** 08.10.2025
**Status:** 🚨 REQUIRED - Service accounts nu pot uploada în My Drive

---

## 🔴 PROBLEMĂ IDENTIFICATĂ

```
Error: Service Accounts do not have storage quota.
Leverage shared drives instead.
```

**Root cause:** Service account-urile Google nu au storage propriu și **nu pot uploada** în foldere My Drive personale (chiar dacă au permisiuni Editor pe folder).

**Soluția:** Folosim **Google Shared Drive** (Team Drive)

---

## ✅ PAȘI SETUP (5 minute)

### **1. Creează Shared Drive**

1. Deschide [Google Drive](https://drive.google.com)
2. Click **"Shared drives"** în sidebar-ul stâng
3. Click buton **"+ New"** (sus)
4. Nume Shared Drive: **"Facturi ANAF"** (sau alt nume la alegere)
5. Click **"Create"**

### **2. Obține Shared Drive ID**

1. Click pe Shared Drive creat
2. Copiază ID-ul din URL:
   ```
   https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXXXXXXXXXX
                                           ^^^^^^^^^^^^^^^^^^^^^^^^
                                           acesta e Shared Drive ID
   ```
3. Salvează ID-ul (exemplu: `0AIqM_XXXXXXXXXXXXXXXXX`)

### **3. Adaugă Service Account ca Member**

1. În Shared Drive, click pe ⚙️ (Settings) → **"Manage members"**
2. Click **"Add members"**
3. Adaugă email-ul service account:
   ```
   serviceaccount1@hale-mode-464009-i6.iam.gserviceaccount.com
   ```
4. Setează rol: **"Content Manager"** (poate crea/edita/șterge fișiere)
5. Click **"Send"** (nu e nevoie să confirme - e service account)

### **4. Creează Folder în Shared Drive**

1. În Shared Drive, click dreapta → **"New folder"**
2. Nume: **"Facturi Primite ANAF"** (EXACT acest nume!)
3. Click **"Create"**

Structura finală:
```
📁 Shared Drive: "Facturi ANAF"
  └── 📁 Facturi Primite ANAF
       └── 📁 2025
            └── 📁 10 (luna octombrie)
                 ├── 📄 factura1.zip
                 ├── 📄 factura1.xml
                 └── 📄 factura1.pdf
```

### **5. Configurează .env.local**

Adaugă variabila în `.env.local`:

```bash
# Google Drive Shared Drive
GOOGLE_SHARED_DRIVE_ID=0AIqM_XXXXXXXXXXXXXXXXX  # ID-ul copiat la pasul 2
```

### **6. Configurează Vercel**

1. Deschide [Vercel Dashboard](https://vercel.com/dashboard)
2. Click pe proiect **unitar-admin**
3. Settings → **Environment Variables**
4. Click **"Add New"**
5. Name: `GOOGLE_SHARED_DRIVE_ID`
6. Value: `0AIqM_XXXXXXXXXXXXXXXXX` (ID-ul tău)
7. Environment: **Production** + **Preview** + **Development**
8. Click **"Save"**

### **7. Redeploy Vercel**

1. În Vercel Dashboard → **Deployments**
2. Click pe ultimul deployment → **"..."** → **"Redeploy"**
3. Sau: push un commit dummy → Vercel redeploy automat

---

## 🧪 TESTARE

După setup, testează:

```bash
# Local (cu .env.local actualizat):
curl http://localhost:3000/api/test/google-drive

# Production:
curl https://admin.unitarproiect.eu/api/test/google-drive
```

**Output așteptat:**
```json
{
  "success": true,
  "tests": [
    {
      "name": "Find root folder",
      "status": "success",
      "data": { "rootFolderId": "..." }
    },
    {
      "name": "Create/find month folder 2025/10",
      "status": "success",
      "data": { "monthFolderId": "..." }
    },
    {
      "name": "Upload test file",
      "status": "success",
      "data": { "fileId": "...", "fileName": "test-upload-..." }
    },
    {
      "name": "List files in folder",
      "status": "success",
      "data": { "total_files": 1, "files": [...] }
    }
  ],
  "message": "🎉 Toate testele au trecut cu succes!"
}
```

---

## 🔍 TROUBLESHOOTING

### **Error: Folder "Facturi Primite ANAF" nu a fost găsit**

**Fix:**
- Verifică că folderul e creat **în Shared Drive**, nu în My Drive
- Numele trebuie exact: `Facturi Primite ANAF`

### **Error: Service Accounts do not have storage quota**

**Fix:**
- Verifică că ai setat `GOOGLE_SHARED_DRIVE_ID` în .env.local + Vercel
- Redeploy după setare variabilă

### **Error: Permission denied**

**Fix:**
- Verifică că service account e adăugat ca member în Shared Drive
- Rol: **Content Manager** (nu Viewer/Commenter)

### **Vercel logs: has_shared_drive_id: false**

**Fix:**
- Variabila `GOOGLE_SHARED_DRIVE_ID` nu e setată în Vercel
- Setează în Vercel Dashboard → Environment Variables
- Redeploy

---

## 📊 VERIFICARE FINALĂ

Checklist înainte de a continua:

- ✅ Shared Drive creat
- ✅ Service account adăugat ca Content Manager
- ✅ Folder "Facturi Primite ANAF" creat în Shared Drive
- ✅ `GOOGLE_SHARED_DRIVE_ID` setat în .env.local
- ✅ `GOOGLE_SHARED_DRIVE_ID` setat în Vercel
- ✅ Redeploy Vercel efectuat
- ✅ Test endpoint returnează success: true

---

## 🎯 NEXT STEPS DUPĂ SETUP

După ce Google Drive funcționează:

1. **Testează sync manual:**
   ```bash
   curl -X POST https://admin.unitarproiect.eu/api/anaf/facturi-primite/sync \
     -H "Content-Type: application/json" \
     -d '{"zile": 7}'
   ```

2. **Verifică facturi în UI:**
   - Deschide: https://admin.unitarproiect.eu/admin/financiar/facturi-primite
   - Click "Sincronizare ANAF"
   - Vezi lista facturi + status procesare

3. **Configurează Cron Job** (Vercel):
   - `vercel.json` → daily sync 06:00 AM

---

**Ultima actualizare:** 08.10.2025 18:20
**Author:** Claude Code
**Contact:** teodordamian2025 (GitHub)
