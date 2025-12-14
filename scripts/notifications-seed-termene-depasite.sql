-- CALEA: /scripts/notifications-seed-termene-depasite.sql
-- DATA: 14.12.2025 (ora României)
-- DESCRIERE: Seed setări pentru notificări termene DEPĂȘITE (lipsesc din seed-ul inițial)

-- =====================================================
-- NOTIFICĂRI TERMENE DEPĂȘITE (3 tipuri noi)
-- =====================================================

-- 1. Termen Proiect DEPĂȘIT
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_proiect_depasit',
  'Termen Proiect Depășit',
  'Alertă când termenul unui proiect a fost depășit și nu este finalizat',
  'termene',
  true, true, true, false,
  '⚠️ URGENT: Proiectul {{proiect_denumire}} are termenul depășit cu {{zile_intarziere}} zile',
  'ATENȚIE {{user_name}},\n\nProiectul {{proiect_denumire}} ({{proiect_id}}) are termenul de finalizare DEPĂȘIT cu {{zile_intarziere}} zile.\n\nTermen inițial: {{proiect_deadline}}\nClient: {{proiect_client}}\n\nTe rugăm să actualizezi statusul proiectului sau să ceri o prelungire a termenului.\n\nDetalii: {{link_detalii}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;"><h2 style="margin: 0;">⚠️ TERMEN DEPĂȘIT</h2></div><div style="padding: 24px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 0 0 8px 8px;"><p>Bună <strong>{{user_name}}</strong>,</p><p>Proiectul <strong>{{proiect_denumire}}</strong> are termenul de finalizare <strong style="color: #DC2626;">DEPĂȘIT cu {{zile_intarziere}} zile</strong>.</p><table style="width: 100%; margin: 16px 0;"><tr><td style="padding: 8px 0; color: #6B7280;">Termen inițial:</td><td style="font-weight: 600;">{{proiect_deadline}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280;">Client:</td><td style="font-weight: 600;">{{proiect_client}}</td></tr></table><p style="color: #B91C1C; font-weight: 600;">Te rugăm să actualizezi statusul proiectului sau să ceri o prelungire!</p><div style="text-align: center; margin-top: 20px;"><a href="{{link_detalii}}" style="display: inline-block; background: #DC2626; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Vezi Proiect</a></div></div></div>',
  ['admin', 'normal'], false, JSON '{"notificare_zilnica": true}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 2. Termen Sarcină DEPĂȘITĂ
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_sarcina_depasita',
  'Termen Sarcină Depășit',
  'Alertă când termenul unei sarcini a fost depășit și nu este finalizată',
  'termene',
  true, true, true, false,
  '⚠️ URGENT: Sarcina "{{sarcina_titlu}}" are termenul depășit cu {{zile_intarziere}} zile',
  'ATENȚIE {{user_name}},\n\nSarcina "{{sarcina_titlu}}" din proiectul {{proiect_id}} are termenul DEPĂȘIT cu {{zile_intarziere}} zile.\n\nTermen inițial: {{sarcina_deadline}}\nPrioritate: {{sarcina_prioritate}}\n\nTe rugăm să finalizezi sarcina sau să ceri o prelungire.\n\nDetalii: {{link_detalii}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;"><h2 style="margin: 0;">⚠️ SARCINĂ DEPĂȘITĂ</h2></div><div style="padding: 24px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 0 0 8px 8px;"><p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> are termenul <strong style="color: #D97706;">DEPĂȘIT cu {{zile_intarziere}} zile</strong>.</p><table style="width: 100%; margin: 16px 0;"><tr><td style="padding: 8px 0; color: #6B7280;">Termen inițial:</td><td style="font-weight: 600;">{{sarcina_deadline}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280;">Prioritate:</td><td style="font-weight: 600;">{{sarcina_prioritate}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280;">Proiect:</td><td style="font-weight: 600;">{{proiect_id}}</td></tr></table><p style="color: #B45309; font-weight: 600;">Te rugăm să finalizezi sarcina sau să ceri o prelungire!</p><div style="text-align: center; margin-top: 20px;"><a href="{{link_detalii}}" style="display: inline-block; background: #D97706; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Vezi Sarcina</a></div></div></div>',
  ['admin', 'normal'], false, JSON '{"notificare_zilnica": true}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 3. Termen Subproiect DEPĂȘIT
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_subproiect_depasit',
  'Termen Subproiect Depășit',
  'Alertă când termenul unui subproiect a fost depășit și nu este finalizat',
  'termene',
  true, true, true, false,
  '⚠️ URGENT: Subproiectul {{subproiect_denumire}} are termenul depășit cu {{zile_intarziere}} zile',
  'ATENȚIE {{user_name}},\n\nSubproiectul {{subproiect_denumire}} din cadrul proiectului {{proiect_denumire}} are termenul DEPĂȘIT cu {{zile_intarziere}} zile.\n\nTermen inițial: {{proiect_deadline}}\n\nTe rugăm să actualizezi statusul sau să ceri o prelungire.\n\nDetalii: {{link_detalii}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;"><h2 style="margin: 0;">⚠️ SUBPROIECT DEPĂȘIT</h2></div><div style="padding: 24px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 0 0 8px 8px;"><p>Bună <strong>{{user_name}}</strong>,</p><p>Subproiectul <strong>{{subproiect_denumire}}</strong> din cadrul proiectului <strong>{{proiect_denumire}}</strong> are termenul <strong style="color: #DC2626;">DEPĂȘIT cu {{zile_intarziere}} zile</strong>.</p><table style="width: 100%; margin: 16px 0;"><tr><td style="padding: 8px 0; color: #6B7280;">Termen inițial:</td><td style="font-weight: 600;">{{proiect_deadline}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280;">Proiect părinte:</td><td style="font-weight: 600;">{{proiect_denumire}}</td></tr></table><p style="color: #B91C1C; font-weight: 600;">Te rugăm să actualizezi statusul sau să ceri o prelungire!</p><div style="text-align: center; margin-top: 20px;"><a href="{{link_detalii}}" style="display: inline-block; background: #DC2626; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Vezi Subproiect</a></div></div></div>',
  ['admin', 'normal'], false, JSON '{"notificare_zilnica": true}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- =====================================================
-- VERIFICARE: Lista setări termene complete
-- =====================================================

SELECT
  tip_notificare,
  nume_setare,
  categorie,
  activ,
  canal_email,
  canal_clopotel
FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE categorie = 'termene'
ORDER BY tip_notificare;
