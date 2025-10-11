-- ==================================================================
-- SCRIPT: Adaugă coloane noi pentru sistem retry inteligent ANAF
-- DATA: 2025-10-12
-- TABEL: AnafEFactura_v2
-- ==================================================================

-- 1. Adaugă coloană next_retry_at (TIMESTAMP când trebuie făcut următorul retry)
ALTER TABLE `PanouControlUnitar.AnafEFactura_v2`
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;

-- 2. Adaugă coloană should_retry (BOOLEAN - TRUE dacă mai trebuie retry, FALSE pentru stop)
-- ✅ FIX: BigQuery nu permite DEFAULT în ADD COLUMN - se face în 2 pași
ALTER TABLE `PanouControlUnitar.AnafEFactura_v2`
ADD COLUMN IF NOT EXISTS should_retry BOOL;

-- 3. Setează DEFAULT pentru should_retry
ALTER TABLE `PanouControlUnitar.AnafEFactura_v2`
ALTER COLUMN should_retry SET DEFAULT TRUE;

-- 4. Adaugă coloană error_category (STRING - categorie eroare pentru strategie retry)
ALTER TABLE `PanouControlUnitar.AnafEFactura_v2`
ADD COLUMN IF NOT EXISTS error_category STRING;

-- 4. Update rânduri existente cu valori default
UPDATE `PanouControlUnitar.AnafEFactura_v2`
SET
  should_retry = CASE
    WHEN anaf_status = 'draft' THEN TRUE
    WHEN anaf_status = 'error' AND retry_count < 3 THEN TRUE
    ELSE FALSE
  END,
  error_category = CASE
    WHEN error_message LIKE '%token%' OR error_message LIKE '%OAuth%' THEN 'oauth_expired'
    WHEN error_message LIKE '%timeout%' THEN 'anaf_timeout'
    WHEN error_message LIKE '%XML%' THEN 'xml_validation'
    WHEN error_message LIKE '%connection%' THEN 'anaf_connection'
    ELSE 'unknown_error'
  END,
  next_retry_at = CASE
    WHEN anaf_status = 'draft' THEN TIMESTAMP_ADD(data_creare, INTERVAL 5 MINUTE)
    WHEN anaf_status = 'error' AND retry_count = 1 THEN TIMESTAMP_ADD(data_actualizare, INTERVAL 10 MINUTE)
    WHEN anaf_status = 'error' AND retry_count = 2 THEN TIMESTAMP_ADD(data_actualizare, INTERVAL 20 MINUTE)
    ELSE NULL
  END
WHERE anaf_status IN ('draft', 'error')
  AND data_creare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 MINUTE);

-- Verificare rezultate
SELECT
  anaf_status,
  should_retry,
  error_category,
  next_retry_at,
  COUNT(*) as count
FROM `PanouControlUnitar.AnafEFactura_v2`
GROUP BY anaf_status, should_retry, error_category, next_retry_at
ORDER BY anaf_status, should_retry;
