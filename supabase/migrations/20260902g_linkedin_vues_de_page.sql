-- Les **vues de la page** LinkedIn, au grain jour.
--
-- Les statistiques de publication disent ce que le contenu a fait ; celles-ci
-- disent combien de monde est venu voir la page elle-même — l'accueil, les
-- offres d'emploi. Ce sont deux questions différentes, et le rapport que le
-- client lit aujourd'hui porte les deux.
--
-- `/rest/organizationPageStatistics` les rend au **jour** (sondé sur pièce :
-- 31 éléments sur août 2026, 316 vues et 128 uniques au total du mois, dont
-- 42 vues d'offres d'emploi). Elles se rangent donc dans la table de page
-- comme le reste, sans exception de grain.
--
-- `unique_page_views` est stockée bien qu'elle ne soit **pas additive** : la
-- somme de trente uniques quotidiens surcompte le visiteur revenu deux fois.
-- Elle sert au jour et au mois isolés, jamais en somme de période — même
-- règle que les visiteurs uniques du trafic web, et la lecture ne l'agrège
-- pas.
--
-- À zéro sur les lignes Meta : Facebook expose ses vues de Page sous d'autres
-- métriques, qu'on ne collecte pas aujourd'hui.
alter table social_page_daily
  add column if not exists page_views bigint not null default 0,
  add column if not exists unique_page_views bigint not null default 0,
  add column if not exists jobs_page_views bigint not null default 0;
