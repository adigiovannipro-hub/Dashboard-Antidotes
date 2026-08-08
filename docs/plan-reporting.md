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

La cible, dans la continuité du Planning Éditorial — révisée après retours
(pas de vue d'ensemble, le moins d'onglets possible, un par plateforme) :

```
Espace client
├── Planning Éditorial          ← existant
│   ├── PE 2026
│   └── FAQ
└── Reporting                   ← ce chantier
    ├── Meta                    ─┐ payant + organique sur
    ├── TikTok                  │ la même page ; seules
    ├── LinkedIn                │ les plateformes cochées
    └── Site                    ─┘ pour ce client
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

## Décision (v2, après retours) : un dashboard par plateforme, payant et organique sur la même page

Ma première proposition séparait les dashboards payants et organiques. Retour
reçu : **le moins de dashboards possible**, fusionner ce qui est fusionnable,
et montrer le payant vide à un client 100 % organique — un ROAS absent qui
donne envie de sponsoriser. L'accord trouvé :

- **Un onglet par plateforme** : Meta (Facebook + Instagram, ads + organique),
  TikTok (organique + ads), LinkedIn (organique + ads), Site. Quatre onglets
  maximum, pas huit.
- Chaque page de plateforme a **trois zones** : une bande commune en tête
  (abonnés + totaux combinés), une section **Sponsorisé**, une section
  **Organique**. Les deux mondes restent lisibles séparément — parce que
  leurs questions diffèrent — mais sur un seul écran.
- **La bande commune n'additionne que ce qui s'additionne.** Ce qui est
  légitime : les **interactions** (likes, commentaires, partages,
  enregistrements — en ne comptant les posts boostés qu'une fois), la
  **diffusion totale** (impressions payantes + vues organiques, libellée
  comme telle), la **dépense**, les **abonnés** (par nature organiques). Ce
  qui ne s'additionne jamais : la **portée** (les mêmes personnes comptées
  deux fois) et tout **taux moyenné** — le taux d'engagement global est
  recalculé comme interactions totales ÷ diffusion totale, pas comme une
  moyenne des deux taux.
- **Le payant vide reste visible, en compact** : pour le client sans
  campagne, la section Sponsorisé se replie en une bande d'une ligne —
  « Aucune campagne sur la période · ROAS — » — l'incitation voulue, sans
  sacrifier une page entière à des tirets.
- Conséquence de la fusion Meta : la répartition Facebook / Instagram
  (breakdown `publisher_platform` côté ads, comptes séparés côté organique)
  devient un bloc *dans* l'onglet Meta, et les courbes d'abonnés Instagram et
  Facebook y vivent en deux séries.

Là où je maintiens mon garde-fou : pas de métrique « blended » inventée. Une
somme n'apparaît que si elle a un sens physique ; sinon les deux chiffres
restent côte à côte avec leur origine. C'est la différence entre un
dashboard qui simplifie et un dashboard qui ment.

Il n'y a **pas de vue d'ensemble** : la section Reporting ouvre directement
sur le premier onglet de plateforme (retour explicite — un écran de moins à
maintenir, et la bande commune de chaque plateforme joue déjà ce rôle).

## Décision : pas de scraping pour les followers — un relevé quotidien par l'API, l'antériorité importée

Le scraping de pages publiques (Instagram, TikTok…) casse en permanence, viole
les CGU des plateformes, et se fait bloquer par IP — le même genre de blocage
qu'Airwallex nous a déjà infligé côté Vercel. Et surtout : **il est inutile
dès qu'une source est connectée**, puisque chaque API expose le nombre
d'abonnés *du moment*.

Le mécanisme retenu :

- la synchronisation lit le total d'abonnés de chaque compte connecté et
  l'upsert dans `social_followers` **à la date de la veille** — le relevé du
  1er juillet au matin enregistre le point « 30 juin », exactement la
  convention demandée. **La courbe affichée est mensuelle** (le dernier jour
  connu de chaque mois) ; la capture, elle, reste quotidienne — non pas pour
  afficher du jour par jour, mais parce qu'un point mensuel unique est
  fragile : si le relevé du 1er échoue (API en panne, jeton expiré), le point
  du mois est **irrécupérable** — aucune API ne donne l'historique des
  totaux. Avec une capture quotidienne, le point de fin de mois existe même
  quand un passage échoue, et ça ne coûte rien de plus ;
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

### Le gabarit d'une plateforme (Meta, TikTok, LinkedIn)

Une seule page par plateforme, trois zones, de haut en bas :

1. **Bande commune** — les abonnés (courbe mensuelle ; deux séries Instagram
   + Facebook sur l'onglet Meta) et les totaux combinés légitimes de la
   période : diffusion totale (impressions payantes + vues organiques),
   interactions totales, taux d'engagement global (recalculé), dépense.
   Chaque total dit son origine ; un total sans donnée affiche `—`.
2. **Section Sponsorisé** — le dashboard Bondet actuel devient ce bloc :
   chiffre héros ROAS, tuiles (dépensé · CA · achats · CPA · impressions ·
   clics · CPM · CTR · vues de page), Persona Ads, tableau heatmap par
   ad set, et pour Meta la répartition Facebook / Instagram par placement.
   **Sans campagne sur la période : la section se replie en une bande d'une
   ligne** (« Aucune campagne sur la période · ROAS — ») — visible, pas
   envahissante.
3. **Section Organique** — par réseau (deux sous-blocs sur Meta : Instagram,
   Facebook) : tuiles vues · portée · interactions · comptes engagés · taux
   d'engagement · abonnés gagnés / perdus · clics liens de profil ·
   publications (adaptées à ce que chaque API expose — une tuile sans donnée
   disparaît, pas de faux zéro) ; **Persona organique** quand la plateforme
   l'expose (âge / genre / villes sur Instagram, secteurs / fonctions sur
   LinkedIn) ; **Top publications** en tableau heatmap (vignette, date,
   format, vues, portée, likes, commentaires, partages, enregistrements,
   taux d'engagement), alimenté par `social_posts`. Sans compte organique
   connecté, même repli en une ligne que le Sponsorisé.

Le dashboard Bondet existant n'est pas jeté : il est **réorganisé** dans ce
gabarit (sa partie ads devient la section Sponsorisé de l'onglet Meta, sa
courbe d'abonnés monte dans la bande commune).

### Site

GA4 uniquement (Shopify écarté sur retour) : sessions, visiteurs, pages
vues, sources / canaux de trafic, conversions (`keyEvents`). Le gabarit
exact sera calé sur **l'exemple de dashboard GA4 à fournir en pièce jointe**
— non reçu à ce jour, la fiche GA4 reste valable pour la connexion.

### Sélecteur de période et comparaison

Le manque le plus visible du Reporting actuel, exigé par `PROMPT-V1.md` §5.1.
Il arrive avec ce chantier, **porté par la section Reporting** (pas global à
l'app) : préréglages (**mois dernier — le préréglage par défaut**, ce
mois-ci, 7 / 30 / 90 jours, cette année, personnalisé) + mode de comparaison
(période précédente, même période l'an dernier, aucune). La lecture est
mensuelle par défaut — du 1er au dernier jour du mois écoulé — conformément
au rythme réel de reporting. Dans l'URL, en français (`?periode=`,
`?comparaison=`), partagé par tous les onglets de la section — changer de
plateforme garde la période. Tous les deltas se recalculent depuis les
agrégats bruts des deux périodes ; une comparaison sans donnée affiche
`N/A`, jamais un faux zéro.

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
compte (LinkedIn, TikTok) demandent **un consentement par client ou par
compte** — un clic sur « Connecter » qui ouvre l'OAuth, là aussi listé dans
les fiches. Le callback OAuth suit le modèle existant des Reçus
(`/api/recus/connexion` : état anti-rejeu en cookie `httpOnly`,
`timingSafeEqual`).

## Modèle de données

Extensions, pas de refonte — le socle 0001 avait vu juste :

```
data_provider   +  instagram_organic, facebook_organic,
                   linkedin_organic, linkedin_ads, ga4
                   (tiktok_organic et tiktok_ads existent depuis 0001 ;
                   Pinterest et Snapchat écartés pour l'instant — leurs
                   valeurs s'ajouteront au premier client concerné)
                   -- meta_organic (0001) reste dans l'enum mais ne sera
                   -- jamais peuplé : remplacé par les deux valeurs par réseau,
                   -- une ligne data_sources = un compte d'un réseau
social_platform +  linkedin

social_metrics_daily        (nouveau) — l'équivalent organique de
                            ad_metrics_daily. Grain jour × source, colonnes
                            additives uniquement : reach, views, interactions,
                            likes, comments, shares, saves, engaged_accounts,
                            profile_views (TikTok, Page FB), profile_link_taps
                            (IG), website_clicks (clics bio TikTok), follows,
                            unfollows, posts_published. Chaque plateforme
                            remplit ce qu'elle a ; les écrans n'affichent que
                            ce qui existe. PK (data_source_id, date). Les taux
                            (engagement…) sont recalculés à la lecture,
                            jamais stockés.

social_demographics         (nouveau) — instantanés de la démographie des
                            abonnés (le Persona organique). Grain jour ×
                            source × dimension × valeur, enum
                            audience_dimension (age, gender, city, country,
                            industry, job_function). On lit le dernier
                            instantané de la période affichée.

site_metrics_daily          (nouveau, différé) — sessions, visiteurs, pages
                            vues, conversions GA4. Son schéma définitif sera
                            calé sur l'exemple de dashboard GA4 attendu en
                            pièce jointe : il part avec le connecteur GA4,
                            pas avec le socle.

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
- **Cadence : l'affichage est mensuel, l'ingestion est quotidienne** — et
  c'est un point où je te challenge, puisque tu proposes une synchronisation
  mensuelle du 1er au 31. Une ingestion mensuelle perdrait des données de
  façon irrécupérable, pour trois raisons concrètes : (1) le point d'abonnés
  du mois n'existerait que si le passage du 1er réussit — un échec ce jour-là
  et le point est perdu à jamais, aucune API ne redonne un total passé ;
  (2) la série quotidienne d'abonnés Instagram ne couvre que 30 jours — un
  mois de 31 jours relevé le 1er du suivant déborde déjà de la fenêtre ;
  (3) Meta réattribue les conversions jusqu'à 7 jours après le clic — un
  relevé unique au matin du 1er fige les derniers jours du mois avant leur
  valeur définitive. L'ingestion quotidienne coûte zéro (mêmes minutes
  GitHub, gratuites) et **ne change rien à ce que tu vois** : les écrans
  s'ouvrent sur le mois écoulé, la courbe d'abonnés est mensuelle. La
  cadence technique n'est pas une cadence de lecture.
- **Un passage quotidien vers 5 h 30 UTC** via une GitHub Action
  `social-sync.yml`, comme Airwallex — aucun cron Vercel consommé, le créneau
  libre reste libre, pas de plafond `maxDuration`. Chaque passage
  resynchronise une **fenêtre glissante de 28 jours** pour les Ads (les
  « restatements » Meta) et J-1/J-2 pour l'organique, plus le relevé
  d'abonnés.
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
- Les données de démo Bondet restent la référence visuelle **jusqu'à la
  connexion réelle** : la bascule se fait par la présence d'une source
  connectée sur l'espace. Retour acté : dès que le réel est branché et
  validé, on retire la démo — pas de double régime prolongé.

## Fiches par plateforme

Chaque fiche donne : ce que tu as à faire (des clics, pas du code), les
secrets à me transmettre, ce que l'API fournit réellement, et la profondeur
d'historique récupérable au premier branchement. Constat transversal : les
API ne gardent presque rien — c'est la base locale qui fabrique l'« historique
illimité », et chaque mois sans synchronisation est un trou définitif. D'où
l'intérêt de lancer les démarches d'accès dès la phase 1.

### Meta — Ads, Instagram, Facebook

Un seul montage couvre les trois sources : une app de type « Business », un
**utilisateur système** dans ton Business Manager, et un **jeton qui n'expire
jamais**. Aucune revue d'app tant que l'outil ne sert que ton entreprise sur
des actifs qu'elle possède ou gère en accès partenaire — le cas exact
d'Antidotes. C'est la fiche prioritaire : elle débloque Bondet et la
majorité des clients d'un coup.

**Ce que tu as à faire (une fois, ~30 minutes dans Business Manager) :**

1. Si Meta le réclame en chemin : vérification d'entreprise
   (business.facebook.com → Centre de sécurité).
2. `developers.facebook.com` → Créer une app → parcours « Autre » → type
   **Business**, rattachée à ton Business Portfolio. Ajouter les produits
   **Marketing API** et **Instagram** (variante « Facebook Login »). Passer
   l'app en mode Live.
3. Paramètres du Business → Utilisateurs → **Utilisateurs système** → créer
   « robot-reporting » (rôle Employé suffit).
4. Lui **attribuer les actifs** : les Pages clientes (accès « Analyser »),
   les comptes publicitaires (« Consulter les performances »), et l'app
   elle-même. Les comptes Instagram professionnels suivent automatiquement la
   Page à laquelle ils sont liés.
5. **Générer le jeton** : expiration « **Jamais** », permissions
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
   `pages_read_engagement`, `read_insights`, `ads_read`,
   `business_management`. Le copier immédiatement (il ne sera plus jamais
   affiché) et me le transmettre en secret.
6. Pour chaque nouveau client ensuite : accès partenaire à ses actifs vers
   ton Business Manager, puis rejouer l'étape 4. Rien d'autre — côté
   application, le client apparaîtra dans le sélecteur de comptes de l'écran
   admin.

**Secrets à me transmettre :** ce seul jeton. Les identifiants de comptes se
listent ensuite par API — c'est ce qui alimente le sélecteur « choisis la
page / le compte » à la connexion d'un client.

**Ce que l'API donne :**

| Source | Contenu | Historique au branchement |
|---|---|---|
| Meta Ads (Insights) | dépense, impressions, portée, clics, achats et valeur, vues de page, par jour × campagne / ad set / ad ; Persona (âge, genre, région) ; répartition Facebook / Instagram (`publisher_platform`) | **37 mois** (à étaler en jobs asynchrones) |
| Instagram organique | `views` (les ex-impressions), `reach`, `total_interactions` et le détail (likes, commentaires, partages, enregistrements), `accounts_engaged`, `profile_links_taps`, abonnements / désabonnements ; démographie des abonnés (âge, genre, pays, villes) en instantané ; par publication : vues, portée, interactions, visites de profil, watch time des Reels | **2 ans** (par tranches de 30 jours) |
| Facebook organique | nouvelle famille « vues » de la Page et des posts, `page_post_engagements`, abonnés (`page_follows`) et gagnés / perdus par jour (`page_daily_follows_unique`), vues du profil de Page | **2 ans** (par tranches de ~90 jours) |
| Abonnés | `followers_count` IG / `page_follows` FB — valeur du moment uniquement | néant → relevé quotidien chez nous + ton import CSV |

**Ce qui n'existe plus (et qu'on ne promettra pas) :**

- l'« impression » organique est morte — Instagram depuis avril 2025,
  Facebook en deux vagues (novembre 2025, juin 2026). Le vocabulaire officiel
  est « **vues** », le schéma stocke `views`, les écrans diront « Vues » ;
- les visites de profil et clics vers le site **au niveau du compte
  Instagram** (supprimés janvier 2025). Restent les clics sur les liens du
  profil (`profile_links_taps`) et les visites de profil **par publication** ;
- l'historique du total d'abonnés, définitivement (voir la décision
  scraping) ;
- `follower_count` en série quotidienne ne couvre que 30 jours et exige un
  compte ≥ 100 abonnés — c'est un complément, pas une mémoire.

**Pièges retenus :** latence de 24-48 h sur l'organique (le cron synchronise
J-2 / J-1 et re-upserte une fenêtre glissante) ; les Stories ne sont lisibles
que pendant leurs 24 h de vie (lues à chaque passage, tant pis pour le très
éphémère) ; Meta a purgé des centaines de métriques de Page en 2024-2026 et
les noms exacts des remplaçantes « vues » se figeront **contre le changelog
officiel au moment du build**, pas contre des tutoriels antérieurs à
juin 2026 ; depuis janvier 2026 les fenêtres d'attribution « vue 7 j / 28 j »
ont disparu (les chiffres re-requêtés d'anciennes périodes ne recolleront pas
exactement avec tes vieux rapports Looker — c'est Meta, pas nous) et le
connecteur alignera ses chiffres sur Ads Manager via l'attribution unifiée ;
la version d'API (v25.0 aujourd'hui) s'épingle dans chaque appel et se
remonte une fois par an ; enfin le jeton « Jamais » meurt quand même si le
secret de l'app tourne ou qu'un actif est désassigné — l'alerte de sync en
échec est là pour ça.

### LinkedIn — organique et Ads

Le produit qui couvre l'analytics organique des Pages est la **Community
Management API** ; le reporting publicitaire passe par l'**Advertising API**
(`adAnalytics`). Les deux se demandent sur la même app développeur, et un
**seul jeton** — celui d'un membre admin des Pages clientes, donc toi —
couvre tous les clients à la fois : pas d'OAuth par client.

**Ce que tu as à faire :**

1. Vérifier que la Page LinkedIn de l'agence existe et que tu en es super
   admin — l'app développeur doit être **vérifiée par la Page** de
   l'entreprise (LinkedIn n'accorde ce produit qu'aux entités enregistrées,
   pas aux particuliers ; il faudra raison sociale, site web, politique de
   confidentialité).
2. Créer l'app sur `developer.linkedin.com`, l'associer à la Page, cliquer le
   lien de vérification.
3. Dans l'onglet Products, demander **Community Management API** et
   **Advertising API**. Motif à déclarer : outil de reporting interne pour
   les pages que l'agence administre. Délai annoncé : **jusqu'à 30 jours
   ouvrés** (souvent moins) ; un questionnaire de vérification peut arriver,
   à répondre sous 21 jours.
4. Être admin de chaque Page cliente (déjà le cas) et avoir au moins un rôle
   lecteur sur les comptes publicitaires clients.
5. Au premier branchement : un écran OAuth à valider une fois (scopes
   `r_organization_admin`, `r_ads`, `r_ads_reporting`), puis **une
   reconnexion par an** — l'application te préviendra à l'approche de
   l'échéance.

**Secrets à me transmettre :** `Client ID` + `Client Secret` de l'app (onglet
Auth). Le jeton, lui, naît de l'écran OAuth et vit chiffré en base
(access token 60 jours, refresh token 365 jours, rafraîchi par la
synchronisation quotidienne).

**Ce que l'API donne** (→ ce qu'en font les écrans) :

| Donnée | Endpoint | Historique |
|---|---|---|
| Abonnés totaux | `networkSizes` | instantané → relevé quotidien chez nous |
| Abonnés gagnés (organique / payant) par jour | `organizationalEntityFollowerStatistics` | **12 mois glissants**, à J-2 |
| Impressions, clics, likes, commentaires, partages des posts | `organizationalEntityShareStatistics` | **12 mois glissants** |
| Vues de la Page (par section, desktop/mobile) | `organizationPageStatistics` | 12 mois probables |
| Démographie des abonnés (secteur, fonction, séniorité, géo) | facettes follower statistics | instantané → snapshots `social_demographics` |
| Ads : dépense, impressions, clics, conversions, leads | `adAnalytics` (pivot campagne/créa) | **10 mois** en quotidien, 2 ans en mensuel |

**Pièges retenus :** l'accès démarre en palier « Development » (suffisant pour
~10 clients en lecture) mais il faut passer au palier Standard sous 12 mois —
formulaire + vidéo de démonstration, à anticiper. Le taux d'engagement fourni
par LinkedIn est ignoré : on stocke les bruts et on recalcule, règle maison.
L'en-tête de version (`LinkedIn-Version: YYYYMM`) se périme en ~1 an — le
connecteur le remontera régulièrement. Enfin, si le refresh token n'était pas
émis au premier échange (réservé en théorie aux apps approuvées), la
reconnexion serait tous les 60 jours — on le saura au premier branchement, et
l'alerte d'expiration couvre les deux cas.

### TikTok — organique (puis Ads)

Le produit qui convient est la **Business Account API** de TikTok API for
Business (les comptes clients doivent être des comptes professionnels, déjà
le cas). Contrairement à LinkedIn, l'autorisation est **par compte client** :
chaque titulaire clique une fois par an sur un lien d'autorisation.

**Ce que tu as à faire :**

1. Créer un compte TikTok For Business au nom de l'agence, puis s'inscrire
   comme développeur sur le portail (`business-api.tiktok.com/portal`) —
   validation ~3 jours ouvrés.
2. Créer l'app développeur (nom, logo obligatoire, URL de retour vers
   l'application) et demander les scopes « TikTok Accounts » : infos de
   compte, `user.insights`, `video.list`, `video.insights`. Revue manuelle :
   quelques jours à deux semaines.
3. Vérifier sur chaque compte client que l'onglet Analytics est activé dans
   l'app TikTok (sinon l'API ne renvoie rien).
4. Une fois l'app approuvée : envoyer à chaque client (ou cliquer toi-même si
   tu détiens les identifiants) le **lien d'autorisation** de l'app — deux
   minutes par compte, **à refaire chaque année** (l'application te
   préviendra).

**Secrets à me transmettre :** `Client ID` + `Client Secret` de l'app. Les
jetons par compte naissent des autorisations (access token 24 h rafraîchi à
chaque synchronisation, refresh token 1 an, chiffrés en base).

**Ce que l'API donne :**

| Donnée | Historique |
|---|---|
| Abonnés (total quotidien, gagnés / perdus par jour) | **60 jours maximum** |
| Vues vidéo, vues de profil, likes, commentaires, partages, clics bio, par jour | **60 jours maximum** |
| Par vidéo (lifetime) : vues, portée, watch time, complétion, nouveaux abonnés, sources d'impression | figées 365 j après publication |
| Démographie d'audience (âge, genre, pays, villes — comptes ≥ 100 abonnés) | instantané → snapshots |

**Pièges retenus :** le mur des **60 jours** est le plus dur de toutes les
plateformes — brancher TikTok tôt, même si son dashboard arrive après, juste
pour accumuler. `video_views` mélange organique et Spark Ads : l'écran le dira
(« vues totales »), pas de faux « organique pur ». Les métriques riches d'une
vidéo (portée, watch time) disparaissent si elle reste inactive plus de
7 jours consécutifs : le connecteur garde la dernière valeur connue en base,
il n'écrase jamais une valeur par du vide. Latence 24-48 h : la
synchronisation re-upserte J-2 et J-1. **TikTok Ads** est dans le périmètre
(tu en fais) : même app développeur, une autorisation annonceur séparée via
ton Business Center TikTok, historique profond (jusqu'à 2016) par tranches de
30 jours — la section Sponsorisé de l'onglet TikTok s'en nourrit, aucune
urgence d'accumulation contrairement à l'organique.

### Site — GA4

Shopify est écarté (retour explicite) : l'onglet Site se nourrit de **GA4
uniquement** — sessions, visiteurs, sources de trafic, conversions. Le
gabarit d'écran sera calé sur ton exemple de dashboard GA4 (pièce jointe
attendue). C'est la plus simple de toutes les intégrations — aucun jeton à
rafraîchir, jamais :

1. Une fois : je crée le projet Google Cloud + le **compte de service**, et je
   te donne son adresse e-mail (la clé JSON va dans les secrets).
2. Par client (2 minutes, faisable par le client) : GA4 → Admin → Gestion de
   l'accès à la propriété → ajouter cette adresse en **Lecteur**. C'est tout.
3. L'historique récupérable couvre **toute la vie de la propriété** (la
   Data API n'est pas limitée par le réglage de rétention) : seul connecteur
   où le backfill est complet dès le premier jour.

Métriques : `sessions`, visiteurs, pages vues, sources / canaux, et
`keyEvents` (le nom actuel des conversions GA4). À savoir : GA4 sous-compte
structurellement (adblockers, refus de consentement) — les chiffres du site
s'affichent avec leur source, on ne les mélange à rien d'autre.

### Plus tard — Pinterest et Snapchat

Écartés du périmètre sur retour, gardés en mémoire pour le premier client
concerné : Pinterest a un accès immédiat en palier d'essai mais **90 jours
d'historique organique maximum** et pas d'historique d'abonnés ; Snapchat
Ads est en accès ouvert (refresh token sans expiration), mais **l'organique
Snapchat n'a pas d'API accessible** (allowlist de gros partenaires) — le
jour venu, ce sera relevé mensuel manuel via « Mon travail », pas du
scraping. Le détail complet est dans l'historique de ce document.

## Ce que ça coûte

Rien en euros, du délai en validations :

- **GitHub Actions** : +1 run quotidien ≈ 3-5 min ≈ **120-150 min/mois**. Le
  budget mensuel passe à ~850-900 min sur les 2 000 gratuites du dépôt privé,
  CI comprise — large.
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
3. **Gabarit unifié Meta** — bande commune (abonnés + totaux combinés),
   réorganisation du dashboard Bondet en section Sponsorisé, section
   Organique Instagram + Facebook avec Persona organique et Top publications,
   import CSV de ton antériorité d'abonnés.
4. **LinkedIn + TikTok, organique et Ads** — dès que les accès développeur
   sont accordés (démarches lancées en phase 1 pour absorber le délai). La
   **collecte** démarre le jour de l'accès — leurs fenêtres de 12 mois et
   60 jours n'attendent pas — les écrans suivent.
5. **Site (GA4) + duplication outillée** — gabarit calé sur ton exemple de
   dashboard, formulaire « Créer un espace client » (modules + sources),
   tâche mensuelle « relevé manuel » dans Mon travail pour les plateformes
   non connectées.

Chaque phase se termine par les quatre commandes vertes, l'audit visuel au
navigateur, et une preview Vercel à valider — c'est toi qui clôtures.

## Ce que j'attends de toi

Dans l'ordre. Les points 2 à 4 peuvent partir en parallèle — ce sont les
délais d'approbation qui dictent le calendrier, pas le code.

1. **Trancher les deux points où je te challenge** : la capture d'abonnés
   quotidienne derrière un affichage mensuel (contre la capture du seul 1er
   du mois), et le refus des sommes illégitimes dans la bande commune
   (portée et taux jamais additionnés — les autres totaux combinés, oui).
2. **Meta — en premier** : les six étapes de la fiche (~30 min dans Business
   Manager), puis me transmettre le jeton de l'utilisateur système. Ça
   débloque Meta Ads + Instagram + Facebook pour tous les clients déjà en
   accès partenaire.
3. **LinkedIn — à lancer tôt** (jusqu'à 30 jours ouvrés d'attente) : créer
   l'app, demander Community Management API + Advertising API, me transmettre
   Client ID et Client Secret.
4. **TikTok — à lancer tôt aussi** (~1 à 2 semaines) : compte développeur +
   app avec les scopes Accounts, me transmettre Client ID et Client Secret,
   vérifier qu'Analytics est activé sur chaque compte client — et pour
   TikTok Ads, l'autorisation annonceur depuis ton Business Center.
5. **GA4** : m'envoyer **l'exemple de dashboard site web** (la pièce jointe
   annoncée, non reçue) ; côté accès, rien à créer — je te donnerai
   l'adresse e-mail du compte de service à ajouter en « Lecteur » sur chaque
   propriété cliente.
6. **Ton historique d'abonnés** : le fichier (ou le tableau) mois ×
   plateforme × compte × valeur que tu tiens à la main aujourd'hui, pour
   peupler les courbes d'avant-branchement via l'import CSV.

Les secrets transitent hors du repo (variables d'environnement Vercel +
secrets GitHub Actions ; jetons par client chiffrés en base via
`CREDENTIALS_ENCRYPTION_KEY`, déjà en place). Aucun nouveau service à ouvrir :
tout atterrit dans le projet Supabase existant.
