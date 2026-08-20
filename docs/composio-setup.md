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
