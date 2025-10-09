# 🔍 Ghid Debugging: Facturi Primite ANAF

**Data:** 09.10.2025
**Status:** În testare
**Scop:** Diagnosticare sincronizare facturi primite din ANAF e-Factura

---

## 📋 Checklist Verificare Conexiune

### **1. Verificare Token ANAF (Pasul 1)**

**Status token:**
- ✅ Token valid: Expiră în 18 zile (verificat în `/admin/anaf/monitoring`)
- ✅ Tabela: `AnafTokens` conține `access_token` criptat
- ✅ Decriptare: Folosește `ANAF_TOKEN_ENCRYPTION_KEY` din `.env`

**Verificare:**
```sql
-- În BigQuery Console:
SELECT
  expires_at,
  is_active,
  DATE_DIFF(expires_at, CURRENT_TIMESTAMP(), DAY) as zile_ramase
FROM `PanouControlUnitar.AnafTokens`
WHERE is_active = TRUE
ORDER BY data_creare DESC
LIMIT 1
```

---

### **2. Verificare Configurație CUI (Pasul 2)**

**Variabile .env necesare:**
```env
UNITAR_CUI=35639210
ANAF_API_BASE=https://api.anaf.ro/prod/FCTEL/rest
ANAF_TOKEN_ENCRYPTION_KEY=<64 caractere hex>
```

**Verificare în Vercel:**
- Dashboard → Settings → Environment Variables
- Verifică că `UNITAR_CUI` există în Production

---

### **3. Test Conexiune ANAF (API Diagnosticare)**

**Endpoint nou creat:** `GET /api/anaf/facturi-primite/test-connection?zile=7`

**Cum să testezi:**

#### **Opțiunea A: Din browser**
```
https://admin.unitarproiect.eu/api/anaf/facturi-primite/test-connection?zile=7
```

#### **Opțiunea B: Din terminal (curl)**
```bash
curl https://admin.unitarproiect.eu/api/anaf/facturi-primite/test-connection?zile=7
```

#### **Opțiunea C: Din Vercel Logs**
1. Accesează pagina `/admin/financiar/facturi-primite`
2. Click "🔄 Sincronizare Manuală"
3. Deschide Vercel Dashboard → Logs
4. Caută log-uri care încep cu `🔄 [Facturi Primite ANAF]`

---

## 📊 Interpretare Răspuns Test API

### **Răspuns Succes:**
```json
{
  "success": true,
  "message": "Conexiune ANAF funcțională",
  "details": {
    "token_status": "valid",
    "cui_configurat": "35639210",
    "api_endpoint": "https://api.anaf.ro/prod/FCTEL/rest",
    "zile_verificate": 7,
    "total_facturi_anaf": 5,
    "facturi_deja_in_db": 5,
    "facturi_noi_disponibile": 0,  // ⚠️ Dacă 0 = nu sunt facturi noi
    "sample_mesaje": [
      {
        "id": "xxx",
        "id_descarcare": "yyy",
        "detalii": "Factura nr. 123",
        "tip": "FACTURA",
        "data_creare": "2025-10-02"
      }
    ]
  }
}
```

**Interpretare:**
- ✅ **token_status: "valid"** → Token funcțional
- ✅ **total_facturi_anaf: 5** → ANAF returnează 5 facturi în ultimele 7 zile
- ⚠️ **facturi_deja_in_db: 5** → Toate 5 sunt deja descărcate
- ℹ️ **facturi_noi_disponibile: 0** → **NU sunt facturi noi de descărcat**

---

### **Răspuns Eroare - Token Invalid:**
```json
{
  "success": false,
  "step": "token_verification",
  "error": "Token ANAF expirat la 2025-10-27T10:00:00.000Z",
  "details": "Reautorizează aplicația din /admin/anaf/setup"
}
```

**Soluție:**
1. Accesează `/admin/anaf/setup`
2. Click "Autorizare OAuth ANAF"
3. Login cu cont ANAF
4. Token nou va fi valid 30 zile

---

### **Răspuns Eroare - CUI Lipsește:**
```json
{
  "success": false,
  "step": "cui_verification",
  "error": "UNITAR_CUI lipsește din .env"
}
```

**Soluție:**
1. Vercel Dashboard → Settings → Environment Variables
2. Adaugă: `UNITAR_CUI` = `35639210`
3. Redeploy aplicația

---

### **Răspuns Eroare - ANAF API:**
```json
{
  "success": false,
  "step": "anaf_api_request",
  "status": 401,
  "error": "Unauthorized",
  "url": "https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura?zile=7&cif=35639210"
}
```

**Cauze posibile:**
- Token ANAF expirat (verifică în `/admin/anaf/monitoring`)
- Permisiuni OAuth insuficiente
- ANAF API în mentenanță

**Soluție:**
1. Reautorizează aplicația (30 zile validitate)
2. Verifică scope-urile OAuth (trebuie să includă `listaMesajeFactura` și `descarcare`)

---

## 🔎 Scenarii Comune

### **Scenariu 1: "Nu sunt facturi noi"**

**Simptom:**
```json
{
  "total_facturi_anaf": 3,
  "facturi_deja_in_db": 3,
  "facturi_noi_disponibile": 0
}
```

**Explicație:**
✅ **NORMAL** - Toate facturile din ultimele 7 zile au fost deja descărcate.

**Ce să verifici:**
1. Există facturi în tabel?
   ```sql
   SELECT COUNT(*) FROM `PanouControlUnitar.FacturiPrimiteANAF_v2` WHERE activ = TRUE
   ```
2. Când a fost ultima sincronizare?
   ```sql
   SELECT MAX(data_preluare) FROM `PanouControlUnitar.FacturiPrimiteANAF_v2`
   ```

---

### **Scenariu 2: "ANAF returnează 0 facturi"**

**Simptom:**
```json
{
  "total_facturi_anaf": 0,
  "facturi_deja_in_db": 0,
  "facturi_noi_disponibile": 0
}
```

**Explicație:**
ℹ️ **POSIBIL NORMAL** - Firma ta nu a primit facturi în ultimele 7 zile din e-Factura ANAF.

**Ce să verifici:**
1. **Login manual în ANAF SPV:**
   - Accesează: https://www.anaf.ro/SpvWeb/
   - Login cu certificat digital
   - Meniu: "Facturi primite" → "Încarcat în ultimele X zile"
   - Dacă nu vezi facturi, atunci ANAF nu are date

2. **Extinde intervalul:**
   - Test cu 30 zile: `?zile=30`
   - Test cu 90 zile: `?zile=90`

3. **Verifică CUI destinatar:**
   - Facturile trebuie să aibă CUI destinatar = `35639210`
   - Verifică în ANAF SPV dacă furnizori emit facturi cu CUI corect

---

### **Scenariu 3: "Eroare la download ZIP"**

**Simptom (în Vercel Logs):**
```
🔽 Procesare factură Factura nr. 123...
❌ Eroare procesare factură: Download failed: 404 Not Found
```

**Cauze:**
- `id_descarcare` invalid sau expirat
- ANAF API timeout
- Fișierul șters din ANAF

**Soluție:**
- Sincronizarea sare peste facturi cu erori
- Verifică `results.errors` în răspuns API

---

## 🛠️ Comenzi Utile BigQuery

### **Verificare facturi existente:**
```sql
SELECT
  serie_numar,
  nume_emitent,
  cif_emitent,
  data_factura,
  valoare_ron,
  status_procesare,
  DATE(data_preluare) as data_preluare
FROM `PanouControlUnitar.FacturiPrimiteANAF_v2`
WHERE activ = TRUE
ORDER BY data_preluare DESC
LIMIT 20
```

### **Verificare duplicate:**
```sql
SELECT
  id_descarcare,
  COUNT(*) as count
FROM `PanouControlUnitar.FacturiPrimiteANAF_v2`
GROUP BY id_descarcare
HAVING COUNT(*) > 1
```

### **Statistici sincronizare:**
```sql
SELECT
  DATE(data_preluare) as data,
  status_procesare,
  COUNT(*) as total
FROM `PanouControlUnitar.FacturiPrimiteANAF_v2`
WHERE activ = TRUE
GROUP BY DATE(data_preluare), status_procesare
ORDER BY data DESC
```

---

## 📞 Contact Support

**Dacă problema persistă:**
1. Rulează test API: `/api/anaf/facturi-primite/test-connection?zile=30`
2. Copiază răspunsul JSON complet
3. Verifică Vercel Logs pentru erori detaliate
4. Documentează scenariul exact (ce ai făcut, ce te așteptai, ce s-a întâmplat)

---

**Ultima actualizare:** 09.10.2025 (după HOTFIX 3)
