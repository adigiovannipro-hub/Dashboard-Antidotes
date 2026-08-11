-- ===========================================================================
-- Planning Éditorial — archives et corbeille
--
-- Supprimer ne détruit plus : une publication part à la corbeille
-- (`deleted_at`), un mois aussi, et tout se restaure depuis l'en-tête du
-- tableau. L'archivage (`archived_at`) est le rangement volontaire — hors du
-- tableau, hors de la corbeille, récupérable de la même façon.
--
-- Des colonnes et non une table de côté : la ligne garde ses retours, ses
-- visuels et son journal, et la restauration est un simple retour à `null`.
-- ===========================================================================

alter table planning_subjects
  add column archived_at timestamptz,
  add column deleted_at timestamptz;

alter table planning_months
  add column deleted_at timestamptz;
