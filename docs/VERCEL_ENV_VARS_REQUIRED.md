# 🔐 Variabile Environment Necesare în Vercel

**Data:** 09.10.2025
**Scop:** Configurare completă Vercel pentru facturi primite ANAF

---

## ✅ Variabile Critice (OBLIGATORII)

### **1. Google Cloud BigQuery**
```
GOOGLE_CLOUD_PROJECT_ID=hale-mode-464009-i6
GOOGLE_CLOUD_CLIENT_EMAIL=<service-account-email>
GOOGLE_CLOUD_PRIVATE_KEY=<private-key-with-\n-escaped>
```

**Validare:**
- Private key trebuie să aibă `\n` escaped (nu newline real)
- Exemplu corect: `-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----\n`

---

### **2. BigQuery V2 Tables Toggle**
```
BIGQUERY_USE_V2_TABLES=true
```

**Importanță:**
- ✅ `true` → Folosește tabele optimizate `_v2` (partitioning + clustering)
- ❌ `false` sau lipsă → Eroare "Table not found"

---

### **3. ANAF OAuth & API**

#### **ANAF OAuth URLs:**
```
ANAF_OAUTH_BASE=https://logincert.anaf.ro
ANAF_REDIRECT_URI=https://admin.unitarproiect.eu/api/anaf/oauth/callback
ANAF_SCOPE=RO e-Factura
```

#### **ANAF API Base URL:**
```
ANAF_API_BASE=https://api.anaf.ro/prod/FCTEL/rest
```

**⚠️ ATENȚIE:** Trebuie să includă **path-ul complet** `/prod/FCTEL/rest`!

**Erori comune:**
- ❌ `https://api.anaf.ro` → 403 Forbidden (lipsește path)
- ✅ `https://api.anaf.ro/prod/FCTEL/rest` → Funcționează

**Alternativă:**
- Dacă ștergi variabila `ANAF_API_BASE` din Vercel, codul va folosi default-ul hardcodat corect

---

### **4. ANAF Token Encryption**
```
ANAF_TOKEN_ENCRYPTION_KEY=<64-caractere-hex>
```

**Generare cheie nouă (dacă e nevoie):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Validare:**
- Trebuie să fie exact **64 caractere** hexadecimale
- Folosită pentru criptare/decriptare tokens OAuth ANAF

---

### **5. Detalii Firmă**
```
UNITAR_CUI=35639210
UNITAR_ADRESA=<adresa-completa>
UNITAR_TELEFON=<telefon>
UNITAR_EMAIL=office@unitarproiect.eu
```

**Utilizare:**
- `UNITAR_CUI` → **OBLIGATORIU** pentru listaMesajeFactura ANAF
- Restul → Pentru generare facturi/contracte PDF

---

## ⚪ Variabile Opționale

### **Google Drive (pentru Facturi Primite)**
```
GOOGLE_SHARED_DRIVE_ID=<shared-drive-id>
```

**Dacă lipsește:** Uploads vor merge în "My Drive" (poate da eroare pentru service accounts)

**Cum să obții:**
1. Creează Shared Drive în Google Drive
2. Adaugă service account (`GOOGLE_CLOUD_CLIENT_EMAIL`) ca member cu rol "Content Manager"
3. Copiază ID-ul din URL: `https://drive.google.com/drive/folders/SHARED_DRIVE_ID`

---

### **ANAF Sandbox Mode**
```
ANAF_SANDBOX_MODE=false
```

**Valori:**
- `true` → Folosește sandbox ANAF (pentru teste)
- `false` → Producție ANAF (recomandat)

---

## 🔍 Verificare Configurație

### **Test API Local:**
```bash
# În terminal local:
curl http://localhost:3000/api/anaf/facturi-primite/test-connection?zile=7
```

### **Test API Production:**
```
https://admin.unitarproiect.eu/api/anaf/facturi-primite/test-connection?zile=7
```

**Răspuns success:**
```json
{
  "success": true,
  "message": "Conexiune ANAF funcțională",
  "details": {
    "token_status": "valid",
    "cui_configurat": "35639210",
    "api_endpoint": "https://api.anaf.ro/prod/FCTEL/rest",
    "total_facturi_anaf": 5,
    "facturi_noi_disponibile": 5
  }
}
```

---

## 🚨 Troubleshooting Erori Comune

### **Eroare: "UNITAR_CUI lipsește din .env"**
**Soluție:**
1. Vercel Dashboard → Settings → Environment Variables
2. Adaugă: `UNITAR_CUI` = `35639210`
3. Redeploy

---

### **Eroare: "Table AnafTokens was not found"**
**Cauză:** Lipsește `BIGQUERY_USE_V2_TABLES=true`

**Soluție:**
1. Vercel Dashboard → Settings → Environment Variables
2. Adaugă: `BIGQUERY_USE_V2_TABLES` = `true`
3. Redeploy

---

### **Eroare: "403 Forbidden" la ANAF API**
**Cauză:** `ANAF_API_BASE` e setat greșit (fără path)

**Soluție A - Update variabilă:**
1. Vercel Dashboard → Settings → Environment Variables
2. Găsește `ANAF_API_BASE`
3. Actualizează la: `https://api.anaf.ro/prod/FCTEL/rest`
4. Redeploy

**Soluție B - Șterge variabilă:**
1. Vercel Dashboard → Settings → Environment Variables
2. Șterge `ANAF_API_BASE` complet
3. Codul va folosi default hardcodat (corect)
4. Redeploy

---

### **Eroare: "Invalid time value"**
**Cauză:** BigQuery DATE fields returnate ca obiecte `{value: "..."}`

**Status:** ✅ REZOLVAT în HOTFIX 5 (commit `a7ec8850`)

---

## 📋 Checklist Deploy Complet

**Înainte de deploy:**
- [ ] `GOOGLE_CLOUD_PROJECT_ID` setat
- [ ] `GOOGLE_CLOUD_CLIENT_EMAIL` setat
- [ ] `GOOGLE_CLOUD_PRIVATE_KEY` setat (cu `\n` escaped)
- [ ] `BIGQUERY_USE_V2_TABLES=true` setat
- [ ] `ANAF_API_BASE=https://api.anaf.ro/prod/FCTEL/rest` setat
- [ ] `ANAF_TOKEN_ENCRYPTION_KEY` setat (64 chars)
- [ ] `UNITAR_CUI=35639210` setat
- [ ] Token ANAF autorizat (din `/admin/anaf/setup`)

**După deploy:**
- [ ] Test API: `/api/anaf/facturi-primite/test-connection?zile=7` returnează success
- [ ] Sincronizare manuală funcționează
- [ ] Facturi apar în BigQuery `FacturiPrimiteANAF_v2`
- [ ] Fișiere apar în Google Drive `Facturi Primite ANAF/`

---

**Ultima actualizare:** 09.10.2025 (după HOTFIX 5 + ANAF_API_BASE fix)
