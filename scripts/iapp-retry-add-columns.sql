-- ==================================================================
-- Script: Adăugare coloane retry în IappFacturiEmise_v2
-- Data: 2026-01-26
-- Descriere: Adaugă coloane pentru sistemul de retry automat iapp.ro
-- ==================================================================

-- Adaugă coloana retry_count (număr încercări)
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS retry_count INT64 DEFAULT 1;

-- Adaugă coloana next_retry_at (când să încerce din nou)
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;

-- Adaugă coloana retry_history (istoric încercări - JSON)
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS retry_history JSON;

-- Verificare coloane adăugate
SELECT column_name, data_type
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'IappFacturiEmise_v2'
  AND column_name IN ('retry_count', 'next_retry_at', 'retry_history');
