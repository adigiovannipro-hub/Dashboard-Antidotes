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

## Ce que LinkedIn sert

Sondé sur pièce le 2 septembre 2026 contre la page ANMF, par le **passage
HTTP brut** de Composio (`tools.proxyExecute`) et non par ses outils
pré-emballés :

| | Route |
|---|---|
| Statistiques de la page au grain **jour** | `/v2/organizationalEntityShareStatistics` + `timeIntervals` |
| Liste des publications (627 sur ANMF) | `/rest/posts?q=author` |
| Statistiques **par publication** | `/rest/organizationalEntityShareStatistics` + `ugcPosts=List(…)` |
| **Gains d'abonnés** mensuels | `/v2/organizationalEntityFollowerStatistics` |

Grandeurs servies : impressions, portée (`uniqueImpressionsCount`), clics,
réactions, commentaires, partages. Ni enregistrements ni vues vidéo —
LinkedIn n'en a pas.

**Les outils pré-emballés de Composio ne suffisent pas** : `GET_SHARE_STATS`
refuse tout `timeIntervals`, quelle que soit la forme, et aucun outil
n'expose les publications. Ce ne sont pas des limites de LinkedIn.

Ce qui reste fermé : `/rest/socialActions/{urn}` (403, réservé aux
partenaires LinkedIn) — sans conséquence, les réactions et commentaires
arrivent déjà par les statistiques de publication.

## La courbe d'abonnés se reconstruit

LinkedIn ne rend pas l'historique du nombre d'abonnés, seulement le total du
jour et les **gains** de chaque mois. Le connecteur remonte donc le temps :
le compte à la fin d'un mois est celui d'aujourd'hui moins les gains de tous
les mois qui ont suivi. Treize mois de courbe dès le premier passage, là où
Meta repart de zéro.

## Pièges déjà payés

- **Deux tiroirs Composio.** Un compte branché depuis « All Apps » du tableau
  de bord atterrit dans le tiroir personnel (« For You »), invisible du projet
  Platform que l'application interroge. Le workflow parle au bon tiroir.
- **La configuration par défaut ne demande pas les portées d'organisation.**
  Avec elle, toute lecture de page répond 403 `r_organization_admin`.
- **Composio refuse `latest`** à l'exécution manuelle d'un outil, avec un
  message qui accuse la version (« Toolkit version not specified ») alors que
  rien n'est en cause.
- **Les routes `/rest/` périment.** LinkedIn ne garde qu'une année de
  versions, et la fenêtre n'est pas un intervalle continu : au balayage du
  2 septembre 2026, 202606, 202603, 202601 et 202510 répondaient, 202512 et
  202508 non. `LINKEDIN_API_VERSION` la surcharge sans déploiement. Les
  routes `/v2` n'ont pas d'en-tête de version et servent les mêmes
  statistiques : le connecteur les préfère partout où elles suffisent.
- **La passerelle résout une organisation par appel.** `count: 100` rend
  **une** fiche, pas cent : il faut parcourir les rangs un à un. Six pages
  sortaient comme une seule.
- **Ce ne sont pas des ACL.** La réponse porte une fiche d'organisation à
  identifiant numérique, pas un `urn:li:organization:…` — la deviner a fait
  conclure « ce compte n'administre aucune page » sur un compte qui en
  administre six.
