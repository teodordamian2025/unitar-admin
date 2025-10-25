-- =====================================================
-- Script: Adaugă câmp auto_download_pdfs_iapp în IappConfig_v2
-- Data: 25.10.2025
-- Descriere: Toggle pentru download automat PDF-uri facturi primite iapp.ro în Google Drive
-- =====================================================

-- IMPORTANT: BigQuery necesită 3 pași separați pentru ADD COLUMN cu DEFAULT
-- Rulează fiecare comandă individual în BigQuery Console

-- ===== PAS 1: Adaugă coloană nouă (fără default) =====
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ADD COLUMN IF NOT EXISTS auto_download_pdfs_iapp BOOLEAN
OPTIONS(description='Download automat PDF-uri facturi primite din iapp.ro în Google Drive (arhivare min 5 ani)');

-- ===== PAS 2: Setează default pentru viitor =====
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ALTER COLUMN auto_download_pdfs_iapp SET DEFAULT TRUE;

-- ===== PAS 3: Actualizează înregistrările existente =====
UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
SET auto_download_pdfs_iapp = TRUE
WHERE auto_download_pdfs_iapp IS NULL;

-- ===== VERIFICARE: Afișează schema actualizată =====
SELECT column_name, data_type, is_nullable, column_default
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'IappConfig_v2'
  AND column_name = 'auto_download_pdfs_iapp';

-- ===== VERIFICARE: Afișează datele din tabel =====
SELECT
  id,
  email_responsabil,
  tip_facturare,
  sursa_facturi_primite,
  auto_download_pdfs_iapp,
  activ
FROM `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ORDER BY data_creare DESC
LIMIT 5;

-- =====================================================
-- NOTĂ:
-- - Rulează fiecare comandă INDIVIDUAL în BigQuery Console
-- - URL: https://console.cloud.google.com/bigquery
-- - Estimat storage: ~50-200 MB/lună pentru 100 facturi
-- - Arhivare long-term: minim 5 ani
-- =====================================================
