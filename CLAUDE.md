# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Langue

Tout est en français : l'interface, les commentaires, les messages de commit,
la documentation. Les réponses aux utilisateurs aussi.

## Commandes

```sh
pnpm dev                # serveur de développement (http://localhost:3000)
pnpm build              # build de production
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest run — unitaires + isolation RLS
pnpm test:watch         # vitest en continu
npx vitest run src/lib/planning/cadence.test.ts   # un seul fichier de test
pnpm test:e2e           # Playwright (nécessite l'app qui tourne)
pnpm db:migrate         # applique les migrations manquantes (SUPABASE_DB_URL requis)
pnpm db:status          # migrations en attente, sans rien appliquer
pnpm seed:planning      # amorce le Planning Éditorial de Bondet
pnpm seed:moderation    # données de démonstration de la Modération
pnpm import:monday      # reprise ponctuelle d'un board Monday (MONDAY_API_TOKEN)
```

L'environnement se copie depuis `.env.example` vers `.env.local`. Les tests
d'isolation (`tests/*.test.ts`) interrogent une vraie base Supabase : sans
`SUPABASE_DB_URL` ni clés, ils échouent — c'est attendu hors environnement
équipé.

## Architecture

Next.js 16 (App Router, Server Components par défaut) + TypeScript strict +
Tailwind v4 + Supabase (Postgres, RLS, magic link) + Recharts. Les composants
UI de `src/components/ui/` sont générés par shadcn **sur les primitives Base
UI** (`@base-ui/react`), pas Radix — les APIs diffèrent (prop `render`,
`nativeButton`, data-attributes `data-open`/`data-closed`).

Une seule application, plusieurs **espaces** (workspaces : `personal`,
`business`, `client`), plus des **outils internes** hors espace :

- `/` — hub : cartes des espaces + outils internes visibles selon le rôle
- `/espace/[workspace]/planning/[board]` — Planning Éditorial (miroir Monday)
- `/espace/[workspace]/[dashboard]` — Reporting (données des régies)
- `/moderation` — outil interne ; renvoie **404, jamais 403**, à qui n'y a pas
  accès : un client ne doit pas apprendre que le module existe
- `/entreprise/recus` — outil interne (mails → factures → Airwallex), même
  politique 404
- `/admin/acces` — invitations, réservé au rôle `owner`

La structure détaillée des écrans vit dans `docs/UI.md` — la tenir à jour
quand une page ou une section de navigation change.

### Accès et sécurité

- `src/lib/access-mode.ts` : tant que `ANTIDOTES_REQUIRE_LOGIN` n'est pas
  `true`, l'application est **ouverte** — pas de login, lectures en
  `service_role`, bandeau « Accès public » dans l'en-tête. Ne pas retirer ce
  bandeau.
- `src/lib/auth.ts` : `getViewer()` est mis en cache par requête
  (`React.cache`) ; l'isolation entre espaces est appliquée **par la RLS en
  base**, jamais par des `where` côté application. `tests/isolation.test.ts`
  ouvre de vraies sessions pour le prouver.
- La clé `service_role` ne doit jamais être préfixée `NEXT_PUBLIC_` ni
  atteindre un composant client (`serverEnv()` est volontairement paresseux et
  refuse le navigateur ; les modules sensibles importent `server-only`).

### Base de données

Migrations numérotées dans `supabase/migrations/`, une transaction chacune,
journal dans `app.schema_migrations` avec checksum : **ne jamais modifier une
migration déjà appliquée**, en créer une nouvelle. Les tables portent un
`workspace_id` dénormalisé pour que les politiques RLS se passent de
jointures.

### Précision des chiffres

`src/lib/metrics/definitions.ts` fait autorité. Deux règles, vérifiées par des
tests : les ratios (CPL, CTR, ROAS…) sont **toujours recalculés depuis les
agrégats bruts** de la période — jamais de moyenne de moyennes ; et les
définitions reproduisent le rapport Looker existant, y compris ses
particularités (CPL = coût par landing page view, CTR sur clics lien,
basculable via `ClickAttributionMode`).

### Modules

- **Planning Éditorial** (`src/lib/planning/`) : remplace le board Monday du
  client — mêmes statuts, mêmes couleurs, édition dans la cellule sans bouton
  « enregistrer ». L'import Monday est **à sens unique et ponctuel** : après
  l'import, le dashboard fait autorité, rien n'est réécrit dans Monday. La
  navigation de l'espace affiche la section dès qu'un board existe : ne pas
  créer de ligne `dashboards` pour le planning (doublon — nettoyé par la
  migration 0012).
- **Modération** (`src/lib/moderation/`) : inbox clavier-d'abord ; chaque
  correction enrichit la FAQ du client, visible dans son espace Planning.
- **Reçus** (`src/lib/recus/`) : l'API Airwallex ne permet pas de déposer une
  pièce — le transfert de mail est le seul chemin d'écriture, suivi d'une
  **vérification** par relecture de l'API. L'auto-transfert se mérite
  fournisseur par fournisseur (trois validations concordantes) et n'est jamais
  appliqué à un rapprochement ambigu.

## Conventions UI

- Charte : fond blanc, cards `#F2F2F2` (structurer sans bordures), corps Arial,
  titres Montserrat (`font-heading` automatique sur h1–h4). **Le vert
  `--brand` est une ponctuation** — chiffres clés, barre d'entrée active —
  jamais un fond plein large. Le rouge `--brand-red` est réservé au réellement
  critique.
- Dataviz (`src/lib/viz/palette.ts`) : trois teintes catégorielles maximum,
  validées daltonisme sur `#F2F2F2` ; au-delà, replier la queue dans « Autres »
  (`foldTail`), jamais de quatrième teinte. Chaque graphique a sa vue tableau
  jumelle (`VizCard`).
- Navigation d'espace : `DashboardNav` (sections + sous-entrées). Les tableaux
  du planning sont des sous-entrées de la section — les pages n'affichent pas
  leur propre rangée d'onglets.
- Pièges Base UI : `DropdownMenuLabel` est un simple `div` (le `GroupLabel`
  de Base UI exige un `<Menu.Group>` parent et fait crasher le popup sans
  lui) ; tout `render={<Link/>}` sur un composant bouton demande
  `nativeButton={false}`, et `render={<button/>}` sur un `DropdownMenuItem`
  demande `nativeButton`.
