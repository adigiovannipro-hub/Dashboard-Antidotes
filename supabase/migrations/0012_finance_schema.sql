-- ===========================================================================
-- Module Finance — schéma
--
-- Vue d'ensemble comptable d'Antidotes : facturation à venir, trésorerie EUR,
-- évolution du solde, dépenses carte. Tout est lu depuis cette base ; les
-- écrans n'appellent jamais une API externe. Le cron synchronise, la base fait
-- foi, l'interface lit.
--
-- Trois décisions structurent ce modèle :
--
--   • `finance_transactions` est le miroir Airwallex **unique** et a vocation à
--     remplacer `receipt_expenses` : le module Reçus s'y rebranchera, deux
--     copies des mêmes dépenses finiraient par se contredire. D'où deux paires
--     de montants par ligne — une dépense Grab s'affiche « 158 800 IDR,
--     financé avec 7,73 EUR » : ne stocker qu'une devise rendrait le tableau
--     Airwallex irreproductible.
--
--   • Les soldes ne s'observent qu'au présent : l'API ne rend aucun historique.
--     La courbe d'évolution n'existe donc que si chaque passage du cron laisse
--     un instantané. `finance_balances_history` est en append-only, avec une
--     unicité par heure — le cron peut repasser dix fois, il n'écrira qu'un
--     instantané par compte et par heure.
--
--   • Les statuts Airwallex sont stockés **bruts**. Leur vocabulaire bouge plus
--     vite que ce schéma ; le normaliser en base figerait notre lecture
--     d'aujourd'hui. La traduction en libellés vit dans le code, où elle se
--     corrige sans migration. Seules nos propres machines à états (facture,
--     rapprochement) méritent un enum.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* Statut normalisé d'une facture émise. `overdue` n'y figure pas : une facture
   en retard est une facture `sent` dont l'échéance est passée, et un statut qui
   dépend de l'heure qu'il est n'a pas sa place en base — il se calcule à la
   lecture. */
create type finance_invoice_status as enum ('draft', 'sent', 'paid', 'void');

create type finance_transaction_source as enum ('airwallex', 'whatsapp', 'manual');

create type finance_receipt_source as enum ('whatsapp', 'manual', 'email');

create type finance_match_status as enum (
  'none',       -- aucun rapprochement tenté
  'auto',       -- rapproché seul, confiance suffisante
  'pending',    -- candidat trouvé, attend une décision humaine
  'confirmed',  -- rapprochement validé à la main
  'rejected'    -- candidat écarté à la main
);

create type finance_sync_kind as enum ('balances', 'transactions', 'invoices');

-- --- Fonction d'entretien générique ----------------------------------------

/* Généralisation de `app.touch_receipt_document` : même corps, portée neutre.
   Les triggers du module Reçus continuent d'utiliser la leur ; les prochains
   modules utiliseront celle-ci. */
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Comptes ---------------------------------------------------------------

/* Un wallet par devise. Airwallex expose les soldes par devise sur un même
   compte : c'est la paire (compte, devise) qui identifie une ligne de
   trésorerie, pas le compte seul. */
create table finance_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  external_id text not null,
  currency char(3) not null,
  name text not null,
  account_status text,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, external_id, currency)
);

-- --- Historique des soldes -------------------------------------------------

/* Append-only : rien ne se corrige ici, un instantané raté se remplace par le
   suivant. `snapshot_hour` est l'heure tronquée — c'est elle qui porte
   l'idempotence du cron, `captured_at` garde l'instant réel de la mesure. */
create table finance_balances_history (
  id bigserial primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  account_id uuid not null references finance_accounts (id) on delete cascade,
  -- Dénormalisée depuis le compte : la courbe agrège par devise sur des
  -- milliers de lignes et n'a pas à joindre pour ça.
  currency char(3) not null,
  -- En centimes : aucun montant monétaire ne transite en flottant.
  available_cents bigint not null,
  pending_cents bigint not null default 0,
  reserved_cents bigint not null default 0,
  snapshot_hour timestamptz not null,
  captured_at timestamptz not null default now(),
  unique (account_id, snapshot_hour)
);

create index finance_balances_series_idx
  on finance_balances_history (org_id, currency, snapshot_hour desc);

-- --- Factures émises -------------------------------------------------------

create table finance_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  external_id text not null,
  -- Le nom du client tel qu'Airwallex le connaît. Pas de FK vers `workspaces` :
  -- un client facturé n'a pas forcément d'espace dans le dashboard.
  client_name text not null,
  client_external_id text,
  amount_cents bigint not null,
  currency char(3) not null,
  status finance_invoice_status not null default 'draft',
  -- Le statut d'origine, conservé tel quel : si la normalisation se révèle
  -- fausse, elle se rejoue depuis cette colonne sans resynchroniser.
  raw_status text,
  issued_on date,
  due_on date,
  paid_at timestamptz,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, external_id)
);

create index finance_invoices_open_idx
  on finance_invoices (org_id, status, due_on);

create trigger finance_invoices_touch
  before update on finance_invoices
  for each row execute function app.touch_updated_at();

-- --- Catégories ------------------------------------------------------------

/* Le plan de catégories d'Antidotes — un seul niveau. Une arborescence
   arriverait avec un besoin réel, pas par anticipation. */
create table finance_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

/* Table de correspondance éditable : libellé de catégorie Airwallex
   (« Transports », « Restauration »…) vers une catégorie du plan. La
   résolution vit dans le code ; ici, seulement les règles. */
create table finance_category_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  -- Libellé source, comparé insensiblement à la casse.
  matcher text not null,
  category_id uuid not null references finance_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (org_id, matcher)
);

-- --- Dépenses --------------------------------------------------------------

create table finance_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  external_id text not null,

  occurred_at timestamptz not null,
  posted_at timestamptz,

  -- « Grab » d'un côté, « Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN » de
  -- l'autre : l'affichage veut le premier, le rapprochement a besoin du second.
  merchant text,
  merchant_raw text,

  -- Montant local : ce que le commerçant a facturé, dans sa devise.
  amount_cents bigint not null,
  currency char(3) not null,
  -- Montant débité : ce qui est réellement sorti du wallet. « 158 800 IDR,
  -- financé avec 7,73 EUR » — c'est cette colonne qui se totalise en EUR.
  billing_amount_cents bigint,
  billing_currency char(3),

  category_id uuid references finance_categories (id) on delete set null,
  -- La catégorie qu'Airwallex affiche, avant notre correspondance.
  category_raw text,

  -- Statut Airwallex brut (« Incomplet », « En attente d'approbation »…).
  status text,
  source finance_transaction_source not null default 'airwallex',

  -- Ce qu'Airwallex sait des justificatifs de cette ligne. Le rapprochement
  -- fait par nous vit dans `finance_receipts.transaction_id` — une seule
  -- direction de lien, pas de FK circulaire.
  has_receipt boolean not null default false,

  card_last_four text,
  cardholder_name text,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, external_id)
);

create index finance_transactions_table_idx
  on finance_transactions (org_id, occurred_at desc);

create index finance_transactions_category_idx
  on finance_transactions (org_id, category_id);

/* Le filtre « sans justificatif » est la vraie liste de travail : c'est lui
   qui mérite un index, pas l'inverse. */
create index finance_transactions_missing_receipt_idx
  on finance_transactions (org_id, occurred_at desc)
  where has_receipt = false;

create trigger finance_transactions_touch
  before update on finance_transactions
  for each row execute function app.touch_updated_at();

-- --- Justificatifs ---------------------------------------------------------

/* Les pièces qui n'arrivent pas par mail : photo WhatsApp, dépôt manuel.
   La chaîne mail → extraction → transfert reste au module Reçus
   (`receipt_documents`), déjà construite — la dupliquer ici créerait deux
   vérités pour le même justificatif. */
create table finance_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  source finance_receipt_source not null,

  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,

  -- Extraction (modèle ou saisie) : ce que la pièce dit d'elle-même.
  merchant text,
  amount_cents bigint,
  currency char(3),
  occurred_on date,
  payment_method text,
  extracted jsonb,
  extraction_confidence numeric(4, 3),

  -- Rapprochement avec une dépense. Le seuil d'auto-validation (0,9) vit dans
  -- le code de la phase 2, pas ici.
  transaction_id uuid references finance_transactions (id) on delete set null,
  match_confidence numeric(4, 3),
  match_status finance_match_status not null default 'none',

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_receipts_inbox_idx
  on finance_receipts (org_id, match_status, created_at desc);

create index finance_receipts_transaction_idx
  on finance_receipts (transaction_id)
  where transaction_id is not null;

create trigger finance_receipts_touch
  before update on finance_receipts
  for each row execute function app.touch_updated_at();

-- --- Journal de synchronisation --------------------------------------------

/* Un échec de synchronisation silencieux est le pire état possible : l'écran
   affiche des chiffres justes d'hier en les faisant passer pour ceux
   d'aujourd'hui. Chaque passage, réussi ou non, laisse une ligne ; l'écran
   affiche la dernière. Réutilise l'enum `sync_status` du reporting. */
create table finance_sync_runs (
  id bigserial primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  kind finance_sync_kind not null,
  status sync_status not null default 'running',
  -- 'cron' ou 'manual' : « Synchroniser maintenant » doit se distinguer du
  -- passage horaire dans le journal.
  triggered_via text not null default 'cron'
    check (triggered_via in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_synced integer not null default 0,
  error text,
  requested_by uuid references auth.users (id) on delete set null
);

create index finance_sync_runs_latest_idx
  on finance_sync_runs (org_id, kind, started_at desc);

-- --- Stockage des pièces ---------------------------------------------------

/* Bucket privé, comme `receipts` : un justificatif porte plus d'informations
   qu'un montant. 10 Mo — la limite d'Airwallex, autant la partager. */
insert into storage.buckets (id, name, public, file_size_limit)
values ('finance-receipts', 'finance-receipts', false, 10485760)
on conflict (id) do nothing;
