-- Script creare tabel AI_Triggers_v2 pentru reacții proactive ale agentului AI
-- Rulati in BigQuery Console
-- Data: 28.03.2026
-- NOTA: BigQuery nu suporta DEFAULT - valorile default sunt setate in codul API

CREATE TABLE IF NOT EXISTS `PanouControlUnitar.AI_Triggers_v2` (
  id STRING NOT NULL,
  tip_trigger STRING NOT NULL,
  eveniment STRING NOT NULL,
  actiune_sugerata STRING NOT NULL,
  mesaj_utilizator STRING NOT NULL,
  user_id STRING NOT NULL,
  entity_type STRING,
  entity_id STRING,
  entity_name STRING,
  context_json STRING,
  prioritate INT64,
  status STRING NOT NULL,
  programare_data STRING,
  amanat_pana_la STRING,
  raspuns_utilizator STRING,
  creat_de STRING,
  procesat_la TIMESTAMP,
  creat_la TIMESTAMP NOT NULL,
  actualizat_la TIMESTAMP,
  data_creare DATE NOT NULL
)
PARTITION BY data_creare
CLUSTER BY user_id, status, tip_trigger
OPTIONS(
  description = 'Triggers pentru reactii proactive ale agentului AI',
  labels = [("component", "ai_agent"), ("version", "v2")]
);
