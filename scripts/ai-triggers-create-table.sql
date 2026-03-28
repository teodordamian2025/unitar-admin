-- Script creare tabel AI_Triggers_v2 pentru reacții proactive ale agentului AI
-- Rulati in BigQuery Console
-- Data: 28.03.2026

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.AI_Triggers_v2` (
  id STRING NOT NULL,
  tip_trigger STRING NOT NULL,            -- 'status_change', 'deadline_approaching', 'reminder', 'scheduled_check', 'missing_document'
  eveniment STRING NOT NULL,              -- ce a declanșat: 'proiect_finalizat', 'pv_fara_factura', 'factura_scadenta', etc.
  actiune_sugerata STRING NOT NULL,       -- ce ar trebui făcut: 'genereaza_pv', 'genereaza_factura', 'trimite_email', etc.
  mesaj_utilizator STRING NOT NULL,       -- mesajul pe care AI îl va afișa utilizatorului
  user_id STRING NOT NULL,                -- destinatarul triggerului
  entity_type STRING,                     -- 'proiect', 'client', 'contract', 'factura', 'sarcina'
  entity_id STRING,                       -- FK către entitate
  entity_name STRING,                     -- denumire entitate (pentru afișare)
  context_json STRING,                    -- JSON cu date suplimentare
  prioritate INT64 DEFAULT 5,             -- 1-10 (10 = urgent)
  status STRING NOT NULL DEFAULT 'activ', -- 'activ', 'afisat', 'acceptat', 'refuzat', 'amanat', 'executat', 'expirat'
  programare_data STRING,                 -- YYYY-MM-DD - data la care se activează (NULL = imediat)
  amanat_pana_la STRING,                  -- YYYY-MM-DD - dacă userul a zis "nu acum"
  raspuns_utilizator STRING,              -- ce a răspuns userul
  creat_de STRING DEFAULT 'system',       -- 'system', 'ai_agent', 'cron'
  procesat_la TIMESTAMP,                  -- când a fost procesat/afișat
  creat_la TIMESTAMP NOT NULL,
  actualizat_la TIMESTAMP,
  data_creare DATE NOT NULL               -- PARTITION KEY
)
PARTITION BY data_creare
CLUSTER BY user_id, status, tip_trigger
OPTIONS(
  description = 'Triggers pentru reacții proactive ale agentului AI - sugestii automate bazate pe evenimente',
  labels = [("component", "ai_agent"), ("version", "v2")]
);
