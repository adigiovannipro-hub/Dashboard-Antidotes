-- Vues vidéo et vues à 100 % sur les campagnes.
--
-- Le Reporting payant ne portait aucune mesure vidéo alors que Meta les rend
-- sur chaque ligne d'Insights : `video_view` dans `actions` (lecture de
-- 3 secondes, la définition Meta d'une vue) et `video_p100_watched_actions`
-- (lecture jusqu'au bout). Deux grandeurs additives, stockées au grain jour
-- comme le reste — le taux de complétion, lui, se recalcule à la lecture.
--
-- Additif : aucune ligne ne change, les jours déjà collectés restent à 0
-- jusqu'à la prochaine fenêtre de synchronisation (35 jours glissants), qui
-- les réécrit avec les vraies valeurs.
alter table ad_metrics_daily
  add column if not exists video_views bigint not null default 0,
  add column if not exists video_completions bigint not null default 0;
