-- ===========================================================================
-- 0040 — Le Contexte s'ouvre aux contributeurs
--
-- Jusqu'ici la frontière d'un espace n'avait qu'un cran : owner, ou pas. Le
-- mot `contributor` était déclaré dans l'enum de 0001 et **n'apparaissait dans
-- aucune politique** — un contributeur et un client avaient exactement les
-- mêmes droits.
--
-- La règle produit est que la frontière porte sur les **modules**, pas sur
-- l'écriture : client et contributeur travaillent tous deux le planning
-- (ajouter, supprimer, écrire un wording, déposer un visuel, changer un
-- statut), et c'est le Contexte qui les sépare. Un contributeur écrit le
-- brief ; un client n'a pas à le voir.
--
-- La Modération n'est pas traitée ici : elle a sa propre table d'adhésion
-- (`moderation_members`, clé `client_id`) sans lien avec les espaces. L'ouvrir
-- aux contributeurs demande de relier les deux systèmes, et un demi-pont
-- afficherait une boîte vide.
-- ===========================================================================

/* Owner de l'organisation, ou contributeur de cet espace précis.
   `security definer` et `search_path` figé comme tous les helpers du dépôt :
   c'est ce qui empêche un détournement par schéma temporaire. */
create or replace function app.reaches_context(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.owns_workspace(target_workspace)
      or exists (
        select 1
        from memberships m
        where m.workspace_id = target_workspace
          and m.user_id = auth.uid()
          and m.role = 'contributor'
      );
$$;

grant execute on function app.reaches_context(uuid) to authenticated;

-- --- Les trois tables du Contexte -------------------------------------------

drop policy if exists client_context_owner on client_context;
drop policy if exists client_context_reachable on client_context;
create policy client_context_reachable on client_context
  for all to authenticated
  using (app.reaches_context(workspace_id))
  with check (app.reaches_context(workspace_id));

drop policy if exists client_assets_owner on client_assets;
drop policy if exists client_assets_reachable on client_assets;
create policy client_assets_reachable on client_assets
  for all to authenticated
  using (app.reaches_context(workspace_id))
  with check (app.reaches_context(workspace_id));

/* `wording_history` reste owner-only : elle appartient au module Production,
   dont aucune page n'est ouverte au contributeur. La politique posée par
   0033_client_context_rls sur cette table est donc laissée telle quelle. */

-- --- Le bucket des documents client ------------------------------------------

drop policy if exists client_assets_select on storage.objects;
create policy client_assets_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.reaches_context(w.id)
    )
  );

drop policy if exists client_assets_insert on storage.objects;
create policy client_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.reaches_context(w.id)
    )
  );

drop policy if exists client_assets_delete on storage.objects;
create policy client_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-assets'
    and (storage.foldername(name))[1] in (
      select w.id::text from workspaces w where app.reaches_context(w.id)
    )
  );
