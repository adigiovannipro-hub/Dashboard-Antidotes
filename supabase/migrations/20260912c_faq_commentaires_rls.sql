-- ===========================================================================
-- RLS du fil de discussion de la FAQ
--
-- Deux portes, réunies : `app.faq_readable_client_ids()` (20260830) ouvre le
-- fil aux membres de l'espace rattaché — **client compris**, c'est le seul
-- endroit du module Modération où le rôle client écrit — et
-- `app.moderation_client_ids()` (0005) le rend à l'agence, qui n'a pas de
-- ligne dans `memberships` et n'y verrait donc rien. Un fil où l'agence pose
-- la question mais ne lit pas la réponse n'aurait aucun sens.
--
-- Ni `update` ni `delete`, pour personne : un fil de discussion ne se réécrit
-- pas. Ce qui a été demandé et autorisé doit rester lisible tel quel, c'est
-- tout l'intérêt d'en garder la trace.
-- ===========================================================================

alter table faq_comments enable row level security;

drop policy if exists faq_comments_select on faq_comments;
create policy faq_comments_select on faq_comments
  for select to authenticated
  using (
    client_id in (select app.faq_readable_client_ids())
    or client_id in (select app.moderation_client_ids())
  );

drop policy if exists faq_comments_insert on faq_comments;
create policy faq_comments_insert on faq_comments
  for insert to authenticated
  with check (
    client_id in (select app.faq_readable_client_ids())
    or client_id in (select app.moderation_client_ids())
  );

/* Le `revoke all on all tables` de 0002 ne couvre que les tables qui
   existaient alors : chaque migration reprend le sien, nominatif. */
revoke all on faq_comments from anon;

notify pgrst, 'reload schema';
