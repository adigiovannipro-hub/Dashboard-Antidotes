-- Quels événements personnalisés comptent comme un achat, client par client.
--
-- 0051 a rangé les événements pixel personnalisés à part des achats, et c'est
-- le bon défaut : « Validation Shop Lyon » n'est pas une vente pour tout le
-- monde. Chez I-WAY, si. Le client tranche donc lui-même, compte par compte —
-- il n'y a pas de règle générale à écrire, seulement un réglage à offrir.
--
-- La colonne vit sur `data_sources` et non sur `workspaces` : c'est une façon
-- de **lire un compte publicitaire**, et un espace peut en porter plusieurs.
--
-- Le rapprochement se fait **à la lecture**, jamais au moment de la collecte.
-- Deux raisons, et les deux comptent : les lignes collectées restent fidèles à
-- ce que Meta a répondu — on peut donc changer d'avis sans resynchroniser un
-- an d'historique — et un réglage modifié prend effet immédiatement.

alter table data_sources
  add column purchase_event_names text[] not null default '{}';

comment on column data_sources.purchase_event_names is
  'Noms d''événements pixel personnalisés à compter comme achats à la lecture. Vide = aucun, ce qui est le défaut.';
