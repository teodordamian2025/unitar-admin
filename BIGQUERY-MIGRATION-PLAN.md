# 📊 PLAN MIGRARE BIGQUERY - PARTITIONING + CLUSTERING

**Data creare**: 01.10.2025 (ora României)
**Obiectiv**: Reducere 90-95% costuri BigQuery prin partitioning pe date + clustering pe coloane filtrate frecvent
**Status**: 🔴 NEÎNCEPUT - Doar date de testare în BD

---

## 🎯 BENEFICII AȘTEPTATE

- **Costuri BigQuery**: Reducere 90-95% (scan doar partițiile necesare)
- **Performanță query-uri**: 5-10x mai rapid pe query-uri cu filtrare pe date
- **Scalabilitate**: Pregătit pentru volume mari de date (100K+ înregistrări)
- **Cost implementare**: **$0** (feature nativ BigQuery, fără servicii externe)
- **Timp implementare**: 5-7 zile

---

## 📋 STRATEGIA DE MIGRARE

### **Abordare**: MIGRARE COMPLETĂ (TOATE TABELELE)

**Motivație**:
- ✅ Doar date de testare în BigQuery (nu există risc pierdere date critice)
- ✅ Evităm confuzia cu tabele v1/v2 amestecate
- ✅ Aplicație consistentă cu query-uri uniforme
- ✅ Perfect timing pentru migrare full

**Proces**:
1. Creăm tabele noi optimizate (`_v2` suffix temporar)
2. Copiem datele din tabele vechi în tabele noi
3. Testăm în localhost cu tabele `_v2`
4. Dacă totul funcționează: ștergem tabele vechi, redenumim `_v2` → nume original
5. Zero downtime pentru producție

---

## 🗂️ CLASIFICARE TABELE (42 TOTAL)

### **CATEGORIA 1: TIME-SERIES - PARTITION + CLUSTER** (18 tabele)
Tabele cu volume mari și filtrare frecventă pe date

| Tabel | PARTITION BY | CLUSTER BY (ordine) | Motivație |
|-------|-------------|---------------------|-----------|
| **AnafEFactura** | `DATE(data_creare)` | `anaf_status, factura_id` | Query-uri după dată upload și status ANAF |
| **AnafErrorLog** | `DATE(timestamp)` | `severity, category, user_id` | Monitoring erori pe zile + filtrare severitate |
| **AnafNotificationLog** | `DATE(timestamp)` | `severity, type, success` | Log notificări pe zile |
| **AnexeContract** | `data_start` | `status_facturare, contract_id, activ` | Anexe per perioadă + status facturare |
| **Contracte** | `Data_Semnare` | `Status, client_id, proiect_id` | Contracte semnate pe perioadă + status |
| **EtapeContract** | `data_creare` | `status_facturare, contract_id, activ` | Etape create pe perioadă + status |
| **EtapeFacturi** | `data_facturare` | `status_incasare, proiect_id, activ` | Facturi emise pe perioadă + status plată |
| **FacturiGenerate** | `data_factura` | `status, client_cui, efactura_status` | Facturi per lună + status plată |
| **FacturiPrimite** | `Data_Emitere` | `Status_Plata, CUI_Furnizor` | Facturi primite pe lună + status |
| **PlanificatorPersonal** | `DATE(data_adaugare)` | `utilizator_uid, tip_item, activ` | Planificator per utilizator pe zile |
| **ProcesVerbale** | `data_predare` | `status_predare, proiect_id, activ` | PV-uri pe perioadă + status |
| **ProiectComentarii** | `DATE(data_comentariu)` | `proiect_id, autor_uid, tip_comentariu` | Comentarii pe proiecte pe zile |
| **Proiecte** | `Data_Start` | `Status, Responsabil, status_facturare` | Proiecte per perioadă start + status |
| **Sarcini** | `data_scadenta` | `status, prioritate, proiect_id` | Sarcini per deadline + status |
| **SesiuniLucru** | `DATE(data_start)` | `utilizator_uid, proiect_id, status` | Sesiuni lucru per zi + utilizator |
| **Subproiecte** | `Data_Start` | `Status, ID_Proiect, activ` | Subproiecte per perioadă + status |
| **TimeTracking** | `data_lucru` | `utilizator_uid, proiect_id, tip_inregistrare` | Ore lucrate per zi + utilizator |
| **TranzactiiBancare** | `data_procesare` | `tip_tranzactie, directie, status, processed` | Tranzacții per zi + tip |

### **CATEGORIA 2: LOOKUP - DOAR CLUSTER** (13 tabele)
Tabele mici/medii fără dimensiune temporală, doar clustering

| Tabel | CLUSTER BY (ordine) | Motivație |
|-------|---------------------|-----------|
| **AnafTokens** | `client_id, is_active` | Lookup token activ per client |
| **Clienti** | `cui, activ, tip_client` | Search clienți după CUI |
| **CursuriValutare** | `moneda, data` | Lookup cursuri per monedă și dată |
| **Produse** | `categorie, tip_produs, activ` | Filtrare produse per categorie |
| **ProiecteCheltuieli** | `proiect_id, status_achitare, activ` | Cheltuieli per proiect + status |
| **ProiecteResponsabili** | `proiect_id, responsabil_uid` | Responsabili per proiect |
| **SarciniResponsabili** | `sarcina_id, responsabil_uid` | Responsabili per sarcină |
| **Subcontractanti** | `cui, activ, tip_client` | Search subcontractanți după CUI |
| **SubproiecteResponsabili** | `subproiect_id, responsabil_uid` | Responsabili per subproiect |
| **TranzactiiAccounts** | `iban, activ` | Conturi bancare active |
| **TranzactiiMatching** | `tranzactie_id, target_type, status` | Matching-uri per tranzacție |
| **TranzactiiSyncLogs** | `account_id, operation_status` | Logs sync per cont |
| **Utilizatori** | `rol, activ, email` | Utilizatori activi per rol |

### **CATEGORIA 3: CONFIG/SETTINGS - FĂRĂ OPTIMIZARE** (6 tabele)
Tabele foarte mici, citite rar, nu necesită optimizare

| Tabel | Rânduri estimate | Motivație |
|-------|------------------|-----------|
| **SabloaneContracte** | < 50 | Șabloane documente (config) |
| **SetariBanca** | < 10 | Conturi bancare firma |
| **SetariContracte** | < 20 | Config numerotare contracte |
| **SetariFacturare** | 1 (singleton) | Config global facturare |
| **SetariFirma** | 1 (singleton) | Datele firmei |
| **TranzactiiSyncConfig** | < 50 | Config sync tranzacții |

### **CATEGORIA 4: VIEWS/SUMMARY - READ-ONLY** (5 tabele)
Views sau tabele sumar generate automat

| Tabel | Tip | Acțiune |
|-------|-----|---------|
| **MatchingSummary** | Sumar | Fără optimizare (regenerat) |
| **RaportFacturi** | View/Cache | Fără optimizare (regenerat) |
| **TranzactiiStats** | Sumar zilnic | PARTITION BY `data` |
| **V_FacturiEFactura** | View | Read-only (nu se migrează) |
| **V_PlanificatorComplete** | View | Read-only (nu se migrează) |
| **ViewEtapeFacturiComplete** | View | Read-only (nu se migrează) |

---

## 🛠️ DDL COMENZI PENTRU TABELE NOI

### **TEMPLATE GENERAL**
```sql
-- Pattern pentru TIME-SERIES tables:
CREATE TABLE `dataset.TableName_v2` (
  -- toate coloanele identice cu schema actuală
)
PARTITION BY DATE(partition_column)
CLUSTER BY cluster_col1, cluster_col2, cluster_col3
OPTIONS(
  description = "Optimized with partitioning + clustering",
  require_partition_filter = TRUE  -- Force query-uri să specifice WHERE pe partition
);

-- Pattern pentru LOOKUP tables:
CREATE TABLE `dataset.TableName_v2` (
  -- toate coloanele identice
)
CLUSTER BY cluster_col1, cluster_col2, cluster_col3;
```

### **CATEGORIA 1: TIME-SERIES (18 tabele DDL)**

#### **1.1 AnafEFactura**
```sql
CREATE TABLE `PanouControlUnitar.AnafEFactura_v2` (
  id STRING NOT NULL,
  factura_id STRING NOT NULL,
  anaf_upload_id STRING,
  xml_content STRING,
  anaf_status STRING NOT NULL,
  anaf_response STRING,
  error_message STRING,
  error_code STRING,
  data_upload TIMESTAMP,
  data_validare TIMESTAMP,
  retry_count INT64,
  max_retries INT64,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP
)
PARTITION BY DATE(data_creare)
CLUSTER BY anaf_status, factura_id
OPTIONS(
  description = "ANAF eFactura logs - optimizat cu partitioning pe data_creare + clustering pe status",
  require_partition_filter = FALSE
);
```

#### **1.2 AnafErrorLog**
```sql
CREATE TABLE `PanouControlUnitar.AnafErrorLog_v2` (
  id STRING,
  category STRING,
  severity STRING,
  message STRING,
  details STRING,
  factura_id STRING,
  user_id STRING,
  timestamp TIMESTAMP,
  should_retry BOOL,
  max_retries INT64,
  requires_manual_intervention BOOL,
  stack_trace STRING,
  anaf_response STRING,
  data_creare TIMESTAMP
)
PARTITION BY DATE(timestamp)
CLUSTER BY severity, category, user_id
OPTIONS(
  description = "ANAF error logs - optimizat pe timestamp + severitate",
  require_partition_filter = FALSE
);
```

#### **1.3 AnafNotificationLog**
```sql
CREATE TABLE `PanouControlUnitar.AnafNotificationLog_v2` (
  id STRING,
  type STRING,
  severity STRING,
  title STRING,
  message STRING,
  recipients STRING,
  success BOOL,
  data STRING,
  timestamp TIMESTAMP,
  data_creare TIMESTAMP
)
PARTITION BY DATE(timestamp)
CLUSTER BY severity, type, success
OPTIONS(
  description = "ANAF notification logs - optimizat pe timestamp + severitate",
  require_partition_filter = FALSE
);
```

#### **1.4 AnexeContract**
```sql
CREATE TABLE `PanouControlUnitar.AnexeContract_v2` (
  ID_Anexa STRING NOT NULL,
  contract_id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  anexa_numar INT64 NOT NULL,
  etapa_index INT64 NOT NULL,
  denumire STRING NOT NULL,
  valoare NUMERIC NOT NULL,
  moneda STRING NOT NULL,
  valoare_ron NUMERIC NOT NULL,
  termen_zile INT64 NOT NULL,
  subproiect_id STRING,
  status_facturare STRING NOT NULL,
  status_incasare STRING NOT NULL,
  factura_id STRING,
  data_facturare DATE,
  data_incasare DATE,
  data_scadenta DATE,
  curs_valutar NUMERIC,
  data_curs_valutar DATE,
  procent_din_total NUMERIC,
  data_start DATE,
  data_final DATE,
  observatii STRING,
  activ BOOL NOT NULL,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP,
  status STRING
)
PARTITION BY data_start
CLUSTER BY status_facturare, contract_id, activ
OPTIONS(
  description = "Anexe contracte - optimizat pe data_start + status facturare",
  require_partition_filter = FALSE
);
```

#### **1.5 Contracte**
```sql
CREATE TABLE `PanouControlUnitar.Contracte_v2` (
  ID_Contract STRING NOT NULL,
  numar_contract STRING NOT NULL,
  serie_contract STRING NOT NULL,
  tip_document STRING NOT NULL,
  proiect_id STRING NOT NULL,
  client_id STRING,
  client_nume STRING NOT NULL,
  Denumire_Contract STRING NOT NULL,
  Data_Semnare DATE,
  Data_Expirare DATE,
  Status STRING NOT NULL,
  Valoare NUMERIC(15, 2),
  Moneda STRING NOT NULL,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  valoare_ron NUMERIC(15, 2),
  etape JSON,
  articole_suplimentare JSON,
  sablon_id STRING,
  sablon_nume STRING,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP NOT NULL,
  creat_de STRING,
  actualizat_de STRING,
  continut_json JSON,
  path_fisier STRING,
  hash_continut STRING,
  Observatii STRING,
  note_interne STRING,
  versiune INT64,
  contract_parinte STRING
)
PARTITION BY Data_Semnare
CLUSTER BY Status, client_id, proiect_id
OPTIONS(
  description = "Contracte - optimizat pe Data_Semnare + Status",
  require_partition_filter = FALSE
);
```

#### **1.6 EtapeContract**
```sql
CREATE TABLE `PanouControlUnitar.EtapeContract_v2` (
  ID_Etapa STRING NOT NULL,
  contract_id STRING NOT NULL,
  etapa_index INT64 NOT NULL,
  denumire STRING NOT NULL,
  valoare NUMERIC(15, 2) NOT NULL,
  moneda STRING NOT NULL,
  valoare_ron NUMERIC(15, 2) NOT NULL,
  termen_zile INT64,
  subproiect_id STRING,
  factura_id STRING,
  status_facturare STRING,
  status_incasare STRING,
  data_scadenta DATE,
  data_facturare DATE,
  data_incasare DATE,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOL,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  procent_din_total NUMERIC(5, 2),
  observatii STRING,
  proiect_id STRING
)
PARTITION BY DATE(data_creare)
CLUSTER BY status_facturare, contract_id, activ
OPTIONS(
  description = "Etape contract - optimizat pe data_creare + status facturare",
  require_partition_filter = FALSE
);
```

#### **1.7 EtapeFacturi**
```sql
CREATE TABLE `PanouControlUnitar.EtapeFacturi_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  etapa_id STRING,
  anexa_id STRING,
  tip_etapa STRING NOT NULL,
  subproiect_id STRING,
  factura_id STRING NOT NULL,
  valoare NUMERIC(15, 2) NOT NULL,
  moneda STRING NOT NULL,
  valoare_ron NUMERIC(15, 2) NOT NULL,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  procent_din_etapa NUMERIC(5, 2),
  data_facturare DATE NOT NULL,
  status_incasare STRING NOT NULL,
  data_incasare DATE,
  valoare_incasata NUMERIC(15, 2),
  observatii STRING,
  activ BOOL NOT NULL,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP,
  creat_de STRING,
  actualizat_de STRING,
  versiune INT64 NOT NULL
)
PARTITION BY data_facturare
CLUSTER BY status_incasare, proiect_id, activ
OPTIONS(
  description = "Etape facturi - optimizat pe data_facturare + status incasare",
  require_partition_filter = FALSE
);
```

#### **1.8 FacturiGenerate**
```sql
CREATE TABLE `PanouControlUnitar.FacturiGenerate_v2` (
  id STRING NOT NULL,
  proiect_id STRING,
  serie STRING,
  numar STRING,
  data_factura DATE,
  data_scadenta DATE,
  id_factura_externa STRING,
  url_publica STRING,
  url_download STRING,
  client_id STRING,
  client_nume STRING,
  client_cui STRING,
  subtotal NUMERIC(10, 2),
  total_tva NUMERIC(10, 2),
  total NUMERIC(10, 2),
  valoare_platita NUMERIC(10, 2),
  status STRING,
  data_trimitere TIMESTAMP,
  data_plata TIMESTAMP,
  date_complete_json STRING,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  efactura_enabled BOOL,
  efactura_status STRING,
  anaf_upload_id STRING
)
PARTITION BY data_factura
CLUSTER BY status, client_cui, efactura_status
OPTIONS(
  description = "Facturi generate - optimizat pe data_factura + status plata",
  require_partition_filter = FALSE
);
```

#### **1.9 FacturiPrimite**
```sql
CREATE TABLE `PanouControlUnitar.FacturiPrimite_v2` (
  ID_Factura STRING,
  Furnizor STRING,
  CUI_Furnizor STRING,
  Data_Emitere DATE,
  Data_Scadenta DATE,
  Valoare_Fara_TVA NUMERIC,
  TVA NUMERIC,
  Total NUMERIC,
  Status_Plata STRING,
  Proiect STRING
)
PARTITION BY Data_Emitere
CLUSTER BY Status_Plata, CUI_Furnizor
OPTIONS(
  description = "Facturi primite - optimizat pe Data_Emitere + Status",
  require_partition_filter = FALSE
);
```

#### **1.10 PlanificatorPersonal**
```sql
CREATE TABLE `PanouControlUnitar.PlanificatorPersonal_v2` (
  id STRING NOT NULL,
  utilizator_uid STRING NOT NULL,
  tip_item STRING NOT NULL,
  item_id STRING NOT NULL,
  ordine_pozitie INT64 NOT NULL,
  comentariu_personal STRING,
  is_pinned BOOL,
  data_adaugare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOL,
  reminder_enabled BOOL,
  reminder_days_before INT64,
  last_notification_sent TIMESTAMP
)
PARTITION BY DATE(data_adaugare)
CLUSTER BY utilizator_uid, tip_item, activ
OPTIONS(
  description = "Planificator personal - optimizat pe data_adaugare + utilizator",
  require_partition_filter = FALSE
);
```

#### **1.11 ProcesVerbale**
```sql
CREATE TABLE `PanouControlUnitar.ProcesVerbale_v2` (
  ID_PV STRING NOT NULL,
  numar_pv STRING NOT NULL,
  serie_pv STRING NOT NULL,
  tip_document STRING NOT NULL,
  proiect_id STRING NOT NULL,
  subproiecte_ids JSON,
  client_id STRING,
  client_nume STRING NOT NULL,
  denumire_pv STRING NOT NULL,
  data_predare DATE NOT NULL,
  status_predare STRING NOT NULL,
  valoare_totala NUMERIC,
  moneda STRING,
  curs_valutar NUMERIC,
  data_curs_valutar DATE,
  valoare_ron NUMERIC,
  path_fisier STRING,
  hash_continut STRING,
  observatii STRING,
  note_interne STRING,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP NOT NULL,
  creat_de STRING,
  actualizat_de STRING,
  activ BOOL NOT NULL,
  versiune INT64 NOT NULL
)
PARTITION BY data_predare
CLUSTER BY status_predare, proiect_id, activ
OPTIONS(
  description = "Procese verbale - optimizat pe data_predare + status",
  require_partition_filter = FALSE
);
```

#### **1.12 ProiectComentarii**
```sql
CREATE TABLE `PanouControlUnitar.ProiectComentarii_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  tip_proiect STRING NOT NULL,
  autor_uid STRING NOT NULL,
  autor_nume STRING NOT NULL,
  comentariu STRING NOT NULL,
  data_comentariu TIMESTAMP,
  tip_comentariu STRING
)
PARTITION BY DATE(data_comentariu)
CLUSTER BY proiect_id, autor_uid, tip_comentariu
OPTIONS(
  description = "Comentarii proiecte - optimizat pe data_comentariu + proiect",
  require_partition_filter = FALSE
);
```

#### **1.13 Proiecte**
```sql
CREATE TABLE `PanouControlUnitar.Proiecte_v2` (
  ID_Proiect STRING,
  Denumire STRING,
  Client STRING,
  Data_Start DATE,
  Data_Final DATE,
  Status STRING,
  Valoare_Estimata NUMERIC,
  Adresa STRING,
  Descriere STRING,
  Responsabil STRING,
  Observatii STRING,
  moneda STRING,
  status_predare STRING,
  status_contract STRING,
  status_facturare STRING,
  status_achitare STRING,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  valoare_ron NUMERIC(15, 2)
)
PARTITION BY Data_Start
CLUSTER BY Status, Responsabil, status_facturare
OPTIONS(
  description = "Proiecte - optimizat pe Data_Start + Status",
  require_partition_filter = FALSE
);
```

#### **1.14 Sarcini**
```sql
CREATE TABLE `PanouControlUnitar.Sarcini_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  tip_proiect STRING NOT NULL,
  titlu STRING NOT NULL,
  descriere STRING,
  prioritate STRING,
  status STRING,
  data_creare TIMESTAMP,
  data_scadenta DATE,
  data_finalizare TIMESTAMP,
  observatii STRING,
  created_by STRING,
  updated_at TIMESTAMP,
  timp_estimat_zile INT64,
  timp_estimat_ore NUMERIC,
  timp_estimat_total_ore NUMERIC,
  progres_procent INT64,
  progres_descriere STRING,
  subproiect_id STRING
)
PARTITION BY data_scadenta
CLUSTER BY status, prioritate, proiect_id
OPTIONS(
  description = "Sarcini - optimizat pe data_scadenta + status",
  require_partition_filter = FALSE
);
```

#### **1.15 SesiuniLucru**
```sql
CREATE TABLE `PanouControlUnitar.SesiuniLucru_v2` (
  id STRING NOT NULL,
  utilizator_uid STRING NOT NULL,
  proiect_id STRING NOT NULL,
  data_start TIMESTAMP NOT NULL,
  data_stop TIMESTAMP,
  ore_lucrate NUMERIC,
  descriere_activitate STRING,
  status STRING,
  created_at TIMESTAMP
)
PARTITION BY DATE(data_start)
CLUSTER BY utilizator_uid, proiect_id, status
OPTIONS(
  description = "Sesiuni lucru - optimizat pe data_start + utilizator",
  require_partition_filter = FALSE
);
```

#### **1.16 Subproiecte**
```sql
CREATE TABLE `PanouControlUnitar.Subproiecte_v2` (
  ID_Subproiect STRING NOT NULL,
  ID_Proiect STRING NOT NULL,
  Denumire STRING NOT NULL,
  Responsabil STRING,
  Data_Start DATE,
  Data_Final DATE,
  Valoare_Estimata NUMERIC(10, 2),
  Status STRING,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOL,
  moneda STRING,
  status_predare STRING,
  status_contract STRING,
  status_facturare STRING,
  status_achitare STRING,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  valoare_ron NUMERIC(15, 2)
)
PARTITION BY Data_Start
CLUSTER BY Status, ID_Proiect, activ
OPTIONS(
  description = "Subproiecte - optimizat pe Data_Start + Status",
  require_partition_filter = FALSE
);
```

#### **1.17 TimeTracking**
```sql
CREATE TABLE `PanouControlUnitar.TimeTracking_v2` (
  id STRING NOT NULL,
  sarcina_id STRING,
  utilizator_uid STRING NOT NULL,
  utilizator_nume STRING NOT NULL,
  data_lucru DATE NOT NULL,
  ore_lucrate NUMERIC NOT NULL,
  descriere_lucru STRING,
  tip_inregistrare STRING,
  created_at TIMESTAMP,
  proiect_id STRING,
  subproiect_id STRING
)
PARTITION BY data_lucru
CLUSTER BY utilizator_uid, proiect_id, tip_inregistrare
OPTIONS(
  description = "Time tracking - optimizat pe data_lucru + utilizator",
  require_partition_filter = FALSE
);
```

#### **1.18 TranzactiiBancare**
```sql
CREATE TABLE `PanouControlUnitar.TranzactiiBancare_v2` (
  id STRING NOT NULL,
  account_id STRING NOT NULL,
  iban_cont STRING NOT NULL,
  data_procesare DATE NOT NULL,
  suma NUMERIC(15, 2) NOT NULL,
  valuta STRING,
  tip_tranzactie STRING NOT NULL,
  nume_contrapartida STRING,
  adresa_contrapartida STRING,
  iban_contrapartida STRING,
  banca_contrapartida STRING,
  cui_contrapartida STRING,
  detalii_tranzactie STRING,
  sold_intermediar NUMERIC(15, 2),
  referinta_bancii STRING,
  tip_categorie STRING,
  directie STRING,
  matched_factura_id STRING,
  matched_etapa_factura_id STRING,
  matched_cheltuiala_id STRING,
  matching_confidence NUMERIC(5, 2),
  matching_tip STRING,
  matching_metadata JSON,
  status STRING,
  processed BOOL,
  needs_review BOOL,
  transaction_hash STRING NOT NULL,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  creat_de STRING,
  actualizat_de STRING
)
PARTITION BY data_procesare
CLUSTER BY tip_tranzactie, directie, status, processed
OPTIONS(
  description = "Tranzactii bancare - optimizat pe data_procesare + tip tranzactie",
  require_partition_filter = FALSE
);
```

#### **1.19 TranzactiiStats** (sumar zilnic)
```sql
CREATE TABLE `PanouControlUnitar.TranzactiiStats_v2` (
  data DATE,
  total_tranzactii INT64,
  incasari_count INT64,
  plati_count INT64,
  total_incasari NUMERIC,
  total_plati NUMERIC,
  matched_count INT64,
  avg_confidence NUMERIC
)
PARTITION BY data
OPTIONS(
  description = "Stats tranzactii - optimizat pe data (sumar zilnic)",
  require_partition_filter = FALSE
);
```

### **CATEGORIA 2: LOOKUP - DOAR CLUSTER (13 tabele DDL)**

#### **2.1 AnafTokens**
```sql
CREATE TABLE `PanouControlUnitar.AnafTokens_v2` (
  id STRING NOT NULL,
  client_id STRING NOT NULL,
  access_token STRING NOT NULL,
  refresh_token STRING NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  certificate_serial STRING,
  scope STRING,
  is_active BOOL,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP
)
CLUSTER BY client_id, is_active
OPTIONS(
  description = "ANAF tokens - optimizat cu clustering pe client_id + is_active"
);
```

#### **2.2 Clienti**
```sql
CREATE TABLE `PanouControlUnitar.Clienti_v2` (
  id STRING NOT NULL,
  nume STRING NOT NULL,
  tip_client STRING NOT NULL,
  cui STRING,
  nr_reg_com STRING,
  adresa STRING,
  judet STRING,
  oras STRING,
  cod_postal STRING,
  tara STRING,
  telefon STRING,
  email STRING,
  banca STRING,
  iban STRING,
  cnp STRING,
  ci_serie STRING,
  ci_numar STRING,
  ci_eliberata_de STRING,
  ci_eliberata_la DATE,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOL,
  observatii STRING,
  id_factureaza STRING,
  data_ultima_sincronizare TIMESTAMP
)
CLUSTER BY cui, activ, tip_client
OPTIONS(
  description = "Clienti - optimizat cu clustering pe CUI + activ"
);
```

#### **2.3 CursuriValutare**
```sql
CREATE TABLE `PanouControlUnitar.CursuriValutare_v2` (
  data DATE,
  moneda STRING,
  curs FLOAT64,
  sursa STRING,
  precizie_originala FLOAT64,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  observatii STRING,
  validat BOOL,
  multiplicator INT64
)
CLUSTER BY moneda, data
OPTIONS(
  description = "Cursuri valutare - optimizat cu clustering pe moneda + data"
);
```

#### **2.4 Produse**
```sql
CREATE TABLE `PanouControlUnitar.Produse_v2` (
  id STRING NOT NULL,
  nume STRING NOT NULL,
  descriere STRING,
  pret_unitar NUMERIC(10, 2),
  um STRING,
  cota_tva NUMERIC(5, 2),
  categorie STRING,
  tip_produs STRING,
  data_creare TIMESTAMP,
  activ BOOL
)
CLUSTER BY categorie, tip_produs, activ
OPTIONS(
  description = "Produse - optimizat cu clustering pe categorie + tip"
);
```

#### **2.5 ProiecteCheltuieli**
```sql
CREATE TABLE `PanouControlUnitar.ProiecteCheltuieli_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  subproiect_id STRING,
  tip_cheltuiala STRING NOT NULL,
  furnizor_nume STRING NOT NULL,
  furnizor_cui STRING,
  furnizor_contact STRING,
  descriere STRING NOT NULL,
  valoare NUMERIC(15, 2) NOT NULL,
  moneda STRING NOT NULL,
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  valoare_ron NUMERIC(15, 2),
  status_predare STRING,
  status_contract STRING,
  status_facturare STRING,
  status_achitare STRING,
  nr_factura_furnizor STRING,
  data_factura_furnizor DATE,
  nr_contract_furnizor STRING,
  data_contract_furnizor DATE,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP NOT NULL,
  activ BOOL NOT NULL,
  observatii STRING
)
CLUSTER BY proiect_id, status_achitare, activ
OPTIONS(
  description = "Cheltuieli proiecte - optimizat cu clustering pe proiect + status"
);
```

#### **2.6 ProiecteResponsabili**
```sql
CREATE TABLE `PanouControlUnitar.ProiecteResponsabili_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  responsabil_uid STRING NOT NULL,
  responsabil_nume STRING NOT NULL,
  rol_in_proiect STRING,
  data_atribuire TIMESTAMP,
  atribuit_de STRING
)
CLUSTER BY proiect_id, responsabil_uid
OPTIONS(
  description = "Responsabili proiecte - optimizat cu clustering pe proiect + responsabil"
);
```

#### **2.7 SarciniResponsabili**
```sql
CREATE TABLE `PanouControlUnitar.SarciniResponsabili_v2` (
  id STRING NOT NULL,
  sarcina_id STRING NOT NULL,
  responsabil_uid STRING NOT NULL,
  responsabil_nume STRING NOT NULL,
  rol_in_sarcina STRING,
  data_atribuire TIMESTAMP,
  atribuit_de STRING
)
CLUSTER BY sarcina_id, responsabil_uid
OPTIONS(
  description = "Responsabili sarcini - optimizat cu clustering pe sarcina + responsabil"
);
```

#### **2.8 Subcontractanti**
```sql
CREATE TABLE `PanouControlUnitar.Subcontractanti_v2` (
  id STRING NOT NULL,
  nume STRING NOT NULL,
  tip_client STRING NOT NULL,
  cui STRING,
  nr_reg_com STRING,
  adresa STRING,
  judet STRING,
  oras STRING,
  cod_postal STRING,
  tara STRING,
  telefon STRING,
  email STRING,
  banca STRING,
  iban STRING,
  cnp STRING,
  ci_serie STRING,
  ci_numar STRING,
  ci_eliberata_de STRING,
  ci_eliberata_la DATE,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOL,
  observatii STRING,
  id_factureaza STRING,
  data_ultima_sincronizare TIMESTAMP
)
CLUSTER BY cui, activ, tip_client
OPTIONS(
  description = "Subcontractanti - optimizat cu clustering pe CUI + activ"
);
```

#### **2.9 SubproiecteResponsabili**
```sql
CREATE TABLE `PanouControlUnitar.SubproiecteResponsabili_v2` (
  id STRING NOT NULL,
  subproiect_id STRING NOT NULL,
  responsabil_uid STRING NOT NULL,
  responsabil_nume STRING NOT NULL,
  rol_in_subproiect STRING,
  data_atribuire TIMESTAMP,
  atribuit_de STRING
)
CLUSTER BY subproiect_id, responsabil_uid
OPTIONS(
  description = "Responsabili subproiecte - optimizat cu clustering pe subproiect + responsabil"
);
```

#### **2.10 TranzactiiAccounts**
```sql
CREATE TABLE `PanouControlUnitar.TranzactiiAccounts_v2` (
  id STRING NOT NULL,
  iban STRING NOT NULL,
  nume_banca STRING NOT NULL,
  nume_cont STRING NOT NULL,
  moneda STRING,
  sold_curent NUMERIC(15, 2),
  data_ultima_sincronizare TIMESTAMP,
  activ BOOL,
  observatii STRING,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP
)
CLUSTER BY iban, activ
OPTIONS(
  description = "Conturi bancare - optimizat cu clustering pe IBAN + activ"
);
```

#### **2.11 TranzactiiMatching**
```sql
CREATE TABLE `PanouControlUnitar.TranzactiiMatching_v2` (
  id STRING NOT NULL,
  tranzactie_id STRING NOT NULL,
  target_type STRING NOT NULL,
  target_id STRING NOT NULL,
  target_details JSON,
  confidence_score NUMERIC(5, 2) NOT NULL,
  matching_algorithm STRING NOT NULL,
  suma_tranzactie NUMERIC(15, 2) NOT NULL,
  suma_target NUMERIC(15, 2) NOT NULL,
  suma_target_ron NUMERIC(15, 2) NOT NULL,
  diferenta_ron NUMERIC(15, 2),
  diferenta_procent NUMERIC(5, 2),
  moneda_target STRING,
  curs_valutar_folosit NUMERIC(10, 4),
  data_curs_valutar DATE,
  matching_details JSON,
  status STRING,
  validated_by STRING,
  validation_notes STRING,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  creat_de STRING,
  actualizat_de STRING
)
CLUSTER BY tranzactie_id, target_type, status
OPTIONS(
  description = "Matching tranzactii - optimizat cu clustering pe tranzactie + target"
);
```

#### **2.12 TranzactiiSyncLogs**
```sql
CREATE TABLE `PanouControlUnitar.TranzactiiSyncLogs_v2` (
  id STRING NOT NULL,
  account_id STRING NOT NULL,
  operation_type STRING NOT NULL,
  operation_status STRING NOT NULL,
  records_processed INT64,
  records_success INT64,
  records_failed INT64,
  records_duplicates INT64,
  file_name STRING,
  file_size INT64,
  processing_time_ms INT64,
  auto_matches_found INT64,
  manual_matches_needed INT64,
  confidence_avg NUMERIC(5, 2),
  summary_message STRING,
  error_details JSON,
  data_creare TIMESTAMP,
  creat_de STRING
)
CLUSTER BY account_id, operation_status
OPTIONS(
  description = "Sync logs tranzactii - optimizat cu clustering pe account + status"
);
```

#### **2.13 Utilizatori**
```sql
CREATE TABLE `PanouControlUnitar.Utilizatori_v2` (
  uid STRING NOT NULL,
  email STRING NOT NULL,
  nume STRING,
  prenume STRING,
  rol STRING NOT NULL,
  permisiuni JSON,
  activ BOOL,
  data_creare TIMESTAMP,
  data_ultima_conectare TIMESTAMP,
  created_by STRING,
  updated_at TIMESTAMP
)
CLUSTER BY rol, activ, email
OPTIONS(
  description = "Utilizatori - optimizat cu clustering pe rol + activ"
);
```

### **CATEGORIA 3: CONFIG/SETTINGS - FĂRĂ MODIFICĂRI (6 tabele)**
Păstrăm exact cum sunt, nu necesită optimizare:
- SabloaneContracte
- SetariBanca
- SetariContracte
- SetariFacturare
- SetariFirma
- TranzactiiSyncConfig

### **CATEGORIA 4: VIEWS - NU SE MIGREAZĂ (3 views)**
Views BigQuery nu necesită migrare, se recreează automat:
- V_FacturiEFactura
- V_PlanificatorComplete
- ViewEtapeFacturiComplete

---

## 📦 SCRIPTURI COPIERE DATE

### **Script 1: Copiere date pentru tabele TIME-SERIES**
```sql
-- Pentru fiecare tabel din Categoria 1, exemplu pentru Proiecte:
INSERT INTO `PanouControlUnitar.Proiecte_v2`
SELECT * FROM `PanouControlUnitar.Proiecte`;

-- Repetă pentru toate cele 19 tabele din Categoria 1
```

### **Script 2: Copiere date pentru tabele LOOKUP**
```sql
-- Pentru fiecare tabel din Categoria 2, exemplu pentru Clienti:
INSERT INTO `PanouControlUnitar.Clienti_v2`
SELECT * FROM `PanouControlUnitar.Clienti`;

-- Repetă pentru toate cele 13 tabele din Categoria 2
```

### **Script complet automatizat**
```bash
#!/bin/bash
# Copiere automată date din tabele vechi → tabele noi v2

TABLES_TIME_SERIES=(
  "AnafEFactura"
  "AnafErrorLog"
  "AnafNotificationLog"
  "AnexeContract"
  "Contracte"
  "EtapeContract"
  "EtapeFacturi"
  "FacturiGenerate"
  "FacturiPrimite"
  "PlanificatorPersonal"
  "ProcesVerbale"
  "ProiectComentarii"
  "Proiecte"
  "Sarcini"
  "SesiuniLucru"
  "Subproiecte"
  "TimeTracking"
  "TranzactiiBancare"
  "TranzactiiStats"
)

TABLES_LOOKUP=(
  "AnafTokens"
  "Clienti"
  "CursuriValutare"
  "Produse"
  "ProiecteCheltuieli"
  "ProiecteResponsabili"
  "SarciniResponsabili"
  "Subcontractanti"
  "SubproiecteResponsabili"
  "TranzactiiAccounts"
  "TranzactiiMatching"
  "TranzactiiSyncLogs"
  "Utilizatori"
)

# Copiere tabele TIME-SERIES
for table in "${TABLES_TIME_SERIES[@]}"; do
  echo "Copiez date pentru $table..."
  bq query --use_legacy_sql=false \
    "INSERT INTO \`PanouControlUnitar.${table}_v2\`
     SELECT * FROM \`PanouControlUnitar.${table}\`;"
done

# Copiere tabele LOOKUP
for table in "${TABLES_LOOKUP[@]}"; do
  echo "Copiez date pentru $table..."
  bq query --use_legacy_sql=false \
    "INSERT INTO \`PanouControlUnitar.${table}_v2\`
     SELECT * FROM \`PanouControlUnitar.${table}\`;"
done

echo "✅ Migrare date completă!"
```

---

## 🔧 MODIFICĂRI API ROUTES (15-20 fișiere)

### **Pattern general pentru toate API-urile**
```typescript
// ÎNAINTE (fără optimizare):
const query = `
  SELECT * FROM \`PanouControlUnitar.Proiecte\`
  WHERE Status = @status
`;

// DUPĂ (cu partitioning benefit):
const query = `
  SELECT * FROM \`PanouControlUnitar.Proiecte_v2\`
  WHERE Data_Start >= @data_start_min
    AND Data_Start <= @data_start_max
    AND Status = @status
`;
// BigQuery va scana DOAR partițiile din intervalul de date specificat!
```

### **Fișiere API de modificat**

#### **Categoria HIGH PRIORITY (folosite frecvent, beneficii mari)**
1. `/api/rapoarte/proiecte/route.ts` - PARTITION BY Data_Start
2. `/api/rapoarte/facturi/route.ts` - PARTITION BY data_factura
3. `/api/analytics/time-tracking/route.ts` - PARTITION BY data_lucru
4. `/api/rapoarte/contracte/route.ts` - PARTITION BY Data_Semnare
5. `/api/tranzactii/dashboard/route.ts` - PARTITION BY data_procesare
6. `/api/rapoarte/clienti/route.ts` - CLUSTER BY cui
7. `/api/planificator/items/route.ts` - PARTITION BY DATE(data_adaugare)
8. `/api/user/timetracking/route.ts` - PARTITION BY data_lucru

#### **Categoria MEDIUM PRIORITY**
9. `/api/rapoarte/utilizatori/route.ts` - CLUSTER BY rol, activ
10. `/api/actions/invoices/generate-hibrid/route.ts` - PARTITION BY data_factura
11. `/api/actions/contracts/generate/route.ts` - PARTITION BY Data_Semnare
12. `/api/anaf/efactura/route.ts` - PARTITION BY DATE(data_creare)
13. `/api/user/projects/route.ts` - PARTITION BY Data_Start
14. `/api/user/dashboard/route.ts` - multiple partitioned tables

#### **Categoria LOW PRIORITY (config tables, citite rar)**
15. `/api/setari/facturare/route.ts` - no changes (config table)
16. `/api/setari/firma/route.ts` - no changes (config table)

### **Exemplu concret de modificare API**

**Fișier**: `/api/rapoarte/proiecte/route.ts`

```typescript
// ÎNAINTE:
export async function GET(request: Request) {
  const query = `
    SELECT * FROM \`PanouControlUnitar.Proiecte\`
    WHERE Status = @status
    ORDER BY Data_Start DESC
    LIMIT 100
  `;

  const options = {
    query,
    params: { status: 'Activ' }
  };

  const [rows] = await bigquery.query(options);
  return Response.json(rows);
}

// DUPĂ (optimizat):
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'Activ';

  // Adăugăm default filter pe ultimele 2 ani pentru partition benefit
  const dataStartMin = searchParams.get('data_start_min') ||
    new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const query = `
    SELECT * FROM \`PanouControlUnitar.Proiecte_v2\`
    WHERE Data_Start >= @data_start_min  -- PARTITION FILTER! 🚀
      AND Status = @status              -- CLUSTER FILTER! ⚡
    ORDER BY Data_Start DESC
    LIMIT 100
  `;

  const options = {
    query,
    params: {
      status,
      data_start_min: dataStartMin  // Forțăm partition filter
    }
  };

  const [rows] = await bigquery.query(options);
  return Response.json(rows);
}
```

**Beneficii**:
- Fără filtrare date: Scanează TOATE partițiile (potențial 10 ani de date)
- Cu filtrare date: Scanează DOAR ultimele 2 ani → **80% reducere cost BigQuery**

---

## 🧪 STRATEGIA DE TESTARE LOCALHOST

### **Faza 1: Verificare tabele create corect**
```bash
# 1. Verifică că toate tabelele v2 au fost create
bq ls --max_results=100 PanouControlUnitar | grep "_v2"

# 2. Verifică schema pentru câteva tabele importante
bq show --schema PanouControlUnitar.Proiecte_v2
bq show --schema PanouControlUnitar.TimeTracking_v2
bq show --schema PanouControlUnitar.FacturiGenerate_v2

# 3. Verifică partitioning configuration
bq show --format=prettyjson PanouControlUnitar.Proiecte_v2 | grep -A 5 "timePartitioning"
```

### **Faza 2: Testare copiere date**
```bash
# 1. Numără rânduri în tabele vechi vs noi
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) as count_vechi FROM \`PanouControlUnitar.Proiecte\`"

bq query --use_legacy_sql=false \
  "SELECT COUNT(*) as count_nou FROM \`PanouControlUnitar.Proiecte_v2\`"

# 2. Verifică că datele sunt identice (sample random)
bq query --use_legacy_sql=false \
  "SELECT * FROM \`PanouControlUnitar.Proiecte\` ORDER BY RAND() LIMIT 5"

bq query --use_legacy_sql=false \
  "SELECT * FROM \`PanouControlUnitar.Proiecte_v2\` ORDER BY RAND() LIMIT 5"
```

### **Faza 3: Testare API-uri în localhost**
```bash
# 1. Configurare .env.local pentru teste cu tabele v2
echo "BIGQUERY_USE_V2_TABLES=true" >> .env.local

# 2. Start localhost
npm run dev

# 3. Testare manuală în browser:
# - http://localhost:3000/admin/rapoarte/proiecte
# - http://localhost:3000/admin/rapoarte/facturi
# - http://localhost:3000/time-tracking
# - http://localhost:3000/admin/tranzactii/dashboard

# 4. Verifică în Network tab (Chrome DevTools) că API-urile returnează date corecte
```

### **Faza 4: Testare performance**
```typescript
// Adaugă în fiecare API route modificat:
const startTime = Date.now();
const [rows] = await bigquery.query(options);
const duration = Date.now() - startTime;

console.log(`⏱️ Query duration: ${duration}ms, Rows: ${rows.length}`);
console.log(`💰 Estimated cost: ${estimateCost(rows.length, duration)}USD`);
```

### **Faza 5: Rollback plan (dacă ceva nu merge)**
```sql
-- Rapid rollback: șterge tabele v2 și revino la cele vechi
DROP TABLE `PanouControlUnitar.Proiecte_v2`;
DROP TABLE `PanouControlUnitar.FacturiGenerate_v2`;
-- etc pentru toate tabelele v2 create

-- Apoi în .env.local:
BIGQUERY_USE_V2_TABLES=false

-- Aplicația revine automat la tabelele vechi
```

---

## 📅 TIMELINE IMPLEMENTARE

### **ZI 1-2: CREAREA TABELELOR NOI**
- ✅ Execută toate DDL-urile pentru tabele TIME-SERIES (19 tabele)
- ✅ Execută toate DDL-urile pentru tabele LOOKUP (13 tabele)
- ✅ Verifică că toate tabelele au fost create corect (bq ls)
- ✅ Testează partitioning cu query simplu pe Proiecte_v2

**Livrabil**: 32 tabele `_v2` create în BigQuery cu partitioning/clustering configurat

### **ZI 3: COPIEREA DATELOR**
- ✅ Rulează script copiere date pentru toate tabelele
- ✅ Verifică count(*) pentru fiecare pereche vechi/nou
- ✅ Sample random rows pentru verificare manuală integritate date

**Livrabil**: Toate tabelele `_v2` conțin aceleași date ca tabelele vechi

### **ZI 4-5: MODIFICARE API ROUTES**
- ✅ Modifică 8 API-uri HIGH PRIORITY (proiecte, facturi, time-tracking, etc.)
- ✅ Adaugă date filters pentru a beneficia de partitioning
- ✅ Testare manuală în localhost pentru fiecare API modificat
- ✅ Verifică că datele returnate sunt identice cu tabelele vechi

**Livrabil**: 8 API-uri critice funcționează cu tabele `_v2`

### **ZI 6: TESTARE COMPLETĂ LOCALHOST**
- ✅ Testare end-to-end toate flow-urile aplicației
- ✅ Testare performance (măsurare timp query-uri)
- ✅ Verificare costuri estimate BigQuery (bytes scanned)
- ✅ Fix bug-uri găsite în timpul testării

**Livrabil**: Aplicație 100% funcțională cu tabele `_v2` în localhost

### **ZI 7: FINALIZARE ȘI DEPLOYMENT**
- ✅ Modifică restul API-urilor MEDIUM/LOW PRIORITY
- ✅ Commit final în git cu toate modificările
- ✅ Deploy în Vercel production
- ✅ Monitorizare 24h pentru erori
- ✅ Ștergere tabele vechi (după confirmare că totul merge)

**Livrabil**: Aplicație în producție cu tabele optimizate, tabele vechi șterse

---

## 🎯 CHECKLIST FINAL ÎNAINTE DE ȘTERGERE TABELE VECHI

```
[ ] Toate tabelele v2 au același count(*) ca tabelele vechi
[ ] Toate API-urile returnează date identice cu tabele v2 vs tabele vechi
[ ] Aplicația în localhost funcționează 100% cu tabele v2
[ ] Deploy Vercel production cu tabele v2 a mers cu succes
[ ] Monitorizare 24h fără erori critice în Vercel logs
[ ] Backup export pentru tabele vechi (opțional, dacă vrei siguranță extra)
[ ] Confirmare vizuală că costuri BigQuery au scăzut în Google Cloud Console
```

**DOAR DUPĂ CE TOATE SUNT ✅, RULEAZĂ:**
```bash
# Ștergere definitivă tabele vechi
bq rm -f PanouControlUnitar.Proiecte
bq rm -f PanouControlUnitar.FacturiGenerate
# ... pentru toate cele 32 tabele

# Redenumire tabele v2 → nume original
bq cp PanouControlUnitar.Proiecte_v2 PanouControlUnitar.Proiecte
bq rm -f PanouControlUnitar.Proiecte_v2
# ... pentru toate cele 32 tabele
```

---

## 💰 ESTIMARE COSTURI ȘI ECONOMII

### **Costuri curente (fără optimizare)**
- Query tipic: `SELECT * FROM Proiecte WHERE Status = 'Activ'`
- Scanează: **TOATE** rândurile din tabel (chiar dacă Status e indexat)
- Exemplu: 10,000 proiecte × 2KB/rând = **20 MB scanați** la fiecare query
- Cost BigQuery: **$5 per TB** = $0.0001 per query
- Cu 10,000 query-uri/lună: **$1/lună** doar pentru Proiecte

### **Costuri după optimizare (cu partitioning + clustering)**
- Query optimizat: `SELECT * FROM Proiecte_v2 WHERE Data_Start >= '2024-01-01' AND Status = 'Activ'`
- Scanează: **DOAR** partițiile din 2024 (ultimul an)
- Exemplu: 1,500 proiecte × 2KB/rând = **3 MB scanați** (reducere 85%)
- Cost: $0.000015 per query
- Cu 10,000 query-uri/lună: **$0.15/lună** (economie **85%**)

### **TOTAL ECONOMII ESTIMATE (toate tabelele)**
- Fără optimizare: **~$20-30/lună** BigQuery costs
- Cu optimizare: **~$2-4/lună** BigQuery costs
- **ECONOMIE: $18-26/lună (~90% reducere)**
- **ECONOMIE ANUALĂ: $216-312/an**

---

## 📚 RESURSE ȘI DOCUMENTAȚIE

### **BigQuery Official Docs**
- [Partitioned Tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Clustered Tables](https://cloud.google.com/bigquery/docs/clustered-tables)
- [Best Practices for Partitioning](https://cloud.google.com/bigquery/docs/best-practices-costs#partitioning_best_practices)

### **Cost Calculator**
- [BigQuery Pricing Calculator](https://cloud.google.com/products/calculator)

### **Monitoring**
- [BigQuery Query Stats](https://console.cloud.google.com/bigquery?project=YOUR_PROJECT&page=queries)
- [Cost Breakdown by Table](https://console.cloud.google.com/bigquery?project=YOUR_PROJECT&page=billing)

---

## 🚨 NOTE IMPORTANTE

### **ATENȚIE: require_partition_filter**
Am setat `require_partition_filter = FALSE` pentru flexibilitate în testare.
După 1-2 luni de rulare, recomand să schimbi în `TRUE` pentru a forța dezvoltatorii să folosească partition filters:

```sql
ALTER TABLE `PanouControlUnitar.Proiecte_v2`
SET OPTIONS (require_partition_filter = TRUE);
```

Acest lucru va **forța** toate query-urile să includă `WHERE Data_Start >= ...` sau BigQuery va refuza query-ul.

### **DATE Fields BigQuery**
Conform documentației din CLAUDE.md, BigQuery DATE fields returnează obiecte `{value: "2025-08-16"}`.
Asigură-te că toate API-urile gestionează corect acest format:

```typescript
const date = row.Data_Start?.value || row.Data_Start;
```

### **Views nu se migrează**
Views BigQuery (V_FacturiEFactura, V_PlanificatorComplete, etc.) sunt query-uri stocate, NU tabele.
Ele vor continua să funcționeze automat, referențiind tabelele noi după migrare.

---

**SFÂRȘITUL PLANULUI DE MIGRARE**

Acest document va rămâne persistent în repository la `/BIGQUERY-MIGRATION-PLAN.md` pentru referință viitoare, chiar și după resetarea memoriei Claude.

**Data creare**: 01.10.2025
**Ultima actualizare**: 01.10.2025
**Status**: 🔴 NEÎNCEPUT - Gata pentru implementare
