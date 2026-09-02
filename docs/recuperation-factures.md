# Récupérer les factures des abonnements, sans y penser

Adobe, Google, OVH… chaque mois, la facture d'un abonnement attend derrière
ton compte, sur le site du fournisseur. Ce module va la chercher **le
lendemain du prélèvement** et l'envoie à Airwallex à ta place. Tu colles un
lien une fois par fournisseur, dans le dashboard ; le reste tourne en fond sur
ton Mac.

## Comment ça marche, en deux phrases

Le **dashboard** retient, pour chaque fournisseur, la page où se trouvent ses
factures et si celle du mois est arrivée. Un **passage** sur ton Mac lui
demande chaque matin s'il y a quelque chose à faire ; s'il y a eu un
prélèvement la veille, il ouvre la page du fournisseur dans un navigateur déjà
connecté, télécharge la facture et la dépose au dashboard, qui l'envoie à
Airwallex depuis ta boîte Gmail.

Le dashboard ne peut pas faire ça seul : il tourne sur Vercel, où rien ne
garde une session ouverte d'une fois sur l'autre. Ton Mac, si.

## Installation, une seule fois

Tout se passe dans le Terminal, dans le dossier du projet. Compte dix minutes.

### 1. Dire au passage où est le dashboard

Ouvre le fichier `.env.local` à la racine du projet et ajoute une ligne avec
l'adresse de ton dashboard en ligne, celle que tu ouvres dans le navigateur :

```
FACTURES_DASHBOARD_URL=https://ton-dashboard.vercel.app
```

Vérifie aussi que la ligne `CRON_SECRET=` contient **la même valeur que sur
Vercel** (Vercel → ton projet → Settings → Environment Variables →
`CRON_SECRET`). C'est ce mot de passe qui autorise le passage à parler au
dashboard. S'il diffère, le passage s'arrête en le disant.

### 2. Connecter le navigateur du passage à chaque fournisseur

Le passage a son propre navigateur, séparé du tien, qui garde ses sessions.
Pour chaque fournisseur, lance :

```bash
pnpm factures:connexion "https://account.adobe.com/orders/billing-history"
```

Une fenêtre s'ouvre sur la page du fournisseur. Connecte-toi, comme
d'habitude, jusqu'à voir la liste des factures. Puis **ferme la fenêtre** :
la session est gardée. À refaire seulement quand un fournisseur te
déconnecte — le dashboard te le dira (bouton rouge, voir plus bas).

### 3. Planifier le passage

```bash
pnpm factures:installer
```

Dès lors, chaque matin à 9 h, le Mac lance le passage en fond, sans fenêtre,
sans Terminal. Si le Mac dormait à 9 h, le passage part au réveil. Il n'a
besoin d'aucune session ouverte — juste que le Mac soit allumé dans la
journée.

Pour vérifier que c'est en place : `launchctl list | grep antidotes`.
Pour retirer : `pnpm factures:desinstaller`.

### 4. Vérifier que tout parle bien ensemble

```bash
pnpm factures:passage
```

Le passage affiche le calendrier de chaque fournisseur suivi et ce qu'il a
fait. Le premier jour, il dira sans doute « Aucun prélèvement ce mois-ci pour
l'instant » ou « Rien à récupérer aujourd'hui » : c'est normal, il attend le
prochain prélèvement.

## Au quotidien : le dashboard

Dans **Mon entreprise → Finance → Dépenses**, la colonne **Récupération**, à
droite de Justificatif, porte un petit bouton carré sur chaque dépense carte.

| Bouton | Ce que ça veut dire | Quoi faire |
|---|---|---|
| 🔗 gris | Aucun lien pour ce fournisseur | Cliquer, coller le lien de la page des factures, Enregistrer. Une seule fois : il vaut pour toutes les dépenses de ce fournisseur, tous les mois |
| 🕒 gris | Lien enregistré, facture du mois pas encore récupérée | Rien. Le passage viendra le lendemain du prélèvement |
| ✓ vert | Facture du mois récupérée et envoyée à Airwallex | Rien. La date est en infobulle. Le mois suivant, le bouton repasse 🕒 tout seul |
| ⚠ rouge | Le dernier passage a échoué | Survoler pour lire la cause. Le plus souvent : session expirée → relancer `pnpm factures:connexion "<lien>"` et se reconnecter. Le passage réessaie trois jours plus tard, ou tout de suite avec `pnpm factures:passage` |

Les virements et les frais bancaires n'ont pas de bouton : ils n'ont pas de
facture à aller chercher.

**Quel lien coller ?** Celui de la page où tu télécharges d'habitude la
facture, une fois connecté. Adobe : `https://account.adobe.com/orders/billing-history`.
Si le lien pointe directement sur un PDF, ça marche aussi.

## Quand le passage a lieu

Le passage regarde les prélèvements que la synchronisation Airwallex a vus.
Pour un fournisseur suivi, il n'agit que si un prélèvement carte de ce
fournisseur date **de la veille ou avant, dans le mois en cours**, et que la
facture du mois n'a pas encore été récupérée. Adobe prélève le 26 : le passage
vient le 27. Si la facture n'est pas encore en ligne le 27, il revient le 28,
puis chaque jour jusqu'à l'avoir. Après un échec, il attend trois jours.

Ce que le passage fait sur la page du fournisseur : il cherche le premier
bouton ou lien qui parle de facture, d'invoice ou de téléchargement, le
clique, et garde ce qui en sort si c'est un PDF. Quand ça échoue, il laisse
une capture d'écran de la page et la liste de ce qu'il a repéré dans
`~/.antidotes/factures/journal/` — c'est ce qu'il faut montrer pour ajuster.

## Où sont les choses

| Quoi | Où |
|---|---|
| Sessions du navigateur du passage | `~/.antidotes/factures/navigateur/` |
| Journal des passages et captures d'échec | `~/.antidotes/factures/journal/passage.log` |
| Planification | `~/Library/LaunchAgents/com.antidotes.recuperer-factures.plist` |
| Fiches fournisseurs | table `finance_retrieval_sources`, une ligne par fournisseur |

## Pour un développeur : les trois routes

Toutes en `Authorization: Bearer <CRON_SECRET>`, hors du proxy
d'authentification comme les crons. Un secret faux rend `401`.

- `GET /api/finance/invoices/pending-retrieval` — `sources` : les fiches à
  traiter aujourd'hui ; `schedule` : toutes les fiches suivies avec leur
  raison (`due`, `no-charge-this-month`, `charge-too-recent`,
  `done-this-month`, `failed-recently`) et `due_on`.
- `POST /api/finance/invoices/<id>/document` — multipart, champ `file`, PDF
  de 10 Mo au plus. Le dashboard l'envoie à Airwallex depuis la boîte Gmail
  connectée aux Reçus, objet `Facture <Fournisseur> - <JJ/MM/AAAA>`, puis
  marque la fiche récupérée. Réponse : `sent_to`, `subject`, `message_id`.
- `PATCH /api/finance/invoices/<id>/retrieval-status` — `{"retrieval_status":
  "failed","error":"…"}` (ou `done`, `pending`).

La décision « à faire aujourd'hui » vit dans `src/lib/finance/retrieval.ts`,
pur et testé — le même code que la cellule de l'écran.
