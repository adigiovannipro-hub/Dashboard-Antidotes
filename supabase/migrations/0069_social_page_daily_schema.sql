-- Les statistiques **de Page** au grain jour — impressions, portée,
-- interactions, vues vidéo — telles que l'API Page Insights les rend.
--
-- Pourquoi une table de plus alors que `social_posts` porte déjà des
-- impressions : Meta a retiré (fin 2025) la plupart des métriques **par
-- publication** de Page, et les redemander ne garantit rien. Les métriques
-- de Page, elles, restent servies : `page_impressions`, `page_impressions_unique`,
-- `page_post_engagements`, `page_video_views`. Un client à qui on doit des
-- impressions Facebook les aura par ce chemin quand l'autre est muet.
--
-- Grain jour, grandeurs additives seulement — les ratios se recalculent à la
-- lecture. Même clé que `social_followers` : une ligne par source, plateforme
-- et jour, l'upsert du connecteur ne duplique jamais.
create table social_page_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  date date not null,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  engagements bigint not null default 0,
  video_views bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, platform, date)
);

create index social_page_daily_workspace_idx
  on social_page_daily (workspace_id, platform, date);
