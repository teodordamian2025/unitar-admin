-- CALEA: /scripts/notifications-create-tables.sql
-- DATA: 05.10.2025 (ora României)
-- DESCRIERE: DDL pentru tabele sistem notificări cu partitioning + clustering

-- =====================================================
-- TABEL: Notificari_v2
-- DESCRIERE: Log complet al tuturor notificărilor trimise
-- =====================================================

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.Notificari_v2` (
  -- Identificatori
  id STRING NOT NULL,
  tip_notificare STRING NOT NULL,
  user_id STRING NOT NULL,

  -- Referințe entități (opționale)
  proiect_id STRING,
  subproiect_id STRING,
  sarcina_id STRING,
  factura_id STRING,
  contract_id STRING,

  -- Conținut notificare
  continut_json JSON NOT NULL,
  titlu STRING,
  mesaj STRING,
  link_actiune STRING,

  -- Status și canale
  citita BOOLEAN DEFAULT FALSE,
  trimis_email BOOLEAN DEFAULT FALSE,
  email_deliverat BOOLEAN,
  email_eroare STRING,

  -- Metadata
  data_creare DATE NOT NULL,
  data_citire TIMESTAMP,
  data_trimitere_email TIMESTAMP,
  prioritate STRING DEFAULT 'normal', -- critical, important, normal, info

  -- Tracking
  creator_id STRING,
  ip_address STRING
)
PARTITION BY data_creare
CLUSTER BY user_id, tip_notificare, citita
OPTIONS(
  description="Log complet notificări sistem - partitioned by data_creare, clustered by user_id + tip_notificare + citita pentru performance optimal",
  require_partition_filter=false
);

-- =====================================================
-- TABEL: NotificariSetari_v2
-- DESCRIERE: Configurare template-uri și setări notificări
-- =====================================================

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.NotificariSetari_v2` (
  -- Identificatori
  id STRING NOT NULL,
  tip_notificare STRING NOT NULL,

  -- Informații setare
  nume_setare STRING NOT NULL,
  descriere STRING,
  categorie STRING, -- proiecte, sarcini, facturi, sistem

  -- Status și configurare
  activ BOOLEAN DEFAULT TRUE,
  canal_email BOOLEAN DEFAULT TRUE,
  canal_clopotel BOOLEAN DEFAULT TRUE,
  canal_push BOOLEAN DEFAULT FALSE, -- pentru viitor

  -- Template-uri
  template_subiect STRING,
  template_continut STRING,
  template_html STRING,

  -- Destinatari
  destinatari_rol ARRAY<STRING>, -- ['admin', 'normal', 'client']
  exclude_creator BOOLEAN DEFAULT TRUE, -- nu trimite către cel care creează

  -- Condiții trigger
  conditii_json JSON, -- {zile_inainte_termen: 3, prag_ore: 40, etc}
  frecventa_trigger STRING DEFAULT 'instant', -- instant, zilnic, saptamanal

  -- Email settings
  email_cc ARRAY<STRING>,
  email_bcc ARRAY<STRING>,
  email_reply_to STRING,

  -- Metadata
  data_creare DATE NOT NULL,
  data_modificare TIMESTAMP,
  modificat_de STRING,
  versiune INT64 DEFAULT 1
)
PARTITION BY data_creare
CLUSTER BY tip_notificare, activ
OPTIONS(
  description="Configurare template-uri și setări pentru fiecare tip de notificare - admin controlabil",
  require_partition_filter=false
);

-- =====================================================
-- TABEL: NotificariPreferinte_v2 (opțional - preferințe utilizator)
-- DESCRIERE: Preferințe individuale utilizatori pentru notificări
-- =====================================================

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.NotificariPreferinte_v2` (
  -- Identificatori
  id STRING NOT NULL,
  user_id STRING NOT NULL,

  -- Preferințe canale
  email_enabled BOOLEAN DEFAULT TRUE,
  clopotel_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE,
  sound_enabled BOOLEAN DEFAULT TRUE,

  -- Frecvență notificări
  frecventa_email STRING DEFAULT 'instant', -- instant, zilnic, saptamanal, niciodata
  frecventa_digest STRING DEFAULT 'saptamanal', -- pentru digest rezumat

  -- Tipuri dezactivate (array de tip_notificare)
  tipuri_dezactivate ARRAY<STRING>,

  -- Schedule (ore quiet mode)
  quiet_hours_start STRING, -- "22:00"
  quiet_hours_end STRING, -- "08:00"
  quiet_days ARRAY<STRING>, -- ['sambata', 'duminica']

  -- Metadata
  data_creare DATE NOT NULL,
  data_modificare TIMESTAMP
)
PARTITION BY data_creare
CLUSTER BY user_id
OPTIONS(
  description="Preferințe individuale utilizatori pentru notificări",
  require_partition_filter=false
);

-- =====================================================
-- INDEX-uri (BigQuery nu suportă, dar clusteringul rezolvă)
-- =====================================================

-- Notificari_v2 este clustered by (user_id, tip_notificare, citita)
-- Queries optimale:
-- SELECT * FROM Notificari_v2 WHERE user_id = 'xxx' AND citita = false
-- SELECT * FROM Notificari_v2 WHERE user_id = 'xxx' AND tip_notificare = 'proiect_atribuit'

-- NotificariSetari_v2 este clustered by (tip_notificare, activ)
-- Queries optimale:
-- SELECT * FROM NotificariSetari_v2 WHERE tip_notificare = 'proiect_atribuit' AND activ = true

-- =====================================================
-- COMENTARII IMPLEMENTARE
-- =====================================================

-- 1. Partitioning pe data_creare pentru performance pe queries cu filtre date
-- 2. Clustering pe coloanele cel mai des filtrate (user_id, tip_notificare, citita)
-- 3. JSON pentru continut_json permite flexibilitate maximă pentru context variabil
-- 4. Array<STRING> pentru destinatari_rol și tipuri_dezactivate
-- 5. Toate câmpurile de tip DATE gestionează automat format {value: "2025-10-05"}
-- 6. require_partition_filter=false permite queries fără filtru pe partition (flexibilitate)
-- 7. Template-uri suportă variabile în format {{variable_name}}

-- NEXT STEPS:
-- 1. Rulează acest script în BigQuery Console
-- 2. Verifică tabelele cu: SHOW TABLES IN PanouControlUnitar LIKE '%Notificari%'
-- 3. Rulează script seed pentru setări default (notifications-seed-settings.sql)
