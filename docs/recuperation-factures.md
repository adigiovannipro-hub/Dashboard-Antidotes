# Récupérer les factures des abonnements, sans y penser

Adobe, Google, OVH… chaque mois, la facture d'un abonnement attend derrière ton
compte, sur le site du fournisseur : ni le mail ni Airwallex ne vont la
chercher. Ce module va la prendre **le lendemain du prélèvement** et l'envoie à
Airwallex à ta place.

Tu colles un lien, une fois par fournisseur, dans la colonne **Récupération**
de Finance. Tu ouvres une session, une fois par fournisseur. Ensuite, plus
rien : tout tourne dans le cloud.

## Où ça tourne

| Étape | Où | Quand |
|---|---|---|
| Le lien du fournisseur | Dashboard, colonne Récupération | Une fois, à la main |
| La connexion au fournisseur | Un vrai navigateur, sur un écran | Une fois, puis quand la session expire |
| Le passage : chercher, envoyer, marquer | **GitHub Actions**, workflow « Récupération des factures » | Chaque jour à 9 h 23 (Paris) |

Rien ne tourne sur ton Mac en régime établi, et rien ne peut tourner sur
Vercel : une fonction serverless n'a pas de navigateur, et rien n'y survit
d'une exécution à l'autre — or une page de factures est réservée aux clients
connectés. Le runner GitHub n'a pas de mémoire non plus, mais il **rejoue** une
session : les cookies capturés une fois sont chiffrés et rangés sur la fiche du
fournisseur, puis restaurés à chaque passage, et réécrits rafraîchis après
chaque succès.

**Le passage ne se connecte jamais lui-même.** Un mot de passe, une double
authentification, un captcha ne s'automatisent pas, et les contourner ferait
bloquer le compte. C'est la seule étape qui demande un humain, et elle se fait
une fois par fournisseur.

## Au quotidien : le dashboard

**Mon entreprise → Finance → Dépenses.** Dernière colonne, un bouton carré sur
chaque dépense carte.

| Bouton | Ce que ça veut dire | Quoi faire |
|---|---|---|
| 🔗 gris | Aucun lien pour ce fournisseur | Cliquer, coller le lien de sa page de factures, Enregistrer. Une seule fois : il vaut pour toutes ses dépenses, tous les mois |
| 🕒 gris | Lien enregistré, facture du mois pas encore prise | Rien. Le passage viendra le lendemain du prélèvement |
| ✓ vert | Facture du mois récupérée et envoyée à Airwallex | Rien. La date est en infobulle. Le mois suivant, le bouton repasse 🕒 tout seul |
| ⚠ rouge | Le dernier passage a échoué | Survoler pour lire la cause. Le plus souvent : session expirée → rouvrir une session (voir plus bas) |

Les virements et les frais bancaires n'ont pas de bouton : ils n'ont aucune
facture à aller chercher.

**Quel lien coller ?** Celui de la page où tu télécharges d'habitude la
facture, une fois connecté. Pour Adobe :
`https://account.adobe.com/orders/billing-history`. Un lien qui pointe droit
sur un PDF marche aussi.

## Ouvrir une session chez un fournisseur

À faire une fois par fournisseur, et à refaire seulement quand le bouton passe
au rouge en disant que la session a expiré. Dans le Terminal, à la racine du
projet :

```bash
pnpm factures:connexion adobe
```

Une fenêtre de navigateur s'ouvre sur la page des factures. Tu te connectes
comme d'habitude, jusqu'à voir la liste. Puis **tu fermes la fenêtre** : la
session part chiffrée en base, et c'est elle que le cloud rejouera.

Sans argument, la commande liste les fiches et l'âge de leur session :

```bash
pnpm factures:connexion
```

## Quand le passage a lieu

Le passage lit les prélèvements que la synchronisation Airwallex a déjà vus.
Pour un fournisseur suivi, il n'agit que si un prélèvement carte de ce
fournisseur date **de la veille ou avant, dans le mois en cours**, et que la
facture du mois n'a pas encore été prise. Adobe prélève le 26, le passage vient
le 27. Si la facture n'est pas encore en ligne, il revient le lendemain, et
ainsi de suite. Après un échec, il attend trois jours.

Le navigateur ne s'ouvre que s'il y a quelque chose à faire : une journée vide
coûte une requête à Supabase et quelques secondes de runner.

Pour le lancer à la main sans attendre 9 h 23 : onglet **Actions** du dépôt →
« Récupération des factures » → **Run workflow**. Le journal d'exécution dit,
fournisseur par fournisseur, ce qui a été fait et pourquoi.

## Ce que le passage fait sur la page

Il cherche le premier lien ou bouton qui parle de facture, d'*invoice*, de
téléchargement ou de `.pdf`, le clique, et garde ce qui en sort si c'est bien un
PDF — téléchargement, réponse PDF, ou nouvel onglet. Il essaie les six
meilleurs candidats. C'est une heuristique : elle attrape les portails
classiques, et quand elle échoue, elle écrit dans la fiche ce qu'elle a vu, ce
qui suffit à l'ajuster.

## Coût et limites

Une exécution par jour, deux à trois minutes navigateur compris, soit environ
80 minutes par mois sur les 2 000 gratuites du dépôt privé. Aucun appel payant.

**La limite à connaître** : la session est ouverte depuis chez toi et rejouée
depuis un centre de données GitHub. Certains fournisseurs lient une session à
son adresse IP et la refusent depuis ailleurs — c'est exactement ce que fait
Airwallex avec Vercel. Si Adobe se comporte ainsi, le bouton passera au rouge
avec « session refusée », et il faudra alors soit un fournisseur plus tolérant,
soit une machine à toi qui tourne en permanence. On le saura au premier passage
réel, pas avant.

## Secrets à poser

Dans **Settings → Secrets and variables → Actions** du dépôt. Tous sont déjà
en place :

| Secret | Rôle |
|---|---|
| `FACTURES_SESSION_KEY` | Chiffre les sessions de navigateur. Volontairement distincte de `CREDENTIALS_ENCRYPTION_KEY` : elle voyage entre le Mac qui ouvre la session et le runner qui la rejoue, deux endroits qui n'ont pas la clé de production. La même valeur doit figurer dans `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Lecture et écriture des fiches |
| `CREDENTIALS_ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | L'envoi passe par la boîte Gmail déjà connectée aux Reçus |

## Le modèle

Table `finance_retrieval_sources` — **une ligne par marchand**, clé
`merchant_key` calculée depuis le nom affiché, la même que les logos.

| Colonne | Rôle |
|---|---|
| `source_link` | La page où les factures se trouvent |
| `retrieval_status` | `none` · `pending` · `done` · `failed` |
| `auto_retrieved_at` | Dernière récupération réussie. « Du mois » se juge à l'affichage, en UTC |
| `last_error` | La cause du dernier échec, affichée dans la cellule |
| `session_encrypted`, `session_saved_at` | La session de navigateur, chiffrée. Jamais lue par l'écran |

La décision « à faire aujourd'hui » vit dans `src/lib/finance/retrieval.ts`,
pure et testée — le même code que la cellule de l'écran, pour qu'ils ne
puissent pas se contredire.
