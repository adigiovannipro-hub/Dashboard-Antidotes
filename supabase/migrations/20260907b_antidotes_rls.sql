-- ===========================================================================
-- Pôle « Antidotes » — Row Level Security
--
-- Même posture que « Mon travail » : c'est la prospection de l'agence, il n'y
-- a rien à y montrer à un membre de l'organisation, et encore moins à un
-- client. Toutes les politiques exigent le rôle owner, via `app.is_org_owner()`
-- (0013) — un client d'espace n'a aucune ligne dans `organization_members`,
-- donc pour lui ces tables n'existent pas : ni lecture, ni écriture, ni 403.
--
-- Une exception voulue : `antidotes_interactions` est append-only. Ni update
-- ni delete, même pour l'owner — le journal ne se réécrit pas, il s'allonge.
--
-- Les crons des phases 2 à 4 écriront en `service_role`, hors de ces
-- politiques : un ordonnanceur n'a pas d'`auth.uid()`.
-- ===========================================================================

-- --- Activation ------------------------------------------------------------

alter table antidotes_campaigns            enable row level security;
alter table antidotes_prospects            enable row level security;
alter table antidotes_contacts             enable row level security;
alter table antidotes_interactions         enable row level security;
alter table antidotes_sequences            enable row level security;
alter table antidotes_sequence_steps       enable row level security;
alter table antidotes_sequence_enrollments enable row level security;
alter table antidotes_reference_posts      enable row level security;
alter table antidotes_generated_posts      enable row level security;
alter table antidotes_case_studies         enable row level security;

-- --- Campagnes -------------------------------------------------------------

create policy antidotes_campaigns_read on antidotes_campaigns
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_campaigns_write on antidotes_campaigns
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_campaigns_update on antidotes_campaigns
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_campaigns_delete on antidotes_campaigns
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Prospects -------------------------------------------------------------

create policy antidotes_prospects_read on antidotes_prospects
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_prospects_write on antidotes_prospects
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_prospects_update on antidotes_prospects
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_prospects_delete on antidotes_prospects
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Contacts --------------------------------------------------------------

create policy antidotes_contacts_read on antidotes_contacts
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_contacts_write on antidotes_contacts
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_contacts_update on antidotes_contacts
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_contacts_delete on antidotes_contacts
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Journal : lecture et ajout, jamais de retouche -------------------------

create policy antidotes_interactions_read on antidotes_interactions
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_interactions_write on antidotes_interactions
  for insert to authenticated
  with check (app.is_org_owner(org_id));

-- --- Séquences -------------------------------------------------------------

create policy antidotes_sequences_read on antidotes_sequences
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_sequences_write on antidotes_sequences
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_sequences_update on antidotes_sequences
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_sequences_delete on antidotes_sequences
  for delete to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_sequence_steps_read on antidotes_sequence_steps
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_sequence_steps_write on antidotes_sequence_steps
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_sequence_steps_update on antidotes_sequence_steps
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_sequence_steps_delete on antidotes_sequence_steps
  for delete to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_sequence_enrollments_read on antidotes_sequence_enrollments
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_sequence_enrollments_write on antidotes_sequence_enrollments
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_sequence_enrollments_update on antidotes_sequence_enrollments
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_sequence_enrollments_delete on antidotes_sequence_enrollments
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Inbound ---------------------------------------------------------------

create policy antidotes_reference_posts_read on antidotes_reference_posts
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_reference_posts_write on antidotes_reference_posts
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_reference_posts_update on antidotes_reference_posts
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_reference_posts_delete on antidotes_reference_posts
  for delete to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_generated_posts_read on antidotes_generated_posts
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_generated_posts_write on antidotes_generated_posts
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_generated_posts_update on antidotes_generated_posts
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_generated_posts_delete on antidotes_generated_posts
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Case studies ----------------------------------------------------------

/* Les landings publiques de la phase 4 seront rendues côté serveur en
   `service_role` après contrôle de `published`, comme les pages de partage
   du Reporting : `anon` ne lit rien directement. */
create policy antidotes_case_studies_read on antidotes_case_studies
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_case_studies_write on antidotes_case_studies
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_case_studies_update on antidotes_case_studies
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_case_studies_delete on antidotes_case_studies
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Vérification ----------------------------------------------------------

/* Le `revoke all` de la migration 0002 ne couvre que les tables qui
   existaient à cet instant : chaque module révoque nominativement les
   siennes. */
revoke all on
  antidotes_campaigns,
  antidotes_prospects,
  antidotes_contacts,
  antidotes_interactions,
  antidotes_sequences,
  antidotes_sequence_steps,
  antidotes_sequence_enrollments,
  antidotes_reference_posts,
  antidotes_generated_posts,
  antidotes_case_studies
from anon;
