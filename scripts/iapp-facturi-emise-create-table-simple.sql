-- =====================================================
-- Creare Tabel: FacturiEmiseANAF_v2
-- VERSIUNE SIMPLIFICATĂ (fără comentarii)
-- Copy-paste direct în BigQuery Console
-- =====================================================

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.FacturiEmiseANAF_v2` (
  id STRING NOT NULL,
  id_incarcare STRING,
  id_descarcare STRING,
  cif_client STRING,
  nume_client STRING,
  serie_numar STRING,
  data_factura DATE,
  valoare_totala FLOAT64,
  moneda STRING DEFAULT 'RON',
  curs_valutar FLOAT64,
  data_curs_valutar DATE,
  valoare_ron FLOAT64,
  status_anaf STRING,
  mesaj_anaf STRING,
  trimisa_de STRING,
  tip_document STRING DEFAULT 'FACTURA_EMISA',
  status_procesare STRING DEFAULT 'procesat',
  google_drive_file_id STRING,
  google_drive_folder_id STRING,
  zip_file_id STRING,
  xml_file_id STRING,
  pdf_file_id STRING,
  xml_content STRING,
  factura_generata_id STRING,
  asociere_automata BOOLEAN DEFAULT FALSE,
  asociere_confidence FLOAT64,
  asociere_manual_user_id STRING,
  data_preluare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_procesare TIMESTAMP,
  data_asociere TIMESTAMP,
  data_incarcare_anaf TIMESTAMP,
  activ BOOLEAN DEFAULT TRUE,
  observatii STRING
)
PARTITION BY DATE(data_preluare);
