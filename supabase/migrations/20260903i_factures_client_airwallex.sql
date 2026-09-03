-- ===========================================================================
-- Factures — le dashboard crée la facture de bout en bout
--
-- La première facture ne se fait plus à la main dans Airwallex. Le dashboard
-- crée le client de facturation, le produit, puis la facture — et duplique
-- ensuite chaque mois en ne changeant que la période. La facture modèle
-- devient un repli, plus une condition.
--
-- Ce qu'Airwallex réclame pour émettre, et qui n'existait nulle part chez
-- nous : l'identité de l'entreprise facturée (raison sociale, adresse, numéro
-- de TVA) et le libellé du produit vendu. Tout cela vit désormais sur le
-- devis, saisi une fois, et part chez Airwallex à la première émission.
--
-- Les mentions de bas de facture — IBAN, SWIFT, « TVA non applicable » — ne
-- sont pas ici : elles sont les mêmes pour tous les clients et vivent dans le
-- code (`src/lib/finance/airwallex-emission.ts`). Une donnée qui ne varie
-- jamais n'a pas à être ressaisie devis par devis, ni à pouvoir diverger.
--
-- Et chaque mail reçoit son propre objet : « facture du mois d'août »,
-- « relance de la facture… », « seconde relance… ». Un objet unique pour les
-- quatre laissait le client incapable de distinguer un rappel d'un envoi.
-- ===========================================================================

alter table billing_engagements
  /* L'entreprise telle qu'elle doit apparaître sur la facture. Vide : le nom
     du client fait office, ce qui suffit souvent. */
  add column billing_name text,
  /* L'adresse mail que porte la fiche client chez Airwallex — distincte du
     destinataire de nos mails, qui peut être un service comptable. */
  add column billing_email text,
  add column billing_street text,
  add column billing_city text,
  add column billing_postcode text,
  /* Code pays ISO à deux lettres. La France par défaut, sans quoi Airwallex
     refuse la création du client. */
  add column billing_country char(2) not null default 'FR',
  add column billing_tax_id text,

  /* Le libellé de la prestation sur la facture — « ACCOMPAGNEMENT SOCIAL
     MEDIA ». Distinct de `label`, qui nomme le devis en interne. */
  add column product_name text,

  /* Un objet par mail. `reminder_subject` devient celui de la première
     relance ; les deux autres s'ajoutent. */
  add column reminder_2_subject text,
  add column reminder_3_subject text;

alter table billing_engagements
  rename column reminder_subject to reminder_1_subject;
