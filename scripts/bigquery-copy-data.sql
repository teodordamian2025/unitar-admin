-- ==================================================================
-- SCRIPT COPIERE DATE DIN TABELE VECHI → TABELE NOI V2
-- Data: 01.10.2025 (ora României)
-- Descriere: Copiază toate datele direct în BigQuery Console
-- Dataset: PanouControlUnitar
-- Instrucțiuni: Rulează fiecare bloc INSERT în BigQuery Console
-- ==================================================================

-- ==================================================================
-- CATEGORIA 1: TIME-SERIES TABLES (19 tabele)
-- ==================================================================

-- 1. AnafEFactura
INSERT INTO `PanouControlUnitar.AnafEFactura_v2`
SELECT * FROM `PanouControlUnitar.AnafEFactura`;

-- 2. AnafErrorLog
INSERT INTO `PanouControlUnitar.AnafErrorLog_v2`
SELECT * FROM `PanouControlUnitar.AnafErrorLog`;

-- 3. AnafNotificationLog
INSERT INTO `PanouControlUnitar.AnafNotificationLog_v2`
SELECT * FROM `PanouControlUnitar.AnafNotificationLog`;

-- 4. AnexeContract
INSERT INTO `PanouControlUnitar.AnexeContract_v2`
SELECT * FROM `PanouControlUnitar.AnexeContract`;

-- 5. Contracte
INSERT INTO `PanouControlUnitar.Contracte_v2`
SELECT * FROM `PanouControlUnitar.Contracte`;

-- 6. EtapeContract
INSERT INTO `PanouControlUnitar.EtapeContract_v2`
SELECT * FROM `PanouControlUnitar.EtapeContract`;

-- 7. EtapeFacturi
INSERT INTO `PanouControlUnitar.EtapeFacturi_v2`
SELECT * FROM `PanouControlUnitar.EtapeFacturi`;

-- 8. FacturiGenerate
INSERT INTO `PanouControlUnitar.FacturiGenerate_v2`
SELECT * FROM `PanouControlUnitar.FacturiGenerate`;

-- 9. FacturiPrimite
INSERT INTO `PanouControlUnitar.FacturiPrimite_v2`
SELECT * FROM `PanouControlUnitar.FacturiPrimite`;

-- 10. PlanificatorPersonal
INSERT INTO `PanouControlUnitar.PlanificatorPersonal_v2`
SELECT * FROM `PanouControlUnitar.PlanificatorPersonal`;

-- 11. ProcesVerbale
INSERT INTO `PanouControlUnitar.ProcesVerbale_v2`
SELECT * FROM `PanouControlUnitar.ProcesVerbale`;

-- 12. ProiectComentarii
INSERT INTO `PanouControlUnitar.ProiectComentarii_v2`
SELECT * FROM `PanouControlUnitar.ProiectComentarii`;

-- 13. Proiecte
INSERT INTO `PanouControlUnitar.Proiecte_v2`
SELECT * FROM `PanouControlUnitar.Proiecte`;

-- 14. ProiecteCheltuieli
INSERT INTO `PanouControlUnitar.ProiecteCheltuieli_v2`
SELECT * FROM `PanouControlUnitar.ProiecteCheltuieli`;

-- 15. Sarcini
INSERT INTO `PanouControlUnitar.Sarcini_v2`
SELECT * FROM `PanouControlUnitar.Sarcini`;

-- 16. SesiuniLucru
INSERT INTO `PanouControlUnitar.SesiuniLucru_v2`
SELECT * FROM `PanouControlUnitar.SesiuniLucru`;

-- 17. Subproiecte
INSERT INTO `PanouControlUnitar.Subproiecte_v2`
SELECT * FROM `PanouControlUnitar.Subproiecte`;

-- 18. TimeTracking
INSERT INTO `PanouControlUnitar.TimeTracking_v2`
SELECT * FROM `PanouControlUnitar.TimeTracking`;

-- 19. TranzactiiBancare
INSERT INTO `PanouControlUnitar.TranzactiiBancare_v2`
SELECT * FROM `PanouControlUnitar.TranzactiiBancare`;

-- ==================================================================
-- CATEGORIA 2: LOOKUP TABLES (13 tabele)
-- ==================================================================

-- 20. AnafTokens
INSERT INTO `PanouControlUnitar.AnafTokens_v2`
SELECT * FROM `PanouControlUnitar.AnafTokens`;

-- 21. Clienti
INSERT INTO `PanouControlUnitar.Clienti_v2`
SELECT * FROM `PanouControlUnitar.Clienti`;

-- 22. CursuriValutare
INSERT INTO `PanouControlUnitar.CursuriValutare_v2`
SELECT * FROM `PanouControlUnitar.CursuriValutare`;

-- 23. Produse
INSERT INTO `PanouControlUnitar.Produse_v2`
SELECT * FROM `PanouControlUnitar.Produse`;

-- 24. ProiecteResponsabili
INSERT INTO `PanouControlUnitar.ProiecteResponsabili_v2`
SELECT * FROM `PanouControlUnitar.ProiecteResponsabili`;

-- 25. SarciniResponsabili
INSERT INTO `PanouControlUnitar.SarciniResponsabili_v2`
SELECT * FROM `PanouControlUnitar.SarciniResponsabili`;

-- 26. Subcontractanti
INSERT INTO `PanouControlUnitar.Subcontractanti_v2`
SELECT * FROM `PanouControlUnitar.Subcontractanti`;

-- 27. SubproiecteResponsabili
INSERT INTO `PanouControlUnitar.SubproiecteResponsabili_v2`
SELECT * FROM `PanouControlUnitar.SubproiecteResponsabili`;

-- 28. TranzactiiAccounts
INSERT INTO `PanouControlUnitar.TranzactiiAccounts_v2`
SELECT * FROM `PanouControlUnitar.TranzactiiAccounts`;

-- 29. TranzactiiMatching
INSERT INTO `PanouControlUnitar.TranzactiiMatching_v2`
SELECT * FROM `PanouControlUnitar.TranzactiiMatching`;

-- 30. TranzactiiSyncLogs
INSERT INTO `PanouControlUnitar.TranzactiiSyncLogs_v2`
SELECT * FROM `PanouControlUnitar.TranzactiiSyncLogs`;

-- 31. Utilizatori
INSERT INTO `PanouControlUnitar.Utilizatori_v2`
SELECT * FROM `PanouControlUnitar.Utilizatori`;

-- 32. TranzactiiStats
INSERT INTO `PanouControlUnitar.TranzactiiStats_v2`
SELECT * FROM `PanouControlUnitar.TranzactiiStats`;

-- ==================================================================
-- VERIFICARE COPIERE COMPLETĂ
-- ==================================================================

-- Rulează query-ul de mai jos pentru a verifica count(*) pentru toate tabelele:

SELECT
  'AnafEFactura' as tabel,
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafEFactura`) as count_vechi,
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafEFactura_v2`) as count_nou
UNION ALL
SELECT 'AnafErrorLog',
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafErrorLog`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafErrorLog_v2`)
UNION ALL
SELECT 'AnafNotificationLog',
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafNotificationLog`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafNotificationLog_v2`)
UNION ALL
SELECT 'AnexeContract',
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnexeContract`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnexeContract_v2`)
UNION ALL
SELECT 'Contracte',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Contracte`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Contracte_v2`)
UNION ALL
SELECT 'EtapeContract',
  (SELECT COUNT(*) FROM `PanouControlUnitar.EtapeContract`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.EtapeContract_v2`)
UNION ALL
SELECT 'EtapeFacturi',
  (SELECT COUNT(*) FROM `PanouControlUnitar.EtapeFacturi`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.EtapeFacturi_v2`)
UNION ALL
SELECT 'FacturiGenerate',
  (SELECT COUNT(*) FROM `PanouControlUnitar.FacturiGenerate`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.FacturiGenerate_v2`)
UNION ALL
SELECT 'FacturiPrimite',
  (SELECT COUNT(*) FROM `PanouControlUnitar.FacturiPrimite`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.FacturiPrimite_v2`)
UNION ALL
SELECT 'PlanificatorPersonal',
  (SELECT COUNT(*) FROM `PanouControlUnitar.PlanificatorPersonal`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.PlanificatorPersonal_v2`)
UNION ALL
SELECT 'ProcesVerbale',
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProcesVerbale`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProcesVerbale_v2`)
UNION ALL
SELECT 'ProiectComentarii',
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiectComentarii`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiectComentarii_v2`)
UNION ALL
SELECT 'Proiecte',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Proiecte`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Proiecte_v2`)
UNION ALL
SELECT 'ProiecteCheltuieli',
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiecteCheltuieli`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiecteCheltuieli_v2`)
UNION ALL
SELECT 'Sarcini',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Sarcini`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Sarcini_v2`)
UNION ALL
SELECT 'SesiuniLucru',
  (SELECT COUNT(*) FROM `PanouControlUnitar.SesiuniLucru`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.SesiuniLucru_v2`)
UNION ALL
SELECT 'Subproiecte',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Subproiecte`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Subproiecte_v2`)
UNION ALL
SELECT 'TimeTracking',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TimeTracking`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TimeTracking_v2`)
UNION ALL
SELECT 'TranzactiiBancare',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiBancare`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiBancare_v2`)
UNION ALL
SELECT 'AnafTokens',
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafTokens`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.AnafTokens_v2`)
UNION ALL
SELECT 'Clienti',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Clienti`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Clienti_v2`)
UNION ALL
SELECT 'CursuriValutare',
  (SELECT COUNT(*) FROM `PanouControlUnitar.CursuriValutare`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.CursuriValutare_v2`)
UNION ALL
SELECT 'Produse',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Produse`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Produse_v2`)
UNION ALL
SELECT 'ProiecteResponsabili',
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiecteResponsabili`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.ProiecteResponsabili_v2`)
UNION ALL
SELECT 'SarciniResponsabili',
  (SELECT COUNT(*) FROM `PanouControlUnitar.SarciniResponsabili`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.SarciniResponsabili_v2`)
UNION ALL
SELECT 'Subcontractanti',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Subcontractanti`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Subcontractanti_v2`)
UNION ALL
SELECT 'SubproiecteResponsabili',
  (SELECT COUNT(*) FROM `PanouControlUnitar.SubproiecteResponsabili`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.SubproiecteResponsabili_v2`)
UNION ALL
SELECT 'TranzactiiAccounts',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiAccounts`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiAccounts_v2`)
UNION ALL
SELECT 'TranzactiiMatching',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiMatching`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiMatching_v2`)
UNION ALL
SELECT 'TranzactiiSyncLogs',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiSyncLogs`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiSyncLogs_v2`)
UNION ALL
SELECT 'Utilizatori',
  (SELECT COUNT(*) FROM `PanouControlUnitar.Utilizatori`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.Utilizatori_v2`)
UNION ALL
SELECT 'TranzactiiStats',
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiStats`),
  (SELECT COUNT(*) FROM `PanouControlUnitar.TranzactiiStats_v2`)
ORDER BY tabel;

-- Rezultatul ar trebui să arate așa:
-- tabel                    | count_vechi | count_nou
-- -------------------------|-------------|----------
-- AnafEFactura            | 150         | 150       ✅
-- AnafErrorLog            | 45          | 45        ✅
-- ...
-- Utilizatori             | 12          | 12        ✅

-- Dacă count_vechi = count_nou pentru TOATE tabelele → SUCCESS! ✅
