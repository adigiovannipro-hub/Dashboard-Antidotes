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

alter table conversations
  add column post_external_id text,
  add column post_permalink text,
  add column post_excerpt text,
  add column post_thumbnail_url text;
