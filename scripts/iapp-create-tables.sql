-- ==================================================================
-- TABELE INTEGRARE IAPP.RO E-FACTURA
-- Data creare: 17 Octombrie 2025
-- ==================================================================

-- Tabel 1: IappConfig_v2 - Configurare API iapp.ro
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2` (
  id STRING NOT NULL,
  cod_firma STRING NOT NULL,           -- Cod firmă iapp.ro (encriptat)
  parola_api STRING NOT NULL,          -- Parolă API (encriptată)
  email_responsabil STRING NOT NULL,   -- Email responsabil pentru facturi
  activ BOOLEAN DEFAULT TRUE,          -- Dacă integrarea este activă
  tip_facturare STRING DEFAULT 'iapp', -- 'iapp' sau 'anaf_direct'
  auto_transmite_efactura BOOLEAN DEFAULT TRUE, -- Transmite automat la e-Factura
  serie_default STRING,                -- Serie factură default (ex: SERIE_TEST)
  moneda_default STRING DEFAULT 'RON', -- Monedă default
  footer_intocmit_name STRING,         -- Nume persoană care emite factura
  data_creare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP NOT NULL,
  creat_de STRING,
  actualizat_de STRING
)
CLUSTER BY activ, tip_facturare;

-- Tabel 2: IappFacturiEmise_v2 - Log facturi emise prin iapp.ro
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2` (
  id STRING NOT NULL,
  factura_id STRING NOT NULL,          -- ID factură din FacturiGenerate_v2
  iapp_id_factura STRING,              -- ID factură returnat de iapp.ro
  iapp_serie STRING,                   -- Serie factură iapp
  iapp_numar STRING,                   -- Număr factură iapp
  tip_factura STRING DEFAULT 'fiscala', -- 'fiscala' sau 'proforma'
  client_cif STRING NOT NULL,
  client_nume STRING NOT NULL,
  valoare_totala FLOAT64 NOT NULL,
  moneda STRING DEFAULT 'RON',
  status STRING DEFAULT 'trimisa',     -- 'trimisa', 'acceptata', 'respinsa', 'error'
  efactura_upload_index STRING,       -- ID upload ANAF (dacă transmisă)
  efactura_status STRING,              -- Status ANAF (dacă transmisă)
  efactura_mesaj_eroare STRING,        -- Mesaj eroare ANAF
  request_json JSON,                   -- Request trimis la iapp.ro
  response_json JSON,                  -- Response primit de la iapp.ro
  data_emitere DATE NOT NULL,
  data_transmitere TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP,
  creat_de STRING
)
PARTITION BY data_emitere
CLUSTER BY status, client_cif, factura_id;

-- Tabel 3: IappFacturiPrimite_v2 - Facturi primite sincronizate din iapp.ro
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.IappFacturiPrimite_v2` (
  id STRING NOT NULL,
  iapp_id_factura STRING NOT NULL,     -- ID factură în iapp.ro
  furnizor_cif STRING NOT NULL,
  furnizor_nume STRING NOT NULL,
  serie STRING,
  numar STRING,
  data_factura DATE NOT NULL,
  valoare_totala FLOAT64 NOT NULL,
  valoare_tva FLOAT64,
  moneda STRING DEFAULT 'RON',
  status STRING,                       -- Status factură în iapp.ro
  pdf_url STRING,                      -- URL descărcare PDF
  xml_url STRING,                      -- URL descărcare XML
  google_drive_folder_id STRING,       -- Folder Google Drive pentru stocare
  cheltuiala_asociata_id STRING,       -- FK → ProiecteCheltuieli_v2
  asociere_automata BOOLEAN DEFAULT FALSE,
  asociere_confidence FLOAT64,         -- Score 0-1 pentru matching
  data_sincronizare TIMESTAMP NOT NULL,
  data_actualizare TIMESTAMP,
  sincronizat_de STRING
)
PARTITION BY data_factura
CLUSTER BY furnizor_cif, status, cheltuiala_asociata_id;

-- ==================================================================
-- NOTE: BigQuery nu suportă COMMENT ON TABLE
-- Comentariile sunt în documentația codului și în descrierile coloanelor
-- ==================================================================

-- Seed configurare inițială
-- ATENȚIE: NU rula direct din BigQuery Console!
-- Folosește: node scripts/iapp-seed-config.js
-- (scriptul va cripta automat credențialele)
--
-- Exemplu manual (DOAR pentru referință):
-- INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2` (
--   id, cod_firma, parola_api, email_responsabil, activ, tip_facturare,
--   serie_default, footer_intocmit_name, data_creare, data_actualizare, creat_de
-- ) VALUES (
--   GENERATE_UUID(),
--   'ENCRYPTED_COD_FIRMA',  -- Va fi encriptat cu iapp-seed-config.js
--   'ENCRYPTED_PAROLA',     -- Va fi encriptată cu iapp-seed-config.js
--   'contact@unitarproiect.eu',
--   TRUE,
--   'iapp',
--   'SERIE_TEST',
--   'Administrator UNITAR',
--   CURRENT_TIMESTAMP(),
--   CURRENT_TIMESTAMP(),
--   'system'
-- );
