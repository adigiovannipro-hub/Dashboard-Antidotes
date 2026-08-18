# Connecteurs LinkedIn et TikTok — ce qu'il faut avant d'écrire une ligne

Ce document n'est pas un plan technique, c'est la **liste des démarches**. Sur
ces deux plateformes, le code n'est pas le chemin critique : les validations le
sont, et elles se comptent en semaines. Elles peuvent — et devraient —
commencer avant que le connecteur soit écrit.

État au 17 août 2026 : **rien n'est branché**. `social_account_kind` connaît
`linkedin` et `tiktok` (migrations 0043 et 0049), l'écran des connexions les
affiche et dit qu'ils n'ont pas de connecteur. C'est tout, et c'est
volontaire : un bouton « Brancher LinkedIn » qui ne branche rien coûte plus
cher qu'une ligne qui dit la vérité.

---

## Pourquoi Meta a été simple et pourquoi ceux-là ne le seront pas

Meta a demandé **une** application et **un** aller-retour OAuth qui rapporte
d'un coup les Pages, les comptes Instagram rattachés et les comptes
publicitaires. Un seul branchement sert le Planning et le Reporting.

Ni LinkedIn ni TikTok ne fonctionnent comme ça :

| | Meta | LinkedIn | TikTok |
|---|---|---|---|
| Entité juridique exigée | non | **oui** | non |
| Revue séparée du simple accès | App Review | **formulaire d'accès dédié** | **audit dédié** |
| Publication avant validation | testeurs de l'app | non | oui, mais **visible de soi seul** |
| Statistiques organiques | oui | limitées | Display API, périmètre étroit |
| Qui autorise | l'agence, une fois | **chaque Page cliente** | **chaque compte créateur** |

La dernière ligne est la plus lourde en exploitation : là où un login Meta
couvre tous les clients de l'agence, LinkedIn et TikTok demandent une
autorisation **par client**. Le modèle à deux étages posé en 0044 —
`social_accounts` pour l'inventaire, `workspace_social_accounts` pour
l'affectation — tient toujours, mais l'inventaire se remplira client par
client au lieu d'arriver d'un bloc.

---

## LinkedIn — Community Management API

### Ce qu'il faut fournir

L'accès est **réservé aux entités légalement enregistrées**. Un développeur
seul ou un projet personnel est refusé. À préparer :

- la **dénomination sociale** exacte et l'adresse du siège ;
- une **adresse e-mail professionnelle** au domaine de l'entreprise (une
  adresse Gmail est un motif de refus courant) ;
- l'**URL du site** de l'entreprise ;
- une **politique de confidentialité en ligne**, à une URL publique et
  stable. C'est le point qui bloque le plus souvent, et Antidotes n'en a pas
  aujourd'hui. Elle doit dire quelles données LinkedIn sont lues, pourquoi,
  combien de temps elles sont conservées ;
- une **Page LinkedIn d'entreprise** dont tu es administrateur, pour
  rattacher l'application.

### Les étapes

1. Créer l'application sur le portail développeur LinkedIn, rattachée à la
   Page d'entreprise.
2. Dans **My Apps → l'app → Products**, ajouter **Community Management API**
   et remplir le formulaire d'accès. C'est une revue distincte de la création
   de l'app : on y décrit le cas d'usage, à qui sert l'outil, et ce qu'on fait
   des données des organisations.
3. Attendre. Compter plusieurs semaines, et prévoir un refus au premier essai
   si le cas d'usage est décrit en termes vagues.

### Ce que ça donnera

Portées utiles : `w_organization_social` (publier au nom d'une Page),
`r_organization_social` (relire ces publications). Les appels portent un
en-tête `Linkedin-Version` au format `AAAAMM` — la version se périme, elle
est à tenir à jour comme la version de Graph pour Meta.

Contenus possibles : texte, image, vidéo, carrousel, sondage. Ça couvre ce
que le Planning sait déjà décrire.

**Côté statistiques, attends-toi à moins que Meta.** Le Reporting LinkedIn
sera plus pauvre que l'onglet Instagram : c'est à savoir avant de le vendre
comme équivalent.

### Ce que chaque client devra faire

Te donner un rôle d'**administrateur** sur sa Page LinkedIn, ou passer par
l'autorisation OAuth depuis son propre compte. À anticiper au moment du
contrat, pas trois semaines après.

---

## TikTok — Content Posting API

### Les étapes

1. Créer l'application sur le portail TikTok for Developers.
2. Ajouter le produit **Content Posting API** — et **Display API** si on veut
   relire les publications pour le Reporting.
3. Demander les portées correspondant au mode retenu : publication directe et
   dépôt en brouillon relèvent de portées différentes.
4. Passer l'**audit**. C'est une revue distincte de l'inscription, et tant
   qu'elle n'est pas passée, **toute publication est `SELF_ONLY`** : elle part
   bien, mais seul le titulaire du compte la voit. Autant dire qu'elle ne sert
   à rien en production.

### Ce que l'audit vérifie

Essentiellement l'interface, et c'est là que ça coince : TikTok impose des
écrans de consentement précis, l'affichage explicite du fait qu'on publie sur
TikTok, et le traitement correct du choix entre brouillon et publication
directe. Ce sont des **contraintes d'écran**, pas de serveur — elles retombent
sur le Planning, et il faudra les intégrer au moment d'écrire le connecteur,
pas après.

L'API est **gratuite** : ni palier payant, ni facturation à l'appel.

### Ce que chaque client devra faire

Autoriser l'application depuis **son** compte TikTok, via le flux de login.
Un compte par client, comme pour LinkedIn.

---

## Ce que je te propose comme ordre

1. **Toi, cette semaine** : la politique de confidentialité, puis les deux
   demandes d'accès. Ce sont les seuls délais qu'on ne peut pas comprimer, et
   ils tournent pendant qu'on fait autre chose.
2. **Nous, quand une des deux revient validée** : le connecteur de celle-là,
   entièrement — OAuth, inventaire, publication, synchronisation, Reporting —
   plutôt que deux moitiés.
3. **TikTok avant LinkedIn** si les deux reviennent ensemble : l'audit porte
   sur des écrans qu'il vaut mieux dessiner une fois, et le volume de
   publications y est plus élevé.

À faire **avant** d'écrire le premier connecteur, et qui ne dépend d'aucune
validation : décider si le Reporting LinkedIn/TikTok mérite ses propres
mesures ou se contente de la portée et de l'engagement. `KPI_SETS` et
`HERO_METRIC` (`src/lib/reporting/kpi-sets.ts`) sont le contrat à remplir, et
ils se lisent sans ouvrir une vue.
