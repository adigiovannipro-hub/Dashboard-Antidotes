-- ===========================================================================
-- Pôle « Antidotes » (outbound + inbound) — schéma
--
-- Le développement commercial de l'agence elle-même : sourcer des sociétés
-- comparables aux clients perdus, trouver le décisionnaire, vérifier son
-- adresse, le contacter — et, côté inbound, veiller les comptes de la niche
-- pour produire des posts LinkedIn qui sonnent comme les miens.
--
-- Tout le schéma est posé d'un bloc, y compris ce que seules les phases 2 à
-- 4 exploiteront (campagnes, séquences, corpus, case studies) : une migration
-- réfléchie vaut mieux que quatre qui se contredisent. Seul le pipeline
-- (`antidotes_prospects`, `antidotes_contacts`, `antidotes_interactions`) a
-- une interface aujourd'hui.
--
-- La table centrale est `antidotes_prospects`, alimentée par l'outbound ET
-- l'inbound : un prospect sourcé sur Google Maps et un lead arrivé par DM
-- LinkedIn atterrissent dans le même pipeline. C'est ce partage qui justifie
-- de construire plutôt que d'assembler quatre SaaS — il n'y aura jamais deux
-- systèmes de leads.
--
-- Préfixe `antidotes_` sur les tables et les enums, comme `planning_*` ou
-- `finance_*` : `campaigns`, `contacts` ou `interactions` nus entreraient en
-- collision avec le vocabulaire du Reporting (les campagnes Meta) et avec ce
-- que les prochains modules voudront nommer.
--
-- Côté tenant, le pôle rejoint la génération Reçus / Finance / Mon travail :
-- rattaché à `org_id`, owner-only de bout en bout — un client d'espace n'a
-- rien à voir avec la prospection de l'agence.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* Le moteur de sourcing d'une campagne : lieux physiques (Google Maps via
   Apify) ou boutiques en ligne. Choisi à la création, il fixe la forme de
   `source_params`. */
create type antidotes_campaign_engine as enum ('maps', 'ecommerce');

/* D'où vient le prospect. `manual` est la saisie depuis l'écran ; `inbound`
   un lead arrivé de lui-même (DM, commentaire, formulaire) — phase 4. */
create type antidotes_prospect_source as enum (
  'maps',
  'shopify',
  'linkedin',
  'inbound',
  'manual'
);

/* Le cycle de vente, dans l'ordre des colonnes du kanban. `no_contact_found`
   sort du flux : sans décisionnaire nommé, on n'écrit pas à `contact@`. */
create type antidotes_prospect_status as enum (
  'to_qualify',
  'qualified',
  'no_contact_found',
  'contacted',
  'replied',
  'meeting',
  'won',
  'lost'
);

/* Le verdict de la vérification d'adresse. C'est lui seul qui décide du
   canal : `valid` → séquence email, `risky` (catch-all, invérifiable) →
   piste LinkedIn manuelle, `invalid` → jamais contacté, `unknown` →
   enrichissement pas encore lancé. */
create type antidotes_email_status as enum ('unknown', 'valid', 'risky', 'invalid');

create type antidotes_seniority as enum ('founder', 'head_of', 'manager', 'other');

/* Comment le décisionnaire a été trouvé. `manual` n'était pas prévu par le
   cahier des charges : un contact ajouté à la main depuis le panneau du
   prospect en a pourtant besoin — sans valeur qui le dise, il passerait pour
   trouvé sur LinkedIn. */
create type antidotes_discovery_source as enum (
  'linkedin',
  'legal_registry',
  'website',
  'inferred',
  'manual'
);

create type antidotes_outreach_channel as enum ('email', 'linkedin', 'none');

/* Le journal. `note` et `call` se saisissent depuis l'écran ; tout le reste
   est écrit par le système (envoi, ouverture, clic, réponse). */
create type antidotes_interaction_type as enum (
  'email_sent',
  'email_open',
  'email_click',
  'reply',
  'call',
  'note',
  'linkedin_dm',
  'meeting'
);

/* `stopped_on_opt_out` s'ajoute au cahier des charges : une inscription tuée
   par une désinscription n'est ni « terminée » ni « arrêtée sur réponse », et
   la ranger sous l'un des deux mentirait sur ce qui s'est passé. */
create type antidotes_enrollment_status as enum (
  'active',
  'paused',
  'completed',
  'stopped_on_reply',
  'stopped_on_opt_out'
);

create type antidotes_generated_post_status as enum (
  'draft',
  'approved',
  'published',
  'rejected'
);

/* Les réseaux du radar et du corpus. Les Reels vivent sous `instagram`. */
create type antidotes_post_platform as enum (
  'linkedin',
  'x',
  'youtube',
  'tiktok',
  'instagram'
);

-- --- Campagnes de sourcing (phase 2) ----------------------------------------

/* Une campagne est un jeu de filtres nommé et sauvegardé. Un seul jsonb par
   famille de réglages plutôt que trente colonnes : la configuration évoluera
   vite, et une migration par curseur serait insoutenable.

     source_params  {keywords[], cities[], radius, category, country,
                     traffic_range}
     filters        {size_tolerance: 0.4, require_ads: true | false | 'bonus',
                     countries[], min_rating: 4.0,
                     scoring: {ads_active: 40, size_in_range: 30,
                               reachable_contact: 20, same_sector: 10}}
     targeting      {job_keywords[], marketing_threshold: 20,
                     discovery_sources[], enrichment_waterfall[],
                     verification_ttl_days: 180}

   Les poids de `filters.scoring` sont lus par `src/lib/antidotes/scoring.ts`,
   qui porte les valeurs par défaut : rien n'est calculé en base. */
create table antidotes_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  engine antidotes_campaign_engine not null,
  -- Le client perdu dont cette campagne cherche les concurrents : c'est lui
  -- qui décide du case study mis en avant, donc du pitch.
  reference_client text,
  source_params jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  targeting jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  -- Le taux de survie du dernier passage : sourcés → qualifiés → décideur
  -- trouvé → email valide. Sans lui, impossible de savoir quelle étape est
  -- le goulot.
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index antidotes_campaigns_org_idx on antidotes_campaigns (org_id, is_active);

create trigger antidotes_campaigns_touch
  before update on antidotes_campaigns
  for each row execute function app.touch_updated_at();

-- --- Prospects --------------------------------------------------------------

create table antidotes_prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  -- `set null` : un prospect survit à la suppression de sa campagne, il perd
  -- seulement son origine.
  campaign_id uuid references antidotes_campaigns (id) on delete set null,
  source antidotes_prospect_source not null,
  company_name text not null,
  website text,
  -- Code pays ISO 3166-1 alpha-2, en majuscules : « FR », jamais « France ».
  -- Un filtre qui compare des libellés libres se casse au premier accent.
  country text,
  city text,
  sector text,
  /* Les signaux de taille diffèrent par source — avis Google pour un lieu,
     trafic pour une boutique, effectif LinkedIn : des colonnes dédiées
     seraient nulles aux deux tiers.
       {reviews_count, employees, revenue, traffic} */
  size_signal jsonb not null default '{}'::jsonb,
  ads_active boolean not null default false,
  ads_last_seen_at timestamptz,
  status antidotes_prospect_status not null default 'to_qualify',
  -- Calculé par `src/lib/antidotes/scoring.ts` et persisté à chaque écriture
  -- sur le prospect ou ses contacts. Pas de colonne générée : la formule doit
  -- pouvoir changer sans migration.
  score integer not null default 0,
  -- Le case study dont ce prospect est le miroir : il pilote la
  -- personnalisation des séquences.
  reference_client text,
  notes text,
  /* Identifiants chez les tiers, pour l'idempotence des passages :
       {apify_run_id, linkedin_url, siren, place_id} */
  external_ids jsonb not null default '{}'::jsonb,
  -- Dernier geste de contact (envoi, réponse, appel, DM, rendez-vous),
  -- entretenu par le trigger du journal — les notes n'en sont pas un.
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antidotes_prospects_score_range check (score between 0 and 100),
  constraint antidotes_prospects_country_iso check (
    country is null or country ~ '^[A-Z]{2}$'
  )
);

-- Le kanban et le tableau lisent tout le pipeline d'une organisation, colonne
-- par colonne ; les filtres de l'écran s'appliquent ensuite en mémoire.
create index antidotes_prospects_org_status_idx
  on antidotes_prospects (org_id, status);
create index antidotes_prospects_campaign_idx
  on antidotes_prospects (campaign_id)
  where campaign_id is not null;

/* Idempotence du sourcing : un lieu Google Maps ou une société au registre ne
   rentre qu'une fois, quelle que soit la campagne qui le retrouve. Partiels —
   un prospect saisi à la main n'a aucun de ces identifiants. */
create unique index antidotes_prospects_place_id_idx
  on antidotes_prospects (org_id, (external_ids ->> 'place_id'))
  where external_ids ->> 'place_id' is not null;
create unique index antidotes_prospects_siren_idx
  on antidotes_prospects (org_id, (external_ids ->> 'siren'))
  where external_ids ->> 'siren' is not null;

create trigger antidotes_prospects_touch
  before update on antidotes_prospects
  for each row execute function app.touch_updated_at();

-- --- Contacts ---------------------------------------------------------------

/* Plusieurs décisionnaires possibles par société ; un seul est principal. */
create table antidotes_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  prospect_id uuid not null references antidotes_prospects (id) on delete cascade,
  first_name text,
  last_name text,
  role text,
  email text,
  email_status antidotes_email_status not null default 'unknown',
  linkedin_url text,
  phone text,
  is_primary boolean not null default false,
  seniority antidotes_seniority not null default 'other',
  discovery_source antidotes_discovery_source not null default 'manual',
  -- Le fournisseur qui a rendu l'adresse (dropcontact, hunter, pattern…).
  email_source text,
  email_verified_at timestamptz,
  -- Définitif et bloquant, sans exception : voir les triggers plus bas.
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  /* Dérivé du seul statut d'adresse, jamais saisi : `valid` → email,
     `risky` → LinkedIn, le reste → rien. Colonne générée plutôt qu'un calcul
     applicatif : le sourcing de la phase 2, le scoring et l'envoi de la
     phase 3 liront tous la même réponse. */
  outreach_channel antidotes_outreach_channel not null generated always as (
    case email_status
      when 'valid' then 'email'::antidotes_outreach_channel
      when 'risky' then 'linkedin'::antidotes_outreach_channel
      else 'none'::antidotes_outreach_channel
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Jamais de `contact@` ni d'`info@` : ces adresses ne convertissent pas et
  -- abîment la réputation du domaine d'envoi. Refusé ici, pas seulement au
  -- formulaire, pour qu'aucune cascade d'enrichissement ne les range.
  constraint antidotes_contacts_email_named check (
    email is null or email !~* '^(contact|info)@'
  )
);

create index antidotes_contacts_prospect_idx on antidotes_contacts (prospect_id);
create index antidotes_contacts_org_idx on antidotes_contacts (org_id);
-- Un seul contact principal par société : « à qui écrit-on ? » n'a jamais
-- deux réponses.
create unique index antidotes_contacts_primary_idx
  on antidotes_contacts (prospect_id)
  where is_primary;

create trigger antidotes_contacts_touch
  before update on antidotes_contacts
  for each row execute function app.touch_updated_at();

-- --- Journal des interactions ----------------------------------------------

/* Append-only : on n'update jamais une interaction, on en ajoute une. C'est
   ce qui permet de reconstruire une timeline fiable. Les politiques RLS
   (20260907b) n'ouvrent ni update ni delete, même à l'owner.
     payload : {text} pour une note ou un appel ; {subject, message_id} pour
     un envoi ; {url} pour un clic. */
create table antidotes_interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  prospect_id uuid not null references antidotes_prospects (id) on delete cascade,
  contact_id uuid references antidotes_contacts (id) on delete set null,
  type antidotes_interaction_type not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- La timeline d'un prospect se lit du plus récent au plus ancien.
create index antidotes_interactions_prospect_idx
  on antidotes_interactions (prospect_id, occurred_at desc);
create index antidotes_interactions_contact_idx
  on antidotes_interactions (contact_id)
  where contact_id is not null;
create index antidotes_interactions_org_idx on antidotes_interactions (org_id);

/* Entretient `antidotes_prospects.last_contact_at` — la carte du kanban dit
   « il y a 3 j » sans agréger le journal à chaque rendu. Seuls les gestes de
   contact comptent : une note à soi-même ou une ouverture d'email ne sont pas
   un échange. `greatest` ignore les NULL : le premier contact remplit la
   colonne, les suivants ne la font qu'avancer — le journal étant append-only,
   elle n'a jamais à reculer. */
create or replace function app.antidotes_note_contact()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.type in ('email_sent', 'reply', 'call', 'linkedin_dm', 'meeting') then
    update antidotes_prospects
    set last_contact_at = greatest(last_contact_at, new.occurred_at)
    where id = new.prospect_id;
  end if;
  return new;
end;
$$;

create trigger antidotes_interactions_note_contact
  after insert on antidotes_interactions
  for each row execute function app.antidotes_note_contact();

-- --- Séquences email (phase 3) ---------------------------------------------

create table antidotes_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index antidotes_sequences_org_idx on antidotes_sequences (org_id);

create trigger antidotes_sequences_touch
  before update on antidotes_sequences
  for each row execute function app.touch_updated_at();

/* `delay_days` compte depuis l'inscription, dans la notation du cahier des
   charges : J+0, J+4, J+9. */
create table antidotes_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  sequence_id uuid not null references antidotes_sequences (id) on delete cascade,
  position integer not null,
  delay_days integer not null default 0,
  subject_template text not null default '',
  body_template text not null default '',
  created_at timestamptz not null default now(),
  constraint antidotes_sequence_steps_position_positive check (position > 0),
  constraint antidotes_sequence_steps_delay_positive check (delay_days >= 0),
  unique (sequence_id, position)
);

create index antidotes_sequence_steps_org_idx on antidotes_sequence_steps (org_id);

create table antidotes_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  sequence_id uuid not null references antidotes_sequences (id) on delete cascade,
  contact_id uuid not null references antidotes_contacts (id) on delete cascade,
  -- L'étape déjà envoyée ; 0 tant que rien n'est parti.
  current_step integer not null default 0,
  status antidotes_enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  next_send_at timestamptz,
  constraint antidotes_sequence_enrollments_step_positive check (current_step >= 0),
  unique (sequence_id, contact_id)
);

create index antidotes_sequence_enrollments_contact_idx
  on antidotes_sequence_enrollments (contact_id);
-- Le cron d'envoi cherche « ce qui est actif et dont l'heure est venue ».
create index antidotes_sequence_enrollments_due_idx
  on antidotes_sequence_enrollments (next_send_at)
  where status = 'active';
create index antidotes_sequence_enrollments_org_idx
  on antidotes_sequence_enrollments (org_id);

-- --- Désinscription : définitive et bloquante en base -----------------------

/* Deux obligations non paramétrables, et elles vivent ici plutôt que dans le
   code d'envoi, où un chemin oublié suffirait à les contourner :
     • un contact désinscrit ne se réinscrit jamais — `opted_out` ne repasse
       pas à faux, quelle que soit la requête ;
     • ses inscriptions en cours s'arrêtent à l'instant où il se désinscrit,
       et aucune nouvelle ne peut être posée. */
create or replace function app.antidotes_guard_opt_out()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.opted_out and not new.opted_out then
    raise exception 'Un contact désinscrit ne peut pas être réinscrit.'
      using errcode = 'check_violation';
  end if;
  if new.opted_out and new.opted_out_at is null then
    new.opted_out_at := now();
  end if;
  return new;
end;
$$;

create trigger antidotes_contacts_guard_opt_out
  before insert or update on antidotes_contacts
  for each row execute function app.antidotes_guard_opt_out();

create or replace function app.antidotes_stop_enrollments_on_opt_out()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.opted_out and not old.opted_out then
    update antidotes_sequence_enrollments
    set status = 'stopped_on_opt_out'
    where contact_id = new.id
      and status in ('active', 'paused');
  end if;
  return new;
end;
$$;

create trigger antidotes_contacts_stop_enrollments
  after update of opted_out on antidotes_contacts
  for each row execute function app.antidotes_stop_enrollments_on_opt_out();

create or replace function app.antidotes_refuse_opted_out_enrollment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('active', 'paused') and exists (
    select 1 from antidotes_contacts c
    where c.id = new.contact_id and c.opted_out
  ) then
    raise exception 'Ce contact est désinscrit : aucune séquence ne peut lui être adressée.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger antidotes_sequence_enrollments_refuse_opted_out
  before insert or update on antidotes_sequence_enrollments
  for each row execute function app.antidotes_refuse_opted_out_enrollment();

-- --- Inbound : corpus de tonalité et veille (phase 4) -----------------------

/* Mes meilleurs posts (`is_mine`) et ceux de la veille, dans la même table :
   la tonalité ne se décrit pas, elle se démontre — les cinq voisins les plus
   proches d'un sujet servent d'exemples au prompt de génération.
   `vector(1536)` fixe la dimension du modèle d'embeddings, celle des modèles
   OpenAI : le modèle local de la FAQ (384 d) ne charge pas sur Vercel. */
create table antidotes_reference_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  platform antidotes_post_platform not null,
  author_handle text,
  content text not null,
  url text,
  -- Brut, par réseau : {likes, comments, shares, views, followers_at_collect}.
  -- Le score relatif à l'audience se calcule à la lecture.
  metrics jsonb not null default '{}'::jsonb,
  is_mine boolean not null default false,
  embedding vector(1536),
  tags text[] not null default '{}',
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index antidotes_reference_posts_org_idx
  on antidotes_reference_posts (org_id, is_mine);
-- Une même publication relevée deux fois par la veille ne rentre qu'une fois.
create unique index antidotes_reference_posts_url_idx
  on antidotes_reference_posts (org_id, url)
  where url is not null;
/* HNSW et non ivfflat : ivfflat calcule ses centroïdes sur les lignes
   présentes à la création — sur une table vide, l'index est creux et doit
   être reconstruit une fois le corpus arrivé. HNSW se construit au fil des
   insertions, ce qui est exactement le cas d'un corpus qui grossit. */
create index antidotes_reference_posts_embedding_idx
  on antidotes_reference_posts using hnsw (embedding vector_cosine_ops);

create table antidotes_generated_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  source_post_id uuid references antidotes_reference_posts (id) on delete set null,
  topic text,
  content text not null,
  image_url text,
  -- Validation humaine systématique avant publication : rien ne part en
  -- `published` sans être passé par `approved`.
  status antidotes_generated_post_status not null default 'draft',
  published_at timestamptz,
  linkedin_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index antidotes_generated_posts_org_idx
  on antidotes_generated_posts (org_id, status);
create index antidotes_generated_posts_source_idx
  on antidotes_generated_posts (source_post_id)
  where source_post_id is not null;

create trigger antidotes_generated_posts_touch
  before update on antidotes_generated_posts
  for each row execute function app.touch_updated_at();

-- --- Case studies (phase 4) -------------------------------------------------

/* Le slug est unique globalement et non par organisation : il devient une
   URL publique (`/case-studies/<slug>`), et deux organisations ne peuvent pas
   se disputer la même. */
create table antidotes_case_studies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  client_name text not null,
  is_anonymized boolean not null default false,
  -- « Un acteur du loisir indoor » : ce qui s'affiche quand le nom ne peut pas.
  anonymized_label text,
  sector text,
  problem text,
  method text,
  -- {metric: {before, after, unit}} — brut, les variations se calculent au rendu.
  results jsonb not null default '{}'::jsonb,
  slug text not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index antidotes_case_studies_org_idx on antidotes_case_studies (org_id);

create trigger antidotes_case_studies_touch
  before update on antidotes_case_studies
  for each row execute function app.touch_updated_at();
