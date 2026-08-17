-- Les vues vidéo d'une publication, mesurées et non déduites.
--
-- Elles étaient calculées à la lecture — « impressions du post si c'est un
-- reel » — ce qui est faux deux fois : Facebook expose `post_video_views`,
-- une grandeur distincte des impressions, et un post Facebook n'annonçait
-- jamais son type, donc la colonne restait vide côté Page.

alter table social_posts
  add column video_views bigint not null default 0;
