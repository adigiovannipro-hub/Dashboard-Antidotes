# antidotes.agency — le site

Le one-page FR/EN de l'activité freelance. Projet Next.js autonome dans ce
dossier (son propre lockfile), déployé sur le projet Vercel `antidotes-agency`
(racine `site/`), base Supabase dédiée `antidotes-agency`.

## Mise en route

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Sans Supabase sous la main : `bash scripts/db-local.sh` (Postgres jetable qui
rejoue `supabase/migrations/`) puis `node scripts/rpc-shim.mjs` (simulateur de
l'API REST sur le port 3100) et `.env.local` pointant dessus.

## Variables (projet Vercel)

| Variable | Rôle |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | le projet dédié — la clé anon reste côté serveur |
| `SITE_DB_KEY` | exigée par chaque fonction SQL (`site_secrets.site_key`) |
| `CRON_SECRET` | jeton du cron quotidien `/api/cron/entretien` |
| `ADMIN_SECRET` | clé des routes `/api/admin/*` |
| `COMPOSIO_API_KEY` | **à poser à la main** — sans elle, les courriels attendent dans `outbox` et le rendez-vous se prend quand même (lien Jitsi) |
| `OWNER_EMAIL`, `OWNER_TIMEZONE`, `BOOKING_CALENDAR_ID` | l'agence : adresse notifiée, `Asia/Makassar`, agenda lu et écrit |
| `NEXT_PUBLIC_SITE_URL` | `https://antidotes.agency` |

## Les trois gestes après déploiement

1. Poser `COMPOSIO_API_KEY` sur le projet Vercel (la même que le dashboard) et redéployer.
2. Ouvrir `https://antidotes.agency/api/admin/calendrier?cle=<ADMIN_SECRET>` : la page renvoie vers l'autorisation Google Calendar de Composio ; `&etat=1` dit si un compte est branché.
3. Jouer la vraie chaîne : `https://antidotes.agency/api/admin/essai?cle=<ADMIN_SECRET>&vers=<adresse>&langue=fr` envoie le courriel d'accueil et une confirmation de rendez-vous d'essai par la boîte Gmail de l'agence. Les relire dans Gmail et sur un iPhone avant de considérer le tunnel livré.

## Ce que fait le tunnel

Treize questions → note /10 et température calculées côté serveur
(`src/lib/questionnaire.ts`) ; **la note n'est jamais rendue au visiteur**,
elle part à l'owner par courriel et se présente en rendez-vous. Réservation
de 30 min dans le fuseau du visiteur (`src/lib/booking/`), créneaux lun-ven
15h-21h à Bali, 24 h de préavis, 30 jours d'horizon, un index unique en base
contre la double réservation. Chaque étape écrit une ligne dans `outbox`,
vidée en `after()` puis par le cron.
