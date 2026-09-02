# Brancher LinkedIn

LinkedIn ne passe pas par un aller-retour OAuth d'Antidotes, contrairement à
Meta et YouTube : **l'autorisation vit chez Composio**. Une seule connexion
couvre toutes les pages que le compte administre.

## Une fois pour l'agence

1. Actions → **Composio — lien de connexion** → Run workflow, toolkit
   `linkedin`, identifiant `agence`.
2. Ouvrir le lien imprimé dans le journal de l'étape « Lien » et autoriser
   avec le compte qui administre les pages clientes. L'écran de consentement
   doit parler des **pages entreprise** : la configuration utilisée est
   `linkedin-pages`, qui demande les portées de la Community Management API
   (`r_organization_social`, `r_organization_admin`, `rw_organization_admin`).
3. Vérifier : Actions → **Base de données** → cocher « Diagnostic LinkedIn ».
   Il liste les pages administrées avec leur nombre d'abonnés.

Le lien expire vite — l'ouvrir tout de suite.

## Par client

Dans le Planning, bouton **Connexions** (propriétaire seulement) :

1. « Ajouter les pages LinkedIn » remplit l'inventaire de l'agence depuis
   LinkedIn. Rien n'est affecté au passage.
2. Choisir la page du client dans la ligne LinkedIn. C'est ce choix qui décide
   d'où viennent les chiffres du Reporting.

Le bouton n'apparaît que si LinkedIn est déclaré aux livrables du Contexte.

## Ce que LinkedIn sert, et ce qu'il ne sert pas

Sondé sur pièce le 2 septembre 2026, contre le vrai service :

| | |
|---|---|
| Abonnés du jour | oui (`LINKEDIN_GET_NETWORK_SIZE`) |
| Compteurs cumulés de publications | oui (`LINKEDIN_GET_SHARE_STATS`) — impressions, portée, clics, réactions, commentaires, partages |
| Liste des publications d'une page | **non** — aucun outil de la passerelle ne l'expose |
| Découpage par jour, semaine ou mois | **non** — les trois formes d'intervalle documentées répondent « Bad request … time intervals » |
| Statistiques de page datées | **non** — la passerelle passe les paramètres d'une façon que LinkedIn refuse (`QUERY_PARAM_NOT_ALLOWED`) |

Conséquences, toutes assumées :

- Le tableau « Performance par publication » **n'existe pas** sur l'onglet
  LinkedIn. Un panneau vide se lirait comme une panne.
- Les chiffres d'une période sont la **différence entre deux relevés
  cumulés** (`social_lifetime_totals`, migration `20260902d`). C'est exact,
  additif, et ça survit à un jour manqué — la différence couvre alors deux
  jours.
- Il n'y a **pas d'antériorité** : rien avant le premier relevé. Une période
  qui n'a pas de borne basse affiche « — », jamais un zéro. La courbe se
  construit à partir du branchement.

## Pièges déjà payés

- **Deux tiroirs Composio.** Un compte branché depuis « All Apps » du tableau
  de bord atterrit dans le tiroir personnel (« For You »), invisible du projet
  Platform que l'application interroge. Le workflow parle au bon tiroir.
- **La configuration par défaut ne demande pas les portées d'organisation.**
  Avec elle, toute lecture de page répond 403 `r_organization_admin`.
- **Composio refuse `latest`** à l'exécution manuelle d'un outil, avec un
  message qui accuse la version (« Toolkit version not specified ») alors que
  rien n'est en cause. `COMPOSIO_LINKEDIN_TOOL_VERSION` épingle une version
  datée si besoin.
- **La passerelle résout une organisation par appel.** `count: 100` rend
  **une** fiche, pas cent : il faut parcourir les rangs un à un. Six pages
  sortaient comme une seule.
- **Ce ne sont pas des ACL.** La réponse porte une fiche d'organisation à
  identifiant numérique, pas un `urn:li:organization:…` — la deviner a fait
  conclure « ce compte n'administre aucune page » sur un compte qui en
  administre six.
