-- ===========================================================================
-- 20261007a — Le nom d'un client remonte enfin à l'écran
--
-- Deux défauts, vus sur un retour de Candice HEYMAN (ANMF) affiché
-- « Inconnu » le 6/10/2026 :
--
-- 1. Le prénom et le nom saisis à l'invitation (`invitations.first_name`,
--    0065) n'étaient jamais recopiés sur la fiche : `app.handle_new_user()` ne
--    le faisait que pour les inscriptions Academy. La fiche naissait vide.
-- 2. `profiles_select` (0002) ne laissait lire que sa propre fiche et celles
--    des membres de l'organisation (`organization_members`) — or un client
--    vit dans `memberships`. L'owner ne lisait donc la fiche d'aucun client,
--    et un client ne lisait pas celle de l'agence.
--
-- Une politique **s'ajoute** à celle de 0002 (les politiques `select` se
-- combinent en OU) : on lit la fiche de quiconque partage un espace qu'on
-- atteint, et des owners de l'organisation de cet espace. Jamais au-delà :
-- un client ne lit pas les clients d'un autre espace.
--
-- La photo de profil passe de 2 à 20 Mo : une photo de téléphone en pèse
-- souvent 4 à 8, et un refus au premier essai est exactement la friction
-- qu'on veut retirer de l'accueil. Le navigateur la réduit de toute façon
-- avant l'envoi.
-- ===========================================================================

create or replace function app.visible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id
  from memberships m
  where m.workspace_id in (select app.accessible_workspace_ids())
  union
  select om.user_id
  from organization_members om
  join workspaces w on w.org_id = om.org_id
  where w.id in (select app.accessible_workspace_ids())
    and om.role = 'owner';
$$;

revoke all on function app.visible_profile_ids() from public, anon;
grant execute on function app.visible_profile_ids() to authenticated;

drop policy if exists profiles_select_shared on profiles;
create policy profiles_select_shared on profiles for select to authenticated
  using (id in (select app.visible_profile_ids()));

-- --- Le nom de l'invitation rejoint la fiche --------------------------------

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  /* Le nom saisi par l'agence à l'invitation, lu **avant** que l'invitation
     soit marquée acceptée — c'est elle qui le porte. La plus récente gagne,
     et rien de ce que la personne a déjà renseigné n'est écrasé. */
  update profiles p
  set first_name = coalesce(p.first_name, i.first_name),
      last_name = coalesce(p.last_name, i.last_name),
      full_name = coalesce(
        p.full_name,
        nullif(trim(coalesce(i.first_name, '') || ' ' || coalesce(i.last_name, '')), '')
      )
  from (
    select first_name, last_name
    from invitations
    where lower(email) = lower(new.email)
      and (first_name is not null or last_name is not null)
    order by created_at desc
    limit 1
  ) i
  where p.id = new.id;

  insert into organization_members (org_id, user_id, role)
  select i.org_id, new.id, 'owner'::org_role
  from invitations i
  where lower(i.email) = lower(new.email)
    and i.role = 'owner'
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (org_id, user_id) do update set role = 'owner';

  insert into memberships (user_id, workspace_id, role)
  select new.id, i.workspace_id, i.role::text::workspace_role
  from invitations i
  where lower(i.email) = lower(new.email)
    and i.role <> 'owner'
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (user_id, workspace_id) do update set role = excluded.role;

  update invitations
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now();

  /* Les inscriptions Academy en attente pour cette adresse. `revoked` est
     exclu : un accès retiré ne se rouvre pas parce que la personne se
     recrée un compte. La fiche du profil se complète au passage si
     l'invitation portait un prénom et un nom, sans jamais écraser ce que la
     personne a déjà renseigné elle-même. */
  update academy_enrollments
  set user_id = new.id,
      status = 'active',
      activated_at = coalesce(activated_at, now())
  where lower(email) = lower(new.email)
    and status = 'invited';

  update profiles p
  set first_name = coalesce(p.first_name, e.first_name),
      last_name = coalesce(p.last_name, e.last_name),
      full_name = coalesce(
        p.full_name,
        nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '')
      )
  from academy_enrollments e
  where p.id = new.id
    and e.user_id = new.id
    and (e.first_name is not null or e.last_name is not null);

  return new;
end;
$$;

-- --- Rattrapage : les fiches nées vides alors que l'invitation nommait -------

update profiles p
set first_name = coalesce(p.first_name, i.first_name),
    last_name = coalesce(p.last_name, i.last_name),
    full_name = coalesce(
      p.full_name,
      nullif(trim(coalesce(i.first_name, '') || ' ' || coalesce(i.last_name, '')), '')
    )
from (
  select distinct on (lower(email)) lower(email) as email, first_name, last_name
  from invitations
  where first_name is not null or last_name is not null
  order by lower(email), created_at desc
) i
where lower(p.email) = i.email
  and (p.first_name is null or p.last_name is null or p.full_name is null);

-- --- Photo de profil : 20 Mo ---------------------------------------------------

update storage.buckets
set file_size_limit = 20 * 1024 * 1024
where id = 'member-avatars';
