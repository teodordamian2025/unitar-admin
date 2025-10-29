# 📤 FACTURI EMISE ANAF - Ghid Setup & Utilizare

**Data implementare**: 29.10.2025
**Status**: ✅ Production Ready

---

## 🎯 Descriere Sistem

Sistem complet pentru sincronizare automată a **facturilor EMISE** în ANAF prin **iapp.ro API**. Similar cu sistemul pentru facturi primite, dar adaptat pentru facturile pe care le-ați emis către clienți.

### **Ce face sistemul:**
- ✅ Sincronizare automată zilnică (02:00 GMT = 04:00-05:00 AM România)
- ✅ Download ZIP-uri (XML + PDF) în Google Drive
- ✅ Detectează statusuri ANAF: CONFIRMAT, DESCARCAT, EROARE
- ✅ Identifică facturile cu erori de validare ANAF
- ✅ Dashboard admin cu filtrare și statistici
- ✅ Diferențiere automată: serie UPA (emise) vs furnizori (primite)

---

## 📋 PAȘI SETUP (RUN ONCE)

### **PASUL 1: Creează Tabel BigQuery**

1. **Deschide Google Cloud Console**:
   ```
   https://console.cloud.google.com/bigquery
   ```

2. **Selectează project**: `hale-mode-464009-i6`

3. **Rulează script SQL**:
   ```bash
   # Locație script:
   /scripts/iapp-facturi-emise-create-table.sql
   ```

4. **Verificare tabel creat**:
   ```sql
   SELECT COUNT(*) as total
   FROM `PanouControlUnitar.FacturiEmiseANAF_v2`;

   -- Ar trebui să returneze: total = 0 (tabel gol inițial)
   ```

### **PASUL 2: Activează GitHub Actions Workflow**

Workflow-ul este deja creat în: `.github/workflows/iapp-facturi-emise-sync.yml`

**Cron schedule**: `0 2 * * *` = **02:00 GMT** (04:00-05:00 AM România)

**Verificare**:
1. Mergi la: https://github.com/<your-repo>/actions
2. Ar trebui să vezi workflow-ul: "iApp Facturi Emise - Sync Zilnic"
3. **Test manual**: Click "Run workflow" → "Run workflow"

### **PASUL 3: Verifică Configurare iapp.ro**

Sistemul **reutilizează** configurarea existentă din `IappConfig_v2` (aceleași credențiale ca pentru facturi primite).

**Verificare în BigQuery**:
```sql
SELECT email_responsabil, auto_download_pdfs_iapp, activ
FROM `PanouControlUnitar.IappConfig_v2`
WHERE activ = TRUE
LIMIT 1;
```

**Așteptat**:
- `email_responsabil`: contact@unitarproiect.eu (sau altul)
- `auto_download_pdfs_iapp`: TRUE (download automat ZIP-uri)
- `activ`: TRUE

---

## 🚀 TESTARE SISTEM

### **Test 1: Sincronizare Manuală**

```bash
# Test API sync (ultimele 7 zile)
curl -X POST https://admin.unitarproiect.eu/api/iapp/facturi-emise/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 7}'
```

**Răspuns așteptat**:
```json
{
  "success": true,
  "message": "Successfully synced X new invoices from iapp.ro",
  "stats": {
    "total_iapp": 36,
    "facturi_noi": 5,
    "facturi_duplicate": 31,
    "facturi_salvate": 5,
    "zips_descarcate": 5,
    "facturi_erori_anaf": 1,
    "facturi_confirmate": 4,
    "processingTime": 12500
  },
  "facturi": [
    "CLIENT NAME - CONFIRMAT",
    "..."
  ]
}
```

### **Test 2: Verifică în BigQuery**

```sql
-- Vezi toate facturile sincronizate
SELECT
  serie_numar,
  nume_client,
  data_factura,
  valoare_totala,
  status_anaf,
  trimisa_de
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE activ = TRUE
ORDER BY data_factura DESC
LIMIT 10;
```

### **Test 3: Verifică Google Drive**

**Locație fișiere**:
```
Facturi Primite ANAF/
└── Facturi Emise/     ← Folder NOU pentru emise
    └── 2025/
        └── 10/
            ├── UPA001_2025-10-25.zip
            ├── UPA002_2025-10-23.zip
            └── ...
```

**Diferențiere automată**:
- **Facturi EMISE**: `UPA001_2025-10-25.zip` (serie UPA)
- **Facturi PRIMITE**: `FURNIZOR_SERIE_DATA.pdf` (nume furnizor)

### **Test 4: UI Dashboard**

1. **Deschide**: https://admin.unitarproiect.eu/admin/financiar/facturi-emise

2. **Verifică**:
   - ✅ Stats cards (total facturi, valoare, statusuri)
   - ✅ Tabel cu facturi emise
   - ✅ Filtre (search, status, trimisă de, date)
   - ✅ Status badges (CONFIRMAT = verde, EROARE = roșu)
   - ✅ Link Google Drive (📦 icon)

3. **Test "Sincronizare Manuală"**:
   - Click buton "🔄 Sincronizare Manuală"
   - Ar trebui să apară toast: "✅ Sincronizare completă! X facturi noi..."
   - Tabelul se reîncarcă automat

---

## 📊 DIFERENȚE: Facturi EMISE vs PRIMITE

| Feature | Facturi PRIMITE | Facturi EMISE |
|---------|-----------------|---------------|
| **Contrapartidă** | Furnizori (emitent) | Clienți (destinatar) |
| **Serie** | Variată (furnizori) | UPA-xxx (serie UNITAR) |
| **Status ANAF** | ❌ Nu | ✅ **CONFIRMAT, DESCARCAT, EROARE** |
| **Trimisă De** | ❌ Nu | ✅ **Sistem, Extern, User name** |
| **Erori ANAF** | ❌ Nu | ✅ **Mesaj eroare validare** |
| **Folder Drive** | `iapp.ro/` | `Facturi Emise/` |
| **Use Case** | Cheltuieli (expenses) | Venituri (revenues) |

---

## 🔔 ALERTĂ ERORI ANAF

Sistemul detectează automat facturile cu **erori de validare ANAF** (status = EROARE).

### **Exemplu eroare comună**:

```
Status: EROARE
Mesaj: [BR-CO-10]-Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131).
```

**Semnificație**: Suma liniilor factură nu corespunde cu totalul factură → factura a fost **RESPINSĂ** de ANAF.

### **Acțiuni recomandate**:

1. **Verifică în dashboard**:
   - Filtru: Status = "⚠ Eroare ANAF"
   - Click ℹ️ icon pentru mesaj detaliat

2. **Corectează factura**:
   - În soft-ul de facturare care a generat XML-ul
   - Re-emite factura corectată în ANAF

3. **Monitoring zilnic**:
   - GitHub Actions workflow afișează: `⚠️ WARNING: X facturi cu erori ANAF`
   - Vezi logs: https://github.com/<your-repo>/actions

---

## 🎯 STATUSURI ANAF EXPLICATE

| Status | Badge | Semnificație | Acțiune |
|--------|-------|--------------|---------|
| **CONFIRMAT** | 🟢 ✓ Confirmat | Factură acceptată de ANAF | ✅ OK - factură validă |
| **DESCARCAT** | 🔵 ↓ Descărcat | Clientul a descărcat factura | ✅ OK - client conștient |
| **EROARE** | 🔴 ⚠ Eroare ANAF | Factură respinsă (eroare validare) | ❌ ATENȚIE - verifică + corectează |

**Note**:
- Statusurile se actualizează automat la fiecare sincronizare (zilnic)
- Facturile cu erori NU sunt vizibile pentru clienți în ANAF SPV
- După corectare, factura apare ca **nouă** (cu ID nou)

---

## ⏰ CRON SCHEDULE

**Cron Expression**: `0 2 * * *`

**Traducere**:
- `0` = minute (00)
- `2` = oră (02 GMT)
- `*` = zi din lună (orice zi)
- `*` = lună (orice lună)
- `*` = zi din săptămână (orice zi)

**Ora locală România**:
- **Iarnă** (UTC+2): 02:00 GMT = **04:00 AM**
- **Vară** (UTC+3, DST): 02:00 GMT = **05:00 AM**

**De ce 02:00 GMT?**
- Trafic minim pe servere România noaptea
- Răspunsuri mai rapide de la iapp.ro API
- Evită overlap cu cron facturi primite (01:00 GMT)

---

## 🚨 TROUBLESHOOTING

### **Problem 1: Nu apar facturi în dashboard**

**Verificări**:

1. **Tabel BigQuery exists?**
   ```sql
   SELECT COUNT(*) FROM `PanouControlUnitar.FacturiEmiseANAF_v2`;
   ```

2. **Sincronizare rulată?**
   - Check GitHub Actions logs
   - Sau rulează manual: `curl -X POST .../sync`

3. **Interval date corect?**
   - Default: ultimele 90 zile
   - Ajustează filtre în UI

### **Problem 2: Eroare "iapp.ro configuration not found"**

**Soluție**:
```sql
-- Verifică config activ
SELECT * FROM `PanouControlUnitar.IappConfig_v2`
WHERE activ = TRUE;

-- Dacă e NULL sau FALSE, activează:
UPDATE `PanouControlUnitar.IappConfig_v2`
SET activ = TRUE
WHERE cod_firma IS NOT NULL;
```

### **Problem 3: ZIP-uri nu se salvează în Google Drive**

**Verificări**:

1. **Flag auto_download activat?**
   ```sql
   SELECT auto_download_pdfs_iapp
   FROM `PanouControlUnitar.IappConfig_v2`
   WHERE activ = TRUE;

   -- Ar trebui: TRUE
   ```

2. **Google Drive OAuth token valid?**
   ```sql
   SELECT expires_at, activ
   FROM `PanouControlUnitar.GoogleDriveTokens`
   WHERE user_email = 'unitarproiect@gmail.com'
   ORDER BY data_creare DESC
   LIMIT 1;

   -- Ar trebui: activ = TRUE, expires_at > NOW()
   ```

3. **Folder "Facturi Emise" exists?**
   - Check manual în Google Drive
   - Dacă nu, se creează automat la primul upload

### **Problem 4: Cron job nu rulează**

**Verificări**:

1. **Workflow enabled în GitHub?**
   - Settings → Actions → General → "Allow all actions"

2. **Rulează manual test**:
   - Actions tab → "iApp Facturi Emise - Sync Zilnic" → "Run workflow"

3. **Verifică logs erori**:
   - Click pe run failed → Vezi detalii

---

## 📈 MONITORING & RAPORTARE

### **Dashboard Stats (UI)**

Accesează: `/admin/financiar/facturi-emise`

**Metrici afișate**:
- 📊 **Total Facturi**: Număr total + număr clienți
- 💰 **Valoare Totală**: Sum valoare_ron
- ✅ **Statusuri ANAF**: Confirmate / Descărcate / Erori
- 🕐 **Ultima Sincronizare**: Timestamp last sync

### **Query-uri Utile BigQuery**

**1. Top clienți (ultimele 90 zile)**:
```sql
SELECT
  cif_client,
  nume_client,
  COUNT(*) as total_facturi,
  SUM(valoare_ron) as valoare_totala_ron
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE DATE(data_preluare) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND activ = TRUE
GROUP BY cif_client, nume_client
ORDER BY valoare_totala_ron DESC
LIMIT 10;
```

**2. Facturi cu erori ANAF (luna curentă)**:
```sql
SELECT
  serie_numar,
  nume_client,
  data_factura,
  valoare_totala,
  mesaj_anaf
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE status_anaf = 'EROARE'
  AND EXTRACT(MONTH FROM data_factura) = EXTRACT(MONTH FROM CURRENT_DATE())
  AND EXTRACT(YEAR FROM data_factura) = EXTRACT(YEAR FROM CURRENT_DATE())
  AND activ = TRUE
ORDER BY data_factura DESC;
```

**3. Note de credit (facturi negative)**:
```sql
SELECT
  serie_numar,
  nume_client,
  data_factura,
  valoare_totala,
  tip_document
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE valoare_totala < 0
  AND activ = TRUE
ORDER BY data_factura DESC;
```

---

## 🔐 SECURITATE & BEST PRACTICES

### **1. Credențiale iapp.ro**

- ✅ **Encrypted** în BigQuery (AES-256-CBC)
- ✅ **Shared** între facturi primite și emise
- ✅ **Nu se loggează** în console (doar email responsabil)

### **2. Google Drive Storage**

- ✅ **Folder separat**: `Facturi Emise/` (nu se amestecă cu primite)
- ✅ **Organizare pe an/lună**: `2025/10/`
- ✅ **Nume fișiere unice**: `UPA001_2025-10-25.zip`
- ✅ **OAuth token valid**: Testing mode cu test user = ∞ refresh

### **3. Acces UI**

- ✅ **Doar admini**: Route `/admin/financiar/*` protejată
- ✅ **Firebase Auth**: Verificare sesiune activ
- ✅ **No public access**: Nu există endpoint public

---

## ✅ CHECKLIST POST-SETUP

- [ ] Tabel BigQuery `FacturiEmiseANAF_v2` creat
- [ ] GitHub Actions workflow activ
- [ ] Test sincronizare manuală SUCCESS
- [ ] Verificat facturi în BigQuery
- [ ] Verificat ZIP-uri în Google Drive
- [ ] Test UI dashboard funcțional
- [ ] Cron job rulat cel puțin odată
- [ ] Verificat alerte erori ANAF (dacă există)

---

## 📞 SUPPORT

**Erori frecvente**: Vezi secțiunea TROUBLESHOOTING de mai sus

**Logs GitHub Actions**:
https://github.com/<your-repo>/actions/workflows/iapp-facturi-emise-sync.yml

**Logs Vercel** (dacă folosești Vercel Cron):
https://vercel.com/dashboard → Project → Logs

**BigQuery Console**:
https://console.cloud.google.com/bigquery?project=hale-mode-464009-i6

---

**Data creare document**: 29.10.2025
**Autor**: Claude Code + Teodor Damian
**Versiune**: 1.0

🎉 **Sistem Production Ready!**
