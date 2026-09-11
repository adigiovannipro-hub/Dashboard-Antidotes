# Composio — passerelle de connecteurs

Composio est un intermédiaire d'authentification et d'appel d'API : il porte
les applications OAuth, garde les jetons, les rafraîchit, et expose chaque
service sous forme d'outils appelables. L'intérêt pour Antidotes est précis —
**ne plus écrire ni faire valider une application OAuth par plateforme**.

Ce document dit où mettre les clés, ce que la passerelle remplace, et surtout
ce qu'elle **ne remplace pas**. Il est écrit avant toute intégration : rien
n'est branché à ce jour.

## Les deux produits, à ne pas confondre

| | Composio For You | Composio Platform |
|---|---|---|
| Pour | mon agent, mes comptes | une application dont les comptes sont connectés |
| Surface | MCP / CLI | SDK serveur |
| Clé | `ck_…` | `COMPOSIO_API_KEY`, commence par `ak_` |

**Antidotes relève du Platform.** Les deux clés ne sont pas interchangeables.
« For You » peut servir à part, pour piloter Composio depuis Claude Desktop,
mais ce n'est pas ce qui alimentera les crons.

## Où mettre les clés

### En local — `.env.local`

```
COMPOSIO_API_KEY=ak_…
COMPOSIO_DEFAULT_USER_ID=
```

Les gabarits sont dans `.env.example`. `.env.local` est ignoré par git.

**Ne pas lancer `composio dev init`** si la clé vient déjà du tableau de bord :
la commande réécrirait `.env.local` et pourrait changer de projet.

### Sur Vercel — Project Settings → Environment Variables

`COMPOSIO_API_KEY`, en **Production et Preview**. Jamais préfixée
`NEXT_PUBLIC_` : elle ouvre l'accès à tous les comptes connectés du projet.

### Sur GitHub — Settings → Secrets and variables → Actions

`COMPOSIO_API_KEY`, parce que la synchronisation Airwallex tourne déjà là-bas
(`airwallex-sync.yml`) et que tout connecteur qu'un runner devra jouer y aura
besoin de la même clé.

## L'identité : un espace client = un utilisateur Composio

Composio range les comptes connectés sous un identifiant d'utilisateur. Le
choix retenu est **l'UUID de l'espace client** (`workspaces.id`), pas un
identifiant global :

- le compte Meta d'I-WAY reste rattaché à I-WAY ;
- révoquer un client, c'est révoquer ses connexions à lui ;
- le cloisonnement de la plateforme se prolonge chez le prestataire au lieu
  de s'arrêter à notre base.

`COMPOSIO_DEFAULT_USER_ID` n'existe que pour les scripts joués à la main, quand
aucun espace n'est en contexte.

## Ce que la passerelle peut remplacer

| Aujourd'hui | Avec Composio |
|---|---|
| App Meta, jeton d'utilisateur système, `META_APP_ID`/`SECRET` | connexion par lien, jetons portés et rafraîchis par la passerelle |
| OAuth Gmail écrit à la main (`/api/recus/connexion`, cookie anti-rejeu, chiffrement AES-256-GCM des jetons) | une connexion, plus de jetons chez nous |
| LinkedIn et TikTok : entité juridique, politique de confidentialité, audit d'interface — des semaines (`docs/connecteurs-linkedin-tiktok.md`) | l'application OAuth est celle de Composio |

Le dernier point est le seul qui débloque quelque chose d'impossible
aujourd'hui. Les deux premiers remplacent du code qui **fonctionne déjà** :
les migrer est un gain de dette, pas de fonctionnalité.

## Ce que la passerelle ne remplace pas

**À vérifier avant de compter dessus, une fois la clé disponible :**

- **Les Insights publicitaires Meta au grain jour.** Le Reporting demande
  `time_increment=1`, `breakdowns=age,gender` et `region`, `level=adset`,
  `actions` et `action_values` — voir `src/lib/connectors/meta/graph.ts`. Les
  catalogues d'outils de ce genre de passerelle sont orientés **action**
  (publier, envoyer, créer), rarement **analytique paramétrée**. Si l'outil ne
  laisse pas passer ces paramètres, le connecteur Meta Ads reste tel quel.
- **Airwallex.** Le blocage n'y est pas l'authentification mais l'adresse IP :
  Airwallex refuse celles de Vercel, d'où le workflow GitHub. Une passerelle
  appellerait depuis ses propres adresses — ce qui pourrait le régler — mais
  encore faut-il qu'un connecteur Airwallex existe.
- **La règle d'architecture ne change pas.** Aucun appel à une API tierce
  depuis le navigateur. Composio s'appelle depuis un cron ou une Server
  Action, les résultats sont persistés en base et upsertés par identifiant
  externe. La passerelle remplace la couche d'authentification, pas le modèle
  de données.

## Coût — non vérifié

`composio.dev` est injoignable depuis l'environnement d'exécution des
sessions : **les paliers tarifaires n'ont pas pu être lus.** Rien ne sera
branché avant d'avoir répondu à trois questions, sur le tableau de bord :

1. le palier gratuit, en nombre d'appels d'outils par mois ;
2. ce qui est décompté — un appel d'outil, un compte connecté, un utilisateur ;
3. le prix au-delà.

Ordre de grandeur à confronter à ces plafonds : un passage de synchronisation
Meta appelle les Insights 3 fois par compte publicitaire, plus 1 appel par
publication organique lue. Sur cinq clients, une collecte quotidienne pèse
quelques centaines d'appels par jour — c'est ce chiffre qui décidera si la
passerelle tient dans le gratuit.

## Vérifier une connexion

Une fois la clé posée :

```bash
npm install @composio/core
```

Puis, dans un script serveur, lister les outils réellement exposés pour un
service avant d'écrire quoi que ce soit autour. **Ne jamais inventer un nom
d'outil** : ils se découvrent à l'exécution.

## État au 25/08/2026 — la première intégration est en place

**Google Analytics est le premier connecteur qui passe par la passerelle** :
l'onglet Site Web du Reporting lit GA4 à travers le SDK `@composio/core`
(`src/lib/connectors/google-analytics/composio.ts`), avec la clé
`COMPOSIO_API_KEY` et les comptes rangés sous l'UUID de l'espace client.
Démarches et volumes : `docs/web-analytics-setup.md`.

## Les branchements directs sont fermés

Le chemin direct est **neutralisé**, pas supprimé :
`src/lib/social/direct-connect.ts` porte la constante `BRANCHEMENT_DIRECT`,
aujourd'hui `false`. Deux chemins de branchement qui cohabitent, ce sont deux
jeux de jetons pour le même compte et rien pour dire lequel fait autorité.

Ce que la constante ferme, vérifié sur `build && start` :

| Surface | Avant | Maintenant |
|---|---|---|
| `/api/social/meta/connexion` et son callback | dialogue Facebook Login | **404** |
| `/api/social/youtube/connexion` et son callback | dialogue Google | **404** |
| Boîte « Connexions » du Reporting | boutons Brancher / Rebrancher | la note de bascule |
| État vide du Reporting | « à faire depuis Connexions » | la note de bascule |
| Modération avant premier relevé | « brancher un compte… » | la note de bascule |
| Notes de `/api/reporting/sync` et `/api/moderation/sync` | idem | la note de bascule |

Le message est **unique** (`COMPOSIO_TRANSITION_NOTE`) : cinq formulations,
ce sont cinq vérités qui divergent au premier changement.

Ce qui n'est **pas** touché, volontairement : les tables (`social_accounts`,
`workspace_social_accounts`, `social_account_secrets`), les affectations déjà
faites, les connecteurs Meta et YouTube, l'OAuth Gmail des Reçus et la chaîne
Airwallex. Les deux dernières fonctionnent en production et ne sont pas au
programme de la bascule.

Rallumer le chemin direct est un geste unique : passer la constante à `true`.

## Le blocage à lever avant toute intégration

**`composio.dev` est refusé par la politique réseau des sessions distantes.**
Mesuré le 25/08/2026 : `CONNECT` répond **403** sur `docs.composio.dev` comme
sur `backend.composio.dev`. Conséquences directes :

- pas d'appel au SDK ni à l'API depuis une session ;
- pas de lecture de la documentation vivante, donc **aucun moyen de découvrir
  les noms d'outils** — et la règle est de ne jamais les inventer ;
- ni `composio login` ni `composio setup --target auto` : ces commandes
  relèvent de « For You » (clé `ck_`, navigateur), pas du SDK Platform, et
  aucune des deux ne peut aboutir sans réseau.

Le déblocage est un réglage d'environnement, pas de code : autoriser
`composio.dev` (docs et backend) dans la politique réseau de l'environnement
d'exécution. Sans lui, l'intégration ne peut être qu'écrite à l'aveugle et
jamais vérifiée — ce qui est exactement le faux positif qu'on s'interdit.

## Point de reprise, une fois le réseau ouvert et la clé posée

1. `COMPOSIO_API_KEY` dans `.env.local`, sur Vercel et dans les secrets Actions.
2. Lister les toolkits réellement exposés pour Meta, LinkedIn, TikTok et
   YouTube, et **les noms d'outils**, avant d'écrire quoi que ce soit.
3. Trancher la question ouverte : les Insights publicitaires Meta au grain
   jour, avec `breakdowns` et `action_values`, passent-ils ? Si non, le
   connecteur Meta Ads reste tel quel et seule l'organique bascule.
4. Répondre aux trois questions de coût de la section précédente.
