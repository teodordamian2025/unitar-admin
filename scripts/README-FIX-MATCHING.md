# 🔧 SCRIPTURI FIX MATCHING TRANZACȚII - INSTRUCȚIUNI

**DATA IMPLEMENTARE**: 09.11.2025 (ora României)
**AUTOR**: Claude Code (ghidat de utilizator)

---

## 📋 CONTEXT

Sistemul de matching automat nu funcționa pentru tranzacțiile Smart Fintech din următoarele motive:

1. **Status NULL**: Tranzacțiile Smart Fintech au `status = NULL`, excluse de filtrul SQL
2. **CUI Greșit**: extractCUI() extragea numere de facturi în loc de CUI-uri reale
3. **Facturi Lipsă**: Facturile simple (fără contract) nu erau în EtapeFacturi_v2

---

## ✅ MODIFICĂRI PERMANENTE (cod)

Următoarele modificări au fost deja implementate în cod și vor funcționa automat pentru **date viitoare**:

### 1. Smart Fintech Sync (`/app/api/tranzactii/smartfintech/sync/route.ts`)
- ✅ Status explicit: `status: 'smartfintech'`
- ✅ extractCUI() îmbunătățit cu pattern "Fiscal Registration Number"
- ✅ CUI enrichment din Clienti_v2 cu Levenshtein matching (85%)

### 2. Generate Hibrid (`/app/api/actions/invoices/generate-hibrid/route.ts`)
- ✅ Inserare automată facturi simple în EtapeFacturi_v2
- ✅ tip_etapa: 'factura_directa' pentru identificare

### 3. Auto-Match (`/app/api/tranzactii/auto-match/route.ts`)
- ✅ Scoring dinamic: **cu CUI** (suma 40p, nume 10p, ref 5p) vs **fără CUI** (suma 45p, nume 30p, ref 10p)
- ✅ Threshold dinamic: 70% cu CUI, 80% fără CUI
- ✅ Filtru SQL actualizat: include status NULL și 'smartfintech'

### 4. Manual-Match (`/app/api/tranzactii/manual-match/route.ts`)
- ✅ Filtru SQL fix: `(status IS NULL OR status != 'matched')`

### 5. CUI Matcher Library (`/lib/cui-matcher.ts` - NOU)
- ✅ matchCUIFromClienti() - matching Clienti_v2 cu Levenshtein 85%
- ✅ normalizeCompanyName() - remove SRL/SA/PFA
- ✅ levenshteinSimilarity() - algoritm similaritate

---

## 🔨 SCRIPTURI FIX DATE EXISTENTE

Pentru **datele existente** în BigQuery, rulează următoarele scripturi în **ordine**:

---

## SCRIPT 1: Fix Status Smart Fintech

**Fișier**: `scripts/fix-smartfintech-status.sql`

**Scop**: Actualizează status NULL → 'smartfintech' pentru cele ~122 tranzacții existente din Smart Fintech API

### Pași de rulare:

1. **Deschide BigQuery Console**: https://console.cloud.google.com/bigquery
2. **Selectează proiectul**: `hale-mode-464009-i6`
3. **Copiază conținutul** fișierului `fix-smartfintech-status.sql`

#### PASUL 1: DRY-RUN (verificare)
```sql
-- Decomentează secțiunea "PASUL 1" din script
-- Verifică câte tranzacții vor fi modificate
SELECT
  id, data_procesare, suma, directie,
  nume_contrapartida, cui_contrapartida,
  status, matching_tip, account_id
FROM `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
WHERE account_id = '2045'
  AND (status IS NULL OR status != 'smartfintech')
ORDER BY data_procesare DESC;
```

**Expected output**: ~122 rows cu status = NULL

#### PASUL 2: UPDATE (execuție)
```sql
-- Rulează secțiunea "PASUL 2" (UPDATE statement)
UPDATE `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
SET
  status = 'smartfintech',
  matching_tip = CASE
    WHEN matching_tip IS NULL THEN 'none'
    ELSE matching_tip
  END,
  data_actualizare = CURRENT_TIMESTAMP()
WHERE account_id = '2045'
  AND status IS NULL;
```

**Expected output**: `Modified 122 rows` (aprox.)

#### PASUL 3: VERIFICARE
```sql
-- Decomentează secțiunea "PASUL 3"
-- Verifică statistici după update
SELECT
  status, matching_tip,
  COUNT(*) as total_tranzactii,
  SUM(CASE WHEN directie = 'intrare' THEN 1 ELSE 0 END) as incasari,
  SUM(CASE WHEN directie = 'iesire' THEN 1 ELSE 0 END) as plati
FROM `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
WHERE account_id = '2045'
GROUP BY status, matching_tip
ORDER BY status;
```

**Expected output**:
- status = 'smartfintech', matching_tip = 'none': ~122 rows
- (Tranzacțiile deja matched rămân cu status = 'matched')

---

## SCRIPT 2: Migrare Facturi Simple

**Fișier**: `scripts/migrate-facturi-simple-to-etape.sql`

**Scop**: Inserează toate facturile simple (fără etape contract) în EtapeFacturi_v2 pentru matching

### Pași de rulare:

1. **Deschide BigQuery Console** (același ca mai sus)
2. **Copiază conținutul** fișierului `migrate-facturi-simple-to-etape.sql`

#### PASUL 1: DRY-RUN (verificare)
```sql
-- Decomentează secțiunea "PASUL 1" din script
-- Identifică facturile care vor fi migrate
SELECT
  fg.id as factura_id, fg.serie, fg.numar,
  fg.data_factura, fg.client_nume,
  fg.total as factura_total, fg.proiect_id
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
  ON fg.id = ef.factura_id AND ef.activ = TRUE
WHERE ef.id IS NULL
  AND fg.status != 'anulata'
  AND fg.total > 0
ORDER BY fg.data_factura DESC;
```

**Expected output**: Lista facturi simple fără etape (ex: DANLUX, HANDRAGEL, RAX, etc.)

#### PASUL 2: INSERT (execuție)
```sql
-- Rulează secțiunea "PASUL 2" (INSERT statement)
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
(
  id, proiect_id, etapa_id, anexa_id, tip_etapa, subproiect_id,
  factura_id, valoare, moneda, valoare_ron, curs_valutar,
  data_curs_valutar, procent_din_etapa, data_facturare,
  status_incasare, valoare_incasata, activ, versiune,
  data_creare, creat_de
)
SELECT
  CONCAT('EF_SIMPLE_MIGRATE_', fg.id, '_', UNIX_MILLIS(CURRENT_TIMESTAMP())) as id,
  fg.proiect_id, NULL as etapa_id, NULL as anexa_id,
  'factura_directa' as tip_etapa, NULL as subproiect_id,
  fg.id as factura_id, fg.total as valoare, 'RON' as moneda,
  fg.total as valoare_ron, 1.0 as curs_valutar,
  fg.data_factura as data_curs_valutar, 100.0 as procent_din_etapa,
  fg.data_factura as data_facturare, 'Neincasat' as status_incasare,
  0.0 as valoare_incasata, TRUE as activ, 1 as versiune,
  CURRENT_TIMESTAMP() as data_creare,
  'Migration_Script_Facturi_Simple' as creat_de
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
  ON fg.id = ef.factura_id AND ef.activ = TRUE
WHERE ef.id IS NULL
  AND fg.status != 'anulata'
  AND fg.total > 0;
```

**Expected output**: `Inserted X rows` (număr facturi simple găsite)

#### PASUL 3: VERIFICARE
```sql
-- Decomentează secțiunea "PASUL 3"
-- Statistici facturi migrate
SELECT
  tip_etapa,
  COUNT(*) as total_etape,
  COUNT(DISTINCT factura_id) as facturi_distincte,
  SUM(valoare_ron) as total_valoare_ron
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
WHERE tip_etapa = 'factura_directa' AND activ = TRUE
GROUP BY tip_etapa;
```

**Expected output**: Statistici cu toate facturile simple migrate

---

## 🧪 TESTARE POST-SCRIPTURI

După rularea ambelor scripturi, testează sistemul:

### Test 1: Manual-Match UI
```bash
# Deschide în browser:
http://localhost:3000/admin/tranzactii/matching
```

**Expected**: Să afișeze **toate 261 tranzacții** (inclusiv cele 122 Smart Fintech)

### Test 2: Auto-Match API
```bash
curl -X POST http://localhost:3000/api/tranzactii/auto-match \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "min_confidence": 70}'
```

**Expected**:
- `totalTransactions: 261` (toate tranzacțiile, inclusiv Smart Fintech)
- `candidatesEtapeFacturi: X` (include acum și facturile simple)
- `matchesFound: Y` (matching-uri găsite cu scoring dinamic)

### Test 3: Verificare Matching
```bash
curl -X POST http://localhost:3000/api/tranzactii/auto-match \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "min_confidence": 70}'
```

**Expected**: Matching-uri aplicate automat cu notificări admin

---

## 🔄 ROLLBACK (dacă este nevoie)

### Rollback Script 1 (Status)
```sql
UPDATE `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
SET status = NULL, matching_tip = NULL, data_actualizare = CURRENT_TIMESTAMP()
WHERE account_id = '2045' AND status = 'smartfintech';
```

### Rollback Script 2 (Facturi)
```sql
DELETE FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
WHERE tip_etapa = 'factura_directa'
  AND creat_de = 'Migration_Script_Facturi_Simple';
```

---

## 📊 REZULTATE AȘTEPTATE

După implementarea completă:

✅ **Dashboard** (`/admin/tranzactii/dashboard`):
- Toate 261 tranzacții vizibile
- Status corect pentru Smart Fintech: 'smartfintech'

✅ **Matching** (`/admin/tranzactii/matching`):
- Matching automat funcțional pentru toate tipurile de tranzacții
- Scoring dinamic bazat pe disponibilitatea CUI
- Threshold adaptat: 70% cu CUI, 80% fără CUI

✅ **Facturi Simple**:
- Toate facturile fără contract au etape în EtapeFacturi_v2
- tip_etapa = 'factura_directa' pentru identificare
- Matching automat funcționează pentru acestea

✅ **CUI-uri**:
- Tranzacții noi: CUI-uri corecte din extractCUI() îmbunătățit
- CUI-uri lipsă: enrichment automat din Clienti_v2 (85% threshold)
- Scoring ajustat automat când CUI lipsește

---

## 📝 NOTE IMPORTANTE

1. **Scripturile sunt IDEMPOTENTE** - poți rula din nou fără să creezi duplicate
2. **Ordinea contează** - rulează Script 1 înainte de Script 2
3. **DRY-RUN întotdeauna** - verifică mai întâi ce va fi modificat
4. **Backup-uri** - BigQuery păstrează istoric automat, dar notează timestamp-ul modificărilor
5. **Monitorizare** - după scripturi, monitorizează logs-urile auto-match pentru erori

---

## 🆘 TROUBLESHOOTING

### Problem: "Nu găsește tranzacții Smart Fintech"
**Soluție**: Verifică `account_id` în BigQuery - ar putea fi diferit de '2045'

### Problem: "Auto-match nu găsește match-uri"
**Soluție**:
- Verifică CUI-urile în tranzacții (PASUL 1 Script 1)
- Verifică că facturile au etape în EtapeFacturi_v2 (PASUL 1 Script 2)
- Rulează cu `tolerance_percent: 5` pentru toleranță mai mare

### Problem: "Eroare la INSERT în Script 2"
**Soluție**:
- Verifică că FacturiGenerate_v2 și EtapeFacturi_v2 există
- Verifică că tabelele au structura corectă (_v2 tables)

---

## ✅ CHECKLIST IMPLEMENTARE

- [ ] Script 1: DRY-RUN (verificare)
- [ ] Script 1: UPDATE (execuție)
- [ ] Script 1: VERIFICARE (statistici)
- [ ] Script 2: DRY-RUN (verificare)
- [ ] Script 2: INSERT (execuție)
- [ ] Script 2: VERIFICARE (statistici)
- [ ] Test Manual-Match UI (261 tranzacții vizibile)
- [ ] Test Auto-Match API (dry_run: true)
- [ ] Test Auto-Match API (dry_run: false - aplicare efectivă)
- [ ] Monitorizare logs pentru erori
- [ ] Verificare notificări admin pentru matching-uri

---

**ULTIMA ACTUALIZARE**: 09.11.2025 - Implementare completă testată local ✅
