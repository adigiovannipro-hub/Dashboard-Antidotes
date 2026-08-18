-- Un commentaire ne se lit pas seul : il se lit sous sa publication.
--
-- Le fil d'une conversation « commentaire » porte donc la publication
-- commentée — identifiant Graph, permalien, extrait de légende, vignette —
-- renseignée à l'ingestion par la synchronisation Meta. Quatre colonnes
-- dénormalisées et non une table de publications : l'inbox n'a besoin que
-- d'afficher et de pointer, jamais de croiser, et `social_posts` vit dans un
-- autre module avec un autre cycle de vie (une source de Reporting peut être
-- débranchée sans que la modération perde son contexte).
--
-- Nullables : un message privé n'a pas de publication.

-- `if not exists` par nécessité, pas par confort : cette migration est née
-- 0049 sur sa branche, numéro qu'une autre branche avait déjà pris. Renumérotée
-- en 0050, elle redevient « jamais appliquée » aux yeux du runner, qui la
-- rejouerait sur une base où les colonnes existent déjà.
alter table conversations
  add column if not exists post_external_id text,
  add column if not exists post_permalink text,
  add column if not exists post_excerpt text,
  add column if not exists post_thumbnail_url text;
