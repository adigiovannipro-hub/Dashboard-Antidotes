# Plan — Reporting multi-clients

## Contexte

Le Reporting est la feature fondatrice du projet (`PROMPT-V1.md`), mais il est
resté au stade « un seul écran » : le dashboard Meta de Bondet, sur données de
démonstration calées sur le Looker de juin 2026. Le socle prévu pour la suite
existe pourtant en base depuis la migration 0001 — `data_sources` (jetons
chiffrés AES-256-GCM, statut, date de backfill), `sync_runs`, `ad_entities`,
`ad_metrics_daily`, `ad_breakdowns_daily`, `social_followers` (avec
`source = 'csv_import'` déjà prévu pour l'antériorité saisie à la main),
`social_posts` — mais aucun connecteur ne les remplit : `pnpm sync` pointe sur
un fichier qui n'existe pas.

Le besoin, tel qu'exprimé :

- des reportings **Instagram, TikTok, LinkedIn, Meta Ads (Facebook +
  Instagram), Facebook**, et **site web** (Shopify notamment) ;
- chaque espace client **choisit ses plateformes** — on coche Meta Ads,
  Instagram, LinkedIn… à la création de l'espace, et les connexions suivent ;
- l'organique et le payant coexistent sans se gêner : des clients 100 %
  payant, des clients 100 % organique (interdiction de sponsoriser), des
  mixtes ;
- les **courbes de followers** survivent aux API qui ne gardent pas
  l'historique — aujourd'hui saisies à la main, demain relevées
  automatiquement, avec le point de fin de mois enregistré au 1er du mois
  suivant.

La cible, dans la continuité du Planning Éditorial :

```
Espace client
├── Planning Éditorial          ← existant
│   ├── PE 2026
│   └── FAQ
└── Reporting                   ← ce chantier
    ├── Vue d'ensemble          (toujours là)
    ├── Meta Ads                ─┐
    ├── Instagram               │ uniquement les sources
    ├── Facebook                │ cochées pour ce client :
    ├── TikTok                  │ pas d'onglet vide,
    ├── LinkedIn                │ pas d'écran mort
    └── Site                    ─┘
```

Même mécanique de navigation que le Planning : la section « Reporting » dans
les pastilles de l'espace (`DashboardNav`), les plateformes en onglets
soulignés un cran en dessous (`BoardTabs`). Deux niveaux qui existent déjà,
aucun vocabulaire nouveau à apprendre.

## Décision : une source cochée est une ligne dans `data_sources`, pas un dashboard en dur

Le dashboard actuel est câblé sur `workspace.slug === "bondet"`. C'est le
contraire d'un produit duplicable.

Le modèle cible : un **catalogue fermé de sources** (enum `data_provider`), et
par espace client, **une ligne `data_sources` par source cochée**. Tout le
reste en découle :

- les onglets du Reporting sont la projection des sources connectées de
  l'espace — cocher LinkedIn fait apparaître l'onglet LinkedIn, le décocher
  (passage en `disabled`) le fait disparaître sans perdre les données ;
- la synchronisation quotidienne parcourt `data_sources` et appelle le
  connecteur du provider — un nouveau client n'ajoute aucun code ;
- « dupliquer un espace client » devient un formulaire : nom, slug, couleur
  d'accent, cases Planning / FAQ / Reporting, puis cases par source. Rien
  d'autre, parce que rien d'autre n'est spécifique à un client.

Ce qui reste volontairement **hors** du modèle : un builder de dashboards.
Chaque source a son gabarit d'écran, le même pour tous les clients (comme les
cellules du Planning sont les mêmes pour tous). C'est ce qui garde l'outil
malin plutôt qu'industriel : on duplique une configuration, pas une mise en
page.

## Décision : l'organique et le payant sont des dashboards distincts, réunis par la vue d'ensemble

La question posée : fusionner ou séparer ? **Séparer.** Trois raisons.

1. **Ils ne répondent pas à la même question.** Le payant répond à « qu'est-ce
   que l'investissement a rapporté » (ROAS, CPA, CA) ; l'organique répond à
   « est-ce que l'audience grandit et réagit » (abonnés, portée, engagement).
   Les fusionner produit un écran qui ne répond bien à aucune des deux.
2. **Les chiffres ne s'additionnent pas.** Une portée payante et une portée
   organique sommées comptent deux fois les personnes touchées par les deux ;
   un post boosté verrait ses vues comptées dans les deux mondes. Toute
   fusion crédible exigerait des métriques « blended » qu'aucune API ne
   fournit proprement.
3. **Tes clients sont asymétriques.** Le client 100 % payant coche Meta Ads et
   n'a aucune case organique morte à l'écran ; le client qui t'a interdit les
   ads coche Instagram / Facebook / TikTok organiques et n'a aucun ROAS à
   `N/A`. La séparation par source fait que chacun n'a que des écrans pleins.

Concrètement :

- **Meta Ads** est un seul dashboard payant Facebook + Instagram — c'est comme
  ça que le média s'achète (placements automatiques) — avec un bloc de
  répartition par placement (breakdown `publisher_platform`) pour voir la part
  Facebook / Instagram sans inventer deux dashboards artificiels.
- **Instagram** et **Facebook** sont des dashboards organiques, un par réseau.
- **LinkedIn** et **LinkedIn Ads** sont deux onglets distincts si les deux
  sont cochés — même logique pour **TikTok** / TikTok Ads plus tard.
- La **Vue d'ensemble** est le seul endroit où les deux mondes se croisent :
  une ligne par source avec ses trois chiffres clés, et la courbe d'abonnés
  toutes plateformes. C'est l'écran d'ouverture du client et le tien.

## Décision : pas de scraping pour les followers — un relevé quotidien par l'API, l'antériorité importée

Le scraping de pages publiques (Instagram, TikTok…) casse en permanence, viole
les CGU des plateformes, et se fait bloquer par IP — le même genre de blocage
qu'Airwallex nous a déjà infligé côté Vercel. Et surtout : **il est inutile
dès qu'une source est connectée**, puisque chaque API expose le nombre
d'abonnés *du moment*.

Le mécanisme retenu :

- la synchronisation quotidienne lit le total d'abonnés de chaque compte
  connecté et l'upsert dans `social_followers` **à la date de la veille** —
  le relevé du 1er juillet au matin enregistre le point « 30 juin », exactement
  la convention demandée. Une courbe mensuelle se lit alors comme « le dernier
  jour connu de chaque mois », et elle est même quotidienne si on veut zoomer ;
- **l'antériorité** (tes relevés manuels actuels) s'importe une fois via
  `source = 'csv_import'`, prévu depuis la migration 0001. Un script
  d'import prendra ton fichier (mois, plateforme, valeur) et remplira la
  courbe passée ;
- pour une plateforme **non connectable** (Snapchat organique, ou un client
  qui refuse de donner l'accès), pas de scraping : une **tâche mensuelle
  générée dans « Mon travail »** le 1er du mois (« Relevé abonnés — Client X »)
  avec un formulaire de saisie rapide qui écrit `source = 'manual'`. Deux
  minutes par mois, fiable, et la courbe ne ment jamais sur son origine.

## Les écrans

### Vue d'ensemble

L'onglet d'arrivée du Reporting, pour chaque client :

- une bande de mesures : les 4 chiffres qui comptent pour *ce* client sur la
  période (pilotés par les sources cochées — un client payant voit ROAS /
  dépensé / CA / CPA, un client organique voit abonnés gagnés / portée /
  interactions / publications) ;
- **la courbe d'abonnés multi-réseaux** (une série par plateforme, la
  fonctionnalité que le Looker n'a jamais bien faite) ;
- une ligne par source connectée : nom, 3 KPI de la période avec delta, et la
  pastille d'état de la dernière synchro — cliquer ouvre l'onglet.

### Dashboards payants — Meta Ads, LinkedIn Ads, TikTok Ads

Le gabarit existe : c'est le dashboard Bondet actuel (chiffre héros ROAS,
9 tuiles, Persona, tableau heatmap par ad set). Il devient le gabarit « Ads »
de toutes les régies, avec deux ajouts :

- le **sélecteur de période + comparaison** (voir plus bas) ;
- pour Meta : le bloc **répartition Facebook / Instagram** (spend,
  impressions, résultats par placement).

KPI : ROAS · dépensé · CA · achats · CPA · impressions · clics · CPM · CTR ·
vues de page — inchangés, définis dans `src/lib/metrics/definitions.ts`, tous
recalculés depuis les agrégats bruts.

### Dashboards organiques — Instagram, Facebook, TikTok, LinkedIn

Même charpente que le gabarit Ads, mais le héros change de question :

- **chiffre héros : abonnés** — total actuel et variation nette sur la
  période, avec la phrase de contexte (« +842 abonnés en juin, 24 512 au
  30 juin ») ;
- tuiles : portée · vues · interactions · taux d'engagement (interactions ÷
  portée, recalculé) · visites de profil · clics vers le site · publications
  sur la période — adaptées par plateforme (les fiches plus bas listent ce
  que chaque API donne réellement) ;
- courbe d'abonnés du réseau (quotidienne sur la période, mensuelle au long
  cours) ;
- **Persona organique** quand la plateforme l'expose (démographie des
  abonnés : âge / genre / villes sur Instagram, secteurs / fonctions sur
  LinkedIn) — même composants Donut / BarList que le Persona Ads ;
- **Top publications** : le tableau heatmap existant, colonnes adaptées
  (vignette, date, format, portée, vues, likes, commentaires, partages,
  enregistrements, taux d'engagement), alimenté par `social_posts`.

### Site

Un seul onglet, deux sources possibles qui cohabitent :

- **Shopify** : CA, commandes, panier moyen (CA ÷ commandes, recalculé) —
  le chiffre d'affaires réel, celui qui clôt les débats d'attribution ;
- **GA4** (optionnel, si le client l'a) : sessions, visiteurs, sources de
  trafic — la partie « visites » quand le site n'est pas un Shopify.

### Sélecteur de période et comparaison

Le manque le plus visible du Reporting actuel, exigé par `PROMPT-V1.md` §5.1.
Il arrive avec ce chantier, **porté par la section Reporting** (pas global à
l'app) : préréglages (ce mois-ci, mois dernier, 7 / 30 / 90 jours, cette
année, personnalisé) + mode de comparaison (période précédente, même période
l'an dernier, aucune). Dans l'URL, en français (`?periode=`, `?comparaison=`),
partagé par tous les onglets de la section — changer de plateforme garde la
période. Tous les deltas se recalculent depuis les agrégats bruts des deux
périodes ; une comparaison sans donnée affiche `N/A`, jamais un faux zéro.

C'est le seul composant véritablement nouveau du design system (popover +
double calendrier, hauteur 40 px, focus visible). Tout le reste des écrans se
compose avec l'existant : `HeroFigure`, `StatTile`, `VizCard`, `TrendLine`,
`Donut`, `BarList`, `MetricsTable`, `StatusPill`. Pas de refonte des tokens.

## Connecter un client, pas à pas — le flux cible

L'objectif « je coche et ça se connecte » est atteignable parce que les accès
sont **au niveau de l'agence, pas du client**. Presque tout se joue une seule
fois :

1. **Une fois par plateforme** (toi + moi, à la mise en route) : créer
   l'application développeur, obtenir le jeton d'agence, le poser dans les
   secrets (GitHub Actions + Vercel). C'est l'objet des fiches plus bas.
2. **Une fois par client** (30 secondes, dans l'écran d'admin) : cocher la
   source. L'application interroge alors le jeton d'agence pour **lister les
   comptes accessibles** (les pages, comptes IG, comptes publicitaires que ton
   Business Manager gère déjà) et te fait choisir dans une liste — pas d'ID à
   recopier. Elle enregistre la ligne `data_sources`, lance le backfill, et
   l'onglet apparaît.

Le nouvel écran d'admin, `/admin/sources` (owner uniquement, 404 pour tout
autre, comme les modules internes) : un panneau par espace client, la liste
des sources du catalogue avec case, compte choisi, pastille d'état
(`connected` / `error` / `pending` / `disabled`), dernière synchro, bouton
« Synchroniser maintenant », et champ « backfill depuis ». C'est aussi là que
vivra le formulaire « Créer un espace client » (phase 5) qui enchaîne :
espace → modules → sources.

Seules exceptions au « tout niveau agence » : les plateformes à OAuth par
compte (LinkedIn, TikTok organique, Shopify) demandent **un consentement par
client ou par compte** — un clic sur « Connecter » qui ouvre l'OAuth, là
aussi listé dans les fiches. Le callback OAuth suit le modèle existant des
Reçus (`/api/recus/connexion` : état anti-rejeu en cookie `httpOnly`,
`timingSafeEqual`).

## Modèle de données

Extensions, pas de refonte — le socle 0001 avait vu juste :

```
data_provider   +  instagram_organic, facebook_organic,
                   linkedin_organic, linkedin_ads,
                   tiktok_organic (existant), tiktok_ads (existant),
                   pinterest_organic, snapchat_ads, shopify, ga4
                   -- meta_organic (0001) reste dans l'enum mais ne sera
                   -- jamais peuplé : remplacé par les deux valeurs par réseau,
                   -- une ligne data_sources = un compte d'un réseau
social_platform +  linkedin, pinterest, snapchat

social_metrics_daily        (nouveau) — l'équivalent organique de
                            ad_metrics_daily. Grain jour × source, colonnes
                            additives uniquement : reach, views, interactions,
                            likes, comments, shares, saves, profile_views,
                            website_clicks, follows, posts_published.
                            PK (data_source_id, date). Les taux (engagement…)
                            sont recalculés à la lecture, jamais stockés.

social_demographics         (nouveau) — instantanés de la démographie des
                            abonnés (le Persona organique). Grain jour ×
                            source × dimension × valeur, enum
                            audience_dimension (age, gender, city, country,
                            industry, job_function). On lit le dernier
                            instantané de la période affichée.

site_metrics_daily          (nouveau) — sessions, users, page_views, orders,
                            revenue numeric(14,4). Même convention que les
                            métriques publicitaires : EUR à l'affichage, pas
                            de colonne devise.

ad_metrics_daily            +  leads bigint (LinkedIn Ads et campagnes lead
                            Meta ; le « CPL » actuel reste un coût par vue de
                            page, conformément au rapport d'origine)
```

Les tables Ads existantes (`ad_entities`, `ad_metrics_daily`,
`ad_breakdowns_daily`) sont déjà agnostiques du provider via
`data_source_id` : LinkedIn Ads et TikTok Ads s'y rangent sans nouvelle table.
`social_posts` reste la table des publications organiques, tous réseaux.

Trois règles d'exécution, héritées des pièges connus :

- `alter type … add value` ne peut pas être utilisé dans la même transaction
  que l'usage de la valeur : **une migration pour les enums, une pour les
  tables**, comme le découpage schéma / RLS déjà en vigueur ;
- chaque table nouvelle porte `workspace_id` dénormalisé, ses politiques RLS
  `to authenticated` avec `with check`, le `revoke` nominatif pour `anon`, et
  le test d'isolation dans les deux sens sur le modèle de
  `tests/planning-isolation.test.ts` — c'est le même périmètre `workspace_id`
  que le socle, donc les helpers `app.accessible_workspace_ids()` /
  `app.owns_workspace()` existants ;
- rejeu de toute migration sur un Postgres 16 jetable avant push, et mise à
  jour de `database.types.ts` dans le même commit.

## Synchronisation

- **Un connecteur par provider** dans `src/lib/connectors/` : une interface
  commune (`listAssets` pour l'écran d'admin, `sync` pour l'ingestion), des
  fonctions pures pour le mapping API → colonnes, upsert par ID externe,
  idempotent. `scripts/sync.ts` — le fichier fantôme de `pnpm sync` — devient
  l'orchestrateur : il parcourt les `data_sources` actives, appelle le bon
  connecteur, journalise dans `sync_runs`, et **teste chaque `error` Supabase**
  (règle des crons, pas celle des queries).
- **Cadence : un passage quotidien vers 5 h 30 UTC** via une GitHub Action
  `social-sync.yml`, comme Airwallex — aucun cron Vercel consommé, le créneau
  libre reste libre, pas de plafond `maxDuration`. Chaque passage
  resynchronise une **fenêtre glissante de 28 jours** pour les Ads (Meta
  réattribue les conversions plusieurs jours après — les « restatements » du
  cahier des charges) et J-1/J-2 pour l'organique, plus le relevé d'abonnés.
- **Backfill à la connexion** : à la création d'une source, l'historique
  disponible est aspiré par tranches (ce que chaque API autorise est dans les
  fiches — 37 mois pour Meta Ads, beaucoup moins pour l'organique, d'où
  l'import CSV des followers).
- **« Synchroniser maintenant »** : bouton de l'écran d'admin, route `POST`
  owner-only qui synchronise une source à la demande depuis Vercel (aucun
  blocage d'IP connu chez Meta/LinkedIn/TikTok, contrairement à Airwallex ;
  si l'un d'eux s'y met, le repli GitHub Actions existe déjà).
- **Échec visible** : `status = 'error'` + `last_error` sur la source,
  pastille rouge dans l'admin et bandeau discret sur le dashboard concerné
  (« dernière synchronisation : il y a 3 jours ») — jamais un chiffre
  silencieusement périmé.
- Les données de démo Bondet ne bougent pas : la bascule démo → réel se fait
  par la présence d'une source connectée sur l'espace, la démo restant la
  référence visuelle tant que rien n'est branché (et derrière un flag ensuite,
  conformément à la règle maison).

## Fiches par plateforme

_(à compléter — recherches en cours)_

## Ce que ça coûte

Rien en euros, du délai en validations :

- **GitHub Actions** : +1 run quotidien ≈ 3-5 min ≈ **120-150 min/mois**, sur
  les ~1 280 restantes après Airwallex et la CI. Large.
- **Supabase** : ~10 clients × ~100 lignes/jour ≈ 370 k lignes/an, quelques
  dizaines de Mo — des années de marge sur les 500 Mo.
- **Vercel** : zéro cron ajouté, le créneau libre reste libre.
- **Anthropic** : zéro — aucun LLM dans ce chantier.
- Les API elles-mêmes sont gratuites ; leur coût réel est **le délai
  d'approbation** (LinkedIn et TikTok surtout) et la revue d'app Meta le jour
  où on dépassera le palier de développement. D'où un phasage qui démarre les
  démarches longues tôt.

## Phasage

1. **Socle** — enums + tables + RLS + tests d'isolation, connecteurs
   squelettes, `scripts/sync.ts` (répare `pnpm sync`), écran `/admin/sources`,
   onglets par source, sélecteur de période + comparaison sur le dashboard
   démo. Livrable visible sans aucune clé.
2. **Meta réel** — jeton system user, connecteurs `meta_ads` +
   `instagram_organic` + `facebook_organic`, backfill, Action quotidienne,
   relevé d'abonnés, import CSV de ton antériorité. Bondet passe en réel.
3. **Dashboards organiques + Vue d'ensemble** — gabarits Instagram / Facebook,
   Persona organique, courbe multi-réseaux.
4. **LinkedIn + TikTok** — dès que les accès développeur sont accordés
   (démarches lancées en phase 1 pour absorber le délai).
5. **Site + duplication outillée** — Shopify / GA4, formulaire « Créer un
   espace client » (modules + sources), tâche mensuelle « relevé manuel » dans
   Mon travail pour les plateformes non connectées. Pinterest / Snapchat à la
   première demande client réelle.

Chaque phase se termine par les quatre commandes vertes, l'audit visuel au
navigateur, et une preview Vercel à valider — c'est toi qui clôtures.

## Ce que j'attends de toi

_(à compléter avec les fiches — la liste exacte des clés et des clics par
plateforme)_
