-- ==================================================================
-- SCRIPT: smartfintech-create-table.sql
-- DATA: 18.10.2025 (ora României)
-- DESCRIERE: Creare tabel SmartFintechTokens_v2 pentru OAuth token management
-- OBIECTIV: Stocare securizată token-uri Smart Fintech API cu encryption
-- ==================================================================

-- Drop table if exists (doar pentru re-create în dev)
-- DROP TABLE IF EXISTS `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`;

CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2` (
  -- Primary Key
  id STRING NOT NULL,

  -- Credentials (encrypted)
  client_id STRING,
  client_secret STRING,

  -- OAuth Tokens (encrypted)
  access_token STRING,
  refresh_token STRING,
  expires_at TIMESTAMP,

  -- Status & Control
  is_active BOOL,
  ultima_sincronizare TIMESTAMP,
  ultima_eroare STRING,
  numar_conturi INT64,

  -- Audit Fields
  data_creare TIMESTAMP,
  data_actualizare TIMESTAMP,
  creat_de STRING,

  -- Metadata JSON (optional)
  metadata JSON
)
PARTITION BY DATE(data_creare)
CLUSTER BY is_active, id
OPTIONS(
  description="Tabel OAuth token management pentru Smart Fintech API - v2 cu partitioning + clustering"
);

-- Index pentru query rapid token activ
-- BigQuery nu suportă indexuri explicite, dar CLUSTER BY (is_active, id) optimizează query-uri cu WHERE is_active = TRUE

-- Seed configurație inițială (DOAR LA PRIMUL DEPLOY)
-- NOTĂ: Client Secret va fi criptat de API la prima salvare din UI
-- Folosim MERGE pentru UPSERT (BigQuery nu suportă ON CONFLICT)
MERGE `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2` T
USING (
  SELECT
    'smartfintech_default_001' as id,
    'ahdJHJM-87844kjkfgf-fgfghf9jnfdf' as client_id,
    CAST(NULL AS STRING) as client_secret,
    TRUE as is_active,
    CURRENT_TIMESTAMP() as data_creare,
    CURRENT_TIMESTAMP() as data_actualizare,
    'system_init' as creat_de
) S
ON T.id = S.id
WHEN NOT MATCHED THEN
  INSERT (id, client_id, client_secret, is_active, data_creare, data_actualizare, creat_de)
  VALUES (S.id, S.client_id, S.client_secret, S.is_active, S.data_creare, S.data_actualizare, S.creat_de);

-- Verificare creare tabel
SELECT
  'SmartFintechTokens_v2 created successfully' as status,
  COUNT(*) as row_count
FROM `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`;

-- ==================================================================
-- INSTRUCȚIUNI UTILIZARE:
-- 1. Rulează în BigQuery Console (SQL Workspace)
-- 2. Verifică că tabelul apare în dataset PanouControlUnitar
-- 3. Client Secret va fi setat din Admin UI (/admin/setari/smartfintech)
-- ==================================================================
