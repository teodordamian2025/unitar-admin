-- =====================================================
-- SCRIPT SQL: Adaugare campuri sursa la IncasariPropuneri_v2
-- Data: 2026-01-08
-- Scop: Suport pentru facturi externe din FacturiEmiseANAF_v2
-- =====================================================

-- 1. Adaugare campuri noi
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IncasariPropuneri_v2`
ADD COLUMN IF NOT EXISTS factura_sursa STRING,
ADD COLUMN IF NOT EXISTS factura_emisa_id STRING;

-- 2. Setare default pentru inregistrarile existente
UPDATE `hale-mode-464009-i6.PanouControlUnitar.IncasariPropuneri_v2`
SET factura_sursa = 'facturi_generate'
WHERE factura_sursa IS NULL;

-- 3. Verificare
SELECT
  factura_sursa,
  COUNT(*) as count
FROM `hale-mode-464009-i6.PanouControlUnitar.IncasariPropuneri_v2`
GROUP BY factura_sursa;
