-- Livrables mensuels d'un client : ce qu'on lui doit chaque mois, et quand les
-- intentions lui sont livrées.
--
-- La donnée est contractuelle : elle vient du devis, pas des documents de
-- marque. La consolidation ne la propose donc jamais — un volume de
-- publications inventé par un modèle se lirait comme un engagement.
--
-- Forme : {"intentions": "le 20 du mois précédent",
--          "publications": [{"categorie": "Reels", "quantite": 2}]}
--
-- Le défaut porte la forme complète et non `{}` : Postgres l'applique aussi
-- aux lignes déjà en base, ce qui évite d'avoir à parer un objet vide à
-- chaque lecture. Clés en français, comme les piliers : c'est une donnée
-- produit injectée telle quelle dans les prompts, pas un identifiant de code.
alter table client_context
  add column if not exists deliverables jsonb not null
  default '{"intentions": "", "publications": []}'::jsonb;
