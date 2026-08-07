-- ===========================================================================
-- Grand livre Airwallex — schéma
--
-- Les dépenses carte ne racontent que la moitié de la trésorerie : rien n'y
-- dit ce qui **rentre**. L'endpoint `financial_transactions` d'Airwallex est
-- le grand livre du wallet — chaque mouvement, dans les deux sens, signé.
-- C'est lui qui alimente la courbe « Entrées et sorties » de l'écran Finance,
-- par totaux mensuels.
--
-- Miroir strict, comme `finance_transactions` : le cron écrit, l'application
-- lit, personne ne modifie. Le montant est **signé** — une entrée est
-- positive, une sortie négative, comme dans le relevé Airwallex. Les statuts
-- et types restent bruts (text) : le vocabulaire d'un tiers n'est pas un
-- invariant sur lequel bâtir un enum.
-- ===========================================================================

-- Le journal de synchronisation apprend la nouvelle étape. Ajout seul : la
-- valeur n'est utilisée par aucun ordre de cette migration — une valeur d'enum
-- ajoutée ne peut pas servir dans la transaction qui l'ajoute.
alter type finance_sync_kind add value if not exists 'ledger';

create table finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  external_id text not null,

  occurred_at timestamptz not null,

  -- Signé : positif quand l'argent rentre, négatif quand il sort.
  amount_cents bigint not null,
  fee_cents bigint,
  net_cents bigint,
  currency char(3) not null,

  transaction_type text,
  source_type text,
  description text,
  status text,

  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (org_id, external_id)
);

-- La lecture de l'écran : une devise, une fenêtre de mois, du plus récent au
-- plus ancien.
create index finance_ledger_series_idx
  on finance_ledger_entries (org_id, currency, occurred_at desc);
