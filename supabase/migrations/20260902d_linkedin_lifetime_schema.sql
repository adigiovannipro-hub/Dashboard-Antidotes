-- Les compteurs **cumulés** d'une page LinkedIn, relevés une fois par jour.
--
-- Pourquoi cumulés, alors que tout le reste du projet stocke des grandeurs
-- de la journée : LinkedIn ne rend pas autre chose. `organizationalEntity
-- ShareStatistics` sert un total depuis la création de la page, et **refuse
-- tout découpage temporel** par la passerelle Composio — les trois formes
-- d'intervalle documentées répondent « Bad request … time intervals »
-- (sondé le 2 septembre 2026 sur la page ANMF, grains jour et mois).
--
-- La conséquence est assumée : on relève le compteur chaque jour, et la
-- valeur d'une période est la **différence entre deux relevés** — celui qui
-- ferme la période et le dernier d'avant. C'est exact, additif, et ça
-- survit à un jour manqué (la différence couvre alors deux jours). Le prix
-- à payer est qu'il n'y a **pas d'antériorité** : rien avant le premier
-- relevé, et l'écran le dit plutôt que d'afficher un zéro.
--
-- Même clé que `social_followers` et `social_page_daily` : une ligne par
-- source, plateforme et jour. L'upsert du connecteur ne duplique jamais, et
-- rejouer un passage le même jour réécrit le relevé au lieu de l'empiler.
create table social_lifetime_totals (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  date date not null,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, platform, date)
);

create index social_lifetime_totals_workspace_idx
  on social_lifetime_totals (workspace_id, platform, date);
