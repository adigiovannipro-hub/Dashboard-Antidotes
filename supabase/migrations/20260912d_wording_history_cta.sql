-- ===========================================================================
-- `wording_history` gagne l'appel à l'action, et le format.
--
-- La table ne gardait que l'accroche (`hook`) et le texte entier
-- (`full_wording`). L'anti-répétition portait donc sur l'ouverture seule,
-- quand la demande produit est explicite : « je ne veux pas de répétition
-- entre les wordings (dans le hook, le body ou le cta) ». Un CTA rangé à part
-- se compare, se compte et se retire ; noyé dans `full_wording`, il fallait le
-- retrouver à la lecture, à chaque appel, dans chaque prompt.
--
-- `format` vient avec, pour la même raison : croiser une mécanique et un
-- format (« les carrousels portent mieux les questions ») demande de savoir de
-- quel format on parle, et `platform` seule ne le dit pas.
--
-- Un seul fichier, sans volet RLS : la table est créée et protégée depuis
-- 0032/0033, et ajouter une colonne ne change aucune politique — elles portent
-- sur des lignes, jamais sur des colonnes. Rien à révoquer non plus, `anon`
-- n'ayant déjà aucun droit sur cette table.
-- ===========================================================================

alter table wording_history add column if not exists cta text;
alter table wording_history add column if not exists format planning_format;

comment on column wording_history.cta is
  'Appel à l''action final de la caption, extrait à la génération ou à la validation. Null quand la caption n''en portait aucun — une absence, jamais un vide à combler.';
comment on column wording_history.format is
  'Format de la publication, repris du sujet du planning. Sert à croiser mécanique et format dans les prompts.';

notify pgrst, 'reload schema';
