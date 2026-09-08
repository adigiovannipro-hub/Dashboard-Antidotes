-- ===========================================================================
-- Pôle « Antidotes », phase 4 — l'inbound : Row Level Security et stockage
--
-- Même posture que le reste du pôle : owner-only par `app.is_org_owner()`.
-- Le radar, le corpus et le studio sont la communication de l'agence
-- elle-même — aucun client, aucun contributeur n'y a rien à lire.
--
-- Le bucket des visuels générés est privé, rangé par organisation (premier
-- segment du chemin), comme les logos d'espace : l'URL se signe à la lecture.
-- ===========================================================================

alter table antidotes_radar_accounts enable row level security;
alter table antidotes_radar_topics   enable row level security;

create policy antidotes_radar_accounts_read on antidotes_radar_accounts
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_radar_accounts_write on antidotes_radar_accounts
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_radar_accounts_update on antidotes_radar_accounts
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_radar_accounts_delete on antidotes_radar_accounts
  for delete to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_radar_topics_read on antidotes_radar_topics
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_radar_topics_write on antidotes_radar_topics
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_radar_topics_update on antidotes_radar_topics
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_radar_topics_delete on antidotes_radar_topics
  for delete to authenticated
  using (app.is_org_owner(org_id));

revoke all on antidotes_radar_accounts, antidotes_radar_topics from anon;

-- --- Le bucket des visuels générés ----------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'antidotes-visuals',
  'antidotes-visuals',
  false,
  10 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists antidotes_visuals_select on storage.objects;
create policy antidotes_visuals_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'antidotes-visuals'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

drop policy if exists antidotes_visuals_insert on storage.objects;
create policy antidotes_visuals_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'antidotes-visuals'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

drop policy if exists antidotes_visuals_update on storage.objects;
create policy antidotes_visuals_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'antidotes-visuals'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  )
  with check (
    bucket_id = 'antidotes-visuals'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

drop policy if exists antidotes_visuals_delete on storage.objects;
create policy antidotes_visuals_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'antidotes-visuals'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );
