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
  id STRING NOT NULL OPTIONS(description="UUID unic pentru configurație Smart Fintech"),

  -- Credentials (encrypted)
  client_id STRING OPTIONS(description="Client ID Smart Fintech (plain text)"),
  client_secret STRING OPTIONS(description="Client Secret Smart Fintech (ENCRYPTED cu ANAF_TOKEN_ENCRYPTION_KEY)"),

  -- OAuth Tokens (encrypted)
  access_token STRING OPTIONS(description="Access token OAuth 2.0 (ENCRYPTED)"),
  refresh_token STRING OPTIONS(description="Refresh token OAuth 2.0 (ENCRYPTED)"),
  expires_at TIMESTAMP OPTIONS(description="Data/ora expirare access token"),

  -- Status & Control
  is_active BOOL DEFAULT TRUE OPTIONS(description="Flag activ/inactiv (doar o configurație poate fi activă)"),
  ultima_sincronizare TIMESTAMP OPTIONS(description="Timestamp ultima sincronizare reușită"),
  ultima_eroare STRING OPTIONS(description="Mesaj ultimei erori (NULL dacă OK)"),
  numar_conturi INT64 DEFAULT 0 OPTIONS(description="Număr conturi conectate"),

  -- Audit Fields
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="Data creare configurație"),
  data_actualizare TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="Data ultima modificare"),
  creat_de STRING OPTIONS(description="UID utilizator creator (admin)"),

  -- Metadata JSON (opțional)
  metadata JSON OPTIONS(description="Date suplimentare (ex: lista IBAN-uri conectate)")
)
PARTITION BY DATE(data_creare)
CLUSTER BY (is_active, id)
OPTIONS(
  description="Tabel OAuth token management pentru Smart Fintech API - v2 cu partitioning + clustering",
  labels=[("environment", "production"), ("version", "v2"), ("feature", "smartfintech")]
);

-- Index pentru query rapid token activ
-- BigQuery nu suportă indexuri explicite, dar CLUSTER BY (is_active, id) optimizează query-uri cu WHERE is_active = TRUE

-- Seed configurație inițială (DOAR LA PRIMUL DEPLOY)
-- NOTĂ: Client Secret va fi criptat de API la prima salvare din UI
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.SmartFintechTokens_v2`
  (id, client_id, client_secret, is_active, data_creare, data_actualizare, creat_de)
VALUES
  (
    'smartfintech_default_001',
    'ahdJHJM-87844kjkfgf-fgfghf9jnfdf',
    NULL,  -- Va fi populat din UI (encrypted)
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    'system_init'
  )
ON CONFLICT (id) DO NOTHING;  -- BigQuery folosește INSERT ... ON CONFLICT pentru UPSERT

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
