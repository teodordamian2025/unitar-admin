-- ==================================================================
-- SCRIPT: Adăugare coloană progres_procent în tabele Proiecte_v2 și Subproiecte_v2
-- DATA: 04.10.2025 21:45 (ora României)
-- DESCRIERE: Adaugă tracking progres pentru proiecte și subproiecte (0-100%)
-- ==================================================================

-- 1. Adăugare coloană în Proiecte_v2
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
ADD COLUMN IF NOT EXISTS progres_procent INT64;

-- 2. Adăugare coloană în Subproiecte_v2
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
ADD COLUMN IF NOT EXISTS progres_procent INT64;

-- 3. Setare valoare default 0 pentru înregistrările existente în Proiecte_v2
UPDATE `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
SET progres_procent = 0
WHERE progres_procent IS NULL;

-- 4. Setare valoare default 0 pentru înregistrările existente în Subproiecte_v2
UPDATE `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
SET progres_procent = 0
WHERE progres_procent IS NULL;

-- ==================================================================
-- VERIFICARE: Rulează după script pentru a confirma
-- ==================================================================

-- Verificare coloană adăugată în Proiecte_v2
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Proiecte_v2' AND column_name = 'progres_procent';

-- Verificare coloană adăugată în Subproiecte_v2
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Subproiecte_v2' AND column_name = 'progres_procent';

-- Verificare date actualizate
SELECT ID_Proiect, Denumire, progres_procent
FROM `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
LIMIT 5;

SELECT ID_Subproiect, Denumire, progres_procent
FROM `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
LIMIT 5;
