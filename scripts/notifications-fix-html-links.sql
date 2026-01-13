-- CALEA: /scripts/notifications-fix-html-links.sql
-- DATA: 13.01.2026
-- DESCRIERE: Fix template HTML - adaugă buton CTA cu {{link_detalii}} în toate notificările
-- PROBLEMA: Template-urile HTML nu conțineau link-uri, doar versiunea text le avea

-- =====================================================
-- 1. UPDATE: Template proiect_atribuit
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_prenume}}</strong>,</p><p>Tocmai ai fost atribuit ca responsabil la proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) în data de {{data_atribuire}}.</p><p><strong>Termen de finalizare:</strong> {{termen_realizare}}</p>{{#if subproiecte_count}}<p>Ai fost atribuit și la <strong>{{subproiecte_count}} subproiecte</strong> din acest proiect.</p>{{/if}}<div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'proiect_atribuit';

-- =====================================================
-- 2. UPDATE: Template subproiect_atribuit
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la subproiectul <strong>{{subproiect_denumire}}</strong> din cadrul proiectului {{proiect_denumire}} ({{proiect_id}}).</p><p><strong>Deadline:</strong> {{proiect_deadline}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'subproiect_atribuit';

-- =====================================================
-- 3. UPDATE: Template sarcina_atribuita
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Tocmai ai fost atribuit la sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}}.</p><p><strong>Prioritate:</strong> {{sarcina_prioritate}}<br><strong>Deadline:</strong> {{sarcina_deadline}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Sarcină</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'sarcina_atribuita';

-- =====================================================
-- 4. UPDATE: Template comentariu_nou
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p><strong>{{comentator_name}}</strong> a adăugat un comentariu la sarcina "{{sarcina_titlu}}":</p><blockquote style="border-left: 4px solid #3B82F6; padding-left: 16px; margin: 16px 0; color: #6B7280; font-style: italic;">{{comentariu_text}}</blockquote><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Comentariul</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'comentariu_nou';

-- =====================================================
-- 5. UPDATE: Template termen_proiect_aproape
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) are termenul de finalizare în <strong>{{zile_ramase}} zile</strong> ({{proiect_deadline}}).</p><p><strong>Client:</strong> {{proiect_client}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #F59E0B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_proiect_aproape';

-- =====================================================
-- 6. UPDATE: Template termen_subproiect_aproape
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Subproiectul <strong>{{subproiect_denumire}}</strong> din proiectul {{proiect_denumire}} are termenul în <strong>{{zile_ramase}} zile</strong>.</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #F59E0B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_subproiect_aproape';

-- =====================================================
-- 7. UPDATE: Template termen_sarcina_aproape
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}} are deadline în <strong>{{zile_ramase}} zile</strong> ({{sarcina_deadline}}).</p><p><strong>Prioritate:</strong> {{sarcina_prioritate}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #F59E0B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Sarcină</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_sarcina_aproape';

-- =====================================================
-- 8. UPDATE: Template termen_proiect_depasit (dacă există)
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p style="color: #DC2626;"><strong>ATENȚIE!</strong> Proiectul <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) are termenul depășit cu <strong>{{zile_intarziere}} zile</strong>!</p><p><strong>Deadline original:</strong> {{proiect_deadline}}<br><strong>Client:</strong> {{proiect_client}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_proiect_depasit';

-- =====================================================
-- 9. UPDATE: Template termen_subproiect_depasit (dacă există)
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p style="color: #DC2626;"><strong>ATENȚIE!</strong> Subproiectul <strong>{{subproiect_denumire}}</strong> din proiectul {{proiect_denumire}} are termenul depășit cu <strong>{{zile_intarziere}} zile</strong>!</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_subproiect_depasit';

-- =====================================================
-- 10. UPDATE: Template termen_sarcina_depasita (dacă există)
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p style="color: #DC2626;"><strong>ATENȚIE!</strong> Sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}} are termenul depășit cu <strong>{{zile_intarziere}} zile</strong>!</p><p><strong>Prioritate:</strong> {{sarcina_prioritate}}</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Sarcină</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'termen_sarcina_depasita';

-- =====================================================
-- 11. UPDATE: Template factura_netrimisa_anaf
-- NOTA: Template preluat din notifications-seed-factura-netrimisa-anaf.sql (versiune profesională)
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 20px; text-align: center;"><h2 style="margin: 0; font-size: 22px;">⚠️ Factură Netrimisă ANAF</h2><p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">{{zile_de_la_emitere}} zile de la emitere</p></div><div style="padding: 24px; background: #ffffff;"><div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 20px; border-radius: 4px;"><p style="margin: 0; color: #92400E; font-size: 14px;">Această factură nu a fost înregistrată în sistemul e-Factura ANAF. Este necesară verificarea și trimiterea manuală.</p></div><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; width: 140px; border-bottom: 1px solid #E5E7EB;">Serie/Număr:</td><td style="padding: 10px 0; font-weight: 600; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{serie_numar}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Client:</td><td style="padding: 10px 0; font-weight: 600; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{client_nume}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">CUI Client:</td><td style="padding: 10px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{client_cui}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Valoare:</td><td style="padding: 10px 0; font-weight: 600; color: #059669; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{suma_totala}} RON</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Data emiterii:</td><td style="padding: 10px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{data_emitere}}</td></tr><tr><td style="padding: 10px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">Status e-Factura:</td><td style="padding: 10px 0; color: #DC2626; font-weight: 600; font-size: 14px; border-bottom: 1px solid #E5E7EB;">{{efactura_status}}</td></tr></table><div style="text-align: center; margin-top: 24px;"><a href="{{link_detalii}}" style="display: inline-block; background: #F59E0B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">🔗 Vezi Factura și Trimite ANAF</a></div></div><div style="background: #F9FAFB; padding: 16px; text-align: center; border-top: 1px solid #E5E7EB;"><p style="margin: 0; color: #6B7280; font-size: 12px;">UNITAR PROIECT | Sistem e-Factura ANAF</p></div></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'factura_netrimisa_anaf';

-- =====================================================
-- 12. UPDATE: Template sarcina_finalizata
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Sarcina <strong>"{{sarcina_titlu}}"</strong> din proiectul {{proiect_id}} a fost marcată ca finalizată.</p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'sarcina_finalizata';

-- =====================================================
-- 13. UPDATE: Template proiect_status_update
-- =====================================================
UPDATE `PanouControlUnitar.NotificariSetari_v2`
SET
  template_html = '<p>Bună <strong>{{user_name}}</strong>,</p><p>Statusul proiectului <strong>{{proiect_denumire}}</strong> ({{proiect_id}}) a fost actualizat la: <strong>{{status_nou}}</strong></p><div style="margin-top: 24px; text-align: center;"><a href="{{link_detalii}}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Vezi Detalii Proiect</a></div>',
  data_modificare = CURRENT_TIMESTAMP(),
  modificat_de = 'fix-links-13-01-2026',
  versiune = versiune + 1
WHERE tip_notificare = 'proiect_status_update';

-- =====================================================
-- VERIFICARE: Afișează toate template-urile actualizate
-- =====================================================
SELECT
  tip_notificare,
  nume_setare,
  CASE
    WHEN template_html LIKE '%{{link_detalii}}%' THEN '✅ ARE LINK'
    ELSE '❌ FĂRĂ LINK'
  END as link_status,
  LEFT(template_html, 100) as html_preview,
  modificat_de,
  versiune
FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE modificat_de = 'fix-links-13-01-2026'
ORDER BY tip_notificare;
