-- ==================================================================
-- CALEA: scripts/oferte-create-tables.sql
-- DATA: 04.04.2026
-- DESCRIERE: Creare tabele BigQuery pentru sistemul de Oferte
-- RULARE: BigQuery Console > PanouControlUnitar dataset
-- ==================================================================

-- ============================================
-- TABEL 1: Oferte_v2 - Oferte comerciale
-- ============================================
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.Oferte_v2` (
  id STRING NOT NULL,
  numar_oferta STRING NOT NULL,
  serie_oferta STRING,
  tip_oferta STRING,
  client_id STRING,
  client_nume STRING,
  client_email STRING,
  client_telefon STRING,
  client_cui STRING,
  client_adresa STRING,
  proiect_denumire STRING,
  proiect_descriere STRING,
  proiect_adresa STRING,
  valoare FLOAT64,
  moneda STRING,
  curs_valutar FLOAT64,
  valoare_ron FLOAT64,
  status STRING,
  data_oferta DATE,
  data_expirare DATE,
  data_trimitere TIMESTAMP,
  data_raspuns TIMESTAMP,
  motiv_refuz STRING,
  proiect_id_legat STRING,
  path_fisier STRING,
  sablon_folosit STRING,
  observatii STRING,
  note_interne STRING,
  termen_executie STRING,
  creat_de STRING,
  creat_de_nume STRING,
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  activ BOOLEAN
)
PARTITION BY DATE(data_creare)
CLUSTER BY status, client_id, creat_de
OPTIONS(
  description = 'Oferte comerciale - partitioned pe data_creare, clustered pe status/client/creator',
  require_partition_filter = FALSE
);

-- ============================================
-- TABEL 2: OferteIstoricStatus_v2 - Istoric schimbari status
-- ============================================
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.OferteIstoricStatus_v2` (
  id STRING NOT NULL,
  oferta_id STRING NOT NULL,
  status_vechi STRING,
  status_nou STRING NOT NULL,
  schimbat_de STRING,
  schimbat_de_nume STRING,
  observatii STRING,
  data_schimbare TIMESTAMP
)
PARTITION BY DATE(data_schimbare)
CLUSTER BY oferta_id
OPTIONS(
  description = 'Istoric schimbari status oferte - partitioned pe data_schimbare, clustered pe oferta_id',
  require_partition_filter = FALSE
);
