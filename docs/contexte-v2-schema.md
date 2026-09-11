# Contexte client v2 — schéma cible et plan de migration

Demandé avant écriture du code. Rien n'est implémenté tant que ce document
n'est pas validé.

## Ce qui commande le découpage

`client_context` est **versionnée** : une ligne active par espace, `unique
(workspace_id, version)`, et régénérer crée une version + 1 sans jamais
écraser l'ancienne. C'est la bonne maison pour ce qui **décrit la marque** —
on veut pouvoir relire le brief tel qu'il était au moment d'une génération.

C'est la mauvaise maison pour ce qui **décrit le moment** : une consigne du
mois ou un rappel d'actualité n'a rien à faire dans un versionnage de brief,
sinon chaque note de deux lignes fabrique une version de plus et l'historique
devient illisible.

D'où deux endroits, et la règle qui les sépare : *si le champ doit être relu
tel qu'il était il y a six mois, il est versionné ; sinon non.*

## 1. Colonnes ajoutées à `client_context` (versionnées)

| Colonne | Type | Défaut | Rôle |
|---|---|---|---|
| `validated_examples` | `jsonb` not null | `'[]'` | 3 à 5 publications réelles, brutes. Forme : `[{ "reseau": "instagram", "texte": "…" }]`. Injectées **entières** : c'est le registre à reproduire, pas un résumé. |
| `client_feedback` | `text` | `null` | Les retours du client, en texte libre long. Ce qu'il a dit aimer, ce qu'il a fait retirer. |
| `sourced_facts` | `jsonb` not null | `'[]'` | `[{ "fait": "…", "source": "https://…", "verifie_le": "2026-09-11" }]`. L'écran marque en ambre ce qui dépasse six mois ; la date est une `date` ISO, jamais un texte. |

Les clés des jsonb restent **en français** : ce sont des données produit
injectées telles quelles dans les prompts, comme `pillars` et `deliverables`
depuis 0032 et 0034.

**Objectif business et CTA autorisés par pilier** n'ajoutent aucune colonne :
`pillars` est déjà un tableau d'objets libres. Deux clés de plus —
`objectif_business` (texte) et `cta_autorises` (tableau de textes) — et le
type TypeScript `ContextPillar` gagne deux champs optionnels, pour que les
piliers déjà écrits restent valides sans backfill.

**Accroches déjà utilisées** n'ajoute rien non plus : c'est `wording_history`,
alimentée à la validation d'un wording depuis 0032 et enrichie du CTA par
20260912d. La page la lit en lecture seule ; l'écrire à la main créerait une
seconde source de vérité qui divergerait au premier import.

## 2. Table nouvelle `client_generation_settings` (non versionnée)

Une ligne par espace. C'est la zone « Pilotage de la génération ».

```sql
create table client_generation_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,

  -- Toujours injectée, jamais effacée par le produit.
  permanent_instructions text,

  -- La consigne du mois et le mois qu'elle vise. Le couple, jamais l'un sans
  -- l'autre : sans le mois, personne ne sait quand elle a fini de servir, et
  -- une consigne de juin repartirait en octobre.
  monthly_instruction text,
  monthly_instruction_month date,   -- calée au 1er du mois, comme planning_months

  -- Le rappel d'actualité : court, daté, grisé passé trente jours.
  temporal_context text,
  temporal_context_at timestamptz,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
```

Pourquoi une table et pas des colonnes sur `workspaces` : `workspaces` est une
table du socle, lue par tout le monde (le rail, la navigation, les partages).
Le pilotage de génération est **owner-only**, et la RLS filtre des lignes et
non des colonnes — poser ces champs sur `workspaces` les ouvrirait à un
client. C'est la leçon déjà payée avec `social_account_secrets`.

**RLS** : `to authenticated`, lecture et écriture sous `app.owns_workspace
(workspace_id)`, exactement comme `client_context` en 0033, plus le `revoke`
nominatif pour `anon`. Un `describe` de plus dans
`tests/contexte-isolation.test.ts` : le client ne lit rien et n'écrit rien,
l'owner lit et écrit le sien et rien d'autre.

**Effacement automatique de la consigne du mois** : pas de trigger, pas de
cron. La lecture compare `monthly_instruction_month` au mois visé par la
génération et **ignore** une consigne périmée ; l'écran affiche alors « la
consigne d'août n'est plus injectée » avec le bouton Effacer. Une donnée
qu'on efface toute seule en base est une donnée qu'on ne peut plus expliquer.

**Ajustement à chaud** : rien en base, par construction. C'est un champ du
formulaire de génération, transmis au job et journalisé dans
`generation_jobs.input`, jamais persisté comme réglage.

## 3. Suppressions, et ce que devient leur contenu

Aucun champ rempli n'est détruit.

| Champ retiré | Où part son contenu |
|---|---|
| `positioning` | Concaténé à la fin de `main_context`, sous le titre `Positionnement :`, **sur toutes les versions** et pas seulement l'active — sinon relire une version de mars perdrait la moitié du brief. Puis `drop column`. |
| `mentions` | Ajouté en ligne `Mentions : …` dans la règle de **chaque réseau déclaré** de `platforms`. Sans réseau déclaré, il part en queue de `main_context` : rien ne se perd, même dans le cas dégradé. Puis `drop column`. |

Le second cas est le seul compromis du lot, et il est assumé : `mentions` est
un texte unique, `platforms` une carte par réseau. Recopier le même texte
partout est bavard mais réversible à la main ; deviner à quel réseau il
s'applique ne l'est pas. Les quatre cartes de mesure et le panneau
« Historique des versions » ne coûtent aucune migration — ce sont des choix
d'écran.

## 4. Ordre de concaténation du prompt

Celui que tu as donné, avec une seule insertion — le contexte temporel, qui
n'y figurait pas, se range avec le pilotage puisqu'il décrit le moment :

1. contexte marque (`main_context`, positionnement fondu dedans, cibles, ton)
2. piliers (avec objectif business et CTA autorisés)
3. règles par plateforme (mentions fondues dedans)
4. interdits
5. exemples validés
6. retours client
7. faits sourcés
8. accroches déjà utilisées — **en négatif** : « ne pas réécrire ceci »
9. contexte temporel, s'il a moins de trente jours
10. instructions permanentes
11. consigne du mois, si elle vise le mois généré
12. ajustement à chaud

`buildInjectedContext()` rend désormais un **tableau de sections**
`{ titre, texte, tokens }` plutôt qu'une chaîne. Le bouton « Voir le prompt
injecté » lit ce tableau tel quel, et la génération en fait le `join`. Une
seule source : si le compteur affiche 4 200 tokens, c'est parce que ce sont
les 4 200 tokens qui partent, pas une estimation parallèle.

## 5. Fichiers de migration

- `20260913a_contexte_v2_schema.sql` — les trois colonnes, la table de
  pilotage, la reprise de `positioning` et `mentions`, les deux `drop column`.
- `20260913b_contexte_v2_rls.sql` — politiques et `revoke` de la table de
  pilotage.

Schéma et RLS en deux fichiers, comme 0032/0033. Rejeu sur un Postgres 16
jetable avant tout push, `database.types.ts` mis à jour dans le même commit.

## 6. Ce que le code doit consommer, pas seulement stocker

Un champ qui ne change pas le texte généré n'a pas à exister — c'est la règle
de la refonte. Concrètement, la même livraison touche :

- `src/lib/context/injected-context.ts` — les sections, dans l'ordre ci-dessus.
- `src/lib/context/get-client-context.ts` — `contraintes` cesse d'être vide :
  elle porte contexte temporel, instructions permanentes et consigne du mois.
- `src/lib/production/generate.ts` et les trois prompts markdown — l'ajustement
  à chaud, et la section « accroches à ne pas reprendre ».
- `src/lib/context/consolidation.ts` et `diff.ts` — la régénération ne doit
  jamais proposer d'écraser des exemples validés ni des faits sourcés : ce
  sont des saisies humaines, comme les livrables contractuels le sont déjà.
