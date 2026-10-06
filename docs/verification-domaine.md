# Prouver qu'un domaine est à nous

Les plateformes dont on consomme les API — TikTok aujourd'hui, Google et
Meta le jour où ils le demanderont — n'acceptent les URL de CGU et de
politique de confidentialité qu'après avoir vérifié que le domaine nous
appartient.

## Les adresses à déclarer

Depuis le 6/10/2026, l'agence a son domaine, **`antidotes.agency`**, acheté
chez Vercel et servi par le même projet que l'application
(`src/lib/domains.ts`) :

| Adresse | Ce qu'elle sert |
|---|---|
| `https://antidotes.agency` | la vitrine — une page noire en attendant la landing |
| `https://antidotes.agency/confidentialite` | la politique de confidentialité |
| `https://antidotes.agency/cgu` | les conditions d'utilisation |
| `https://app.antidotes.agency` | l'application |

Les pages légales vivent sur la **vitrine** : c'est l'adresse définitive,
celle qui ne bougera pas le jour où la landing arrive. Elles répondent aussi
sur `app.` et sur l'ancienne adresse Vercel, pour que les fiches pas encore
mises à jour continuent de passer.

## Les deux méthodes

| Méthode | Ce qu'elle demande | Utilisable ici |
|---|---|---|
| **Domain** | un enregistrement TXT dans le DNS du domaine | **oui** — le DNS de `antidotes.agency` est chez Vercel |
| **URL prefix** | un fichier de signature servi à la racine du préfixe | oui |

**Préférer « Domain ».** Elle couvre `antidotes.agency` et tous ses
sous-domaines d'un coup, et ne dépend d'aucun fichier du dépôt.

1. Dans la console de la plateforme, choisir **Domain** et donner
   `antidotes.agency`.
2. Copier la valeur TXT proposée.
3. Vercel → *Domains* → `antidotes.agency` → *DNS Records* → ajouter un
   enregistrement `TXT`, nom `@`, valeur collée telle quelle.
4. Attendre quelques minutes, puis cliquer « Verify ».

## Le fichier de signature, si la plateforme l'exige

1. Choisir **URL prefix**, donner `https://antidotes.agency/`, barre oblique
   finale comprise.
2. Déposer le fichier proposé dans **`public/`**, tel quel et sans le
   renommer : Next sert ce dossier à la racine de chaque domaine du projet,
   vitrine comprise.
3. Pousser, attendre le déploiement, puis cliquer « Verify ».

### Le piège

`src/proxy.ts` exclut les `.txt` de son matcher, au même titre que les
images. Ce n'est pas une optimisation : **sans cette exclusion, le fichier
redirigerait vers `/login`** (ou, sur la vitrine, vers l'application). La
vérification tomberait alors sans prévenir, puisque ces plateformes la
rejouent périodiquement au lieu de l'acquérir une fois pour toutes.

## Ce qui est en place

`public/tiktokVF8RKRNKQRzpHceGTGvHNkTl5tIfzjXo.txt` — TikTok, préfixe
`https://dashboard-antidotes-beta.vercel.app/`, posé avant le domaine propre.
Il reste valable tant que la fiche TikTok pointe sur l'adresse Vercel. Le
jour où ses trois URL passent sur `antidotes.agency`, la vérification est à
refaire par la méthode « Domain ».
