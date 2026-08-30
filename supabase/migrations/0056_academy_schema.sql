-- ===========================================================================
-- Antidotes Academy — schéma
--
-- Un espace de formation type Skool sous `/academy` : une formation (cours),
-- des modules ordonnés, des leçons qui portent chacune un script vidéo complet
-- en markdown, une vidéo (hébergée chez nous ou embarquée depuis YouTube ou
-- Vimeo), des ressources, la progression et les notes de chaque personne.
--
-- Côté tenant, le module rejoint la génération Reçus / Finance / Mon travail :
-- c'est un outil de l'organisation, rattaché à `org_id`, jamais montré à un
-- client d'espace. La nuance par rapport à « Mon travail » : les **membres**
-- de l'organisation lisent le contenu publié et écrivent leur progression ;
-- seul l'owner écrit le contenu.
--
-- Le script vit en texte dans la leçon (`script_mdx`), pas dans le Storage :
-- il s'édite depuis le back-office, se rend à la lecture, et n'a aucune raison
-- d'être un fichier. Les vidéos, elles, vont dans le bucket `academy-videos`
-- (migration 0057) ou restent chez YouTube/Vimeo — `video_provider` dit où.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* Où vit la vidéo d'une leçon. `none` est l'état de départ : la leçon existe,
   le script se lit, la vidéo arrive plus tard — le lecteur affiche alors un
   emplacement propre, pas une erreur. */
create type academy_video_provider as enum (
  'supabase', 'youtube', 'vimeo', 'mux', 'none'
);

/* L'absence de ligne vaut déjà « pas commencé » ; `not_started` existe pour
   qu'une progression remise à zéro reste une ligne (et garde ses secondes
   vues) au lieu d'un delete qui perdrait l'historique. */
create type academy_progress_status as enum (
  'not_started', 'in_progress', 'completed'
);

-- --- Cours -----------------------------------------------------------------

create table academy_courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  /* Chemin dans le bucket `academy-assets`, ou URL http(s) externe. Un chemin
     se signe au rendu — le bucket est privé, une URL signée stockée ici serait
     périmée en une heure (même règle que `workspaces.logo_url`). */
  cover_url text,
  order_index integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- --- Modules ---------------------------------------------------------------

create table academy_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references academy_courses (id) on delete cascade,
  -- Dénormalisée depuis le cours : la politique RLS tranche sans jointure.
  org_id uuid not null references organizations (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  order_index integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create index academy_modules_course_idx on academy_modules (course_id, order_index);
create index academy_modules_org_idx on academy_modules (org_id);

-- --- Leçons ----------------------------------------------------------------

create table academy_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references academy_modules (id) on delete cascade,
  -- `course_id` en plus du module : « toutes les leçons du cours » est la
  -- requête de la page d'accueil (progression globale), elle ne doit pas
  -- passer par une jointure sur les modules.
  course_id uuid not null references academy_courses (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  slug text not null,
  title text not null,
  /* Deux phrases : ce que la leçon apprend. Affiché en liste et sous le titre. */
  summary text,
  /* Le script complet de la vidéo, en markdown. C'est le cœur de la leçon :
     il se lit même sans vidéo. */
  script_mdx text not null default '',
  duration_min integer,
  video_provider academy_video_provider not null default 'none',
  /* URL YouTube/Vimeo/Mux telle que collée — l'identifiant s'extrait à
     l'affichage, pour que le champ reste lisible et corrigeable. */
  video_url text,
  /* Chemin dans le bucket `academy-videos` quand `video_provider = supabase`. */
  video_storage_path text,
  /* Comme `cover_url` : chemin `academy-assets` ou URL externe. */
  thumbnail_url text,
  /* Liste d'objets { title, description, kind, url } — `kind` parmi
     template | checklist | link | tool. Un jsonb et non une table : les
     ressources n'existent pas hors de leur leçon, personne ne les requête à
     travers les leçons. */
  resources jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);

create index academy_lessons_module_idx on academy_lessons (module_id, order_index);
create index academy_lessons_course_idx on academy_lessons (course_id);
create index academy_lessons_org_idx on academy_lessons (org_id);

-- --- Progression -----------------------------------------------------------

/* Une ligne par personne et par leçon. `watched_seconds` porte la position de
   reprise ; le passage à `completed` s'écrit à 90 % de la durée ou au clic
   « Marquer comme terminé ». */
create table academy_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references academy_lessons (id) on delete cascade,
  status academy_progress_status not null default 'not_started',
  watched_seconds integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index academy_progress_lesson_idx on academy_progress (lesson_id);

-- --- Notes -----------------------------------------------------------------

/* Le bloc-notes personnel d'une leçon, sauvegardé au fil de la frappe. Une
   seule note par personne et par leçon : l'autosauvegarde upserte sur cette
   clé, il n'y a pas de « liste de notes » à gérer. */
create table academy_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references academy_lessons (id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- --- Horodatage ------------------------------------------------------------

create trigger academy_courses_touch
  before update on academy_courses
  for each row execute function app.touch_updated_at();

create trigger academy_modules_touch
  before update on academy_modules
  for each row execute function app.touch_updated_at();

create trigger academy_lessons_touch
  before update on academy_lessons
  for each row execute function app.touch_updated_at();

create trigger academy_progress_touch
  before update on academy_progress
  for each row execute function app.touch_updated_at();

create trigger academy_notes_touch
  before update on academy_notes
  for each row execute function app.touch_updated_at();
