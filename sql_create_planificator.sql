-- ============================================================================
-- TABEL NOU: PlanificatorPersonal
-- DATA: 27.09.2025 (ora României)
-- DESCRIERE: Tabel pentru stocarea configurației planificatorului personal
-- FUNCȚIONALITATE: Persistența ordinii, comentariilor și pin-ului activ
-- ============================================================================

CREATE TABLE `PanouControlUnitar.PlanificatorPersonal` (
  id STRING NOT NULL,
  utilizator_uid STRING NOT NULL,
  tip_item STRING NOT NULL, -- 'proiect', 'subproiect', 'sarcina'
  item_id STRING NOT NULL,  -- ID-ul proiectului/subproiectului/sarcinii
  ordine_pozitie INT64 NOT NULL, -- Poziția în lista personalizată (0, 1, 2, ...)
  comentariu_personal STRING, -- Comentariul personal al utilizatorului
  is_pinned BOOL DEFAULT FALSE, -- Dacă este pin-at (task-ul la care lucrează acum)
  data_adaugare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  activ BOOL DEFAULT TRUE,

  -- Metadata pentru notificări inteligente
  reminder_enabled BOOL DEFAULT TRUE,
  reminder_days_before INT64 DEFAULT 3, -- Cu câte zile înainte să notifice
  last_notification_sent TIMESTAMP,

  -- Indexuri pentru performance
  PRIMARY KEY (id)
);

-- Index pentru căutare rapidă după utilizator
CREATE INDEX idx_planificator_utilizator
ON `PanouControlUnitar.PlanificatorPersonal` (utilizator_uid, ordine_pozitie);

-- Index pentru pin-ul activ (doar unul per utilizator)
CREATE INDEX idx_planificator_pinned
ON `PanouControlUnitar.PlanificatorPersonal` (utilizator_uid, is_pinned)
WHERE is_pinned = TRUE;

-- Index pentru notificări
CREATE INDEX idx_planificator_reminders
ON `PanouControlUnitar.PlanificatorPersonal` (reminder_enabled, last_notification_sent)
WHERE reminder_enabled = TRUE;

-- View pentru date complete cu join-uri
CREATE VIEW `PanouControlUnitar.V_PlanificatorComplete` AS
SELECT
  p.id as planificator_id,
  p.utilizator_uid,
  p.tip_item,
  p.item_id,
  p.ordine_pozitie,
  p.comentariu_personal,
  p.is_pinned,
  p.reminder_enabled,
  p.reminder_days_before,

  -- Proiecte
  pr.Denumire as proiect_denumire,
  pr.Data_Start as proiect_data_start,
  pr.Data_Final as proiect_data_final,
  pr.Status as proiect_status,
  pr.Responsabil as proiect_responsabil,

  -- Subproiecte
  sp.Denumire as subproiect_denumire,
  sp.Data_Start as subproiect_data_start,
  sp.Data_Final as subproiect_data_final,
  sp.Status as subproiect_status,
  sp.Responsabil as subproiect_responsabil,

  -- Sarcini
  s.titlu as sarcina_titlu,
  s.descriere as sarcina_descriere,
  s.prioritate as sarcina_prioritate,
  s.status as sarcina_status,
  s.data_scadenta as sarcina_data_scadenta,
  s.progres_procent as sarcina_progres,

  -- Calculare urgență pentru sortare automată
  CASE
    WHEN p.tip_item = 'sarcina' AND s.data_scadenta IS NOT NULL THEN
      DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY)
    WHEN p.tip_item = 'subproiect' AND sp.Data_Final IS NOT NULL THEN
      DATE_DIFF(sp.Data_Final, CURRENT_DATE(), DAY)
    WHEN p.tip_item = 'proiect' AND pr.Data_Final IS NOT NULL THEN
      DATE_DIFF(pr.Data_Final, CURRENT_DATE(), DAY)
    ELSE 999
  END as zile_pana_scadenta,

  -- Status afișare pentru UI
  CASE
    WHEN p.tip_item = 'proiect' THEN CONCAT('📁 ', pr.Denumire)
    WHEN p.tip_item = 'subproiect' THEN CONCAT('📂 ', sp.Denumire, ' (', pr.Denumire, ')')
    WHEN p.tip_item = 'sarcina' THEN CONCAT('✅ ', s.titlu, ' (', pr.Denumire, ')')
  END as display_name,

  p.data_actualizare

FROM `PanouControlUnitar.PlanificatorPersonal` p
LEFT JOIN `PanouControlUnitar.Proiecte` pr ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect
LEFT JOIN `PanouControlUnitar.Subproiecte` sp ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
LEFT JOIN `PanouControlUnitar.Sarcini` s ON p.tip_item = 'sarcina' AND p.item_id = s.id

WHERE p.activ = TRUE
ORDER BY p.ordine_pozitie ASC;