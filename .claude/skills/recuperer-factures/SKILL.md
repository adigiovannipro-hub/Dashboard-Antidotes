---
name: recuperer-factures
description: Récupère les factures des fournisseurs listées par le dashboard Antidotes (Finance → colonne Récupération), les télécharge dans le navigateur au profil persistant, les envoie à receipts@expenses.airwallex.com par Gmail, et rend compte au dashboard. À lancer depuis le Mac, jamais depuis Vercel. Déclencheurs : « récupère les factures », « factures fournisseurs », « /recuperer-factures ».
---

# Récupérer les factures du mois

Tu es le passage extérieur du module de récupération de factures — voir
`docs/recuperation-factures.md`. Le dashboard dit **quoi** récupérer et **où** ;
toi, tu ouvres la page, tu télécharges, tu envoies, tu rends compte. Rien
d'autre.

## Avant de commencer

Lis `.env.local` à la racine du dépôt pour `NEXT_PUBLIC_SITE_URL` et
`CRON_SECRET`. Si l'un manque, arrête-toi et dis-le.

Vérifie que le MCP Playwright est branché (outils `browser_*`). Sinon,
arrête-toi et renvoie à la section « Installation » de la doc.

## Le passage

1. **Lister** :
   `GET $NEXT_PUBLIC_SITE_URL/api/finance/invoices/pending-retrieval`,
   en-tête `Authorization: Bearer $CRON_SECRET`. Une liste vide = rien à
   faire ce mois-ci, dis-le et termine.

2. **Pour chaque fiche**, dans l'ordre :
   - Navigue vers `source_link` avec le navigateur.
   - Si la page est une page de connexion, **n'essaie pas de te connecter** :
     marque la fiche `failed` avec l'erreur « Session <marchand> expirée — se
     reconnecter dans le profil » et passe à la suivante.
   - Repère la facture **la plus récente** (mois courant, ou la dernière
     émise). Télécharge le PDF. Vérifie que le fichier existe, pèse plus de
     1 Ko, et commence par `%PDF`.
   - Envoie-le par Gmail : destinataire `receipts@expenses.airwallex.com`,
     objet `Facture <Marchand> - <JJ/MM/AAAA du jour>`, le PDF en pièce
     jointe, corps vide ou une ligne. Un seul mail par facture.
   - **Après** l'envoi confirmé :
     `PATCH $NEXT_PUBLIC_SITE_URL/api/finance/invoices/<id>/retrieval-status`
     avec `{"retrieval_status":"done"}`.
   - À la moindre étape ratée : `PATCH` avec
     `{"retrieval_status":"failed","error":"<cause en une phrase>"}` et
     passe à la fiche suivante. N'improvise aucun contournement.

3. **Rends compte**, fiche par fiche : marchand, nom et taille du fichier,
   envoi confirmé ou cause de l'échec. Jamais « fait » sans preuve.

## Règles

- Ne touche à rien d'autre sur le site du fournisseur : pas de modification
  de compte, pas de paiement, pas de résiliation.
- Une facture déjà envoyée ce mois-ci ne figure pas dans la liste ; ne
  cherche pas à la renvoyer.
- Un secret refusé (`401`) arrête tout le passage : c'est `CRON_SECRET` qui
  ne correspond pas à Vercel.
