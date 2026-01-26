-- ==================================================================
-- Script: Adăugare tip notificare pentru facturi iapp.ro eșuate
-- Data: 2026-01-26
-- ==================================================================

INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.NotificariSetari_v2`
(id, tip_notificare, nume_setare, descriere, categorie, activ,
 canal_email, canal_clopotel, canal_push,
 template_subiect, template_continut, template_html,
 destinatari_rol, exclude_creator, frecventa_trigger,
 data_creare, data_modificare)
VALUES (
  GENERATE_UUID(),
  'factura_iapp_esuat',
  'Factură iapp.ro - Trimitere eșuată definitiv',
  'Notificare trimisă adminilor când o factură nu poate fi trimisă la iapp.ro după 3 încercări',
  'financiar',
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  'Factură {{numar_factura}} - Trimitere iapp.ro EȘUATĂ',
  'Factura {{numar_factura}} pentru clientul {{client_nume}} ({{client_cui}}) nu a putut fi trimisă la iapp.ro după {{retry_count}} încercări. Ultima eroare: {{ultima_eroare}}. Vă rugăm verificați și retrimiți manual din aplicație.',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: #e74c3c; color: white; padding: 15px; border-radius: 8px 8px 0 0;"><h2 style="margin: 0;">⚠️ Trimitere factură eșuată</h2></div><div style="background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 0 0 8px 8px;"><p>Factura <strong>{{numar_factura}}</strong> pentru clientul <strong>{{client_nume}}</strong> ({{client_cui}}) nu a putut fi trimisă la iapp.ro.</p><div style="background: #fef0f0; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0;"><strong>Încercări:</strong> {{retry_count}}/3<br><strong>Ultima eroare:</strong> {{ultima_eroare}}</div><p>Vă rugăm accesați aplicația pentru a retrimite manual factura.</p><a href="{{link_actiune}}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Vezi factura</a></div><div style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;"><p>UNITAR PROIECT | office@unitarproiect.eu</p></div></div>',
  ['admin'],
  FALSE,
  'instant',
  CURRENT_DATE(),
  CURRENT_TIMESTAMP()
);

-- Verificare inserare
SELECT tip_notificare, nume_setare, activ, canal_email, canal_clopotel
FROM `hale-mode-464009-i6.PanouControlUnitar.NotificariSetari_v2`
WHERE tip_notificare = 'factura_iapp_esuat';
