-- ===========================================================================
-- Nettoyage — la ligne `dashboards` qui doublait le Planning Éditorial
--
-- La section Planning Éditorial vit sur sa propre route (`/planning`) depuis
-- la migration 0006 : la navigation l'affiche d'office dès qu'un tableau
-- existe. Une ligne `dashboards` posée avant cette bascule la faisait donc
-- apparaître deux fois dans la navigation de l'espace.
--
-- Idempotent : réexécutable sans effet de bord.
-- ===========================================================================

delete from dashboards
where slug = 'planning'
   or lower(trim(name)) in ('planning éditorial', 'planning editorial');
