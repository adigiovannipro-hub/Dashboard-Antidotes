-- ===========================================================================
-- Reporting multi-clients — schéma organique.
--
-- L'équivalent organique de `ad_metrics_daily` : seules des grandeurs
-- additives sont stockées, tout taux (engagement…) est recalculé à la
-- lecture depuis les sommes de la période affichée. Chaque plateforme ne
-- remplit que les colonnes que son API expose — les écrans n'affichent que
-- ce qui existe, jamais un faux zéro.
-- ===========================================================================

create table social_metrics_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  date date not null,
  reach bigint not null default 0,
  views bigint not null default 0,
  interactions bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  engaged_accounts bigint not null default 0,
  profile_views bigint not null default 0,
  profile_link_taps bigint not null default 0,
  website_clicks bigint not null default 0,
  follows bigint not null default 0,
  unfollows bigint not null default 0,
  posts_published integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, date)
);

create index social_metrics_daily_workspace_date_idx
  on social_metrics_daily (workspace_id, date);

-- Instantanés de la démographie des abonnés (le Persona organique). Les
-- régies rendent tantôt des comptes (Instagram, LinkedIn), tantôt des parts
-- (TikTok) : les deux colonnes coexistent et au moins une est renseignée —
-- on stocke ce que l'API donne, jamais une valeur inventée.
--
-- La synchronisation n'écrit qu'un instantané par mois (date = 1er du mois),
-- réécrit à chaque passage : l'écran lit le dernier instantané antérieur ou
-- égal à la fin de la période affichée. Le grain jour reste possible sans
-- migration si un besoin plus fin apparaît.
create table social_demographics (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  date date not null,
  dimension audience_dimension not null,
  value text not null,
  followers_count bigint,
  followers_share numeric(8, 5),
  updated_at timestamptz not null default now(),
  primary key (data_source_id, date, dimension, value),
  constraint social_demographics_value_present check (
    followers_count is not null or followers_share is not null
  )
);

create index social_demographics_workspace_idx
  on social_demographics (workspace_id, dimension, date);

-- LinkedIn Ads et les campagnes lead Meta comptent de vrais prospects. Le
-- « CPL » historique du rapport Bondet reste un coût par vue de page
-- (décision documentée dans src/lib/metrics/definitions.ts) ; cette colonne
-- porte les leads réels, sans toucher à l'existant.
alter table ad_metrics_daily add column leads bigint not null default 0;
