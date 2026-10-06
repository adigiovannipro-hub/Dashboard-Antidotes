-- X organique rejoint les sources du Reporting.
--
-- `data_provider` connaissait déjà `tiktok_organic` depuis 0001 ; X n'y
-- était pas. Le connecteur (`src/lib/connectors/composio-social/`) range le
-- fil et les abonnés d'un compte X sous cette source, dans les mêmes tables
-- que LinkedIn et Instagram. Valeur d'enum seule, sans usage dans la même
-- transaction : `add value` passe dans la transaction du runner.

alter type data_provider add value if not exists 'x_organic';
