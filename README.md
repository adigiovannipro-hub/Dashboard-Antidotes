# Antidotes

Plateforme de dashboards d'Antidotes. Une seule application, plusieurs **espaces** :
la vie perso, l'activité de l'entreprise, et un espace par client.

Elle remplace la chaîne **Supermetrics + Looker Studio** : les données des régies
sont synchronisées chaque jour et stockées en base, puis lues localement. Le
dashboard s'affiche instantanément, l'historique n'est plus limité par la
rétention des API, et le coût d'infrastructure reste nul.

Premier espace client livré : **Bondet — Meta**.

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
| `pnpm sync:planning` | Synchronise les plannings éditoriaux depuis Monday |
| `pnpm seed:planning` | Données de démonstration du Planning Édito |
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

## Modules internes

Deux outils d'agence vivent dans l'application, à côté des espaces de
reporting. Ils sont **internes** : aucun espace client n'expose de lien vers
eux, et leurs routes renvoient un 404 — et non un 403 — à qui n'y a pas accès.
Un client du dashboard n'apprend donc pas leur existence.

- **Planning Édito** (`/planning`) — les plannings éditoriaux Monday, mois par
  mois. Voir ci-dessous.
- **Modération** (`/moderation`) — messages et commentaires, réponses générées
  depuis la FAQ du client et validées à la main.

### Planning Édito

Le planning se fait dans Monday et continue de s'y faire : un board par client
et par année (`LUNETTES BONDET I PE 2026`), un groupe par mois, un élément
parent par plateforme, un sous-élément par contenu. Le module en est le miroir
local, et y ajoute ce que Monday ne sait pas faire — voir le mois d'un coup
d'œil, déduire la stratégie de l'historique, contrôler la cadence, dire ce qui
manque.

**L'écriture est asymétrique, et c'est le point important.** Tout est recopié
depuis Monday ; seuls le **Wording** et les **Commentaires** y sont réécrits.
`Status`, `Visuel`, `Propriétaire`, `Date`, `Thématique` et `OK client`
appartiennent au board et à la validation client. La règle est appliquée par le
code — `WRITABLE_FIELDS` dans
[`src/lib/planning/monday-mapping.ts`](src/lib/planning/monday-mapping.ts) — et
non seulement documentée : toute autre colonne lève. Un wording modifié est par
ailleurs mis en file d'attente et n'atteint Monday que sur action explicite.

Le mapping des colonnes est une **donnée**, jamais du code : les boards
divergent déjà entre clients (colonne `Commentaires` absente chez l'un, libellés
de `Thématique` et d'`Objectifs` différents, « AOUT » contre « AOÛT »). Il est
déduit à la découverte du board, stocké dans `planning_boards.column_mapping`,
et corrigeable à la main.

Pour voir le rendu sans rien brancher :

```sh
pnpm seed:planning     # sept mois de données de démonstration
```

Pour brancher le vrai Monday, renseigner `MONDAY_API_TOKEN` dans `.env.local`
— *Monday → avatar → Développeurs → Mes jetons d'accès* — puis :

```sh
pnpm sync:planning --discover   # recense les boards « CLIENT I PE ANNÉE »
pnpm sync:planning              # synchronise
pnpm sync:planning --archives   # inclut les archives, utiles à la stratégie
```

Sans jeton, rien ne casse : le module affiche ce qui est déjà en base et les
wordings restent en file d'attente.

## Documentation

- `docs/plan-planning-edito.md` — modèle de données et décisions du Planning Édito
- `docs/plan-moderation.md` — modèle de données et décisions de la Modération
- `docs/meta-setup.md` — création de l'app Meta et de l'utilisateur système *(étape 6)*
- `CLAUDE.md` — architecture, conventions, ajout d'un connecteur
