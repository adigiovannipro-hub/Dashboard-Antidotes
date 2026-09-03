# Antidotes Academy

Espace de formation type Skool, sous `/academy`. **Deux formations** :
« Devenir freelance social media manager » (13 modules, 54 leçons) et
« Devenir libre grâce à l'UGC » (14 modules, 65 leçons). Chaque leçon porte un
script vidéo complet en base, ses ressources, et parfois un **document de
travail** lisible dans la leçon.

Trois profils, et c'est la nouveauté structurante :

- **L'owner** administre depuis `/academy/admin` : contenu, miniatures,
  publication, inscriptions.
- **Un membre de l'organisation** suit toutes les formations publiées.
- **Une élève** — quelqu'un qui a acheté une formation — ne voit **que les
  formations où elle est inscrite**, et **rien d'autre dans Antidotes** : pas
  de hub, pas d'espace client, pas de Finance, pas de Modération. Son rail
  n'a qu'une entrée.

Un client d'espace ne voit rien : le module répond 404, pas 403.

## Schéma des tables (migrations 0056-0058, puis 20260903a-c)

| Table | Rôle | Colonnes notables |
|---|---|---|
| `academy_courses` | Une formation. | `slug`, `title`, `description`, `cover_url` (chemin `academy-assets` ou URL http), `order_index`, `published` |
| `academy_modules` | Les chapitres, ordonnés. | `course_id`, `org_id` dénormalisé, `slug`, `cover_url` (**la miniature d'introduction**, 20260903a), `order_index`, `published` |
| `academy_lessons` | Les leçons. Le script vit **en base**. | `script_mdx`, `duration_min`, `video_provider`, `video_url`, `video_storage_path`, `resources` (jsonb), `published` |
| `academy_progress` | Une ligne par personne et par leçon. | `status`, `watched_seconds`, `completed_at`, unique `(user_id, lesson_id)` |
| `academy_notes` | Le bloc-notes personnel. | `content`, unique `(user_id, lesson_id)` |
| `academy_enrollments` | **L'inscription d'une personne à une formation.** | `course_id`, `email` (la clé fonctionnelle — elle existe avant le compte), `user_id` nullable, `first_name`, `last_name`, `status` (`invited`/`active`/`revoked`), `invited_at`, `activated_at`. Unique sur `(course_id, lower(email))` |

Le jsonb `resources` porte `{title, description, kind, url, body?}`. `kind` ∈
template / checklist / link / tool / **document** ; `body` est le markdown du
document, présent sur les seules ressources qui en sont un. Un document ne se
télécharge pas : il se **déplie dans la leçon** (`<details>` natif, aucun état
client).

### RLS

`0057` posait « membre de l'organisation ⇒ lit le publié ».
`20260903b` réécrit la règle : « membre **ou inscrite à cette formation** ⇒ lit
le publié **de cette formation** ». La chaîne du publié — leçon **et** module
**et** cours — ne bouge pas ; l'owner voit tout, brouillons compris.

Deux helpers `security definer` : `app.academy_course_ids()` (les formations
où l'on est inscrite et active) et `app.academy_org_ids()` (les organisations
où l'on peut écrire sa progression — membre **ou** inscrite ; sans cette
union, une élève ne pourrait pas cocher une leçon terminée).

`academy_enrollments` : une élève lit **sa** ligne et rien d'autre — un fichier
clients ne se distribue pas avec la formation. L'owner écrit tout.

`tests/academy-isolation.test.ts` encode les quatre postures et les deux sens
de chaque règle, dont : l'élève lit sa formation **et pas la voisine**, écrit
**bien** sa progression, et **perd tout** au passage en `revoked`.

### Le raccrochage à la première connexion

`app.handle_new_user()` (réécrite par `20260903a`) gagne une étape : les
inscriptions `invited` portant l'adresse du compte qui vient de naître passent
en `active` et reçoivent son `user_id`. Elle ne pose **aucune** ligne dans
`organization_members` ni `memberships` — c'est exactement le point : l'élève
entre dans la formation, pas dans l'entreprise.

### Buckets

`academy-videos` (50 Mo/fichier, le plafond du Free) et `academy-assets`
(couvertures de formation et miniatures de module, 5 Mo). Privés, sans
politique de lecture : les fichiers sont servis par URL signée après
vérification du droit.

## Les écrans

| Route | Qui | Quoi |
|---|---|---|
| `/academy` | tous | Le catalogue : une carte par formation accessible |
| `/academy/[formation]` | tous | Modules en cartes à miniature, reprise, progression |
| `/academy/[formation]/[module]` | tous | La liste des leçons |
| `/academy/[formation]/[module]/[lecon]` | tous | Vidéo, script, ressources, notes |
| `/academy/admin` | owner | Sélecteur de formation, réglages, modules, leçons |
| `/academy/admin/membres` | owner | Le fichier des élèves, l'inscription, les relances |
| `/mon-profil` | **tous, y compris élèves** | Photo, prénom, nom |

Une élève inscrite à une seule formation n'a pas de lien de retour vers le
catalogue : il ne mènerait nulle part, et l'existence des autres formations ne
la regarde pas.

## Inscrire quelqu'un

Depuis `/academy/admin/membres` : prénom, nom, adresse, formation.

L'inscription est écrite **par adresse**, avant que le compte existe. Puis
`auth.admin.generateLink` fabrique un lien de connexion — le même mécanisme
que le magic link, sans passer par la boîte d'envoi de Supabase dont le quota
gratuit est de quelques messages par heure.

**L'envoi passe par Resend**, en HTTP direct (`fetch`, aucune dépendance
ajoutée) : 3 000 messages par mois en gratuit. **Sans `RESEND_API_KEY`,
l'inscription est quand même écrite et le lien s'affiche à l'écran, à copier.**
Dégradation prévue : le module reste utilisable le jour de son installation,
avant que le domaine d'envoi soit vérifié.

Le lien pointe `/auth/callback?token_hash=…&type=…&suivant=/academy/[formation]`
— la forme qui fonctionne quand le lien est ouvert **ailleurs** que dans le
navigateur qui l'a demandé, ce qui est le cas de toute invitation.

« Retirer » passe en `revoked` sans effacer la ligne : on garde la trace de qui
a acheté quoi, et rendre l'accès ne repart pas de zéro — la progression était
intacte, seulement invisible.

## Ajouter un module, une leçon, une miniature

Depuis `/academy/admin` (owner uniquement) :

1. **Formation** : le sélecteur en haut à droite ; « Créer » si la base est
   vide. Titre, description, couverture, ordre, publication.
2. **Module** : champ en bas du rail de gauche. Il naît en brouillon.
   Sélectionne-le pour régler titre, description, **miniature**, ordre.
3. **Leçon** : sélectionne le module → champ sous la liste. Ouvre-la pour
   remplir résumé, durée, script, ressources, vidéo — puis « Publier ».

**Les miniatures** partent du navigateur droit au bucket (URL d'envoi signée),
PNG/JPG/WebP, 5 Mo. Sans miniature, un **dégradé dérivé du slug** tient sa
place : stable pour toujours, jamais clignotant d'une navigation à l'autre.
Contraste du blanc sur ce dégradé vérifié sur les 72 teintes : **6,84:1 au
pire**, seuil de 4,5:1 tenu partout.

## Le contenu et son seed

Source relisible dans `scripts/data/academy/` et `scripts/data/academy-ugc/` —
un dossier par module, `module.json` plus un `.md` par leçon.
`pnpm generate:academy-seed` fabrique les deux migrations.

**`0058` est appliquée à la vraie base** : elle se régénère à l'octet près et
ne doit jamais changer. C'est pourquoi `body` n'est ajouté au jsonb d'une
ressource que lorsqu'elle en porte un — l'ajouter partout, fût-ce à `null`,
aurait changé son empreinte et affiché « ⚠ modifiée depuis ».

`20260903c_academy_ugc_seed.sql` porte la formation UGC. Identifiants stables
(SHA-256 du chemin), `on conflict do nothing` : rejouer n'écrase jamais une
retouche faite depuis le back-office.

Le générateur refuse tout écart : module manquant, JSON invalide, script hors
gabarit (600-2000 mots), reste de placeholder, ressource sans titre, URL
malformée, **document de moins de 200 caractères**.

## Le markdown des scripts

Parseur maison (`src/lib/academy/markdown.ts`), sans dépendance : titres,
gras, italique, code, liens, listes, citations, filets — et **tableaux**
(`| a | b |` avec sa ligne de séparation), ajoutés pour les documents de
travail : une grille tarifaire ou une comparaison de trois métiers ne se lit
pas en liste à puces. Le rendu défile dans son propre conteneur plutôt que de
faire déborder la page.

## Variables d'environnement

Deux nouvelles, toutes deux facultatives :

- `RESEND_API_KEY` — le facteur du courriel d'arrivée. Absente, le lien
  s'affiche à l'écran pour un envoi à la main.
- `ACADEMY_EMAIL_FROM` — l'expéditeur affiché. Le défaut `onboarding@resend.dev`
  ne poste qu'à l'adresse du compte Resend, ce qui suffit pour un essai.

Le reste vit sur les variables Supabase existantes.
