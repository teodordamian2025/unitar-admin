-- ==================================================================
-- SCRIPT: Adăugare coloană data_contract în tabela Contracte_v2
-- DATA: 02.02.2026 (ora României)
-- DESCRIERE: Adaugă câmp pentru data documentului de contract
--            (poate fi diferită de data curentă, pentru contracte retroactive)
-- ==================================================================

-- 1. Adăugare coloană în Contracte_v2
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Contracte_v2`
ADD COLUMN IF NOT EXISTS data_contract DATE;

-- 2. Setare valoare default pentru înregistrările existente (folosim data_creare)
UPDATE `hale-mode-464009-i6.PanouControlUnitar.Contracte_v2`
SET data_contract = DATE(data_creare)
WHERE data_contract IS NULL;

-- ==================================================================
-- VERIFICARE: Rulează după script pentru a confirma
-- ==================================================================

-- Verificare coloană adăugată
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Contracte_v2' AND column_name = 'data_contract';

-- Verificare date actualizate
SELECT ID_Contract, numar_contract, data_contract, data_creare
FROM `hale-mode-464009-i6.PanouControlUnitar.Contracte_v2`
LIMIT 5;
