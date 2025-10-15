# 🔧 FIX ANAF e-Factura - Procedură Completă

**Data:** 15 Octombrie 2025
**Status:** ✅ Fixuri implementate, test în așteptare

---

## 📋 PROBLEMA IDENTIFICATĂ

### Eroare inițială:
```
❌ Error: Decrypted token is not JWT format (starts with: 2c27acef80)
```

### Root Causes:
1. **Verificare JWT greșită** - Codul verifica dacă token-ul începe cu `eyJ` (JWT format), dar ANAF returnează OAuth2 opaque token (64 chars hex)
2. **Serial certificat lipsă** - Token-ul OAuth ANAF trebuie asociat cu serialul certificatului digital folosit la autentificare

---

## ✅ FIXURI IMPLEMENTATE

### 1. Fix validare token JWT (`upload-invoice/route.ts`)

**ÎNAINTE:**
```typescript
if (!decryptedText.startsWith('eyJ')) {
  throw new Error('Decrypted token is not JWT format');
}
```

**DUPĂ:**
```typescript
// Token ANAF poate fi JWT SAU OAuth2 opaque token (hex string)
if (!decryptedText || decryptedText.length < 10) {
  throw new Error('Decrypted token is empty or too short');
}
const tokenFormat = decryptedText.startsWith('eyJ') ? 'JWT' : 'OAuth2 opaque token';
console.log(`Token format detected: ${tokenFormat}`);
```

### 2. Salvare serial certificat (`callback/route.ts`)

**Adăugat:**
```typescript
const certificateSerial = process.env.ANAF_CERTIFICATE_SERIAL || '501bf75e00000013b927';

const tokenRecord = [{
  // ...
  certificate_serial: certificateSerial, // Serial certificat digital folosit la OAuth
  // ...
}];
```

---

## 🚀 PAȘI DE URMAT PENTRU TESTARE

### Pasul 1: Update BigQuery cu serialul certificatului

Rulează în **BigQuery Console**:

```sql
-- Update token-ul activ cu serialul certificatului
UPDATE `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
SET
  certificate_serial = '501bf75e00000013b927',
  data_actualizare = CURRENT_TIMESTAMP()
WHERE id = '072c7d85-7159-481a-a9fe-0f182b79536c'
  AND is_active = true;

-- Verificare
SELECT
  id,
  certificate_serial,
  scope,
  is_active,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', expires_at) as expires_at
FROM `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
WHERE is_active = true;
```

**Rezultat așteptat:**
```
✅ certificate_serial = 501bf75e00000013b927
✅ is_active = true
✅ expires_at = 2026-01-13 (89 zile rămase)
```

### Pasul 2: Test upload factură

Rulează în terminal (local):

```bash
cd /home/teodor/PM1-2025-07-17/unitar-admin
node scripts/test-anaf-upload-final.js
```

**Acest test va încerca 3 variante de headers:**
1. Doar `Authorization: Bearer <token>`
2. `Authorization + X-Certificate-Serial`
3. `Authorization + User-Agent custom`

### Pasul 3: Analiză rezultate

#### ✅ Dacă primești SUCCESS (status 200):
```json
{
  "upload_index": "123456789"
}
```
🎉 **PROBLEMA REZOLVATĂ!** e-Factura funcționează!

#### ❌ Dacă primești 401 Unauthorized:
Token-ul OAuth poate fi invalid din cauza:
- Serial certificat incorect
- Token expirat/revocat
- Scope OAuth lipsă pentru e-Factura

**Soluție:** Re-autorizează OAuth:
1. Accesează: `https://admin.unitarproiect.eu/admin/anaf/setup`
2. Click "Revocă Tokens"
3. Click "Conectare OAuth ANAF"
4. Autentifică-te cu certificatul digital `501bf75e00000013b927`
5. Token-ul nou va fi salvat automat cu serialul corect

#### ⚠️ Dacă primești 400 Bad Request:
✅ **Autentificarea merge!** Problema e în XML-ul facturilor.
Verifică generatorul XML UBL 2.1 din aplicație.

---

## 📁 FIȘIERE MODIFICATE

### Code Changes:
- ✅ `app/api/anaf/upload-invoice/route.ts` - Fix validare token JWT
- ✅ `app/api/anaf/oauth/callback/route.ts` - Salvare serial certificat

### Scripts de test:
- ✅ `scripts/test-anaf-token-decrypt.js` - Test decriptare token
- ✅ `scripts/test-anaf-hello-api.js` - Test API ANAF Hello endpoint
- ✅ `scripts/test-anaf-upload-simple.js` - Test upload factură simplă
- ✅ `scripts/test-anaf-upload-final.js` - **TEST FINAL cu variante headers**
- ✅ `scripts/update-anaf-token-serial.sql` - Update BigQuery serial certificat

---

## 🔍 INFORMAȚII TEHNICE CHEIE

### Serial Certificat Digital:
```
Serial: 501bf75e00000013b927
Valabil până: 2 iulie 2028
```

### Token OAuth ANAF:
```
Format: OAuth2 opaque token (64 caractere hex)
NU este JWT clasic (header.payload.signature)
Exemplu: 2c27acef802e833db51c234bf76b5a72c354646ddae6931d0c5b06445fc48bca
```

### Documentație ANAF:
- OAuth flow: `/docs/e-factura-Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf`
- API e-Factura: `/docs/prezentare api efactura.pdf`

**Citat cheie din documentație:**
> "Utilizatorii aplicației sunt identificați în cazul sistemelor e-Factura prin **serialul certificatului digital calificat** folosit pentru obținerea token-ului OAuth."

---

## 📊 VERIFICĂRI DE SIGURANȚĂ

### 1. Verifică encryption/decryption:
```bash
node scripts/test-anaf-token-decrypt.js
```
**Așteptat:** ✅ Token decriptat corect, lungime 64 chars

### 2. Verifică token în BigQuery:
```sql
SELECT
  id,
  certificate_serial,
  LEFT(access_token, 50) as token_preview,
  expires_at,
  is_active
FROM `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
WHERE is_active = true;
```
**Așteptat:**
- ✅ `certificate_serial = '501bf75e00000013b927'`
- ✅ `access_token` începe cu IV hex (32 chars) + `:` + encrypted data
- ✅ `is_active = true`
- ✅ `expires_at > CURRENT_TIMESTAMP()`

### 3. Verifică format XML generat:
```bash
node scripts/test-anaf-upload-final.js 2>&1 | grep "Invoice ID"
```
**Așteptat:** `✅ Invoice ID: TEST-FINAL-1234567890`

---

## 🎯 NEXT STEPS DACĂ TOT PRIMEȘTI 401

### Opțiunea 1: Re-autorizare OAuth (RECOMANDAT)
1. Portal ANAF: https://pfinternet.anaf.ro
2. Verifică aplicația ta OAuth
3. Verifică că ai scope "RO e-Factura"
4. Re-autorizează din `/admin/anaf/setup`

### Opțiunea 2: Contactează ANAF Support
Email: asistenta.tehnica@anaf.ro

**Întrebări de pus:**
1. Cum se extrage serialul certificatului din OAuth flow?
2. Token-ul OAuth conține deja serialul sau trebuie trimis separat?
3. Există header special pentru OAuth2 uploads?
4. Exemple de implementare OAuth + upload facturi?

### Opțiunea 3: Verifică portal ANAF
1. Login: https://pfinternet.anaf.ro (cu certificatul digital)
2. Navighează la "Dezvoltatori aplicații"
3. Verifică configurare client OAuth:
   - Client ID corect?
   - Redirect URI corect?
   - Scope "RO e-Factura" activat?
4. Verifică certificat înrolat în SPV:
   - Serial `501bf75e00000013b927` înregistrat?
   - Rol: Reprezentant legal/Imputernicit/Reprezentant desemnat?

---

## 📞 CONTACT & DEBUG

### Logs Vercel:
1. Accesează: https://vercel.com/unitarproiect/admin/logs
2. Caută: "ANAF Upload" sau "401 Unauthorized"
3. Verifică: token preview, serial certificat, endpoint URL

### Environment Variables (Vercel):
```
ANAF_TOKEN_ENCRYPTION_KEY=599aba34872cd6c46e44dfecea4544ba8aa4cbb5522331e0e23e16293823a8bb
ANAF_CERTIFICATE_SERIAL=501bf75e00000013b927
ANAF_CLIENT_ID=994cfebf0bc0b5e6707420dbe9c62edd0c58d20f4bb1eb68
ANAF_REDIRECT_URI=https://admin.unitarproiect.eu/api/anaf/oauth/callback
ANAF_OAUTH_BASE=https://logincert.anaf.ro
UNITAR_CUI=35639210
BIGQUERY_USE_V2_TABLES=true
```

---

## ✅ CHECKLIST FINAL

- [x] Fix validare JWT în upload-invoice/route.ts
- [x] Salvare serial certificat în callback/route.ts
- [x] Script SQL pentru update BigQuery
- [x] Script test final cu variante headers
- [ ] **UPDATE BigQuery cu serial certificat** ← FAI ASTA ACUM!
- [ ] **RUN test-anaf-upload-final.js** ← APOI TESTEAZĂ!
- [ ] Verifică rezultat (SUCCESS sau 401)
- [ ] Dacă 401 → Re-autorizare OAuth
- [ ] Dacă SUCCESS → Deploy la Vercel

---

**AUTOR:** Claude Code
**CONTACT ANAF:** asistenta.tehnica@anaf.ro
**DOCUMENTAȚIE:** https://mfinante.gov.ro/ro/web/efactura/informatii-tehnice
