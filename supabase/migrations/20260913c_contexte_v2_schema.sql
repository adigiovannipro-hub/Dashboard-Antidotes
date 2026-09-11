-- ===========================================================================
-- Contexte client v2 — schéma
--
-- Le plan validé vit dans `docs/contexte-v2-schema.md`. Ce qui commande le
-- découpage : `client_context` est **versionnée**, donc elle n'accueille que
-- ce qui décrit la marque et qu'on veut pouvoir relire tel qu'il était il y a
-- six mois. Ce qui décrit le **moment** — une consigne du mois, un rappel
-- d'actualité — n'a rien à faire dans un versionnage de brief : chaque note
-- de deux lignes y fabriquerait une version de plus et l'historique
-- deviendrait illisible. D'où la table non versionnée en fin de fichier.
--
-- Aucun champ rempli n'est détruit : `positioning` et `mentions` partent,
-- mais leur contenu est recopié **sur toutes les versions** avant le
-- `drop column` — relire une version de mars ne doit pas en perdre la moitié.
-- ===========================================================================

-- --- Colonnes versionnées ---------------------------------------------------

/* 3 à 5 publications réelles, brutes, avec leur réseau. Injectées **entières**
   dans les prompts : c'est le registre à reproduire, pas un résumé. Forme :
   [{ "reseau": "instagram", "texte": "…" }] — clés en français, comme
   `pillars` et `deliverables`, parce que ce sont des données produit servies
   telles quelles au modèle. */
alter table client_context
  add column if not exists validated_examples jsonb not null default '[]'::jsonb;

/* Ce que le client a fait retirer, les formulations bannies, les angles
   écartés. Texte libre long : un retour de client ne se range pas en cases. */
alter table client_context
  add column if not exists client_feedback text;

/* [{ "fait": "…", "source": "https://…", "verifie_le": "2026-09-11" }].
   La date est une date ISO et jamais un texte : l'écran marque en ambre ce
   qui dépasse six mois, et un « septembre » ne se compare pas. */
alter table client_context
  add column if not exists sourced_facts jsonb not null default '[]'::jsonb;

/* Les piliers gagnent `objectif_business` et `cta_autorises` : aucune colonne,
   aucun backfill. `pillars` est déjà un tableau d'objets libres, et les deux
   clés sont optionnelles côté TypeScript pour que les piliers déjà écrits
   restent valides. */

-- --- Reprise de `positioning` et `mentions`, puis suppression ---------------

/* Gardé par l'existence de la colonne : ce fichier doit rester rejouable sur
   une base qui l'aurait déjà passé. Le SQL dynamique est le seul moyen de ne
   pas faire échouer l'analyse de la requête sur une colonne absente. */
do $mig$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_context'
      and column_name = 'positioning'
  ) then
    -- Sur **toutes** les versions, pas seulement l'active.
    execute $q$
      update client_context
      set main_context =
        case
          when coalesce(btrim(main_context), '') = '' then 'Positionnement : ' || btrim(positioning)
          else btrim(main_context) || E'\n\nPositionnement : ' || btrim(positioning)
        end
      where positioning is not null and btrim(positioning) <> ''
    $q$;

    execute 'alter table client_context drop column positioning';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_context'
      and column_name = 'mentions'
  ) then
    /* `mentions` est un texte unique, `platforms` une carte par réseau :
       recopier le même texte dans chaque règle déclarée est bavard mais
       réversible à la main ; deviner à quel réseau il s'applique ne l'est
       pas. C'est le seul compromis du lot, et il est assumé. */
    execute $q$
      update client_context c
      set platforms = (
        select jsonb_object_agg(
          k,
          case
            when coalesce(btrim(c.platforms ->> k), '') = ''
              then 'Mentions : ' || btrim(c.mentions)
            else btrim(c.platforms ->> k) || E'\nMentions : ' || btrim(c.mentions)
          end
        )
        from jsonb_object_keys(c.platforms) as k
      )
      where c.mentions is not null
        and btrim(c.mentions) <> ''
        and c.platforms <> '{}'::jsonb
    $q$;

    -- Aucun réseau déclaré : la queue du contexte principal plutôt que la
    -- perte. Rien ne se perd, même dans le cas dégradé.
    execute $q$
      update client_context
      set main_context =
        case
          when coalesce(btrim(main_context), '') = '' then 'Mentions : ' || btrim(mentions)
          else btrim(main_context) || E'\n\nMentions : ' || btrim(mentions)
        end
      where mentions is not null
        and btrim(mentions) <> ''
        and platforms = '{}'::jsonb
    $q$;

    execute 'alter table client_context drop column mentions';
  end if;
end
$mig$;

-- --- Pilotage de la génération (non versionné) ------------------------------

/* Pourquoi une table et pas des colonnes sur `workspaces` : `workspaces` est
   une table du socle, lue par tout le monde — le rail, la navigation, les
   partages. Le pilotage de génération est owner-only, et la RLS filtre des
   lignes et non des colonnes : poser ces champs sur `workspaces` les
   ouvrirait à un client. Leçon déjà payée avec `social_account_secrets`. */
create table if not exists client_generation_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,

  -- Toujours injectées, jamais effacées par le produit.
  permanent_instructions text,

  /* La consigne du mois et le mois qu'elle vise. Le couple, jamais l'un sans
     l'autre : sans le mois, personne ne sait quand elle a fini de servir, et
     une consigne de juin repartirait en octobre. Aucun trigger, aucun cron ne
     l'efface — la lecture compare le mois visé et **ignore** une consigne
     périmée, l'écran le dit et propose Effacer. Une donnée qui s'efface toute
     seule en base est une donnée qu'on ne peut plus expliquer. */
  monthly_instruction text,
  monthly_instruction_month date,

  -- Le rappel d'actualité : court, daté, ignoré passé trente jours.
  temporal_context text,
  temporal_context_at timestamptz,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  -- Calée au 1er du mois, comme `planning_months` et `generation_jobs`.
  constraint client_generation_settings_month_first_day
    check (monthly_instruction_month is null
           or extract(day from monthly_instruction_month) = 1)
);

drop trigger if exists client_generation_settings_touch on client_generation_settings;
create trigger client_generation_settings_touch
  before update on client_generation_settings
  for each row execute function app.touch_updated_at();
