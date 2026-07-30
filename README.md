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
| `pnpm test` | Tests unitaires (Vitest) |
| `pnpm test:e2e` | Tests end-to-end (Playwright) |
| `pnpm sync` | Lance une synchronisation des sources de données |

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

## Documentation

- `docs/meta-setup.md` — création de l'app Meta et de l'utilisateur système *(étape 6)*
- `CLAUDE.md` — architecture, conventions, ajout d'un connecteur
