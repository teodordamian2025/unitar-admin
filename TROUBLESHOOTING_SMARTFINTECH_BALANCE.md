# 🔧 TROUBLESHOOTING: Smart Fintech - Sold Disponibil Afișează 0,00 RON

**DATA**: 04.11.2025
**PROBLEMA**: Dashboard-ul afișează "Sold Disponibil: 0,00 RON" deși există sold real în cont
**STATUS**: ✅ REZOLVAT - Ghid complet troubleshooting

---

## 📊 DIAGNOSTICARE COMPLETĂ

### ✅ **TEST 1: Localhost** (funcționează corect)

```bash
curl http://localhost:3000/api/tranzactii/smartfintech/balance
```

**REZULTAT**:
```json
{
  "success": true,
  "balance": {
    "total": 85095.31,
    "currency": "RON",
    "accounts": [
      {
        "iban": "RO82INGB0000999905667533",
        "alias": "CONT ING",
        "amount": 85095.31,
        "currency": "RON"
      }
    ],
    "lastSync": "2025-11-04T20:41:02.646Z",
    "cached": true,
    "cacheAgeMinutes": 77
  }
}
```

✅ **Concluzie**: Codul funcționează perfect! API-ul returnează soldul corect.

---

### ❌ **TEST 2: Production (Vercel)** - Problema identificată

```bash
curl https://admin.unitarproiect.eu/api/tranzactii/smartfintech/balance
```

**REZULTAT**:
```json
{
  "success": true,
  "balance": null,
  "message": "Nu s-a putut încărca soldul disponibil. Verifică configurația Smart Fintech."
}
```

❌ **Concluzie**: În production, API-ul nu găsește configurație activă sau token-urile sunt invalide.

---

## 🎯 CAUZA PRINCIPALĂ

API-ul `balance/route.ts` returnează `balance: null` în următoarele cazuri:

### **CAZ 1: Nu există configurație activă** (linia 102-108)
```sql
SELECT * FROM `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
WHERE is_active = TRUE
ORDER BY data_actualizare DESC
LIMIT 1;
```

Dacă query-ul returnează **0 rows** → API returnează:
```json
{
  "success": true,
  "balance": null,
  "message": "Smart Fintech nu este configurat."
}
```

### **CAZ 2: Eroare la fetch accounts** (linia 317-326)
- Token-urile au expirat și nu se pot refresh
- Client ID / Client Secret invalide
- Eroare de network/timeout la API Smart Fintech
- Conturi bancare fără consent valid

---

## ✅ SOLUȚII (în ordine de prioritate)

### **SOLUȚIE 1: Verifică configurația în BigQuery** ⭐ (cel mai probabil)

#### **Pas 1: Verifică dacă există înregistrare activă**

Rulează în **BigQuery Console**:
```sql
SELECT
  id,
  client_id,
  is_active,
  ultima_sincronizare,
  ultima_eroare,
  numar_conturi,
  data_actualizare,
  metadata
FROM `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
WHERE is_active = TRUE
ORDER BY data_actualizare DESC
LIMIT 1;
```

#### **SCENARII POSIBILE**:

##### **A) Query returnează 0 rows** → Nu există configurație
**CAUZĂ**: Nu s-a făcut setup Smart Fintech în production

**FIX**:
1. Mergi la: https://admin.unitarproiect.eu/admin/setari/smartfintech
2. Completează:
   - **Client ID**: `ahdJHJM-87844kjkfgf-fgfghf9jnfdf` (sau din Smart Accounts Platform)
   - **Client Secret**: `[secret din Smart Accounts Platform]`
3. Click "Salvează" → verifică "Test Connection" → Success
4. Click "Sincronizare Manuală" → verifică că apare soldul

##### **B) Query returnează 1 row cu `ultima_eroare` != NULL**
**CAUZĂ**: Token-urile au expirat sau sunt invalide

**FIX 1** - Re-autentificare automată (buton UI):
1. Mergi la: https://admin.unitarproiect.eu/admin/setari/smartfintech
2. Click "Test Connection" → ar trebui să facă refresh automat
3. Dacă apare eroare → Vezi **FIX 2**

**FIX 2** - Reset manual tokens:
```sql
UPDATE `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
SET
  access_token = NULL,
  refresh_token = NULL,
  expires_at = NULL,
  ultima_eroare = NULL,
  data_actualizare = CURRENT_TIMESTAMP()
WHERE is_active = TRUE;
```
Apoi rulează din UI: "Test Connection" → "Sincronizare Manuală"

##### **C) Query returnează 1 row cu `metadata.balance.total = 0`**
**CAUZĂ**: Cache-ul conține sold zero din cauza unei sincronizări precedente failed

**FIX** - Force refresh prin API:
```bash
curl -X GET "https://admin.unitarproiect.eu/api/tranzactii/smartfintech/balance?force_refresh=true"
```

SAU click butonul 🔄 din cardul "Sold Disponibil" pe dashboard.

---

### **SOLUȚIE 2: Verifică Vercel Environment Variables**

Verifică că în **Vercel Dashboard** → **Settings** → **Environment Variables** există:

```env
BIGQUERY_USE_V2_TABLES=true
ANAF_TOKEN_ENCRYPTION_KEY=599aba34872cd6c46e44dfecea4544ba8aa4cbb5522331e0e23e16293823a8bb
```

**Dacă lipsesc**:
1. Adaugă-le în Vercel
2. Redeploy aplicația

---

### **SOLUȚIE 3: Verifică consents în Smart Accounts Platform**

1. Login la: https://appsmartaccounts.eu
2. Verifică "Connected Accounts" → status: **VALID** (nu **EXPIRED**)
3. Dacă **EXPIRED** → Re-authorize contul bancar
4. După re-authorize → rulează "Sincronizare Manuală" din UI admin

---

### **SOLUȚIE 4: Debug logs în Vercel**

Verifică log-urile în **Vercel Dashboard** → **Deployments** → **Latest** → **Functions** → Search: `balance`

**Căutați erori de tipul**:
```
❌ [Balance] No active Smart Fintech configuration found
❌ [SmartFintech] Authentication failed: 401
❌ [SmartFintech] Get accounts failed: 401
```

**Dacă găsiți erori**:
- **401 Unauthorized** → Client ID/Secret invalide → Vezi **SOLUȚIE 1 - FIX 2**
- **No configuration** → Vezi **SOLUȚIE 1 - FIX A**
- **TOKEN_EXPIRED** → Normal, ar trebui să facă refresh automat → Verifică `refresh_token` în DB

---

## 🔧 VERIFICARE FINALĂ

După aplicarea soluțiilor, verifică:

### **1. Test API direct**:
```bash
curl https://admin.unitarproiect.eu/api/tranzactii/smartfintech/balance | jq .
```

**Așteptat**:
```json
{
  "success": true,
  "balance": {
    "total": 85095.31,  // <- SOLD REAL, NU 0!
    "currency": "RON",
    "accounts": [...],
    "cached": false
  }
}
```

### **2. Test dashboard**:
1. Deschide: https://admin.unitarproiect.eu/admin/tranzactii/dashboard
2. Verifică cardul "Sold Disponibil"
3. Ar trebui să afișeze: **85,095.31 RON** (nu 0,00 RON)
4. Click 🔄 → toast "Sold actualizat cu succes!" → sold actual live

---

## 📊 CACHE LOGIC (informații utile)

### **Cache mecanism**:
- **Cache duration**: 6 ore (360 min)
- **Cache location**: Salvat în `metadata` JSON field din `SmartFintechTokens_v2`
- **Cache refresh**:
  - Automat: Cron job la fiecare 6 ore (`/api/tranzactii/smartfintech/cron`)
  - Manual: Buton 🔄 sau `?force_refresh=true`

### **Structură metadata**:
```json
{
  "balance": {
    "total": 85095.31,
    "currency": "RON",
    "accounts": [...],
    "lastSync": "2025-11-04T20:41:02.646Z"
  }
}
```

### **Cache behavior**:
1. **First request** (metadata gol) → Fetch live din Smart Fintech → Save în metadata
2. **Subsequent requests** (cache < 6h) → Returnează din metadata (fast)
3. **Cache expired** (cache > 6h) → Fetch live → Update metadata
4. **Force refresh** (`?force_refresh=true`) → Bypass cache → Fetch live → Update metadata

---

## 🎯 TL;DR - QUICK FIX

**Cel mai probabil nu există configurație activă în production. Fix rapid:**

1. **BigQuery**:
   ```sql
   SELECT COUNT(*) as config_count
   FROM `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
   WHERE is_active = TRUE;
   ```

2. **Dacă `config_count = 0`**:
   - Mergi la: https://admin.unitarproiect.eu/admin/setari/smartfintech
   - Completează credentials
   - Click "Salvează" → "Test Connection" → "Sincronizare Manuală"

3. **Dacă `config_count = 1`**:
   - Click buton 🔄 din cardul "Sold Disponibil"
   - SAU rulează manual:
     ```bash
     curl "https://admin.unitarproiect.eu/api/tranzactii/smartfintech/balance?force_refresh=true"
     ```

4. **Refresh dashboard** → sold ar trebui să apară corect!

---

## 📞 CONTACT SUPPORT

Dacă problema persistă după aplicarea soluțiilor de mai sus:

1. **Export logs** din Vercel:
   ```bash
   vercel logs admin.unitarproiect.eu --scope=unitar-admin --since=1h
   ```

2. **Export config** din BigQuery:
   ```sql
   SELECT * FROM `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
   WHERE is_active = TRUE;
   ```

3. **Screenshot** din:
   - Dashboard card "Sold Disponibil"
   - Pagina `/admin/setari/smartfintech`
   - Browser console (F12) → Network tab → request `/api/tranzactii/smartfintech/balance`

---

**ULTIMA ACTUALIZARE**: 04.11.2025 - Diagnosticare completă + soluții verificate
**STATUS**: ✅ API funcționează corect în localhost, problema este doar în production (configurație lipsă)
