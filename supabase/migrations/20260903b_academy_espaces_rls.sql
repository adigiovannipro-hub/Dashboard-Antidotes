-- ===========================================================================
-- Academy — RLS des inscriptions, et réécriture des lectures de contenu
--
-- La règle de 0057 était : « membre de l'organisation ⇒ lit le publié ». Elle
-- devient : « membre de l'organisation **ou** inscrit à cette formation ⇒ lit
-- le publié de cette formation ». La différence tient dans le « de cette
-- formation » : une élève inscrite à l'UGC ne doit pas lire les modules de
-- l'autre cours, alors que les deux vivent dans la même organisation. La
-- chaîne du publié — leçon **et** module **et** cours — ne bouge pas.
--
-- L'owner continue de tout voir, brouillons compris ; c'est lui l'éditeur.
--
-- Les politiques de 0057 sont remplacées et non complétées : deux politiques
-- `select` sur une même table s'additionnent en OU, et empiler une seconde
-- règle aurait laissé l'ancienne en place, illisible. On les supprime
-- nominativement avant de les recréer.
-- ===========================================================================

-- --- Fonctions d'aide ------------------------------------------------------

/* Les formations auxquelles la personne est inscrite et active. `security
   definer` avec `search_path` figé, comme les quatorze autres : c'est ce qui
   empêche un détournement par schéma. */
create or replace function app.academy_course_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.course_id
  from academy_enrollments e
  where e.user_id = auth.uid()
    and e.status = 'active';
$$;

/* Les organisations où la personne a le droit d'écrire sa progression et ses
   notes : celles dont elle est membre, plus celles où elle suit une formation.
   Une élève n'est membre d'aucune organisation — sans cette union, elle ne
   pourrait pas cocher une leçon comme terminée. */
create or replace function app.academy_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.org_id
  from organization_members om
  where om.user_id = auth.uid()
  union
  select e.org_id
  from academy_enrollments e
  where e.user_id = auth.uid()
    and e.status = 'active';
$$;

grant execute on function
  app.academy_course_ids(),
  app.academy_org_ids()
to authenticated;

-- --- Contenu : lecture membre ou inscrite, écriture owner -------------------

drop policy if exists academy_courses_read on academy_courses;
drop policy if exists academy_modules_read on academy_modules;
drop policy if exists academy_lessons_read on academy_lessons;

create policy academy_courses_read on academy_courses
  for select to authenticated
  using (
    app.is_org_owner(org_id)
    or (
      published
      and (
        org_id in (select app.member_org_ids())
        or id in (select app.academy_course_ids())
      )
    )
  );

create policy academy_modules_read on academy_modules
  for select to authenticated
  using (
    app.is_org_owner(org_id)
    or (
      published
      and (
        org_id in (select app.member_org_ids())
        or course_id in (select app.academy_course_ids())
      )
      and exists (
        select 1 from academy_courses c
        where c.id = academy_modules.course_id and c.published
      )
    )
  );

create policy academy_lessons_read on academy_lessons
  for select to authenticated
  using (
    app.is_org_owner(org_id)
    or (
      published
      and (
        org_id in (select app.member_org_ids())
        or course_id in (select app.academy_course_ids())
      )
      and exists (
        select 1 from academy_modules m
        where m.id = academy_lessons.module_id and m.published
      )
      and exists (
        select 1 from academy_courses c
        where c.id = academy_lessons.course_id and c.published
      )
    )
  );

-- --- Progression et notes : chacun chez soi, membre ou élève ----------------

drop policy if exists academy_progress_read on academy_progress;
drop policy if exists academy_progress_write on academy_progress;
drop policy if exists academy_progress_update on academy_progress;
drop policy if exists academy_notes_read on academy_notes;
drop policy if exists academy_notes_write on academy_notes;
drop policy if exists academy_notes_update on academy_notes;

create policy academy_progress_read on academy_progress
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

create policy academy_progress_write on academy_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

create policy academy_progress_update on academy_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

create policy academy_notes_read on academy_notes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

create policy academy_notes_write on academy_notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

create policy academy_notes_update on academy_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and org_id in (select app.academy_org_ids())
  );

-- --- Inscriptions -----------------------------------------------------------

alter table academy_enrollments enable row level security;

/* Une élève lit **sa** ligne : c'est elle qui lui dit à quoi elle est
   inscrite. Elle ne voit jamais la liste des autres inscrites — un fichier
   clients ne se distribue pas avec la formation. */
create policy academy_enrollments_read on academy_enrollments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or app.is_org_owner(org_id)
  );

create policy academy_enrollments_write on academy_enrollments
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Vérification -----------------------------------------------------------

revoke all on academy_enrollments from anon;
