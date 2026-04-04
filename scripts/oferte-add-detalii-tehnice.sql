-- ==================================================================
-- Script: Adaugare coloana detalii_tehnice la Oferte_v2
-- Data: 04.04.2026
-- Descriere: Coloana JSON string pentru detalii tehnice document
--   (faza proiectare, tip cladire, regim inaltime, material structura,
--    suprafata construita, structura propusa, tip interventie,
--    scop expertiza, cod LMI, categorie monument, grafic plata)
-- ==================================================================

ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Oferte_v2`
ADD COLUMN IF NOT EXISTS detalii_tehnice STRING;
