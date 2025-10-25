# 📋 TESTING PLAN - iApp.ro PDF Download & Backup

**Data implementare**: 25.10.2025
**Feature**: Download automat PDF-uri facturi primite din iapp.ro în Google Drive

---

## ✅ VERIFICARE FIȘIERE IMPLEMENTATE

### 1. **SQL Script BigQuery**
- ✅ Locație: `/scripts/iapp-add-auto-download-pdfs.sql`
- ✅ Verificat: Fișierul există (1,985 bytes)
- 📝 Conține 3 comenzi separate pentru:
  - ADD COLUMN `auto_download_pdfs_iapp` BOOLEAN
  - ALTER COLUMN SET DEFAULT TRUE
  - UPDATE pentru row-uri existente

### 2. **Library Helpers**
- ✅ Locație: `/lib/iapp-facturi-primite.ts`
- ✅ Verificat: Funcții implementate la liniile:
  - `downloadPdfFromIapp()` - linia 418
  - `generatePdfFileName()` - linia 445
  - `uploadPdfToIappDrive()` - linia 475

### 3. **Sync Route cu PDF Download**
- ✅ Locație: `/app/api/iapp/facturi-primite/sync/route.ts`
- ✅ Verificat: Logica PDF download integrată (liniile 169-203)
- ✅ Counter `pdfsDescarcate` implementat
- ✅ Rate limiting 500ms între download-uri

### 4. **Backfill Endpoint**
- ✅ Locație: `/app/api/iapp/facturi-primite/download-pdfs/route.ts`
- ✅ Verificat: Fișierul există (5,344 bytes)
- ✅ Procesează max 50 facturi per request

### 5. **UI Toggle Setări**
- ✅ Locație: `/app/admin/setari/efactura/page.tsx`
- ✅ Toggle vizibil doar când `sursa_facturi_primite = 'iapp'`
- ✅ Default value: TRUE

### 6. **Config API Routes**
- ✅ Locație: `/app/api/iapp/config/route.ts`
- ✅ GET endpoint: Include `auto_download_pdfs_iapp` în SELECT
- ✅ PUT endpoint: Include `auto_download_pdfs_iapp` în UPDATE

### 7. **GitHub Actions Workflow**
- ✅ Locație: `/.github/workflows/iapp-facturi-sync.yml`
- ✅ Verificat: Fișierul există (2,328 bytes)
- ✅ Schedule: `cron: '0 1 * * *'` (01:00 GMT zilnic)
- ✅ Manual trigger: `workflow_dispatch` disponibil

---

## 🔧 SETUP NECESAR ÎNAINTE DE TESTARE

### **PASUL 1: Rulează SQL Script în BigQuery Console**

```bash
# 1. Conectează-te la BigQuery Console:
https://console.cloud.google.com/bigquery?project=hale-mode-464009-i6

# 2. Deschide fișierul:
scripts/iapp-add-auto-download-pdfs.sql

# 3. Rulează FIECARE comandă SEPARAT (sunt 3 comenzi):

# Comanda 1: ADD COLUMN
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ADD COLUMN IF NOT EXISTS auto_download_pdfs_iapp BOOLEAN
OPTIONS(description='Download automat PDF-uri facturi primite din iapp.ro în Google Drive (arhivare min 5 ani)');

# Comanda 2: SET DEFAULT
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ALTER COLUMN auto_download_pdfs_iapp SET DEFAULT TRUE;

# Comanda 3: UPDATE EXISTING ROWS
UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
SET auto_download_pdfs_iapp = TRUE
WHERE auto_download_pdfs_iapp IS NULL;
```

### **PASUL 2: Verifică Coloana a fost creată**

```sql
SELECT
  id,
  email_responsabil,
  sursa_facturi_primite,
  auto_download_pdfs_iapp,
  activ
FROM `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
WHERE activ = TRUE
LIMIT 1;
```

**Output așteptat:**
- `auto_download_pdfs_iapp` = `TRUE`

---

## 🧪 PLAN DE TESTARE END-TO-END

### **TEST 1: Config API - Verifică Field Nou**

```bash
# GET config - ar trebui să returneze auto_download_pdfs_iapp
curl http://localhost:3000/api/iapp/config | python3 -m json.tool

# Output așteptat:
{
  "success": true,
  "config": {
    "tip_facturare": "iapp",
    "sursa_facturi_primite": "iapp",
    "auto_download_pdfs_iapp": true,  # ← VERIFICĂ ACEST CÂMP
    ...
  }
}
```

**Status actual**: ❌ EROARE - Coloana nu există încă în BigQuery
**După SQL migration**: ✅ Ar trebui să funcționeze

---

### **TEST 2: UI Toggle Setări**

```bash
# 1. Deschide browser:
open http://localhost:3000/admin/setari/efactura

# 2. Verificări vizuale:
✅ Toggle "💾 Download automat PDF-uri în Google Drive" apare
✅ Badge "RECOMANDAT" este vizibil
✅ Lista de beneficii (4 check items) este afișată
✅ Toggle este checked by default
✅ Toggle dispare când schimbi la "ANAF Direct"

# 3. Test funcțional:
- Dezactivează toggle → Save → Verifică că se salvează FALSE
- Reactivează toggle → Save → Verifică că se salvează TRUE
```

---

### **TEST 3: Sync Endpoint - Download PDFs (cu flag ON)**

```bash
# Presupunând că există facturi noi în ultimele 7 zile:
curl -X POST http://localhost:3000/api/iapp/facturi-primite/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 7}' | python3 -m json.tool

# Output așteptat:
{
  "success": true,
  "message": "Successfully synced X new invoices from iapp.ro",
  "stats": {
    "total_iapp": 12,
    "facturi_noi": 2,
    "facturi_salvate": 2,
    "pdfs_descarcate": 2,  # ← VERIFICĂ ACEST COUNTER
    "facturi_asociate": 1,
    "processingTime": 5420
  },
  "facturi": ["SERIE1", "SERIE2"]
}

# Verifică în Google Drive:
# Calea: "Facturi Primite ANAF/iapp.ro/2025/10/"
# Ar trebui să apară: FURNIZOR_SERIE_DATA.pdf
```

**Verificări suplimentare:**
```sql
-- În BigQuery, verifică google_drive_file_id:
SELECT
  id,
  serie_numar,
  nume_emitent,
  google_drive_file_id,
  data_factura
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiPrimiteANAF_v2`
WHERE observatii LIKE '%iapp.ro%'
  AND google_drive_file_id IS NOT NULL
ORDER BY data_preluare DESC
LIMIT 5;
```

---

### **TEST 4: Sync Endpoint - NO Download (cu flag OFF)**

```bash
# 1. Dezactivează flag în UI sau SQL:
UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
SET auto_download_pdfs_iapp = FALSE
WHERE activ = TRUE;

# 2. Rulează sync din nou:
curl -X POST http://localhost:3000/api/iapp/facturi-primite/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 7}' | python3 -m json.tool

# Output așteptat:
{
  "stats": {
    ...
    "pdfs_descarcate": 0,  # ← AR TREBUI SĂ FIE 0
  }
}

# Consolă log așteptat:
# "ℹ️ [iapp.ro] Download PDF dezactivat (flag OFF)"
```

---

### **TEST 5: Backfill Endpoint - Download PDFs Existente**

```bash
# Scenariul: Ai 100 facturi vechi fără google_drive_file_id

# 1. Verifică câte facturi sunt eligibile:
SELECT COUNT(*)
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiPrimiteANAF_v2`
WHERE observatii LIKE '%iapp.ro%'
  AND (google_drive_file_id IS NULL OR google_drive_file_id = '')
  AND activ = TRUE;

# 2. Rulează backfill pentru primele 10:
curl -X POST http://localhost:3000/api/iapp/facturi-primite/download-pdfs \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' | python3 -m json.tool

# Output așteptat:
{
  "success": true,
  "message": "Downloaded 10 PDFs from 10 invoices",
  "stats": {
    "procesate": 10,
    "descarcate": 10,  # Sau mai puțin dacă unele au erori
    "erori": 0,
    "processingTime": 8500
  }
}

# 3. Verifică în BigQuery:
SELECT
  serie_numar,
  nume_emitent,
  google_drive_file_id,
  LENGTH(google_drive_file_id) as id_length
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiPrimiteANAF_v2`
WHERE observatii LIKE '%iapp.ro%'
  AND google_drive_file_id IS NOT NULL
ORDER BY data_preluare DESC
LIMIT 10;

# google_drive_file_id ar trebui să fie un string de ~30 chars (Drive file ID)
```

**Rate limiting**: 500ms între download-uri → 10 facturi = ~5-6 secunde minim

---

### **TEST 6: Google Drive Folder Structure**

```bash
# Verifică structura folderelor în Google Drive Desktop sync:

# Calea locală (dacă ai Drive Desktop sync):
ls -la ~/Google\ Drive/Facturi\ Primite\ ANAF/iapp.ro/2025/10/

# Ar trebui să vezi:
# MBODRIVE_SRL_6992_2025-10-21.pdf
# ALTFURNIZOR_SERIE123_2025-10-15.pdf

# Verifică dimensiunea fișierelor:
du -sh ~/Google\ Drive/Facturi\ Primite\ ANAF/iapp.ro/2025/10/*.pdf

# Ar trebui să fie între 50KB - 500KB per PDF
```

---

### **TEST 7: GitHub Actions Workflow - Manual Trigger**

```bash
# 1. Push workflow file la GitHub:
git add .github/workflows/iapp-facturi-sync.yml
git commit -m "🔧 Add: GitHub Actions cron pentru sincronizare iapp.ro facturi primite"
git push origin main

# 2. Deschide GitHub Actions:
# https://github.com/YOUR_REPO/actions

# 3. Selectează workflow "iApp Facturi Primite - Sync Zilnic"

# 4. Click "Run workflow" → Branch: main → Run workflow

# 5. Verifică output în job logs:
# ✅ Trigger-ul POST la /api/iapp/facturi-primite/sync
# ✅ Stats: facturi_noi, pdfs_descarcate
# ✅ HTTP Status: 200
```

**Schedule automat**: Workflow-ul va rula automat la **01:00 GMT** (03:00-04:00 AM România)

---

## 🐛 TROUBLESHOOTING

### **Problem: "Unrecognized name: auto_download_pdfs_iapp"**

**Cauză**: Coloana nu există în BigQuery
**Soluție**: Rulează SQL migration script (Pasul 1 din Setup)

---

### **Problem: PDFs nu se descarcă (pdfs_descarcate = 0)**

**Verificări**:
```bash
# 1. Verifică flag în BigQuery:
SELECT auto_download_pdfs_iapp FROM IappConfig_v2 WHERE activ = TRUE;
# → Ar trebui TRUE

# 2. Verifică log-uri server pentru erori:
# Caută: "⚠️ [iapp.ro] Nu s-a putut descărca PDF"

# 3. Verifică linkuri PDF în observatii:
SELECT observatii FROM FacturiPrimiteANAF_v2
WHERE observatii LIKE '%iapp.ro%'
LIMIT 1;
# → Ar trebui să conțină "PDF: https://my.iapp.ro/share/..."
```

---

### **Problem: BigQuery streaming buffer error**

**Mesaj eroare**:
```
UPDATE or DELETE statement over table ... would affect rows
in the streaming buffer, which is not supported
```

**Cauză**: Încerci să UPDATE-zi row-uri inserate în ultimele 90 secunde
**Soluție**: **IGNORĂ** - Această eroare este **non-critică** și deja gestionată în cod cu `try-catch`

---

### **Problem: Google Drive upload fail**

**Verificări**:
```bash
# 1. Verifică service account permissions:
# → Service account trebuie să aibă Editor pe folder "Facturi Primite ANAF"

# 2. Verifică .env.local:
GOOGLE_CLOUD_PROJECT_ID=hale-mode-464009-i6
GOOGLE_CLOUD_CLIENT_EMAIL=...
GOOGLE_CLOUD_PRIVATE_KEY=...

# 3. Test Google Drive API:
curl http://localhost:3000/api/test/google-drive
# → Ar trebui să returneze lista folderelor
```

---

## 📊 METRICI DE SUCCES

### **Implementare completă = ✅ dacă:**

- ✅ SQL script rulat în BigQuery fără erori
- ✅ Config API returnează `auto_download_pdfs_iapp: true`
- ✅ Toggle apare în UI setări e-factura
- ✅ Sync endpoint cu flag ON: `pdfs_descarcate > 0`
- ✅ Google Drive conține PDFs în folder `iapp.ro/YYYY/MM/`
- ✅ BigQuery rows au `google_drive_file_id` populat
- ✅ Backfill endpoint procesează facturi vechi cu succes
- ✅ GitHub Actions workflow rulează manual fără erori

### **Performance targets:**

- Download PDF: < 2s per factură
- Upload Google Drive: < 1s per PDF
- Sync 10 facturi: < 30s total (cu rate limiting 500ms)
- Backfill 50 facturi: < 2 minute (cu rate limiting)

---

## 📝 CHECKLIST FINAL

**Înainte de deploy production:**

- [ ] SQL migration executat în BigQuery
- [ ] Coloana `auto_download_pdfs_iapp` verificată în tabel
- [ ] Config API testată local (returnează field nou)
- [ ] UI toggle testat (salvează TRUE/FALSE corect)
- [ ] Sync endpoint testat cu flag ON (descarcă PDFs)
- [ ] Sync endpoint testat cu flag OFF (skip download)
- [ ] Google Drive folder structure verificată
- [ ] Backfill endpoint testat (min 5 facturi)
- [ ] GitHub Actions workflow push-uită la repo
- [ ] Workflow manual trigger testat
- [ ] Zero breaking changes în funcționalități existente

**După deploy production:**

- [ ] Monitorizare cron job zilnic (01:00 GMT)
- [ ] Verificare Google Drive space usage (50-200 MB/lună)
- [ ] Review logs pentru erori download PDF
- [ ] Testare lunară backfill pentru recuperare facturi vechi

---

## 🎯 CONCLUZIE

**STATUS FINAL**: ✅ Implementare 100% completă, gata pentru deploy după SQL migration

**NEXT STEPS**:
1. Rulează SQL migration în BigQuery (CRITICAL - blocking)
2. Testează toate scenariile de mai sus
3. Push la GitHub pentru activare cron job
4. Monitorizare primele 2-3 rulări cron job

**ESTIMAT TIMP TESTARE**: 30-45 minute total
