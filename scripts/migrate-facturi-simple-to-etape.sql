-- ==================================================================
-- SCRIPT MIGRARE: Facturi simple în EtapeFacturi_v2
-- DATA: 09.11.2025 (ora României)
-- DESCRIERE: Inserează toate facturile simple (fără etape contract)
--            în EtapeFacturi_v2 pentru matching automat
-- ==================================================================

-- ⚠️ IMPORTANT: Rulează în BigQuery Console în modul DRY-RUN mai întâi!

-- ==================================================================
-- PASUL 1: Identificare facturi simple (fără etape existente)
-- ==================================================================
-- Rulează acest query pentru a vedea ce facturi vor fi migrate:

SELECT
  fg.id as factura_id,
  fg.serie,
  fg.numar,
  fg.data_factura,
  fg.client_nume,
  fg.client_cui,
  fg.total as factura_total,
  fg.proiect_id,
  fg.status as factura_status
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
  ON fg.id = ef.factura_id AND ef.activ = TRUE
WHERE ef.id IS NULL  -- Nu există nicio etapă
  AND fg.status != 'anulata'
  AND fg.total > 0
ORDER BY fg.data_factura DESC;

-- ==================================================================
-- PASUL 2: Inserare facturi simple în EtapeFacturi_v2
-- ==================================================================
-- ⚠️ ATENȚIE: Rulează DOAR după ce ai verificat PASUL 1!
-- ⚠️ Pentru a rula, SCOATE comentariile /* */ de mai jos:

/*
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
(
  id,
  proiect_id,
  etapa_id,
  anexa_id,
  tip_etapa,
  subproiect_id,
  factura_id,
  valoare,
  moneda,
  valoare_ron,
  curs_valutar,
  data_curs_valutar,
  procent_din_etapa,
  data_facturare,
  status_incasare,
  valoare_incasata,
  activ,
  versiune,
  data_creare,
  creat_de
)
SELECT
  CONCAT('EF_SIMPLE_MIGRATE_', fg.id, '_', UNIX_MILLIS(CURRENT_TIMESTAMP())) as id,
  fg.proiect_id,
  NULL as etapa_id,
  NULL as anexa_id,
  'factura_directa' as tip_etapa,
  NULL as subproiect_id,
  fg.id as factura_id,
  CAST(fg.total AS NUMERIC) as valoare,
  'RON' as moneda,
  CAST(fg.total AS NUMERIC) as valoare_ron,
  CAST(1.0 AS NUMERIC) as curs_valutar,
  fg.data_factura as data_curs_valutar,
  CAST(100.0 AS NUMERIC) as procent_din_etapa,
  fg.data_factura as data_facturare,
  'Neincasat' as status_incasare,
  CAST(0.0 AS NUMERIC) as valoare_incasata,
  TRUE as activ,
  1 as versiune,
  CURRENT_TIMESTAMP() as data_creare,
  'Migration_Script_Facturi_Simple' as creat_de
FROM `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
  ON fg.id = ef.factura_id AND ef.activ = TRUE
WHERE ef.id IS NULL  -- Nu există nicio etapă pentru această factură
  AND fg.status != 'anulata'
  AND fg.total > 0;
*/

-- ==================================================================
-- PASUL 3: Verificare rezultate (rulează după insert)
-- ==================================================================
-- Rulează acest query pentru a verifica că INSERT-ul a funcționat:
-- ⚠️ Pentru a rula, SCOATE comentariile /* */ de mai jos:

/*
SELECT
  tip_etapa,
  COUNT(*) as total_etape,
  COUNT(DISTINCT factura_id) as facturi_distincte,
  SUM(valoare_ron) as total_valoare_ron,
  MIN(data_facturare) as data_prima_factura,
  MAX(data_facturare) as data_ultima_factura
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
WHERE tip_etapa = 'factura_directa'
  AND activ = TRUE
GROUP BY tip_etapa;
*/

-- ==================================================================
-- PASUL 4: Verificare facturi individuale migrate (OPȚIONAL)
-- ==================================================================
-- Rulează acest query pentru a vedea detalii despre facturile migrate:
-- ⚠️ Pentru a rula, SCOATE comentariile /* */ de mai jos:

/*
SELECT
  ef.id as etapa_id,
  ef.factura_id,
  fg.serie,
  fg.numar,
  fg.data_factura,
  fg.client_nume,
  ef.valoare_ron,
  ef.status_incasare,
  ef.data_creare
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
INNER JOIN `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
  ON ef.factura_id = fg.id
WHERE ef.tip_etapa = 'factura_directa'
  AND ef.activ = TRUE
ORDER BY fg.data_factura DESC
LIMIT 20;
*/

-- ==================================================================
-- REZULTATE AȘTEPTATE:
-- - Toate facturile simple (fără etape contract) au acum câte un record în EtapeFacturi_v2
-- - tip_etapa = 'factura_directa' (identificabil pentru raportare)
-- - status_incasare = 'Neincasat' (default, va fi actualizat de auto-match)
-- ==================================================================

-- ==================================================================
-- ROLLBACK (dacă este nevoie):
-- ==================================================================
/*
DELETE FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
WHERE tip_etapa = 'factura_directa'
  AND creat_de = 'Migration_Script_Facturi_Simple';
*/

-- ==================================================================
-- NOTE IMPORTANTE:
-- ==================================================================
-- 1. Acest script este IDEMPOTENT - dacă rulezi din nou, nu va crea duplicate
--    (LEFT JOIN verifică că nu există deja etape pentru factură)
--
-- 2. După migrare, rulează auto-match pentru a încerca matching automat:
--    POST /api/tranzactii/auto-match
--
-- 3. Facturile simple viitoare vor fi inserate automat de generate-hibrid
--    (modificarea este deja implementată în cod)
--
-- 4. Pentru a identifica facturile simple vs. cele cu contracte:
--    - tip_etapa = 'factura_directa' → factură simplă
--    - tip_etapa = 'anexa' sau 'etapa' → factură din contract
-- ==================================================================
