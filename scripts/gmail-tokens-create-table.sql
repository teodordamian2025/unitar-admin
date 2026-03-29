-- Script creare tabel GmailTokens_v2 pentru OAuth tokens Gmail API
-- Rulati in BigQuery Console
-- Data: 29.03.2026

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.GmailTokens_v2` (
  id STRING NOT NULL,
  user_email STRING NOT NULL,
  refresh_token STRING NOT NULL,
  access_token STRING,
  expires_at TIMESTAMP NOT NULL,
  scope STRING,
  is_active BOOL,
  creat_la TIMESTAMP NOT NULL,
  actualizat_la TIMESTAMP,
  data_creare DATE NOT NULL
)
PARTITION BY data_creare
CLUSTER BY user_email, is_active
OPTIONS(
  description = 'OAuth tokens Gmail API pentru citire si trimitere emailuri',
  labels = [("component", "ai_agent"), ("version", "v2")]
);
