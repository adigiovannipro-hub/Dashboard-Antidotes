-- ===========================================================================
-- Planning Éditorial — destinataires d'un retour
--
-- « Taguer un e-mail » dans un retour : le retour part aussi par e-mail au
-- client ou au membre visé, via la boîte Gmail déjà connectée aux Reçus.
-- La liste d'adresses est portée par le retour lui-même — c'est la trace de
-- qui a été prévenu, pas une file d'envoi : l'envoi se joue au moment de
-- l'écriture, et un échec d'e-mail ne perd jamais le retour.
-- ===========================================================================

alter table planning_comments
  add column mentions text[] not null default '{}';
