# Inbound — un tableau

Le versant inbound du pôle Antidotes sert le personal branding : veiller ce
qui marche dans la niche, en tirer un post LinkedIn, un script de reel ou un
script de vidéo YouTube qui sonne comme moi, le valider, le dater, le publier.

Tout tient sur `/antidotes/inbound`, et l'écran **est** le tableau : la veille
et mes propres posts dans les mêmes lignes, réseau, date, auteur, contenu,
chiffres, score. Le réseau, la date et l'auteur se corrigent dans la cellule ;
le texte se relit dans le panneau.

| Où | Ce qu'on y fait |
|---|---|
| Le tableau | Ce qui a marché, chez les autres et chez moi. Une ligne ouvre le panneau |
| **Calendrier** | Le même contenu au mois : la veille en gris, ce qui est de moi en vert |
| **Filtres** | Réseau, période, source, cinq seuils, tri — un panneau, et les filtres posés en pastilles sous la barre |
| **Comptes** | Les concurrents veillés : on colle un lien, le réseau se reconnaît. Et les seuils de relevé |
| **Prompts** | Ma voix, puis un prompt et un exemple **par forme** |

Le **panneau** est en deux parties : le contenu actuel — visuel, script,
chiffres — puis « Réécrire pour moi », en trois boutons. Puis relire,
approuver, dater, illustrer, publier. Rien ne part sans être approuvé.

Tout l'état d'affichage vit dans l'URL mais **ne repasse pas par le serveur** :
filtrer, trier, ouvrir une ligne ne coûte aucun aller-retour, la page ayant
déjà tout chargé.

## Mes posts

Trente à cinquante de mes meilleurs posts — dans le tableau, avec la veille,
sous le filtre « Mes posts ». Collés un par un ou importés
depuis l'export LinkedIn (**Paramètres → Confidentialité des données →
Obtenir une copie de vos données**, fichier `Shares.csv`). Réactions et
commentaires se saisissent à la main — l'export ne les contient pas.

Avec `OPENAI_API_KEY`, chaque post reçoit un vecteur
(`text-embedding-3-small`, 1 536 dimensions, quelques centièmes de centime
le corpus entier) ; le studio retrouve alors les cinq posts les plus
proches d'un sujet par similarité cosinus. Sans la clé, il rapproche par
recoupement lexical (TF-IDF) et l'écran le dit.

## Le radar

Une liste de comptes à veiller, par réseau. Le relevé tourne **une fois par
jour sur GitHub Actions** (`.github/workflows/radar.yml`) et au bouton
« Relever maintenant » (`workflow_dispatch`, `GITHUB_SYNC_TOKEN`).

| Réseau | Source | Clé (secret GitHub Actions) | Coût |
|---|---|---|---|
| LinkedIn | acteur Apify `apimaestro/linkedin-profile-posts` | `APIFY_TOKEN` | quelques dixièmes de centime par compte |
| X | acteur Apify `apidojo/tweet-scraper` | `APIFY_TOKEN` | idem |
| TikTok | acteur Apify `clockworks/tiktok-scraper` | `APIFY_TOKEN` | idem |
| YouTube | Data API v3, clé d'API sans OAuth | `YOUTUBE_API_KEY` | gratuit (3 unités par chaîne, 10 000/jour) |
| Instagram et Reels | acteur Apify `apify/instagram-scraper` — **le seul chemin qui rende les vues d'un reel et son fichier vidéo**, dont on tire le script | `APIFY_TOKEN` | quelques dixièmes de centime par compte |
| Instagram, à défaut | Business Discovery de l'API Graph, avec le jeton d'un compte professionnel de l'inventaire Meta — ni vues, ni vidéo | rien de plus | gratuit |

Le **score d'engagement** rapporte les interactions pondérées (like 1,
commentaire 3, partage 5) aux abonnés de l'auteur, en pour mille. Les
abonnés viennent du réseau quand il les rend (X, TikTok, YouTube,
Instagram) ou se saisissent sur le compte (LinkedIn). Sans dénominateur, le
score est absolu et l'écran l'affiche en interactions.

**Les seuils décident de ce qu'une vague garde** (fenêtre Comptes, par réseau) :
en dessous, un contenu n'entre pas dans le corpus. Un seuil ne juge que ce que
le réseau rend — « ≥ 10 000 vues » n'écarte pas un post LinkedIn, qui n'a pas
de vues.

**Le script d'une vidéo est transcrit au relevé** (`transcribe.ts`,
`gpt-4o-mini-transcribe`, `OPENAI_API_KEY`) : environ 0,3 centime la minute,
quelques centimes par jour pour trente comptes. C'est le script que le
tableau montre et que le studio reçoit comme matière — une légende de trois
mots ne dit rien de ce qui a marché. Sans la clé, le passage le dit et
continue.

La proposition de sujets par le modèle a été **retirée de l'écran** : on part
d'un contenu qui a marché, pas d'un sujet abstrait. `propose-topics.ts` et sa
table restent en place, sans point d'entrée.

**Aucun connecteur n'a tourné contre le vrai service** : ils sont écrits
sur la documentation des acteurs et des API. Le premier relevé réel se lit
dans le journal du workflow ; une erreur de forme se voit sur le compte
(« dernière erreur »).

## Écrire, dans ma voix

Trois formes, trois prompts : un **post LinkedIn** (`studio-prompt.ts`), un
**script de reel** (`reel-prompt.ts` — accroche de trois secondes, plans
numérotés avec leur indication visuelle, chute ; quarante-cinq à soixante
secondes) et un **script de vidéo YouTube** (`prompts.ts` — titre, accroche de
quinze secondes, sections numérotées, conclusion ; six à huit minutes). Un post
lu et un script dit ne se coupent pas aux mêmes endroits : raccourcir l'un pour
faire l'autre s'entend.

Chaque génération reçoit, dans cet ordre : **mes consignes de voix**, mon
exemple de la forme demandée, puis mes cinq posts les plus proches du sujet,
puis la matière de la veille (jamais comme modèle). `claude-opus-5` écrit
(`ANTHROPIC_API_KEY`, déjà sur Vercel). Le brouillon se relit, se corrige, se
réécrit ; **rien ne part sans être approuvé**.

**Les prompts s'écrivent à l'écran** (fenêtre « Prompts ») : « comment
j'écris », valable pour tout, puis un onglet par forme avec sa consigne et son
exemple. Le champ est prérempli avec le prompt d'origine et **le vider y
revient** — `resolvePrompt` (pur, testé) traite un champ vide comme une absence
de retouche, jamais comme une consigne vide : ouvrir la fenêtre une fois ne
doit pas casser la génération. C'est le seul endroit de l'inbound qui porte une
phrase d'explication — sans elle, on ne devine pas que ce qui est écrit là
change ce que le modèle rend.

**Visuel** : `REPLICATE_API_TOKEN` et `REPLICATE_LORA_VERSION` (la version
d'un LoRA Flux entraîné sur mes photos, `owner/model:version` ou hash),
`REPLICATE_LORA_TRIGGER` pour le mot appris à l'entraînement. L'image est
rapatriée dans le bucket privé `antidotes-visuals`. Environ trois centimes
par image ; l'entraînement du LoRA est une opération à part (quelques
euros, une fois). Hypothèse du cahier des charges, à confirmer sur pièce.
C'est le **seul** générateur d'images branché : le panneau le nomme plutôt que
d'offrir à côté des boutons morts pour ceux qui ne le sont pas encore.

**Publication** : `POST /rest/posts` sur l'API LinkedIn par le passage brut
de Composio, avec le compte LinkedIn déjà connecté pour le Reporting. Il
faut que sa configuration d'authentification porte `openid profile
w_member_social` — comme il a fallu y ajouter `r_organization_admin` pour
les pages. Jamais joué contre le vrai service.

**Programmation** : un post approuvé et daté part tout seul à son heure.
`pnpm studio:publier` est une étape du workflow horaire (`airwallex-sync.yml`,
portée `tout`) : il prend ce qui est dû (`due-drafts.ts`, pur et testé —
LinkedIn, approuvé, heure passée), **relit le statut juste avant l'envoi** et
écrit le résultat sur la ligne. Un script de reel n'a pas de publication : sa
date est un repère dans le calendrier, il se tourne.

## Ce qui n'existe pas, volontairement

- Pas de publication ailleurs que sur LinkedIn : un reel se tourne à la main.
- Pas de veille des commentaires ni de réponse automatique.
- Pas de vecteurs sur les contenus de la veille : seuls mes posts sont
  vectorisés, ce sont eux qui servent d'exemples.
