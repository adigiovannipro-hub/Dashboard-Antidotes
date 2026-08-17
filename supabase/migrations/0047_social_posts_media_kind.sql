-- La nature d'une publication organique — reel, carrousel ou post fixe.
--
-- Deux usages : la colonne « Type » du tableau par publication, et les vues
-- vidéos, qui ne se comptent que sur les reels. Texte contraint et non enum :
-- le module Planning a montré (0029) que ces vocabulaires bougent, et trois
-- valeurs ne justifient pas un type.

alter table social_posts
  add column media_kind text not null default 'image'
  check (media_kind in ('image', 'carousel', 'video'));
