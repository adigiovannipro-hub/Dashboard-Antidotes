# Séquences — l'outbound du pôle Antidotes, étape 5

Une séquence est une suite d'emails à délais réglables (par défaut trois,
J+0 / J+4 / J+9), écrits dans les gabarits de la séquence avec des variables
— `{{prenom}}`, `{{societe}}`, `{{observation}}`, `{{lien_case_study}}`… —
et envoyés **depuis la boîte Gmail des Reçus**, l'adresse de l'agence. Un
contact s'y inscrit depuis le pipeline (sélection du tableau, ou panneau du
prospect) ; son **canal est figé à l'inscription** :

| Adresse | Canal | Ce qui se passe |
|---|---|---|
| `valid` | email | la séquence part, dans la fenêtre et sous le plafond |
| `risky` | LinkedIn | une tâche « Mon travail » et un message pré-rédigé à copier ; rien d'automatisé |
| `unknown` / `invalid` / désinscrit | — | écarté à l'inscription, avec la raison |

## Le passage

`pnpm sequences:passage` tourne dans le workflow horaire
(`airwallex-sync.yml`, jamais sur la portée `finance`), et le bouton
« Passer maintenant » de l'écran le rejoue à la demande. Trois temps :

1. **Relever les fils Gmail** des inscriptions ayant reçu un envoi : une
   réponse arrête la séquence et passe le prospect en « A répondu » ; un
   rebond du facteur invalide l'adresse et arrête l'inscription ; un
   répondeur d'absence est noté, sans rien arrêter.
2. **Préparer les observations** qui manquent : une phrase concrète tirée de
   la page d'accueil du site et des publicités, par Claude (`claude-opus-5`,
   ~3 centimes par contact), jamais inventée — sans matière, le modèle
   répond « AUCUNE » et le gabarit prend son repli. L'observation s'édite à
   la main dans le tableau des inscriptions.
3. **Envoyer ce qui est dû** : fenêtre d'envoi (jours et heures de Paris),
   plafond quotidien par séquence, relances dans le même fil (`In-Reply-To`,
   `threadId`). Un email ne part **jamais** avec une variable sans valeur :
   l'inscription se met en pause avec la raison.

**Garde des rebonds** : au-delà de 3 % de rebonds sur sept jours (à partir
de vingt envois), plus rien ne part, et l'écran l'affiche. Un domaine qui
rebondit part en spam pour longtemps.

## La désinscription

Chaque email porte un lien `/desinscription/<jeton>` en pied de message et
dans l'en-tête `List-Unsubscribe` (+ `List-Unsubscribe-Post`, RFC 8058 : le
geste « Se désabonner » des messageries). Le jeton est celui du contact,
généré en base. La page ne désinscrit que sur le clic du bouton — un GET
suivi par un robot d'aperçu ne désinscrit personne. La désinscription est
définitive et bloquante en base (triggers de 20260907a).

## Ce qu'il faut

- La boîte Gmail des Reçus connectée (`docs/recus-setup.md`). Sans elle, le
  passage le dit et ne fait rien.
- `ANTHROPIC_API_KEY` pour les observations ; sans elle, les gabarits vivent
  sur leurs replis.
- `NEXT_PUBLIC_SITE_URL` sur le runner GitHub, pour les liens de
  désinscription : la variable de dépôt `NEXT_PUBLIC_SITE_URL`, à défaut
  `https://dashboard-antidotes-beta.vercel.app`.

## Ce qui n'existe pas, volontairement

- Aucun suivi d'ouverture ni de clic : le proxy d'images de Gmail rend les
  ouvertures fausses, et un pixel dit « automate ». Le taux de réponse est
  la mesure.
- Aucune automatisation LinkedIn.
- Pas de domaine d'envoi dédié : les emails partent de l'adresse de
  l'agence, au rythme du plafond quotidien. Si le volume monte, c'est le
  premier chantier à ouvrir.
