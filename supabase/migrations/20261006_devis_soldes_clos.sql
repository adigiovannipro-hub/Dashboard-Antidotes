-- Les devis déjà soldés passent « Terminé ».
--
-- Depuis le 6/10/2026, un devis se clôt tout seul au moment où sa dernière
-- mensualité est payée (`src/lib/billing/settle.ts`, appelée par le
-- rapprochement Airwallex et par le bouton « Payée »). La règle porte sur la
-- transition, pas sur un balayage — un devis rouvert à la main ne doit pas se
-- refermer au passage suivant. Elle ne rattrape donc pas ce qui était soldé
-- avant elle : c'est l'objet de cette migration, jouée une fois.
--
-- Soldé : au moins une mensualité payée, et toutes les autres payées ou
-- passées — même définition que `isEngagementSettled` (`delivery.ts`).

update billing_engagements as engagement
set status = 'ended'
where engagement.status = 'active'
  and exists (
    select 1
    from billing_installments as line
    where line.engagement_id = engagement.id
      and line.status = 'paid'
  )
  and not exists (
    select 1
    from billing_installments as line
    where line.engagement_id = engagement.id
      and line.status not in ('paid', 'skipped')
  );
