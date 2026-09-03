-- ===========================================================================
-- Academy — plusieurs formations, et des élèves qui ne voient qu'elles
--
-- Trois changements, un seul thème : l'Academy cesse d'être une formation
-- d'équipe pour devenir une plateforme de formations vendues.
--
-- 1. `academy_modules.cover_url` — la miniature d'introduction du module.
--    Même convention que `academy_courses.cover_url` : un **chemin** dans le
--    bucket `academy-assets`, ou une URL http(s) externe. Jamais une URL
--    signée, qui serait périmée en une heure.
--
-- 2. `academy_enrollments` — l'inscription d'une personne à **une** formation.
--    C'est la nouveauté structurante : jusqu'ici, lire l'Academy supposait une
--    ligne dans `organization_members`, c'est-à-dire un accès à l'entreprise
--    entière. Une acheteuse de formation n'a rien à faire dans l'organisation :
--    elle est inscrite à un cours, et à rien d'autre. L'inscription porte
--    l'adresse email **avant** que le compte existe — même mécanique que
--    `invitations` (0001) : la fiche se remplit à l'invitation, le compte se
--    raccroche à la première connexion.
--
-- 3. `app.handle_new_user()` gagne l'étape qui raccroche les inscriptions en
--    attente au compte qui vient de naître. Elle est ajoutée **après** les
--    invitations d'espace : une même adresse peut être les deux, l'ordre ne
--    change rien, mais la lecture du trigger suit alors la chronologie du
--    produit.
-- ===========================================================================

-- --- Miniature d'un module -------------------------------------------------

alter table academy_modules add column if not exists cover_url text;

-- --- Inscriptions ----------------------------------------------------------

/* `invited` : la personne est attendue, son compte n'existe pas encore ou ne
   s'est jamais connecté. `active` : elle lit la formation. `revoked` : l'accès
   est retiré sans effacer la ligne — on garde la trace de qui a acheté quoi,
   et une réactivation ne repart pas de zéro. */
do $$
begin
  if not exists (select 1 from pg_type where typname = 'academy_enrollment_status') then
    create type academy_enrollment_status as enum ('invited', 'active', 'revoked');
  end if;
end
$$;

create table if not exists academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  /* Dénormalisé depuis le cours, comme partout ailleurs : la politique RLS
     tranche sans jointure. */
  org_id uuid not null references organizations (id) on delete cascade,
  course_id uuid not null references academy_courses (id) on delete cascade,
  /* L'adresse est la clé fonctionnelle : elle existe avant le compte. */
  email text not null,
  /* Nul tant que la personne ne s'est pas connectée une première fois. */
  user_id uuid references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  status academy_enrollment_status not null default 'invited',
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* Une seule inscription par adresse et par formation. L'index est sur
   `lower(email)` et non sur la colonne : « Marie@… » et « marie@… » sont la
   même personne, et un `unique (course_id, email)` nu laisserait passer les
   deux — c'est le piège des contraintes sur du texte libre. */
create unique index if not exists academy_enrollments_course_email_idx
  on academy_enrollments (course_id, lower(email));

create index if not exists academy_enrollments_user_idx
  on academy_enrollments (user_id) where user_id is not null;

create index if not exists academy_enrollments_org_idx
  on academy_enrollments (org_id);

drop trigger if exists academy_enrollments_touch on academy_enrollments;
create trigger academy_enrollments_touch
  before update on academy_enrollments
  for each row execute function app.touch_updated_at();

-- --- Raccrochage à la première connexion -----------------------------------

/* Réécriture complète de `app.handle_new_user()` : les quatre étapes de 0001
   à l'identique, plus l'étape des inscriptions Academy. Une élève qui se
   connecte pour la première fois n'obtient **aucune** ligne dans
   `organization_members` ni dans `memberships` — c'est exactement le point :
   elle entre dans la formation, pas dans l'entreprise. */
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
