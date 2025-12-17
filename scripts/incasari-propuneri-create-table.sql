-- =================================================================
-- CREARE TABEL: IncasariPropuneri_v2
-- Sistem încasări automate cu aprobare admin
-- Data: 2025-12-17
-- =================================================================

-- Creare tabel principal pentru propuneri de încasări
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.IncasariPropuneri_v2` (
  -- Identificatori
  id STRING NOT NULL,
  tranzactie_id STRING NOT NULL,
  factura_id STRING NOT NULL,
  etapa_factura_id STRING,

  -- Scoring
  score NUMERIC(5,2) NOT NULL,
  auto_approvable BOOL DEFAULT FALSE,

  -- Sume și diferențe
  suma_tranzactie NUMERIC(15,2) NOT NULL,
  suma_factura NUMERIC(15,2) NOT NULL,
  rest_de_plata NUMERIC(15,2) NOT NULL,
  diferenta_ron NUMERIC(15,2),
  diferenta_procent NUMERIC(5,2),

  -- Detalii matching
  matching_algorithm STRING, -- 'referinta_exacta', 'referinta_partiala', 'cui_suma', etc.
  referinta_gasita STRING, -- Serie-Număr extras din detalii
  matching_details JSON, -- Breakdown complet scoring

  -- Status workflow
  status STRING NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  motiv_respingere STRING,

  -- Date factură (denormalizate pentru UI rapid)
  factura_serie STRING,
  factura_numar STRING,
  factura_client_nume STRING,
  factura_client_cui STRING,

  -- Date tranzacție (denormalizate pentru UI rapid)
  tranzactie_data DATE,
  tranzactie_contrapartida STRING,
  tranzactie_cui STRING,
  tranzactie_detalii STRING,

  -- Audit
  data_creare TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  data_aprobare TIMESTAMP,
  data_respingere TIMESTAMP,
  data_expirare TIMESTAMP,
  aprobat_de STRING,
  respins_de STRING,
  creat_de STRING DEFAULT 'system',

  -- Tracking
  notificare_trimisa BOOL DEFAULT FALSE,
  data_notificare TIMESTAMP
)
PARTITION BY DATE(data_creare)
CLUSTER BY (status, auto_approvable, score);

-- Index pentru căutări rapide
-- BigQuery nu are indecși tradiționali, dar clustering-ul optimizează
-- queries pe coloanele: status, auto_approvable, score

-- =================================================================
-- SEED: Configurări pentru sistemul de propuneri
-- =================================================================

-- Adăugăm configurări în TranzactiiSyncConfig
INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.TranzactiiSyncConfig`
(id, config_key, config_value, config_type, description, category, data_creare)
VALUES
  (GENERATE_UUID(), 'propuneri_auto_approve_threshold', '90', 'number',
   'Scor minim pentru auto-aprobare propuneri încasări (fără intervenție admin)', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_min_score', '60', 'number',
   'Scor minim pentru a genera o propunere de încasare', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_expirare_zile', '30', 'number',
   'După câte zile expiră o propunere neaprobată', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_notificare_enabled', 'true', 'boolean',
   'Trimite notificare admin când apar propuneri noi', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_referinta_score', '60', 'number',
   'Puncte pentru referință factură găsită în detalii', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_cui_score', '25', 'number',
   'Puncte pentru CUI match (normalizat)', 'incasari_propuneri', CURRENT_TIMESTAMP()),

  (GENERATE_UUID(), 'propuneri_suma_score', '15', 'number',
   'Puncte pentru sumă apropiată (±1%)', 'incasari_propuneri', CURRENT_TIMESTAMP());

-- =================================================================
-- NOTIFICARE: Adăugăm tip notificare pentru propuneri noi
-- =================================================================

INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.NotificariSetari_v2` (
  id,
  tip_notificare,
  nume_setare,
  descriere,
  categorie,
  activ,
  canal_email,
  canal_clopotel,
  canal_push,
  template_subiect,
  template_continut,
  template_html,
  destinatari_rol,
  exclude_creator,
  frecventa_trigger,
  data_creare
) VALUES (
  GENERATE_UUID(),
  'incasari_propuneri_noi',
  'Propuneri încasări automate',
  'Notificare când sunt identificate tranzacții bancare care pot fi asociate automat cu facturi',
  'financiar',
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  '📥 {{count}} propuneri noi de încasări automate',
  'Au fost identificate {{count}} tranzacții bancare care pot fi asociate cu facturi:\n\n✅ Auto-aprobabile (score ≥90%): {{auto_count}}\n⚠️ Necesită review: {{review_count}}\n\nAccesează panoul de administrare pentru a vedea și aproba propunerile.',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 24px;">📥 Propuneri Încasări Automate</h1>
    </div>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px; color: #333;">Au fost identificate <strong>{{count}}</strong> tranzacții bancare care pot fi asociate cu facturi:</p>
      <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;"><span style="color: #28a745;">✅</span> Auto-aprobabile (score ≥90%): <strong>{{auto_count}}</strong></p>
        <p style="margin: 5px 0;"><span style="color: #ffc107;">⚠️</span> Necesită review: <strong>{{review_count}}</strong></p>
      </div>
      <a href="{{link_detalii}}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Vezi Propunerile</a>
    </div>
  </div>',
  ['admin'],
  FALSE,
  'instant',
  CURRENT_DATE()
);

-- =================================================================
-- VIEW: Pentru raportare rapidă propuneri
-- =================================================================

CREATE OR REPLACE VIEW `hale-mode-464009-i6.PanouControlUnitar.V_IncasariPropuneriPending` AS
SELECT
  ip.*,
  fg.status as factura_status,
  tb.status as tranzactie_status,
  tb.matching_tip as tranzactie_matching_existent
FROM `hale-mode-464009-i6.PanouControlUnitar.IncasariPropuneri_v2` ip
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate_v2` fg
  ON ip.factura_id = fg.id
LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.TranzactiiBancare_v2` tb
  ON ip.tranzactie_id = tb.id
WHERE ip.status = 'pending'
  AND (fg.status IS NULL OR fg.status NOT IN ('platita', 'anulata', 'storno'))
  AND (tb.matching_tip IS NULL OR tb.matching_tip = 'none' OR tb.status != 'matched');
