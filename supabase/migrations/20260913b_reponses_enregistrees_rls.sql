-- ===========================================================================
-- RLS des réponses enregistrées
--
-- Même découpage que le reste du module : lecture pour qui atteint le client,
-- écriture pour qui peut répondre chez lui. Les deux helpers existent depuis
-- 0005 et sont `security definer` avec un `search_path` figé.
--
-- Le `revoke` est nominatif : celui de 0002 ne couvre que les tables qui
-- existaient à cet instant.
-- ===========================================================================

alter table saved_replies enable row level security;

revoke all on saved_replies from anon;

create policy saved_replies_select on saved_replies
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy saved_replies_write on saved_replies
  for all to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));
