-- ===========================================================================
-- 0034 — Arrêt manuel d'un job de génération
--
-- Un job qui tourne bloque le bouton de sa carte : tant qu'il n'a pas rendu
-- son verdict, la phase n'a pas d'autre action possible. Sans issue de
-- secours, un appel qui traîne — ou une fonction coupée en vol — laisse la
-- carte inerte pendant les dix minutes de la purge des jobs muets.
--
-- `cancelled` est ce verdict-là : demandé par l'utilisateur, ni réussite ni
-- échec. La carte le distingue d'une erreur — elle repropose l'action
-- normale, pas une reprise en ton danger — et le worker s'en sert de point
-- d'arrêt entre deux lots de wording.
--
-- Pas de politique à ajouter : mêmes tables, mêmes règles que 0033.
-- ===========================================================================

-- Postgres 12 et suivants acceptent `add value` dans une transaction, tant
-- que la nouvelle valeur n'est pas utilisée avant le commit — ce fichier ne
-- l'utilise nulle part.
alter type generation_job_status add value if not exists 'cancelled';
