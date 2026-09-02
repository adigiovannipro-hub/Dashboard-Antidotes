-- LinkedIn passe au grain jour, comme tout le reste du projet.
--
-- La migration précédente (20260902d) posait des compteurs **cumulés**,
-- faute de mieux : l'outil pré-emballé de la passerelle refusait tout
-- découpage temporel. Le passage HTTP brut de Composio, lui, ne refuse
-- rien — l'API LinkedIn sert le grain jour, la liste des publications, les
-- statistiques par publication et les gains d'abonnés mensuels (sondé sur
-- pièce le 2 septembre 2026 contre la page ANMF).
--
-- Conséquence : plus de compteurs cumulés, plus de différence à la lecture,
-- plus de « pas d'antériorité ». LinkedIn se range dans les mêmes tables
-- qu'Instagram et Facebook — `social_posts`, `social_page_daily`,
-- `social_followers` — et se lit avec le même code.
--
-- `social_page_daily` gagne les quatre grandeurs que LinkedIn rend et que
-- Meta ne rendait pas au grain jour. Toutes additives, toutes à zéro par
-- défaut : les lignes Meta existantes ne bougent pas.
alter table social_page_daily
  add column if not exists clicks bigint not null default 0,
  add column if not exists likes bigint not null default 0,
  add column if not exists comments bigint not null default 0,
  add column if not exists shares bigint not null default 0;

-- Et `social_posts` gagne les clics : LinkedIn les rend par publication
-- (`clickCount`), Meta jamais. Zéro par défaut, donc invisible ailleurs.
alter table social_posts
  add column if not exists clicks bigint not null default 0;

-- La table des cumuls n'a plus de rôle. Elle a vécu une demi-journée et
-- n'a jamais servi un écran : la garder serait de la dette, pas un filet.
drop table if exists social_lifetime_totals;
