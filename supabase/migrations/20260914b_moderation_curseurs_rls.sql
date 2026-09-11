-- ===========================================================================
-- RLS des curseurs de publication
--
-- Même découpage que le reste du module : lecture pour qui atteint le client,
-- écriture pour qui peut répondre chez lui. Les deux helpers existent depuis
-- 0005 et sont `security definer` avec un `search_path` figé.
--
-- Le `revoke` est nominatif : celui de 0002 ne couvre que les tables qui
-- existaient à cet instant.
-- ===========================================================================

alter table moderation_post_cursors enable row level security;

revoke all on moderation_post_cursors from anon;

create policy moderation_post_cursors_select on moderation_post_cursors
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy moderation_post_cursors_write on moderation_post_cursors
  for all to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));
