-- Trois colonnes que le connecteur Meta rapporte et que le schéma d'origine
-- ne portait pas : la portée et les deux premières marches de l'entonnoir.
--
-- La portée n'est pas strictement additive — la même personne touchée deux
-- jours compte deux fois dans la somme d'un mois. C'est l'approximation que
-- faisait déjà la chaîne Supermetrics → Looker qu'on remplace : on la garde,
-- au grain jour, plutôt que d'introduire une table par période qui ne saurait
-- pas répondre à une plage libre. La répétition (impressions / portée) en
-- hérite : légèrement sous-estimée, jamais inventée.
--
-- Pas de RLS à poser : la table est couverte par les politiques de 0002.

alter table ad_metrics_daily
  add column reach bigint not null default 0,
  add column add_to_cart bigint not null default 0,
  add column initiated_checkout bigint not null default 0;
