-- =====================================================
-- SCRIPT SQL: Adăugare câmpuri plată la FacturiEmiseANAF_v2
-- Data: 2026-01-08
-- Scop: Tracking status achitare pentru facturi emise (inclusiv externe)
-- =====================================================

-- 1. Adăugare câmpuri pentru tracking plăți
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2`
ADD COLUMN IF NOT EXISTS valoare_platita FLOAT64,
ADD COLUMN IF NOT EXISTS status_achitare STRING,
ADD COLUMN IF NOT EXISTS data_ultima_plata TIMESTAMP,
ADD COLUMN IF NOT EXISTS matched_tranzactie_id STRING,
ADD COLUMN IF NOT EXISTS matching_tip STRING;

-- 2. Update câmpurile pentru facturi care au legătură cu FacturiGenerate_v2
-- (Sincronizează status-ul de plată de la factura generată)
UPDATE `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2` fe
SET
  fe.valoare_platita = fg.valoare_platita,
  fe.status_achitare = CASE
    WHEN fg.status = 'platita' THEN 'Incasat'
    WHEN fg.status = 'partial_platita' THEN 'Partial'
    ELSE 'Neincasat'
  END,
  fe.data_ultima_plata = fg.data_plata
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
WHERE fe.factura_generata_id = fg.id
  AND fe.factura_generata_id IS NOT NULL;

-- 3. Setare default 'Neincasat' pentru toate facturile fără status
UPDATE `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2`
SET status_achitare = 'Neincasat', valoare_platita = 0
WHERE status_achitare IS NULL;

-- 4. Verificare rezultat
SELECT
  status_achitare,
  COUNT(*) as count,
  SUM(valoare_totala) as total_valoare,
  SUM(COALESCE(valoare_platita, 0)) as total_platit
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE activ = TRUE
GROUP BY status_achitare;
