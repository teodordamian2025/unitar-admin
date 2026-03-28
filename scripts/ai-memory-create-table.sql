-- Script creare tabel AI_Memory_v2 pentru memoria persistenta a agentului AI
-- Rulati in BigQuery Console
-- Data: 28.03.2026
-- NOTA: BigQuery nu suporta DEFAULT - valorile default sunt setate in codul API

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.AI_Memory_v2` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  entity_type STRING,
  entity_id STRING,
  tip_memorie STRING NOT NULL,
  continut STRING NOT NULL,
  tags STRING,
  prioritate INT64,
  activ BOOL,
  expira_la TIMESTAMP,
  reminder_data STRING,
  reminder_executat BOOL,
  creat_de STRING,
  creat_la TIMESTAMP NOT NULL,
  actualizat_la TIMESTAMP,
  data_creare DATE NOT NULL
)
PARTITION BY data_creare
CLUSTER BY user_id, entity_type, tip_memorie
OPTIONS(
  description = 'Memoria persistenta a agentului AI - note, decizii, preferinte, remindere',
  labels = [("component", "ai_agent"), ("version", "v2")]
);
