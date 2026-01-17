-- ==================================================================
-- SCRIPT: setari-costuri-create-table.sql
-- DATA: 17.01.2026 (ora României)
-- DESCRIERE: Creare tabel SetariCosturi_v2 pentru cost/oră și cost/zi de om
-- NOTA: BigQuery nu suportă DEFAULT în CREATE TABLE, valorile se setează la INSERT
-- ==================================================================

-- PASUL 1: Creare tabel (rulează separat)
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2` (
  id STRING NOT NULL,
  cost_ora NUMERIC(10, 2) NOT NULL,
  cost_zi NUMERIC(10, 2) NOT NULL,
  ore_pe_zi INT64 NOT NULL,
  moneda STRING NOT NULL,
  descriere STRING,
  activ BOOL NOT NULL,
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP
);

-- PASUL 2: Inserare setare implicită (rulează după CREATE TABLE)
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2`
(id, cost_ora, cost_zi, ore_pe_zi, moneda, descriere, activ, data_creare)
VALUES (
  'default_cost_settings',
  40.00,
  320.00,
  8,
  'EUR',
  'Setări cost de om implicite pentru calcul productivitate și randament',
  TRUE,
  CURRENT_TIMESTAMP()
);

-- PASUL 3: Verificare (opțional)
SELECT * FROM `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2`;
