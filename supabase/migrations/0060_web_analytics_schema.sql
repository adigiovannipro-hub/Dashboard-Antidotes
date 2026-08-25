-- Le trafic du site d'un client — l'onglet « Site Web » du Reporting.
--
-- Première source hors régies sociales : Google Analytics 4, lu à travers la
-- passerelle Composio (aucun jeton Google chez nous — voir
-- `docs/web-analytics-setup.md`). Le chemin reste celui de tout le projet :
-- API → base → lecture locale, upserts par identifiant externe.
--
-- Deux grains coexistent, et c'est une décision, pas une redondance :
--
--   • **le jour** (`web_metrics_daily`) porte les courbes et les sommes de
--     grandeurs additives — sessions, vues, durées cumulées ;
--   • **le mois civil** (`web_metrics_monthly` et les ventilations) porte les
--     visiteurs uniques, que GA4 dédoublonne par période : additionner des
--     uniques quotidiens surcompte un même visiteur revenu deux jours de
--     suite. Le rapport se lisant par mois révolu, on demande à GA le chiffre
--     exact du mois — c'est celui que le client lisait déjà dans Looker.
--
-- Sur une plage libre, les visiteurs redeviennent une somme de quotidiens :
-- approximation additive assumée, la même que la portée Meta (0045).
--
-- Les taux ne sont jamais stockés : le taux de rebond GA4 est
-- 1 − sessions engagées / sessions, la durée moyenne est durée cumulée /
-- sessions — tous deux se recalculent depuis les agrégats de la période.

alter type data_provider add value if not exists 'google_analytics';

-- Les découpages d'audience du site. `retention` est le « new vs returning »
-- de GA4 — nouveaux, connus, et « (not set) » quand GA ne sait pas trancher.
create type web_breakdown_type as enum ('source', 'device', 'city', 'retention');

create table web_metrics_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  date date not null,
  -- Visiteurs uniques **du jour**. Leur somme sur une période est une
  -- approximation haute ; le chiffre exact d'un mois vit dans la table
  -- mensuelle.
  total_users bigint not null default 0,
  sessions bigint not null default 0,
  -- Sessions engagées au sens GA4 (> 10 s, conversion, ou 2 pages) : le
  -- numérateur du taux d'engagement, donc le complément du taux de rebond.
  engaged_sessions bigint not null default 0,
  page_views bigint not null default 0,
  -- Durée cumulée des sessions du jour, en secondes : durée moyenne × sessions
  -- à la collecte. C'est la forme additive de la durée moyenne — sommer des
  -- moyennes serait faux dès que les jours pèsent inégal.
  session_seconds numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, date)
);

create index web_metrics_daily_workspace_idx
  on web_metrics_daily (workspace_id, date);

create table web_metrics_monthly (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- Le mois civil, calé au 1ᵉʳ — même convention que `planning_months.month`.
  month date not null,
  -- Visiteurs uniques du mois, dédoublonnés par GA : le chiffre du rapport.
  total_users bigint not null default 0,
  new_users bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, month)
);

create index web_metrics_monthly_workspace_idx
  on web_metrics_monthly (workspace_id, month);

-- Sources de trafic, appareils, villes, nouveaux/connus — au grain mois,
-- parce que `users` y est dédoublonné par GA sur le mois demandé.
create table web_breakdowns_monthly (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  month date not null,
  type web_breakdown_type not null,
  -- La valeur telle que GA la rend : « tiktok », « mobile », « Paris »,
  -- « (not set) ». Texte libre — elle appartient à la mesure, pas au produit.
  value text not null,
  users bigint not null default 0,
  sessions bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, month, type, value)
);

create index web_breakdowns_monthly_workspace_idx
  on web_breakdowns_monthly (workspace_id, month);

-- Les pages du site, mois par mois — le tableau « Top Pages » du rapport.
create table web_pages_monthly (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  month date not null,
  -- Le chemin tel que GA le rend (`/accue/la-meunerie/`), hôte exclu.
  path text not null,
  views bigint not null default 0,
  sessions bigint not null default 0,
  engaged_sessions bigint not null default 0,
  -- Durée cumulée des sessions entrées par cette page, en secondes — même
  -- forme additive que la table quotidienne.
  session_seconds numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, month, path)
);

create index web_pages_monthly_workspace_idx
  on web_pages_monthly (workspace_id, month);
