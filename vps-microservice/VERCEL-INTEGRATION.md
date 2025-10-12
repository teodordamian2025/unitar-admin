# 🔗 INTEGRARE VERCEL CU VPS MICROSERVICE

**Modificări necesare în aplicația principală pentru a folosi VPS-ul**

---

## 📋 MODIFICĂRI NECESARE

### 1. Environment Variables Vercel

Adaugă în Vercel Dashboard → Settings → Environment Variables:

```
VPS_UPLOAD_URL=http://IP_SERVER_TAU:3001
VPS_API_KEY=<API_KEY generat pe VPS>
```

**IMPORTANT:** După adăugare, fă **Redeploy** manual!

---

### 2. Modificare `/app/api/anaf/upload-invoice/route.ts`

Înlocuiește funcția `uploadToANAF` cu versiunea VPS:

```typescript
async function uploadToANAF(
  xmlContent: string,
  accessToken: string,  // NU MAI E FOLOSIT - păstrat pentru backward compatibility
  facturaId: string,
  attemptNumber: number
): Promise<UploadResult> {
  try {
    console.log(`🚀 Uploading via VPS microservice (attempt ${attemptNumber + 1})...`);

    const vpsUrl = process.env.VPS_UPLOAD_URL;
    const vpsApiKey = process.env.VPS_API_KEY;

    if (!vpsUrl || !vpsApiKey) {
      throw new Error('VPS configuration missing - VPS_UPLOAD_URL or VPS_API_KEY not set');
    }

    // Trimite la VPS microservice
    const response = await fetch(`${vpsUrl}/upload-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': vpsApiKey
      },
      body: JSON.stringify({
        xml: xmlContent,
        cif: process.env.UNITAR_CUI || '35639210',
        facturaId
      }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    const responseData = await response.json();

    console.log(`📥 VPS Response (status ${response.status}):`, responseData);

    // Success case
    if (response.ok && responseData.success) {
      return {
        success: true,
        facturaId,
        anafUploadId: responseData.anafUploadId,
        status: 'anaf_processing',
        message: 'Factura uploaded successfully to ANAF via VPS',
        attemptNumber: attemptNumber + 1,
        shouldRetry: false,
        nextRetryAt: null
      };
    }

    // Error case
    const errorCategory = categorizeANAFError(response.status, responseData);
    const newAttemptNumber = attemptNumber + 1;
    const retryAfter = getRetryInterval(newAttemptNumber, errorCategory);
    const shouldRetry = !shouldStopRetrying(newAttemptNumber, errorCategory, false);
    const nextRetryAt = shouldRetry ? calculateNextRetryAt(newAttemptNumber, errorCategory) : null;

    return {
      success: false,
      facturaId,
      status: 'anaf_error',
      message: responseData.error || 'VPS upload failed',
      errorCategory,
      retryAfter,
      attemptNumber: newAttemptNumber,
      shouldRetry,
      nextRetryAt
    };

  } catch (error) {
    console.error('❌ VPS upload exception:', error);

    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const errorCategory = errorMessage.includes('timeout') ? 'vps_timeout' : 'vps_connection';
    const newAttemptNumber = attemptNumber + 1;
    const retryAfter = getRetryInterval(newAttemptNumber, errorCategory);
    const shouldRetry = !shouldStopRetrying(newAttemptNumber, errorCategory, false);
    const nextRetryAt = shouldRetry ? calculateNextRetryAt(newAttemptNumber, errorCategory) : null;

    return {
      success: false,
      facturaId,
      status: 'error',
      message: errorMessage,
      errorCategory,
      retryAfter,
      attemptNumber: newAttemptNumber,
      shouldRetry,
      nextRetryAt
    };
  }
}
```

**Diferențe față de versiunea anterioară:**
- ✅ Nu mai folosește OAuth token (certificatul e pe VPS)
- ✅ Trimite request la VPS în loc de direct la ANAF
- ✅ Trimite XML-ul generat + CUI
- ✅ Primește înapoi `anafUploadId` de la VPS
- ✅ Păstrează același error handling & retry logic

---

### 3. Actualizare `categorizeANAFError` pentru erori VPS

Adaugă categoria `vps_connection` și `vps_timeout`:

```typescript
function categorizeANAFError(statusCode: number, responseData: any): string {
  // Erori VPS (noi)
  if (statusCode === 500 && responseData.type === 'exception') {
    return 'vps_connection';
  }

  // Erori ANAF (existente)
  if (statusCode === 401 || statusCode === 403) {
    return 'oauth_expired'; // Acum înseamnă certificat invalid
  }
  if (statusCode === 408 || statusCode === 504) {
    return 'anaf_timeout';
  }
  if (statusCode >= 500) {
    return 'anaf_server_error';
  }
  if (statusCode === 400) {
    if (responseData.message?.includes('XML')) {
      return 'xml_validation';
    }
    return 'anaf_business_error';
  }
  return 'unknown_error';
}
```

---

### 4. Actualizare `getRetryStrategy` pentru erori VPS

Adaugă strategii de retry pentru VPS:

```typescript
function getRetryStrategy(errorCategory: string): number[] {
  const retryStrategies: Record<string, number[]> = {
    // Erori VPS (noi)
    'vps_connection': [0, 2, 5, 10, 20], // Retry rapid - 5 încercări
    'vps_timeout': [0, 5, 10, 20], // Medium - 4 încercări

    // Erori ANAF (existente)
    'oauth_expired': [], // STOP - certificat invalid (necesită reinoire)
    'anaf_connection': [0, 5, 10, 20, 40, 120],
    'anaf_timeout': [0, 5, 10, 20, 40, 120],
    'anaf_server_error': [0, 60, 240, 1440],
    'xml_validation': [],
    'anaf_business_error': [],
    'unknown_error': [0, 10, 30, 60, 120]
  };

  return retryStrategies[errorCategory] || [0, 10, 30, 60];
}
```

---

### 5. Update `shouldStopRetrying` pentru VPS

Adaugă condiție pentru erori permanente VPS:

```typescript
function shouldStopRetrying(attemptNumber: number, errorCategory: string, success: boolean): boolean {
  if (success) return true;

  // Erori permanente → STOP imediat
  const permanentErrors = [
    'oauth_expired',      // Certificat invalid/expirat
    'xml_validation',     // XML invalid
    'anaf_business_error' // Eroare business ANAF
  ];
  if (permanentErrors.includes(errorCategory)) return true;

  // Max retries pentru categoria respectivă → STOP
  const strategy = getRetryStrategy(errorCategory);
  if (attemptNumber >= strategy.length) return true;

  return false;
}
```

---

## 🧪 TESTARE INTEGRARE

### Test 1: Verificare VPS disponibil

```typescript
// Adaugă în upload-invoice/route.ts (temporar pentru debug):
console.log('🔍 VPS Config Check:', {
  url: process.env.VPS_UPLOAD_URL,
  hasApiKey: !!process.env.VPS_API_KEY
});
```

### Test 2: Upload factură

1. Creează factură în aplicație
2. Click "Trimite la ANAF"
3. Verifică Vercel Logs:
   ```
   🚀 Uploading via VPS microservice (attempt 1)...
   📥 VPS Response (status 200): { success: true, anafUploadId: "..." }
   ```
4. Verifică VPS Logs:
   ```bash
   pm2 logs anaf-upload --lines 50
   # Ar trebui să vezi:
   # 📤 Upload invoice request received
   # ✅ Upload successful
   ```

### Test 3: Error handling

**Scenariul A: VPS offline**
- Stop VPS: `pm2 stop anaf-upload`
- Încearcă upload → Ar trebui error `vps_connection`
- Verifică retry logic activat

**Scenariul B: API Key invalid**
- Modifică temporar API Key în Vercel (greșit)
- Încearcă upload → Ar trebui 401 Unauthorized
- Verifică AnafErrorLog_v2 conține eroarea

---

## 📊 MONITORING

### Verificare status VPS din Vercel

Adaugă endpoint de health check în Vercel (opțional):

```typescript
// app/api/anaf/vps-health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.VPS_UPLOAD_URL}/health`, {
      headers: { 'X-API-Key': process.env.VPS_API_KEY || '' }
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      vps: data
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'VPS unreachable'
    }, { status: 500 });
  }
}
```

Accesează: `https://admin.unitarproiect.eu/api/anaf/vps-health`

---

## 🔒 SECURITATE

### Whitelist Vercel IP-uri pe VPS (opțional extra)

```bash
# Pe VPS, în /etc/nginx/sites-available/anaf-upload:

# Vercel IP ranges (actualizează periodic de pe vercel.com/docs)
allow 76.76.21.0/24;
allow 76.223.126.0/24;
deny all;
```

### Rotație API Key (lunar)

```bash
# 1. Generează key nou pe VPS
openssl rand -hex 32

# 2. Adaugă în .env pe VPS (păstrează și vechiul temporar)
OLD_API_KEY=<vechiul key>
API_KEY=<noul key>

# 3. Restart microservice
pm2 restart anaf-upload

# 4. Update în Vercel Environment Variables
# VPS_API_KEY=<noul key>

# 5. Redeploy Vercel

# 6. După 1 oră (când cache-ul Vercel expiră), șterge OLD_API_KEY din .env
```

---

## 📝 CHECKLIST INTEGRARE

- [ ] VPS_UPLOAD_URL setat în Vercel
- [ ] VPS_API_KEY setat în Vercel
- [ ] Vercel redeployat
- [ ] upload-invoice/route.ts modificat (funcția uploadToANAF)
- [ ] categorizeANAFError actualizat
- [ ] getRetryStrategy actualizat
- [ ] shouldStopRetrying actualizat
- [ ] Test upload factură → SUCCESS
- [ ] Test error handling (VPS offline) → RETRY logic OK
- [ ] Verificat logs Vercel + VPS → toate OK
- [ ] Health check endpoint (opțional) creat

---

**GATA! Integrarea Vercel ↔ VPS este completă!** ✅
