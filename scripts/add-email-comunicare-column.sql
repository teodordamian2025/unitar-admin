-- Script: Adaugă coloana email_comunicare la Utilizatori_v2
-- Data: 01.04.2026
-- Descriere: Email separat pentru comunicări/notificări (diferit de email-ul de autentificare Firebase)
-- NOTA: email_comunicare este opțional. Dacă nu este setat, se folosește email-ul de autentificare.

ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Utilizatori_v2`
ADD COLUMN IF NOT EXISTS email_comunicare STRING;
