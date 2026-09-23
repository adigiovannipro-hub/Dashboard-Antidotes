# Témoin de vie et cadence réelle des synchronisations

Le piège n°1 du projet : un cron muet ne prévient personne. Une parade,
gratuite, à brancher une fois.

## La cadence

Plus de passage horaire depuis septembre 2026 — il consommait 4,7 fois le
quota mensuel de minutes Actions — et, depuis le 23/09, **deux passages par
jour** seulement dans `airwallex-sync.yml` : le soir (`0 15 * * *` UTC, portée
`quotidien` — Finance, publication du Planning, Factures, Reçus) et le matin
(`40 16 * * *` UTC, portée `matin` — Finance, Reçus, Inbox complète,
récupération des factures, seconde chance de publication). Ces heures tiennent
compte du retard de GitHub, qui lance les schedules de ce dépôt quatre à sept
heures après l'heure écrite : les deux passages atterrissent en pratique dans
la même soirée UTC, le matin avant 7h en GMT+8. Ce qui doit être frais à
l'ouverture d'un écran se relève depuis l'écran : Finance et Factures
déclenchent la portée `finance`, l'Inbox se relève elle-même sur Vercel.

## Healthchecks.io — le silence devient une alerte

1. Créer un compte gratuit sur https://healthchecks.io (20 checks gratuits).
2. Créer un check « Antidotes — passage programmé », period **1 day**,
   grace **6 hours**. Les deux passages tombent la même soirée UTC, puis plus
   rien pendant vingt à vingt-trois heures : trente heures de silence, c'est
   une journée entière sans passage, et c'est ce qu'on veut savoir. Les
   déclenchements depuis les écrans pingent aussi, ce qui ne trompe pas : le
   check mesure que le workflow tourne, pas qu'un schedule précis a eu lieu.
3. Copier l'URL de ping (`https://hc-ping.com/<uuid>`).
4. GitHub → dépôt → Settings → Secrets and variables → Actions → **New
   secret** : `HEARTBEAT_URL` = cette URL.

Dès lors, chaque passage vert du workflow ping l'URL, un échec ping `/fail`,
et **l'absence de ping** déclenche l'email d'alerte. Sans le secret, rien ne
change : le témoin est un bonus, jamais une dépendance.

## Pas de relance externe

La relance horaire par cron-job.org (un `workflow_dispatch` toutes les heures
pour doubler le schedule GitHub) n'a plus lieu d'être : elle rejouerait à
l'heure exactement la cadence qu'on vient de retirer, alors que les écrans
relancent déjà à l'ouverture ce qui doit l'être. Si le soir est sauté, le
matin rattrape la publication quand il tombe encore avant minuit à Paris ; le
rapprochement et les Reçus n'ont pas d'heure.

Si un jour l'heure exacte compte — un passage **à** 7h et non « avant le
lever » —, c'est un déclencheur externe qu'il faut, pas un `schedule` GitHub :
cron-job.org ou `pg_cron` de Supabase appelant l'API `workflow_dispatch` à la
minute, avec le jeton `GITHUB_SYNC_TOKEN`.

## Lire l'état

La page interne **/entreprise/syncs** (propriétaire) montre l'âge réel de
chaque donnée — reporting par source, modération par canal, workflow
Airwallex — et nomme les erreurs. C'est elle qu'on ouvre quand un chiffre
paraît vieux.
