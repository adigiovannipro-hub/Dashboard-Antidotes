# Prompt V1 — Plateforme dashboard SaaS + premier dashboard client "Bondet"

## 0. Avant de coder

Ne commence pas à écrire du code. Lis tout ce document, explore le dossier de travail, puis **produis un plan d'implémentation** (architecture, schéma de base de données, découpage en étapes, points de risque, ce que tu as besoin de moi — clés d'API, comptes à créer). Je valide le plan, ensuite tu construis.

Si un choix technique est ambigu et que les deux options mènent à un travail matériellement différent, pose-moi la question dans le plan. Sinon, tranche toi-même et documente la décision.

---

## 1. Contexte et objectif

Je suis freelance / dirigeant en marketing digital. Aujourd'hui je produis les rapports de performance de mes clients avec **Supermetrics + Looker Studio (ex-Data Studio)**. C'est lent, cher, limité et je ne maîtrise ni la donnée ni le rendu.

Je veux **le remplacer complètement** par une plateforme que je possède : plus rapide, plus précise, plus belle, et gratuite en coûts d'infrastructure.

La plateforme est une **application SaaS unique, au nom de mon entreprise**, qui sert de porte d'entrée vers plusieurs **espaces** (sous-dashboards) :
- ma **vie perso** (finances, santé, habitudes… à définir plus tard),
- ma **vie pro** (activité de mon entreprise : CA, pipeline, temps passé… à définir plus tard),
- mes **clients** (un espace par client/marque, avec ses dashboards de performance).

**Le premier espace client à construire est `Bondet`.** C'est la priorité absolue de cette V1 : répliquer, en mieux, le rapport Looker Studio Meta qui existe aujourd'hui (capture de référence fournie).

> Note : je ne sais pas comment connecter techniquement les APIs Meta / TikTok / autres. C'est à toi de gérer entièrement cette partie : choix des endpoints, flow OAuth, scopes, tokens longue durée, rate limits, stockage sécurisé des credentials. Explique-moi seulement, à la fin, les actions manuelles que je dois faire côté Meta Business (créer une app, ajouter un utilisateur système, valider des permissions…), sous forme d'un guide pas à pas.

---

## 2. Stack imposée

- **Next.js 15** (App Router) + **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** : Postgres, Auth (magic link par email), Row Level Security, Storage
- **Recharts** (ou visx si tu juges que c'est nécessaire pour les donuts/heatmaps) pour la dataviz
- **Vercel** pour le déploiement, **Vercel Cron** (ou GitHub Actions) pour les jobs de synchronisation
- Tests : Vitest pour la logique métier (calculs de KPI, agrégations, deltas), Playwright pour un smoke test du parcours principal

Contrainte forte : **rester dans les tiers gratuits** (Supabase free, Vercel hobby). Si un choix risque de faire sauter cette limite, signale-le.

---

## 3. Architecture applicative

### 3.1 Modèle de données (multi-tenant)

Structure attendue (adapte les noms si tu as mieux, mais garde l'esprit) :

- `organizations` — mon entreprise (une seule pour l'instant, mais le modèle doit rester multi-org)
- `workspaces` — les espaces : type `personal` | `business` | `client`. Bondet est un workspace de type `client`.
- `users` — comptes, créés par invitation email
- `memberships` — lien user ↔ workspace + rôle
- `data_sources` — une connexion (Meta Ads, Instagram, TikTok…) rattachée à un workspace, avec ses credentials chiffrés
- `metrics_daily` / `metrics_entity_daily` — les données synchronisées, stockées au grain **jour × entité** (compte, campagne, ad set, ad, post)
- `sync_runs` — journal des synchronisations (statut, durée, lignes ingérées, erreurs)
- `share_links` — liens de partage public

### 3.2 Rôles et permissions

Trois rôles, **tous avec droit d'écriture** — il n'y a pas de rôle "lecture seule" parmi les utilisateurs authentifiés :

| Rôle | Périmètre | Droits |
|---|---|---|
| **Owner** (moi) | Toute la plateforme | Tout : voit et modifie tous les espaces y compris "perso", gère les connexions API, invite/révoque les utilisateurs, gère la facturation |
| **Contributeur interne** | Les espaces auxquels je le rattache | Consulte et **modifie** les dashboards de ses espaces (ajouter/déplacer/configurer des widgets, éditer les objectifs, commenter, exporter). Ne gère pas les utilisateurs, ne voit pas mon espace perso |
| **Client** | Uniquement son propre espace | Consulte et **modifie** son dashboard (réorganiser ses widgets, définir ses objectifs, annoter, exporter). Ne voit aucun autre espace, ne voit aucun autre client, n'a jamais connaissance de l'existence des autres |

Règles :
- Invitation **par email**. Un email non invité n'a accès à rien.
- L'isolation entre espaces doit être garantie **au niveau de la base** via Row Level Security Supabase, pas seulement dans l'UI. Un client ne doit pas pouvoir lire les données d'un autre même en appelant l'API directement.
- L'espace `personal` n'est accessible qu'au rôle Owner, quelle que soit la configuration.
- Les modifications de layout/config d'un dashboard sont **par espace** (un client qui réorganise son dashboard ne modifie pas celui d'un autre).
- Écris des **tests d'isolation** qui prouvent qu'un client ne peut pas lire un autre workspace.

### 3.3 Navigation

- Écran de connexion (magic link email)
- Après login : un **hub** listant uniquement les espaces auxquels l'utilisateur a accès (cartes avec logo, nom, dernière synchro, KPI résumé)
- Dans un espace : une navigation latérale entre ses dashboards (pour Bondet : "Meta" en V1, "TikTok" et autres à venir)
- Un switcher d'espace rapide en haut, style Linear/Vercel
- Si l'utilisateur n'a accès qu'à un seul espace, on le redirige directement dedans

---

## 4. Le dashboard Bondet — Meta (cœur de la V1)

La capture de référence est le rapport Looker Studio actuel. **Toutes les données et tous les blocs doivent être reproduits**, mais avec un design système moderne et propre à mon entreprise (voir §6) — ce n'est pas une copie pixel du Looker Studio.

### 4.1 Sources de données

Deux sources pour cet espace :

1. **Meta Ads** (Facebook + Instagram Ads) — via la Marketing API : performance payante, au grain jour × campagne × ad set × ad.
2. **Instagram / Facebook organique** — via la Graph API : followers, portée, engagement, posts, et **démographie de l'audience** (âge, genre, région) qui alimente le bloc Persona.

Prévois l'architecture pour que **TikTok (Ads + organique)** puisse être branché plus tard sans refonte : une interface `DataSourceConnector` commune, avec un mapping des métriques natives vers un modèle canonique interne.

### 4.2 Stockage et synchronisation

C'est le point qui me coupe vraiment de Supermetrics : **les données sont stockées chez moi**.

- Un **job de synchronisation quotidien** récupère les données via API et les stocke en base au grain jour × entité.
- Le dashboard lit **la base**, jamais l'API en direct → affichage instantané, aucun rate limit à l'affichage, historique illimité même quand l'API Meta n'expose plus que 37 mois.
- Prévoir un **backfill initial** paramétrable (ex : les 24 derniers mois à la connexion d'une source).
- Gestion des **restatements** : Meta réattribue les conversions plusieurs jours après. Re-synchroniser systématiquement une fenêtre glissante (ex : 28 derniers jours) en upsert, pas seulement la veille.
- Un bouton "Synchroniser maintenant" dans l'UI, avec état visible (dernière synchro, en cours, en erreur).
- Journalisation des runs + alerte visible dans l'UI si une synchro échoue (token expiré, quota dépassé).
- Toutes les métriques dérivées (CPA, ROAS, CTR, CPM, CPC, CPL) sont **recalculées à partir des agrégats bruts** pour la période affichée — jamais des moyennes de moyennes. C'est un piège classique, les tests unitaires doivent le couvrir.

### 4.3 Blocs à produire

**a) Ligne de cartes KPI** (10 cartes)

`Impressions` · `Clics` · `CPA` · `Purchase` · `ROAS` · `CPM` · `CTR` · `Amount spent (EUR)` · `Earn` · `Landing page views`

Chaque carte : libellé, valeur formatée, **delta % vs période précédente** avec flèche et couleur sémantique (attention : pour CPA et CPM, une baisse est une bonne nouvelle → la couleur doit suivre le sens métier, pas le signe). Afficher `N/A` proprement quand la période de comparaison n'a pas de donnée. Les cartes doivent être configurables (choix et ordre des KPI par espace).

**b) Bloc "Persona"** — 3 donuts côte à côte, alimentés par la démographie de l'audience :
- Tranches d'âge : 18-24, 25-34, 35-44, 45-54, 55-64, 65+, Unknown
- Genre : female, male, unknown
- Régions françaises (Île-de-France, Auvergne-Rhône-Alpes, PACA, Nouvelle-Aquitaine, Pays de la Loire, Occitanie, Bretagne…) — avec regroupement automatique des petites parts en "Autres" et un tooltip détaillé

**c) Bloc "Followers"** — courbe d'évolution mensuelle du nombre d'abonnés, avec la valeur annotée sur chaque point et la variation sur la période. Doit supporter plusieurs comptes (IG + FB) en séries distinctes.

**d) Tableau "Top Posts"** — le bloc le plus dense, à soigner :
- Colonnes : `Campaign name`, `Ad set name`, `Spent`, `View`, `Purchase`, `Earn`, `CPA`, `CPM`, `CPL`, `Clics`, `CTR`, `CPC`, `Comments`, `Saves`, `Shares`
- **Ligne "Total général"** en pied de tableau, calculée sur les agrégats bruts
- **Heatmap conditionnelle par colonne** (dégradé rouge → blanc → vert), avec le sens métier respecté : pour `Spent`, `CPA`, `CPM`, `CPL`, `CPC`, le rouge est en haut de l'échelle ; pour `Earn`, `Purchase`, `CTR`, `Clics`, les métriques d'engagement, c'est l'inverse
- Tri par n'importe quelle colonne, recherche, pagination, colonnes masquables
- Groupement repliable par campagne → ad set → ad
- Miniature du créa + lien vers le post quand disponible

### 4.4 Formats (français)

- Séparateur de milliers : espace insécable fine (`557 255`)
- Décimale : virgule (`4,62`)
- Devise : `2 572,22 €`
- Pourcentage : `0,73 %` (espace avant le %)
- Dates : `1 juin 2026 - 30 juin 2026`
- Libellés d'interface en français ; prévois quand même une couche i18n (fichier de traduction) pour ne pas avoir de chaînes en dur.

---

## 5. Fonctionnalités d'interaction

1. **Sélecteur de période + comparaison** — date range picker avec préréglages (ce mois-ci, mois dernier, 7/30/90 derniers jours, cette année, personnalisé) et choix du mode de comparaison (période précédente / même période l'an dernier / aucune). Tous les deltas du dashboard se recalculent en conséquence.

2. **Filtres croisés et drill-down** — cliquer sur une campagne, un ad set ou un segment de donut filtre **l'ensemble du dashboard**. Les filtres actifs s'affichent en "chips" retirables. Navigation en profondeur campagne → ad set → ad, avec fil d'Ariane.

3. **Lien de partage public** — générer une URL en lecture seule, sans compte, avec options : mot de passe, date d'expiration, période figée ou glissante, révocation à tout moment. La page publique affiche le dashboard en lecture seule et n'expose **aucune** donnée d'un autre espace.

4. **Export PDF / PNG** — export du dashboard en rapport mensuel propre, mis en page pour l'envoi client (page de garde avec logo et période, blocs non coupés, vectoriel plutôt que capture d'écran si possible). C'est exactement l'usage que j'ai aujourd'hui avec Looker Studio.

---

## 6. Design

Direction : **mêmes données et mêmes blocs que la capture, mais un design système moderne et cohérent**, propre à mon entreprise — pas une réplique du rendu Looker Studio.

- Design system unifié : échelle typographique, espacements, rayons, ombres, tokens de couleur en variables CSS
- **Mode clair et mode sombre**, tous les deux traités sérieusement
- Palette de dataviz cohérente, accessible (contraste vérifié), lisible dans les deux modes, avec des couleurs sémantiques distinctes des couleurs catégorielles
- Tous les tokens de marque centralisés pour permettre plus tard un **rebranding par espace client** (logo + couleur d'accent) sans toucher au code
- Responsive : utilisable sur desktop en priorité, correct sur tablette, dégradé propre sur mobile
- États soignés : chargement (skeletons, pas de spinner plein écran), vide, erreur, données partielles
- Accessibilité : navigation clavier, contrastes AA, données des graphiques accessibles en tableau

Avant de coder les graphiques, **charge la skill `dataviz`**.

---

## 7. Sécurité et conformité

- Tokens d'API chiffrés au repos, jamais exposés côté client, jamais dans le repo. `.env.example` documenté.
- RLS activée sur **toutes** les tables, testée.
- Les données démographiques d'audience sont agrégées et anonymes — aucune donnée personnelle individuelle stockée.
- Journal d'audit des accès et des invitations.

---

## 8. Livrables attendus

1. Le plan d'implémentation (à valider avant de coder)
2. L'application fonctionnelle, avec un jeu de **données de démonstration réalistes** pour que je puisse voir le rendu avant même de connecter Meta
3. Les migrations Supabase versionnées
4. Le guide pas à pas des actions manuelles côté Meta Business (création de l'app, utilisateur système, permissions, récupération des identifiants) et côté Supabase/Vercel
5. Un `README.md` : installation locale, variables d'environnement, déploiement, lancement d'une synchro
6. Un `CLAUDE.md` documentant l'architecture, les conventions et comment ajouter un nouveau connecteur de données
7. Les tests (calculs de KPI, agrégations, deltas, isolation RLS, smoke test du parcours)

## 9. Ordre de travail suggéré

1. Plan + validation
2. Squelette Next.js + Supabase, auth magic link, modèle de données, RLS + tests d'isolation
3. Hub des espaces + navigation + gestion des invitations et des rôles
4. Design system et bibliothèque de composants (cartes KPI, donut, courbe, tableau heatmap)
5. Dashboard Bondet Meta **avec données de démonstration** — validation visuelle avec moi
6. Connecteur Meta Ads : OAuth, ingestion, backfill, job quotidien
7. Connecteur Instagram/Facebook organique (followers, posts, démographie)
8. Sélecteur de période et comparaison, filtres croisés et drill-down
9. Partage public et export PDF/PNG
10. Scaffolding vide mais navigable des espaces "perso" et "pro"

Fais-moi un point à la fin de chaque étape.
