-- Script creare tabel AI_Memory_v2 pentru memoria persistenta a agentului AI
-- Rulati in BigQuery Console
-- Data: 28.03.2026

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.AI_Memory_v2` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,                -- UID utilizator sau 'global' pentru note comune
  entity_type STRING,                     -- 'proiect', 'client', 'contract', 'sarcina', 'general'
  entity_id STRING,                       -- FK optional catre entitate
  tip_memorie STRING NOT NULL,            -- 'nota', 'decizie', 'preferinta', 'reminder', 'context'
  continut STRING NOT NULL,               -- textul memoriei
  tags STRING,                            -- taguri separate prin virgula pentru cautare
  prioritate INT64 DEFAULT 5,             -- 1-10 (10 = cea mai importanta)
  activ BOOL DEFAULT TRUE,                -- soft delete
  expira_la TIMESTAMP,                    -- NULL = permanent, altfel se ignora dupa expirare
  reminder_data STRING,                   -- data reminder YYYY-MM-DD (pentru tip_memorie = 'reminder')
  reminder_executat BOOL DEFAULT FALSE,   -- true dupa ce reminder-ul a fost livrat
  creat_de STRING,                        -- 'ai_agent' sau UID utilizator
  creat_la TIMESTAMP NOT NULL,
  actualizat_la TIMESTAMP,
  data_creare DATE NOT NULL               -- PARTITION KEY
)
PARTITION BY data_creare
CLUSTER BY user_id, entity_type, tip_memorie
OPTIONS(
  description = 'Memoria persistenta a agentului AI - note, decizii, preferinte, remindere',
  labels = [("component", "ai_agent"), ("version", "v2")]
);
