# Inbound — une page, six vues

Le versant inbound du pôle Antidotes sert le personal branding : veiller ce
qui marche dans la niche, en tirer un post LinkedIn ou un script de reel qui
sonne comme moi, le valider, le dater, le publier.

Tout tient sur `/antidotes/inbound`, en six vues :

| Vue | Ce qu'on y fait |
|---|---|
| **Contenus** | Le tableau de ce qui a marché ailleurs. Filtres et seuils dans l'URL ; une ligne ouvre le panneau |
| **Comptes** | Les concurrents veillés, par réseau |
| **Sujets** | Ce que le modèle tire des meilleurs contenus |
| **Mes posts** | Mes publications (le corpus qui donne le ton) et mes brouillons |
| **Calendrier** | Le mois : ce qui part quand |
| **Consignes** | Ma voix et les seuils de relevé |

Le **panneau** porte le geste central : « Réécrire pour moi », en deux
formes — script de reel, post LinkedIn. Puis relire, approuver, dater,
illustrer, publier. Rien ne part sans être approuvé.

## La bibliothèque

Trente à cinquante de mes meilleurs posts, collés un par un ou importés
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

**Les seuils décident de ce qu'une vague garde** (vue Consignes, par réseau) :
en dessous, un contenu n'entre pas dans le corpus. Un seuil ne juge que ce que
le réseau rend — « ≥ 10 000 vues » n'écarte pas un post LinkedIn, qui n'a pas
de vues.

**Le script d'une vidéo est transcrit au relevé** (`transcribe.ts`,
`gpt-4o-mini-transcribe`, `OPENAI_API_KEY`) : environ 0,3 centime la minute,
quelques centimes par jour pour trente comptes. C'est le script que le
tableau montre et que le studio reçoit comme matière — une légende de trois
mots ne dit rien de ce qui a marché. Sans la clé, le passage le dit et
continue.

« Proposer des sujets » soumet les trente meilleurs posts des trente
derniers jours à `claude-opus-5`, qui rend quatre à huit sujets appuyés sur
des posts cités. Un sujet s'écrit (il passe « utilisé ») ou s'écarte (il ne
revient pas).

**Aucun connecteur n'a tourné contre le vrai service** : ils sont écrits
sur la documentation des acteurs et des API. Le premier relevé réel se lit
dans le journal du workflow ; une erreur de forme se voit sur le compte
(« dernière erreur »).

## Écrire, dans ma voix

Deux formes, deux prompts : un **post LinkedIn** (`studio-prompt.ts`) et un
**script de reel** (`reel-prompt.ts` — accroche de trois secondes, plans
numérotés avec leur indication visuelle, chute ; quarante-cinq à soixante
secondes). Un post lu et un script dit ne se coupent pas aux mêmes endroits :
raccourcir l'un pour faire l'autre s'entend.

Chaque génération reçoit, dans cet ordre : **mes consignes de voix**, mon
exemple de la forme demandée, puis mes cinq posts les plus proches du sujet,
puis la matière de la veille (jamais comme modèle). `claude-opus-5` écrit
(`ANTHROPIC_API_KEY`, déjà sur Vercel). Le brouillon se relit, se corrige, se
réécrit ; **rien ne part sans être approuvé**.

**Les consignes** vivent dans la vue du même nom : comment j'écris, un post,
un script et un email de ma main, et les seuils de relevé. C'est le seul
endroit de l'inbound qui porte une phrase d'explication — sans elle, on ne
devine pas que ce qui est écrit là change ce que le modèle rend.

**Visuel** : `REPLICATE_API_TOKEN` et `REPLICATE_LORA_VERSION` (la version
d'un LoRA Flux entraîné sur mes photos, `owner/model:version` ou hash),
`REPLICATE_LORA_TRIGGER` pour le mot appris à l'entraînement. L'image est
rapatriée dans le bucket privé `antidotes-visuals`. Environ trois centimes
par image ; l'entraînement du LoRA est une opération à part (quelques
euros, une fois). Hypothèse du cahier des charges, à confirmer sur pièce.

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
