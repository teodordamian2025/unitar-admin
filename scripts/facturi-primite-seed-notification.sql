-- =====================================================
-- SEED: Notificare factura_primita_asociata
-- Inserează setare nouă în NotificariSetari_v2
-- Data: 08.10.2025
-- =====================================================

INSERT INTO `PanouControlUnitar.NotificariSetari_v2` (
  id,
  tip_notificare,
  nume_setare,
  descriere,
  activ,
  canal_email,
  canal_clopotel,
  template_subiect,
  template_continut,
  destinatari_rol,
  data_creare,
  data_modificare
)
VALUES (
  GENERATE_UUID(),
  'factura_primita_asociata',
  'Factură Primită Asociată',
  'Notificare către responsabil proiect când o factură primită este asociată cu o cheltuială',
  TRUE,
  FALSE, -- Doar UI, fără email
  TRUE,  -- Doar clopotel
  '{{user_name}}, factură nouă asociată cu {{proiect_denumire}}',
  'Bună {{user_name}},

Tocmai a fost asociată o factură primită de la {{furnizor_nume}} (CUI: {{furnizor_cui}}) cu cheltuiala din proiectul {{proiect_denumire}}.

**Detalii factură:**
- Serie/număr: {{serie_numar}}
- Valoare: {{valoare}} {{moneda}}
- Data facturii: {{data_factura}}

**Asociere:**
- Tip: {{asociere_tip}} (automată/manuală)
- Data asocierii: {{data_asociere}}',
  ['admin', 'normal'],
  CURRENT_TIMESTAMP(),
  CURRENT_TIMESTAMP()
);

-- Verificare insert
SELECT
  tip_notificare,
  nume_setare,
  activ,
  canal_clopotel,
  canal_email
FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE tip_notificare = 'factura_primita_asociata';
