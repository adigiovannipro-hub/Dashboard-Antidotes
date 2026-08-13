-- ===========================================================================
-- 0042 — Le logo d'un espace
--
-- `workspaces.logo_url` existe depuis 0001 et n'a jamais servi : il ne manque
-- que l'endroit où poser le fichier. La colonne garde le **chemin** dans le
-- bucket, pas une URL — le bucket est privé, l'URL se signe à la lecture et
-- expire. Stocker une URL signée en base la rendrait périmée en une heure.
--
-- Bucket privé comme les six autres : un logo n'est pas un secret, mais un
-- bucket public expose la liste de tous les fichiers à qui devine le nom du
-- bucket, et l'uniformité vaut mieux qu'une exception à expliquer.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-logos',
  'workspace-logos',
  false,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

/* Lecture : tout membre de l'espace. Le logo s'affiche dans le rail et sur la
   carte d'accueil — un client doit voir le sien. Le premier segment du chemin
   est l'identifiant de l'espace, comme pour les visuels du planning. */
drop policy if exists workspace_logos_select on storage.objects;
create policy workspace_logos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w
      where w.id in (select app.accessible_workspace_ids())
    )
  );

/* Écriture : l'owner seul. Renommer, dupliquer et supprimer un espace lui sont
   déjà réservés ; poser son logo relève de la même administration. */
drop policy if exists workspace_logos_insert on storage.objects;
create policy workspace_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );

drop policy if exists workspace_logos_update on storage.objects;
create policy workspace_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  )
  with check (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );

drop policy if exists workspace_logos_delete on storage.objects;
create policy workspace_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );
