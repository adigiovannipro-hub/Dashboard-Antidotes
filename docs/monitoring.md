# Témoin de vie et cadence réelle des synchronisations

Le piège n°1 du projet : un cron muet ne prévient personne. Une parade,
gratuite, à brancher une fois.

## La cadence

Plus de passage horaire depuis septembre 2026 — il consommait 4,7 fois le
quota mensuel de minutes Actions. `airwallex-sync.yml` a **huit créneaux par
jour**, dont GitHub n'en livre qu'une partie : quatre passages `quotidien`
(05h40, 11h40, 15h40, 19h40 UTC — Finance, publication du Planning, Factures,
Reçus), deux passages `publication` (17h40 et 21h40 UTC — la seule publication
du Planning, pour que la fenêtre 16h–minuit Paris ne dépende pas d'un créneau
sauté) et une passe nocturne `moderation-complet` sur deux créneaux (02h10 et
04h10 UTC — la réparation de l'Inbox et la réindexation de la FAQ ; le second
ne fait que rattraper le premier). Ce qui doit être frais à l'ouverture d'un
écran se relève depuis l'écran : Finance et Factures déclenchent la portée
`finance`, l'Inbox se relève elle-même sur Vercel.

## Healthchecks.io — le silence devient une alerte

1. Créer un compte gratuit sur https://healthchecks.io (20 checks gratuits).
2. Créer un check « Antidotes — passage programmé », period **6 hours**,
   grace **2 hours**. Le plus long creux normal est celui du soir (21h40 →
   02h10, quatre heures et demie) : huit heures de silence, c'est plusieurs
   passages sautés d'affilée, et c'est ce qu'on veut savoir. Les déclenchements depuis les écrans
   pingent aussi, ce qui ne trompe pas : le check mesure que le workflow
   tourne, pas qu'un schedule précis a eu lieu.
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
relancent déjà à l'ouverture ce qui doit l'être. Si un passage programmé est
sauté, le suivant rattrape — la publication du Planning a sa fenêtre de 16h à
minuit, le rapprochement et les Reçus n'ont pas d'heure.

## Lire l'état

La page interne **/entreprise/syncs** (propriétaire) montre l'âge réel de
chaque donnée — reporting par source, modération par canal, workflow
Airwallex — et nomme les erreurs. C'est elle qu'on ouvre quand un chiffre
paraît vieux.
