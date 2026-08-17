-- Les réseaux qu'un client peut déclarer, côté connexions.
--
-- `social_account_kind` ne connaissait que ce que le branchement Meta rapporte,
-- plus LinkedIn et TikTok posés d'avance. Le Contexte, lui, propose déjà
-- YouTube, Pinterest, X et Threads dans ses livrables — et un client qui les
-- déclare au contrat n'avait aucune ligne en face dans l'écran des connexions.
-- L'écran mentait par omission : « il manque des réseaux » est exactement ça.
--
-- Ces valeurs n'ont pas de connecteur aujourd'hui, et l'écran le dit. Les
-- déclarer ici sert à ce que la liste des réseaux d'un client soit la **même**
-- des deux côtés : ce qu'on doit livrer, et ce qu'il faut brancher pour le
-- livrer. Le jour où un connecteur arrive, il n'y a rien d'autre à changer.
--
-- Aucune table n'est touchée, aucune politique n'est donc à reprendre.
--
-- Note pour la relecture : `add value` s'exécute sans problème dans la
-- transaction du runner depuis Postgres 12, à une condition — ne pas
-- **utiliser** la valeur dans la même transaction. C'est pour ça qu'il n'y a
-- ici aucun insert ni aucun cast vers les nouvelles valeurs. Rejoué sur un
-- Postgres 16 jetable avant d'être poussé.

alter type social_account_kind add value if not exists 'youtube';
alter type social_account_kind add value if not exists 'pinterest';
alter type social_account_kind add value if not exists 'x';
alter type social_account_kind add value if not exists 'threads';
alter type social_account_kind add value if not exists 'snapchat';
