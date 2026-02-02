-- ==================================================================
-- Script: add-contract-id-to-etape-facturi.sql
-- Data: 02.02.2026
-- Descriere: Adaugă coloana contract_id în EtapeFacturi_v2
-- pentru a permite legături directe la contracte când se facturează
-- fără a selecta etape specifice din contract
-- ==================================================================

-- BigQuery NU suportă ADD COLUMN cu DEFAULT într-o singură comandă
-- Trebuie executate 2 comenzi separate, în ordine:

-- PASUL 1: Adaugă coloana nouă (fără default)
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
ADD COLUMN contract_id STRING;

-- PASUL 2: Populare contract_id pentru înregistrările existente (din EtapeContract)
-- Aceasta actualizează facturile legate de etape contract cu contract_id-ul corespunzător
UPDATE `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
SET ef.contract_id = ec.contract_id
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeContract_v2` ec
WHERE ef.etapa_id = ec.ID_Etapa
AND ef.etapa_id IS NOT NULL;

-- PASUL 3: Populare contract_id pentru înregistrările existente (din AnexeContract)
-- Aceasta actualizează facturile legate de anexe cu contract_id-ul corespunzător
UPDATE `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
SET ef.contract_id = ac.contract_id
FROM `hale-mode-464009-i6.PanouControlUnitar.AnexeContract_v2` ac
WHERE ef.anexa_id = ac.ID_Anexa
AND ef.anexa_id IS NOT NULL
AND ef.contract_id IS NULL;

-- PASUL 4: Verificare că coloana a fost adăugată și populată
SELECT
  column_name,
  data_type,
  is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EtapeFacturi_v2'
AND column_name = 'contract_id';

-- PASUL 5: Verificare date populate
SELECT
  COUNT(*) as total,
  COUNT(contract_id) as cu_contract,
  COUNT(*) - COUNT(contract_id) as fara_contract
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`;

-- Descriere coloană:
-- contract_id: ID-ul contractului asociat facturii
-- - Pentru tip_etapa='contract': Se populează automat din EtapeContract
-- - Pentru tip_etapa='anexa': Se populează automat din AnexeContract
-- - Pentru tip_etapa='contract_direct': Factură directă pe contract (fără etape selectate)
-- - Pentru tip_etapa='factura_directa': Se populează doar dacă factura a fost emisă de pe un contract
-- - NULL: Factura nu are niciun contract asociat (factură pură fără contract)

-- ==================================================================
-- FIX PENTRU DATE EXISTENTE (OPȚIONAL)
-- Rulați aceste query-uri pentru a lega facturile existente de contracte
-- ==================================================================

-- PASUL 6: Identificare facturi directe care ar putea fi legate de un contract
-- Aceasta listează facturile 'factura_directa' fără contract_id dar care au un proiect cu contract
SELECT
  ef.id as etapa_factura_id,
  ef.proiect_id,
  ef.factura_id,
  CONCAT(fg.serie, '-', fg.numar) as numar_factura,
  fg.total as valoare_factura,
  ef.tip_etapa,
  c.ID_Contract,
  c.numar_contract,
  c.Data_Semnare
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
JOIN `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg ON ef.factura_id = fg.id
JOIN `hale-mode-464009-i6.PanouControlUnitar.Contracte_v2` c ON c.proiect_id = ef.proiect_id
WHERE ef.tip_etapa = 'factura_directa'
  AND ef.activ = true
  AND ef.contract_id IS NULL
ORDER BY ef.proiect_id, fg.numar;

-- PASUL 7: UPDATE MANUAL pentru a lega facturile directe existente la contracte
-- ATENȚIE: Rulați mai întâi PASUL 6 pentru a verifica ce se va actualiza!
-- Aceasta va lega toate facturile 'factura_directa' la contractul proiectului corespunzător
-- și va schimba tip_etapa la 'contract_direct'

-- DECOMENTEAZĂ pentru a rula:
/*
UPDATE `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2` ef
SET
  ef.contract_id = c.ID_Contract,
  ef.tip_etapa = 'contract_direct',
  ef.data_actualizare = CURRENT_TIMESTAMP(),
  ef.actualizat_de = 'Migration_Fix_Contract_Link'
FROM `hale-mode-464009-i6.PanouControlUnitar.Contracte_v2` c
WHERE c.proiect_id = ef.proiect_id
  AND ef.tip_etapa = 'factura_directa'
  AND ef.activ = true
  AND ef.contract_id IS NULL;
*/

-- PASUL 8: Verificare după fix
SELECT
  tip_etapa,
  COUNT(*) as total,
  COUNT(contract_id) as cu_contract
FROM `hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi_v2`
WHERE activ = true
GROUP BY tip_etapa
ORDER BY tip_etapa;
