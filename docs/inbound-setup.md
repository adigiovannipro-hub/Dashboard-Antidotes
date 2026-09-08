# Inbound — radar, studio, bibliothèque

Le versant inbound du pôle Antidotes sert le personal branding LinkedIn :
veiller ce qui marche dans la niche, en tirer des sujets, écrire des posts
qui sonnent comme moi, les valider, les publier.

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
| Instagram et Reels | Business Discovery de l'API Graph, avec le jeton d'un compte professionnel de l'inventaire Meta | rien de plus | gratuit |

Le **score d'engagement** rapporte les interactions pondérées (like 1,
commentaire 3, partage 5) aux abonnés de l'auteur, en pour mille. Les
abonnés viennent du réseau quand il les rend (X, TikTok, YouTube,
Instagram) ou se saisissent sur le compte (LinkedIn). Sans dénominateur, le
score est absolu et l'écran l'affiche en interactions.

« Proposer des sujets » soumet les trente meilleurs posts des trente
derniers jours à `claude-opus-5`, qui rend quatre à huit sujets appuyés sur
des posts cités. Un sujet s'écrit (il passe « utilisé ») ou s'écarte (il ne
revient pas).

**Aucun connecteur n'a tourné contre le vrai service** : ils sont écrits
sur la documentation des acteurs et des API. Le premier relevé réel se lit
dans le journal du workflow ; une erreur de forme se voit sur le compte
(« dernière erreur »).

## Le studio

Un post depuis un sujet — libre, proposé par le radar, ou inspiré d'un post
de la veille. Le prompt reçoit mes cinq posts les plus proches comme
exemples de ton, le post de la veille comme matière (jamais comme modèle),
et `claude-opus-5` écrit (`ANTHROPIC_API_KEY`, déjà sur Vercel). Le
brouillon se relit, se corrige, se réécrit ; **rien ne part sans être
approuvé**.

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

## Ce qui n'existe pas, volontairement

- Pas de programmation à date : un post approuvé part au clic.
- Pas de publication ailleurs que sur LinkedIn.
- Pas de veille des commentaires ni de réponse automatique.
