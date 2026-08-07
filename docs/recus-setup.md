# Module Reçus — mise en place

Le module lit une boîte Gmail, repère les factures, les rapproche des dépenses
carte Airwallex, puis transfère la pièce à Airwallex qui l'accroche à la ligne
de frais correspondante. Il vérifie ensuite que l'accrochage a bien eu lieu.

Trois choses à brancher : Google, Airwallex, et le cron.

---

## Ce qu'il faut savoir avant de commencer

**L'API Airwallex ne permet pas de déposer une pièce jointe.** L'API publique
Spend expose `List card expenses`, `Get card expense` et un marqueur de
synchronisation — rien pour uploader un justificatif. Le seul chemin d'écriture
est le transfert de mail vers `receipts@expenses.airwallex.com`, dont l'OCR fait
le rapprochement de leur côté.

Cela a deux conséquences sur ce que le module peut promettre :

- il **envoie** la pièce, il ne la **range** pas. C'est Airwallex qui décide à
  quelle transaction l'accrocher ;
- il **vérifie** ensuite, en relisant l'API, que la pièce est bien arrivée sur
  la ligne attendue. Quand ce n'est pas le cas, la pièce ressort dans l'écran en
  « non rapprochée », à rattacher à la main depuis l'interface Airwallex.

Le rapprochement calculé localement sert à décider si une pièce est assez sûre
pour partir sans relecture, et à savoir quoi vérifier ensuite. C'est un pari
affiché, pas une commande.

> **À vérifier en premier :** que la réception de reçus par mail est active sur
> votre compte Airwallex, et que votre adresse Gmail y est bien l'adresse
> rattachée. Airwallex rejette un reçu venu d'une autre adresse.

---

## 1. Google Cloud — accès Gmail

Environ quinze minutes, une seule fois.

### Créer le projet et activer l'API

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com), créer
   un projet (par exemple `antidotes-recus`).
2. *APIs & Services → Library* → chercher **Gmail API** → **Enable**.

### Configurer l'écran de consentement

3. *APIs & Services → OAuth consent screen* → type **External**.
4. Renseigner le nom de l'application, l'adresse de support et l'adresse du
   développeur.
5. **Scopes** : ajouter exactement ces trois-là, et pas un de plus.

   | Portée | Pourquoi |
   |---|---|
   | `.../auth/gmail.readonly` | Lire les messages entrants |
   | `.../auth/gmail.send` | Transférer la pièce à Airwallex |
   | `.../auth/userinfo.email` | Connaître l'adresse connectée |

   `gmail.modify` n'est **pas** demandée : le module ne doit jamais pouvoir
   déplacer, archiver ou supprimer un message.

6. **Test users** : ajouter votre adresse Gmail.

   Tant que l'application reste en mode *Testing*, Google fait expirer le
   refresh token au bout de sept jours. Pour un usage durable, passer
   l'application en *In production* — la validation Google n'est pas requise
   pour un usage interne à quelques utilisateurs, mais un écran
   « application non vérifiée » apparaîtra à la connexion. C'est attendu.

### Créer les identifiants

7. *APIs & Services → Credentials → Create Credentials → OAuth client ID*, type
   **Web application**.
8. **Authorized redirect URIs** — ajouter exactement, selon l'environnement :

   ```
   http://localhost:3000/api/recus/connexion/callback
   https://votre-domaine/api/recus/connexion/callback
   ```

9. Reporter l'identifiant et le secret dans `.env.local` :

   ```sh
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```

---

## 2. Airwallex — clés API

1. Dans Airwallex : *Account settings → Developer → API keys*.
2. Créer une clé. Les ressources Spend demandent des **droits au niveau
   organisation** : sans eux, la lecture des dépenses renverra 403.
3. Reporter dans `.env.local` :

   ```sh
   AIRWALLEX_CLIENT_ID=...
   AIRWALLEX_API_KEY=...
   AIRWALLEX_ENV=demo   # `production` une fois la chaîne validée
   ```

`AIRWALLEX_ENV` vaut `demo` par défaut et vise le bac à sable. Une chaîne
comptable se teste ailleurs qu'en production.

---

## 3. Lecture des factures

```sh
ANTHROPIC_API_KEY=sk-ant-...
```

Facultative. Sans elle le module fonctionne, mais classe les mails par règles
simples uniquement : la confiance est plafonnée à 0,6, donc **rien ne peut
partir automatiquement**, et les montants ne sont pas relus. Utilisable pour
essayer, insuffisant à l'usage.

Le tri heuristique s'exécute avant tout appel au modèle et écarte la grande
majorité des messages. Le coût suit le nombre de factures, pas le volume de la
boîte.

---

## 4. Migrations

```sh
pnpm db:migrate
```

Applique `0010_receipts_schema.sql` et `0011_receipts_rls.sql`. La première crée
aussi le bucket de stockage privé `receipts`.

---

## 5. Connexion de la boîte

1. Lancer l'application, aller sur **/entreprise/recus**.
2. **Connecter une boîte Gmail** → écran Google → accepter les deux
   autorisations.
3. Le retour affiche l'adresse connectée.

Si le message « Google n'a pas renvoyé de jeton de rafraîchissement » apparaît,
c'est que le compte avait déjà autorisé l'application. Révoquer l'accès dans
[myaccount.google.com/permissions](https://myaccount.google.com/permissions),
puis recommencer.

---

## 6. Le passage planifié

**Il part de GitHub Actions, pas de Vercel.** Airwallex refuse les adresses IP
de Vercel : lancée de là-bas, la synchronisation des dépenses et la
vérification d'accrochage recevraient un « 403 Forbidden » à chaque passage.
L'étape « Synchroniser les Reçus » de
`.github/workflows/airwallex-sync.yml` exécute donc `pnpm sync:recus` toutes
les heures, dans la foulée de la synchronisation Finance — mêmes clés, même
runner, une seule installation de dépendances.

Elle enchaîne trois étapes : synchronisation des dépenses Airwallex, lecture de
la boîte, vérification des accrochages en attente. Une étape en échec n'annule
pas les autres. Toutes les heures suffit largement — une facture n'est jamais
urgente, et interroger Gmail plus souvent consomme du quota pour rien.

Secrets côté GitHub (Settings → Secrets and variables → Actions), en plus de
ceux de Finance : `CREDENTIALS_ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, et `ANTHROPIC_API_KEY` pour le transfert
automatique.

Pour déclencher à la main : onglet **Actions** → « Synchronisation Airwallex »
→ **Run workflow**. En local :

```sh
pnpm sync:recus
```

La route `/api/cron/recus` reste en place comme point d'entrée de secours
(`Authorization: Bearer $CRON_SECRET`), en sachant que ses étapes Airwallex
échouent tant qu'elle s'exécute chez Vercel.

---

## 7. Rodage recommandé

L'auto-transfert est **désactivé par défaut**, et c'est délibéré. La première
exécution d'un outil qui envoie des mails en votre nom se regarde avant qu'on la
laisse courir.

1. **Tester à vide.** Mettre `forward_to` sur votre propre adresse dans
   `receipt_sources` : les pièces vous arrivent, vous voyez exactement ce
   qu'Airwallex recevrait. Remettre `receipts@expenses.airwallex.com` ensuite.
2. **Valider à la main pendant quelques semaines.** Chaque validation crédite le
   fournisseur ; au bout de trois validations sans refus, l'écran propose
   l'automatisme pour ce domaine.
3. **Automatiser fournisseur par fournisseur.** Jamais globalement : un domaine
   approuvé est un domaine dont vous avez vu les factures.

Les garde-fous suivants ne sont pas configurables :

- une pièce dont le rapprochement est **ambigu** (deux dépenses également
  plausibles) ne part jamais seule ;
- un **fournisseur jamais approuvé** ne part jamais seul, quelle que soit la
  confiance affichée ;
- une pièce classée par les **seules heuristiques** ne peut pas atteindre le
  seuil d'auto-transfert.

Réglables, dans `receipt_sources.settings.auto_forward` : seuil de confiance
(0,9), plafond de montant (500 €), plafond horaire (10), exigence d'un
rapprochement. Le bouton **Tout couper** de l'écran active `emergency_stop`, qui
suspend les automatismes sans défaire le reste du réglage.

---

## Ce qui reste manuel

- **Les pièces « non rapprochées ».** Airwallex les a reçues mais n'a pas su les
  accrocher. Elles sont dans leur boîte de reçus, à rattacher depuis leur
  interface. Le module vous dit lesquelles et sur quelle ligne il pariait.
- **Les dépenses sans justificatif qui n'arrivent jamais par mail** — un ticket
  de taxi payé en carte, par exemple. Le rail de gauche les liste : c'est la
  moitié du problème que l'automatisation ne résoudra pas.
- **Le rendu PDF des factures présentes dans le corps du mail** demande
  Playwright et un navigateur installé. Sans lui, le mail est transféré en
  texte : l'OCR d'Airwallex sait le lire, la pièce n'est pas perdue.

---

## Diagnostic

| Symptôme | Cause probable |
|---|---|
| Aucune pièce détectée | Le cron ne tourne pas, ou la fenêtre `lookback_days` est antérieure aux mails présents |
| « Boîte non connectée » | Refresh token absent ou révoqué — reconnecter |
| Dépenses jamais rapprochées | Clés Airwallex sans droits organisation, ou `AIRWALLEX_ENV` sur `demo` alors que les vraies dépenses sont en production |
| Tout reste « en attente d'accrochage » | La réception de reçus par mail n'est pas active côté Airwallex, ou l'adresse d'envoi n'est pas celle rattachée au compte |
| Rien ne part automatiquement | Normal : l'auto-transfert est désactivé par défaut. L'écran de la pièce liste toutes les raisons du refus |

Le journal `receipt_events` conserve chaque décision, humaine ou automatique,
avec son motif. C'est là qu'on répond à « pourquoi cette pièce est-elle
partie ? ».
