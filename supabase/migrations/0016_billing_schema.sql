-- ===========================================================================
-- Module Échéances de facturation — schéma
--
-- Le remplaçant du board Monday où chaque devis signé devenait des lignes de
-- facturation mensuelles. Deux tables suffisent :
--
--   • `billing_engagements` — le devis signé : un client, une prestation, un
--     montant mensuel, une période. C'est ce qu'on saisit une fois.
--   • `billing_installments` — les échéances qu'il engendre : une ligne par
--     mois de prestation, avec sa date d'émission. C'est ce qu'on coche mois
--     après mois.
--
-- Les échéances sont **matérialisées** à la création de l'engagement, pas
-- recalculées à la lecture : chaque ligne se coche, s'ajuste ou s'annule
-- indépendamment — un mois offert, un montant révisé — et une ligne qui
-- n'existe qu'en mémoire ne peut pas porter d'état.
--
-- La règle métier centrale, et la seule : une prestation du mois N se facture
-- le lendemain de la fin du mois N. Juin se facture le 1er juillet. La date
-- est stockée (`issue_on`) et non déduite à la lecture : c'est elle qu'on
-- trie, elle qu'on compare à aujourd'hui, et la stocker permet de la décaler
-- à la main le jour où un client demandera un autre rythme.
--
-- Ce module est **à nous** — aucune synchronisation ne l'écrit ni ne
-- l'écrase, contrairement aux miroirs Airwallex du module Finance.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

create type billing_engagement_status as enum (
  'active',  -- des échéances restent à émettre
  'ended'    -- terminé ou résilié : ses échéances restantes sont annulées
);

/* Le cycle de vie d'une échéance. `overdue` n'y figure pas : une échéance en
   retard est une échéance `pending` dont `issue_on` est passé, et un statut
   qui dépend de l'heure qu'il est n'a pas sa place en base — il se calcule à
   la lecture. Même décision que `finance_invoice_status`. */
create type billing_installment_status as enum (
  'pending',  -- à émettre, le moment venu
  'issued',   -- facture envoyée au client
  'paid',     -- réglée
  'skipped'   -- annulée : mois offert, avoir, résiliation
);

-- --- Engagements -----------------------------------------------------------

create table billing_engagements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  client_name text not null,
  /* La prestation, telle qu'elle figurera sur la facture : « Community
     management », « Campagnes Meta »… */
  label text not null,

  monthly_amount_cents bigint not null check (monthly_amount_cents > 0),
  currency char(3) not null default 'EUR',

  /* Premier mois de prestation, calé au 1er — même convention que
     `planning_months.month`. */
  first_month date not null check (extract(day from first_month) = 1),
  /* Nombre de mois du devis. Borné large : un engagement de plus de cinq ans
     est une erreur de saisie, pas un contrat. */
  months_count integer not null check (months_count between 1 and 60),

  status billing_engagement_status not null default 'active',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_engagements_org_idx
  on billing_engagements (org_id, status);

create trigger billing_engagements_touch
  before update on billing_engagements
  for each row execute function app.touch_updated_at();

-- --- Échéances -------------------------------------------------------------

create table billing_installments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  engagement_id uuid not null references billing_engagements(id) on delete cascade,

  /* Mois de prestation, calé au 1er. Un engagement n'a qu'une échéance par
     mois — c'est la contrainte qui rend la génération rejouable. */
  service_month date not null check (extract(day from service_month) = 1),

  /* Copiés de l'engagement à la génération, puis indépendants : un montant
     révisé sur un mois ne réécrit pas l'histoire des autres. */
  amount_cents bigint not null check (amount_cents >= 0),
  currency char(3) not null,

  /* Le jour où la facture part : le lendemain de la fin du mois de
     prestation. Stocké et non calculé, pour rester ajustable ligne à ligne. */
  issue_on date not null,

  status billing_installment_status not null default 'pending',
  issued_at timestamptz,
  paid_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (engagement_id, service_month)
);

/* Les deux lectures de l'écran : « qu'est-ce que j'émets maintenant » balaye
   (org, statut, date), le détail d'un engagement balaye ses lignes. */
create index billing_installments_org_issue_idx
  on billing_installments (org_id, status, issue_on);
create index billing_installments_engagement_idx
  on billing_installments (engagement_id);

create trigger billing_installments_touch
  before update on billing_installments
  for each row execute function app.touch_updated_at();
