-- =================================================================
-- SCRIPT: Adăugare câmpuri pentru tracking facturi stornate
-- Data: 2026-01-14
-- Descriere: Adaugă câmpuri pentru a marca explicit facturile storno
--            și relația dintre factura originală și cea de stornare
-- NOTĂ: BigQuery necesită 3 pași pentru ADD COLUMN cu DEFAULT
-- =================================================================

-- ===== 1. FacturiGenerate_v2 - Adaugă câmpuri storno =====
-- is_storno: TRUE pentru facturi de stornare (valoare negativă)
-- storno_pentru_factura_id: ID-ul facturii originale care se stornează
-- stornata_de_factura_id: ID-ul facturii de stornare (pentru factura originală)

-- Pasul 1a: Adaugă coloana is_storno
ALTER TABLE `PanouControlUnitar.FacturiGenerate_v2`
ADD COLUMN IF NOT EXISTS is_storno BOOL;

-- Pasul 1b: Setează default pentru is_storno
ALTER TABLE `PanouControlUnitar.FacturiGenerate_v2`
ALTER COLUMN is_storno SET DEFAULT FALSE;

-- Pasul 1c: Inițializează valorile existente
UPDATE `PanouControlUnitar.FacturiGenerate_v2`
SET is_storno = FALSE
WHERE is_storno IS NULL;

-- Pasul 2: Adaugă celelalte coloane (fără default)
ALTER TABLE `PanouControlUnitar.FacturiGenerate_v2`
ADD COLUMN IF NOT EXISTS storno_pentru_factura_id STRING;

ALTER TABLE `PanouControlUnitar.FacturiGenerate_v2`
ADD COLUMN IF NOT EXISTS stornata_de_factura_id STRING;

-- ===== 2. FacturiEmiseANAF_v2 - Adaugă câmpuri storno =====
-- Pentru facturile externe trimise prin ANAF/iapp.ro

-- Pasul 2a: Adaugă coloana is_storno
ALTER TABLE `PanouControlUnitar.FacturiEmiseANAF_v2`
ADD COLUMN IF NOT EXISTS is_storno BOOL;

-- Pasul 2b: Setează default pentru is_storno
ALTER TABLE `PanouControlUnitar.FacturiEmiseANAF_v2`
ALTER COLUMN is_storno SET DEFAULT FALSE;

-- Pasul 2c: Inițializează valorile existente
UPDATE `PanouControlUnitar.FacturiEmiseANAF_v2`
SET is_storno = FALSE
WHERE is_storno IS NULL;

-- Pasul 2d: Adaugă celelalte coloane (fără default)
ALTER TABLE `PanouControlUnitar.FacturiEmiseANAF_v2`
ADD COLUMN IF NOT EXISTS storno_pentru_factura_id STRING;

ALTER TABLE `PanouControlUnitar.FacturiEmiseANAF_v2`
ADD COLUMN IF NOT EXISTS stornata_de_factura_id STRING;

-- ===== 3. Update facturi existente cu valoare negativă ca storno =====
-- Identifică facturile cu total negativ și le marchează ca storno

UPDATE `PanouControlUnitar.FacturiGenerate_v2`
SET is_storno = TRUE
WHERE total < 0 AND (is_storno IS NULL OR is_storno = FALSE);

UPDATE `PanouControlUnitar.FacturiEmiseANAF_v2`
SET is_storno = TRUE
WHERE valoare_totala < 0 AND (is_storno IS NULL OR is_storno = FALSE);

-- ===== 4. Update facturi cu status 'storno' sau 'stornata' =====
-- Normalizează statusurile existente

UPDATE `PanouControlUnitar.FacturiGenerate_v2`
SET is_storno = TRUE
WHERE status IN ('storno', 'stornata') AND (is_storno IS NULL OR is_storno = FALSE);

-- ===== 5. Verificare rezultate =====
-- Afișează facturile marcate ca storno

SELECT
  id,
  serie,
  numar,
  total,
  status,
  is_storno,
  storno_pentru_factura_id,
  stornata_de_factura_id
FROM `PanouControlUnitar.FacturiGenerate_v2`
WHERE is_storno = TRUE OR status IN ('storno', 'stornata') OR total < 0
ORDER BY data_creare DESC
LIMIT 20;

-- =================================================================
-- COMENTARII:
--
-- 1. is_storno = TRUE: Această factură este o factură de stornare
--    (anulează o altă factură)
--
-- 2. storno_pentru_factura_id: Când is_storno = TRUE, acest câmp
--    conține ID-ul facturii originale care este stornată
--
-- 3. stornata_de_factura_id: Când această factură a fost stornată,
--    acest câmp conține ID-ul facturii de stornare
--
-- REGULI:
-- - Facturile cu is_storno = TRUE sau stornata_de_factura_id != NULL
--   NU trebuie să apară în:
--   - Propuneri încasări (matching tranzacții)
--   - Notificări pentru facturi neachitate
--   - Statistici de încasare
--
-- - În UI, aceste facturi trebuie să fie marcate clar vizual
--   (badge STORNO sau STORNATĂ)
-- =================================================================
