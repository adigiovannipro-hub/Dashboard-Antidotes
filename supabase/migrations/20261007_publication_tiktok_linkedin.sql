-- ===========================================================================
-- Publication automatique : TikTok en brouillon, LinkedIn sur le profil.
--
-- Trois valeurs d'enum, ni table ni politique :
--
--   • `publish_target` gagne `tiktok` et `linkedin` — un couloir TikTok ou
--     LinkedIn du planning a désormais où partir ;
--   • `publish_run_status` gagne `awaiting` : un brouillon TikTok est envoyé
--     dans l'application du compte, et la ligne attend que quelqu'un appuie
--     sur « publier ». Ce n'est ni un succès (rien n'est en ligne) ni un
--     échec, et la ligne reste un verrou — le brouillon n'est jamais renvoyé ;
--   • `social_account_kind` gagne `linkedin_profile` : le profil personnel du
--     client, branché par son propre login, à côté de la page entreprise
--     (`linkedin`) qui porte les chiffres du Reporting.
--
-- `add value` passe dans la transaction du runner depuis Postgres 12 tant que
-- la valeur n'est pas utilisée dans la même transaction — ce qu'on ne fait pas.
-- ===========================================================================

alter type publish_target add value if not exists 'tiktok';
alter type publish_target add value if not exists 'linkedin';
alter type publish_run_status add value if not exists 'awaiting';
alter type social_account_kind add value if not exists 'linkedin_profile';
