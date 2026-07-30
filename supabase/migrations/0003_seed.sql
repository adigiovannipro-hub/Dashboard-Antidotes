-- ===========================================================================
-- Antidotes — amorçage
--
-- Crée l'organisation, ses trois espaces initiaux, et l'invitation `owner`.
-- Le compte n'existe pas encore : c'est la première connexion par magic link
-- à cette adresse qui déclenchera l'attribution du rôle, via le trigger
-- `app.handle_new_user` posé en 0001.
--
-- Idempotent : réexécutable sans effet de bord.
-- ===========================================================================

insert into organizations (name, slug)
values ('Antidotes', 'antidotes')
on conflict (slug) do nothing;

with org as (select id from organizations where slug = 'antidotes')
insert into workspaces (org_id, type, slug, name, accent_color)
select org.id, v.type::workspace_type, v.slug, v.name, v.accent
from org,
  (values
    ('personal', 'perso',   'Perso',    null),
    ('business', 'antidotes', 'Antidotes', null),
    ('client',   'bondet',  'Bondet',   '#8FD14F')
  ) as v(type, slug, name, accent)
on conflict (org_id, slug) do nothing;

-- Dashboard Meta de Bondet, premier livrable de la plateforme.
with ws as (
  select w.id
  from workspaces w
  join organizations o on o.id = w.org_id
  where o.slug = 'antidotes' and w.slug = 'bondet'
)
insert into dashboards (workspace_id, slug, name, position)
select ws.id, 'meta', 'Meta', 0 from ws
on conflict (workspace_id, slug) do nothing;

-- Invitation du propriétaire de la plateforme.
with org as (select id from organizations where slug = 'antidotes')
insert into invitations (email, org_id, workspace_id, role, expires_at)
select 'a.digiovanni.pro@gmail.com', org.id, null, 'owner', now() + interval '10 years'
from org
where not exists (
  select 1 from invitations i
  where lower(i.email) = 'a.digiovanni.pro@gmail.com' and i.role = 'owner'
);
