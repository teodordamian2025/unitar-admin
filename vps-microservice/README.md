# 🚀 ANAF Upload Microservice - VPS Deployment

**Microservice Node.js pentru upload automat facturi la ANAF cu certificat digital**

---

## 📋 CUPRINS

1. [Cerințe Preliminare](#cerinte-preliminare)
2. [Setup VPS](#setup-vps)
3. [Instalare Certificat](#instalare-certificat)
4. [Deploy Microservice](#deploy-microservice)
5. [Configurare Vercel](#configurare-vercel)
6. [Testare](#testare)
7. [Monitoring & Maintenance](#monitoring)

---

## 🔧 CERINȚE PRELIMINARE

### Ce ai nevoie:

- [x] VPS Hetzner CX11 (€4.51/lună) - Urmează: `../docs/VPS-SETUP-GUIDE.md`
- [x] Certificat digital exportat în .p12 - Urmează: `../docs/CERTIFICATE-EXPORT-GUIDE.md`
- [x] SSH access la VPS
- [x] Node.js 18+ instalat pe VPS

---

## 🚀 SETUP VPS (30 minute)

### 1. Conectare la VPS

```bash
# Pe Zorin OS, în terminal:
ssh root@IP_SERVER_TAU
```

### 2. Rulare script setup automat

Urmează pașii din `../docs/VPS-SETUP-GUIDE.md`:

```bash
cd ~
nano setup-vps.sh
# Copiază scriptul din ghid
chmod +x setup-vps.sh
./setup-vps.sh
```

**Rezultat:** VPS gata cu Node.js, PM2, Nginx instalate ✅

---

## 🔐 INSTALARE CERTIFICAT (15 minute)

### 1. Export certificat de pe Windows

Urmează `../docs/CERTIFICATE-EXPORT-GUIDE.md` pentru:
- Export certificat în format `.p12`
- Setare parolă export

**Rezultat:** Fișier `unitar-anaf-cert.p12` ✅

### 2. Upload certificat pe VPS

```bash
# Pe Zorin OS:
scp /path/to/unitar-anaf-cert.p12 root@IP_SERVER:/opt/anaf-upload-service/

# Setează permisiuni sigure
ssh root@IP_SERVER
cd /opt/anaf-upload-service
chmod 600 unitar-anaf-cert.p12
chown anaf-service:anaf-service unitar-anaf-cert.p12
```

---

## 📦 DEPLOY MICROSERVICE (10 minute)

### 1. Configurare deploy script

```bash
# Pe Zorin OS, în folderul vps-microservice:
cd /home/teodor/PM1-2025-07-17/unitar-admin/vps-microservice

# Editează deploy.sh
nano deploy.sh

# Modifică linia:
VPS_IP="128.140.82.123"  # Pune IP-ul tău VPS

# Salvează: Ctrl+O, Enter, Ctrl+X
```

### 2. Generare API Key

```bash
# Generează API Key securizat (32 bytes = 64 hex chars)
openssl rand -hex 32

# Output (EXEMPLU):
# a7f8c3d2e1b4a5f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# NOTEAZĂ acest key - îl vei folosi în .env
```

### 3. Configurare .env pe VPS

```bash
# Conectat SSH pe VPS:
cd /opt/anaf-upload-service
nano .env

# Adaugă (MODIFICĂ cu valorile tale):
PORT=3001
NODE_ENV=production
API_KEY=a7f8c3d2e1b4a5f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
ALLOWED_ORIGINS=https://admin.unitarproiect.eu,https://unitar-admin.vercel.app
CERT_PATH=./unitar-anaf-cert.p12
CERT_PASSWORD=parola-export-certificat
ANAF_SANDBOX_MODE=false

# Salvează: Ctrl+O, Enter, Ctrl+X

# Setează permisiuni sigure
chmod 600 .env
chown anaf-service:anaf-service .env
```

### 4. Deploy automat

```bash
# Pe Zorin OS, în vps-microservice:
chmod +x deploy.sh
./deploy.sh
```

**Output așteptat:**
```
🚀 Deploying ANAF Upload Microservice to VPS...
==================================================
📦 Step 1/5: Creating deployment package...
📤 Step 2/5: Uploading to VPS...
🔧 Step 3/5: Installing dependencies on VPS...
🔄 Step 4/5: Restarting PM2 service...
✅ Step 5/5: Verifying deployment...

✅ Deployment completed successfully!
```

---

## 🔗 CONFIGURARE VERCEL (5 minute)

### 1. Adaugă environment variable

```
1. Mergi la: https://vercel.com/dashboard
2. Selectează proiectul: unitar-admin
3. Settings → Environment Variables → Add New

Nume: VPS_UPLOAD_URL
Valoare: http://IP_SERVER_TAU:3001

Nume: VPS_API_KEY
Valoare: <API_KEY generat mai sus - ACELAȘI din .env VPS>

4. Click "Save"
5. Click "Redeploy" pentru a aplica variabilele
```

### 2. Modifică Vercel API route

**Fișier:** `app/api/anaf/upload-invoice/route.ts`

Schimbă funcția `uploadToANAF` să trimită la VPS în loc de direct la ANAF:

```typescript
async function uploadToANAF(
  xmlContent: string,
  accessToken: string,  // Nu mai e folosit
  facturaId: string,
  attemptNumber: number
): Promise<UploadResult> {
  try {
    console.log(`🚀 Uploading via VPS microservice (attempt ${attemptNumber + 1})...`);

    // Trimite la VPS microservice
    const response = await fetch(`${process.env.VPS_UPLOAD_URL}/upload-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.VPS_API_KEY || ''
      },
      body: JSON.stringify({
        xml: xmlContent,
        cif: process.env.UNITAR_CUI || '35639210',
        facturaId
      })
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
    const errorCategory = 'vps_connection';
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

---

## 🧪 TESTARE (5 minute)

### 1. Test health endpoint

```bash
# De pe Zorin sau orice browser:
curl http://IP_SERVER_TAU:3001/health

# Output așteptat:
{
  "status": "ok",
  "service": "anaf-upload-microservice",
  "version": "1.0.0",
  "certificateLoaded": true,
  "timestamp": "2025-10-12T16:30:00.000Z"
}
```

### 2. Test certificat

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://IP_SERVER_TAU:3001/test-certificate

# Output ar trebui să conțină detalii certificat:
{
  "success": true,
  "certificate": {
    "subject": [...],
    "issuer": [...],
    "validFrom": "...",
    "validTo": "...",
    "isValid": true
  }
}
```

### 3. Test upload factură din Vercel

```
1. Mergi la aplicația ta: https://admin.unitarproiect.eu
2. Creează o factură nouă
3. Click "Trimite la ANAF"
4. Verifică în Vercel Logs:
   - Ar trebui să vezi: "🚀 Uploading via VPS microservice..."
   - Apoi: "📥 VPS Response (status 200)"
5. Verifică în VPS logs:
   ssh root@IP_SERVER
   pm2 logs anaf-upload --lines 50
   - Ar trebui să vezi: "📤 Upload invoice request received"
   - Apoi: "✅ Upload successful"
```

---

## 📊 MONITORING & MAINTENANCE

### Comenzi PM2 utile

```bash
# Status serviciu
pm2 status

# Logs live
pm2 logs anaf-upload

# Logs ultimele 100 linii
pm2 logs anaf-upload --lines 100

# Restart serviciu
pm2 restart anaf-upload

# Stop serviciu
pm2 stop anaf-upload

# Reîncărcare fără downtime
pm2 reload anaf-upload

# Monitor CPU/RAM real-time
pm2 monit
```

### Verificare certificat expirat

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://IP_SERVER:3001/test-certificate | grep "validTo"

# Dacă certificatul expiră în <30 zile, pregătește certificat nou
```

### Rotație logs

```bash
# Instalare PM2 log rotate
pm2 install pm2-logrotate

# Configurare (max 10MB per fișier, păstrează 7 zile)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🚨 TROUBLESHOOTING

### Problema: "Certificate not loaded"

```bash
# Verifică existență fișier
ssh root@IP_SERVER
ls -lh /opt/anaf-upload-service/unitar-anaf-cert.p12

# Verifică parolă în .env
cat /opt/anaf-upload-service/.env | grep CERT_PASSWORD

# Test manual load certificat
cd /opt/anaf-upload-service
node -e "console.log(require('fs').existsSync('./unitar-anaf-cert.p12'))"
# Ar trebui: true
```

### Problema: "Unauthorized - Invalid API Key"

```bash
# Verifică API Key pe VPS
ssh root@IP_SERVER
cat /opt/anaf-upload-service/.env | grep API_KEY

# Verifică API Key în Vercel
# Vercel Dashboard → Settings → Environment Variables → VPS_API_KEY
# TREBUIE SĂ FIE IDENTICE!
```

### Problema: Port 3001 nu răspunde

```bash
# Verifică firewall
ssh root@IP_SERVER
ufw status
# Ar trebui să vezi: 3001/tcp ALLOW Anywhere

# Dacă nu există:
ufw allow 3001/tcp
ufw reload
```

---

## 📝 CHECKLIST FINAL

- [ ] VPS creat pe Hetzner (CX11, €4.51/lună)
- [ ] Setup VPS complet (Node.js, PM2, Nginx)
- [ ] Certificat .p12 exportat de pe Windows
- [ ] Certificat uploadat pe VPS
- [ ] API Key generat și configurat
- [ ] .env configurat corect pe VPS
- [ ] Microservice deployat cu deploy.sh
- [ ] PM2 status: "online"
- [ ] Health check OK (curl /health)
- [ ] Certificate check OK (curl /test-certificate)
- [ ] VPS_UPLOAD_URL + VPS_API_KEY setate în Vercel
- [ ] Vercel redeployat cu variabilele noi
- [ ] upload-invoice/route.ts modificat să folosească VPS
- [ ] Test upload factură reală → SUCCESS! 🎉

---

**GATA! Ai upload automat facturi la ANAF cu certificat digital!** ✅

**Costuri lunare:** €4.51 (~22 RON)
**Performanță:** < 1 secundă per factură
**Uptime:** 99.9% cu PM2 cluster mode

🚀 **Enjoy automated invoicing!**
