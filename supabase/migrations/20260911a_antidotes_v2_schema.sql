-- ===========================================================================
-- Pôle « Antidotes », deuxième forme — le schéma
--
-- Ce que les retours sur les écrans remplis ont demandé :
--
--   • l'ordre du rail se choisit à la souris et se retient par personne
--     (`profiles.rail_order`) ;
--   • l'inbound tient sur une seule page : le contenu relevé porte sa
--     transcription et son média (un reel se lit par son script, pas par sa
--     légende), un brouillon a un **format** — post LinkedIn ou script de
--     reel — et une **date de programmation** ;
--   • mes consignes de voix — comment j'écris, des exemples de post, de
--     script, d'email — vivent dans une table à une ligne par organisation,
--     lue par chaque génération.
-- ===========================================================================

-- --- L'ordre du rail --------------------------------------------------------

/* Par personne, pas par organisation : c'est une préférence d'affichage,
   comme le rail replié — mais celle-ci doit survivre au navigateur, d'où la
   base et non un cookie. Forme : { clients: [href…], entreprise: [href…] } ;
   une entrée absente de la liste garde sa place par défaut. */
alter table profiles
  add column if not exists rail_order jsonb not null default '{}'::jsonb;

-- --- Le contenu relevé : média et transcription -----------------------------

create type antidotes_media_kind as enum ('video', 'image', 'carousel', 'text');

alter table antidotes_reference_posts
  add column if not exists media_kind antidotes_media_kind,
  /* L'URL du média rendue par le réseau — périssable (quelques heures chez
     Instagram) : elle sert au relevé pour transcrire, jamais à l'affichage. */
  add column if not exists media_url text,
  /* Le script d'une vidéo, transcrit au relevé. C'est lui que le tableau
     montre pour un reel, et lui que le studio reçoit comme matière. */
  add column if not exists transcript text;

-- --- Le brouillon : format et programmation ---------------------------------

create type antidotes_post_format as enum ('linkedin_post', 'reel_script');

alter table antidotes_generated_posts
  add column if not exists format antidotes_post_format not null default 'linkedin_post',
  /* Un post approuvé part à cette date par le passage horaire ; nul, il part
     au clic. Un script de reel ne se publie pas — la date sert de repère
     dans le calendrier. */
  add column if not exists scheduled_at timestamptz;

create index antidotes_generated_posts_scheduled_idx
  on antidotes_generated_posts (org_id, scheduled_at)
  where scheduled_at is not null;

-- --- Mes consignes de voix --------------------------------------------------

/* Une ligne par organisation. `thresholds` : les seuils de relevé par réseau
     { instagram: { min_views }, linkedin: { min_likes, min_comments }, … }
   — ce qu'on garde d'une vague, le reste n'entre pas dans le tableau. */
create table antidotes_inbound_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  guidelines text,
  linkedin_example text,
  reel_example text,
  email_example text,
  thresholds jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger antidotes_inbound_settings_touch
  before update on antidotes_inbound_settings
  for each row execute function app.touch_updated_at();

notify pgrst, 'reload schema';
