-- ===========================================================================
-- Archiver une pièce dont on s'est occupé ailleurs
--
-- Le module savait dire deux choses d'une pièce : elle attend, ou elle est
-- partie. Il manquait le geste le plus fréquent une fois l'automatisme en
-- place — « je l'ai rangée à la main dans Airwallex ». Ces pièces-là restaient
-- dans la liste de travail en « non rapproché », sans aucun bouton pour les en
-- sortir.
--
-- « Ignoré » ne pouvait pas servir : il veut dire « ce mail n'est pas une
-- pièce comptable » et retire son automatisme au fournisseur. Archiver ne
-- reproche rien à personne.
--
-- Ajout seul, sans usage dans ce fichier : une valeur d'enum ne peut pas
-- servir dans la transaction qui la crée.
-- ===========================================================================

alter type receipt_status add value if not exists 'archived';
