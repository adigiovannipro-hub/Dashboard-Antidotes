-- ===========================================================================
-- Savoir quel mail a déjà été rangé
--
-- Le transfert sort le mail de la boîte de réception. Sans trace de ce geste,
-- impossible de rattraper ceux partis avant que le droit d'écriture existe —
-- et impossible de le faire sans réessayer, à chaque passage horaire, sur
-- toutes les pièces déjà rangées.
--
-- Une date et non un booléen : « quand » répond aussi à « est-ce fait », et
-- distingue un rangement d'hier d'un rangement de tout à l'heure quand on
-- cherche pourquoi un mail est réapparu.
-- ===========================================================================

alter table receipt_documents
  add column if not exists gmail_archived_at timestamptz;

-- Le rattrapage cherche l'inverse : transféré, pas encore rangé. Index partiel
-- pour que cette recherche horaire ne parcoure pas toute la table.
create index if not exists receipt_documents_a_ranger_idx
  on receipt_documents (org_id, forwarded_at)
  where forwarded_at is not null and gmail_archived_at is null;
