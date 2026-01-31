-- =====================================================
-- MIGRATION: Adaugă coloane TVA în FacturiPrimiteANAF_v2
-- DATA: 31.01.2026
-- SCOP: Permite comparație corectă cu cheltuieli (care sunt fără TVA)
-- =====================================================

-- 1. Adaugă coloana valoare_fara_tva
ALTER TABLE `PanouControlUnitar.FacturiPrimiteANAF_v2`
ADD COLUMN IF NOT EXISTS valoare_fara_tva NUMERIC(15, 2);

-- 2. Adaugă coloana valoare_tva
ALTER TABLE `PanouControlUnitar.FacturiPrimiteANAF_v2`
ADD COLUMN IF NOT EXISTS valoare_tva NUMERIC(15, 2);

-- 3. Adaugă coloana cota_tva (pentru calcul invers dacă nu avem valorile)
ALTER TABLE `PanouControlUnitar.FacturiPrimiteANAF_v2`
ADD COLUMN IF NOT EXISTS cota_tva NUMERIC(5, 2);

-- 4. Adaugă coloana tranzactie_asociata_id pentru link la plata bancară
ALTER TABLE `PanouControlUnitar.FacturiPrimiteANAF_v2`
ADD COLUMN IF NOT EXISTS tranzactie_asociata_id STRING;

-- 5. Verificare structură nouă
SELECT
  'Coloane TVA adăugate cu succes!' AS status,
  column_name,
  data_type
FROM `PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'FacturiPrimiteANAF_v2'
  AND column_name IN ('valoare_fara_tva', 'valoare_tva', 'cota_tva', 'tranzactie_asociata_id')
ORDER BY ordinal_position;
