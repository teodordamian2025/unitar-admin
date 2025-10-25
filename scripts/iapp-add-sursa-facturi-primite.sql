-- =====================================================
-- Script: Adaugă câmp sursa_facturi_primite în IappConfig_v2
-- Data: 25.10.2025
-- Descriere: Permite alegerea sursei pentru sincronizare facturi primite (iapp.ro sau ANAF)
-- =====================================================

-- IMPORTANT: BigQuery necesită 3 pași separați pentru ADD COLUMN cu DEFAULT
-- Rulează fiecare comandă individual în BigQuery Console

-- ===== PAS 1: Adaugă coloană nouă (fără default) =====
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ADD COLUMN IF NOT EXISTS sursa_facturi_primite STRING
OPTIONS(description='Sursa pentru sincronizare facturi primite: iapp sau anaf');

-- ===== PAS 2: Setează default pentru viitor =====
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ALTER COLUMN sursa_facturi_primite SET DEFAULT 'iapp';

-- ===== PAS 3: Actualizează înregistrările existente =====
UPDATE `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
SET sursa_facturi_primite = 'iapp'
WHERE sursa_facturi_primite IS NULL;

-- ===== VERIFICARE: Afișează schema actualizată =====
SELECT column_name, data_type, is_nullable, column_default
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'IappConfig_v2'
ORDER BY ordinal_position;

-- ===== VERIFICARE: Afișează datele din tabel =====
SELECT id, email_responsabil, tip_facturare, sursa_facturi_primite, activ
FROM `hale-mode-464009-i6.PanouControlUnitar.IappConfig_v2`
ORDER BY data_creare DESC
LIMIT 5;

-- =====================================================
-- NOTĂ: Rulează fiecare comandă INDIVIDUAL în BigQuery Console
-- URL: https://console.cloud.google.com/bigquery
-- =====================================================
