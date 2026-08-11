-- ===========================================================================
-- Contexte client — Row Level Security
--
-- Réservé au rôle « agence », qui dans ce socle est l'owner de
-- l'organisation : `app.owns_workspace()` est l'équivalent exact du
-- `role = 'agency'` demandé par le cahier des charges. Un client — même
-- membre de l'espace, même authentifié — ne lit ni n'écrit **rien** ici :
-- ni le brief, ni les documents, ni l'historique des accroches. Le lien de
-- navigation est masqué côté client et la page rend 404, mais c'est la base
-- qui fait foi : un appel REST direct avec un jeton client ne rend aucune
-- ligne.
-- ===========================================================================

alter table client_context  enable row level security;
alter table client_assets   enable row level security;
alter table wording_history enable row level security;

-- Une seule politique `all` par table : lecture et écriture ont exactement
-- le même périmètre (l'owner), les séparer ne documenterait rien.
create policy client_context_owner on client_context
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

create policy client_assets_owner on client_assets
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

create policy wording_history_owner on wording_history
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

-- --- Stockage ----------------------------------------------------------------

-- Même modèle que `planning-visuals` — le premier dossier du chemin est
-- l'espace — mais restreint aux owners : contrairement aux créas, un client
-- ne voit jamais ses propres documents de contexte. Les fichiers sont servis
-- à l'écran par URL signée de courte durée, jamais en public.
--
-- Les politiques de `storage.objects` survivent à la suppression des tables
-- du module : elles appartiennent au stockage. On les retire d'abord, sinon
-- une réapplication échouerait sur « la politique existe déjà ».
drop policy if exists client_assets_select on storage.objects;
drop policy if exists client_assets_insert on storage.objects;
drop policy if exists client_assets_delete on storage.objects;

-- Comparaison en texte plutôt qu'en uuid : un chemin mal formé doit rendre la
-- politique fausse, pas lever une erreur de conversion.
create policy client_assets_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );

create policy client_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );

create policy client_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.owns_workspace(w.id)
    )
  );

-- --- Vérification ----------------------------------------------------------

/* Le rôle `anon` ne doit rien pouvoir lire, y compris par accident : le
   `revoke all` de 0002 ne couvre que les tables existant à cet instant. */
revoke all on client_context, client_assets, wording_history from anon;
