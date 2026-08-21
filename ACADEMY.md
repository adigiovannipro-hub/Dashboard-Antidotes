# Antidotes Academy

Espace de formation type Skool, sous `/academy` : « Devenir freelance social
media manager », 13 modules, 54 leçons, un script vidéo complet par leçon.
Les membres de l'organisation suivent la formation (progression et notes
personnelles) ; l'owner édite tout depuis `/academy/admin` ; un client
d'espace ne voit rien — le module répond 404, pas 403.

## Schéma des tables (migrations 0056–0058)

| Table | Rôle | Colonnes notables |
|---|---|---|
| `academy_courses` | La formation. Une seule aujourd'hui, le modèle en accepte plusieurs. | `slug`, `title`, `description`, `cover_url` (chemin `academy-assets` ou URL http), `order_index`, `published` |
| `academy_modules` | Les chapitres, ordonnés. | `course_id`, `org_id` dénormalisé, `slug`, `order_index`, `published` |
| `academy_lessons` | Les leçons. Le script vit **en base**, pas dans le Storage. | `script_mdx` (markdown), `duration_min`, `video_provider` (`supabase`/`youtube`/`vimeo`/`mux`/`none`), `video_url` (l'URL telle que collée), `video_storage_path` (chemin bucket si hébergée ici), `resources` (jsonb `[{title, description, kind, url}]`, `kind` ∈ template/checklist/link/tool), `published` |
| `academy_progress` | Une ligne par personne et par leçon. | `status` (`not_started`/`in_progress`/`completed`), `watched_seconds` (position de reprise), `completed_at`, unique `(user_id, lesson_id)` |
| `academy_notes` | Le bloc-notes personnel, une note par personne et par leçon. | `content`, unique `(user_id, lesson_id)` |

RLS (0057) : lecture membre limitée au **publié en chaîne** (leçon publiée
**et** module publié **et** cours publié), écriture de contenu owner seul,
progression et notes strictement personnelles. `tests/academy-isolation.test.ts`
encode les deux sens — il tourne dans l'étape tests d'isolation de db-admin,
comme les autres.

Deux buckets privés : `academy-videos` (50 Mo/fichier — le plafond Supabase
Free) et `academy-assets` (couvertures, 5 Mo). Aucune politique de lecture :
les fichiers sont servis par URL signée après vérification du droit.

## Ajouter un module ou une leçon

Depuis `/academy/admin` (owner uniquement) :

1. **Module** : champ « Titre du nouveau module » en bas du rail de gauche →
   Ajouter. Il naît en brouillon, slug dérivé du titre. Sélectionne-le pour
   régler titre, description, ordre (flèches), puis « Publier ».
2. **Leçon** : sélectionne le module → champ « Titre de la nouvelle leçon »
   sous la liste → Ajouter. Ouvre-la (crayon) pour remplir résumé, durée,
   script, ressources, vidéo — puis « Publier ». Une leçon publiée dans un
   module en brouillon reste invisible : publie la chaîne entière.

L'ordre affiché aux membres est l'ordre du back-office (flèches monter /
descendre, sur les modules comme sur les leçons).

## Uploader une vidéo

Dans l'éditeur d'une leçon, panneau **Vidéo** :

- **Fichier local** : glisser le MP4/MOV/WebM dans la zone (ou cliquer pour
  choisir). L'envoi part du navigateur droit au bucket, barre de progression
  à l'appui, **50 Mo maximum** — c'est le plafond du projet Supabase Free.
  Au-delà : YouTube ou Vimeo en non répertorié.
- **YouTube / Vimeo / Mux** : coller n'importe quelle forme d'URL (page de
  visionnage, lien court, lien d'embed, lien privé Vimeo avec hash) →
  « Brancher ». Le fournisseur et l'identifiant sont reconnus automatiquement.
- « Retirer » ramène la leçon à l'état « Vidéo à venir » — le script reste
  lisible, et le lecteur affiche un emplacement propre, pas une erreur.

Lecture côté membre : une vidéo hébergée ici est servie par URL signée de
six heures (`/api/academy/video/[lessonId]`), reprend à la position
sauvegardée, et bascule la leçon en « terminée » à 90 % de la durée. Les
embeds ne rapportent pas leur position : le passage en terminé y reste le
bouton « Marquer comme terminé ».

## Modifier un script

- **Après mise en production** : `/academy/admin` → module → leçon → panneau
  **Script**. Markdown simple (`##`/`###`, gras, italique, listes, citations,
  liens) ; l'aperçu de droite est exactement le rendu de la page de lecture.
  « Enregistrer la leçon » écrit tout (métadonnées, script, ressources).
- **Avant l'application de 0058** : la source est `scripts/data/academy/`
  (un dossier par module : `module.json` + un `.md` par leçon). Après
  retouche, `pnpm generate:academy-seed` régénère
  `supabase/migrations/0058_academy_seed.sql`. Une fois 0058 appliquée à la
  vraie base, la migration ne se rejoue plus : toute retouche passe par le
  back-office. Les identifiants sont stables (SHA-256 du chemin) et le seed
  est en `on conflict do nothing` — il n'écrase jamais une édition faite
  depuis l'écran.

## Variables d'environnement

Rien de nouveau : l'Academy vit sur les variables Supabase existantes
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` pour les URL signées côté serveur), déjà dans
`.env.example`.
