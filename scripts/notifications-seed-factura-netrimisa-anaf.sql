-- CALEA: /scripts/notifications-seed-factura-netrimisa-anaf.sql
-- DATA: 13.01.2026
-- DESCRIERE: Seed setare pentru notificarea 'factura_netrimisa_anaf'
-- SCOP: Notificare admini când o factură nu ajunge în e-Factura ANAF după 2 zile de la emitere

-- =====================================================
-- INSERT: Factură Netrimisă ANAF (admin only)
-- =====================================================

INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'factura_netrimisa_anaf',
  'Factură Netrimisă ANAF (>2 zile)',
  'Notificare automată când o factură emisă nu ajunge în e-Factura ANAF după 2 zile. Necesită acțiune de trimitere manuală.',
  'financiar',
  true, true, true, false,
  '⚠️ Factură {{serie_numar}} netrimisă la ANAF ({{zile_de_la_emitere}} zile)',
  'ATENȚIE - Factura nu a ajuns în e-Factura ANAF!\n\n📄 Factură: {{serie_numar}}\n👤 Client: {{client_nume}} (CUI: {{client_cui}})\n💰 Valoare: {{suma_totala}} RON\n📅 Data emiterii: {{data_emitere}}\n⏱️ Zile de la emitere: {{zile_de_la_emitere}}\n\n⚠️ Status e-Factura: {{efactura_status}}\n\nAceastă factură necesită verificare și trimitere manuală la ANAF.\n\n🔗 Vezi factura: {{link_detalii}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 20px; text-align: center;"><h2 style="margin: 0; font-size: 22px;">⚠️ Factură Netrimisă ANAF</h2><p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">{{zile_de_la_emitere}} zile de la emitere</p></div><div style="padding: 24px; background: #ffffff;"><div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 20px; border-radius: 4px;"><p style="margin: 0; color: #92400E; font-size: 14px;">Această factură nu a fost înregistrată în sistemul e-Factura ANAF. Este necesară verificarea și trimiterea manuală.</p></div><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; width: 140px; border-bottom: 1px solid #E5E7EB;">Serie/Număr:</td><td style="padding: 10px 0; font-weight: 600; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{serie_numar}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Client:</td><td style="padding: 10px 0; font-weight: 600; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{client_nume}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">CUI Client:</td><td style="padding: 10px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{client_cui}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Valoare:</td><td style="padding: 10px 0; font-weight: 600; color: #059669; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{suma_totala}} RON</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Data emiterii:</td><td style="padding: 10px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{data_emitere}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Status e-Factura:</td><td style="padding: 10px 0; color: #DC2626; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{efactura_status}}</td></tr></table><div style="text-align: center; margin-top: 24px;"><a href="{{link_detalii}}" style="display: inline-block; background: #F59E0B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">🔗 Vezi Factura și Trimite ANAF</a></div></div><div style="background: #F9FAFB; padding: 16px; text-align: center; border-top: 1px solid #E5E7EB;"><p style="margin: 0; color: #6B7280; font-size: 12px;">UNITAR PROIECT | Sistem e-Factura ANAF</p></div></div>',
  ['admin'], false, JSON '{"zile_dupa": 2}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- =====================================================
-- VERIFICARE
-- =====================================================

SELECT
  tip_notificare,
  nume_setare,
  categorie,
  activ,
  canal_email,
  canal_clopotel
FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE tip_notificare = 'factura_netrimisa_anaf';
