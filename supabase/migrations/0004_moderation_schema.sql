-- ===========================================================================
-- Module Modération — schéma
--
-- Outil interne remplaçant la Boîte de réception Meta Business Suite.
-- Multi-canal, multi-clients, réponse générée depuis la FAQ du client et
-- validée par un humain avant tout envoi.
--
-- Deux principes structurants :
--   • `client_id` sur *toutes* les tables. Un seul client est actif en V1
--     (Bondet) mais aucun code ni aucune contrainte ne le suppose.
--   • Le module est interne : ses rôles sont distincts de ceux des espaces
--     clients, et aucun espace n'expose de route vers lui.
-- ===========================================================================

create extension if not exists vector;

-- --- Types -----------------------------------------------------------------

create type moderation_channel as enum (
  'instagram', 'facebook', 'whatsapp',
  -- V2, présents dès maintenant dans le modèle pour ne pas migrer plus tard.
  'tiktok', 'linkedin', 'youtube', 'google_reviews'
);

create type moderation_role as enum ('operator', 'viewer');

create type conversation_kind as enum ('dm', 'comment', 'story_mention', 'review');

create type conversation_status as enum (
  'to_process',
  'awaiting_validation',
  'validated',
  'sent',
  'ignored',
  'snoozed',            -- « en attente » : mis de côté sans être traité ni ignoré
  'send_failed',
  'answered_elsewhere'  -- répondu depuis l'app Instagram ou Business Suite
);

create type conversation_priority as enum ('normal', 'high');

create type message_direction as enum ('inbound', 'outbound');

create type message_origin as enum ('platform', 'antidotes', 'auto_send');

create type draft_status as enum (
  'proposed', 'validated', 'refused', 'sent', 'expired', 'no_answer_available'
);

create type ingestion_mode as enum ('webhook', 'polling');

create type connection_status as enum ('pending', 'connected', 'error', 'disabled');

create type webhook_status as enum ('pending', 'processed', 'failed', 'dead');

create type story_mention_status as enum (
  'new', 'reshared', 'replied', 'ignored', 'archived'
);

create type monday_sync_direction as enum ('pull', 'push');

-- --- Clients du module et accès -------------------------------------------

create table moderation_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  -- Rattachement optionnel à un espace du dashboard. Le module reste
  -- utilisable pour un client qui n'a pas d'espace de reporting.
  workspace_id uuid references workspaces (id) on delete set null,
  slug text not null,
  name text not null,
  locale_default text not null default 'fr',
  locales_active text[] not null default array['fr', 'en'],
  /* Réglages de ton : vouvoiement, signature, emojis, longueur cible. */
  tone_settings jsonb not null default '{
    "address": "vous",
    "signature": null,
    "emojis_allowed": false,
    "target_length": "short"
  }'::jsonb,
  /* Auto-envoi désactivé par défaut, et seul l'owner peut l'activer. */
  auto_send_settings jsonb not null default '{
    "enabled": false,
    "min_confidence": 0.9,
    "hourly_cap": 20,
    "emergency_stop": false,
    "eligible_channels": [],
    "eligible_categories": []
  }'::jsonb,
  /* Conservation illimitée par défaut ; une purge par client reste possible. */
  retention_days integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- Accès au module. Un `owner` d'organisation accède à tous les clients sans
-- ligne ici ; cette table ne sert qu'aux opérateurs et aux lecteurs, y compris
-- le client lui-même quand on lui accorde un rôle opérateur sur son périmètre.
create table moderation_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references moderation_clients (id) on delete cascade,
  role moderation_role not null default 'operator',
  -- Réglage par client : exiger la validation d'un admin avant tout envoi.
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index moderation_members_client_idx on moderation_members (client_id);

-- --- Connexions aux canaux ------------------------------------------------

create table channel_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  channel moderation_channel not null,
  external_account_id text not null,
  display_name text,
  -- Chiffré en AES-256-GCM côté application : la base ne voit qu'un blob.
  credentials_encrypted text,
  token_expires_at timestamptz,
  ingestion_mode ingestion_mode not null default 'webhook',
  -- Utilisé quand le canal n'offre pas de webhook, ou en repli.
  poll_interval_seconds integer not null default 300,
  status connection_status not null default 'pending',
  last_polled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (client_id, channel, external_account_id)
);

-- File de reprise des webhooks. Un webhook en échec n'est jamais perdu : il est
-- rejoué avec un backoff exponentiel jusqu'à `dead`, et reste inspectable.
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references moderation_clients (id) on delete cascade,
  channel moderation_channel not null,
  -- Déduplication par identifiant natif de la plateforme.
  external_event_id text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  status webhook_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (channel, external_event_id)
);

create index webhook_deliveries_queue_idx
  on webhook_deliveries (status, next_attempt_at)
  where status in ('pending', 'failed');

-- --- Conversations ---------------------------------------------------------

create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  connection_id uuid references channel_connections (id) on delete set null,
  channel moderation_channel not null,
  external_thread_id text not null,
  kind conversation_kind not null,
  participant_external_id text,
  participant_handle text,
  participant_avatar_url text,
  status conversation_status not null default 'to_process',
  priority conversation_priority not null default 'normal',
  unread boolean not null default true,
  /* spam, insult, dispute, refund, sensitive — jamais d'envoi sans lecture. */
  flags text[] not null default '{}',
  detected_locale text,
  excerpt text,
  message_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  /* Fenêtre de réponse messagerie Meta : 24 h standard, 7 j avec le tag
     human_agent. Calculée à l'ingestion, affichée dans l'inbox. */
  response_window_expires_at timestamptz,
  human_agent_tag_used boolean not null default false,
  /* Verrou optimiste : le premier qui ouvre réserve, les autres sont en
     lecture seule avec possibilité de reprendre la main explicitement. */
  locked_by uuid references auth.users (id) on delete set null,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  /* Suppression à la demande, sans casser le journal d'audit. */
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, channel, external_thread_id)
);

-- L'inbox et les compteurs tapent tous sur ces trois index.
create index conversations_inbox_idx
  on conversations (client_id, status, last_message_at desc)
  where deleted_at is null;
create index conversations_channel_idx
  on conversations (client_id, channel, status)
  where deleted_at is null;
create index conversations_lock_idx
  on conversations (lock_expires_at)
  where locked_by is not null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  client_id uuid not null references moderation_clients (id) on delete cascade,
  direction message_direction not null,
  external_message_id text,
  author_external_id text,
  author_handle text,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  /* `platform` = envoyé hors outil (app Instagram, Business Suite). Détecté à
     l'ingestion : la conversation sort alors des compteurs pour éviter une
     double réponse. */
  origin message_origin not null default 'platform',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (conversation_id, external_message_id)
);

create index messages_conversation_idx on messages (conversation_id, sent_at);

-- --- Brouillons ------------------------------------------------------------

create table drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  client_id uuid not null references moderation_clients (id) on delete cascade,
  body text not null,
  locale text not null,
  confidence numeric(4, 3),
  model text,
  prompt_version text,
  status draft_status not null default 'proposed',
  /* Entrées FAQ effectivement utilisées, avec leur similarité. Affichées sous
     le brouillon et cliquables : un opérateur doit pouvoir vérifier la source. */
  sources jsonb not null default '[]'::jsonb,
  /* Traduction depuis le français faute de réponse EN : signalé visuellement. */
  translated_from_fr boolean not null default false,
  auto_sent boolean not null default false,
  auto_send_rule jsonb,
  bad_auto_reply boolean not null default false,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  send_error text,
  created_at timestamptz not null default now()
);

create index drafts_conversation_idx on drafts (conversation_id, created_at desc);
create index drafts_auto_sent_idx on drafts (client_id, sent_at desc) where auto_sent;

-- --- FAQ -------------------------------------------------------------------

create table faq_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  unique (client_id, name)
);

create table faq_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  question_canonical text not null,
  variants text[] not null default '{}',
  answer_fr text,
  answer_en text,
  category_id uuid references faq_categories (id) on delete set null,
  channels moderation_channel[] not null default '{}',
  priority integer not null default 0,
  active boolean not null default true,
  /* Abaissée à chaque correction : une entrée souvent corrigée devient moins
     éligible à l'auto-envoi, et remonte dans « à retravailler ». */
  confidence numeric(4, 3) not null default 1.0,
  usage_count integer not null default 0,
  direct_validation_count integer not null default 0,
  correction_count integer not null default 0,
  /* 384 dimensions : all-MiniLM-L6-v2, exécuté localement. Aucun appel réseau,
     aucun coût, résultats déterministes. */
  embedding vector(384),
  embedding_source text,
  monday_item_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index faq_entries_client_idx on faq_entries (client_id, active)
  where deleted_at is null;

-- IVFFlat sur la distance cosinus. `lists` volontairement bas : quelques
-- centaines d'entrées par client, pas des millions.
create index faq_entries_embedding_idx
  on faq_entries using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- Historique immuable. Un rollback ne réécrit pas le passé : il crée une
-- nouvelle version à partir d'un ancien snapshot.
create table faq_entry_versions (
  id uuid primary key default gen_random_uuid(),
  faq_entry_id uuid not null references faq_entries (id) on delete cascade,
  client_id uuid not null references moderation_clients (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  diff jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  unique (faq_entry_id, version)
);

create index faq_entry_versions_entry_idx
  on faq_entry_versions (faq_entry_id, version desc);

-- --- Mentions en story ----------------------------------------------------

create table story_mentions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  channel moderation_channel not null default 'instagram',
  external_id text not null,
  author_handle text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz not null,
  expires_at timestamptz,
  status story_mention_status not null default 'new',
  /* L'API Instagram n'autorise pas toujours la publication programmatique en
     story. Renseigné à l'ingestion pour n'afficher l'action que si elle est
     réellement possible. */
  reshare_supported boolean not null default false,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, channel, external_id)
);

create index story_mentions_client_idx
  on story_mentions (client_id, status, published_at desc);

-- --- Import Monday --------------------------------------------------------

create table monday_imports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  board_id text not null,
  /* Mapping colonne Monday → champ FAQ, par configuration. Jamais en dur. */
  column_mapping jsonb not null,
  direction monday_sync_direction not null default 'pull',
  status text not null default 'preview',
  preview jsonb,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- --- Journal d'audit immuable ---------------------------------------------

create table moderation_audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users (id) on delete set null,
  client_id uuid references moderation_clients (id) on delete cascade,
  channel moderation_channel,
  conversation_id uuid,
  faq_entry_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index moderation_audit_log_client_idx
  on moderation_audit_log (client_id, created_at desc);
create index moderation_audit_log_action_idx
  on moderation_audit_log (action, created_at desc);

-- L'immuabilité est garantie par la base, pas par la discipline applicative :
-- une modification ou une suppression lève une exception, y compris pour le
-- rôle service_role.
create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'moderation_audit_log est immuable : % interdit', tg_op;
end;
$$;

create trigger moderation_audit_log_immutable
  before update or delete on moderation_audit_log
  for each row execute function app.reject_audit_mutation();

-- --- Purge et suppression -------------------------------------------------

-- Suppression d'une conversation à la demande. Le contenu part, la trace reste :
-- le journal d'audit conserve qui a supprimé quoi et quand.
create or replace function app.delete_conversation(target uuid, actor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conv conversations;
begin
  select * into conv from conversations where id = target;
  if conv.id is null then
    raise exception 'Conversation introuvable';
  end if;

  insert into moderation_audit_log
    (actor_id, client_id, channel, conversation_id, action, before)
  values (
    actor, conv.client_id, conv.channel, conv.id, 'conversation.delete',
    jsonb_build_object(
      'participant_handle', conv.participant_handle,
      'message_count', conv.message_count,
      'status', conv.status
    )
  );

  delete from conversations where id = target;
end;
$$;

-- Purge par client. `older_than_days` à null utilise la rétention configurée du
-- client ; sans rétention configurée, la purge refuse de tout effacer par
-- accident et exige une valeur explicite.
create or replace function app.purge_client_conversations(
  target_client uuid,
  older_than_days integer default null,
  actor uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effective_days integer;
  purged integer;
begin
  select coalesce(older_than_days, retention_days)
    into effective_days
  from moderation_clients
  where id = target_client;

  if effective_days is null then
    raise exception
      'Aucune rétention configurée pour ce client : préciser older_than_days';
  end if;

  with removed as (
    delete from conversations
    where client_id = target_client
      and last_message_at < now() - make_interval(days => effective_days)
    returning 1
  )
  select count(*) into purged from removed;

  insert into moderation_audit_log (actor_id, client_id, action, after)
  values (
    actor, target_client, 'client.purge',
    jsonb_build_object('older_than_days', effective_days, 'purged', purged)
  );

  return purged;
end;
$$;
