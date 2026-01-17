-- ==================================================================
-- SCRIPT: setari-costuri-create-table.sql
-- DATA: 17.01.2026 (ora României)
-- DESCRIERE: Creare tabel SetariCosturi_v2 pentru cost/oră și cost/zi de om
-- ==================================================================

-- Tabel pentru setări costuri de om (cost/oră, cost/zi)
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2` (
  id STRING NOT NULL,
  cost_ora NUMERIC(10, 2) NOT NULL,         -- Cost pe oră de om (ex: 40 EUR)
  cost_zi NUMERIC(10, 2) NOT NULL,          -- Cost pe zi de om (ex: 320 EUR = 40 * 8)
  ore_pe_zi INT64 NOT NULL DEFAULT 8,       -- Ore de lucru pe zi (standard 8)
  moneda STRING NOT NULL DEFAULT 'EUR',     -- Moneda pentru cost
  descriere STRING,                         -- Descriere/notă opțională
  activ BOOLEAN NOT NULL DEFAULT TRUE,      -- Flag activ/inactiv
  data_creare TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP
)
PARTITION BY DATE(data_creare)
CLUSTER BY activ;

-- Inserare setare implicită
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2`
(id, cost_ora, cost_zi, ore_pe_zi, moneda, descriere, activ, data_creare)
VALUES (
  'default_cost_settings',
  40.00,      -- 40 EUR/oră
  320.00,     -- 320 EUR/zi (40 * 8)
  8,          -- 8 ore/zi
  'EUR',
  'Setări cost de om implicite pentru calcul productivitate și randament',
  TRUE,
  CURRENT_TIMESTAMP()
);

-- Verificare tabel creat
SELECT * FROM `hale-mode-464009-i6.PanouControlUnitar.SetariCosturi_v2`;
