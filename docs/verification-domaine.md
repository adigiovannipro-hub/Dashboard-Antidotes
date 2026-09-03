# Prouver qu'un domaine est à nous

Les plateformes dont on consomme les API — TikTok aujourd'hui, Google et
Meta le jour où ils le demanderont — n'acceptent les URL de CGU et de
politique de confidentialité qu'après avoir vérifié que le domaine nous
appartient. Deux méthodes existent, et une seule nous est ouverte.

| Méthode | Ce qu'elle demande | Utilisable ici |
|---|---|---|
| **Domain** | un enregistrement TXT dans le DNS du domaine | **non** — `*.vercel.app` ne nous appartient pas, on n'y pose rien |
| **URL prefix** | un fichier de signature servi à la racine du préfixe | **oui** |

## Le geste

1. Dans la console de la plateforme, choisir **URL prefix** et donner
   l'adresse de production, barre oblique finale comprise :
   `https://dashboard-antidotes-beta.vercel.app/`. La vérification couvre
   alors tout ce qui commence par ce préfixe — les deux pages légales et le
   site lui-même d'un seul coup.
2. Télécharger le fichier de signature proposé.
3. Le déposer dans **`public/`**, tel quel et sans le renommer : Next sert
   ce dossier à la racine du site. Le nom compte — la plateforme demande
   exactement le sien.
4. Pousser, attendre le déploiement Vercel, puis cliquer « Verify ».

## Le piège

`src/proxy.ts` exclut les `.txt` de son matcher, au même titre que les
images. Ce n'est pas une optimisation : **sans cette exclusion, le fichier
redirigerait vers `/login`** le jour où l'accès public se referme. La
vérification tomberait alors sans prévenir, puisque ces plateformes la
rejouent périodiquement au lieu de l'acquérir une fois pour toutes.

## Ce qui est en place

`public/tiktokVF8RKRNKQRzpHceGTGvHNkTl5tIfzjXo.txt` — TikTok, préfixe
`https://dashboard-antidotes-beta.vercel.app/`. Le jeton est public par
construction : il n'a de valeur que servi en clair à cette adresse.

Le jour où un domaine propre remplace l'adresse Vercel, la vérification est
à refaire : nouveau préfixe, nouveau fichier, et les trois URL de la fiche
d'application à remettre à jour.
