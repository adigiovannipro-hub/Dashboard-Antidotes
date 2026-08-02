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

## Base de données

Les migrations vivent dans `supabase/migrations/`, numérotées et appliquées
dans l'ordre. `pnpm db:migrate` les joue une par une, chacune dans sa propre
transaction, et retient ce qui a déjà tourné dans `app.schema_migrations`.

Cela demande `SUPABASE_DB_URL` dans `.env.local` — *Project Settings →
Database → Connection string (URI)*, en remplaçant `[YOUR-PASSWORD]` par le mot
de passe de la base.

À défaut, le contenu des fichiers peut être collé tel quel dans le SQL Editor
de Supabase, dans l'ordre des numéros :

```sh
cat supabase/migrations/*.sql | pbcopy
```

## Sécurité

L'isolation entre espaces est appliquée **dans la base**, par la RLS, et non
dans l'interface : un client qui interrogerait l'API REST directement avec son
propre jeton n'obtiendrait toujours aucune ligne d'un autre espace.
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

## Documentation

- `docs/plan-planning-edito.md` — modèle de données et décisions du Planning Éditorial
- `docs/plan-moderation.md` — modèle de données et décisions de la Modération
- `docs/meta-setup.md` — création de l'app Meta et de l'utilisateur système *(étape 6)*
- `docs/recus-setup.md` — accès Gmail, clés Airwallex et cadence du cron
- `CLAUDE.md` — architecture, conventions, ajout d'un connecteur
