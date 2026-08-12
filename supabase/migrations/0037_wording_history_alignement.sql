-- Réconciliation de `wording_history` avec la table réellement en base.
--
-- Deux branches parallèles ont décrit la même table. Celle des cartes client
-- a été appliquée la première à la vraie base, avec `hook`, `org_id`,
-- `full_wording`, `platform` et `published_at` ; mon 0032 la déclare en
-- `create table if not exists` — volontairement, pour la sécurité de fusion —
-- il n'a donc rien fait, et le code d'ici écrivait `accroche` dans une table
-- qui attend `hook`. Trois runs d'isolation ont échoué dessus avant que le
-- diagnostic de schéma ne le montre : `PGRST204` accusait une colonne
-- absente, et elle l'était bel et bien.
--
-- La table vivante fait foi. Cette migration ne touche donc qu'une base née
-- des seules migrations d'ici : elle est un **no-op complet** sur la vraie
-- base, où `hook` et `org_id` existent déjà.

-- Le nom de colonne, si et seulement si l'ancien est encore là.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wording_history'
      and column_name = 'accroche'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wording_history'
      and column_name = 'hook'
  ) then
    alter table wording_history rename column accroche to hook;
  end if;
end
$$;

-- La colonne de tenant de la génération. Ajoutée nullable puis remplie
-- depuis l'espace : un `not null` sec échouerait sur une table déjà peuplée.
alter table wording_history add column if not exists org_id uuid;

update wording_history h
   set org_id = w.org_id
  from workspaces w
 where w.id = h.workspace_id
   and h.org_id is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wording_history'
      and column_name = 'org_id' and is_nullable = 'YES'
  ) and not exists (select 1 from wording_history where org_id is null) then
    alter table wording_history alter column org_id set not null;
    alter table wording_history
      add constraint wording_history_org_id_fkey
      foreign key (org_id) references organizations (id) on delete cascade;
  end if;
end
$$;

-- Les colonnes de la génération, que le Contexte ne remplit pas mais que la
-- table vivante porte : les déclarer ici évite qu'une base neuve diverge.
-- `platform` reste hors de ce fichier : c'est un enum de l'autre branche, et
-- le recréer ici en ferait deux définitions concurrentes.
alter table wording_history add column if not exists full_wording text;
alter table wording_history add column if not exists published_at date;
