-- ==================================================================
-- SCRIPT: Creare tabel ComentariiCitite_v2 pentru tracking citiri
-- DATA: 06.01.2026
-- DESCRIERE: Tabel pentru a ține evidența comentariilor citite de fiecare utilizator
-- FUNCȚIONALITATE: Permite identificarea comentariilor necitite per user
-- ==================================================================

-- Creare tabel ComentariiCitite_v2 cu partitioning
CREATE TABLE IF NOT EXISTS `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2` (
  -- Identificatori
  id STRING NOT NULL,                        -- UUID citire
  user_id STRING NOT NULL,                   -- UID utilizator care a citit
  comentariu_id STRING NOT NULL,             -- ID comentariu citit
  proiect_id STRING NOT NULL,                -- ID proiect/subproiect pentru filtrare rapidă

  -- Metadata
  data_citire TIMESTAMP NOT NULL,            -- Când a fost citit (setat la INSERT cu CURRENT_TIMESTAMP())

  -- Partition key (pentru optimizare queries)
  data_creare DATE NOT NULL                  -- Setat la INSERT cu CURRENT_DATE()
)
PARTITION BY data_creare
CLUSTER BY user_id, proiect_id
OPTIONS(
  description = 'Tabel pentru tracking comentarii citite per utilizator - creată 06.01.2026',
  labels = [("app", "unitar"), ("modul", "comentarii"), ("tip", "tracking")]
);

-- Index implicit prin CLUSTER BY:
-- - user_id: pentru queries "ce comentarii a citit user X"
-- - proiect_id: pentru queries "ce comentarii necitite are user X pentru proiect Y"

-- ==================================================================
-- QUERIES UTILE
-- ==================================================================

-- 1. Verifică dacă un comentariu a fost citit de un user
-- SELECT COUNT(*) > 0 as citit
-- FROM `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2`
-- WHERE user_id = @user_id AND comentariu_id = @comentariu_id;

-- 2. Obține lista comentarii necitite pentru un user și proiect
-- SELECT c.*
-- FROM `hale-mode-464009-i6.PanouControlUnitar.ProiectComentarii_v2` c
-- LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2` cc
--   ON c.id = cc.comentariu_id AND cc.user_id = @user_id
-- WHERE c.proiect_id = @proiect_id
--   AND cc.id IS NULL  -- Nu a fost citit
--   AND c.autor_uid != @user_id;  -- Nu numără propriile comentarii

-- 3. Contorizează comentarii necitite per proiect pentru un user
-- SELECT
--   c.proiect_id,
--   COUNT(*) as necitite_count
-- FROM `hale-mode-464009-i6.PanouControlUnitar.ProiectComentarii_v2` c
-- LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2` cc
--   ON c.id = cc.comentariu_id AND cc.user_id = @user_id
-- WHERE cc.id IS NULL
--   AND c.autor_uid != @user_id
-- GROUP BY c.proiect_id;

-- 4. Marchează toate comentariile unui proiect ca citite
-- INSERT INTO `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2`
-- (id, user_id, comentariu_id, proiect_id, data_citire, data_creare)
-- SELECT
--   GENERATE_UUID(),
--   @user_id,
--   c.id,
--   c.proiect_id,
--   CURRENT_TIMESTAMP(),
--   CURRENT_DATE()
-- FROM `hale-mode-464009-i6.PanouControlUnitar.ProiectComentarii_v2` c
-- LEFT JOIN `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2` cc
--   ON c.id = cc.comentariu_id AND cc.user_id = @user_id
-- WHERE c.proiect_id = @proiect_id
--   AND cc.id IS NULL;  -- Doar cele necitite

-- ==================================================================
-- CLEANUP (opțional - pentru date vechi)
-- ==================================================================

-- Șterge înregistrări mai vechi de 90 de zile (pentru optimizare storage)
-- DELETE FROM `hale-mode-464009-i6.PanouControlUnitar.ComentariiCitite_v2`
-- WHERE data_creare < DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
