-- ==================================================================
-- SCRIPT FIX: Update status pentru tranzacții Smart Fintech existente
-- DATA: 09.11.2025 (ora României)
-- DESCRIERE: Actualizează status NULL → 'smartfintech' pentru tranzacții
--            importate din Smart Fintech API (account_id = '2045')
-- ==================================================================

-- ⚠️ IMPORTANT: Rulează în BigQuery Console în modul DRY-RUN mai întâi!

-- ==================================================================
-- PASUL 1: Verificare tranzacții afectate (DRY-RUN)
-- ==================================================================
-- Rulează acest query pentru a vedea ce tranzacții vor fi modificate:

SELECT
  id,
  data_procesare,
  suma,
  directie,
  nume_contrapartida,
  cui_contrapartida,
  status,
  matching_tip,
  account_id
FROM `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
WHERE account_id = '2045'
  AND (status IS NULL OR status != 'smartfintech')
ORDER BY data_procesare DESC;

-- ==================================================================
-- PASUL 2: Update status pentru tranzacții Smart Fintech
-- ==================================================================
-- ⚠️ ATENȚIE: Rulează DOAR după ce ai verificat PASUL 1!
-- ⚠️ Pentru a rula, SCOATE comentariile /* */ de mai jos:

/*
UPDATE `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
SET
  status = 'smartfintech',
  matching_tip = CASE
    WHEN matching_tip IS NULL THEN 'none'
    ELSE matching_tip
  END,
  data_actualizare = CURRENT_TIMESTAMP()
WHERE account_id = '2045'
  AND status IS NULL;
*/

-- ==================================================================
-- PASUL 3: Verificare rezultate (rulează după update)
-- ==================================================================
-- Rulează acest query pentru a verifica că UPDATE-ul a funcționat:

/*
SELECT
  status,
  matching_tip,
  COUNT(*) as total_tranzactii,
  SUM(CASE WHEN directie = 'intrare' THEN 1 ELSE 0 END) as incasari,
  SUM(CASE WHEN directie = 'iesire' THEN 1 ELSE 0 END) as plati,
  SUM(CASE WHEN directie = 'intrare' THEN suma ELSE 0 END) as total_incasari,
  SUM(CASE WHEN directie = 'iesire' THEN suma ELSE 0 END) as total_plati
FROM `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
WHERE account_id = '2045'
GROUP BY status, matching_tip
ORDER BY status;
*/

-- ==================================================================
-- REZULTATE AȘTEPTATE:
-- - ~122 tranzacții actualizate cu status = 'smartfintech'
-- - matching_tip = 'none' pentru cele fără matching
-- - Tranzacțiile cu status = 'matched' rămân neschimbate
-- ==================================================================

-- ==================================================================
-- ROLLBACK (dacă este nevoie):
-- ==================================================================
/*
UPDATE `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2`
SET
  status = NULL,
  matching_tip = NULL,
  data_actualizare = CURRENT_TIMESTAMP()
WHERE account_id = '2045'
  AND status = 'smartfintech';
*/
