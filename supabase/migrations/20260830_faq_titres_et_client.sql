-- ===========================================================================
-- 20260830 — La FAQ gagne un titre, une réponse TikTok, et s'ouvre au client
--
-- Préfixe horodaté et non plus NNNN : cinq numéros sont déjà en double sur
-- main et deux renumérotations ont eu lieu le 28/08 — chaque conversation
-- parallèle qui réserve « le prochain numéro » recrée la collision. Le tri du
-- runner est lexicographique : « 2026… » passe après « 0065 », l'ordre tient.
--
-- Trois choses ici :
--
--   1. Les boards Monday « FAQ MODÉRATION » portent un **titre** par entrée
--      (« BON CADEAU REPORT ») et une **réponse TikTok** plus courte : les
--      colonnes arrivent pour les accueillir à l'import.
--   2. Le client valide ses éléments de langage : `client_review` porte son
--      verdict (en attente / validé / refusé), posé par une action serveur à
--      garde applicative — jamais en écriture directe.
--   3. La lecture s'ouvre aux membres de l'espace rattaché — client compris.
--      C'est la seule table de la Modération qui s'ouvre : la FAQ est le
--      contrat de parole du client, l'inbox reste un outil interne.
-- ===========================================================================

alter table faq_entries add column if not exists title text;
alter table faq_entries add column if not exists answer_tiktok text;

do $$ begin
  create type faq_client_review as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

alter table faq_entries add column if not exists client_review faq_client_review;
alter table faq_entries add column if not exists client_reviewed_at timestamptz;

/* Les clients de modération dont l'espace rattaché est lisible par
   l'utilisateur — client d'espace compris, contrairement à
   `app.moderation_client_ids()` qui l'exclut : la FAQ est la seule porte
   ouverte au rôle client dans ce module. */
create or replace function app.faq_readable_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mc.id
  from moderation_clients mc
  join memberships m on m.workspace_id = mc.workspace_id
  where mc.workspace_id is not null
    and m.user_id = auth.uid();
$$;

drop policy if exists faq_entries_select_espace on faq_entries;
create policy faq_entries_select_espace on faq_entries
  for select to authenticated
  using (client_id in (select app.faq_readable_client_ids()));

drop policy if exists faq_categories_select_espace on faq_categories;
create policy faq_categories_select_espace on faq_categories
  for select to authenticated
  using (client_id in (select app.faq_readable_client_ids()));

/* La ligne du client de modération elle-même : sans elle, l'espace ne sait
   pas qu'un onglet FAQ existe. Le ton et les réglages qu'elle porte sont ceux
   du client — rien d'un autre client n'y passe. */
drop policy if exists moderation_clients_select_espace on moderation_clients;
create policy moderation_clients_select_espace on moderation_clients
  for select to authenticated
  using (id in (select app.faq_readable_client_ids()));
