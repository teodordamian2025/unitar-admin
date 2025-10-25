-- ==================================================================
-- SCRIPT: Pin Silent Tracking - Schema Modifications
-- DATA: 25.10.2025 (ora României)
-- DESCRIERE: Adăugare coloane pentru silent time tracking la pin-uri
-- EXECUTARE: Manual în BigQuery Console
-- ==================================================================

-- 1. Modificări tabel PlanificatorPersonal_v2
-- Adăugare coloane pentru tracking timestamp start/stop și durată totală

ALTER TABLE `PanouControlUnitar.PlanificatorPersonal_v2`
ADD COLUMN IF NOT EXISTS pin_timestamp_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS pin_timestamp_stop TIMESTAMP,
ADD COLUMN IF NOT EXISTS pin_total_seconds INT64;

-- Comentarii coloane:
-- pin_timestamp_start: Timestamp când utilizatorul a făcut pin (NULL dacă nu e pin-at)
-- pin_timestamp_stop: Timestamp când utilizatorul a făcut unpin (NULL dacă pin-ul e încă activ)
-- pin_total_seconds: Timpul total acumulat pentru acel pin în secunde (calculat la unpin)


-- 2. Modificări tabel TimeTracking_v2
-- Adăugare tip_inregistrare și referință la planificator item

ALTER TABLE `PanouControlUnitar.TimeTracking_v2`
ADD COLUMN IF NOT EXISTS planificator_item_id STRING;

-- NOTĂ: Coloana tip_inregistrare deja există (conform schemei citite din CSV)
-- Doar adăugăm planificator_item_id pentru referință

-- Comentarii:
-- planificator_item_id: Referință la PlanificatorPersonal_v2.id pentru tracing
-- tip_inregistrare: Va folosi valorile existente: 'manual', 'cronometru', 'pin_silent'


-- ==================================================================
-- VERIFICARE SCHEMA DUPĂ MODIFICĂRI
-- ==================================================================

-- Verifică coloane noi în PlanificatorPersonal_v2
SELECT
  column_name,
  data_type,
  is_nullable
FROM `PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'PlanificatorPersonal_v2'
  AND column_name IN ('pin_timestamp_start', 'pin_timestamp_stop', 'pin_total_seconds')
ORDER BY ordinal_position;

-- Verifică coloană nouă în TimeTracking_v2
SELECT
  column_name,
  data_type,
  is_nullable
FROM `PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'TimeTracking_v2'
  AND column_name = 'planificator_item_id'
ORDER BY ordinal_position;


-- ==================================================================
-- QUERIES DE TEST (OPȚIONAL)
-- ==================================================================

-- Test 1: Verifică pin-uri active (după implementare)
SELECT
  id,
  utilizator_uid,
  tip_item,
  item_id,
  is_pinned,
  pin_timestamp_start,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), pin_timestamp_start, SECOND) as elapsed_seconds
FROM `PanouControlUnitar.PlanificatorPersonal_v2`
WHERE is_pinned = TRUE
  AND pin_timestamp_start IS NOT NULL
  AND pin_timestamp_stop IS NULL
ORDER BY pin_timestamp_start DESC;

-- Test 2: Verifică înregistrări TimeTracking din pin-uri (după implementare)
SELECT
  id,
  utilizator_uid,
  data_lucru,
  ore_lucrate,
  descriere_lucru,
  tip_inregistrare,
  planificator_item_id,
  created_at
FROM `PanouControlUnitar.TimeTracking_v2`
WHERE tip_inregistrare = 'pin_silent'
ORDER BY created_at DESC
LIMIT 10;

-- Test 3: Total ore din pin-uri per utilizator (după implementare)
SELECT
  utilizator_uid,
  utilizator_nume,
  COUNT(*) as total_sessions,
  SUM(ore_lucrate) as total_ore_pin,
  AVG(ore_lucrate) as avg_ore_per_session
FROM `PanouControlUnitar.TimeTracking_v2`
WHERE tip_inregistrare = 'pin_silent'
  AND data_lucru >= CURRENT_DATE() - 7
GROUP BY utilizator_uid, utilizator_nume
ORDER BY total_ore_pin DESC;
