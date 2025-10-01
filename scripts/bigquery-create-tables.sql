-- ==================================================================
-- SCRIPT CREARE TABELE BIGQUERY OPTIMIZATE
-- Data: 01.10.2025 (ora României)
-- Descriere: DDL pentru toate cele 32 tabele cu partitioning + clustering
-- Dataset: PanouControlUnitar
-- Nume tabele: *_v2 (temporar, vor fi redenumite după testare)
-- ==================================================================

-- ==================================================================
-- CATEGORIA 1: TIME-SERIES TABLES (19 tabele)
-- Pattern: PARTITION BY DATE + CLUSTER BY frequently filtered columns
-- ==================================================================

-- 1.1 AnafEFactura
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

-- 1.2 AnafErrorLog
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

-- 1.3 AnafNotificationLog
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

-- 1.4 AnexeContract
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

-- 1.5 Contracte
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

-- 1.6 EtapeContract
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

-- 1.7 EtapeFacturi
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

-- 1.8 FacturiGenerate
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

-- 1.9 FacturiPrimite
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

-- 1.10 PlanificatorPersonal
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

-- 1.11 ProcesVerbale
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

-- 1.12 ProiectComentarii
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

-- 1.13 Proiecte
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

-- 1.14 ProiecteCheltuieli (reclasificat la TIME-SERIES pentru data_factura_furnizor)
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
PARTITION BY DATE(data_creare)
CLUSTER BY proiect_id, status_achitare, activ
OPTIONS(
  description = "Cheltuieli proiecte - optimizat pe data_creare + status",
  require_partition_filter = FALSE
);

-- 1.15 Sarcini
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

-- 1.16 SesiuniLucru
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

-- 1.17 Subproiecte
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

-- 1.18 TimeTracking
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

-- 1.19 TranzactiiBancare
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

-- ==================================================================
-- CATEGORIA 2: LOOKUP TABLES (13 tabele)
-- Pattern: DOAR CLUSTER BY (no partitioning)
-- ==================================================================

-- 2.1 AnafTokens
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

-- 2.2 Clienti
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

-- 2.3 CursuriValutare
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

-- 2.4 Produse
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

-- 2.5 ProiecteResponsabili
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

-- 2.6 SarciniResponsabili
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

-- 2.7 Subcontractanti
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

-- 2.8 SubproiecteResponsabili
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

-- 2.9 TranzactiiAccounts
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

-- 2.10 TranzactiiMatching
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

-- 2.11 TranzactiiSyncLogs
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

-- 2.12 Utilizatori
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

-- 2.13 TranzactiiStats (sumar zilnic - adaugat partitioning)
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

-- ==================================================================
-- CATEGORIA 3: CONFIG/SETTINGS TABLES (6 tabele)
-- NU SE MODIFICĂ - rămân identice
-- ==================================================================

-- MatchingSummary - tabel sumar, nu necesită optimizare
-- RaportFacturi - view/cache, nu necesită optimizare
-- SabloaneContracte - config mici, nu optimizează
-- SetariBanca - config mici
-- SetariContracte - config mici
-- SetariFacturare - config singleton
-- SetariFirma - config singleton
-- TranzactiiSyncConfig - config mici

-- ==================================================================
-- CATEGORIA 4: VIEWS (3 views)
-- NU SE MIGREAZĂ - sunt query-uri stocate, nu tabele
-- ==================================================================

-- V_FacturiEFactura
-- V_PlanificatorComplete
-- ViewEtapeFacturiComplete

-- ==================================================================
-- FINAL: 32 TABELE NOI OPTIMIZATE CREATED
-- 19 TIME-SERIES (partition + cluster)
-- 13 LOOKUP (doar cluster)
-- 6 CONFIG (nu se modifică)
-- 3 VIEWS (nu se migrează)
-- ==================================================================
