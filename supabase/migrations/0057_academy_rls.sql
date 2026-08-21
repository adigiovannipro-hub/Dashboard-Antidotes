-- ===========================================================================
-- Antidotes Academy — Row Level Security
--
-- Deux niveaux, comme Reçus et Finance : les **membres** de l'organisation
-- lisent le contenu **publié** ; l'**owner** écrit tout et voit aussi les
-- brouillons. Un client d'espace n'a aucune ligne dans `organization_members`
-- — pour lui, l'Academy n'existe pas : ni lecture, ni écriture, et la page
-- répond 404, pas 403.
--
-- La subtilité du « publié » : une leçon publiée dans un module en brouillon
-- ne doit pas se lire par l'API REST alors que l'interface ne la lie nulle
-- part. La politique de lecture remonte donc la chaîne — leçon publiée ET
-- module publié ET cours publié — sauf pour l'owner, qui voit tout.
--
-- La progression et les notes sont personnelles : chacun lit et écrit **ses**
-- lignes, jamais celles d'un autre membre — et toujours à condition d'être
-- membre de l'organisation.
-- ===========================================================================

-- --- Activation ------------------------------------------------------------

alter table academy_courses  enable row level security;
alter table academy_modules  enable row level security;
alter table academy_lessons  enable row level security;
alter table academy_progress enable row level security;
alter table academy_notes    enable row level security;

-- --- Contenu : lecture membre (publié), écriture owner ----------------------

create policy academy_courses_read on academy_courses
  for select to authenticated
  using (
    org_id in (select app.member_org_ids())
    and (published or app.is_org_owner(org_id))
  );

create policy academy_courses_write on academy_courses
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy academy_modules_read on academy_modules
  for select to authenticated
  using (
    org_id in (select app.member_org_ids())
    and (
      app.is_org_owner(org_id)
      or (
        published
        and exists (
          select 1 from academy_courses c
          where c.id = academy_modules.course_id and c.published
        )
      )
    )
  );

create policy academy_modules_write on academy_modules
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy academy_lessons_read on academy_lessons
  for select to authenticated
  using (
    org_id in (select app.member_org_ids())
    and (
      app.is_org_owner(org_id)
      or (
        published
        and exists (
          select 1 from academy_modules m
          where m.id = academy_lessons.module_id and m.published
        )
        and exists (
          select 1 from academy_courses c
          where c.id = academy_lessons.course_id and c.published
        )
      )
    )
  );

create policy academy_lessons_write on academy_lessons
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Progression et notes : chacun chez soi ---------------------------------

create policy academy_progress_read on academy_progress
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_progress_write on academy_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_progress_update on academy_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_progress_delete on academy_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy academy_notes_read on academy_notes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_notes_write on academy_notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_notes_update on academy_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.member_org_ids())
  );

create policy academy_notes_delete on academy_notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- --- Stockage ---------------------------------------------------------------

/* Deux buckets, privés comme les sept autres — un bucket public expose la
   liste de ses fichiers à qui devine son nom, et l'uniformité vaut mieux
   qu'une exception à expliquer. Les fichiers sont rangés sous
   `<org_id>/...` : le premier dossier du chemin dit à qui ils appartiennent.

   `academy-videos` : les vidéos de leçons. 50 Mo par fichier — c'est le
   plafond du projet Supabase Free ; au-delà, la vidéo vit chez YouTube ou
   Vimeo en non répertorié, et `video_provider` le dit.

   `academy-assets` : couvertures et vignettes. */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-videos',
  'academy-videos',
  false,
  52428800, -- 50 Mo
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-assets',
  'academy-assets',
  false,
  5242880, -- 5 Mo : une couverture, pas un master.
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

/* Les politiques de `storage.objects` survivent au `drop table` du module :
   elles appartiennent au stockage. On les retire d'abord, sinon une
   réapplication échouerait sur « la politique existe déjà ». */
drop policy if exists academy_videos_insert on storage.objects;
drop policy if exists academy_videos_update on storage.objects;
drop policy if exists academy_videos_delete on storage.objects;
drop policy if exists academy_assets_insert on storage.objects;
drop policy if exists academy_assets_update on storage.objects;
drop policy if exists academy_assets_delete on storage.objects;

/* Écriture : l'owner seul — c'est lui qui téléverse vidéos et couvertures
   depuis le back-office, par URL d'envoi signée, droit au bucket.

   Aucune politique de lecture : la vidéo est servie par URL signée générée
   côté serveur (clé de service) **après** vérification du droit de lecture de
   la leçon — même doctrine que les justificatifs et les logos de marchands.
   L'absence de politique est la politique. */
create policy academy_videos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academy-videos'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

create policy academy_videos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academy-videos'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  )
  with check (
    bucket_id = 'academy-videos'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

create policy academy_videos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academy-videos'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

create policy academy_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

create policy academy_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  )
  with check (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

create policy academy_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] in (
      select o.id::text from organizations o where app.is_org_owner(o.id)
    )
  );

-- --- Vérification ----------------------------------------------------------

/* Le `revoke all` de la migration 0002 ne couvre que les tables qui
   existaient à cet instant : chaque module révoque nominativement les
   siennes. */
revoke all on academy_courses, academy_modules, academy_lessons,
  academy_progress, academy_notes from anon;
