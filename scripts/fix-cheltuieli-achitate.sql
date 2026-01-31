-- =====================================================
-- FIX: Actualizează status_achitare pentru cheltuieli asociate la facturi plătite
-- DATA: 31.01.2026
-- SCOP: Sincronizează status_achitare cu statusul de plată al facturii asociate
-- =====================================================

-- 1. Afișează cheltuielile care ar trebui marcate ca Achitate
SELECT
  ch.id as cheltuiala_id,
  ch.furnizor_nume,
  ch.valoare_ron,
  ch.status_achitare as status_actual,
  'Achitat' as status_corect,
  fp.id as factura_id,
  fp.serie_numar,
  fp.status_procesare as factura_status,
  tm.suma_tranzactie as suma_platita
FROM `PanouControlUnitar.ProiecteCheltuieli_v2` ch
INNER JOIN `PanouControlUnitar.FacturiPrimiteANAF_v2` fp
  ON fp.cheltuiala_asociata_id = ch.id
INNER JOIN `PanouControlUnitar.TranzactiiMatching_v2` tm
  ON tm.target_type = 'factura_primita'
  AND tm.target_id = fp.id
  AND tm.status = 'active'
WHERE ch.activ = TRUE
  AND (ch.status_achitare IS NULL OR ch.status_achitare != 'Achitat');

-- 2. UPDATE: Marchează cheltuielile ca Achitate
UPDATE `PanouControlUnitar.ProiecteCheltuieli_v2` ch
SET
  status_achitare = 'Achitat',
  data_actualizare = CURRENT_TIMESTAMP()
WHERE ch.activ = TRUE
  AND (ch.status_achitare IS NULL OR ch.status_achitare != 'Achitat')
  AND EXISTS (
    SELECT 1
    FROM `PanouControlUnitar.FacturiPrimiteANAF_v2` fp
    INNER JOIN `PanouControlUnitar.TranzactiiMatching_v2` tm
      ON tm.target_type = 'factura_primita'
      AND tm.target_id = fp.id
      AND tm.status = 'active'
    WHERE fp.cheltuiala_asociata_id = ch.id
  );

-- 3. Verificare rezultat
SELECT
  'Cheltuieli actualizate:' as info,
  COUNT(*) as count
FROM `PanouControlUnitar.ProiecteCheltuieli_v2` ch
WHERE ch.status_achitare = 'Achitat'
  AND ch.activ = TRUE
  AND EXISTS (
    SELECT 1
    FROM `PanouControlUnitar.FacturiPrimiteANAF_v2` fp
    WHERE fp.cheltuiala_asociata_id = ch.id
  );
