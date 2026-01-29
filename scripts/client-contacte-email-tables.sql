-- ==================================================================
-- SCRIPT: Tabele pentru contacte clienți și jurnal email
-- DATA: 29.01.2026
-- DESCRIERE: Creează tabelele necesare pentru sistemul de email client
-- ==================================================================

-- =====================================================
-- 1. TABEL: ClientContacte_v2 - Contacte pentru notificări email
-- =====================================================
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.ClientContacte_v2` (
  id STRING NOT NULL,
  client_id STRING NOT NULL,
  prenume STRING,
  nume STRING NOT NULL,
  email STRING NOT NULL,
  telefon STRING,
  rol STRING,
  comentariu STRING,
  activ BOOL DEFAULT TRUE,
  primeste_notificari BOOL DEFAULT TRUE,
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP
)
PARTITION BY DATE(data_creare)
CLUSTER BY client_id, activ;

-- =====================================================
-- 2. TABEL: EmailClientLog_v2 - Jurnal email-uri trimise către clienți
-- =====================================================
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.EmailClientLog_v2` (
  id STRING NOT NULL,
  proiect_id STRING NOT NULL,
  client_id STRING NOT NULL,
  client_nume STRING,
  tip_email STRING NOT NULL,
  subiect STRING NOT NULL,
  destinatari STRING NOT NULL,
  continut_preview STRING,
  template_folosit STRING,
  trimis_de STRING,
  trimis_de_nume STRING,
  email_status STRING DEFAULT 'trimis',
  email_message_id STRING,
  email_error STRING,
  data_trimitere TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(data_creare)
CLUSTER BY proiect_id, client_id, tip_email;

-- =====================================================
-- 3. INSERT CONTACTE TEST (opțional - comentat)
-- =====================================================
-- INSERT INTO `PanouControlUnitar.ClientContacte_v2`
-- (id, client_id, prenume, nume, email, telefon, rol, comentariu, activ, primeste_notificari, data_creare)
-- VALUES
-- ('test_contact_1', 'test_client_id', 'Ion', 'Popescu', 'ion.popescu@test.ro', '0721123456', 'Director General', 'Contact principal', TRUE, TRUE, CURRENT_TIMESTAMP());

-- =====================================================
-- COMENTARII PENTRU REFERINȚĂ
-- =====================================================
--
-- ClientContacte_v2:
-- - id: Identificator unic contact (format: contact_{timestamp}_{random})
-- - client_id: FK către Clienti_v2.id
-- - prenume: Prenumele contactului
-- - nume: Numele contactului (obligatoriu)
-- - email: Adresă email (obligatoriu)
-- - telefon: Număr telefon (opțional)
-- - rol: Rol în companie (ex: Director, Manager, Contabil)
-- - comentariu: Note despre contact
-- - activ: Flag pentru soft delete
-- - primeste_notificari: Dacă primește email-uri automate
-- - data_creare: Timestamp creare
-- - data_actualizare: Timestamp ultima modificare
--
-- EmailClientLog_v2:
-- - id: Identificator unic log (format: email_log_{timestamp}_{random})
-- - proiect_id: FK către Proiecte_v2.id
-- - client_id: FK către Clienti_v2.id
-- - client_nume: Denumirea clientului (denormalizat pentru rapoarte)
-- - tip_email: Tipul email-ului (factura_emisa, factura_restanta, stadiu_proiect, custom)
-- - subiect: Subiectul email-ului
-- - destinatari: Lista destinatarilor (JSON array sau comma-separated)
-- - continut_preview: Primele 500 caractere din conținut (pentru preview)
-- - template_folosit: ID template folosit (dacă a fost predefinit)
-- - trimis_de: User ID care a trimis
-- - trimis_de_nume: Numele user-ului care a trimis
-- - email_status: Status trimitere (trimis, eroare, in_asteptare)
-- - email_message_id: Message ID returnat de SMTP
-- - email_error: Mesaj eroare (dacă a fost eroare)
-- - data_trimitere: Timestamp trimitere efectivă
-- - data_creare: Timestamp creare înregistrare
