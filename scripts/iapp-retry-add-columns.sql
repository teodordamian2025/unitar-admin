-- ==================================================================
-- Script: Adăugare coloane retry în IappFacturiEmise_v2
-- Data: 2026-01-26
-- Descriere: Adaugă coloane pentru sistemul de retry automat iapp.ro
-- IMPORTANT: Rulează fiecare comandă separat în BigQuery Console!
-- ==================================================================

-- ============================================================
-- PASUL 1: Adaugă coloanele (fără DEFAULT)
-- ============================================================

-- 1a. Adaugă coloana retry_count
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS retry_count INT64;

-- 1b. Adaugă coloana next_retry_at
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;

-- 1c. Adaugă coloana retry_history
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ADD COLUMN IF NOT EXISTS retry_history JSON;

-- ============================================================
-- PASUL 2: Setează valori DEFAULT pentru coloane
-- ============================================================

ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
ALTER COLUMN retry_count SET DEFAULT 1;

-- ============================================================
-- PASUL 3: Actualizează înregistrările existente cu valoarea default
-- ============================================================

UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappFacturiEmise_v2`
SET retry_count = 1
WHERE retry_count IS NULL;

-- ============================================================
-- PASUL 4: Verificare coloane adăugate
-- ============================================================

SELECT column_name, data_type
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'IappFacturiEmise_v2'
  AND column_name IN ('retry_count', 'next_retry_at', 'retry_history');
