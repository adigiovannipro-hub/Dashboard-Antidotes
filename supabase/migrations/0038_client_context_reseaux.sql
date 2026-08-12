-- Les réseaux sur lesquels un client publie, déclarés avec ses livrables.
--
-- Tous les clients ne sont pas sur les quatre mêmes réseaux : l'éditeur des
-- règles par plateforme proposait pourtant Instagram, Facebook, LinkedIn et
-- TikTok en dur, et la génération n'avait aucun moyen de savoir sur quoi
-- elle écrivait. La liste se déclare donc une fois, au même endroit que le
-- volume mensuel — c'est du contractuel, pas de la marque.
--
-- Comme pour le reste des livrables, le défaut porte la forme complète : une
-- lecture n'a jamais à parer un champ absent.
alter table client_context
  alter column deliverables
  set default '{"intentions": "", "publications": [], "reseaux": []}'::jsonb;

-- Les lignes déjà écrites gardent leur contenu et gagnent la clé manquante.
update client_context
   set deliverables = deliverables || '{"reseaux": []}'::jsonb
 where not (deliverables ? 'reseaux');
