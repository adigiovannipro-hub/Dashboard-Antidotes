# Antidotes

Plateforme de dashboards qui remplace la chaîne Supermetrics + Looker Studio, mais aussi tous les outils que j'utilise pour accompagner mes clients ou gérer mon entreprise : modération, finance, planning éditorial, faq... Un tout en un social media pro et perso. L'objectif est d'automatiser et optimiser un maximum mon travail quotidien tout en ayant accès à un dashboard de pilotage, ainsi que des accès clients pour ce qui les regarde.
Une seule app Next.js. Les données des régies sont synchronisées une fois par jour et stockées en base, puis lues localement : affichage instantané, historique illimité, coût d'infra nul.

Le cahier des charges d'origine est dans `PROMPT-V1.md` et fait foi en cas de doute produit, mais il ne couvre que la première feature, Reporting. Modération, Planning Éditorial et Reçus sont arrivés après, hors spec.
Premier client livré : Bondet.

## Comment travailler avec moi

Je ne suis pas développeur. Je décris des besoins produit, pas des solutions techniques.

- **Tranche seul sur le technique.** Choix de librairie, structure de fichiers, schéma de données, nommage : décide, applique, et explique en une ligne. Ne me demande pas d'arbitrer entre deux options techniques dont je ne peux pas évaluer les conséquences.
- **Challenge-moi.** Si je demande quelque chose qui va casser un truc, coûter cher, contredire l'architecture existante ou créer de la dette, dis-le avant de coder. Propose l'alternative. Tu as le droit de dire que ma demande est une mauvaise idée.
- **Demande-moi uniquement le produit et les secrets.** Ce que doit faire la fonctionnalité, à quoi ça ressemble, quelles clés API fournir.
- **Fonctionnel avant élégant.** Une feature qui marche de bout en bout bat une abstraction propre à moitié branchée. Pas de refacto non demandée.
- **Jamais de faux positif.** Ne dis pas que c'est fait sans preuve : sortie de test, build qui passe, ou URL de preview. Si un bout est encore en démo ou en mock, dis-le explicitement.
- Réponds en français.

## Architecture des espaces

Deux mondes, une frontière étanche entre les deux.

**Mon espace (`/`, `/finance`, `/entreprise/*`)** — tout ce qui est à moi, perso et pro confondus. La frontière perso/pro est volontairement mince : une page Finance de type Finary agrège l'ensemble (comptes, trésorerie EUR, investissements, facturation client à venir), sans cloisonner. Contient aussi la todo et les outils internes : Modération, Reçus.

**Espaces clients (`/espace/[workspace]/*`)** — un dossier par client, cloisonné : reporting, FAQ, planning éditorial, stratégie. Un client ne voit jamais un outil interne, jamais un autre client, jamais une donnée financière.

L'accès se règle **page par page**, depuis les trois points d'un client dans le rail : `workspace_page_grants` (0035) porte, par adresse, les pages masquées d'un espace — absence de ligne valant visible. Le réglage se prend au moment de l'invitation, donc avant que le compte existe, ce qui explique la clé par email et non par utilisateur. Il porte sur la **visibilité d'une page**, pas sur un niveau lecture/écriture : à l'intérieur d'une page ouverte, un client écrit déjà chez lui, et `tests/planning-isolation.test.ts` encode cette décision. Le Contexte n'y figure jamais.

Règle absolue : toute nouvelle table est protégée par RLS et accompagnée d'un test d'isolation avant d'être considérée comme finie. Le cloisonnement client n'est jamais assuré uniquement par le filtrage côté application.

Le modèle à copier est **`tests/planning-isolation.test.ts`**. Il ouvre de vraies sessions Supabase, attaque l'API REST directement — hors de toute interface — et vérifie les **deux sens** de la règle : un client ne lit ni ne modifie l'espace voisin, **et** il écrit bien chez lui. C'est la moitié qu'on oublie de tester : une politique trop stricte casse le produit aussi sûrement qu'une politique trop large le rend dangereux. `tests/isolation.test.ts` couvre le socle (organisations, espaces, dashboards, liens de partage).

Les sept modules ont leur suite : `tests/isolation.test.ts` (socle), `planning-isolation`, `receipts-isolation`, `finance-isolation`, `mon-travail-isolation`, `contexte-isolation` (owner-only : le client ne lit **rien**, pas même son propre espace), `droits-pages-isolation` (le partenaire lit ses propres droits mais ne peut ni se rouvrir une page, ni en masquer une à un tiers). Les huit ont **toutes tourné vertes contre le vrai projet Supabase** le 12/08/2026 (run db-admin 31576500028, 99 tests) — elles sautent toujours en local tant que `.env.local` n'est pas renseigné, et la CI de push ne les exécute jamais : le vert d'un push ne prouve rien, celui de db-admin si.

Un module interne renvoie **404 et non 403** à qui n'y a pas droit : un client ne doit pas apprendre l'existence de la Modération en tombant sur un « accès refusé ».

## État actuel

| Chantier | Où | État |
|---|---|---|
| Fondations | `supabase/migrations/0001-0003`, `src/lib/auth.ts`, `src/app/admin/acces` | 16 tables, RLS + tests d'isolation réels, auth magic link, hub, navigation, invitations |
| Système visuel | `src/styles/tokens.css`, `src/app/globals.css`, `src/components/ds/` | Canvas gris chaud / surfaces blanches, tokens uniques, échelle typographique `type-*`, Inter + Montserrat, rail latéral repliable, primitives Panel / NavCard / StatCard / StatusPill. Contraste 4,5:1 vérifié au navigateur sur les huit pages |
| Dashboard Bondet Meta | `src/components/viz/`, `src/lib/metrics/definitions.ts` | Design system, 10 cartes KPI, donuts Persona, courbe followers, tableau heatmap |
| Modération (interne) | `/moderation`, `src/lib/moderation/` | 13 tables, pgvector, FAQ sémantique, génération Claude, boucle d'apprentissage, inbox 3 colonnes dans un panneau unique + bande de mesures. Architecture seulement, aucune connexion réelle aux plateformes |
| Planning Éditorial | `/espace/[workspace]/planning`, `src/lib/planning/` | 8 tables — le board Monday **natif et éditable** : mois → réseaux → publications, **ordre manuel par drag & drop** (poignée à gauche, dépôt entre lignes, dans un autre réseau ou un mois replié qui s'ouvre au survol), colonnes personnalisables et redimensionnables (0009), étiquettes libres éditables depuis le sélecteur d'une cellule (0029), journal d'activité **en phrases** (« a ajouté un visuel »), recherche ⌘F, panneau latéral **local d'abord** (ouverture/fermeture sans aller-retour serveur, glissade de sortie, Échap ferme — visionneuse d'abord si ouverte), carrousel à **cartes arrondies bordées avec aperçu de la suivante** (ni flou ni aplat), visionneuse plein écran même langage, cellule Visuel = panneau + glisser-déposer de fichiers + spinner d'envoi, retours avec **tag `@` en popover** envoyés via la boîte Gmail des Reçus (0030), sélection multiple persistante : Dupliquer / **Déplacer (« Choisir un nouveau parent »)** / **Archiver** / Supprimer ; **archives et corbeille restaurables** dans l'en-tête (0031, suppression douce des publications et des mois). Import Monday et analyses toujours là. Le fichier de rattrapage idempotent (0009→0031, transmis dans la conversation) met la vraie base à niveau d'un seul collage — la liaison Supabase↔GitHub n'applique pas nos migrations, leur nommage `NNNN_` n'est pas celui de la CLI Supabase |
| Reçus | panneau de `/entreprise/finance`, `src/lib/recus/` | 5 tables, Gmail → facture → Airwallex, vérification d'accrochage, auto-transfert à 3 validations concordantes, sync horaire depuis GitHub. La page dédiée a disparu au profit d'un panneau à une ligne par pièce : envoyer, archiver, toujours automatiser. L'historique des pièces parties est derrière l'icône d'archives de l'en-tête. Archiver écrit `ignored` ; c'est `forwarded_at` qui distingue le rangement du refus, et le statut `archived` ajouté par 0025 n'est écrit nulle part — la migration reste inutile à appliquer |
| Finance (phase 2.1) | `/entreprise/finance`, `src/lib/finance/` | 8 tables, bande de mesures (disponible masquable à l'œil, à facturer, en retard, dépensé), facturation à venir (lue du module Échéances), courbe solde vert + dépenses rouges 7/30/90 j, dépenses carte avec pastilles d'initiales et filtres de date JJ/MM/AAAA. **Sur données 100 % réelles depuis le 7 août** : `airwallex-sync.yml` horaire depuis GitHub (Airwallex bloque les IP Vercel), démo purgée, 46 soldes, ~100 dépenses, 30 factures. Les factures pilotent l'écran : statuts lus du couple `FINALIZED` + `payment_status`, noms de clients résolus via `/api/v1/billing_customers/{id}` (seul chemin qui réponde — les variantes rendent 401, pas 404). Logos de marchands récupérés au fil du sync (bucket privé `merchant-logos`, URL signées). Purge rejouable : Actions → Base de données |
| Échéances | `/entreprise/echeances`, `src/lib/billing/` | 2 tables (`billing_engagements`, `billing_installments`), remplaçant du board Monday — **le fond, pas la forme** : flux par statut (À facturer / Facturée triée par émission avec retards en bas / Payée / Devis confirmé) et sommes HT-TTC par groupe, dans des panneaux Antidotes sobres, la couleur vivant dans les `StatusPill` (en-cours orange comme une facture `sent` de Finance, payé vert, planifié bleu, retard rouge). **Chaque groupe est repliable** (`<details>` natif, aucun état client) et plafonné à six lignes visibles, le reste défilant dans le panneau. **La colonne d'état ouvre la ligne**, à gauche du client, sur la même largeur de 8,5 rem du board jusqu'au détail d'un devis — `ROW_LABELS` et `STAGE_TONES` sont exportés de `installment-row.tsx` pour que la même mensualité ne soit pas « Envoyée » en haut de page et « Facturée » dans son devis. Une ligne émise non échue se dit « Envoyée », échue « En retard ». Cartes : à facturer, facturé du mois vs prévu aux devis, retards (encre orange), récurrent = moyenne des 12 prochains mois. Courbe prévisionnelle compacte 3/6/12 mois (devis seulement). Un devis se saisit une fois (période, total **ou** mensuel HT, TVA en liste — 0 % défaut) ; **les trois cellules d'une ligne se modifient d'un clic** — période, montant HT, montant TTC ouvrent le même dialogue focalisé sur le champ cliqué, HT et TTC restant d'accord, seul le HT partant au serveur ; **les factures émises hors devis s'affichent aussi** (montant unique HT/TTC, zéro action). Statuts automatiques : bascule « à facturer » dérivée de la date, rapprochement Airwallex (étape `billing` du sync horaire ; relie aussi les payées sans lien et comble les dates manquantes, ne recule jamais). **Il n'y a plus d'archivage** (migration 0028) : une fois payée, une mensualité reste dans Payée, du plus récent au plus ancien. **Le rapprochement passe par `billing_client_aliases`** (migration 0026) : les devis portent la marque — BONDET, CHASSEURS DE GRAINES — et les factures la raison sociale — NIGHT SESSION, MEDIAPILOTE ANGERS ; sans cette table, aucun lien ne se pose et chaque prestation s'affiche deux fois. Un alias sans `client_name` désigne une facture qui n'est pas une prestation client (auto-facturation) : elle reste dans Finance et disparaît des Échéances. Tolérance de montant : 1 %, plafonnée à 5 € — le board portait 2 102,50 là où la facture dit 2 102,00 ; **le rapprochement aligne alors la mensualité sur le montant facturé**, sans quoi le même impayé s'affiche à deux chiffres différents ici et dans Finance. Fenêtre d'émission volontairement étroite (−10 j / +21 j) et **candidate la plus proche du jour prévu**, pas la première venue : à 45 jours elle couvrait le mois suivant en entier, et un devis dont les premiers mois n'ont jamais été facturés voyait toute sa série glisser d'un cran. **Antidotes facture sans TVA** : 0026 remet à 0 les devis repris de Monday, et le fichier d'import ne porte plus 20 %. Trois commandes d'entretien, toutes en étape optionnelle de db-admin : `pnpm diagnostic:billing` (lecture seule), `pnpm dedupe:billing` (devis en double — même client, périodes qui se chevauchent), `pnpm reconcile:billing` (rapprochement à la demande, le cron ne tournant que depuis `main`). **L'historique du board Monday est repris** : `pnpm import:billing-monday` (données figées dans `scripts/data/billing-monday.json`, 30 devis fusionnés par client+projet, statuts des groupes, anti-doublon par couple normalisé, idempotent) — étape optionnelle de db-admin. Migrations appliquées à la vraie base jusqu'à **0037** (runs db-admin du 12/08/2026), rapprochement rejoué derrière : 24 mensualités réalignées. Le rapprochement horaire ne tournera en production qu'au merge — le sync s'exécute depuis `main` |
| Mon travail (phase 1) | `/` (accueil), `src/lib/mon-travail/`, `src/components/mon-travail/` | 3 tables, todo unifiée : « À publier » répliqué des plannings — **le jour même et les retards, rien au-delà** (les retards en rouge d'abord ; une publication du 17 n'est pas du travail du 12, elle arrive le matin venu ; une ligne disparaît en passant `published` ou `dropped`), mêmes cellules éditables, icône de retours comptée et clic visuel qui **renvoient au panneau du post sur son planning** (`?sujet=&focus=retour`), sans coche ni ajout de ligne. Tâches du jour + 4 jours, archivé, ligne quotidienne et cycle mensuel par client générés par `/api/cron/mon-travail`, démo via `pnpm seed:mon-travail`. **Fathom et mails simulés** — phase 2 non branchée |
| Contexte client | `/espace/[workspace]/contexte`, `src/lib/context/` | 3 tables (`client_context` versionné, `client_assets`, `wording_history`) + bucket privé `client-assets`, **owner-only de bout en bout** : lien de nav non rendu aux clients, page en 404, RLS `app.owns_workspace` (« agency » ≡ owner d'organisation). Brief rangé en **trois familles** sous leur `SectionHeader` — la marque (contexte principal en 7 colonnes, positionnement et cibles empilés à côté), le contenu (livrables, piliers), la parole (ton, mentions, interdits, plateformes) — édition en place au blur, piliers structurés, règles par plateforme, compteur de contexte injecté (encre warning au-delà de 6 000 tokens). **Livrables mensuels** (0034, 0038, 0039 — colonne `deliverables` jsonb à forme complète par défaut) : **un groupe par réseau du client**, chacun avec ses catégories de publication et leurs quantités, plus la date de livraison des intentions. Le volume se compte réseau par réseau parce qu'il se contracte comme ça ; le total global reste en tête de panneau et en carte de mesure. Les réseaux se déclarent là et **commandent les rangées des règles par plateforme**, qui proposaient les quatre mêmes à tout le monde ; une règle déjà écrite sur un réseau retiré survit, une clé restée vide non. 0039 convertit l'ancienne forme (réseaux en simples noms, volume global) sans rien inventer : le volume d'avant devient un bloc « hors réseau », visible et déplaçable à la main, plutôt qu'une répartition devinée. Décocher un réseau qui porte des quantités demande confirmation — **contractuels, donc jamais proposés par la consolidation**, et reportés tels quels au versionnage. Le numéro de version a quitté l'en-tête : l'historique est un panneau en bas de page (consulter, restaurer), et la première carte de mesure dit le volume dû chaque mois. Documents en glisser-déposer **du navigateur droit au bucket** (URL d'envoi signées, même mécanique que les visuels du Planning — jamais par une action serveur), extraction `claude-sonnet-4-6` par type de document via `/api/contexte/extraction` (texte extrait en local par unpdf/mammoth, vision base64 pour images, lookbooks et PDF scannés, découpe des documents longs), un résumé retouché à la main n'est écrasé que sur relance explicite. Régénérer = consolidation en sortie structurée + **diff champ par champ** acceptable/refusable + version + 1 active, l'ancienne restaurable — jamais d'écrasement. `getClientContext()` (`src/lib/context/get-client-context.ts`) sert les futures routes `/api/generate/*` de la branche cartes-client ; colonnes `visual_text`/`slides`/`wording_status` sur `planning_subjects`, l'accroche part dans `wording_history` **à la validation** du wording, pas à la génération. Sans `ANTHROPIC_API_KEY` : lignes en `error` avec la cause affichée, rien d'inventé |
| Administration d'un espace | trois points du rail, `src/lib/workspaces/`, `src/app/actions/workspaces.ts` | 1 table (`workspace_page_grants`, 0035/0036) + helper `app.current_email()`. Renommer (le nom seul, **le slug ne bouge pas** : les liens partagés survivent), dupliquer (**la configuration, jamais le contenu** — tableaux avec leurs colonnes et leur vocabulaire, tableaux de bord ; ni publication, ni document, ni brief), supprimer (nom exact à saisir, vidage des deux buckets avant la ligne, journalisé), et le tableau des partenaires : invitation par adresse, rôle, et une case par page. `listWorkspacePages()` est la **source unique** du menu de l'espace, de la porte d'entrée et de la matrice de droits, sinon un onglet mène à un 404. Garde `requirePageAccess()` en 404 sur chaque page. Rejoué sur Postgres jetable : renommage, duplication (2 tableaux + 1 tableau de bord copiés), partenaire avec page masquée, suppression refusée sur nom faux puis effective |
| Production (cartes client) | cartes de `/`, `src/lib/production/`, `src/lib/prompts/*.md`, `/api/generate/[phase]`, `/api/jobs/[id]` | 3 tables (`client_phases`, `generation_jobs`, `wording_history` — le « client » du cahier des charges est un espace : `workspace_id` + `org_id`, RLS owner-only). Cycle décalé à 4 phases : pendant le mois M, intentions/wording/programmation visent M+1 et reporting M−1 — le cahier des charges faisait viser « le mois courant » à wording/programmation, incompatible avec ses propres fenêtres ; bascule reporting → intentions à la génération ou le 15. Carte cockpit : 4 segments (vert = fait ou en cours, ambre = fenêtre ouverte ou dépassée, gris = pas encore), badge du retard le plus ancien, mesures par phase, avancement chiffré, encart d'alerte, bouton à compteur, menu `…` (4 actions + liens, dont « Ouvrir le contexte » qui pointe la page du module Contexte). Jobs en `claude-sonnet-4-6` (demandé explicitement — les autres modules restent en opus) depuis des **prompts markdown éditables sans code**, tracés pour Vercel dans `next.config.ts` ; wording par lots de 4, reprise des seuls échecs, anti-répétition via `wording_history` ; intentions insérées dans le planning (mois, réseaux, colonne « Intention » — jamais dans `wording`, qui reste la caption et le compteur) ; reporting markdown sur les volumes du planning (pas de chiffres de régies : il le dit) ; **programmation en stub** qui journalise sans rien clôturer. Traitement post-réponse par `after()`, poll 3 s, jobs muets > 10 min soldés en erreur. **Un job en cours s'arrête depuis la carte** (`cancelled`, migration 0034) : un job actif tient le bouton de son espace, et sans cette sortie la seule issue était d'attendre les dix minutes de la purge. `POST /api/jobs/[id]/annuler` écrit le statut sous condition `in ('pending','running')` — un verdict arrivé pendant le clic gagne — et le worker relit ce statut entre deux lots de wording (le lot en vol va au bout : rien n'annule une requête déjà partie chez le modèle) puis avant d'écrire son propre verdict, sinon une phase à appel unique écraserait `cancelled` par `done`. Un arrêt n'est pas un échec : la carte repropose l'action normale, pas la reprise en ton danger, et la phase n'est pas clôturée. Sans les tables, la carte dit « Cycle indisponible » et retire son bouton plutôt que d'affirmer un retard qu'elle ne sait pas — l'erreur Supabase (`42P01`/`PGRST205`) est testée, contrairement à la règle habituelle des `queries.ts`. Migrations 0032-0033 appliquées à la vraie base ; **0034 reste à appliquer** (une ligne, `alter type generation_job_status add value if not exists 'cancelled'`), sans quoi l'arrêt répond 500. `supabase/seeds/rattrapage-production.sql` pose l'ensemble d'un seul collage, convergent (il répare un passage interrompu, refuse de toucher une table peuplée d'une autre forme) et porte désormais 0034 |

**Le Reporting tourne sur données de démo ; la Finance, sur du réel.** Aucune API régie n'est branchée ; Airwallex, si — première source réelle du projet, synchronisée toutes les heures depuis GitHub. Les données de démo Bondet sont calées au centime sur le Looker réel de juin 2026 : elles servent de référence visuelle, ne les modifie jamais sans que je le demande. Quand une source réelle arrive, elle ne remplace pas le jeu de démo, elle s'ajoute derrière un flag.

**Pas encore construit**, malgré ce que la section Architecture décrit comme cible :

- La page Finance vit sous `/entreprise/finance`, pas sous `/finance` comme le décrit la section Architecture.
- Le connecteur Meta. Les tables d'accueil sont prêtes et vides (`ad_metrics_daily`, `ad_breakdowns_daily`, `social_followers`, `sync_runs`), mais il n'y a ni `src/lib/connectors/`, ni `scripts/sync.ts` — `pnpm sync` référence un fichier absent et échoue.
- Sélecteur de période et comparaison, filtres croisés, drill-down.
- Partage public : la table `share_links` existe et `/partage` est réservé dans `PUBLIC_PATHS`, mais **aucune route ne l'implémente**. Export PDF/PNG non plus.
- La couche i18n exigée par `PROMPT-V1.md:138` — tous les libellés sont en dur, `LOCALE = "fr-FR"` est une constante littérale.
- `docs/meta-setup.md`, référencé par le README.

**L'application est en accès ouvert, et la RLS ne protège donc plus rien.** La décision est une constante versionnée, `OUVERT_PENDANT_LA_CONSTRUCTION = true` dans `src/lib/access-mode.ts` — pas l'absence d'une variable d'environnement. La passer à `false` referme partout ; `ANTIDOTES_OPEN_ACCESS` permet de trancher par environnement sans toucher au code. L'ancienne variable `ANTIDOTES_REQUIRE_LOGIN` n'est plus lue. Trois conséquences en cascade, toutes délibérées et commentées :

1. `src/lib/supabase/proxy.ts:68` — retour anticipé avant toute redirection vers `/login`.
2. `src/lib/supabase/server.ts:42-49` — `createClient()`, le client de lecture par défaut, renvoie un client **`service_role`**. Les 79 politiques deviennent décoratives.
3. `src/lib/auth.ts:35,83-112` — le visiteur anonyme **emprunte l'identité du premier owner en base**, avec `isOwner: true` sur tous les espaces. Les gardes `require*` et le 404 des modules internes ne s'appliquent donc plus à personne.

Bandeau rouge « Accès public » dans l'en-tête (`src/components/app-header.tsx:50-57`) tant que le mode est actif. Le code d'auth n'a jamais été retiré. À refermer avant le deuxième client : ses données ne t'appartiennent pas.

## Stack

Next.js 16.2.12 · React 19.2.4 · TypeScript strict · Tailwind 4 + shadcn style `base-nova` sur `@base-ui/react` (pas Radix) · Supabase (Postgres, magic link, RLS, Storage) · Recharts · Vercel + Vercel Cron · Vitest 4 + Playwright · Node ≥ 22, pnpm 10.18.2.

**La CI est minimale** — `.github/workflows/ci.yml` lance `typecheck`, `lint`, `test` et `build` à chaque push et sur chaque pull request. Deux workflows l'accompagnent : `db-admin.yml` (manuel — migrations, seed Finance, tests d'isolation contre la vraie base) et `finance-sync.yml` (horaire — appelle `/api/cron/sync-finance`). Elle ne joint aucun service : les suites d'isolation y sautent faute de `SUPABASE_SERVICE_ROLE_KEY`, et **son vert n'est donc pas une preuve d'isolation**. Ni les migrations, ni Playwright, ni le déploiement ne passent par elle.

**Contrainte dure : rester dans les tiers gratuits.** Avant d'ajouter un cron, une dépendance, un service externe ou un appel LLM récurrent, vérifie que ça tient dans le free tier et dis-moi le coût estimé.

Conséquences non négociables :
- Aucun fetch live vers une API tierce depuis le client. Sync par cron → base → lecture locale.
- Toute donnée externe est persistée en base, upsertée par ID externe (idempotent, pas de doublons).
- Aucun secret côté client, aucun secret commité.

### Ce qui plafonne

**Vercel Hobby — 2 crons, une fois par jour maximum.** La cadence est prouvée dans ce repo : une planification plus rapide ne fait pas que se dégrader, elle fait **rejeter le déploiement entier** (commit 9395d5c). Le plafond de deux crons vient de la doc Vercel, pas d'un essai ici. **Un seul créneau est engagé** : `/api/cron/mon-travail` à `0 4 * * *`, seule entrée de `vercel.json` — un créneau reste libre. Tout ce qui parle à Airwallex tourne ailleurs, et ce n'est pas un choix de quota : **Airwallex refuse les adresses IP de Vercel** (mêmes clés, jeton depuis une machine GitHub, `403 Forbidden` HTML depuis une fonction Vercel — établi par une sonde jouée des deux endroits). `.github/workflows/airwallex-sync.yml` exécute donc `pnpm sync:finance` puis `pnpm sync:recus` toutes les heures sur un runner GitHub, via la condition `--conditions=react-server` qui neutralise `server-only`. Les Reçus n'ont plus de cron Vercel : la route `/api/cron/recus` reste comme point d'entrée de secours mais ses étapes Airwallex échouent depuis Vercel. Pour un cron supplémentaire — le connecteur Meta, par exemple — l'ordre de préférence reste : se greffer sur un cron existant, GitHub Action, créneau Vercel restant, Pro. Dis-le-moi avant de l'écrire. Budget minutes GitHub : le workflow horaire coûte ~720 min/mois sur les 2 000 gratuites d'un dépôt privé, CI comprise on reste large — c'est pour ça que Reçus partage le job de Finance au lieu d'avoir le sien.

**Supabase Free — 500 Mo de base, 1 Go de Storage, 5 Go d'egress par mois, 50 000 MAU, 2 projets actifs.** Le schéma engagé aujourd'hui, compté sur un rejeu complet des migrations : **62 tables, 48 enums, 124 politiques, 62 index déclarés, 11 triggers, 14 fonctions `security definer`, 6 buckets tous privés, 3 976 lignes de SQL** sur 37 fichiers de migration. Le poste qui grossira le premier est la base : `ad_metrics_daily` au grain jour × entité, plus les embeddings pgvector 384d de la FAQ. Point d'attention réel : **un projet gratuit est mis en pause après une semaine sans activité**, et le symptôme est une application qui ne répond plus du tout.

**Hors free tier.** Les appels Anthropic — brouillons de la Modération, lecture des factures des Reçus, tous deux en `claude-opus-5`, `max_tokens: 2000` — sont facturés à l'usage. C'est le seul poste payant du projet aujourd'hui. Sans `ANTHROPIC_API_KEY`, les Reçus retombent sur des règles simples à confiance plafonnée à 0,6, donc sans aucun transfert automatique possible : la dégradation est prévue, pas subie.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement, http://localhost:3000 |
| `pnpm build` | Build de production |
| `pnpm start` | Sert le build de production |
| `pnpm typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest — unitaires colocalisés + isolation RLS |
| `pnpm test:watch` | Idem en continu |
| `pnpm test:e2e` | Playwright (`e2e/`, exclu de Vitest) |
| `pnpm db:migrate` | Applique les migrations manquantes |
| `pnpm db:status` | Liste les migrations en attente sans rien appliquer |
| `pnpm import:monday` | Reprend un planning éditorial depuis Monday (`--list` pour explorer) |
| `pnpm seed:planning` | Amorce le Planning Éditorial de Bondet (`--reset`) |
| `pnpm seed:moderation` | Données de démonstration de la Modération (`--reset`) |
| `pnpm seed:finance` | Données d'amorçage du module Finance |
| `pnpm seed:mon-travail` | Démo de « Mon travail » : espaces clients fictifs, publications du jour, tâches, cycles (`--reset`) |
| `pnpm diagnostic:schema` | Ce que la base contient vraiment : colonnes, privilèges d'API, colonnes invisibles pour PostgREST. Lecture seule, étape optionnelle de db-admin |
| ~~`pnpm sync`~~ | **Cassée** — pointe sur `scripts/sync.ts`, qui n'existe pas encore |

Un chantier est vérifié quand `pnpm typecheck`, `pnpm lint`, `pnpm build` et `pnpm test` passent tous les quatre. La CI les rejoue à chaque push, mais lance-les avant de pousser plutôt que de t'en servir comme d'un correcteur. Le typecheck seul ne prouve rien sur le comportement : les deux défauts du commit 588a864 passaient le typecheck et les tests.

**Dès qu'un chantier touche à l'interface, les quatre commandes ne suffisent plus** : il faut avoir regardé l'écran et rejoué l'audit de contraste. Voir « Vérifier une interface ».

À ne jamais lancer sans mon accord explicite : reset de base, push de migration en production, déploiement production.

## Migrations

**Runner maison, pas la CLI Supabase.** Il n'y a ni `supabase/config.toml`, ni `supabase/functions/`, et `supabase` n'est pas une dépendance. Tout passe par `scripts/migrate.ts`, qui se connecte en direct par URI Postgres.

- Fichiers `NNNN_nom.sql` dans `supabase/migrations/`, **triés lexicographiquement** — le préfixe à 4 chiffres est structurant, pas décoratif.
- Schéma et RLS sont **deux fichiers distincts** : `0006_planning_schema.sql` puis `0007_planning_rls.sql`. Suis ce découpage.
- Une **transaction par fichier**, tracée dans `app.schema_migrations` (nom, checksum SHA-256, date). Une migration déjà appliquée dont le contenu change affiche `⚠ modifiée depuis` et **n'est pas rejouée** : ne modifie jamais une migration passée, ajoutes-en une.
- Exige `SUPABASE_DB_URL`, qui **ne figure pas dans `.env.example`** et se lit depuis `.env.local`. La chaîne se prend au bouton **Connect** du tableau de bord Supabase (l'ancienne section *Settings → Database* n'existe plus), option **Session pooler** : la connexion directe n'écoute qu'en IPv6, ce qu'un runner GitHub Actions ne sait pas joindre. Pour le rejeu obligatoire sur un Postgres jetable local, ajouter `?sslmode=disable` à l'URI — le runner n'exige le TLS que pour Supabase.
- **Le numéro 0009 n'existe pas** — deux branches parallèles ont réservé leurs numéros. Trou sans conséquence, ne pas chercher à le combler.
- `supabase/seeds/` n'est **jamais lancé** par `db:migrate` : c'est du SQL à coller à la main dans l'éditeur Supabase. Les seeds exécutables sont les scripts TypeScript, idempotents par UUID stable dérivé d'un SHA-256.
- Les migrations de données (`0003_seed`, `0008_planning_bondet`) sont bien appliquées par `db:migrate` et sont idempotentes.
- Aucune migration n'est appliquée au déploiement. C'est une commande à lancer à la main.

**`src/lib/supabase/database.types.ts` est écrit à la main**, pas généré — 610 lignes qui doivent rester alignées sur 2 919 lignes de SQL, sans commande de génération branchée et sans garde-fou. Toute migration qui touche une table oblige à mettre ce fichier à jour dans le même commit. Son `Enums` ne contient d'ailleurs que les 10 enums de `0001` sur les 42 déclarés : les 32 autres n'y sont jamais entrés.

## Conventions

### Base de données

- **snake_case** partout, tables au pluriel, préfixe par module : `planning_*`, `receipt_*`, `moderation_*` / `faq_*` / `conversations`. Les tables du socle n'ont pas de préfixe (`workspaces`, `memberships`, `ad_metrics_daily`).
- **Enums Postgres**, pas des `text` libres : 40 types déclarés. Un nouveau statut se déclare dans une migration, il ne s'invente pas dans le code.
- **La colonne de tenant est dénormalisée sur chaque table**, y compris les tables filles dont le parent la porte déjà (`planning_subjects` porte `lane_id`, `month_id`, `board_id` **et** `workspace_id`). Redondance assumée : elle permet à la politique RLS de trancher sans jointure.
- **Trois colonnes de tenant coexistent**, une par génération de module. C'est un piège : vérifie laquelle s'applique avant d'écrire une politique.

  | Colonne | Modules | Membership | Helpers RLS |
  |---|---|---|---|
  | `workspace_id` | socle, dashboards, Planning | `organization_members` + `memberships` | `app.accessible_workspace_ids()`, `app.owns_workspace()` |
  | `client_id` | Modération (13 tables) | `moderation_members` | `app.moderation_client_ids()`, `app.moderation_writable_client_ids()`, `app.is_moderation_owner()` |
  | `org_id` | Reçus (5 tables), Finance (8 tables), Mon travail (3 tables) | `organization_members` | Reçus : `app.receipt_readable_org_ids()`, `app.is_receipt_owner()` — Finance : `app.member_org_ids()`, `app.is_org_owner()` — Mon travail : `app.is_org_owner()` seul, lecture comprise (owner-only) |

  Les helpers ne sont pas interchangeables. Tous sont `security definer` avec `set search_path = public, pg_temp` — reproduis-le, c'est ce qui empêche un détournement par schéma.
- **Toutes les politiques ciblent `to authenticated`.** Aucune ne vise `anon`, `public` ou `service_role` ; aucune n'utilise `using (true)` ; toute policy `insert`/`update`/`all` porte un `with check`. Ne dévie pas de ces quatre règles.
- Chaque migration RLS termine par un `revoke` nominatif de ses tables pour `anon` — le `revoke all on all tables` de `0002` ne couvre que les tables existant à cet instant.
- **Dates** : `timestamptz` pour un instant — 77 colonnes, **zéro `timestamp` sans fuseau**, `default now()` partout, jamais `timezone('utc', now())`. `date` nu pour un jour métier (12 colonnes, dont 3 membres d'une clé primaire : `ad_metrics_daily.date`, `ad_breakdowns_daily.date`, `social_followers.date` ; `planning_months.month` calé au 1er du mois).
- **Montants, deux régimes.** Comptabilité (Reçus, Finance) en **entiers de centimes** : `amount_cents bigint` + `currency char(3)` à côté, jamais de flottant sur de l'argent. La convention est `cents = montant × 100` **quelle que soit la devise**, y compris celles sans décimales à l'affichage : la division par 100 est un invariant de lecture, pas un calcul. Métriques publicitaires en `numeric(14,4)` et sponsoring du planning en `numeric(12,2)`, tous deux **sans colonne de devise** — l'EUR y est codé en dur à l'affichage (`src/lib/format.ts:15-20`, `lane-table.tsx:74`, `month-group.tsx:91`).
- **Rien n'est jamais converti.** Aucune devise pivot, aucun taux de change nulle part. Les totaux se font **par devise** (`Record<string, number>`), et une dépense qui porte deux montants — facturé chez le commerçant, débité du wallet — les affiche côte à côte sans les additionner (`src/lib/finance/money.ts`). La seule somme inter-devises du repo sert à trier, jamais à afficher, et le dit dans son commentaire. Ne l'imite pas ailleurs.

### TypeScript

- **`type`, pas `interface`** — 223 contre 13. Raison écrite en tête des trois `types.ts` de module : postgrest-js a besoin de l'index signature implicite que TypeScript ne donne qu'aux alias de type pour inférer les résultats de requête. Les `interface` survivantes sont hors chemin Supabase.
- **Zéro `enum` TypeScript.** Les enums Postgres sont mirroirés en **unions de littéraux**, doublées d'un `Record<Union, string>` de libellés français : ajouter une valeur casse la compilation du `*_LABELS`, ce qui est le garde-fou d'exhaustivité.
- **Zéro `any`, zéro `@ts-ignore`, zéro `@ts-expect-error` dans tout le repo.** Tiens ce standard. Le remplaçant est `unknown`.
- La sortie de postgrest se cast en **`as unknown as T[]`** (35+ occurrences), l'entrée en `as never`. C'est le contournement admis, ne cherche pas mieux.
- **`Database` n'est jamais utilisé pour typer une ligne** — uniquement comme générique du client (`createServerClient<Database>`). Le sens est inversé par rapport à l'usage Supabase habituel : chaque table est un alias plat exporté, et `Database` est assemblé à partir d'eux.
- Chaque module a son `types.ts`, dans cet ordre : union littérale → `*_LABELS` → sous-ensembles → prédicat → `type XRow`.
- Les lignes de base gardent le **snake_case de Postgres jusque dans le TS** (`source.email_address`). Pas de couche de mapping. Seuls les **modèles de domaine calculés** sont en camelCase (`RawMetrics.linkClicks`).
- `import "server-only"` en première ligne de tout fichier qui touche la base ou un secret (15 fichiers).
- Les variables d'environnement passent par `src/lib/env.ts` (zod, `parse` au démarrage). Ailleurs, zod ne sert **qu'à la frontière d'entrée** : les 5 Server Actions, en `safeParse`. Jamais dans une query, jamais dans un composant. Zod v4 : `z.uuid()`, pas `z.string().uuid()`.
- **Tout calcul de date se fait en UTC** (`Date.UTC`, `getUTC*`, `timeZone: "UTC"`). Un mois qui commence à minuit heure de Paris décalerait toutes les agrégations. `Europe/Paris` n'apparaît qu'à **un seul endroit** de `src/` (`subject-row.tsx:334`) et dans `playwright.config.ts` — cinq autres formatages de date omettent le fuseau et dépendent donc du serveur : ne recopie pas cet oubli, passe `timeZone` explicitement.
- Formats français centralisés dans `src/lib/format.ts` — jamais de `toLocaleString` en dur dans un composant. Espace insécable fine pour les milliers, virgule décimale, `2 572,22 €`, `0,73 %`. Une métrique non définie s'affiche `—`, un delta sans comparaison `N/A`.
- **Seules les grandeurs additives sont stockées.** Tout ratio (CPA, ROAS, CTR, CPM, CPC, CPL) est recalculé depuis les agrégats bruts de la période affichée. Une moyenne de moyennes est fausse, et c'est le piège classique de ce genre d'outil.

### Système visuel

**Toutes les valeurs vivent dans `src/styles/tokens.css`, et nulle part ailleurs.** `globals.css` ne fait que les brancher sur Tailwind et sur le vocabulaire shadcn (`--card`, `--muted`, `--primary`…) : repointer ces alias suffit à faire basculer l'application entière sans rouvrir un composant. Aucun hex dans un `.tsx` — sauf les couleurs de statut du board Monday, qui sont des **données** du client. Celles-là ne se retouchent pas : c'est l'encre du libellé qui s'adapte, choisie d'après la luminance du fond (`chipInk`, `planning/cells.tsx`). Du blanc sur « EN BROUILLON » tombait à 1,79:1.

- **Canvas `--canvas`, surfaces `--surface`.** Les cartes ressortent en blanc sur un gris chaud, bordées et posées sur `shadow-card`. L'inverse — cartes grises sur fond blanc — les enfonçait.
- **Couleur vive ≠ couleur de texte.** Le vert de marque est à 2,71:1 sur blanc : illisible en texte, et le blanc posé dessus l'est autant. Chaque famille a donc deux jetons — la teinte vive pour les fonds, les points et les marques, une **encre** (`--accent-ink`, `--danger-ink`, `--warning-ink`, `--info-ink`) pour tout ce qui se lit. Le bouton primaire est l'encre, jamais le vert. `--text-tertiary` (2,79:1) est réservé aux icônes.
- **L'échelle typographique est préfixée `type-`**, pas `text-` : `type-h1`, `type-body`, `type-overline`, `type-stat`… Ce n'est pas cosmétique — tailwind-merge range tout `text-*` dans le même groupe que les couleurs et **en supprime une des deux** au passage dans `cn()`. Trois libellés étaient muets avant qu'un audit du rendu ne le montre. Ne recrée jamais une classe utilitaire préfixée `text-`.
- **Une carte a trois formes et pas une de plus** (`src/components/ds/surface.tsx`) : `Panel` (contenant), `NavCard` (cliquable, doit porter des métriques), `StatCard` (un chiffre). Seule `NavCard` réagit au survol — un effet sur une carte non cliquable ment sur ce qui va se passer.
- **Aucune valeur inventée.** Une source absente affiche `—` et le dit ; l'absence de ligne pour un espace vaut zéro, pas « inconnu » (`NO_WORKSPACE_ACTIVITY`).
- Le mode sombre est **maintenu** : chaque token est redéclaré sous `.dark`.
- Contraste : le seuil de 4,5:1 se vérifie **dans le navigateur**, jamais sur le papier. Attention, Tailwind émet les opacités en `oklab(...)` — un audit qui parse les couleurs à la main produit de faux positifs ; faire résoudre les couleurs par un canvas.

Le reste du vocabulaire, à ne pas réinventer :

- **Rayons** `--r-sm` 8 / `--r-md` 12 / `--r-lg` 16 / `--r-xl` 20 / `--r-pill`. Une carte est en `rounded-lg`, un bouton et un champ en `rounded-md`, une pastille en `rounded-pill`.
- **Espacements** : l'échelle Tailwind native suffit (`gap-5` = 20 px entre cartes, `p-5` dans un panneau, `space-y-5` entre blocs d'une page). Aucune valeur arbitraire entre crochets.
- **Mouvement** : `duration-(--motion-duration) ease-standard` — 150 ms, une seule courbe. Les transitions portent sur `background`, `border-color`, `box-shadow`, `transform`, `opacity`, jamais sur `all`.
- **Icônes Lucide, `strokeWidth={1.75}`**, `size-4` dans le texte, `size-4.5` dans une navigation, `size-5` dans un état vide. Une icône est décorative : `aria-hidden`, et l'information est dans le texte à côté.
- **Boutons** : hauteur 40 px par défaut (`size="sm"` = 32 px pour une action secondaire dans un en-tête). Le primaire est l'encre `#1A1A1A`. La variante `accent` — vert foncé, texte blanc — est **réservée à la création** (« Ajouter »). Un seul aplat d'accent par écran.
- **Champs** : hauteur 40 px, bordure `--border-line`, anneau de focus `2px` en `--accent` à 20 %. Le focus clavier est visible partout, sans exception.

### Composer une page

Toute page applicative suit la même charpente. Ce n'est pas un goût, c'est ce qui fait qu'un écran nouveau se lit sans mode d'emploi.

1. **`<AppShell viewer title subtitle>`**, jamais autre chose. Il fournit le rail, la barre de page collante, le conteneur 1440 px **et le `<main>`** — une page qui ouvre le sien produit un `main` imbriqué et une double marge. Le titre est passé par le layout qui connaît la section ; la page n'affiche pas de `h1` à elle, sinon le nom apparaît deux fois.
2. **Une bande de mesures** en tête, quand le module a des chiffres : `<StatGrid>` et quatre `<StatCard>` au plus, `grid-cols-2 lg:grid-cols-4`. Elles répondent aux quatre questions qu'on se pose en ouvrant la page. Chaque carte porte un libellé en `type-overline`, un chiffre, et **une phrase de contexte** — sans elle, « 12 » ne renseigne sur rien. Les indicateurs ne se cachent pas à l'intérieur des blocs.
3. **Le contenu en `Panel`**, un par sujet, avec `PanelHeader` (titre, compteur, description, action à droite) puis `PanelBody` ou `PanelRows` pour une liste qui doit toucher les bords. Les titres de section entre panneaux sont des `SectionHeader`, pas des libellés gris pâle en capitales.
4. **Les cartes en grille** : `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `gap-5`. Jamais une carte seule sur toute la largeur.
5. **L'archivé, l'accessoire et le rare descendent en bas de page.**

Les règles qui se sont payées cher :

- **Une liste longue, c'est un panneau, pas N cartes.** Douze mois de planning en douze cartes flottantes donnaient le même poids visuel aux onze mois vides qu'au seul qu'on vient regarder. Un `Panel` + un rang par élément, l'élément courant ouvert et surligné.
- **Deux niveaux de navigation ne se ressemblent pas.** Les onglets de section sont des pastilles à encre pleine dans une gouttière creuse (`DashboardNav`) ; les onglets d'un cran plus bas sont **soulignés** (`BoardTabs`). Deux rangées de pastilles identiques mentent sur la hiérarchie.
- **Un état d'entité est une `StatusPill`**, jamais un badge maison. Le ton est sémantique : `positive` favorable, `warning` ce qui attend une action de ma part, `danger` retard ou échec, `info` planifié, `neutral` archivé ou sans qualité. Le point reprend l'encre, pas la teinte vive — à 6 px, l'ambre vif tombe à 2:1.
- **Un état vide est court et donne une sortie.** Hauteur réduite, une phrase, un bouton. Mieux encore : quand des données voisines existent, les montrer à la place — « rien à publier aujourd'hui » devient les trois prochaines publications datées.
- **Les filtres vivent dans l'URL, en français** (`?statut=`, `?periode=`). Un filtre se partage par copie du lien et survit au retour arrière. Les groupes de filtres sont des `FilterPills`.
- **Mobile-first pour de vrai.** Une ligne dense se replie en trois niveaux — repère, sujet, puis date et statut. Ce qui ne sert pas au téléphone sort (`hidden md:block`) : sur « À publier », la caption et la vignette mangeaient une ligne entière pour afficher un tiret.
- **Une préférence d'affichage se mémorise dans un cookie, pas dans le stockage local** : c'est le serveur qui rend la première image, c'est donc lui qui doit la connaître. Voir `src/lib/ui-preferences.ts`.
- **Aucun `<main>`, aucun `<h1>`, aucune marge de page dans un composant.** Ils appartiennent au cadre.

### Vérifier une interface

`typecheck`, `lint`, `test` et `build` ne prouvent **rien** sur une interface : les défauts les plus coûteux de cette session passaient les quatre. Une refonte n'est vérifiée que regardée.

- **Sur `pnpm build && pnpm start`, jamais sur `pnpm dev` seul.** Dans un bac à sable sans WebSocket, le HMR échoue et React ne s'hydrate pas : tout composant client paraît mort.
- **Prendre une capture et la regarder.** C'est ce qui a montré un bouton dont le texte avait disparu, un rail replié aux libellés tronqués, une ligne mobile cassée.
- **Rejouer l'audit de contraste au navigateur** sur chaque page touchée : parcourir les nœuds de texte, composer la pile de fonds avec leur alpha, comparer au seuil (4,5:1, ou 3:1 au-delà de 24 px). Faire résoudre chaque couleur par les **pixels** d'un `canvas` (`fillRect` puis `getImageData`) : la sérialisation de `fillStyle` rend l'`oklab(...)` de Tailwind tel quel, seule la lecture de pixels normalise vraiment. Et exempter les contrôles `disabled` — leur opacité à 50 % échoue au seuil par construction, WCAG les exclut.
- **Faire tourner l'application sans Supabase, si besoin** : un binaire PostgREST devant le Postgres jetable, plus un petit proxy qui traduit `/rest/v1/*`, répond 401 sur `/auth/v1` (l'accès ouvert bascule alors sur l'owner) et `[]` sur `/storage/v1`. Penser à relayer l'en-tête `Content-Range`, sans quoi toute pagination affiche « 0 élément » alors que les lignes sont là. Et se souvenir que **les `NEXT_PUBLIC_*` sont figées à la compilation** : changer de cible impose de rebuilder, sinon l'application interroge l'ancienne adresse et rend des 404 inexplicables. Deux détails qui ont coûté chacun une demi-heure : des fixtures à UUID fabriqués doivent porter le **nibble de version 4** (`z.uuid()` de Zod 4 refuse un UUID de version 0, et les routes rendent alors « Requête invalide » sans que rien d'autre ne cloche) ; et dans un bac à sable qui fauche les démons entre deux commandes, Postgres, PostgREST et le proxy se lancent en tâches de fond suivies par le harnais, pas en `nohup &`.

### Nommage et langue

- **Fichiers en kebab-case, 148/148.** Aucune majuscule dans un nom de fichier. Dossiers en minuscules, segments dynamiques `[workspace]`, `[client]`, `[board]`.
- Composants React en PascalCase, `export function`, **jamais `export default`** — sauf `page.tsx` et `layout.tsx`, où Next l'impose.
- Préfixes de fonctions serveur : `get*`/`list*` en lecture, `require*` pour une garde, verbe + nom pour une mutation, `evaluate*`/`should*`/`is*` pour une décision pure. Constantes exportées en `UPPER_SNAKE_CASE`.
- Tests : **`*.test.ts` colocalisés à côté du code** (20/20). `*.spec.ts` est réservé à Playwright dans `e2e/`. Les tests qui attaquent une vraie base vivent dans `tests/`.
- **Le code est en anglais, tout ce que lit un humain est en français.** Identifiants, tables, colonnes, valeurs d'enum : anglais. Commentaires, textes UI, messages d'erreur, noms de `describe`/`it`, **segments d'URL et query params** : français (`/entreprise/recus`, `?statut=`, `?nonlus=1`, `?suivant=`). Le pont entre les deux est le `*_LABELS` de chaque `types.ts`.
- Guillemets doubles partout. Les 14 fichiers de `src/components/ui/` sont sans point-virgules : ils sont générés par shadcn, laisse-les tels quels.
- Les commentaires expliquent **pourquoi**, pas quoi.

### Clients Supabase

Quatre fichiers dans `src/lib/supabase/`, trois constructeurs. Choisis en connaissance de cause :

- `client.ts` → navigateur, clé anon, RLS active. **Un seul call site légitime**, le formulaire de login. Aucune donnée métier ne se fetche côté client.
- `server.ts` / `createClient()` → le défaut pour toute lecture serveur. Clé anon et RLS **sauf en accès ouvert**, où il bascule en `service_role`.
- `server.ts` / `createAdminClient()` → `service_role`, contourne la RLS. Réservé à trois usages écrits dans le fichier : cron, callback OAuth, écritures d'audit. Jamais pour répondre à une requête utilisateur.
- `proxy.ts` → rafraîchit la session. `getUser()` et non `getSession()` : seul le premier revalide le jeton.

Il n'y a **pas de `middleware.ts`** : Next 16 l'a renommé, c'est `src/proxy.ts` et il exporte `proxy()`.

### Structure d'une route API

Modèle : `src/app/api/recus/connexion/route.ts`.

- `export const dynamic = "force-dynamic"`. Pas de `runtime` déclaré nulle part — le Node par défaut est implicite.
- Le contrôle d'accès vient **en premier**, avant tout travail.
- Module interne ⇒ `404`, jamais `403`.
- Un aller-retour OAuth pose un état anti-rejeu dans un cookie `httpOnly`, vérifié au retour en `timingSafeEqual`.

### Structure d'un cron

Modèle : `src/app/api/cron/recus/route.ts`.

- `GET`, `dynamic = "force-dynamic"`, `maxDuration` déclarée.
- **Le cron s'authentifie lui-même** : en-tête `Bearer` comparé à `CRON_SECRET` avec `timingSafeEqual` — un `===` fuiterait, par sa durée, combien de caractères de tête sont corrects. Il n'y a pas de vérification d'en-tête `x-vercel-*`.
- Le chemin `/api/cron` est déclaré dans `PUBLIC_PATHS` de `src/lib/supabase/proxy.ts`. Ce n'est pas une exception à l'authentification, c'en est une autre forme.
- `createAdminClient()` : un ordonnanceur n'a pas de session, donc pas de RLS.
- **Toujours tester le `error` de Supabase, pas seulement le `data`.** Une table absente rend un `data` nul, donc une liste vide, donc un « rien à faire » parfaitement rassurant — et un cron muet pendant des semaines. C'est l'inverse de la règle des `queries.ts`, où l'erreur est volontairement ignorée parce que la RLS est l'autorité et qu'une liste vide est la bonne réponse.
- **Répondre 200 même en échec partiel**, erreurs dans le corps. Un 500 ferait rejouer par l'ordonnanceur ce qui a déjà réussi.
- L'ordre des étapes est une décision produit, pas un détail d'implémentation : les dépenses avant les mails, la vérification en dernier.

### Lecture et écriture

- **Lectures** : un `lib/<module>/queries.ts`, `import "server-only"` en ligne 1, un objet d'options nommé (jamais de paramètres positionnels), `Promise<T[]>` explicite, `limit(options.limit ?? 100)`, `const { data } = await query` sans gérer l'erreur.
- **Écritures** : uniquement des Server Actions dans `src/app/actions/`, un fichier par module, jamais d'action inline. Signature `(_previous: XResult | null, formData: FormData)` imposée par `useActionState`. `safeParse` en entrée, gardes qui `throw`, `try/catch` qui convertit en union discriminée `{ ok: true, message } | { ok: false, error }`, `revalidatePath`, puis toast `sonner` côté client.

### Les fichiers à lire avant d'écrire

| Pour écrire… | Lire d'abord | Ce qu'il faut en copier |
|---|---|---|
| un cron | `src/app/api/cron/recus/route.ts` (111 l.) | Garde `Bearer` + `timingSafeEqual`, `try/catch` par unité de travail accumulé dans `errors[]`, réponse 200 `{ ok, report, errors }` |
| de la logique métier | `src/lib/recus/auto-forward.ts` (177 l.) + `src/lib/recus/types.ts` | Fonction **pure**, zéro import Supabase, état passé par un `type XContext`, retour en union discriminée, union de refus doublée d'un `REFUSAL_LABELS` |
| une lecture en base | `src/lib/moderation/queries.ts` (177 l.) | `server-only`, `export type XFilters`, `let query` enrichie par `if (filters.x)`, cast `as unknown as T[]` |
| une page (données) | `src/app/moderation/[client]/page.tsx` (70 l.) | `type Params = Promise<…>` awaité, `generateMetadata` séparée, garde `require*` qui `notFound()`, filtres lus en query params français, `Promise.all`, tout passé en props à un seul composant client |
| une page (interface) | `src/app/entreprise/finance/page.tsx` | `AppShell` → `SectionHeader` → `StatGrid` de quatre `StatCard` → `Panel` par sujet. Chiffres réels ou `—`, jamais de valeur inventée |
| un composant du système | `src/components/ds/surface.tsx` (165 l.) | Trois formes de carte et pas une de plus, `BASE` partagé, survol réservé au cliquable, en-tête à titre + compteur + action |
| un test | `src/lib/recus/matching.test.ts` (188 l.) | Colocalisation, import relatif du sujet, fabriques de fixtures en arrow avec `Partial<T>`, un `describe` par fonction exportée nommé du nom exact de la fonction, `it()` en français, zéro mock |

Pour un test d'isolation RLS, le modèle reste `tests/planning-isolation.test.ts`. Avant d'écrire un nouveau module, lis le module existant le plus proche et suis son pattern plutôt que d'en inventer un.

## Skills

Le dépôt embarque des skills dans `.claude/skills/`, certains en lien symbolique vers `.agents/skills/`. Rien ne les déclenche mécaniquement : ce qui suit est une consigne, pas un automatisme du harnais.

**À charger d'office, sans qu'on te le demande :**

| Skill | Avant de… |
|---|---|
| `supabase-postgres-best-practices` | écrire une migration, une politique RLS, un index, un trigger ou une fonction `security definer`. Ses pièges — `security definer` qui contourne la RLS, `update` sans `with check`, vue qui l'ignore par défaut — recoupent les conventions ci-dessus, et aucun ne se voit au typecheck ni aux tests. |
| `supabase` | toucher à l'auth, aux clients Supabase, au Storage ou aux sessions. **Ignore sa section « Making and Committing Schema Changes »** : elle décrit la CLI Supabase, qui n'est pas utilisée ici. Les migrations passent par `scripts/migrate.ts` et des fichiers `NNNN_nom.sql` numérotés à la main. |
| `dataviz` | écrire un graphe Recharts, une carte KPI, une jauge ou un écran de pilotage. À croiser avec le design system existant de `src/components/viz/`, qui fait foi en cas de contradiction. |
| `vercel-react-best-practices` | écrire un composant serveur ou client non trivial, ou changer une frontière de rendu. |

**À n'activer que si je le demande :**

- `improve` — audit et plans d'implémentation. Utile en revue de chantier, trop coûteux en réflexe.
- `caveman` — réponses compressées. Jamais en automatique : quand tu m'expliques un arbitrage, la clarté passe avant les tokens.
- `agent-browser` — pilotage de navigateur, pour vérifier une preview.
- `ui-ux-pro-max`, `ui-styling`, `banner-design`, `brand`, `design`, `design-system`, `slides` — production graphique. Les scripts de génération d'images exigent `GEMINI_API_KEY`, qui n'est pas fournie : ils échouent proprement sans elle.
- `azure-aigateway` — sans rapport avec la stack, installé par curiosité.

## Git et livraison

- `main` est la branche stable. Le travail se fait sur des branches / worktrees dédiés.
- **Commite et pousse au fil de l'eau sur la branche dédiée, sans me demander.** Tant que rien n'est mergé, `main` reste intact — et l'environnement de travail est éphémère : ce qui n'est pas poussé est perdu avec la session.
- **Tu ne merges jamais dans `main` toi-même.** Quand un chantier est terminé : push, puis donne-moi l'URL du déploiement Vercel de preview. Je valide visuellement, puis je te dis de merger.
- **C'est moi qui déclare une phase terminée**, pas toi. Tu peux dire qu'un chantier te semble prêt ; tu ne le clôtures pas.
- Un chantier n'est « terminé » que si le build passe, les types passent, les tests passent, et la preview est en ligne.
- Commits en français, descriptifs, une intention par commit.
- **Vérifie l'écart avec `main` en début de session.** Ce fichier n'est chargé automatiquement que depuis `main` ; une session qui clone le repo y arrive par défaut et ne voit ni les branches en cours ni ce qu'elles contiennent. Si `main` est loin derrière, dis-le-moi avant de commencer.

## Pièges connus

**Un cron non conforme fait rejeter le déploiement entier.** Vercel valide `vercel.json` à la lecture. Une cadence interdite par le plan ne dégrade pas le comportement : elle annule le déploiement — et le symptôme trompe, puisque rien n'apparaît dans la liste des déploiements au lieu d'une ligne rouge. Deux commits sont ainsi restés en ligne sans jamais être déployés.

**Le proxy d'authentification intercepte les routes cron.** Une route cron parfaitement écrite est renvoyée vers `/login` avant de s'exécuter si son chemin n'est pas dans `PUBLIC_PATHS`. En production, la synchronisation ne démarre jamais, sans que rien ne le signale.

**`create table if not exists` transforme un conflit de schéma en panne silencieuse.** Deux branches parallèles ont décrit `wording_history` : celle des cartes client, appliquée la première à la vraie base, avec `hook`, `org_id`, `full_wording`, `platform`, `published_at` ; celle du Contexte, avec `accroche`. Le `if not exists` — mis là exprès pour la sécurité de fusion — a fait passer la seconde sans rien dire, et le code d'ici a écrit `accroche` dans une table qui attend `hook`. **Trois runs d'isolation ont échoué avant que la cause soit vue**, parce que le message accusait le cache. La table vivante fait foi, 0037 réconcilie une base née des seules migrations d'ici. **À la fusion, le même défaut a changé de visage** : sur une base neuve, `0032_client_context_schema.sql` trie avant `0032_production_schema.sql`, créait la table, et la migration Production échouait sur « relation already exists » — plus aucune base ne pouvait s'amorcer. Le bloc a donc été retiré de 0032, qui affiche désormais « ⚠ modifiée depuis » sans être rejoué : la vraie base garde la table de la Production, et un rejeu à neuf produit la même. Avant d'écrire un `if not exists` sur une table qu'une autre branche déclare aussi, vérifier la forme réellement en base : `pnpm diagnostic:schema <table>`.

**PostgREST sert l'API REST depuis un cache de schéma, et ce cache survit à la migration.** Une colonne fraîchement créée n'existe pas pour lui tant qu'il n'a pas rechargé : il rend `PGRST204 … in the schema cache` sur une base pourtant à jour, et le message accuse une colonne qui existe. C'est ce qui a fait échouer une suite d'isolation lancée juste après des migrations, sur une colonne posée la veille — un faux négatif parfaitement crédible. `scripts/migrate.ts` envoie donc `notify pgrst, 'reload schema'` dès qu'au moins une migration est appliquée. Sur un Postgres nu sans PostgREST, personne n'écoute et l'ordre ne coûte rien.

**Un `error` Supabase non testé devient un silence.** Voir la structure d'un cron ci-dessus. C'est la même erreur qui a failli passer en production dans les Reçus.

**Le SQL ne se relit pas, il se rejoue.** Trois défauts sont sortis d'un rejeu sur un vrai Postgres 16 jetable, qu'aucune relecture n'aurait attrapés : les littéraux d'un `insert ... select` ne sont pas convertis vers un enum comme ceux d'un `insert ... values` (cast explicite obligatoire) ; les politiques de `storage.objects` survivent au `drop table` du module, elles appartiennent au stockage ; et les CTE d'un même ordre partagent un instantané de la base — un seed en une seule requête n'insérait rien au premier passage, la seconde partie ne voyant pas ce que la première venait de créer. **Toute migration se rejoue sur un Postgres jetable avant d'être poussée.** Le bootstrap du jetable doit imiter les *default privileges* de Supabase (`alter default privileges in schema public grant all ... to anon, authenticated, service_role`) : sans eux, toute table créée après 0002 rend des `permission denied` trompeurs en simulation RLS — c'est précisément parce que Supabase accorde tout par défaut que chaque migration RLS termine par son `revoke ... from anon` nominatif.

**L'éditeur SQL de Supabase n'honore pas toujours le `begin`/`commit` d'un fichier collé.** Un script qui échoue à mi-chemin laisse donc des tables à demi créées, et le passage suivant bute sur `create table if not exists` — qui ne fait rien quand la table existe, même sous une autre forme : l'index qui suit cherche une colonne absente et tout s'arrête (`42703`). Un fichier de rattrapage doit **converger**, pas seulement être idempotent : détecter la forme périmée, la remettre à plat si elle est vide, et s'interrompre en le disant si elle porte des données. Et finir par `notify pgrst, 'reload schema'` — sans quoi PostgREST continue de répondre « relation does not exist » sur des tables pourtant créées.

**Un préambule de migration qui supprime sans condition est une bombe.** Passe encore sur des tables vides, désastreux sur un planning rempli. Toute suppression est gardée par la présence d'un vestige de l'ancien schéma, et de lui seul.

**Un `unique` sur une colonne nullable ne contraint rien.** `planning_lanes` et `planning_subjects` portent `unique (board_id, external_id)`, mais `external_id` est nullable : deux lignes créées hors import ne sont pas dédupliquées, `NULL` n'égalant pas `NULL`.

**Une constante exportée d'un fichier `"use client"` n'est plus une constante côté serveur.** Importée par un composant serveur, elle devient une référence opaque : la comparaison échoue en silence, rien ne casse, le réglage ne se souvient simplement de rien. Le nom du cookie du rail vit donc dans `src/lib/ui-preferences.ts`, un module sans directive, lisible des deux côtés.

**Le mode développement ne s'hydrate pas dans un bac à sable sans WebSocket.** Le HMR de Next échoue, React ne s'attache à rien, et tout composant client paraît mort — un clic sans effet, un `aria-pressed` figé. Ce n'est pas le code : vérifier tout comportement interactif sur `pnpm build && pnpm start`, jamais sur `pnpm dev` seul.

**Les scripts Node ne lisent pas `.env.local` tout seuls.** Next le fait nativement, `dotenv/config` ne lit que `.env`. Un script lancé à la main doit pointer explicitement sur `.env.local`.

**Les tests d'isolation se sautent en silence.** Sans `.env.local` renseigné, la suite passe en `describe.skip` : `pnpm test` est vert **sans avoir rien prouvé** sur la RLS. Un vert n'est une preuve d'isolation que si les tests ont réellement tourné contre la base, migrations appliquées.

**En accès ouvert, la RLS ne protège plus rien.** Voir la section État actuel. L'accès ouvert désarme les 92 politiques d'un coup : c'est un réglage de construction, il n'a rien à faire sur un environnement qui porte les données d'un client.

**`e2e/acces.spec.ts` suppose l'application fermée.** Ses trois cas vérifient la redirection vers `/login` : ils échouent tant que l'accès ouvert est actif. La suite e2e n'est pas dans la CI — elle demande un navigateur et un vrai projet Supabase — donc rien ne le signale.

**Le proxy tronque les corps de requête à 10 Mo — et un fichier ne doit jamais transiter par une action serveur.** Deux étages de plafonds sur le même chemin : `bodySizeLimit` des actions, et surtout `experimental.proxyClientMaxBodySize` (10 Mo par défaut dès qu'un `src/proxy.ts` existe) qui **coupe** le corps sans erreur claire — l'action reçoit un formulaire tronqué, « Unexpected end of form », 500, et l'exception traversait jusqu'à l'écran d'erreur du navigateur. Les images passaient, une vidéo de 14,9 Mo non. Depuis : les visuels partent du **navigateur directement dans le bucket** (`prepareVisualUploads` signe les URL, PUT côté client, `attachVisuals` accroche — `src/lib/planning/upload-client.ts`), les deux plafonds sont levés à 100 Mo en ceinture, `visualUploadError` refuse avant l'envoi ce qui dépasse 50 Mo par fichier, et `useCellAction` attrape tout échec d'action en toast, jamais en écran noir.

**À vérifier, non tranché :** le cron des Reçus déclare `maxDuration = 300`, alors que le plan Hobby plafonne les fonctions bien plus bas. Rien ne l'a encore prouvé en conditions réelles — au premier vrai passage, regarder si la fonction est coupée en cours de route.

Quand on perd du temps deux fois sur le même problème, ajoute-le ici.
