# Brancher TikTok (organique)

Trois gestes côté compte, un côté code. Le premier est le seul qui prenne du
temps — et il ne dépend pas de nous.

## Ce qu'on peut espérer, et ce qu'on ne peut pas

TikTok a **deux API** qui ne portent ni le même nom, ni le même hôte, ni les
mêmes droits. Le confondre est l'erreur classique.

| | Display API | Business Account API |
|---|---|---|
| Hôte | `open.tiktokapis.com` | `business.tiktokapis.com` |
| Ce qu'elle rend | les vidéos **publiques** du compte, avec vues, j'aime, commentaires, partages, durée, vignette, lien ; le profil et son nombre d'abonnés | en plus : les **vues de profil**, l'audience, et les grandeurs au **grain jour** |
| Ce qu'elle ne rend pas | aucune série temporelle, aucune vue de profil, aucune portée | — |
| Pour l'obtenir | app TikTok Developers, portées `user.info.basic`, `user.info.stats`, `video.list` | en plus : produit « TikTok Account Management », validé par TikTok après audit de l'interface |

Composio n'emballe aujourd'hui que la Display API, en deux outils :
`TIKTOK_GET_USER_STATS` (abonnés, abonnements, j'aime cumulés, nombre de
vidéos) et `TIKTOK_LIST_VIDEOS` (une page de vingt vidéos au plus, à
paginer par curseur).

Conséquence à annoncer au client **avant** de brancher : sur TikTok, le
reporting portera les vidéos et leurs compteurs, pas une courbe
d'impressions quotidiennes. Les tuiles sans mesure afficheront « — », jamais
un zéro — même règle que Facebook, où Meta a retiré les impressions de Page.
L'antériorité des abonnés se reprendra à la main, comme ailleurs
(`pnpm import:followers`), puisque TikTok ne rend que le compte du jour.

**Rien de tout cela n'est acquis tant que la sonde n'a pas parlé.** La
documentation d'un service et ce que la passerelle en laisse passer sont
deux choses différentes — LinkedIn a coûté une demi-journée sur exactement
cette confusion. La question ouverte est celle du passage brut
(`tools.proxyExecute`) : il a rendu la main sur toute l'API LinkedIn, mais
la Business API de TikTok vit sur **un autre hôte** que la Display API, et
rien ne garantit qu'il l'atteigne.

## 1. L'app TikTok Developers

Composio ne gère pas l'OAuth TikTok pour nous, contrairement à LinkedIn ou
Google : il faut une app à soi.

1. <https://developers.tiktok.com> → **Manage apps** → créer une app.
2. Renseigner les deux URL que TikTok exige, et qui sont **servies par
   l'application elle-même** : `/confidentialite` et `/cgu`. Elles sont
   publiques — les chemins sont dans `PUBLIC_PATHS`, sans quoi l'examinateur
   tomberait sur l'écran de connexion. La section « Les données venant de
   TikTok » de la politique nomme les trois portées demandées et l'usage qui
   en est fait : c'est ce que l'examinateur y cherche.

   **Prendre l'URL de production Vercel, jamais celle d'un déploiement.**
   Vercel donne trois formes d'adresse : celle d'un déploiement
   (`…-a1b2c3d4-….vercel.app`), qui **change à chaque push** et sera morte
   quand TikTok reviendra vérifier ; l'alias de production
   (`<projet>.vercel.app`), stable ; et le domaine propre, le jour où il
   existera. Seules les deux dernières conviennent.
3. Ajouter le produit **Login Kit**, puis les portées `user.info.basic`,
   `user.info.stats` et `video.list`. Rien de plus : une portée superflue
   allonge la revue.
4. Login Kit → **Redirect URI**. TikTok en accepte dix, on en pose deux —
   Composio a fait évoluer le préfixe de version et les deux répondent :
   `https://backend.composio.dev/api/v3/toolkits/auth/callback`
   `https://backend.composio.dev/api/v3.1/toolkits/auth/callback`
5. Créer un **Sandbox** et y déclarer le compte TikTok du client comme
   *target user*. C'est ce qui permet d'essayer **sans attendre la revue** :
   l'app fonctionne tout de suite pour les comptes déclarés.
6. Noter la **client key** et la **client secret**.

Le produit « TikTok Account Management » (Business Account API) se demande
au même endroit et passe par un audit : à ne lancer que si les vues de
profil et le grain jour sont réellement attendus au contrat.

## 2. La configuration d'authentification Composio

Dans le projet **Platform** (clé `ak_…`), pas dans l'espace personnel :
une connexion faite depuis « All Apps » atterrit dans le tiroir « For You »
et reste **invisible** de l'application. C'est ce qui a fait croire à zéro
compte LinkedIn alors que trois existaient.

Créer une configuration TikTok avec la client key et la client secret de
l'étape 1, et les trois portées.

## 3. Le branchement du compte

```
pnpm composio:lien --toolkit tiktok
```

Ouvrir le lien, se connecter avec le compte TikTok du client, accepter.

## 4. Sonder avant d'écrire

```
pnpm diagnostic:tiktok
```

Étape « Diagnostic TikTok » du workflow **Base de données** — c'est le seul
endroit d'où l'API Composio est joignable ; elle ne l'est pas depuis
l'environnement de développement distant.

Le diagnostic répond dans l'ordre : la configuration existe-t-elle, un
compte est-il branché **dans ce projet**, que rendent les deux outils
emballés, et jusqu'où porte le passage brut. Il affiche la **réponse telle
quelle** quand rien ne se parse : une liste vide et une réponse mal lue se
ressemblent, et confondre les deux fait chercher un problème de portées qui
n'existe pas.

Le connecteur s'écrit après, sur ce que la sonde a montré — pas sur ce que
la documentation promet.

## 5. Où ça atterrit

Comme LinkedIn, TikTok se rangera dans les **tables existantes** :
`social_posts` (une ligne par vidéo : vues, j'aime, commentaires, partages),
`social_followers` (un relevé par jour, **daté du jour qu'il clôture**, soit
la veille du passage), et `social_page_daily` seulement si la Business API
est obtenue. L'onglet `tiktok` du Reporting existe déjà, avec son jeu de
tuiles et son chiffre héros : il n'y a pas d'écran à construire, seulement
une source à brancher.

---

## Où on en est — 3 septembre 2026

Session interrompue faute de patience, et c'est un signal légitime : le
chemin officiel demande beaucoup de gestes avant le premier chiffre.

**Fait :**

- App TikTok « Antidotes » créée, **ownership Organization**, type `Other`
  (aucun des deux ne se change ensuite).
- Icône 1024×1024, nom, catégorie, description (110 car.) renseignés.
- Les trois URL pointent sur `https://dashboard-antidotes-beta.vercel.app`
  (CGU, confidentialité, site) et le domaine est **vérifié par préfixe** —
  `public/tiktokVF8RKRNKQRzpHceGTGvHNkTl5tIfzjXo.txt`.
- Produit `Login Kit`. Scopes `user.info.basic`, `user.info.stats`,
  `video.list` — `user.info.profile` retiré à dessein : tout scope doit être
  démontré dans la vidéo de revue, et l'écran n'affiche ni bio ni badge.
- Texte de revue rédigé (949 / 1000).
- Configuration d'authentification TikTok ouverte côté Composio. Le Redirect
  URI qu'elle donne est `https://backend.composio.dev/api/v1/auth-apps/add`
  — **pas** les `v3` que la documentation générale annonce.

**Reste à faire, dans cet ordre :**

1. Créer un **sandbox vide** (surtout pas « Clone from Production » : le
   clone traîne l'exigence de vidéo, qui bloque l'enregistrement). Y
   reconfigurer à la main Login Kit, les trois scopes, le Redirect URI
   Composio, et déclarer le compte de test en *target user*.
2. Coller les identifiants **du sandbox** dans la configuration Composio.
3. `pnpm diagnostic:tiktok` (étape db-admin) — sonder avant d'écrire.
4. Écrire le connecteur, et **le bouton de connexion dans Connexions** :
   contrairement à LinkedIn, dont le bouton ne fait qu'importer
   l'inventaire, TikTok exige un vrai aller-retour d'autorisation lancé
   depuis le site. Sans lui, il n'y a rien à filmer.
5. La vidéo de revue, en dernier, une fois que les chiffres s'affichent.

## Ce qui a été tranché en chemin

**Le sandbox rend les données réelles de comptes réels**, jusqu'à dix, sans
aucune revue. La revue ne devient nécessaire qu'au-delà de dix comptes
connectés — donc pas avant longtemps. C'est le fait qui devrait guider la
suite : il n'y a pas d'urgence à soumettre.

**L'API officielle ne donne rien de plus qu'un scraper public** : vues,
j'aime, commentaires, partages par vidéo, et le nombre d'abonnés. Ni portée,
ni impressions, ni série temporelle — celles-ci vivent dans la Business
Account API, qui demande le produit « TikTok Account Management » et un
audit séparé. Le choix entre voie officielle et voie tierce est donc un
arbitrage de **légitimité contre friction**, jamais de richesse de données.

**Les deux portes de sortie**, si la voie officielle reste bloquante :

- **Apify / ScrapTik** — environ 1,70 $ pour 1 000 vidéos, 5 $ de crédit
  mensuel offert. Aucun OAuth, aucune revue, lit n'importe quel compte
  public (donc la veille concurrentielle en prime). Contre : contraire aux
  CGU de TikTok, casse sans prévenir, et sort du free tier.
- **Import CSV** depuis TikTok Studio — zéro coût, zéro API, un geste manuel
  par mois. Le projet a déjà ce motif avec `pnpm import:followers`.

## TikTok Ads — un autre chantier, une autre porte

À ne pas confondre avec ce qui précède. Le payant passe par la **Marketing
API**, sur le portail `business-api.tiktok.com` : **une autre application,
un autre compte développeur, une autre validation**. Rien de ce qui est
décrit ci-dessus ne s'y réutilise, sauf les pages légales.

L'onglet `tiktok-ads` du Reporting existe déjà (migration 0068) et attend sa
source. À instruire à part, quand l'organique sera réglé — le sonder avant
d'écrire, comme le reste.
