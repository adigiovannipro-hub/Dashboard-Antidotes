-- ===========================================================================
-- Échéances v2 — TVA, rapprochement Airwallex, archivage
--
-- L'écran se réorganise en groupes de statut façon board Monday, et surtout
-- il cesse d'attendre qu'on coche : les factures Airwallex étant déjà
-- synchronisées en base (module Finance), une échéance se rapproche de sa
-- facture et avance toute seule — émise quand la facture existe, payée quand
-- Airwallex la dit payée. Trois ajouts pour le permettre :
--
--   • `vat_rate` — le board Monday affichait HT et TTC côte à côte. Le HT
--     reste la valeur stockée (`amount_cents`), le TTC se calcule ; le taux
--     est copié de l'engagement sur chaque ligne à la génération, puis
--     indépendant — même doctrine que le montant. Défaut à 0 : Antidotes
--     facture aujourd'hui sans TVA, un taux se choisit devis par devis.
--   • `matched_invoice_id` — le lien vers la facture Airwallex rapprochée.
--     Unique : une facture ne solde qu'une échéance. `on delete set null` :
--     si le miroir Finance est purgé puis resynchronisé, l'échéance garde son
--     statut — le lien est une trace, pas une dépendance.
--   • `archived_at` — l'archivage façon « Mon travail » : une payée descend
--     en bas de page au bout de deux mois, posé par la synchronisation ou à
--     la main. Un horodatage et non un statut : la ligne archivée reste une
--     payée.
-- ===========================================================================

alter table billing_engagements
  add column vat_rate numeric(5, 2) not null default 0.00
    check (vat_rate >= 0 and vat_rate <= 100);

alter table billing_installments
  add column vat_rate numeric(5, 2) not null default 0.00
    check (vat_rate >= 0 and vat_rate <= 100),
  add column matched_invoice_id uuid references finance_invoices (id) on delete set null,
  add column archived_at timestamptz;

/* Unicité et parcours de la FK d'un même geste : l'index partiel ignore les
   lignes non rapprochées — l'immense majorité — et suffit au `set null` du
   `on delete`, le prédicat étant impliqué par toute recherche d'égalité. */
create unique index billing_installments_matched_invoice_key
  on billing_installments (matched_invoice_id)
  where matched_invoice_id is not null;

/* Le rapprochement devient une étape du pipeline de synchronisation Finance,
   journalisée comme les autres. Ajout seul, sans usage dans ce fichier : une
   valeur d'enum ne peut pas servir dans la transaction qui la crée. */
alter type finance_sync_kind add value if not exists 'billing';
