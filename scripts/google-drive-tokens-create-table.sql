-- =====================================================
-- TABEL: GoogleDriveTokens
-- Store OAuth refresh tokens pentru Google Drive API
-- Pattern: Similar cu AnafTokens (encrypted storage)
-- Data: 08.10.2025
-- =====================================================

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.GoogleDriveTokens` (
  id STRING NOT NULL,
  user_email STRING,
  refresh_token STRING,
  access_token STRING,
  expires_at TIMESTAMP,
  data_creare TIMESTAMP NOT NULL,
  activ BOOLEAN
)
PARTITION BY DATE(data_creare)
CLUSTER BY user_email, activ;

-- Note:
-- - refresh_token: Encrypted cu AES-256-CBC (format: iv:encrypted)
-- - access_token: Plain text (se schimbă la fiecare refresh)
-- - expires_at: Timestamp expirare access_token (refresh automat)
-- - activ: TRUE pentru token-ul curent, FALSE pentru revoked
