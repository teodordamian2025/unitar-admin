-- =====================================================
-- SCRIPT SQL: Sincronizare status achitare din FacturiGenerate_v2 la FacturiEmiseANAF_v2
-- Data: 2026-01-08
-- Scop: Sincronizeaza datele de plata existente pentru facturile linkate
-- RULATI O SINGURA DATA pentru date existente
-- =====================================================

-- 1. Verificare: Cate facturi au nevoie de sincronizare
SELECT
  'Statistici inainte de sync' as info,
  COUNT(*) as total_facturi_emise,
  SUM(CASE WHEN fe.factura_generata_id IS NOT NULL THEN 1 ELSE 0 END) as cu_link,
  SUM(CASE WHEN fe.factura_generata_id IS NOT NULL
           AND COALESCE(fg.valoare_platita, 0) > 0
           AND COALESCE(fe.valoare_platita, 0) = 0 THEN 1 ELSE 0 END) as need_sync
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2` fe
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
  ON fe.factura_generata_id = fg.id;

-- 2. Preview: Ce date vor fi sincronizate
SELECT
  fe.id as factura_emisa_id,
  fe.serie_numar,
  fe.factura_generata_id,
  fg.serie as fg_serie,
  fg.numar as fg_numar,
  COALESCE(fe.valoare_platita, 0) as fe_platita_actual,
  COALESCE(fg.valoare_platita, 0) as fg_platita_sursa,
  fe.status_achitare as fe_status_actual,
  fg.status as fg_status_sursa,
  CASE
    WHEN COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, fe.valoare_ron, fe.valoare_totala) * 0.99 THEN 'Incasat'
    WHEN COALESCE(fg.valoare_platita, 0) > 0 THEN 'Partial'
    ELSE 'Neincasat'
  END as status_nou_calculat
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2` fe
JOIN `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
  ON fe.factura_generata_id = fg.id
WHERE COALESCE(fg.valoare_platita, 0) > 0
  AND (
    COALESCE(fe.valoare_platita, 0) = 0
    OR fe.status_achitare IS NULL
    OR fe.status_achitare = 'Neincasat'
  )
ORDER BY fg.valoare_platita DESC;

-- 3. SYNC: Actualizeaza FacturiEmiseANAF_v2 cu datele din FacturiGenerate_v2
-- DECOMENTATI PENTRU A RULA
/*
UPDATE `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2` fe
SET
  valoare_platita = fg.valoare_platita,
  status_achitare = CASE
    WHEN COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, fe.valoare_ron, fe.valoare_totala) * 0.99 THEN 'Incasat'
    WHEN COALESCE(fg.valoare_platita, 0) > 0 THEN 'Partial'
    ELSE 'Neincasat'
  END,
  data_ultima_plata = fg.data_plata,
  matching_tip = 'sync_initial_2026_01_08'
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
WHERE fe.factura_generata_id = fg.id
  AND COALESCE(fg.valoare_platita, 0) > 0
  AND (
    COALESCE(fe.valoare_platita, 0) = 0
    OR fe.status_achitare IS NULL
    OR fe.status_achitare = 'Neincasat'
  );
*/

-- 4. Verificare dupa sync
-- Rulati dupa ce executati UPDATE-ul
/*
SELECT
  fe.status_achitare,
  COUNT(*) as count,
  SUM(fe.valoare_platita) as total_platit
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiEmiseANAF_v2` fe
WHERE fe.factura_generata_id IS NOT NULL
GROUP BY fe.status_achitare
ORDER BY count DESC;
*/
