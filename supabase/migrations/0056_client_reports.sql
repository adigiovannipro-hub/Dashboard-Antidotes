-- La synthèse mensuelle produite par la phase Reporting.
--
-- Jusqu'ici le rapport partait dans `generation_jobs.result.report` — et
-- **aucun écran ne lisait ce champ**. La phase se clôturait sur un livrable
-- invisible : le job disait « Reporting de juillet généré », le texte restait
-- en base, personne ne le voyait jamais.
--
-- Une table à part, et pas le job, pour une raison de durée de vie : un job est
-- une trace d'exécution, purgée sans état d'âme au bout de dix minutes de
-- silence. Une synthèse de mois est un document de travail qu'on relit en
-- préparant le point client, six mois plus tard.
--
-- **Interne, jamais client.** La synthèse est écrite par un modèle à partir de
-- chiffres réels : elle sert à préparer, pas à livrer. La RLS est donc
-- owner-only comme le reste du module Production (0033), et le panneau qui
-- l'affiche ne se rend qu'au propriétaire. Un contributeur n'y a pas accès non
-- plus — il travaille le planning, pas le bilan.
--
-- Un rapport par espace et par mois analysé : régénérer remplace, ce qui est
-- le geste attendu quand on relance la phase après une synchronisation.

create table if not exists client_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  /* Premier jour du mois analysé, `YYYY-MM-01` — même convention que
     `client_phases.target_month`, dont ce rapport est le livrable. */
  target_month date not null,
  /* Le compte rendu, en markdown : c'est la sortie brute du modèle. */
  report text not null,
  /* Ce sur quoi il s'appuie réellement, pour que la relecture sache si les
     chiffres venaient des régies ou seulement des volumes du planning. */
  has_ads_data boolean not null default false,
  has_organic_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_reports_month_first_day check (extract(day from target_month) = 1),
  unique (workspace_id, target_month)
);

create index if not exists client_reports_org_idx on client_reports (org_id);
create index if not exists client_reports_workspace_idx
  on client_reports (workspace_id, target_month desc);

do $$ begin
  create trigger client_reports_touch
    before update on client_reports
    for each row execute function app.touch_updated_at();
exception when duplicate_object then null;
end $$;
