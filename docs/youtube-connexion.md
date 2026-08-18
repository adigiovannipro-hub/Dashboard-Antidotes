# Brancher YouTube

Le connecteur YouTube sert la **Modération** : il relève les commentaires
d'une chaîne et permet d'y répondre depuis l'inbox. Il ne publie pas de vidéo
et ne lit aucune statistique — ce n'est pas un connecteur de Reporting.

Contrairement à Meta, où un seul login de l'agence atteint les comptes de tous
les clients, **YouTube s'autorise chaîne par chaîne** : c'est le compte Google
qui administre la chaîne du client qui doit accepter, une fois par client.

## Ce qui existe déjà

Le projet Google Cloud est celui des Reçus (Gmail) : `GOOGLE_OAUTH_CLIENT_ID`
et `GOOGLE_OAUTH_CLIENT_SECRET` sont déjà en place, sur Vercel comme en local.
Il n'y a pas de second projet à créer.

## Les trois réglages à faire dans Google Cloud

1. **Activer l'API** — *APIs & Services → Library → YouTube Data API v3 →
   Enable*. Sans elle, tout appel revient en `accessNotConfigured`.

2. **Ajouter la portée** — *OAuth consent screen → Scopes* :

   | Portée | Ce qu'elle ouvre |
   |---|---|
   | `.../auth/youtube.force-ssl` | Lire les commentaires **et** y répondre |

   `youtube.readonly` ne suffirait pas : elle lit sans permettre de répondre,
   et il faudrait alors les deux. Une seule portée, c'est moins à expliquer au
   client au moment du consentement.

3. **Autoriser l'URL de retour** — *Credentials → l'identifiant OAuth existant
   → Authorized redirect URIs*, ajouter exactement :

   ```
   http://localhost:3000/api/social/youtube/connexion/callback
   https://votre-domaine/api/social/youtube/connexion/callback
   ```

   L'adresse doit correspondre au caractère près à `NEXT_PUBLIC_SITE_URL` :
   c'est sur ce domaine que le cookie d'état est posé, et le retour est refusé
   sans lui.

## Le mode « Testing » périme le jeton en sept jours

Si l'application Google est restée en *Testing*, Google fait expirer le jeton
de rafraîchissement au bout de **sept jours** : la connexion cesse seule, et le
relevé affiche « l'autorisation Google n'est plus valable ». Le passage *In
production* lève la limite ; la validation Google n'est pas exigée pour un
usage interne, mais un écran « application non vérifiée » apparaîtra au
consentement. C'est attendu.

Si les Reçus tournent depuis plus d'une semaine sans reconnexion, l'application
est déjà en production et il n'y a rien à faire.

## Brancher

1. Ouvrir le Planning du client, bouton **Connexions**.
2. Le bouton « Brancher YouTube » n'apparaît que si **YouTube est déclaré aux
   livrables du Contexte** — c'est la déclaration du client qui commande
   l'écran, pas une liste en dur.
3. Autoriser avec le compte Google qui administre la chaîne. Toutes les
   chaînes de ce compte entrent dans l'inventaire.
4. Choisir la chaîne dans la ligne YouTube : c'est cette affectation qui dit
   d'où viennent les commentaires de ce client.
5. « Relever maintenant » depuis la Modération.

## Le quota, et pourquoi il ne posera pas de problème

10 000 unités par jour et par projet, remises à zéro à minuit heure du
Pacifique.

| Appel | Coût | Fréquence |
|---|---|---|
| Une page de 100 fils de commentaires | 1 | quelques-unes par relevé |
| Une description de 50 vidéos | 1 | une par relevé |
| Une réponse publiée | 50 | à la main, quelques-unes par jour |

Un relevé horaire d'une chaîne active consomme quelques dizaines d'unités par
jour. Le poste qui compte est la **réponse**, et elle est humaine.

Un quota épuisé n'est pas une panne : le relevé reprend au passage suivant
sans rien perdre, et le message le dit plutôt que de proposer de rebrancher.
