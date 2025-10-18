# GitHub Actions Setup - Cron Jobs

## Motiv: Vercel Hobby Plan Limitations

Vercel Hobby plan permite doar **2 cron jobs per account** cu execuție **max 1x/zi**.
Am mutat cron-urile pe **GitHub Actions** (gratuit, nelimitat).

---

## 🔧 Configurare GitHub Secrets

### Step 1: Generare CRON_SECRET

```bash
# Generează un secret random de 64 caractere:
openssl rand -hex 32
# Output example: 4f8a2b9c1d3e5f7a8b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d0e2f4a6
```

### Step 2: Adaugă Secret în GitHub

1. Intră pe: https://github.com/teodordamian2025/unitar-admin
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CRON_SECRET`
5. Value: `<secretul generat mai sus>`
6. Click "Add secret"

### Step 3: Adaugă aceeași valoare în Vercel Environment Variables

1. Intră pe: https://vercel.com/dashboard
2. Selectează proiectul `unitar-admin`
3. Settings → Environment Variables
4. Add new:
   - Key: `CRON_SECRET`
   - Value: `<același secret ca în GitHub>`
   - Environment: Production (+ Preview + Development - optional)
5. Click "Save"
6. **Redeploy** proiectul pentru ca variabila să fie disponibilă

---

## 📋 Cron Jobs Active

### 1. ANAF Retry Invoices
**File**: `.github/workflows/anaf-retry-cron.yml`
- **Schedule**: La fiecare 10 minute (`*/10 * * * *`)
- **Endpoint**: `GET /api/anaf/retry-invoices/cron`
- **Purpose**: Retry facturi failed ANAF upload

### 2. Smart Fintech Sync
**File**: `.github/workflows/smartfintech-cron.yml`
- **Schedule**: La fiecare 6 ore (`0 0,6,12,18 * * *`) - 00:00, 06:00, 12:00, 18:00 UTC
- **Endpoint**: `POST /api/tranzactii/smartfintech/cron`
- **Purpose**: Sincronizare automată tranzacții bancare
- **Auth**: Requires `CRON_SECRET` header

---

## 🚀 Manual Trigger (Testing)

### Din GitHub UI:

1. Intră pe: https://github.com/teodordamian2025/unitar-admin/actions
2. Selectează workflow-ul dorit (ANAF sau Smart Fintech)
3. Click "Run workflow" → "Run workflow" (buton verde)
4. Verifică rezultatul în tab-ul "Actions"

### Din CLI (cu GitHub CLI):

```bash
# Trigger ANAF cron:
gh workflow run anaf-retry-cron.yml

# Trigger Smart Fintech cron:
gh workflow run smartfintech-cron.yml
```

---

## 📊 Monitoring

### Check Workflow Runs:

https://github.com/teodordamian2025/unitar-admin/actions

### View Logs:

1. Actions tab → Select workflow run
2. Click pe job name (`retry-invoices` sau `sync-smartfintech`)
3. Expand steps pentru log details

### Success Indicators:

- ✅ Green checkmark în Actions tab
- HTTP 200 response în logs
- "completed successfully" message

### Failure Handling:

- ❌ Red X în Actions tab
- Email notification la repo owner (default GitHub behavior)
- Check API logs în Vercel pentru detalii

---

## 🔐 Security Best Practices

1. **CRON_SECRET**: Păstrează secret-ul în GitHub Secrets și Vercel env vars (NICIODATĂ în cod)
2. **API Endpoint**: Verifică `Authorization: Bearer ${CRON_SECRET}` în `/api/tranzactii/smartfintech/cron`
3. **Rate Limiting**: GitHub Actions are rate limits (2000 request/hour), suficient pentru cron-uri

---

## 🐛 Troubleshooting

### Workflow nu rulează:

1. Check dacă repo-ul este **public** sau **private**:
   - Public: Unlimited GitHub Actions minutes
   - Private: 2000 minutes/month (gratuit)

2. Verifică GitHub Actions enabled:
   - Repo Settings → Actions → General
   - "Allow all actions and reusable workflows" (selected)

3. Check CRON_SECRET:
   ```bash
   # Test manual API call:
   curl -X POST https://admin.unitarproiect.eu/api/tranzactii/smartfintech/cron \
     -H "Authorization: Bearer YOUR_CRON_SECRET"

   # Expected: HTTP 200 + JSON response
   ```

### Workflow failed:

1. Check logs în Actions tab
2. Verifică API endpoint este accessible (nu e în maintenance)
3. Check Vercel function logs pentru erori backend

---

## 📅 Cron Schedule Reference

```
# Format: minute hour day month weekday
#
# Examples:
*/10 * * * *        # Every 10 minutes
0 0,6,12,18 * * *   # Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
0 0 * * *           # Every day at midnight UTC
0 */2 * * *         # Every 2 hours
0 9 * * 1-5         # Every weekday at 9 AM UTC
```

**IMPORTANT**: GitHub Actions folosește **UTC timezone**, nu București (UTC+3).

---

## ✅ Post-Setup Checklist

- [ ] `CRON_SECRET` adăugat în GitHub Secrets
- [ ] `CRON_SECRET` adăugat în Vercel Environment Variables
- [ ] Vercel proiect redeployed după adăugare env var
- [ ] Test manual trigger din GitHub Actions tab
- [ ] Verificat logs pentru success/failure
- [ ] Monitorizat primul cron automat run

---

**Data setup**: 18.10.2025
**Configurat de**: Claude Code
**Cost**: $0/lună (100% gratuit pe GitHub Actions)
