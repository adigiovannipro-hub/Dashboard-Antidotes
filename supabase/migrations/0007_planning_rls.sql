-- ===========================================================================
-- Planning Éditorial — Row Level Security et stockage des visuels
--
-- Le planning suit le modèle de rôles de la plateforme : tout utilisateur
-- ayant accès à l'espace peut lire **et écrire**. Il n'y a pas de rôle
-- « lecture seule » parmi les utilisateurs authentifiés — un client réorganise
-- son planning, annote une publication, valide un wording.
--
-- Ce qui reste à l'owner de l'organisation : supprimer un tableau entier. Une
-- année de planning ne part pas sur un clic maladroit.
-- ===========================================================================

alter table planning_boards      enable row level security;
alter table planning_months      enable row level security;
alter table planning_lanes       enable row level security;
alter table planning_subjects    enable row level security;
alter table planning_comments    enable row level security;
alter table planning_faq_entries enable row level security;

revoke all on planning_boards, planning_months, planning_lanes,
  planning_subjects, planning_comments, planning_faq_entries
from anon;

-- --- Tableaux ---------------------------------------------------------------

create policy planning_boards_select on planning_boards
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_boards_insert on planning_boards
  for insert to authenticated
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_boards_update on planning_boards
  for update to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

-- Supprimer un tableau, c'est supprimer une année entière : owner uniquement.
create policy planning_boards_delete on planning_boards
  for delete to authenticated
  using (app.owns_workspace(workspace_id));

-- --- Mois, couloirs, publications, retours, FAQ -----------------------------

-- Ces quatre tables partagent exactement la même règle : accès à l'espace vaut
-- droit d'écriture. Les politiques sont écrites une par une plutôt que
-- factorisées — c'est du SQL qu'on relit en cas de doute sur qui peut quoi, et
-- l'explicite y vaut mieux que le concis.

create policy planning_months_select on planning_months
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_months_write on planning_months
  for all to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_lanes_select on planning_lanes
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_lanes_write on planning_lanes
  for all to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_subjects_select on planning_subjects
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_subjects_write on planning_subjects
  for all to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_faq_select on planning_faq_entries
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_faq_write on planning_faq_entries
  for all to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

-- Les retours se lisent à plusieurs mais ne se réécrivent pas : on ne modifie
-- pas le commentaire de quelqu'un d'autre. Chacun supprime le sien, l'owner
-- peut trancher.
create policy planning_comments_select on planning_comments
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_comments_insert on planning_comments
  for insert to authenticated
  with check (
    workspace_id in (select app.accessible_workspace_ids())
    and author_id = auth.uid()
  );

create policy planning_comments_update on planning_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy planning_comments_delete on planning_comments
  for delete to authenticated
  using (author_id = auth.uid() or app.owns_workspace(workspace_id));

-- --- Stockage des visuels ---------------------------------------------------

-- Les créas sont des documents clients : le bucket est privé, et l'affichage
-- passe par des URL signées générées côté serveur. Les fichiers sont rangés
-- sous `<workspace_id>/<subject_id>/<nom>`, ce qui rend la politique lisible :
-- le premier dossier du chemin dit à quel espace appartient le fichier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planning-visuals',
  'planning-visuals',
  false,
  52428800, -- 50 Mo : une vidéo de reel passe, un rush brut non.
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
    'video/mp4', 'video/quicktime', 'application/pdf'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Comparaison en texte plutôt qu'en uuid : un chemin mal formé doit rendre la
-- politique fausse, pas lever une erreur de conversion.
create policy planning_visuals_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'planning-visuals'
    and (storage.foldername(name))[1] in (
      select id::text from workspaces
      where id in (select app.accessible_workspace_ids())
    )
  );

create policy planning_visuals_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'planning-visuals'
    and (storage.foldername(name))[1] in (
      select id::text from workspaces
      where id in (select app.accessible_workspace_ids())
    )
  );

create policy planning_visuals_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'planning-visuals'
    and (storage.foldername(name))[1] in (
      select id::text from workspaces
      where id in (select app.accessible_workspace_ids())
    )
  );
