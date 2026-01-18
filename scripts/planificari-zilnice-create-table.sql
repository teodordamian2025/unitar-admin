-- ==================================================================
-- SCRIPT: Creare tabel PlanificariZilnice_v2
-- DATA: 18.01.2026
-- DESCRIERE: Tabel pentru stocarea alocărilor zilnice de lucrători
-- ==================================================================

-- Șterge tabelul dacă există (pentru development)
-- DROP TABLE IF EXISTS `hale-mode-464009-i6.PanouControlUnitar.PlanificariZilnice_v2`;

-- Crează tabelul cu partitioning și clustering
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.PlanificariZilnice_v2` (
  -- Identificatori
  id STRING NOT NULL,
  data_planificare DATE NOT NULL,
  utilizator_uid STRING NOT NULL,
  utilizator_nume STRING NOT NULL,

  -- Referință la ce e planificat (unul din cele 3)
  proiect_id STRING,
  subproiect_id STRING,
  sarcina_id STRING,

  -- Denumiri pentru afișare rapidă (evită JOIN-uri)
  proiect_denumire STRING,
  subproiect_denumire STRING,
  sarcina_titlu STRING,

  -- Detalii alocare
  ore_planificate NUMERIC(5,2) DEFAULT 8,
  prioritate STRING DEFAULT 'normala',
  observatii STRING,

  -- Metadata creare
  creat_de STRING,
  creat_de_nume STRING,
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP,
  activ BOOL DEFAULT TRUE,

  -- Sync cu Planificator Personal
  sync_planificator_personal BOOL DEFAULT FALSE,
  planificator_personal_id STRING
)
PARTITION BY data_planificare
CLUSTER BY utilizator_uid, proiect_id;

-- Descriere tabel
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.PlanificariZilnice_v2`
SET OPTIONS (
  description = "Alocări zilnice de lucrători pentru proiecte/subproiecte/sarcini. Partitionat după data_planificare, clustered după utilizator_uid și proiect_id. Creat 18.01.2026."
);
