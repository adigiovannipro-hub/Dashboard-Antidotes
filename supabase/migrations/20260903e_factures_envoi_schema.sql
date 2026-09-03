-- ===========================================================================
-- Factures — envoi automatique et relances
--
-- L'écran « Échéances » devient « Factures », et cesse d'être un tableau de
-- bord passif : quand une mensualité arrive à échéance, la facture se crée
-- chez Airwallex, part par mail avec son PDF, et se relance toute seule tant
-- qu'elle n'est pas payée.
--
-- Trois ajouts, et pas un de plus :
--
--   • ce qu'il faut pour écrire le mail — destinataire, copies, templates :
--     sur l'engagement, parce que c'est là que se décide la relation avec un
--     client, et qu'un devis signé porte déjà tout le reste ;
--   • ce qu'il faut pour créer la facture — le client Airwallex, le prix, et
--     la facture modèle dont on duplique la forme ;
--   • le **journal des envois**, qui est le cœur du dispositif : c'est lui
--     qui répond à « ce mail est-il déjà parti ? ». Sans lui, un passage
--     rejoué enverrait deux fois la même relance, et la seule chose pire
--     qu'une facture jamais relancée est une facture relancée trois fois le
--     même matin.
--
-- Le CCI est absent de ce schéma : il est constant, forcé dans le code, et
-- une colonne qui ne prend jamais qu'une valeur est une invitation à la
-- changer par erreur.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* Les quatre mails de la vie d'une facture. L'ordre est la cadence : envoi,
   puis J+31, J+46, J+61. Après la troisième, plus rien ne part — l'impayé
   reste rouge à l'écran, et c'est au téléphone que ça se règle. */
create type billing_email_kind as enum (
  'invoice',    -- l'envoi initial, avec le PDF
  'reminder_1', -- J+31 après l'envoi
  'reminder_2', -- J+15 après la première relance
  'reminder_3'  -- J+15 après la deuxième
);

-- --- Ce qu'il faut pour écrire et pour émettre -----------------------------

alter table billing_engagements
  /* Le destinataire. Sans lui, rien ne part : une mensualité dont
     l'engagement n'a pas d'adresse reste à facturer à la main, exactement
     comme aujourd'hui. C'est la porte de sortie du dispositif. */
  add column recipient_email text
    check (recipient_email is null or recipient_email like '%_@_%'),

  /* Les copies visibles. Le CCI, lui, est constant et vit dans le code. */
  add column cc_emails text[] not null default '{}',

  /* Le prénom du contact, pour `[prénom]` : Airwallex ne connaît que la
     raison sociale, et « Bonjour SARL DUPONT » n'est pas une formule de
     politesse. Vide, la formule se replie sur « Bonjour ». */
  add column contact_first_name text,

  /* Les deux templates. `null` : celui du code s'applique — un devis qui
     n'a rien de particulier à dire n'a pas à recopier le texte commun. */
  add column send_template text,
  add column reminder_template text,

  /* Le client de facturation chez Airwallex (`bcus_…`) et le produit facturé
     (`prd_…`). Renseignés à la première émission en les lisant sur la facture
     modèle : on ne demande pas à un humain de recopier des identifiants
     opaques.

     Le produit et non le prix : le montant d'une mensualité varie au centime
     d'un mois à l'autre — la division d'un total ne tombe pas juste — et un
     prix Airwallex porte un montant fixe. Le produit est stable, le prix se
     crée à chaque facture au montant exact. */
  add column airwallex_customer_id text,
  add column airwallex_product_id text,

  /* La facture modèle — celle créée à la main dans Airwallex, dont les
     suivantes reprennent la forme. C'est le repli si l'API refuse la
     création : on sait au moins quoi dupliquer, et où. */
  add column template_invoice_external_id text;

alter table billing_installments
  /* La facture Airwallex émise pour cette mensualité, par son identifiant
     externe (`inv_…`). Distincte de `matched_invoice_id`, qui pointe le
     miroir local : celui-ci n'existe qu'après la synchronisation suivante,
     alors que l'émission a besoin de savoir tout de suite ce qu'elle vient
     de créer — sans quoi le passage d'après créerait une seconde facture. */
  add column airwallex_invoice_id text,

  /* Ce qui a empêché l'émission ou l'envoi, en clair. Effacé au succès. Une
     erreur muette sur une facture est une facture qui ne part jamais sans
     que personne ne l'apprenne. */
  add column last_send_error text;

/* La garde d'idempotence de l'émission : deux passages concurrents ne
   peuvent pas créer deux factures pour la même mensualité. */
create unique index billing_installments_airwallex_invoice_key
  on billing_installments (airwallex_invoice_id)
  where airwallex_invoice_id is not null;

-- --- Le journal des envois -------------------------------------------------

create table billing_invoice_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  installment_id uuid not null
    references billing_installments(id) on delete cascade,

  kind billing_email_kind not null,

  /* Les adresses telles qu'elles sont parties, et non telles qu'elles sont
     aujourd'hui sur l'engagement : un client qui change d'adresse ne réécrit
     pas l'histoire de ce qu'il a reçu. */
  to_email text not null,
  cc_emails text[] not null default '{}',
  bcc_email text,

  subject text not null,
  body text not null,

  /* La facture concernée, par son identifiant Airwallex — la trace de ce que
     le client a effectivement reçu en pièce jointe. */
  invoice_external_id text,
  /* L'identifiant Gmail du message envoyé : la preuve, et le moyen de le
     retrouver dans la boîte. */
  gmail_message_id text,

  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  /* Le cœur de l'affaire : un type de mail ne part qu'une fois par
     mensualité. C'est cette contrainte, et non une condition dans le code,
     qui garantit qu'un passage rejoué ne double pas une relance. */
  unique (installment_id, kind)
);

/* La lecture du dispositif : « qu'est-ce qui est parti, et quand », pour
   décider de la relance suivante. */
create index billing_invoice_emails_org_idx
  on billing_invoice_emails (org_id, sent_at desc);

/* Ajout seul, sans usage dans ce fichier : une valeur d'enum ne peut pas
   servir dans la transaction qui la crée. L'étape sera journalisée par le
   passage, comme le rapprochement l'est déjà. */
alter type finance_sync_kind add value if not exists 'invoicing';
