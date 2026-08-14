-- ===========================================================================
-- Les comptes sociaux : un inventaire d'agence, une affectation par client
--
-- 0043 rangeait les comptes **par espace**. Un seul aller-retour Meta rapporte
-- pourtant tout ce que le login de l'agence atteint — cinq comptes Instagram
-- au premier essai — et tous atterrissaient sur l'espace d'où l'on était
-- parti. Deux conséquences, l'une gênante, l'autre grave :
--
--   * rien ne disait sur quel compte publier : le code aurait pris le premier ;
--   * un partenaire de Bondet lisait le nom des comptes des autres clients.
--
-- D'où la séparation en deux temps, qui suit la réalité du métier :
--
--   `social_accounts`            ce que le login de l'agence atteint  (org)
--   `workspace_social_accounts`  ce que ce client utilise             (espace)
--
-- Et les jetons partent dans leur propre table : sans cela, ouvrir la lecture
-- de la vitrine du profil à un membre de l'espace — ce dont la
-- prévisualisation du feed a besoin — lui ouvrirait la ligne entière, jeton
-- compris. La RLS filtre des lignes, pas des colonnes.
--
-- Aucune affectation n'est devinée : un compte nommé « Lunettes BONDET » a
-- beau ressembler à l'espace Bondet, l'associer d'office serait inventer une
-- donnée. Les listes s'ouvrent vides, et l'agence choisit.
-- ===========================================================================

-- --- 1. L'inventaire remonte à l'organisation --------------------------------

-- Les politiques de 0043 nomment `workspace_id` : tant qu'elles vivent, la
-- colonne ne se supprime pas. Elles tombent d'abord, les nouvelles sont
-- posées en fin de fichier — la table reste sans politique le temps de la
-- transaction, donc fermée, jamais ouverte.
drop policy if exists social_accounts_select on social_accounts;
drop policy if exists social_accounts_write on social_accounts;

alter table social_accounts
  add column if not exists org_id uuid references organizations (id) on delete cascade;

update social_accounts sa
   set org_id = w.org_id
  from workspaces w
 where w.id = sa.workspace_id
   and sa.org_id is null;

-- Un compte dont l'espace a disparu n'a plus de propriétaire connu : il n'y a
-- rien à en tirer, et le laisser empêcherait le `not null`.
delete from social_accounts where org_id is null;

alter table social_accounts alter column org_id set not null;

alter table social_accounts
  drop constraint if exists social_accounts_workspace_id_kind_external_id_key;
drop index if exists social_accounts_workspace_idx;
alter table social_accounts drop column if exists workspace_id;

-- Le même compte ne s'inventorie qu'une fois par organisation. C'est cette
-- contrainte qui rend le branchement rejouable : reconnecter Meta met à jour
-- les lignes au lieu de les dupliquer.
alter table social_accounts
  add constraint social_accounts_org_kind_external_key
  unique (org_id, kind, external_id);

create index social_accounts_org_idx on social_accounts (org_id, kind);

-- --- 2. Les jetons dans leur propre table ------------------------------------

create table social_account_secrets (
  account_id uuid primary key references social_accounts (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,

  /* Chiffré par `CREDENTIALS_ENCRYPTION_KEY`, jamais en clair. Pour un compte
     Instagram, c'est le jeton de **sa Page** : c'est lui qui publie. */
  credentials_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into social_account_secrets (account_id, org_id, credentials_encrypted, token_expires_at, scopes)
select id, org_id, credentials_encrypted, token_expires_at, scopes
  from social_accounts;

alter table social_accounts
  drop column if exists credentials_encrypted,
  drop column if exists token_expires_at,
  drop column if exists scopes;

create index social_account_secrets_org_idx on social_account_secrets (org_id);

-- --- 3. L'affectation, un compte par réseau et par client --------------------

create table workspace_social_accounts (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind social_account_kind not null,
  account_id uuid not null references social_accounts (id) on delete cascade,
  /* Dénormalisé comme partout : la politique tranche sans jointure. */
  org_id uuid not null references organizations (id) on delete cascade,
  assigned_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* **Un seul compte par réseau et par client.** C'est cette clé qui rend la
     question « où publie-t-on ? » sans ambiguïté : il n'y a jamais deux
     réponses, et jamais de « premier de la liste ». */
  primary key (workspace_id, kind)
);

create index workspace_social_accounts_account_idx
  on workspace_social_accounts (account_id);
create index workspace_social_accounts_org_idx
  on workspace_social_accounts (org_id);

-- --- 4. RLS ------------------------------------------------------------------

alter table social_account_secrets enable row level security;
alter table workspace_social_accounts enable row level security;

revoke all on social_account_secrets from anon;
revoke all on workspace_social_accounts from anon;

-- L'inventaire : l'agence le voit en entier. Un membre d'espace ne voit que
-- les comptes affectés à un espace qu'il atteint — de quoi afficher l'en-tête
-- du feed, rien de plus.
create policy social_accounts_select on social_accounts
  for select to authenticated
  using (
    app.is_org_owner(org_id)
    or exists (
      select 1
        from workspace_social_accounts link
       where link.account_id = social_accounts.id
         and link.workspace_id in (select app.accessible_workspace_ids())
    )
  );

create policy social_accounts_write on social_accounts
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- Les jetons ne sortent jamais de l'agence.
create policy social_account_secrets_all on social_account_secrets
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- L'affectation se lit chez le client — il a le droit de savoir sur quel
-- compte son planning publiera — et ne se modifie que par l'agence.
create policy workspace_social_accounts_select on workspace_social_accounts
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy workspace_social_accounts_write on workspace_social_accounts
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));
