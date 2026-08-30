# Témoin de vie et cadence réelle des synchronisations

Le piège n°1 du projet : un cron muet ne prévient personne. Deux parades,
toutes deux gratuites, à brancher une fois.

## 1. Healthchecks.io — le silence devient une alerte

1. Créer un compte gratuit sur https://healthchecks.io (20 checks gratuits).
2. Créer un check « Antidotes — sync horaire », period **1 hour**, grace **90
   minutes** (le schedule GitHub saute des passages : 90 min évitent les faux
   positifs, deux passages manqués alertent).
3. Copier l'URL de ping (`https://hc-ping.com/<uuid>`).
4. GitHub → dépôt → Settings → Secrets and variables → Actions → **New
   secret** : `HEARTBEAT_URL` = cette URL.

Dès lors, chaque passage vert du workflow ping l'URL, un échec ping `/fail`,
et **l'absence de ping** déclenche l'email d'alerte. Sans le secret, rien ne
change : le témoin est un bonus, jamais une dépendance.

## 2. cron-job.org — une cadence horaire réellement horaire

Le `schedule` GitHub est une intention (près d'un passage sur deux sauté,
relevé les 18 et 30/08/2026). Un déclencheur externe le double :

1. GitHub → Settings → Developer settings → Fine-grained token, portée ce
   seul dépôt, permission **Actions: Read and write** (le même modèle que
   `GITHUB_SYNC_TOKEN`, un jeton dédié est plus propre).
2. Compte gratuit sur https://cron-job.org → **Create cronjob** :
   - URL : `https://api.github.com/repos/adigiovannipro-hub/Dashboard-Antidotes/actions/workflows/airwallex-sync.yml/dispatches`
   - Méthode POST, corps `{"ref":"main"}`
   - En-têtes : `Authorization: Bearer <jeton>`, `Accept: application/vnd.github+json`, `User-Agent: antidotes-cron`
   - Cadence : toutes les heures, minute 5 (décalée de la minute 17 du
     schedule GitHub : deux déclencheurs, deux créneaux — la `concurrency`
     du workflow absorbe un éventuel doublon sans travail double).
3. Vérifier au premier passage : Actions → une exécution `workflow_dispatch`
   à la minute 5.

## Lire l'état

La page interne **/entreprise/syncs** (propriétaire) montre l'âge réel de
chaque donnée — reporting par source, modération par canal, workflow
Airwallex — et nomme les erreurs. C'est elle qu'on ouvre quand un chiffre
paraît vieux.
