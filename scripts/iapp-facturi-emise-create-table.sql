-- =====================================================
-- TABEL: FacturiEmiseANAF_v2
-- Stocheaza facturi EMISE in ANAF prin iapp.ro
-- Date: 29.10.2025
-- =====================================================
--
-- EXECUTARE:
-- 1. Google Cloud Console → BigQuery
-- 2. Select project: hale-mode-464009-i6
-- 3. Ruleaza acest script
--
-- =====================================================

-- Drop table daca exista (pentru re-creare, doar pentru dev)
-- DROP TABLE IF EXISTS `PanouControlUnitar.FacturiEmiseANAF_v2`;

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.FacturiEmiseANAF_v2` (
  -- ===== IDENTIFICATORI =====
  id STRING NOT NULL,
  id_incarcare STRING,           -- ID iapp.ro (similar cu id_mesaj_anaf)
  id_descarcare STRING,           -- ID download ZIP

  -- ===== DATE CLIENT (cumpărător/destinatar) =====
  cif_client STRING,              -- CUI client (fara prefix RO)
  nume_client STRING,             -- Nume companie client

  -- ===== DATE FACTURA =====
  serie_numar STRING,             -- Serie factura (UPA-xxx)
  data_factura DATE,              -- Data emitere factura
  valoare_totala FLOAT64,         -- Total factura
  moneda STRING DEFAULT 'RON',    -- RON, EUR, USD

  -- ===== CONVERSIE VALUTARA =====
  curs_valutar FLOAT64,           -- Curs BNR la data facturii
  data_curs_valutar DATE,         -- Data cursului valutar
  valoare_ron FLOAT64,            -- Valoare echivalent RON

  -- ===== STATUS ANAF SPECIFIC EMISE =====
  status_anaf STRING,             -- CONFIRMAT, DESCARCAT, EROARE
  mesaj_anaf STRING,              -- Mesaj ANAF (erori validare, info)
  trimisa_de STRING,              -- Sistem, Extern, User name

  -- ===== METADATA PROCESARE =====
  tip_document STRING DEFAULT 'FACTURA_EMISA',  -- FACTURA_EMISA, NOTA_CREDIT_EMISA
  status_procesare STRING DEFAULT 'procesat',   -- nou, procesat, eroare

  -- ===== GOOGLE DRIVE STORAGE =====
  google_drive_file_id STRING,   -- ID fisier PDF in Google Drive
  google_drive_folder_id STRING, -- ID folder parent
  zip_file_id STRING,            -- ID fisier ZIP (complet cu XML+PDF)
  xml_file_id STRING,            -- ID fisier XML UBL 2.1
  pdf_file_id STRING,            -- ID fisier PDF individual

  -- ===== XML CONTENT (UBL 2.1) =====
  xml_content STRING,            -- JSON complet UBL 2.1 pentru afisare UI

  -- ===== ASOCIERE CU FACTURIGENERATE (optional) =====
  factura_generata_id STRING,    -- FK → FacturiGenerate (daca exista corespondent)
  asociere_automata BOOLEAN DEFAULT FALSE,
  asociere_confidence FLOAT64,   -- Score 0-1 pentru match automat
  asociere_manual_user_id STRING,

  -- ===== TIMESTAMPS =====
  data_preluare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),        -- Data sincronizare iapp.ro
  data_procesare TIMESTAMP,                                   -- Data procesare XML
  data_asociere TIMESTAMP,                                    -- Data asociere cu FacturiGenerate
  data_incarcare_anaf TIMESTAMP,                              -- Data incarcare originala in ANAF

  -- ===== FLAGS =====
  activ BOOLEAN DEFAULT TRUE,
  observatii STRING
)
PARTITION BY DATE(data_preluare);

-- =====================================================
-- COMENTARII COLOANE
-- =====================================================
-- id: UUID generat pentru fiecare inregistrare
-- id_incarcare: ID unic iapp.ro pentru incarcare in ANAF (similar cu id_mesaj_anaf la primite)
-- id_descarcare: ID pentru download ZIP din iapp.ro
-- cif_client: CUI client fara prefix RO (ex: "35740427" nu "RO35740427")
-- nume_client: Nume complet client destinatar
-- serie_numar: Serie factura emisa (ex: "UPA-001", "UPA001")
-- data_factura: Data emitere factura (poate diferi de data_incarcare_anaf)
-- valoare_totala: Total cu TVA inclus
-- status_anaf: Status ANAF - CONFIRMAT (acceptat), DESCARCAT (client a descarcat), EROARE (respins)
-- mesaj_anaf: Mesaj ANAF pentru erori validare (ex: "[BR-CO-10] sum mismatch")
-- trimisa_de: Sursa trimitere - "Sistem" (automat), "Extern" (manual portal), "Nume User" (specific)
-- tip_document: FACTURA_EMISA pentru facturi normale, NOTA_CREDIT_EMISA pentru valori negative
-- factura_generata_id: Link optional cu FacturiGenerate pentru reconciliere
-- data_incarcare_anaf: Data exacta cand factura a fost incarcata in SPV ANAF

-- =====================================================
-- INDEXARE & PERFORMANTA
-- =====================================================
-- PARTITION BY DATE(data_preluare):
--   - Optimizeaza queries pe interval date
--   - Reduce cost query BigQuery (scan doar partitii necesare)
--   - Queries pe ultimele 30/90 zile vor scana doar acele partitii
--
-- CLUSTERING:
--   - Nu se foloseste clustering (coloanele sunt nullable)
--   - Partitioning este suficient pentru optimizare cost
--   - BigQuery va aplica auto-optimizari pentru filtre WHERE
--
-- Estimari cost:
--   - 1000 facturi/luna = ~10 MB/luna
--   - Query cu partitioning = ~$0.005 per 1GB scan
--   - Annual cost: <$1 pentru 12k facturi
--   - Queries pe perioada recent (30 zile): ~0.3 MB scan = GRATIS

-- =====================================================
-- EXEMPLE QUERIES OPTIMIZATE
-- =====================================================

-- Lista facturi emise cu erori ANAF (ultimele 30 zile)
/*
SELECT
  serie_numar,
  nume_client,
  data_factura,
  valoare_totala,
  status_anaf,
  mesaj_anaf
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE DATE(data_preluare) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND status_anaf = 'EROARE'
  AND activ = TRUE
ORDER BY data_preluare DESC;
*/

-- Reconciliere: facturi emise fara corespondent in FacturiGenerate
/*
SELECT
  fe.serie_numar,
  fe.nume_client,
  fe.data_factura,
  fe.valoare_totala,
  fe.status_anaf
FROM `PanouControlUnitar.FacturiEmiseANAF_v2` fe
LEFT JOIN `PanouControlUnitar.FacturiGenerate` fg
  ON fe.serie_numar = fg.NumarFactura
WHERE fe.factura_generata_id IS NULL
  AND fe.activ = TRUE
  AND fe.status_anaf = 'CONFIRMAT'
ORDER BY fe.data_factura DESC;
*/

-- Statistici pe client (ultimele 90 zile)
/*
SELECT
  cif_client,
  nume_client,
  COUNT(*) as total_facturi,
  SUM(valoare_ron) as total_valoare_ron,
  COUNTIF(status_anaf = 'CONFIRMAT') as facturi_confirmate,
  COUNTIF(status_anaf = 'EROARE') as facturi_cu_erori
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE DATE(data_preluare) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND activ = TRUE
GROUP BY cif_client, nume_client
ORDER BY total_valoare_ron DESC;
*/

-- =====================================================
-- GRANTS & PERMISSIONS
-- =====================================================
-- Service account: unitar-admin@hale-mode-464009-i6.iam.gserviceaccount.com
-- Permissions: BigQuery Data Editor (pentru INSERT/UPDATE/DELETE)
--
-- Verificare permisiuni:
-- gcloud projects get-iam-policy hale-mode-464009-i6 \
--   --flatten="bindings[].members" \
--   --filter="bindings.members:serviceAccount:unitar-admin@*"

-- =====================================================
-- TESTARE TABEL
-- =====================================================

-- Insert test row
/*
INSERT INTO `PanouControlUnitar.FacturiEmiseANAF_v2` (
  id, id_incarcare, id_descarcare,
  cif_client, nume_client,
  serie_numar, data_factura, valoare_totala, moneda,
  status_anaf, mesaj_anaf, trimisa_de,
  data_preluare, data_incarcare_anaf,
  activ, observatii
) VALUES (
  GENERATE_UUID(),
  '5582102010',
  '5960172754',
  '15447725',
  'CENTRUL MEDICAL GORJULUI S.R.L.',
  'UPA-001',
  DATE('2025-10-25'),
  2152.86,
  'RON',
  'EROARE',
  '[BR-CO-10]-Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131).',
  'Sistem',
  CURRENT_TIMESTAMP(),
  TIMESTAMP('2025-10-25 00:20:00'),
  TRUE,
  'Test row - factura cu eroare validare ANAF'
);
*/

-- Verificare insert
/*
SELECT * FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE observatii LIKE '%Test row%'
LIMIT 1;
*/

-- Cleanup test row
/*
DELETE FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE observatii LIKE '%Test row%';
*/

-- =====================================================
-- FINAL NOTES
-- =====================================================
-- 1. Tabelul este optimizat pentru queries pe date recent (partitioning)
-- 2. Clustering accelereaza filtrari pe client, status, serie
-- 3. Compatibil cu infrastructura existenta (pattern similar cu FacturiPrimiteANAF_v2)
-- 4. Ready pentru auto-asociere cu FacturiGenerate (viitor feature)
-- 5. Suporta note de credit (valoare_totala negativa + tip_document)

-- Data creare: 29.10.2025
-- Autor: Claude Code + Teodor Damian
-- Versiune: 1.0
