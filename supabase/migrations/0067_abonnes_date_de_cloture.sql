-- Un relevé d'abonnés porte la date du jour qu'il clôture, pas celle du
-- passage qui l'a lu.
--
-- Le passage quotidien tourne à 5 h UTC. Le relevé du 1er septembre est donc
-- le compte d'abonnés **à la fin du 31 août** — c'est le point de clôture
-- d'août, et il s'affichait sous « septembre » : chaque courbe avait un mois
-- d'avance, et le reporting d'août ne portait pas son propre chiffre.
--
-- La règle, désormais tenue par le connecteur : `date = veille du passage`.
-- Cette migration remet l'existant d'équerre : chaque relevé d'API recule
-- d'un jour. Les reprises Looker (`source = 'looker'`) sont déjà datées du
-- dernier jour du mois qu'elles décrivent — elles ne bougent pas.
--
-- Suppression puis réinsertion en un seul ordre : un `update … set date =
-- date - 1` bute sur la clé primaire dès que deux jours consécutifs
-- existent, Postgres vérifiant l'unicité ligne à ligne. Au conflit avec une
-- reprise Looker du même jour, la mesure d'API gagne — c'est la règle de
-- `import:followers`, on la garde.
with deplaces as (
  delete from social_followers
  where source = 'api'
  returning data_source_id, workspace_id, platform, date, followers_count
)
insert into social_followers
  (data_source_id, workspace_id, platform, date, followers_count, source, updated_at)
select
  data_source_id,
  workspace_id,
  platform,
  date - 1,
  followers_count,
  'api',
  now()
from deplaces
on conflict (data_source_id, platform, date) do update
  set followers_count = excluded.followers_count,
      source = 'api',
      updated_at = now();
