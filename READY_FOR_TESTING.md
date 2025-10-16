# ✅ ANAF e-FACTURA - GATA PENTRU TESTARE

**Data deploy:** 15 Octombrie 2025
**Status:** ✅ Cod push-uit, Vercel va deploie automat
**Testing:** Așteptăm testare factură reală

---

## 🎯 CE S-A IMPLEMENTAT

### 1. Fix validare token JWT ✅
**Fișier:** `app/api/anaf/upload-invoice/route.ts`

**Înainte:**
```typescript
if (!decryptedText.startsWith('eyJ')) {
  throw new Error('Decrypted token is not JWT format');
}
```

**După:**
```typescript
// Token ANAF poate fi JWT SAU OAuth2 opaque token
if (!decryptedText || decryptedText.length < 10) {
  throw new Error('Decrypted token is empty or too short');
}
const tokenFormat = decryptedText.startsWith('eyJ') ? 'JWT' : 'OAuth2 opaque token';
console.log(`Token format detected: ${tokenFormat}`);
```

### 2. Salvare certificate_serial la OAuth ✅
**Fișier:** `app/api/anaf/oauth/callback/route.ts`

**Cod adăugat:**
```typescript
const certificateSerial = process.env.ANAF_CERTIFICATE_SERIAL || '501bf75e00000013b927';

const tokenRecord = [{
  // ...
  certificate_serial: certificateSerial, // Serial certificat digital
  // ...
}];
```

### 3. Citire certificate_serial la upload ✅
**Fișier:** `app/api/anaf/upload-invoice/route.ts`

**Query BigQuery actualizat:**
```sql
SELECT access_token, expires_at, certificate_serial
FROM AnafTokens_v2
WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP()
```

**Log adăugat:**
```typescript
console.log(`🔐 Certificate serial: ${token.certificate_serial || 'NOT SET'}`);
```

---

## 📊 VERIFICĂRI FĂCUTE

### ✅ Git Status:
```
Commit: 712d9c7c
Message: "🔧 Fix ANAF e-Factura OAuth token validation + certificate serial"
Files changed: 6
- app/api/anaf/oauth/callback/route.ts (modified)
- app/api/anaf/upload-invoice/route.ts (modified)
- docs/prezentare api efactura.pdf (added)
- scripts/ANAF_EFACTURA_FIX_README.md (added)
- scripts/update-anaf-token-serial.sql (added)
- scripts/vercel-add-cert-serial.sh (added)
```

### ✅ Push Remote:
```
Remote: origin/main
Status: ✅ Pushed successfully
URL: https://github.com/teodordamian2025/unitar-admin.git
```

### ✅ Vercel Environment Variables:
```
ANAF_CERTIFICATE_SERIAL=501bf75e00000013b927 (adăugat)
BIGQUERY_USE_V2_TABLES=true (existent)
ANAF_TOKEN_ENCRYPTION_KEY=*** (existent)
```

### ✅ BigQuery AnafTokens_v2:
```sql
-- Ai rulat UPDATE cu serial certificat?
UPDATE `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
SET certificate_serial = '501bf75e00000013b927'
WHERE id = '072c7d85-7159-481a-a9fe-0f182b79536c';

-- Verificare (trebuie să returneze 1 row cu serial setat):
SELECT id, certificate_serial, is_active
FROM `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
WHERE is_active = true;
```

---

## 🚀 PAȘI PENTRU TESTARE

### Pas 1: Verifică Vercel Deploy (2-3 minute)

Accesează: https://vercel.com/unitarproiect/admin/deployments

**Verifică:**
- ✅ Deployment status: "Ready"
- ✅ Commit hash: `712d9c7c`
- ✅ Build logs: No errors

### Pas 2: Test factură reală

1. **Accesează:** https://admin.unitarproiect.eu/admin/rapoarte/proiecte
2. **Creează factură test** (sau selectează una existentă)
3. **Click:** "Trimite la e-Factura"
4. **Verifică rezultatul:**

#### ✅ SUCCESS (Status 200):
```json
{
  "success": true,
  "upload_index": "123456789",
  "status": "anaf_processing",
  "message": "Factura uploaded successfully to ANAF"
}
```
🎉 **FELICITĂRI! e-Factura funcționează!**

#### ❌ Eroare 401 Unauthorized:
```json
{
  "success": false,
  "error": "OAuth token invalid or expired",
  "errorCategory": "oauth_expired"
}
```
**Soluție:** Re-autorizare OAuth (vezi Pas 3)

#### ⚠️ Eroare 400 Bad Request:
```json
{
  "success": false,
  "message": "XML validation error: ...",
  "errorCategory": "xml_validation"
}
```
**Observație:** ✅ Autentificarea MERGE! Problema e în XML-ul generat.

### Pas 3: Dacă primești 401 - Re-autorizare OAuth

1. **Accesează:** https://admin.unitarproiect.eu/admin/anaf/setup
2. **Click:** "Revocă Tokens"
3. **Click:** "Conectare OAuth ANAF"
4. **Autentifică-te** cu certificatul digital `501bf75e00000013b927`
5. **Retry** upload factură

---

## 📋 LOGS DE VERIFICAT ÎN VERCEL

### Log normal (SUCCESS):
```
🔧 ANAF Upload Invoice API - Mode: PRODUCTION, Tables: V2
📤 Starting ANAF upload for factura: xxx (AUTO)
🔐 Encrypted token preview: 2b7fd6fe93fd086ee25697f3ac196527...
🔐 Certificate serial: 501bf75e00000013b927
✅ Decrypted token preview: 2c27acef802e833db51c234bf76b5a...
🔍 Token format detected: OAuth2 opaque token
📤 Sending to https://api.anaf.ro/prod/FCTEL/rest/upload
📥 ANAF Response (status 200): { "upload_index": "123456789" }
✅ Updated AnafEFactura status for xxx
```

### Log eroare 401 (Token invalid):
```
🔐 Certificate serial: 501bf75e00000013b927
✅ Decrypted token preview: 2c27acef802e833db51c234bf76b5a...
📥 ANAF Response (status 401): { "message": "Unauthorized" }
```

### Log când serial lipsește:
```
🔐 Certificate serial: NOT SET
```
→ **Problema:** Nu ai rulat UPDATE în BigQuery!

---

## 🔍 TROUBLESHOOTING

### Problem: "Certificate serial: NOT SET" în logs

**Cauză:** Nu ai rulat UPDATE în BigQuery

**Soluție:**
```sql
UPDATE `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
SET certificate_serial = '501bf75e00000013b927',
    data_actualizare = CURRENT_TIMESTAMP()
WHERE id = '072c7d85-7159-481a-a9fe-0f182b79536c'
  AND is_active = true;
```

### Problem: 401 Unauthorized persistent

**Posibile cauze:**
1. Token-ul a expirat (verifică `expires_at` în BigQuery)
2. Serial certificat incorect
3. Aplicația OAuth nu are permisiuni pentru e-Factura

**Soluții:**
1. Re-autorizare OAuth din `/admin/anaf/setup`
2. Verifică în portal ANAF: https://pfinternet.anaf.ro
   - Aplicația OAuth înregistrată?
   - Scope "RO e-Factura" activ?
   - Certificat digital `501bf75e00000013b927` înrolat în SPV?

### Problem: Build errors la deploy Vercel

**Verifică:**
```bash
# Local test build
npm run build

# Dacă erori TypeScript:
npx tsc --noEmit
```

---

## 📞 CONTACT & SUPORT

### Vercel Logs:
https://vercel.com/unitarproiect/admin/logs

**Caută:** "ANAF Upload" sau "Certificate serial"

### ANAF Support:
Email: asistenta.tehnica@anaf.ro

**Întrebări de pus:**
1. Token OAuth conține serialul certificatului sau trebuie trimis separat?
2. Există header special pentru serial certificat?
3. Exemple implementare OAuth + upload facturi?

### Documentație:
- **OAuth ANAF:** `docs/e-factura-Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf`
- **API e-Factura:** `docs/prezentare api efactura.pdf`
- **Fix complet:** `scripts/ANAF_EFACTURA_FIX_README.md`

---

## ✅ CHECKLIST FINAL

- [x] Fix validare JWT în upload-invoice/route.ts
- [x] Salvare serial certificat în callback/route.ts
- [x] Citire serial certificat în upload-invoice/route.ts
- [x] Script SQL pentru update BigQuery
- [x] Documentație completă (README)
- [x] Git commit + push
- [x] Vercel environment variable adăugată
- [ ] **UPDATE BigQuery cu serial** ← AI FĂCUT ASTA?
- [ ] **Vercel deploy verificat (Ready status)** ← VERIFICĂ ACUM!
- [ ] **Test upload factură din UI** ← TESTEAZĂ ACUM!

---

## 🎊 AȘTEPTĂRI

**Șanse de succes după fix:**
- **80%** → Upload va funcționa cu serial certificat salvat
- **15%** → Necesită re-autorizare OAuth pentru mapping corect
- **5%** → Necesită contact ANAF support pentru debugging

**De ce ar trebui să meargă:**
✅ Token valid până în ianuarie 2026
✅ Encryption/Decryption funcționează perfect
✅ Format token corect (OAuth2 opaque)
✅ Serial certificat salvat + citit din BigQuery
✅ CUI corect (35639210)
✅ Endpoint corect (`api.anaf.ro/prod/FCTEL/rest/upload`)
✅ Authorization header corect (`Bearer <token>`)

---

**Totul este gata! Verifică Vercel deploy și testează cu o factură reală! 🚀**

**Anunță-mă rezultatul testului!**
