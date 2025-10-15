-- ==================================================================
-- Update serial certificat pentru token-ul ANAF existent
-- ==================================================================

-- Update token-ul activ cu serialul certificatului
UPDATE `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
SET
  certificate_serial = '501bf75e00000013b927',
  data_actualizare = CURRENT_TIMESTAMP()
WHERE id = '072c7d85-7159-481a-a9fe-0f182b79536c'
  AND is_active = true;

-- Verificare update
SELECT
  id,
  client_id,
  certificate_serial,
  scope,
  is_active,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', expires_at) as expires_at,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', data_actualizare) as data_actualizare
FROM `hale-mode-464009-i6.PanouControlUnitar.AnafTokens_v2`
WHERE is_active = true
ORDER BY data_creare DESC
LIMIT 1;
