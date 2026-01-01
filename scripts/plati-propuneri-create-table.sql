-- =====================================================
-- SCRIPT: Creare tabel PlatiPropuneri_v2
-- Data: 2026-01-01
-- Descriere: Tabel pentru propuneri automate de matching
--            între tranzacții plăți și facturi primite/cheltuieli
-- =====================================================

-- Drop dacă există (pentru development)
-- DROP TABLE IF EXISTS `PanouControlUnitar.PlatiPropuneri_v2`;

-- Creare tabel cu partitioning și clustering
-- NOTĂ: BigQuery nu suportă DEFAULT în CREATE TABLE, valorile default se setează la INSERT
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.PlatiPropuneri_v2`
(
  -- Identificare
  id STRING NOT NULL,
  tranzactie_id STRING NOT NULL,           -- FK → TranzactiiBancare_v2

  -- Target poate fi Factură Primită SAU Cheltuială
  target_type STRING NOT NULL,             -- 'factura_primita' | 'cheltuiala'
  factura_primita_id STRING,               -- FK → FacturiPrimiteANAF_v2
  cheltuiala_id STRING,                    -- FK → ProiecteCheltuieli_v2

  -- Asociere cascadată (factură primită → cheltuială)
  cheltuiala_asociata_din_factura STRING,  -- FK → ProiecteCheltuieli_v2 (dacă factura era deja asociată)

  -- Scoring
  score NUMERIC(5,2) NOT NULL,             -- 0-100
  auto_approvable BOOL,                    -- Default: FALSE (setat la INSERT)

  -- Detalii valori
  suma_plata NUMERIC(15,2) NOT NULL,       -- Valoarea absolută plății (cu TVA)
  suma_target NUMERIC(15,2) NOT NULL,      -- Valoarea facturii/cheltuielii
  suma_target_cu_tva NUMERIC(15,2),        -- Pentru cheltuieli: valoare * (1 + TVA/100)
  diferenta_ron NUMERIC(15,2),
  diferenta_procent NUMERIC(5,2),

  -- Matching details
  matching_algorithm STRING,               -- 'cui_referinta_valoare', 'cui_valoare', 'referinta_valoare', etc.
  referinta_gasita STRING,                 -- Nr factură extras din detalii tranzacție
  matching_details JSON,                   -- Breakdown scor JSON

  -- Status workflow
  status STRING NOT NULL,                  -- pending, approved, rejected, expired (default: 'pending' setat la INSERT)
  motiv_respingere STRING,

  -- Date afișare pentru UI (denormalizate)
  furnizor_cui STRING,
  furnizor_nume STRING,
  factura_serie_numar STRING,
  proiect_id STRING,
  proiect_denumire STRING,
  subproiect_id STRING,
  subproiect_denumire STRING,
  cheltuiala_descriere STRING,

  -- Date tranzacție (denormalizate)
  tranzactie_data DATE,
  tranzactie_contrapartida STRING,
  tranzactie_cui STRING,
  tranzactie_detalii STRING,

  -- Audit
  data_creare TIMESTAMP NOT NULL,
  data_aprobare TIMESTAMP,
  data_respingere TIMESTAMP,
  data_expirare TIMESTAMP,
  aprobat_de STRING,
  respins_de STRING,
  creat_de STRING,

  -- Notificare
  notificare_trimisa BOOL,                 -- Default: FALSE (setat la INSERT)
  data_notificare TIMESTAMP
)
PARTITION BY DATE(data_creare)
CLUSTER BY status, auto_approvable, score;

-- Index pentru queries frecvente
-- BigQuery nu suportă indecși tradiționali, clustering-ul face acest rol

-- =====================================================
-- SEED CONFIG: Adaugă configurări pentru propuneri plăți
-- =====================================================

-- Threshold auto-approve pentru plăți (85% - mai strict decât încasări)
INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_auto_approve_threshold',
  '85',
  'number',
  'Scor minim pentru auto-aprobare propuneri plăți (%)',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_auto_approve_threshold'
);

-- Scor minim pentru a fi candidat
INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_min_score',
  '50',
  'number',
  'Scor minim pentru propunere plată (%)',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_min_score'
);

-- Expirare propuneri (zile)
INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_expirare_zile',
  '30',
  'number',
  'Număr zile până la expirare propuneri plăți',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_expirare_zile'
);

-- Notificare enabled
INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_notificare_enabled',
  'true',
  'boolean',
  'Trimite notificări pentru propuneri plăți noi',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_notificare_enabled'
);

-- Ponderi scoring
INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_cui_score',
  '35',
  'number',
  'Puncte pentru match CUI furnizor',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_cui_score'
);

INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_valoare_score',
  '35',
  'number',
  'Puncte pentru match valoare',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_valoare_score'
);

INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_referinta_score',
  '20',
  'number',
  'Puncte pentru match referință factură',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_referinta_score'
);

INSERT INTO `PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
SELECT
  GENERATE_UUID(),
  'propuneri_plati_data_score',
  '10',
  'number',
  'Puncte pentru proximitate dată',
  'plati_propuneri',
  CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.TranzactiiSyncConfig`
  WHERE config_key = 'propuneri_plati_data_score'
);

-- =====================================================
-- VIEW: Propuneri Plăți cu status valid
-- =====================================================
CREATE OR REPLACE VIEW `PanouControlUnitar.V_PlatiPropuneriPending` AS
SELECT
  pp.*,
  -- Status factură (dacă e target factura_primita)
  fp.status_procesare as factura_status,
  fp.cheltuiala_asociata_id as factura_cheltuiala_existenta,
  -- Status cheltuială (dacă e target cheltuiala)
  ch.status_achitare as cheltuiala_status,
  -- Status tranzacție
  tb.status as tranzactie_status,
  tb.matching_tip as tranzactie_matching_existent
FROM `PanouControlUnitar.PlatiPropuneri_v2` pp
LEFT JOIN `PanouControlUnitar.FacturiPrimiteANAF_v2` fp
  ON pp.factura_primita_id = fp.id
LEFT JOIN `PanouControlUnitar.ProiecteCheltuieli_v2` ch
  ON pp.cheltuiala_id = ch.id
LEFT JOIN `PanouControlUnitar.TranzactiiBancare_v2` tb
  ON pp.tranzactie_id = tb.id
WHERE pp.status = 'pending';

-- =====================================================
-- NOTIFICARE TIP: Adaugă tip notificare pentru propuneri plăți
-- =====================================================
INSERT INTO `PanouControlUnitar.NotificariSetari_v2`
(id, tip_notificare, nume_setare, descriere, categorie, activ, canal_email, canal_clopotel,
 template_subiect, template_continut, destinatari_rol, data_creare)
SELECT
  GENERATE_UUID(),
  'plati_propuneri_noi',
  'Propuneri plăți noi',
  'Notificare când sunt generate propuneri noi de matching pentru plăți',
  'financiar',
  TRUE,
  TRUE,
  TRUE,
  '{{count}} propuneri noi de plăți de verificat',
  'Au fost generate {{count}} propuneri de matching pentru plăți ({{auto_count}} auto-aprobabile, {{review_count}} necesită verificare). Verifică-le în panoul de administrare.',
  ['admin'],
  CURRENT_DATE()
WHERE NOT EXISTS (
  SELECT 1 FROM `PanouControlUnitar.NotificariSetari_v2`
  WHERE tip_notificare = 'plati_propuneri_noi'
);

-- =====================================================
-- COMENTARII FINALE
-- =====================================================
--
-- Tabelul PlatiPropuneri_v2 este similar cu IncasariPropuneri_v2 dar pentru plăți.
-- Diferențe cheie:
-- 1. target_type poate fi 'factura_primita' sau 'cheltuiala'
-- 2. suma_target_cu_tva se folosește pentru cheltuieli (care sunt fără TVA)
-- 3. Suportă asociere cascadată (plată → factură → cheltuială)
--
-- RULARE:
-- 1. Copiază acest script în BigQuery Console
-- 2. Selectează proiectul corect
-- 3. Rulează secvențial
--
-- =====================================================
