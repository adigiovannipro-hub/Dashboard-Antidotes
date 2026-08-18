# Antidotes

Plateforme de dashboards d'Antidotes. Une seule application, plusieurs **espaces** :
la vie perso, l'activité de l'entreprise, et un espace par client.

Elle remplace la chaîne **Supermetrics + Looker Studio** : les données des régies
sont synchronisées chaque jour et stockées en base, puis lues localement. Le
dashboard s'affiche instantanément, l'historique n'est plus limité par la
rétention des API, et le coût d'infrastructure reste nul.

Premier espace client livré : **Bondet**, avec son Planning Éditorial et son
Reporting Meta.

## Prérequis

- **Node.js ≥ 22** et **pnpm 10**
- Un projet **Supabase** (tier gratuit suffisant)

Node est installé dans `~/.local/node` sur cette machine. Pour l'avoir en
permanence dans le shell, ajouter à `~/.zshrc` :

```sh
export PATH="$HOME/.local/node/bin:$PATH"
```

## Installation

```sh
pnpm install
cp .env.example .env.local   # puis renseigner les valeurs
pnpm dev
```

L'application démarre sur http://localhost:3000.

## Variables d'environnement

Toutes documentées dans [`.env.example`](.env.example). Les trois secrets à
générer soi-même :

```sh
openssl rand -base64 32   # CREDENTIALS_ENCRYPTION_KEY
openssl rand -hex 32      # CRON_SECRET
```

`SUPABASE_SERVICE_ROLE_KEY` contourne la RLS : elle ne doit jamais être
préfixée `NEXT_PUBLIC_` ni atteindre le navigateur.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Tests unitaires et tests d'isolation RLS (Vitest) |
| `pnpm test:e2e` | Tests end-to-end (Playwright) |
| `pnpm db:migrate` | Applique les migrations manquantes |
| `pnpm db:status` | Liste les migrations en attente sans rien appliquer |
| `pnpm sync` | Lance une synchronisation des sources de données |
| `pnpm import:monday` | Reprend un planning éditorial depuis Monday |
| `pnpm seed:planning` | Amorce le Planning Éditorial de Bondet |
| `pnpm seed:moderation` | Données de démonstration de la Modération |
| `pnpm seed:finance` | Données de démonstration du module Finance |

## Base de données

Les migrations vivent dans `supabase/migrations/`, numérotées et appliquées
dans l'ordre. `pnpm db:migrate` les joue une par une, chacune dans sa propre
transaction, et retient ce qui a déjà tourné dans `app.schema_migrations`.

Cela demande `SUPABASE_DB_URL` : bouton **Connect** en haut du tableau de bord
Supabase, option **Session pooler**, en remplaçant `[YOUR-PASSWORD]` par le mot
de passe de la base. Deux repères pour la reconnaître — l'hôte contient
`pooler.supabase.com`, le port est `5432`.

Pas « Direct connection » : elle n'écoute qu'en IPv6, et les runners GitHub
Actions n'ont que de l'IPv4 — la connexion échouerait sur une erreur réseau
qui ne dit pas son nom. Pas « Transaction pooler » (port 6543) non plus : il
ne tient pas les transactions dont chaque migration a besoin.

**Sans terminal**, tout cela se déclenche depuis *Actions → Base de données →
Run workflow* ; le seul secret nécessaire pour appliquer les migrations et
amorcer les données est `SUPABASE_DB_URL`.

À défaut, le contenu des fichiers peut être collé tel quel dans le SQL Editor
de Supabase, dans l'ordre des numéros :

```sh
cat supabase/migrations/*.sql | pbcopy
```

## Sécurité

> ⚠️ **L'application est actuellement en accès ouvert.** Aucune connexion n'est
> demandée, et toute personne disposant de l'URL voit l'ensemble des espaces :
> plannings, budgets de sponsorisation, captions, chiffres de performance,
> trésorerie.
>
> C'est un choix assumé le temps de la mise au point, écrit en clair plutôt que
> subi : la constante `OUVERT_PENDANT_LA_CONSTRUCTION` dans
> [`src/lib/access-mode.ts`](src/lib/access-mode.ts). La passer à `false`
> referme partout — le code d'authentification est resté entièrement en place.
> Pour refermer un seul environnement sans toucher au code :
>
> ```sh
> ANTIDOTES_OPEN_ACCESS=false
> ```
>
> Tant que l'accès est ouvert, un bandeau rouge « Accès public » s'affiche dans
> l'en-tête. Une application ouverte qu'on croit fermée est bien plus dangereuse
> qu'une application ouverte qu'on sait ouverte. À refermer **avant** d'ajouter
> un deuxième client : ses données ne vous appartiennent pas.
>
> Détail du mécanisme : [`src/lib/access-mode.ts`](src/lib/access-mode.ts).

Une fois l'authentification rétablie, l'isolation entre espaces est appliquée
**dans la base**, par la RLS, et non dans l'interface : un client qui
interrogerait l'API REST directement avec son propre jeton n'obtiendrait
toujours aucune ligne d'un autre espace.
[`tests/isolation.test.ts`](tests/isolation.test.ts) le prouve en ouvrant de
vraies sessions et en tentant les accès interdits.

Le rôle `anon` n'a aucun droit de lecture. Les pages de partage public sont
rendues côté serveur après validation du token, avec la clé `service_role`.

## Précision des chiffres

Le dictionnaire des métriques vit dans
[`src/lib/metrics/definitions.ts`](src/lib/metrics/definitions.ts) et fait
autorité. Deux règles y sont vérifiées par des tests :

1. **Les ratios sont toujours recalculés depuis les agrégats bruts** de la
   période affichée. Seules des grandeurs additives sont stockées en base ; une
   moyenne de moyennes donnerait des chiffres faux.
2. **Les définitions reproduisent celles du rapport Looker Studio existant**,
   validées sur les totaux réels de juin 2026 — y compris ses particularités :
   `CPL` est un coût par *landing page view*, et le `CTR` utilise les clics sur
   lien alors que la colonne `Clics` utilise tous les clics. Ce dernier point est
   basculable via `ClickAttributionMode`.

## Le Planning Éditorial

Chaque espace client porte deux sections : **Planning Éditorial** et
**Reporting**. Le planning passe avant, parce qu'on prépare le mois en cours
bien plus souvent qu'on ne relit les chiffres du mois dernier.

Le Planning Éditorial remplace le board Monday du client, avec la même
structure et le même vocabulaire :

```
Planning Éditorial 2026        FAQ
└── SEPTEMBRE                  └── questions / réponses
    └── META                       (enrichie par la Modération)
        ├── ANNONCE SILMO
        └── RELANCE SILMO J-7
```

Un tableau par année, un groupe par mois, un couloir par réseau, une ligne par
publication. Les colonnes : Sujet, retours client, Propriétaire, Statut, Type,
Date, Visuel, Wording, Sponsorisation, Objectif et Statut Ads. Tout s'édite
dans la cellule, sans bouton « enregistrer ».

Les statuts et les couleurs sont ceux du board d'origine — `EN COURS` en
orange, `PUBLIÉ` en vert. L'équipe lit ce tableau depuis des mois.

```sh
pnpm seed:planning     # août et septembre, pour voir le tableau vivre
```

Pour reprendre une année déjà saisie dans Monday, renseigner
`MONDAY_API_TOKEN` dans `.env.local` — *Monday → avatar → Développeurs → Mes
jetons d'accès* — puis :

```sh
pnpm import:monday --list
pnpm import:monday --workspace=bondet --board=pe-2026 --monday=<id>
```

L'échange est **à sens unique et ponctuel** : après l'import, le dashboard fait
autorité et rien n'est jamais réécrit dans Monday. Deux outils qui s'écrivent
mutuellement, ce sont deux vérités et un conflit à chaque modification.

## Module interne — Modération

La Modération (`/moderation`) est le seul outil qui ne vit pas dans un espace
client. Elle est **interne** : aucun espace n'expose de lien vers elle, et ses
routes renvoient un 404 — et non un 403 — à qui n'y a pas accès. Un client
n'apprend donc pas son existence. Elle alimente en revanche la FAQ que ce
client voit dans sa propre section Planning Éditorial.

## Module Reçus

`/entreprise/recus` automatise la collecte des justificatifs : les factures
reçues par mail sont identifiées, rapprochées de la dépense carte Airwallex
correspondante, puis transférées à la boîte de reçus d'Airwallex — qui les
accroche à la ligne de frais.

L'API Airwallex ne permet pas de déposer une pièce jointe : le transfert de mail
est le seul chemin d'écriture. Le module ne range donc pas la pièce, il l'envoie
puis **vérifie** en relisant l'API qu'elle s'est bien accrochée. Ce qui ne
s'accroche pas ressort dans l'écran, à rattacher à la main.

L'auto-transfert est désactivé par défaut et se mérite fournisseur par
fournisseur : trois validations manuelles concordantes avant que l'automatisme
soit proposé. Un rapprochement ambigu ou un fournisseur jamais approuvé ne
partent jamais seuls, quel que soit le réglage.

Mise en place — Google Cloud, clés Airwallex, cron : [`docs/recus-setup.md`](docs/recus-setup.md).

## Module Finance

`/entreprise/finance` est la vue d'ensemble comptable : facturation à venir par
client, trésorerie EUR consolidée, évolution du solde sur 7, 30 ou 90 jours,
et le tableau des dépenses carte — la réplique locale de l'écran Airwallex,
avec ses deux montants par ligne (« 158 800 IDR, financé avec 7,73 € »).

Le dashboard ne parle jamais à Airwallex : une synchronisation écrira dans
Supabase, l'écran lit la base, et la bannière dit de quand datent les
chiffres. L'historique de solde n'existera que par les instantanés que chaque
passage déposera — l'API ne rend aucun passé.

La synchronisation tourne **sur une machine GitHub**
(`.github/workflows/airwallex-sync.yml`), pas sur Vercel : Airwallex refuse les
adresses IP de l'hébergeur, et le plan Hobby rejette de toute façon tout
déploiement demandant mieux qu'un cron quotidien. Ses clés se posent dans
*Settings → Secrets and variables → Actions* — la liste est en tête du
workflow.

Elle a **deux déclencheurs**. Un passage programmé toutes les heures, qui fait
le fond ; et **l'ouverture de Finance ou d'Échéances**, qui la relance quand
la dernière remonte à plus de dix minutes. Le second n'est pas un confort : un
`cron` GitHub est une intention, pas une garantie — près d'une exécution
horaire sur deux n'a jamais lieu, avec des trous de plusieurs heures, et rien
ne le signale. L'en-tête des deux écrans dit l'âge des chiffres en clair,
passe en ambre au-delà de quatre-vingt-dix minutes, et porte un bouton
« Synchroniser » pour ne pas attendre les dix minutes.

Ce déclenchement demande un jeton GitHub à portée fine — `GITHUB_SYNC_TOKEN`,
droit *Actions : read and write* sur ce seul dépôt — posé sur Vercel. Sans
lui, le passage horaire continue et l'écran dit que la relance est
indisponible plutôt que d'offrir un bouton mort.

Le dépôt s'administre **sans terminal** : le workflow *Base de données*
(*Actions → Base de données → Run workflow*) applique les migrations, amorce
les données de démonstration et lance les tests d'isolation RLS contre la
vraie base, au choix.

`finance_transactions` a vocation à devenir l'unique miroir des dépenses
Airwallex : le module Reçus s'y rebranchera, et `receipt_expenses` disparaîtra
avec sa prochaine phase. Les intégrations (Airwallex, justificatifs par photo)
arrivent en phase 2 ; en attendant, `pnpm seed:finance` remplit l'écran d'un
jeu réaliste.

## Documentation

- `docs/plan-planning-edito.md` — modèle de données et décisions du Planning Éditorial
- `docs/plan-moderation.md` — modèle de données et décisions de la Modération
- `docs/meta-setup.md` — création de l'app Meta et de l'utilisateur système *(étape 6)*
- `docs/recus-setup.md` — accès Gmail, clés Airwallex et cadence du cron
- `CLAUDE.md` — architecture, conventions, ajout d'un connecteur
