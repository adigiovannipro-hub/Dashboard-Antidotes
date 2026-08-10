-- ===========================================================================
-- Planning Éditorial — étiquettes libres et largeurs de colonnes
--
-- « + Nouvelle étiquette » doit marcher partout : Statut, Type, Statut Ads,
-- comme sur le board d'origine. Or ces trois colonnes étaient des enums : une
-- étiquette inventée n'avait nulle part où s'écrire.
--
-- Les colonnes passent donc en texte. Les valeurs connues gardent leurs
-- identifiants (`published`, `reel`…) — rien ne bouge pour l'existant — et les
-- étiquettes ajoutées écrivent le leur. La liste des valeurs proposées vit dans
-- `planning_columns.settings`, où elle était déjà pour les colonnes ajoutées :
-- le modèle des étiquettes devient le même partout.
--
-- Les types enum ne sont pas supprimés : d'anciens fichiers SQL les castent
-- encore, et un cast enum → text est implicite. Ils restent en sommeil.
-- ===========================================================================

alter table planning_subjects
  alter column status drop default,
  alter column status type text using status::text,
  alter column status set default 'idea',
  alter column format drop default,
  alter column format type text using format::text,
  alter column format set default 'post',
  alter column ad_status type text using ad_status::text;

-- Largeur d'une colonne, en pixels, posée par la poignée de redimensionnement.
-- `null` : la largeur par type, définie dans le code.
alter table planning_columns
  add column width integer
  check (width is null or (width between 60 and 900));
