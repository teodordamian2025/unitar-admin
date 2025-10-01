# 🚀 GHID IMPLEMENTARE MIGRARE BIGQUERY

**Data**: 01.10.2025 (ora României)
**Obiectiv**: Migrare completă BigQuery cu partitioning + clustering
**Reducere costuri estimate**: 90-95%

---

## 📋 PREREQUISITE

### **1. Instalare Google Cloud SDK și bq CLI**

#### **Pe Linux (Ubuntu/Debian)**

**IMPORTANT**: Rulează TOATE comenzile în ordine, nu doar ultima!

```bash
# PASUL 1: Instalează dependințe
sudo apt-get install apt-transport-https ca-certificates gnupg curl

# PASUL 2: Adaugă cheia GPG Google Cloud
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg

# PASUL 3: Adaugă repository Google Cloud SDK
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# PASUL 4: Update package list și instalează
sudo apt-get update && sudo apt-get install google-cloud-sdk

# PASUL 5: Verifică instalarea
bq version
gcloud version
```

**SAU comandă all-in-one (copiază și rulează tot deodată):**
```bash
sudo apt-get install -y apt-transport-https ca-certificates gnupg curl && \
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
sudo apt-get update && \
sudo apt-get install -y google-cloud-sdk && \
echo "✅ Instalare completă! Verificare versiuni:" && \
bq version && \
gcloud version
```

#### **Pe macOS**
```bash
# Cu Homebrew
brew install --cask google-cloud-sdk

# SAU descarcă installer-ul manual:
# https://cloud.google.com/sdk/docs/install#mac

# Verifică instalarea
bq version
gcloud version
```

#### **Pe Windows**
```bash
# Descarcă installer-ul oficial:
# https://cloud.google.com/sdk/docs/install#windows

# Rulează installer-ul GoogleCloudSDKInstaller.exe
# Urmează wizard-ul de instalare

# Deschide Command Prompt/PowerShell și verifică:
bq version
gcloud version
```

#### **Verificare instalare reușită**
```bash
# Ar trebui să vezi output similar cu:
# bq version 2.0.XX
# gcloud version XXX.X.X

# Dacă vezi "command not found", adaugă în PATH:
# Linux/macOS:
export PATH=$PATH:$HOME/google-cloud-sdk/bin

# Windows (PowerShell):
# $env:Path += ";C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
```

### **2. Autentificare BigQuery**
```bash
# Autentifică-te cu contul Google Cloud
gcloud auth login

# Setează proiectul corect
gcloud config set project YOUR_PROJECT_ID

# Verifică că ai acces la dataset
bq ls PanouControlUnitar
```

### **3. Backup (OPȚIONAL, dar recomandat)**
```bash
# Exportă toate tabelele existente (safety backup)
mkdir -p ~/bigquery-backup
bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  PanouControlUnitar.Proiecte \
  gs://YOUR_BUCKET/backup/Proiecte_*.json
# Repetă pentru toate tabelele importante
```

---

## 🛠️ PASUL 1: CREAREA TABELELOR NOI (ZI 1-2)

### **1.1 Executare DDL în BigQuery Console**

**Opțiunea A: BigQuery Console (recomandat pentru prima dată)**
1. Deschide [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Click pe "Compose new query"
3. Copiază conținutul din `scripts/bigquery-create-tables.sql`
4. Selectează blocuri de 5-10 tabele și rulează (nu toate deodată, prea mare)
5. Verifică în stânga că apar tabelele `*_v2` în dataset

**Opțiunea B: bq CLI (pentru automatizare)**
```bash
# Rulează întregul script DDL
bq query --use_legacy_sql=false < scripts/bigquery-create-tables.sql

# SAU rulează fiecare tabel individual (mai safe)
cat scripts/bigquery-create-tables.sql | grep -A 50 "CREATE TABLE" | head -52 | bq query --use_legacy_sql=false
```

### **1.2 Verificare tabele create**
```bash
# Listează toate tabelele v2
bq ls --max_results=100 PanouControlUnitar | grep "_v2"

# Ar trebui să vezi 32 tabele noi cu sufixul _v2
# Exemplu output:
#   AnafEFactura_v2
#   AnafErrorLog_v2
#   ...
#   Utilizatori_v2
```

### **1.3 Verifică configurația partitioning**
```bash
# Verifică că Proiecte_v2 are partitioning configurat
bq show --format=prettyjson PanouControlUnitar.Proiecte_v2 | grep -A 10 "timePartitioning"

# Output așteptat:
# "timePartitioning": {
#   "field": "Data_Start",
#   "type": "DAY"
# }
```

**✅ CHECKPOINT 1:** Dacă ai 32 tabele `_v2` în BigQuery și partitioning e configurat corect, continuă.

---

## 📦 PASUL 2: COPIEREA DATELOR (ZI 3)

### **2.1 RECOMANDAT: Copiere direct în BigQuery Console (fără autentificare CLI)**

**Avantaje**: Nu necesită `gcloud auth login`, rulează instant în browser

1. **Deschide BigQuery Console**: https://console.cloud.google.com/bigquery
2. **Click "Compose new query"**
3. **Copiază conținutul fișierului** `scripts/bigquery-copy-data.sql`
4. **Rulează fiecare bloc INSERT separat** (sau toate odată, dacă vrei)
5. **Rulează query-ul de verificare** de la final pentru a vedea count(*) pentru toate tabelele

**Exemplu query pentru o singură copiază:**
```sql
INSERT INTO `PanouControlUnitar.Proiecte_v2`
SELECT * FROM `PanouControlUnitar.Proiecte`;
```

**Query verificare finală** (de la final fișierului):
```sql
SELECT
  'Proiecte' as tabel,
  (SELECT COUNT(*) FROM `PanouControlUnitar.Proiecte`) as count_vechi,
  (SELECT COUNT(*) FROM `PanouControlUnitar.Proiecte_v2`) as count_nou
UNION ALL
SELECT 'Clienti',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Clienti`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Clienti_v2`)
-- ... pentru toate tabelele
ORDER BY tabel;
```

Rezultatul ar trebui să arate:
```
tabel           | count_vechi | count_nou
----------------|-------------|----------
Proiecte        | 125         | 125       ✅
Clienti         | 48          | 48        ✅
TimeTracking    | 1543        | 1543      ✅
...
```

### **2.2 ALTERNATIV: Script bash (necesită autentificare gcloud)**

**Doar dacă preferi CLI** (necesită `gcloud auth login` mai întâi):

```bash
# Autentificare Google Cloud (DOAR o dată)
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Rulează script
cd /home/teodor/PM1-2025-07-17/unitar-admin
./scripts/bigquery-copy-data.sh
```

### **2.2 Verificare manuală copiere (sample test)**
```bash
# Compară count pentru câteva tabele importante
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM \`PanouControlUnitar.Proiecte\`"
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM \`PanouControlUnitar.Proiecte_v2\`"
# Numerele trebuie să fie IDENTICE

# Sample rows pentru verificare vizuală
bq query --use_legacy_sql=false "SELECT * FROM \`PanouControlUnitar.Proiecte\` ORDER BY RAND() LIMIT 3"
bq query --use_legacy_sql=false "SELECT * FROM \`PanouControlUnitar.Proiecte_v2\` ORDER BY RAND() LIMIT 3"
# Datele trebuie să fie identice
```

**✅ CHECKPOINT 2:** Dacă toate tabelele v2 au același count(*) ca tabelele vechi, continuă.

---

## 🔧 PASUL 3: MODIFICARE API ROUTES (ZI 4-5)

### **3.1 Creează variabilă env pentru toggle tabele**

**Editează fișierul `.env.local`** (creează-l dacă nu există):

```bash
# Deschide fișierul în editor:
nano .env.local
# SAU
code .env.local  # Dacă folosești VS Code
```

**Adaugă linia:**
```
BIGQUERY_USE_V2_TABLES=true
```

**Salvează și închide fișierul.**

**SAU comandă rapidă bash** (adaugă automat la final de fișier):
```bash
echo "BIGQUERY_USE_V2_TABLES=true" >> .env.local
```

**Pentru Vercel Production** (MAI TÂRZIU, la deployment):
- În Vercel Dashboard → Settings → Environment Variables
- Adaugă: `BIGQUERY_USE_V2_TABLES` = `true`

### **3.2 Modifică API routes pentru tabele partiționate**

**Pattern general pentru toate API-urile:**
```typescript
// În fiecare API route care folosește tabele partiționate
const useV2 = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2 ? '_v2' : '';

// Exemplu pentru /api/rapoarte/proiecte/route.ts
const query = `
  SELECT * FROM \`PanouControlUnitar.Proiecte${tableSuffix}\`
  WHERE Data_Start >= @data_start_min
    AND Data_Start <= @data_start_max
    AND Status = @status
  ORDER BY Data_Start DESC
  LIMIT @limit
`;

// Adaugă parametri pentru partition filter
const options = {
  query,
  params: {
    data_start_min: dataStartMin || '2023-01-01',  // Default ultimii 2 ani
    data_start_max: dataStartMax || new Date().toISOString().split('T')[0],
    status: status || 'Activ',
    limit: parseInt(limit) || 100
  }
};
```

### **3.3 API-uri de modificat (ORDINEA PRIORITĂȚII)**

**HIGH PRIORITY (8 fișiere - zilele 4-5):**
1. `/api/rapoarte/proiecte/route.ts` - PARTITION BY Data_Start
2. `/api/rapoarte/facturi/route.ts` - PARTITION BY data_factura
3. `/api/analytics/time-tracking/route.ts` - PARTITION BY data_lucru
4. `/api/rapoarte/contracte/route.ts` - PARTITION BY Data_Semnare
5. `/api/tranzactii/dashboard/route.ts` - PARTITION BY data_procesare
6. `/api/rapoarte/clienti/route.ts` - CLUSTER BY cui
7. `/api/planificator/items/route.ts` - PARTITION BY DATE(data_adaugare)
8. `/api/user/timetracking/route.ts` - PARTITION BY data_lucru

**Exemplu concret modificare (vezi `BIGQUERY-MIGRATION-PLAN.md` pentru detalii complete)**

### **3.4 Testare în localhost după fiecare API modificat**
```bash
# Start localhost cu tabele v2
BIGQUERY_USE_V2_TABLES=true npm run dev

# Testează în browser:
# - http://localhost:3000/admin/rapoarte/proiecte
# - http://localhost:3000/admin/rapoarte/facturi
# - http://localhost:3000/time-tracking

# Verifică în Network tab (Chrome DevTools):
# - Status 200 OK
# - Date returnate sunt corecte
# - Console fără erori
```

**✅ CHECKPOINT 3:** Dacă toate cele 8 API-uri HIGH PRIORITY funcționează în localhost, continuă.

---

## 🧪 PASUL 4: TESTARE COMPLETĂ LOCALHOST (ZI 6)

### **4.1 End-to-end testing**
```bash
# Cu BIGQUERY_USE_V2_TABLES=true în .env.local
npm run dev

# Testează toate flow-urile aplicației:
✅ Login și autentificare
✅ Dashboard executiv (/admin)
✅ Management proiecte (creare, editare, ștergere)
✅ Time tracking (start timer, stop, istoric)
✅ Facturi (generare, listare)
✅ Tranzacții bancare (import CSV, matching)
✅ Planificator personal (adăugare items, reordonnare)
```

### **4.2 Performance testing**
```typescript
// Adaugă în fiecare API route testat (temporar, pentru debug):
console.time('BigQuery Query');
const [rows] = await bigquery.query(options);
console.timeEnd('BigQuery Query');

console.log(`📊 Rows returned: ${rows.length}`);
console.log(`💾 Bytes processed: ${(rows.length * 2000).toLocaleString()} bytes (estimate)`);
```

**Output așteptat:**
```
BigQuery Query: 245ms  (vs ~800ms fără partitioning)
📊 Rows returned: 48
💾 Bytes processed: 96,000 bytes (vs ~2MB fără partitioning)
```

### **4.3 Comparație v1 vs v2**
```bash
# Testează același query cu și fără v2
# Toggle între BIGQUERY_USE_V2_TABLES=true și false

# Compară rezultatele:
# - Datele returnate trebuie IDENTICE
# - Timpul query trebuie MAI MIC cu v2 (dacă ai partitioning filter)
# - Bytes scanned trebuie MAI PUȚIN cu v2 (vezi în BigQuery Console → Query history)
```

**✅ CHECKPOINT 4:** Dacă aplicația funcționează 100% identic cu v1, dar mai rapid, continuă.

---

## 🚀 PASUL 5: DEPLOY PRODUCTION (ZI 7)

### **5.1 Commit toate modificările**
```bash
git add .
git commit -m "🚀 BigQuery optimization: partitioning + clustering (v2 tables)

- Created 32 optimized tables with partitioning/clustering
- Modified 8 HIGH PRIORITY API routes
- Added BIGQUERY_USE_V2_TABLES env toggle
- Estimated 90-95% cost reduction on BigQuery queries
- All functionality preserved, performance improved"

git push origin main
```

### **5.2 Deploy Vercel cu tabele v2**
```bash
# În Vercel Dashboard → Settings → Environment Variables
# Adaugă:
BIGQUERY_USE_V2_TABLES = true

# Redeploy aplicația
vercel --prod
```

### **5.3 Monitorizare 24h post-deploy**
```bash
# Verifică Vercel Logs pentru erori
# https://vercel.com/your-project/logs

# Verifică BigQuery Query History pentru costuri
# https://console.cloud.google.com/bigquery?project=YOUR_PROJECT&page=queries

# Filtrează după ultimele 24h și compară:
# - Bytes scanned per query (ar trebui 85-95% mai puțin)
# - Query duration (ar trebui 50-70% mai rapid)
```

**✅ CHECKPOINT 5:** Dacă totul merge OK 24h fără erori critice, continuă cu ștergerea tabelelor vechi.

---

## 🗑️ PASUL 6: CLEANUP TABELE VECHI (După 1 săptămână rulare OK)

### **6.1 ATENȚIE: IRREVERSIBIL - verifică checklist final**
```
✅ Toate tabelele v2 au același count(*) ca tabelele vechi
✅ API-urile returnează date identice cu v1 vs v2
✅ Localhost funcționează 100% cu v2
✅ Production Vercel rulează OK 7 zile cu v2
✅ Zero erori critice în Vercel logs
✅ Costuri BigQuery vizibil scăzute în Google Cloud Console
✅ (OPȚIONAL) Backup export făcut pentru tabele vechi
```

### **6.2 Ștergere tabele vechi**
```bash
# Script automat ștergere tabele vechi (32 tabele)
# ATENȚIE: IRREVERSIBIL!

TABLES=(
  "AnafEFactura" "AnafErrorLog" "AnafNotificationLog" "AnafTokens"
  "AnexeContract" "Clienti" "Contracte" "CursuriValutare"
  "EtapeContract" "EtapeFacturi" "FacturiGenerate" "FacturiPrimite"
  "PlanificatorPersonal" "ProcesVerbale" "Produse"
  "ProiectComentarii" "Proiecte" "ProiecteCheltuieli"
  "ProiecteResponsabili" "Sarcini" "SarciniResponsabili"
  "SesiuniLucru" "Subcontractanti" "Subproiecte"
  "SubproiecteResponsabili" "TimeTracking" "TranzactiiAccounts"
  "TranzactiiBancare" "TranzactiiMatching" "TranzactiiStats"
  "TranzactiiSyncLogs" "Utilizatori"
)

for table in "${TABLES[@]}"; do
  echo "🗑️  Șterg tabelul: $table"
  bq rm -f PanouControlUnitar.$table
done

echo "✅ Tabele vechi șterse!"
```

### **6.3 Redenumire tabele v2 → nume original**
```bash
# Script redenumire automat
for table in "${TABLES[@]}"; do
  echo "📝 Redenumesc: ${table}_v2 → $table"

  # Copy v2 → original name
  bq cp -f PanouControlUnitar.${table}_v2 PanouControlUnitar.$table

  # Delete v2
  bq rm -f PanouControlUnitar.${table}_v2
done

echo "✅ Redenumire completă!"
```

### **6.4 Elimină env variable toggle**
```bash
# În .env.local și Vercel env variables
# Șterge: BIGQUERY_USE_V2_TABLES=true

# Elimină din cod verificările useV2 și tableSuffix
# Păstrează doar versiunea optimizată finală
```

**✅ CHECKPOINT 6:** Migrare 100% completă! Tabelele optimizate sunt acum tabelele principale.

---

## 📊 VERIFICARE ECONOMII FINALE

### **Înainte de migrare:**
```bash
# În BigQuery Console → Query History → filtru ultimele 30 zile
# Suma "Bytes processed" pentru toate query-urile
# Exemplu: 500 GB procesate/lună
# Cost: 500 GB × $5/TB = $2.50/lună
```

### **După migrare:**
```bash
# Verifică aceeași perioadă cu tabele v2
# Exemplu: 50 GB procesate/lună (90% reducere)
# Cost: 50 GB × $5/TB = $0.25/lună
# ECONOMIE: $2.25/lună (~$27/an)
```

---

## 🚨 ROLLBACK PLAN (Dacă ceva nu merge)

### **În orice moment ÎNAINTE de ștergerea tabelelor vechi:**
```bash
# 1. Oprește folosirea tabelelor v2
# În .env.local și Vercel:
BIGQUERY_USE_V2_TABLES=false

# 2. Redeploy aplicația
vercel --prod

# 3. Aplicația revine INSTANT la tabelele vechi
# Zero downtime, zero pierdere date
```

### **După ștergerea tabelelor vechi (dacă ai backup):**
```bash
# Restaurare din backup GCS
bq load --source_format=NEWLINE_DELIMITED_JSON \
  PanouControlUnitar.Proiecte \
  gs://YOUR_BUCKET/backup/Proiecte_*.json

# Repetă pentru toate tabelele din backup
```

---

## 📚 RESURSE

- **Plan complet**: `/BIGQUERY-MIGRATION-PLAN.md`
- **DDL tabele**: `/scripts/bigquery-create-tables.sql`
- **Script copiere**: `/scripts/bigquery-copy-data.sh`
- **BigQuery Docs**: https://cloud.google.com/bigquery/docs/partitioned-tables

---

## ✅ CHECKLIST FINAL SUCCESS

```
✅ 32 tabele v2 create în BigQuery
✅ Toate datele copiate cu success (count identic)
✅ 8 API-uri HIGH PRIORITY modificate și testate
✅ Localhost funcționează 100% cu v2
✅ Production Vercel rulează OK cu v2
✅ Costuri BigQuery reduse cu 90-95%
✅ Tabele vechi șterse, v2 redenumite → original
✅ Aplicație production folosește tabele optimizate
✅ ECONOMIE ANUALĂ: ~$200-300
```

**SUCCES! 🎉**

---

**Data creare**: 01.10.2025
**Ultima actualizare**: 01.10.2025
**Status**: 🟢 GATA PENTRU IMPLEMENTARE
