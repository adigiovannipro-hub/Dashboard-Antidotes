-- ===========================================================================
-- Échéances — l'archivage disparaît
--
-- Une mensualité payée descendait en « Archivé » au bout de soixante jours.
-- Le classement était de trop : une fois payé, c'est payé, et un second
-- rangement par-dessus n'apprend rien — il éloigne seulement l'historique
-- de l'endroit où on le cherche, dans « Payée ».
--
-- Les cent huit lignes rangées là remontent donc dans « Payée », qui devient
-- l'unique destination de ce qui est encaissé. La colonne survit sans être
-- ni posée ni lue : la retirer réécrirait des lignes pour rien, et un
-- `alter table drop column` sur une table vivante coûte un verrou exclusif
-- que ce nettoyage ne justifie pas.
-- ===========================================================================

update billing_installments
   set archived_at = null
 where archived_at is not null;

comment on column billing_installments.archived_at is
  'Vestige de l''archivage, retiré en 0028 : plus rien ne le pose ni ne le lit.';
