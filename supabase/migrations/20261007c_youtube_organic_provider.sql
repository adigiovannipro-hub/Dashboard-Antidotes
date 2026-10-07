-- YouTube rejoint les sources du Reporting.
--
-- La chaîne d'un client est déjà branchée en direct à Google pour l'Inbox
-- (`social_account_secrets`, jeton rafraîchissable). Le connecteur de
-- Reporting (`src/lib/connectors/youtube/reporting-sync.ts`) réutilise ce
-- branchement et range vidéos et abonnés sous cette source, dans les mêmes
-- tables qu'Instagram et TikTok. Valeur d'enum seule, sans usage dans la même
-- transaction : `add value` passe dans la transaction du runner.

alter type data_provider add value if not exists 'youtube_organic';
