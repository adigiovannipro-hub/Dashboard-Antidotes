-- Droits d'un partenaire, page par page, à l'intérieur d'un espace.
--
-- L'adhésion (`memberships`) dit à quel espace on a accès ; cette table dit
-- quelles pages de cet espace on voit. Un partenaire invité pour relire le
-- planning n'a pas à découvrir le reporting du client.
--
-- La clé est l'**adresse**, pas l'utilisateur : les droits se choisissent au
-- moment de l'invitation, quand le compte n'existe pas encore. Le même choix
-- vaut donc avant et après la première connexion, sans reprise à faire.
--
-- Absence de ligne = page visible. Un partenaire déjà en place ne perd rien
-- le jour où la table apparaît, et l'invitation reste utilisable sans passer
-- par la matrice.
create table if not exists workspace_page_grants (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  -- `planning`, ou le slug d'un tableau de bord. La page Contexte n'y figure
  -- jamais : elle est réservée à l'owner et ne se partage pas.
  page_key text not null,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id, email, page_key),
  constraint workspace_page_grants_email_normalise check (
    email = lower(email) and length(email) > 3
  )
);

-- La lecture d'un membre se fait par adresse ; la clé primaire n'indexe que
-- le couple espace + adresse dans cet ordre.
create index if not exists workspace_page_grants_email_idx
  on workspace_page_grants (email);

-- L'adresse du visiteur, en minuscules.
--
-- `security definer` comme les autres helpers du dépôt, et pour la même
-- raison : la politique doit pouvoir lire `profiles` sans dépendre de la RLS
-- de `profiles`. `search_path` figé, sans quoi un schéma temporaire pourrait
-- détourner la résolution du nom de table.
create or replace function app.current_email()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(email) from profiles where id = auth.uid();
$$;

grant execute on function app.current_email() to authenticated;
