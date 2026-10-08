# Base du site

Projet Supabase dédié `antidotes-agency` (`htaqnexyfmkjqewbenkn`, eu-west-3). Les
migrations de ce dossier ont été appliquées par le MCP Supabase dans l'ordre ;
elles sont gardées ici pour mémoire et pour le rejeu local (`scripts/db-local.sh`).

Aucune table n'est lisible ni modifiable par l'API REST : la RLS est activée
sans politique, et toute lecture/écriture passe par des fonctions
`security definer` qui exigent la clé du site (`site_secrets.site_key`,
variable `SITE_DB_KEY` côté Vercel). Le serveur Next.js est le seul appelant.
