-- ==================================================================
-- SCRIPT: Creare tabel Chitante_v2
-- DATA: 29.11.2025
-- DESCRIERE: Tabel pentru inregistrarea incasarilor prin chitanta
-- ==================================================================

-- Creare tabel Chitante_v2 cu partitioning si clustering
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.Chitante_v2` (
  -- Identificare
  id STRING NOT NULL,

  -- Serie si numar chitanta
  serie STRING NOT NULL,
  numar STRING NOT NULL,

  -- Legatura cu factura
  factura_id STRING NOT NULL,
  factura_serie STRING,
  factura_numar STRING,

  -- Date client (copiate de la factura pentru referinta)
  client_id STRING,
  client_nume STRING NOT NULL,
  client_cui STRING,
  tip_client STRING, -- 'pj' sau 'pf'

  -- Proiect
  proiect_id STRING,
  proiect_denumire STRING,

  -- Valori
  valoare_incasata NUMERIC(15, 2) NOT NULL,
  moneda STRING DEFAULT 'RON',

  -- Informatii suplimentare
  data_chitanta DATE NOT NULL,
  reprezentant_legal STRING, -- Persoana care primeste banii
  descriere STRING, -- Descriere optionala

  -- Metadata
  creat_de STRING,
  creat_de_nume STRING,
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP,

  -- Status
  activ BOOLEAN DEFAULT TRUE,
  anulata BOOLEAN DEFAULT FALSE,
  motiv_anulare STRING
)
PARTITION BY DATE(data_chitanta)
CLUSTER BY factura_id, client_id, activ;

-- Index comment pentru referinta
-- Plafonul legal pentru plati in numerar:
-- - PJ catre PJ: max 5.000 lei/zi (OUG 193/2002)
-- - PF catre PJ: max 10.000 lei/tranzactie (OUG 28/1999)
