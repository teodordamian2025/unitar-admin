-- CALEA: /scripts/notifications-seed-settings.sql
-- DATA: 05.10.2025 (ora României)
-- DESCRIERE: Seed setări default pentru toate tipurile de notificări

-- =====================================================
-- SEED: NOTIFICĂRI UTILIZATORI NORMALI
-- =====================================================

-- 1. Proiect Atribuit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id, tip_notificare, nume_setare, descriere, categorie,
  activ, canal_email, canal_clopotel, canal_push,
  template_subiect, template_continut, template_html,
  destinatari_rol, exclude_creator, conditii_json,
  data_creare, data_modificare, versiune
) VALUES (
  GENERATE_UUID(),
  'proiect_atribuit',
  'Atribuire Proiect Nou',
  'Notificare când utilizator este atribuit responsabil la un proiect nou',
  'proiecte',
  true, true, true, false,
  '{{user_name}}, ai fost atribuit la proiectul {{proiect_denumire}}',
  'Bună {{user_name}},\n\nTocmai ai fost atribuit ca responsabil la proiectul {{proiect_denumire}} ({{proiect_id}}) în data de {{data_atribuire}}.\n\nTermenul de finalizare: {{termen_realizare}}\n\n{{#if subproiecte_count}}Ai fost atribuit și la {{subproiecte_count}} subproiecte din acest proiect.{{/if}}\n\nPoți vedea detaliile aici: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit ca responsabil la proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) în data de {{data_atribuire}}.</p><p><strong>Termen de finalizare:</strong> {{termen_realizare}}</p>{{#if subproiecte_count}}<p>Ai fost atribuit și la <strong>{{subproiecte_count}} subproiecte</strong> din acest proiect.</p>{{/if}}',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 2. Subproiect Atribuit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'subproiect_atribuit',
  'Atribuire Subproiect Nou',
  'Notificare când utilizator este atribuit la un subproiect nou',
  'proiecte',
  true, true, true, false,
  '{{user_name}}, ai fost atribuit la subproiectul {{subproiect_denumire}}',
  'Bună {{user_name}},\n\nTocmai ai fost atribuit ca responsabil la subproiectul {{subproiect_denumire}} din cadrul proiectului {{proiect_denumire}} ({{proiect_id}}).\n\nTermen de finalizare: {{termen_realizare}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la subproiectul <strong>{{subproiect_denumire}}</strong> din cadrul proiectului {{proiect_denumire}} ({{proiect_id}}).</p><p><strong>Termen:</strong> {{termen_realizare}}</p>',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 3. Sarcină Atribuită
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'sarcina_atribuita',
  'Atribuire Sarcină Nouă',
  'Notificare când utilizator este atribuit la o sarcină nouă',
  'sarcini',
  true, true, true, false,
  '{{user_name}}, ai o sarcină nouă: {{sarcina_titlu}}',
  'Bună {{user_name}},\n\nTocmai ai fost atribuit la sarcina "{{sarcina_titlu}}" de la subproiectul {{subproiect_denumire}} (proiect {{proiect_id}}).\n\nTermen: {{termen_realizare}}\nOre estimate: {{ore_estimate}}h\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la sarcina <strong>"{{sarcina_titlu}}"</strong> de la subproiectul {{subproiect_denumire}} (proiect {{proiect_id}}).</p><p><strong>Termen:</strong> {{termen_realizare}}<br><strong>Ore estimate:</strong> {{ore_estimate}}h</p>',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 4. Comentariu Nou la Sarcină
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'comentariu_nou',
  'Comentariu Nou la Sarcină',
  'Notificare când cineva adaugă comentariu la o sarcină unde ești responsabil',
  'sarcini',
  true, false, true, false,
  'Comentariu nou la sarcina: {{sarcina_titlu}}',
  'Bună {{user_name}},\n\n{{comentator_name}} a adăugat un comentariu la sarcina "{{sarcina_titlu}}":\n\n"{{comentariu_text}}"\n\nVezi detalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><strong>{{comentator_name}}</strong> a adăugat un comentariu la sarcina "{{sarcina_titlu}}":</p><blockquote>{{comentariu_text}}</blockquote>',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 5. Termen Proiect Aproape (3/7/14 zile)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'termen_proiect_aproape',
  'Termen Proiect Aproape',
  'Reminder când termenul unui proiect se apropie',
  'proiecte',
  true, true, true, false,
  'Reminder: Proiectul {{proiect_denumire}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nProiectul {{proiect_denumire}} ({{proiect_id}}) are termenul de finalizare în {{zile_ramase}} zile ({{termen_realizare}}).\n\nStatus actual: {{status_proiect}}\nProgres: {{progres_procent}}%\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) are termenul de finalizare în <strong>{{zile_ramase}} zile</strong> ({{termen_realizare}}).</p><p><strong>Status:</strong> {{status_proiect}}<br><strong>Progres:</strong> {{progres_procent}}%</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": [3, 7, 14]}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 6. Termen Subproiect Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'termen_subproiect_aproape',
  'Termen Subproiect Aproape',
  'Reminder când termenul unui subproiect se apropie',
  'proiecte',
  true, true, true, false,
  'Reminder: Subproiectul {{subproiect_denumire}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nSubproiectul {{subproiect_denumire}} din proiectul {{proiect_denumire}} are termenul în {{zile_ramase}} zile.\n\nProgres: {{progres_procent}}%\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Subproiectul <strong>{{subproiect_denumire}}</strong> din proiectul {{proiect_denumire}} are termenul în <strong>{{zile_ramase}} zile</strong>.</p><p><strong>Progres:</strong> {{progres_procent}}%</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": [3, 7, 14]}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 7. Termen Sarcină Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'termen_sarcina_aproape',
  'Termen Sarcină Aproape',
  'Reminder când termenul unei sarcini se apropie',
  'sarcini',
  true, true, true, false,
  'Reminder: Sarcina {{sarcina_titlu}} expiră în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nSarcina "{{sarcina_titlu}}" are termenul în {{zile_ramase}} zile.\n\nOre lucrate: {{ore_lucrate}}h / {{ore_estimate}}h\nStatus: {{status_sarcina}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> are termenul în <strong>{{zile_ramase}} zile</strong>.</p><p><strong>Ore lucrate:</strong> {{ore_lucrate}}h / {{ore_estimate}}h<br><strong>Status:</strong> {{status_sarcina}}</p>',
  ['admin', 'normal'], true, JSON '{"zile_inainte": [1, 3, 7]}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 8. Termen Proiect Depășit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'termen_proiect_depasit',
  'Termen Proiect Depășit',
  'Alertă când termenul unui proiect a fost depășit',
  'proiecte',
  true, true, true, false,
  'ALERT: Proiectul {{proiect_denumire}} a depășit termenul!',
  'Bună {{user_name}},\n\nProiectul {{proiect_denumire}} ({{proiect_id}}) a depășit termenul de finalizare ({{termen_realizare}}).\n\nZile întârziere: {{zile_intarziere}}\nStatus: {{status_proiect}}\n\nACȚIUNE NECESARĂ: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><span style="color:red;">⚠️ ALERTĂ:</span> Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) a depășit termenul de finalizare ({{termen_realizare}}).</p><p><strong>Zile întârziere:</strong> {{zile_intarziere}}<br><strong>Status:</strong> {{status_proiect}}</p>',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 9. Termen Sarcină Depășit
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'termen_sarcina_depasita',
  'Termen Sarcină Depășit',
  'Alertă când termenul unei sarcini a fost depășit',
  'sarcini',
  true, true, true, false,
  'ALERT: Sarcina {{sarcina_titlu}} a depășit termenul!',
  'Bună {{user_name}},\n\nSarcina "{{sarcina_titlu}}" a depășit termenul ({{termen_realizare}}).\n\nZile întârziere: {{zile_intarziere}}\nStatus: {{status_sarcina}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><span style="color:red;">⚠️ ALERTĂ:</span> Sarcina <strong>"{{sarcina_titlu}}"</strong> a depășit termenul ({{termen_realizare}}).</p><p><strong>Zile întârziere:</strong> {{zile_intarziere}}</p>',
  ['admin', 'normal'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 10. Ore Estimate Depășire
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'ore_estimate_depasire',
  'Ore Estimate Depășite',
  'Alertă când orele lucrate la o sarcină depășesc estimarea',
  'sarcini',
  true, false, true, false,
  'Sarcina {{sarcina_titlu}} a depășit orele estimate',
  'Bună {{user_name}},\n\nSarcina "{{sarcina_titlu}}" a depășit orele estimate.\n\nOre lucrate: {{ore_lucrate}}h\nOre estimate: {{ore_estimate}}h\nDepășire: {{ore_depasire}}h ({{procent_depasire}}%)\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> a depășit orele estimate.</p><p><strong>Ore lucrate:</strong> {{ore_lucrate}}h<br><strong>Ore estimate:</strong> {{ore_estimate}}h<br><strong>Depășire:</strong> {{ore_depasire}}h ({{procent_depasire}}%)</p>',
  ['admin', 'normal'], true, JSON '{"prag_procent": 100}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- =====================================================
-- SEED: NOTIFICĂRI ADMINI (extra)
-- =====================================================

-- 11. Factură Scadență Aproape
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'factura_scadenta_aproape',
  'Factură Scadență Aproape',
  'Reminder pentru facturi cu scadența aproape',
  'facturi',
  true, false, true, false,
  'Factură {{numar_factura}} - scadență în {{zile_ramase}} zile',
  'Bună {{user_name}},\n\nFactura {{serie_factura}}-{{numar_factura}} pentru clientul {{client_denumire}} are scadența în {{zile_ramase}} zile ({{data_scadenta}}).\n\nSumă: {{suma_totala}} {{moneda}}\nStatus: {{status_plata}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Factura <strong>{{serie_factura}}-{{numar_factura}}</strong> pentru clientul {{client_denumire}} are scadența în <strong>{{zile_ramase}} zile</strong> ({{data_scadenta}}).</p><p><strong>Sumă:</strong> {{suma_totala}} {{moneda}}<br><strong>Status:</strong> {{status_plata}}</p>',
  ['admin'], true, JSON '{"zile_inainte": [3, 7, 14]}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 12. Factură Scadență Depășită
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'factura_scadenta_depasita',
  'Factură Scadență Depășită',
  'Alertă pentru facturi cu scadența depășită',
  'facturi',
  true, true, true, false,
  'ALERT: Factura {{numar_factura}} a depășit scadența!',
  'Bună {{user_name}},\n\nFactura {{serie_factura}}-{{numar_factura}} pentru {{client_denumire}} a depășit scadența cu {{zile_intarziere}} zile.\n\nData scadență: {{data_scadenta}}\nSumă: {{suma_totala}} {{moneda}}\n\nACȚIUNE NECESARĂ: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><span style="color:red;">⚠️ ALERTĂ:</span> Factura <strong>{{serie_factura}}-{{numar_factura}}</strong> pentru {{client_denumire}} a depășit scadența cu <strong>{{zile_intarziere}} zile</strong>.</p><p><strong>Sumă:</strong> {{suma_totala}} {{moneda}}</p>',
  ['admin'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 13. Proiect Fără Contract (utilizator normal)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'proiect_fara_contract',
  'Proiect Fără Contract',
  'Alertă pentru proiecte create de utilizatori normali fără contract generat',
  'contracte',
  true, false, true, false,
  'Proiectul {{proiect_id}} necesită contract',
  'Bună {{user_name}},\n\nProiectul {{proiect_denumire}} ({{proiect_id}}) creat de {{creator_name}} nu are contract generat.\n\nClient: {{client_denumire}}\nData creare: {{data_creare}}\n\nACȚIUNE: Generează contract - {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) creat de {{creator_name}} nu are contract generat.</p><p><strong>Client:</strong> {{client_denumire}}<br><strong>Data creare:</strong> {{data_creare}}</p>',
  ['admin'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 14. PV Generat Fără Factură
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'pv_generat_fara_factura',
  'PV Generat Fără Factură',
  'Alertă pentru procese verbale generate fără factură emisă',
  'facturi',
  true, false, true, false,
  'PV pentru {{proiect_id}} necesită facturare',
  'Bună {{user_name}},\n\nA fost generat proces verbal pentru proiectul {{proiect_denumire}} ({{proiect_id}}) dar nu există factură emisă.\n\nPV generat de: {{creator_name}}\nData PV: {{data_pv}}\n\nACȚIUNE: Generează factură - {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>A fost generat proces verbal pentru proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) dar nu există factură emisă.</p><p><strong>PV generat de:</strong> {{creator_name}}<br><strong>Data PV:</strong> {{data_pv}}</p>',
  ['admin'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 15. Factură Achitată (match tranzacție)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'factura_achitata',
  'Factură Achitată',
  'Notificare când o factură este marcată ca achitată prin match cu tranzacție',
  'facturi',
  true, false, true, false,
  'Factură {{numar_factura}} achitată - {{suma_achitata}} {{moneda}}',
  'Bună {{user_name}},\n\nFactura {{serie_factura}}-{{numar_factura}} pentru {{client_denumire}} a fost achitată.\n\nProiect: {{proiect_id}}\nSumă achitată: {{suma_achitata}} {{moneda}}\nProcent factură: {{procent_achitat}}%\nData plată: {{data_plata}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p>Factura <strong>{{serie_factura}}-{{numar_factura}}</strong> pentru {{client_denumire}} a fost achitată.</p><p><strong>Proiect:</strong> {{proiect_id}}<br><strong>Sumă achitată:</strong> {{suma_achitata}} {{moneda}}<br><strong>Procent factură:</strong> {{procent_achitat}}%<br><strong>Data plată:</strong> {{data_plata}}</p>',
  ['admin'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 16. Eroare ANAF (deja existent - păstrăm pentru completitudine)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'anaf_eroare',
  'Eroare ANAF',
  'Notificare pentru erori la integrarea ANAF',
  'sistem',
  true, true, true, false,
  'Eroare ANAF: {{tip_eroare}}',
  'Bună {{user_name}},\n\nA apărut o eroare la integrarea ANAF.\n\nTip eroare: {{tip_eroare}}\nMesaj: {{mesaj_eroare}}\nData: {{data_eroare}}\n\nDetalii: {{link_detalii}}',
  '<p>Bună <strong>{{user_name}}</strong>,</p><p><span style="color:red;">⚠️ Eroare ANAF</span></p><p><strong>Tip:</strong> {{tip_eroare}}<br><strong>Mesaj:</strong> {{mesaj_eroare}}<br><strong>Data:</strong> {{data_eroare}}</p>',
  ['admin'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- =====================================================
-- SEED: NOTIFICĂRI CLIENȚI (viitor - inactive deocamdată)
-- =====================================================

-- 17. Contract Nou Client (inactive)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'contract_nou_client',
  'Contract Nou Client',
  'Notificare către client la generarea contractului',
  'contracte',
  false, true, false, false, -- inactive deocamdată
  'Contract nou: {{numar_contract}}',
  'Bună {{client_name}},\n\nA fost generat contractul {{numar_contract}} pentru proiectul {{proiect_denumire}}.\n\nValoare contract: {{valoare_contract}} {{moneda}}\nDurata: {{durata_contract}}\n\nDocumentul se găsește atașat.\n\nCu stimă,\nUNITAR PROIECT',
  '<p>Bună <strong>{{client_name}}</strong>,</p><p>A fost generat contractul <strong>{{numar_contract}}</strong> pentru proiectul {{proiect_denumire}}.</p><p><strong>Valoare contract:</strong> {{valoare_contract}} {{moneda}}<br><strong>Durată:</strong> {{durata_contract}}</p>',
  ['client'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- 18. Factură Nouă Client (inactive)
INSERT INTO `PanouControlUnitar.NotificariSetari_v2` VALUES (
  GENERATE_UUID(), 'factura_noua_client',
  'Factură Nouă Client',
  'Notificare către client la emiterea facturii',
  'facturi',
  false, true, false, false,
  'Factură nouă: {{serie_factura}}-{{numar_factura}}',
  'Bună {{client_name}},\n\nA fost emisă factura {{serie_factura}}-{{numar_factura}}.\n\nSumă totală: {{suma_totala}} {{moneda}}\nScadență: {{data_scadenta}}\n\nFactura se găsește atașată.\n\nCu stimă,\nUNITAR PROIECT',
  '<p>Bună <strong>{{client_name}}</strong>,</p><p>A fost emisă factura <strong>{{serie_factura}}-{{numar_factura}}</strong>.</p><p><strong>Sumă totală:</strong> {{suma_totala}} {{moneda}}<br><strong>Scadență:</strong> {{data_scadenta}}</p>',
  ['client'], true, JSON '{}',
  CURRENT_DATE(), CURRENT_TIMESTAMP(), 1
);

-- =====================================================
-- VERIFICARE SEED SUCCESS
-- =====================================================

-- Query pentru verificare:
-- SELECT tip_notificare, nume_setare, activ, canal_email, canal_clopotel
-- FROM `PanouControlUnitar.NotificariSetari_v2`
-- ORDER BY categorie, tip_notificare;

-- TOTAL SETĂRI SEED: 18 (10 utilizatori normali + 6 admini + 2 clienți inactive)
