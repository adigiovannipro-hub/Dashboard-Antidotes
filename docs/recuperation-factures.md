# Récupération automatique des factures

Un abonnement — Adobe, Google, OVH — laisse chaque mois sa facture derrière une
session ouverte sur le site du fournisseur, là où ni le mail ni Airwallex ne
vont la chercher. Ce module la fait arriver dans Airwallex sans y penser.

## Qui fait quoi

| Côté | Rôle |
|---|---|
| Dashboard (`/entreprise/finance`, colonne **Récupération**) | Source de vérité : un lien par fournisseur, l'état du mois. Ne télécharge rien. |
| Passage extérieur (ton Mac, ou un petit serveur) | Lit la liste, ouvre chaque lien dans un navigateur dont la session est déjà ouverte, télécharge la facture, l'envoie à `receipts@expenses.airwallex.com`, rend compte. |

Le dashboard ne peut pas tenir ce rôle : une fonction Vercel n'a pas de profil
de navigateur qui survive d'une exécution à l'autre, et c'est la session qui
ouvre la porte du fournisseur.

## Modèle

Table `finance_retrieval_sources` — **une ligne par marchand** (même clé que
les logos, calculée depuis le nom affiché). Le lien se colle une fois, sur
n'importe quelle dépense du marchand, et sert tous les mois.

| Colonne | Rôle |
|---|---|
| `source_link` | La page où les factures se trouvent, derrière la session |
| `retrieval_status` | `none` · `pending` · `done` · `failed` |
| `auto_retrieved_at` | Dernière récupération réussie. « Du mois » se juge à l'affichage, en UTC |
| `last_error` | La cause du dernier échec, affichée dans la cellule |

## La cellule

| Fiche | Bouton |
|---|---|
| Pas de lien | **Récupérer** — ouvre un champ pour coller le lien |
| Lien posé, rien reçu ce mois-ci | **En attente** — cliquer modifie le lien ; un champ vidé retire la fiche |
| Récupérée ce mois-ci | **Récupéré ✓**, vert, inerte, la date en infobulle |
| Le mois a tourné | Redevient **En attente** tout seul, sans tâche dédiée |
| Le passage a échoué | **Échec**, la cause en infobulle ; le passage suivant réessaie |

Virements et frais bancaires n'ont pas de cellule : ils n'attendent aucune facture.

## Les deux routes

Toutes deux s'authentifient par `Authorization: Bearer <CRON_SECRET>` — la même
valeur que sur Vercel — et sont hors du proxy d'authentification, comme les
crons. Un secret faux rend `401`.

**Lister ce qu'il reste à faire ce mois-ci**

```bash
curl -s "$ANTIDOTES_URL/api/finance/invoices/pending-retrieval" \
  -H "Authorization: Bearer $CRON_SECRET"
```

```json
{
  "ok": true,
  "month": "2026-09",
  "sources": [
    {
      "id": "…",
      "merchant": "Adobe",
      "merchant_key": "adobe",
      "source_link": "https://account.adobe.com/orders/billing-history",
      "retrieval_status": "pending",
      "auto_retrieved_at": null,
      "last_error": null
    }
  ]
}
```

Une fiche récupérée ce mois-ci n'y figure pas ; une fiche en échec y reste.

**Rendre compte**

```bash
curl -s -X PATCH "$ANTIDOTES_URL/api/finance/invoices/<id>/retrieval-status" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"retrieval_status":"done"}'
```

Corps accepté : `retrieval_status` (`done` · `failed` · `pending`), `error`
(texte, pour `failed`), `retrieved_at` (ISO 8601, sinon maintenant). `done`
pose la date et efface l'erreur. Réponse : la fiche mise à jour.

## Le passage extérieur

C'est une session Claude Code sur le Mac, avec le skill `/recuperer-factures`
du dépôt, un navigateur au profil persistant, et le connecteur Gmail. Chaque
site de fournisseur a sa propre page et son propre bouton de téléchargement :
un script figé casserait au premier changement de maquette, une session qui
lit la page s'adapte.

**Installation, une fois.**

1. Le navigateur persistant, via le MCP Playwright, sur un profil dédié aux
   factures — un seul profil pour tous les fournisseurs :

   ```bash
   claude mcp add --scope user playwright -- npx @playwright/mcp@latest \
     --user-data-dir "$HOME/.claude/browser-profiles/factures" \
     --output-dir "$HOME/.claude/browser-profiles/factures-telechargements"
   ```

2. Les sessions : dans une session `claude` interactive, demander d'ouvrir la
   page de facturation de chaque fournisseur, et se connecter dans la fenêtre.
   Le profil retient la session ; à refaire quand un fournisseur la ferme.

3. Les variables, lues de `.env.local` : `NEXT_PUBLIC_SITE_URL` (l'adresse de
   production) et `CRON_SECRET` (**la valeur de Vercel**, pas une valeur locale).

**À chaque passage.**

```bash
cd "<dossier du dépôt>" && claude -p "/recuperer-factures"
```

À planifier une fois par mois, ou par semaine — le passage ne refait jamais un
mois déjà fait. Exemple `launchd`, le 3 de chaque mois à 9 h, dans
`~/Library/LaunchAgents/com.antidotes.recuperer-factures.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.antidotes.recuperer-factures</string>
  <key>ProgramArguments</key><array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>cd "<dossier du dépôt>" && claude -p "/recuperer-factures" >> ~/Library/Logs/recuperer-factures.log 2>&1</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Day</key><integer>3</integer><key>Hour</key><integer>9</integer></dict>
</dict></plist>
```

Puis `launchctl load ~/Library/LaunchAgents/com.antidotes.recuperer-factures.plist`.
Le Mac doit être allumé à l'heure dite ; launchd rattrape un passage manqué au
réveil suivant.
