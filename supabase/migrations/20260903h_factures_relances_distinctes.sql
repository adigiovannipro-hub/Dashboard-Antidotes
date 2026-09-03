-- ===========================================================================
-- Factures — trois relances, trois textes
--
-- Les trois relances partageaient un modèle unique : la répétition à
-- l'identique était un choix assumé, il est retiré. Une deuxième relance qui
-- répète mot pour mot la première se lit comme un automate, et le client le
-- voit. Chacune a désormais son texte, et la gradation va vers **plus** de
-- chaleur, pas moins : celui qui n'a pas payé au bout de six semaines est
-- bien plus souvent débordé que de mauvaise foi.
--
-- L'objet, lui, reste commun aux trois — et identique à celui de l'envoi :
-- c'est ce qui garde les relances dans le fil de discussion de la facture
-- d'origine, chez le client comme dans notre boîte.
-- ===========================================================================

alter table billing_engagements
  rename column reminder_template to reminder_1_template;

alter table billing_engagements
  add column reminder_2_template text,
  add column reminder_3_template text;
