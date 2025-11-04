-- CALEA: /scripts/notifications-seed-settings.sql
-- DATA: 05.10.2025 (ora României) - UPDATED: Fixat 23 coloane pentru toate INSERT-urile
-- DESCRIERE: Seed setări default pentru toate tipurile de notificări

-- =====================================================
-- SEED: NOTIFICĂRI UTILIZATORI NORMALI (10 tipuri)
-- =====================================================

-- 1. Proiect Atribuit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'proiect_atribuit',
  'Atribuire Proiect Nou',
  'Notificare când utilizator este atribuit responsabil la un proiect nou',
  'proiecte',
  true, true, true, false,
  '{{user_prenume}}, ai fost atribuit la proiectul {{proiect_denumire}}',
  'Bună {{user_prenume}},\n\nTocmai ai fost atribuit ca responsabil la proiectul {{proiect_denumire}} ({{proiect_id}}) în data de {{data_atribuire}}.\n\nTermen de finalizare: {{termen_realizare}}\n\n{{#if subproiecte_count}}Ai fost atribuit și la {{subproiecte_count}} subproiecte din acest proiect.{{/if}}\n\nPoți vedea detaliile aici: {{link_detalii}}',
  '<p>Bună <strong>{{user_prenume}}</strong>,</p><p>Tocmai ai fost atribuit ca responsabil la proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) în data de {{data_atribuire}}.</p><p><strong>Termen de finalizare:</strong> {{termen_realizare}}</p>{{#if subproiecte_count}}<p>Ai fost atribuit și la <strong>{{subproiecte_count}} subproiecte</strong> din acest proiect.</p>{{/if}}',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 2. Subproiect Atribuit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'subproiect_atribuit',
  'Atribuire Subproiect Nou',
  'Notificare când utilizator este atribuit la un subproiect nou',
  'proiecte',
  true, true, true, false,
  '{{user_name}}, ai fost atribuit la subproiectul {{subproiect_denumire}}',
  'Bună {{user_name}},\n\nTocmai ai fost atribuit ca responsabil la subproiectul {{subproiect_denumire}} din cadrul proiectului {{proiect_denumire}} ({{proiect_id}}).\n\nDeadline: {{proiect_deadline}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la subproiectul <strong>{{subproiect_denumire}}</strong> din cadrul proiectului {{proiect_denumire}} ({{proiect_id}}).</p><p><strong>Deadline:</strong> {{proiect_deadline}}</p>',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 3. Sarcină Atribuită
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'sarcina_atribuita',
  'Atribuire Sarcină Nouă',
  'Notificare când utilizator este atribuit la o sarcină nouă',
  'sarcini',
  true, true, true, false,
  '{{user_name}}, ai o sarcină nouă: {{sarcina_titlu}}',
  'Bună {{user_name}},\n\nTocmai ai fost atribuit la sarcina "{{sarcina_titlu}}" din proiectul {{proiect_id}}.\n\nPrioritate: {{sarcina_prioritate}}\nDeadline: {{sarcina_deadline}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}}.</p><p><strong>Prioritate:</strong> {{sarcina_prioritate}}<br><strong>Deadline:</strong> {{sarcina_deadline}}</p>',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 4. Comentariu Nou la Sarcină
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'comentariu_nou',
  'Comentariu Nou la Sarcină',
  'Notificare când cineva adaugă comentariu la o sarcină unde ești responsabil',
  'sarcini',
  true, false, true, false,
  'Comentariu nou la sarcina: {{sarcina_titlu}}',
  'Bună {{user_name}},\n\n{{comentator_name}} a adăugat un comentariu la sarcina "{{sarcina_titlu}}":\n\n"{{comentariu_text}}"\n\nVezi detalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><strong>{{comentator_name}}</strong> a adăugat un comentariu la sarcina "{{sarcina_titlu}}":</p><blockquote>{{comentariu_text}}</blockquote>',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 5. Termen Proiect Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_proiect_aproape',
  'Termen Proiect Aproape',
  'Reminder când termenul unui proiect se apropie',
  'termene',
  true, true, true, false,
  'Reminder: Proiectul {{proiect_denumire}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nProiectul {{proiect_denumire}} ({{proiect_id}}) are termenul de finalizare în {{zile_ramase}} zile ({{proiect_deadline}}).\n\nClient: {{proiect_client}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) are termenul de finalizare în <strong>{{zile_ramase}} zile</strong> ({{proiect_deadline}}).</p><p><strong>Client:</strong> {{proiect_client}}</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": 7}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 6. Termen Subproiect Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_subproiect_aproape',
  'Termen Subproiect Aproape',
  'Reminder când termenul unui subproiect se apropie',
  'termene',
  true, true, true, false,
  'Reminder: Subproiectul {{subproiect_denumire}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nSubproiectul {{subproiect_denumire}} din proiectul {{proiect_denumire}} are termenul în {{zile_ramase}} zile.\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Subproiectul <strong>{{subproiect_denumire}}</strong> din proiectul {{proiect_denumire}} are termenul în <strong>{{zile_ramase}} zile</strong>.</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": 7}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 7. Termen Sarcină Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'termen_sarcina_aproape',
  'Termen Sarcină Aproape',
  'Reminder când termenul unei sarcini se apropie',
  'termene',
  true, true, true, false,
  'Reminder: Sarcina {{sarcina_titlu}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nSarcina "{{sarcina_titlu}}" din proiectul {{proiect_id}} are deadline în {{zile_ramase}} zile ({{sarcina_deadline}}).\n\nPrioritate: {{sarcina_prioritate}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}} are deadline în <strong>{{zile_ramase}} zile</strong> ({{sarcina_deadline}}).</p><p><strong>Prioritate:</strong> {{sarcina_prioritate}}</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": 3}', 'zilnic',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 8. Sarcină Finalizată
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'sarcina_finalizata',
  'Sarcină Finalizată',
  'Notificare când o sarcină atribuită ție a fost finalizată',
  'sarcini',
  true, false, true, false,
  'Sarcina {{sarcina_titlu}} a fost finalizată',
  'Bună {{user_name}},\n\nSarcina "{{sarcina_titlu}}" din proiectul {{proiect_id}} a fost marcată ca finalizată.\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}} a fost marcată ca finalizată.</p>',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 9. Proiect Modificat Status
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'proiect_status_update',
  'Proiect Modificat Status',
  'Notificare când statusul unui proiect se modifică',
  'proiecte',
  false, false, true, false,
  'Proiectul {{proiect_denumire}} - status actualizat',
  'Bună {{user_name}},\n\nStatusul proiectului {{proiect_denumire}} ({{proiect_id}}) a fost actualizat la: {{status_nou}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Statusul proiectului <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) a fost actualizat la: <strong>{{status_nou}}</strong></p>',
  ['admin', 'normal'], true, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 10. Raport Săptămânal Activitate
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'raport_saptamanal',
  'Raport Săptămânal Activitate',
  'Rezumat săptămânal cu toate sarcinile și proiectele active',
  'sistem',
  false, true, false, false,
  'Raportul tău săptămânal de activitate',
  'Bună {{user_name}},\n\nRezumat activitate săptămâna aceasta:\n\n- Proiecte active: {{proiecte_count}}\n- Sarcini noi: {{sarcini_noi}}\n- Sarcini finalizate: {{sarcini_finalizate}}\n- Ore înregistrate: {{ore_total}}h\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Rezumat activitate săptămâna aceasta:</p><ul><li>Proiecte active: {{proiecte_count}}</li><li>Sarcini noi: {{sarcini_noi}}</li><li>Sarcini finalizate: {{sarcini_finalizate}}</li><li>Ore înregistrate: {{ore_total}}h</li></ul>',
  ['admin', 'normal'], false, JSON '{}', 'saptamanal',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- =====================================================
-- SEED: NOTIFICĂRI ADMIN (6 tipuri)
-- =====================================================

-- 11. Factură Achitată
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'factura_achitata',
  'Factură Achitată (Incasare)',
  'Notificare când o factură a fost achitată prin matching tranzacții bancare',
  'financiar',
  true, true, true, false,
  '💰 Incasare: {{suma_tranzactie}} RON{{#if client_nume}} - {{client_nume}}{{/if}}',
  'Incasare nouă înregistrată:\n\n💰 Sumă: {{suma_tranzactie}} RON\n📅 Data: {{data_tranzactie}}\n\n{{#if has_match}}✅ MATCH AUTOMAT ({{matching_confidence}}% confidence):\n📄 Factură: {{factura_serie}}{{factura_numar}}\n👤 Client: {{client_nume}} (CUI: {{client_cui}})\n📊 Proiect: {{proiect_denumire}}\n💵 Valoare factură: {{factura_total}} RON\n{{#if diferenta_procent}}⚖️ Diferență: {{diferenta_ron}} RON ({{diferenta_procent}}%)\n{{/if}}{{else}}⚠️ FĂRĂ MATCH AUTOMAT:\n👤 Contrapartidă: {{nume_contrapartida}}{{#if cui_contrapartida}} (CUI: {{cui_contrapartida}}){{/if}}\n💬 Detalii transfer: {{detalii_tranzactie}}\n🔍 Necesită verificare manuală\n{{/if}}\n\nDetalii complete: {{link_detalii}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 20px; text-align: center;"><h2 style="margin: 0; font-size: 24px;">💰 Incasare Înregistrată</h2></div><div style="padding: 24px; background: #ffffff;"><div style="background: #F0FDF4; border-left: 4px solid #10B981; padding: 16px; margin-bottom: 20px; border-radius: 4px;"><p style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold; color: #065F46;">{{suma_tranzactie}} RON</p><p style="margin: 0; color: #047857; font-size: 14px;">Data: {{data_tranzactie}}</p></div>{{#if has_match}}<div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 16px; border-radius: 6px; margin-bottom: 16px;"><h3 style="margin: 0 0 12px 0; color: #1E40AF; font-size: 16px;">✅ Match Automat ({{matching_confidence}}% confidence)</h3><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Factură:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; font-size: 14px;">{{factura_serie}}{{factura_numar}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Client:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; font-size: 14px;">{{client_nume}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px;">CUI Client:</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">{{client_cui}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Proiect:</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">{{proiect_denumire}}</td></tr><tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Valoare factură:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; font-size: 14px;">{{factura_total}} RON</td></tr>{{#if diferenta_procent}}<tr><td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Diferență:</td><td style="padding: 8px 0; color: #B45309; font-size: 14px;">{{diferenta_ron}} RON ({{diferenta_procent}}%)</td></tr>{{/if}}</table></div>{{else}}<div style="background: #FEF3C7; border: 1px solid #FCD34D; padding: 16px; border-radius: 6px; margin-bottom: 16px;"><h3 style="margin: 0 0 12px 0; color: #92400E; font-size: 16px;">⚠️ Fără Match Automat</h3><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #78350F; font-size: 14px; width: 120px;">Contrapartidă:</td><td style="padding: 8px 0; font-weight: 600; color: #92400E; font-size: 14px;">{{nume_contrapartida}}</td></tr>{{#if cui_contrapartida}}<tr><td style="padding: 8px 0; color: #78350F; font-size: 14px;">CUI:</td><td style="padding: 8px 0; color: #92400E; font-size: 14px;">{{cui_contrapartida}}</td></tr>{{/if}}<tr><td style="padding: 8px 0; color: #78350F; font-size: 14px; vertical-align: top;">Detalii transfer:</td><td style="padding: 8px 0; color: #92400E; font-size: 14px;">{{detalii_tranzactie}}</td></tr></table><p style="margin: 12px 0 0 0; color: #92400E; font-size: 13px; font-style: italic;">🔍 Această tranzacție necesită verificare și matching manual.</p></div>{{/if}}<div style="text-align: center; margin-top: 24px;"><a href="{{link_detalii}}" style="display: inline-block; background: #10B981; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Vezi Detalii Complete</a></div></div><div style="background: #F9FAFB; padding: 16px; text-align: center; border-top: 1px solid #E5E7EB;"><p style="margin: 0; color: #6B7280; font-size: 12px;">UNITAR PROIECT | Dashboard Tranzacții</p></div></div>',
  ['admin'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 12. Contract Nou Generat
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'contract_nou',
  'Contract Nou Generat',
  'Notificare când un contract nou a fost generat',
  'financiar',
  true, true, true, false,
  'Contract nou generat: {{numar_contract}}',
  'Contract nou generat:\n\nNumăr: {{numar_contract}}\nClient: {{client_nume}}\nValoare: {{valoare_contract}} RON\nData creare: {{data_creare}}\n\nDetalii: {{link_detalii}}',
  '<p>Contract nou generat:</p><p><strong>Număr:</strong> {{numar_contract}}<br><strong>Client:</strong> {{client_nume}}<br><strong>Valoare:</strong> {{valoare_contract}} RON<br><strong>Data creare:</strong> {{data_creare}}</p>',
  ['admin'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 13. Proces Verbal Generat
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'proces_verbal_generat',
  'Proces Verbal Generat',
  'Notificare când un proces verbal nou a fost generat',
  'documente',
  true, true, true, false,
  'Proces Verbal {{numar_pv}} generat pentru proiectul {{proiect_denumire}}',
  'Proces verbal nou generat:\n\nNumăr: {{numar_pv}}\nProiect: {{proiect_denumire}}\nClient: {{client_nume}}\nData: {{data_generare}}\n\nDetalii: {{link_detalii}}',
  '<p>Proces verbal nou generat:</p><p><strong>Număr:</strong> {{numar_pv}}<br><strong>Proiect:</strong> {{proiect_denumire}}<br><strong>Client:</strong> {{client_nume}}<br><strong>Data:</strong> {{data_generare}}</p>',
  ['admin'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 14. ANAF Eroare Critică
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'anaf_eroare_critica',
  'ANAF Eroare Critică',
  'Notificare imediată când apar erori critice ANAF',
  'sistem',
  true, true, true, false,
  '⚠️ ANAF EROARE: {{eroare_tip}}',
  'ATENȚIE - Eroare ANAF critică:\n\nTip eroare: {{eroare_tip}}\nOperațiune: {{operatiune}}\nTimestamp: {{timestamp}}\nDetalii: {{eroare_detalii}}\n\nNecesită intervenție imediată!\n\nLog: {{link_log}}',
  '<p><strong style="color:red;">⚠️ ATENȚIE - Eroare ANAF critică:</strong></p><p><strong>Tip eroare:</strong> {{eroare_tip}}<br><strong>Operațiune:</strong> {{operatiune}}<br><strong>Timestamp:</strong> {{timestamp}}<br><strong>Detalii:</strong> {{eroare_detalii}}</p><p><strong>Necesită intervenție imediată!</strong></p>',
  ['admin'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 15. ANAF Avertizare
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'anaf_warning',
  'ANAF Avertizare',
  'Notificare pentru avertismente ANAF (non-critice)',
  'sistem',
  true, false, true, false,
  'ANAF Avertizare: {{warning_tip}}',
  'ANAF Avertizare:\n\nTip: {{warning_tip}}\nOperațiune: {{operatiune}}\nDetalii: {{warning_detalii}}\n\nLog: {{link_log}}',
  '<p><strong style="color:orange;">⚠️ ANAF Avertizare:</strong></p><p><strong>Tip:</strong> {{warning_tip}}<br><strong>Operațiune:</strong> {{operatiune}}<br><strong>Detalii:</strong> {{warning_detalii}}</p>',
  ['admin'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 16. Raport Lunar Financiar
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'raport_lunar_financiar',
  'Raport Lunar Financiar',
  'Rezumat financiar lunar pentru admin',
  'financiar',
  false, true, false, false,
  'Raport financiar pentru luna {{luna_nume}} {{an}}',
  'Raport financiar luna {{luna_nume}} {{an}}:\n\n- Facturi emise: {{facturi_count}} ({{facturi_suma}} RON)\n- Facturi achitate: {{facturi_achitate_count}} ({{facturi_achitate_suma}} RON)\n- Contracte noi: {{contracte_count}}\n- Încasări totale: {{incasari_total}} RON\n\nDetalii: {{link_detalii}}',
  '<p>Raport financiar luna {{luna_nume}} {{an}}:</p><ul><li>Facturi emise: {{facturi_count}} ({{facturi_suma}} RON)</li><li>Facturi achitate: {{facturi_achitate_count}} ({{facturi_achitate_suma}} RON)</li><li>Contracte noi: {{contracte_count}}</li><li>Încasări totale: {{incasari_total}} RON</li></ul>',
  ['admin'], false, JSON '{}', 'saptamanal',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- =====================================================
-- SEED: NOTIFICĂRI CLIENȚI (2 tipuri - INACTIVE pentru viitor)
-- =====================================================

-- 17. Client Factură Nouă (pentru viitor)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'client_factura_noua',
  'Client - Factură Nouă',
  'Notificare către client când o factură nouă este emisă',
  'financiar',
  false, true, false, false,
  'Factură nouă {{numar_factura}} de la UNITAR PROIECT',
  'Bună ziua,\n\nAți primit o factură nouă de la UNITAR PROIECT:\n\nNumăr factură: {{numar_factura}}\nSumă: {{suma_factura}} RON\nScadență: {{data_scadenta}}\n\nPuteți descărca factura aici: {{link_download}}',
  '<p>Bună ziua,</p><p>Ați primit o factură nouă de la UNITAR PROIECT:</p><p><strong>Număr factură:</strong> {{numar_factura}}<br><strong>Sumă:</strong> {{suma_factura}} RON<br><strong>Scadență:</strong> {{data_scadenta}}</p><p><a href="{{link_download}}">Descarcă factura</a></p>',
  ['client'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- 18. Client Proces Verbal (pentru viitor)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json, frecventa_trigger,
  email_cc, email_bcc, email_reply_to,
  data_creare, data_modificare, modificat_de, versiune
) VALUES (
  GENERATE_UUID(),
  'client_proces_verbal',
  'Client - Proces Verbal',
  'Notificare către client când un PV este generat',
  'documente',
  false, true, false, false,
  'Proces Verbal {{numar_pv}} pentru proiectul {{proiect_denumire}}',
  'Bună ziua,\n\nA fost generat un proces verbal pentru proiectul {{proiect_denumire}}:\n\nNumăr PV: {{numar_pv}}\nData: {{data_generare}}\n\nVeți primi documentul fizic în curând.\n\nDetalii: {{link_detalii}}',
  '<p>Bună ziua,</p><p>A fost generat un proces verbal pentru proiectul <strong>{{proiect_denumire}}</strong>:</p><p><strong>Număr PV:</strong> {{numar_pv}}<br><strong>Data:</strong> {{data_generare}}</p><p>Veți primi documentul fizic în curând.</p>',
  ['client'], false, JSON '{}', 'instant',
  NULL, NULL, NULL,
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 'system', 1
);

-- =====================================================
-- FINALIZARE SEED
-- =====================================================

-- Verificare: selectează toate setările create
SELECT
  tip_notificare,
  nume_setare,
  categorie,
  activ,
  canal_email,
  canal_clopotel,
  STRING_AGG(CAST(rol AS STRING), ', ') as roluri
FROM `PanouControlUnitar.NotificariSetari_v2`,
UNNEST(destinatari_rol) as rol
GROUP BY tip_notificare, nume_setare, categorie, activ, canal_email, canal_clopotel
ORDER BY categorie, tip_notificare;
