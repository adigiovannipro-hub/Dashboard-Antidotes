-- ===========================================================================
-- Reporting multi-clients — enums.
--
-- Fichier séparé du schéma qui les utilise : `alter type … add value` est
-- accepté dans une transaction (Postgres 12+), mais la nouvelle valeur reste
-- inutilisable jusqu'au commit. Le runner exécutant une transaction par
-- fichier, le premier usage n'arrive qu'en 0024.
-- ===========================================================================

-- L'organique Meta se connecte par réseau — une ligne data_sources = un
-- compte Instagram ou une Page Facebook. `meta_organic` (0001) reste déclaré
-- mais ne sera jamais peuplé : un enum Postgres ne perd pas ses valeurs.
alter type data_provider add value if not exists 'instagram_organic';
alter type data_provider add value if not exists 'facebook_organic';
alter type data_provider add value if not exists 'linkedin_organic';
alter type data_provider add value if not exists 'linkedin_ads';
alter type data_provider add value if not exists 'ga4';

alter type social_platform add value if not exists 'linkedin';

-- Dimensions du Persona organique. `region` du breakdown Ads reste à part :
-- les régies ne parlent pas la même géographie (régions publicitaires Meta
-- d'un côté, villes et pays des abonnés de l'autre).
create type audience_dimension as enum (
  'age',
  'gender',
  'city',
  'country',
  'industry',
  'job_function'
);
