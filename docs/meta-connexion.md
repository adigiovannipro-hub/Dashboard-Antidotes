# Brancher Instagram — mise en place

Ce document couvre tout ce qu'il faut obtenir chez Meta pour qu'Antidotes lise
un compte Instagram et, à terme, publie à sa place.

---

## Où on en est, exactement

| Ce qui est écrit | Ce qui ne l'est pas |
|---|---|
| L'aller-retour d'autorisation avec Meta (bouton **Connexions** du Reporting) | **La publication automatique.** Aucun code ne pousse encore un post |
| La table `social_accounts` : Pages, comptes Instagram, comptes publicitaires, jetons chiffrés | La programmation à l'heure dite (le déclencheur) |
| La lecture du profil (photo, bio, abonnés) pour l'en-tête du feed | Le rattrapage d'un envoi échoué |

Autrement dit : **ce document met en place le préalable**, pas la publication.
Une fois les identifiants obtenus, il reste un chantier de développement —
détaillé à la fin, avec son coût.

**Ce dont j'ai besoin de toi au final :** deux valeurs, `META_APP_ID` et
`META_APP_SECRET`. Tout le reste ci-dessous sert à pouvoir les obtenir, et à ce
qu'elles servent à quelque chose.

---

## Ce qu'il faut savoir avant de commencer

**Instagram ne se connecte jamais seul.** Il faut trois objets liés entre eux :
un compte Instagram **Professionnel**, une **Page Facebook**, et un
**portefeuille Meta Business** qui possède les deux. Un compte Instagram
personnel, même avec 100 000 abonnés, n'a pas d'API du tout.

**Instagram n'a pas de programmation dans son API.** Ce n'est pas un oubli de
Meta, c'est le dessin de l'API : la publication se fait en deux temps — créer
le conteneur média (`/media`), puis le publier (`/media_publish`) — et le
conteneur meurt au bout de 24 h. Déposer aujourd'hui un post pour le 15 est
donc impossible par construction, et **les deux appels doivent partir au
moment où l'on veut publier**.

Une Page Facebook, elle, accepte un `scheduled_publish_time` et sort le post
toute seule à l'heure dite, dans une fenêtre bornée à quelques semaines. Deux
mécaniques différentes pour un même bouton : **on tient donc l'horloge chez
nous pour les deux**, quitte à ne pas utiliser la programmation native de
Facebook. Un seul chemin à écrire, un seul endroit à regarder quand un post
ne part pas, et aucune dépendance à une fenêtre qui peut bouger.

**Meta télécharge le média depuis une URL.** On ne lui envoie pas le fichier :
on lui donne un lien HTTPS public qu'il va chercher lui-même. Nos visuels sont
dans un bucket privé Supabase — il faudra donc leur signer une URL le temps de
l'envoi. La mécanique existe déjà pour l'affichage, elle se réutilise.

**Plafond :** 25 publications par 24 h et par compte Instagram — au-delà,
l'API rend une erreur 9. Sans objet à notre échelle.

**Le conteneur média expire au bout de 24 h.** C'est ce qui interdit de
préparer les posts du mois à l'avance : un conteneur créé le 1er pour le 15
est mort avant d'être publié. Le seul schéma valide est donc celui-ci — garder
la programmation **chez nous**, et ne créer le conteneur qu'au moment de
publier.

---

## 1. Le compte Instagram doit être Professionnel

Sur le téléphone, dans l'application Instagram du client :

1. **Profil → Menu (☰) → Paramètres et confidentialité**.
2. **Type de compte et outils → Passer à un compte professionnel**.
3. Choisir **Entreprise** (et non Créateur : le mode Créateur bride certaines
   permissions de publication selon les cas — Entreprise est le choix sûr).

Si le compte est déjà professionnel, il n'y a rien à faire.

## 2. Lier une Page Facebook au compte Instagram

Toujours dans l'application Instagram :

4. **Modifier le profil → Page** → sélectionner la Page Facebook du client, ou
   en créer une si elle n'existe pas.

Une Page Facebook est **obligatoire** même si le client ne publie jamais sur
Facebook : c'est elle qui porte le jeton avec lequel Instagram publie. Une Page
vide et sans audience fait très bien l'affaire.

## 3. Rassembler les deux dans un portefeuille Meta Business

5. Aller sur [business.facebook.com](https://business.facebook.com). Créer un
   portefeuille professionnel si tu n'en as pas (au nom d'Antidotes).
6. **Paramètres du portefeuille → Comptes → Pages** → *Ajouter* → soit
   demander l'accès à la Page du client, soit se la faire attribuer par lui.
7. **Paramètres du portefeuille → Comptes → Comptes Instagram** → ajouter le
   compte du client de la même façon.

> C'est ici que se joue la relation avec le client : il **partage** un accès, il
> ne donne pas son mot de passe. Il peut le retirer quand il veut, et tu le vois
> dans ce même écran.

## 4. Créer l'application Meta

8. Aller sur [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → **Créer une application**.
9. Cas d'usage : choisir **Autre**, puis type **Entreprise**.
10. Nom : `Antidotes`. Rattacher l'application au **portefeuille professionnel**
    de l'étape 3 — c'est ce rattachement qui rendra la vérification possible.

## 5. Récupérer les deux valeurs

11. Dans l'application : **Paramètres de l'app → Paramètres de base**.
12. Copier l'**Identifiant de l'app** → c'est `META_APP_ID`.
13. Cliquer **Afficher** à côté de **Clé secrète** → c'est `META_APP_SECRET`.

C'est tout ce que j'ai besoin de recevoir. La clé secrète ne se met **jamais**
dans le dépôt, uniquement dans Vercel (étape 8).

## 6. Ajouter les produits à l'application

Dans le menu de gauche, **Ajouter un produit** :

14. **Connexion Facebook pour les entreprises** — c'est l'aller-retour
    d'autorisation lui-même.
15. **API Graph Instagram** (aussi appelée *Instagram avec connexion Facebook*)
    — lecture du profil et publication.
16. *Plus tard seulement*, quand on branchera le Reporting : **Marketing API**.

## 7. Déclarer l'adresse de retour

C'est l'étape qu'on rate le plus souvent, et l'erreur est illisible quand elle
tombe.

17. **Connexion Facebook pour les entreprises → Paramètres**.
18. Dans **URI de redirection OAuth valides**, coller **exactement** :

    ```
    https://TON-DOMAINE/api/social/meta/connexion/callback
    ```

    en remplaçant `TON-DOMAINE` par l'adresse de production lue dans Vercel
    (*Project → Domains*). Pas de barre oblique finale, `https` obligatoire.

Toute différence — un `www` en trop, le domaine `.vercel.app` alors que le site
répond sur un domaine propre — et Meta refuse le retour avec
*« URL bloquée »*.

## 8. Renseigner les variables dans Vercel

19. Vercel → le projet → **Settings → Environment Variables**.
20. Ajouter, pour **Production** :

    | Nom | Valeur |
    |---|---|
    | `META_APP_ID` | l'identifiant de l'étape 5 |
    | `META_APP_SECRET` | la clé secrète de l'étape 5 |

21. **Vérifier au passage `NEXT_PUBLIC_SITE_URL`.** Si elle est absente, le code
    retombe sur `http://localhost:3000` et construit une adresse de retour que
    Meta rejettera. Elle doit valoir exactement `https://TON-DOMAINE`.
22. **Redéployer.** Les variables ne sont lues qu'au déploiement suivant, et
    celles préfixées `NEXT_PUBLIC_` sont figées à la compilation.

## 9. Appliquer la migration

23. GitHub → **Actions → Base de données** → lancer le workflow.
    `0043_social_accounts.sql` crée la table qui reçoit les comptes branchés.

Sans elle, la boîte Comptes sociaux s'ouvre mais reste vide, et le retour de
Meta échoue à l'enregistrement.

## 10. Brancher, enfin

24. Ouvrir le Reporting du client → bouton **Connexions** dans la barre de
    page.
25. **Connecter Meta** → Facebook demande quelles Pages partager → choisir
    celle du client → accepter les autorisations.
26. Au retour, la boîte liste ce qui a été branché : la Page, le compte
    Instagram rattaché, les comptes publicitaires le cas échéant.

Le feed du planning affiche alors la vraie photo de profil, la bio et le nombre
d'abonnés au lieu de l'en-tête neutre.

---

## 11. La vérification Meta — ce qui bloque la publication

Une application neuve est en **accès standard** : ses permissions ne
fonctionnent que pour les personnes qui ont un **rôle dans l'application**.
Pour publier chez un client, il faut l'**accès avancé**, qui passe par une
vérification.

### Le raccourci, valable tout de suite

Pour un ou deux clients, on peut se passer de la vérification :

- **Application → Rôles → Testeurs** → ajouter le compte Facebook du client.
- Le client accepte l'invitation depuis
  [developers.facebook.com/settings/developer/requests](https://developers.facebook.com/settings/developer/requests).

Un testeur bénéficie de toutes les permissions sans vérification. C'est le
chemin le plus court pour brancher Bondet et prouver que la publication marche.
Ça demande au client un compte Facebook et deux clics — rien de plus.

### La vérification, nécessaire pour passer à l'échelle

27. **Vérification de l'entreprise** (*Paramètres du portefeuille → Centre de
    sécurité*) : nom légal, adresse, et un justificatif — extrait Kbis, avis de
    situation SIRENE ou facture d'un fournisseur au nom de l'entreprise.
    Compter **2 à 5 jours**.
28. **Contrôle de l'application** (*App Review*) : demander une à une les
    permissions ci-dessous. Chacune veut une **description de l'usage** et une
    **vidéo d'écran** montrant le parcours complet dans Antidotes.

    | Permission | Ce qu'elle nous donne | Vérification |
    |---|---|---|
    | `pages_show_list` | Lister les Pages du client | non |
    | `pages_read_engagement` | Lire la Page | oui |
    | `pages_manage_posts` | Publier sur la Page | oui |
    | `instagram_basic` | Lire le profil et les médias | oui |
    | `instagram_content_publish` | **Publier sur Instagram** | oui |
    | `ads_read` | Lire les campagnes (Reporting, plus tard) | oui |
    | `business_management` | Voir les actifs du portefeuille | oui |

    Compter **1 à 3 semaines**, avec souvent un aller-retour : Meta refuse
    volontiers une première fois en demandant une vidéo plus explicite.

Rien de tout cela n'empêche le reste : sans vérification, le branchement se
fait, le profil se lit, le feed s'affiche. Seule la publication chez un tiers
attend.

---

## Ce qu'il reste à écrire côté Antidotes

Pour que « publier automatiquement » soit vrai, il manque trois morceaux :

1. **Le poussoir.** Deux appels Graph par publication Instagram — créer le
   conteneur média (`/media`), puis le publier (`/media_publish`). Pour une
   Page Facebook, un seul appel suffit, avec sa programmation native à la
   minute près.
2. **L'horloge.** Instagram ne programme pas : il faut un passage régulier qui
   regarde ce qui est dû et l'envoie.
3. **Le retour d'état.** Écrire dans le planning que c'est parti, ou pourquoi
   ça a échoué, et ne jamais publier deux fois la même chose.

### Le coût de l'horloge, chiffré

Vercel Hobby plafonne à deux crons **une fois par jour** : inutilisable pour
publier à 10 h 30. Reste GitHub Actions, où l'on paie à la minute :

| Cadence | Minutes/mois | Verdict |
|---|---|---|
| Greffé sur le sync horaire existant | **≈ 0 de plus** | les posts sortent à l'heure ronde |
| Un job dédié toutes les 30 min | ≈ 1 440 | ferait dépasser les 2 000 gratuites avec le sync existant |
| Un job dédié toutes les 15 min | ≈ 2 880 | hors budget |

**Ma recommandation : se greffer sur `airwallex-sync.yml`, déjà horaire.** Une
publication programmée à 10 h 30 partirait à 11 h 00. Si la minute exacte
compte pour Instagram, il faudra passer au plan payant — dis-le-moi, c'est un
arbitrage produit, pas technique.

*(Depuis le 16/09/2026, le workflow n'est plus horaire — il consommait 4,7 fois
le quota mensuel — et depuis le 23/09 il ne passe plus que deux fois par jour :
la publication tient au passage du soir, que le matin rattrape. Voir l'en-tête
d'`airwallex-sync.yml`.)*

Pour Facebook, la question ne se pose pas : la programmation native de la Page
sort le post à la minute demandée, même si Antidotes l'a déposé la veille.
