-- ===========================================================================
-- Module Reçus — les deux montants d'une dépense
--
-- Le miroir `receipt_expenses` ne portait qu'un montant, et le normaliseur
-- choisissait le débité (« 7,56 EUR ») plutôt que le local (« 154 400 IDR »).
-- Or c'est le montant local que portent les reçus : un e-reçu Grab dit
-- 154 400 IDR, jamais 7,56 EUR. Le rapprochement comparait donc deux nombres
-- qui ne pouvaient jamais coïncider, et refusait tout — constaté sur les
-- premières vraies pièces le 7 août.
--
-- Même modèle que `finance_transactions` : le montant local en colonne
-- principale, le débité à côté. Rien n'est converti, jamais.
-- ===========================================================================

alter table receipt_expenses
  add column if not exists billing_amount_cents bigint,
  add column if not exists billing_currency char(3);

comment on column receipt_expenses.billing_amount_cents is
  'Ce qui a réellement quitté le wallet, en centimes — null tant qu''Airwallex n''a pas fixé le débit.';
comment on column receipt_expenses.billing_currency is
  'Devise du débit. La colonne amount_cents/currency porte le montant local, celui des reçus.';
