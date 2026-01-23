-- ==================================================================
-- Script: add-exclude-notificari-column.sql
-- Data: 23.01.2026
-- Descriere: Adaugă coloana exclude_notificari_plata în FacturiGenerate_v2
-- pentru a permite excluderea facturilor vechi din notificările de întârziere
-- ==================================================================

-- PASUL 1: Adaugă coloana nouă (dacă nu există)
-- Această coloană permite marcarea facturilor care nu trebuie să trimită notificări
-- de întârziere plată (de ex: facturi vechi adăugate retroactiv pentru documentație)

ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2`
ADD COLUMN IF NOT EXISTS exclude_notificari_plata BOOL DEFAULT FALSE;

-- Descriere coloană:
-- FALSE (default) = Factura este inclusă în verificările de notificări întârziere
-- TRUE = Factura este exclusă din notificări (facturi vechi importate pentru documentație)

-- PASUL 2: Verificare că coloana a fost adăugată
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'FacturiGenerate_v2'
AND column_name = 'exclude_notificari_plata';
