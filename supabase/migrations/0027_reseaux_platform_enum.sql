-- Le Reporting ouvre des pages LinkedIn, YouTube et X : l'enum des
-- plateformes sociales doit savoir ranger leurs relevés d'abonnés le jour où
-- un connecteur — ou une reprise Looker — en pose. TikTok y est déjà (0001).
--
-- Additif seulement : aucune table, aucune politique, aucune donnée ne
-- change. Postgres accepte `add value` en transaction tant que la valeur
-- n'est pas utilisée dans la même transaction — c'est le cas ici.
alter type social_platform add value if not exists 'linkedin';
alter type social_platform add value if not exists 'youtube';
alter type social_platform add value if not exists 'x';
