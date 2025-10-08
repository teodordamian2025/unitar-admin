-- =====================================================
-- TABEL: FacturiPrimiteANAF_v2
-- SCOP: Tracking facturi primite de la furnizori prin ANAF e-Factura
-- DATA: 08.10.2025
-- =====================================================

-- DROP existing table (dacă e gol)
DROP TABLE IF EXISTS `PanouControlUnitar.FacturiPrimite_v2`;

-- CREATE nou tabel cu partitioning corect
CREATE TABLE `PanouControlUnitar.FacturiPrimiteANAF_v2` (
  -- Identificatori
  id STRING NOT NULL,
  id_mesaj_anaf STRING,
  id_descarcare STRING,

  -- Date furnizor
  cif_emitent STRING,
  nume_emitent STRING,

  -- Date factură
  serie_numar STRING,
  data_factura DATE,
  valoare_totala NUMERIC(15, 2),
  moneda STRING DEFAULT 'RON',

  -- Conversie valutară (pentru facturi în valută)
  curs_valutar NUMERIC(10, 4),
  data_curs_valutar DATE,
  valoare_ron NUMERIC(15, 2),

  -- Metadata
  tip_document STRING, -- 'FACTURA'/'AVIZ'/'NOTA_DE_CREDIT'/etc
  status_procesare STRING DEFAULT 'nou', -- 'nou'/'descarcat'/'procesat'/'asociat'/'eroare'

  -- Google Drive storage
  google_drive_file_id STRING, -- ID folder lună (ex: 2025/10)
  google_drive_folder_id STRING, -- ID folder rădăcină
  zip_file_id STRING, -- ID fișier ZIP original
  xml_file_id STRING, -- ID fișier XML extras
  pdf_file_id STRING, -- ID fișier PDF extras (dacă există)

  -- Conținut pentru căutare
  xml_content STRING, -- Conținut XML complet pentru debugging

  -- Asociere cu cheltuieli
  cheltuiala_asociata_id STRING, -- FK către ProiecteCheltuieli_v2.id
  asociere_automata BOOLEAN DEFAULT FALSE,
  asociere_confidence NUMERIC(3, 2), -- 0.00-1.00 (match score)
  asociere_manual_user_id STRING, -- UID user care a făcut match manual

  -- Timestamps
  data_preluare TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  data_procesare TIMESTAMP,
  data_asociere TIMESTAMP,

  -- Flags
  activ BOOLEAN DEFAULT TRUE,
  observatii STRING
)
-- IMPORTANT: Partitioning pe data_preluare (NOT NULL guaranteed)
-- Nu putem folosi data_factura pentru că poate fi NULL la început
PARTITION BY DATE(data_preluare)
CLUSTER BY (cif_emitent, status_procesare, cheltuiala_asociata_id)
OPTIONS(
  description='Facturi primite de la furnizori prin ANAF e-Factura - optimizat pe data preluare + CUI furnizor',
  require_partition_filter=FALSE
);

-- Index virtual pentru query-uri frecvente (BigQuery auto-optimizează)
-- Queries comune:
-- 1. SELECT * WHERE cif_emitent = 'X' AND status_procesare = 'neasociat'
-- 2. SELECT * WHERE cheltuiala_asociata_id IS NULL AND data_factura BETWEEN X AND Y
-- 3. SELECT * WHERE DATE(data_preluare) = CURRENT_DATE() (pentru cron)

-- Test query
SELECT
  'Tabel FacturiPrimiteANAF_v2 creat cu succes!' AS status,
  COUNT(*) AS total_rows
FROM `PanouControlUnitar.FacturiPrimiteANAF_v2`;
