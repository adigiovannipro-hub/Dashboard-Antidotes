-- ===========================================================================
-- Module Reçus — schéma
--
-- Chaîne automatisée : un mail arrive, on décide si c'est une pièce comptable,
-- on en tire un PDF, on le rapproche d'une dépense carte Airwallex, puis on
-- transfère le tout à la boîte de reçus d'Airwallex qui l'accroche à la ligne.
--
-- Trois contraintes ont dessiné ce modèle :
--
--   • L'API Airwallex est en **lecture seule** sur les dépenses. Aucun endpoint
--     public ne dépose une pièce jointe. Le seul chemin d'écriture est le
--     transfert de mail vers `receipts@expenses.airwallex.com`, dont l'OCR fait
--     le rapprochement de son côté. On ne pilote donc pas l'accrochage : on
--     l'envoie, puis on **vérifie** en relisant l'API. D'où deux états séparés,
--     `forwarded` et `attached` : croire que l'envoi vaut classement était le
--     moyen le plus sûr de perdre des pièces sans s'en apercevoir.
--
--   • Le rapprochement local (mail ↔ dépense carte) n'est pas ce qui range la
--     pièce — Airwallex refait le sien. Il sert à décider *avant* l'envoi si la
--     pièce est sûre, et à savoir *après* quoi vérifier. C'est un pari affiché,
--     pas une commande.
--
--   • Un mail ne doit être traité qu'une fois, même si le cron repasse ou si
--     Gmail rejoue un historique. D'où l'unicité sur l'identifiant natif du
--     message plutôt que sur un hash du contenu.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

create type receipt_provider as enum ('gmail');

create type receipt_source_status as enum (
  'pending', 'connected', 'error', 'disabled'
);

/* Nature de la pièce. `other` existe pour garder trace d'un mail examiné puis
   écarté : sans lui, on le réexaminerait à chaque passage du cron. */
create type receipt_kind as enum (
  'invoice',       -- facture fournisseur
  'receipt',       -- ticket, reçu de paiement
  'subscription',  -- renouvellement d'abonnement (Anthropic, Notion, …)
  'statement',     -- relevé, récapitulatif de compte
  'other'          -- examiné, sans valeur comptable
);

create type receipt_status as enum (
  'detected',              -- identifié, en cours d'extraction
  'awaiting_validation',   -- prêt, attend le feu vert humain
  'queued',                -- validé, transfert en cours
  'forwarded',             -- transféré à Airwallex, accrochage non confirmé
  'attached',              -- confirmé accroché à une dépense — terminal
  'unmatched',             -- transféré mais resté dans la boîte de reçus
  'ignored',               -- écarté volontairement — terminal
  'failed'                 -- échec technique, rejouable
);

/* D'où vient le PDF envoyé. `none` : l'e-mail est transféré tel quel, l'OCR
   d'Airwallex sachant lire un corps de message. */
create type receipt_pdf_origin as enum ('attachment', 'rendered', 'none');

create type receipt_match_method as enum ('exact', 'fuzzy', 'manual', 'none');

-- --- Boîtes surveillées ----------------------------------------------------

create table receipt_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  provider receipt_provider not null default 'gmail',
  -- Airwallex n'accepte un reçu que s'il vient de l'adresse rattachée au
  -- compte : cette colonne est une contrainte métier, pas un simple libellé.
  email_address text not null,
  -- Refresh token OAuth, chiffré en AES-256-GCM côté application.
  credentials_encrypted text,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  -- Curseur d'historique Gmail : permet de ne relire que le delta.
  history_id text,
  last_polled_at timestamptz,
  status receipt_source_status not null default 'pending',
  last_error text,
  -- Destination des transferts. Paramétrable pour tester sur sa propre adresse
  -- avant d'envoyer quoi que ce soit au vrai service.
  forward_to text not null default 'receipts@expenses.airwallex.com',
  /* Réglages d'auto-transfert. Désactivé par défaut : la première exécution
     d'un outil qui envoie des mails en votre nom se regarde avant de la
     laisser courir. `emergency_stop` coupe tout sans rien reconfigurer. */
  settings jsonb not null default '{
    "auto_forward": {
      "enabled": false,
      "min_confidence": 0.9,
      "max_amount_cents": 50000,
      "hourly_cap": 10,
      "emergency_stop": false,
      "require_expense_match": true
    },
    "lookback_days": 30,
    "ignored_senders": []
  }'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, email_address)
);

-- --- Cache des dépenses Airwallex ------------------------------------------

/* Copie locale des dépenses carte. Deux raisons de la garder plutôt que
   d'interroger l'API à chaque écran : le rapprochement compare un mail à des
   centaines de lignes et doit être instantané, et la vue budgétaire à venir
   travaillera sur l'historique, que l'API pagine sans le conserver. */
create table receipt_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  external_id text not null,
  merchant text,
  -- En centimes : aucun montant monétaire ne transite en flottant.
  amount_cents bigint not null,
  currency char(3) not null,
  -- Date de la transaction et date de comptabilisation : elles diffèrent
  -- souvent de un à trois jours, et le rapprochement doit tolérer l'écart.
  transaction_date date,
  posted_at timestamptz,
  card_last_four text,
  cardholder_name text,
  category text,
  expense_status text,
  attachment_count integer not null default 0,
  -- Réponse brute conservée : les champs utiles d'Airwallex bougeront avant
  -- que ce schéma ne bouge, et un retraitement doit rester possible sans
  -- resynchroniser douze mois d'historique.
  raw jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, external_id)
);

create index receipt_expenses_lookup_idx
  on receipt_expenses (org_id, transaction_date desc, amount_cents);

create index receipt_expenses_unattached_idx
  on receipt_expenses (org_id, transaction_date desc)
  where attachment_count = 0;

-- --- Pièces détectées ------------------------------------------------------

create table receipt_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  source_id uuid not null references receipt_sources (id) on delete cascade,

  -- Identifiant natif du message. L'unicité ici est la garantie qu'un mail
  -- n'est jamais transféré deux fois, quel que soit le nombre de passages.
  external_message_id text not null,
  external_thread_id text,

  received_at timestamptz not null,
  from_email text not null,
  from_name text,
  subject text,
  snippet text,

  -- Classification
  kind receipt_kind not null default 'other',
  classification_confidence numeric(4, 3) not null default 0,
  classification_reason text,
  -- 'heuristics' quand la règle a suffi, 'llm' quand il a fallu lire.
  classified_by text,

  -- Extraction
  merchant text,
  amount_cents bigint,
  currency char(3),
  document_date date,
  invoice_number text,
  tax_cents bigint,

  -- Pièce
  pdf_origin receipt_pdf_origin not null default 'none',
  pdf_filename text,
  pdf_size_bytes integer,
  pdf_storage_path text,
  external_attachment_id text,

  -- Cycle de vie
  status receipt_status not null default 'detected',
  expense_id uuid references receipt_expenses (id) on delete set null,
  match_confidence numeric(4, 3),
  match_method receipt_match_method not null default 'none',
  /* Candidats écartés, gardés pour l'écran de validation : proposer une
     alternative en un clic vaut mieux que de faire rechercher à la main. */
  match_candidates jsonb not null default '[]'::jsonb,

  forwarded_at timestamptz,
  forwarded_message_id text,
  /* Nombre de pièces jointes que portait la dépense au moment du transfert.
     C'est le point de comparaison qui permet d'affirmer que *notre* pièce s'est
     accrochée : sans lui, une ligne déjà pourvue d'un justificatif passerait
     pour rangée dès la première vérification. */
  expense_attachment_baseline integer,
  attached_at timestamptz,
  -- Nombre de vérifications d'accrochage déjà faites, pour arrêter de
  -- surveiller une pièce qu'Airwallex n'accrochera manifestement jamais.
  attach_checks integer not null default 0,
  failure_reason text,

  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  -- Distingue « parti tout seul » de « validé à la main » : sans cette
  -- colonne, on ne peut pas mesurer si l'automatisation mérite sa confiance.
  auto_decided boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, external_message_id)
);

create index receipt_documents_inbox_idx
  on receipt_documents (org_id, status, received_at desc);

create index receipt_documents_expense_idx
  on receipt_documents (expense_id)
  where expense_id is not null;

/* Pièces transférées dont l'accrochage n'est pas confirmé : c'est la file que
   le cron de vérification relit, et elle doit rester peu coûteuse à trouver. */
create index receipt_documents_pending_attach_idx
  on receipt_documents (forwarded_at)
  where status = 'forwarded';

-- --- Règles par fournisseur ------------------------------------------------

/* Ce que l'outil retient de vos décisions. Valider trois fois de suite les
   factures d'un même fournisseur devrait suffire à ne plus avoir à le faire :
   c'est ici que ça se range, par domaine d'expéditeur — un fournisseur change
   d'adresse d'envoi plus souvent que de domaine. */
create table receipt_merchant_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  sender_domain text not null,
  merchant text,
  category text,
  auto_forward boolean not null default false,
  -- Compteur de validations manuelles concordantes, base de la proposition
  -- « toujours accepter ce fournisseur ».
  approvals integer not null default 0,
  rejections integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, sender_domain)
);

-- --- Journal ---------------------------------------------------------------

/* Un outil qui envoie des mails en votre nom et touche à votre comptabilité
   doit pouvoir répondre à « pourquoi cette pièce est-elle partie ? » des mois
   après. Rien n'est modifié ici, seulement ajouté. */
create table receipt_events (
  id bigserial primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid references receipt_documents (id) on delete set null,
  -- `null` : décision de l'automatisation, pas d'un humain.
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index receipt_events_document_idx
  on receipt_events (document_id, created_at desc);

create index receipt_events_org_idx
  on receipt_events (org_id, created_at desc);

-- --- Stockage des pièces ---------------------------------------------------

/* Bucket privé : un PDF de facture porte un RIB aussi souvent qu'un montant.
   L'accès passe par des URL signées de courte durée, jamais par une lecture
   publique. */
insert into storage.buckets (id, name, public, file_size_limit)
values ('receipts', 'receipts', false, 10485760)
on conflict (id) do nothing;

-- --- Entretien -------------------------------------------------------------

create or replace function app.touch_receipt_document()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger receipt_documents_touch
  before update on receipt_documents
  for each row execute function app.touch_receipt_document();
