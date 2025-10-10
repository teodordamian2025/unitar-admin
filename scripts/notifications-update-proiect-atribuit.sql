-- CALEA: /scripts/notifications-update-proiect-atribuit.sql
-- DATA: 10.10.2025
-- DESCRIERE: Update template notificare proiect_atribuit (fix user_name -> user_prenume + Neespecificat -> Nespecificat)

-- =====================================================
-- UPDATE: Template proiect_atribuit
-- =====================================================

UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  -- Subiect: user_name -> user_prenume
  template_subiect = '{{user_prenume}}, ai fost atribuit la proiectul {{proiect_denumire}}',

  -- Conținut text: user_name -> user_prenume
  template_continut = 'Bună {{user_prenume}},\n\nTocmai ai fost atribuit ca responsabil la proiectul {{proiect_denumire}} ({{proiect_id}}) în data de {{data_atribuire}}.\n\nTermen de finalizare: {{termen_realizare}}\n\n{{#if subproiecte_count}}Ai fost atribuit și la {{subproiecte_count}} subproiecte din acest proiect.{{/if}}\n\nPoți vedea detaliile aici: {{link_detalii}}',

  -- HTML: user_name -> user_prenume
  template_html = '<p>Bună <strong>{{user_prenume}}</strong>,</p><p>Tocmai ai fost atribuit ca responsabil la proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) în data de {{data_atribuire}}.</p><p><strong>Termen de finalizare:</strong> {{termen_realizare}}</p>{{#if subproiecte_count}}<p>Ai fost atribuit și la <strong>{{subproiecte_count}} subproiecte</strong> din acest proiect.</p>{{/if}}',

  -- Update metadata
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-10-10-2025',
  versiune = versiune + 1

WHERE tip_notificare = 'proiect_atribuit';

-- Verificare după update
SELECT
  tip_notificare,
  nume_setare,
  template_subiect,
  LEFT(template_continut, 100) as continut_preview,
  data_modificare,
  modificat_de,
  versiune
FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE tip_notificare = 'proiect_atribuit';
