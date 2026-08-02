# Plan d'implémentation — Module Planning Édito

## Contexte

Le planning éditorial vit dans Monday.com : un board par client et par année
(`LUNETTES BONDET I PE 2026`), un groupe par mois, un élément parent par
plateforme, et un sous-élément par contenu. C'est là que la production se fait,
et ça ne change pas — Monday reste l'outil d'édition et de validation client.

Ce que Monday ne sait pas faire, et qui est l'objet du module :

- **voir un mois d'un coup d'œil** — Monday empile des sous-éléments dans des
  groupes repliés ; il faut cliquer partout pour savoir où en est le mois ;
- **déduire la stratégie** d'un client qui n'en a jamais formalisé une, à partir
  de ce qui a réellement été publié les mois précédents ;
- **contrôler la cadence** — alternance des formats, rotation des templates,
  couverture du mois, publications le week-end ;
- **dire ce qui manque** — wording à écrire, visuel absent, contenu daté d'hier
  et toujours pas publié.

Le module est **interne**, comme la Modération : aucune route, aucun lien depuis
un espace client. Les rôles lui sont propres.

**Périmètre V1** : les cinq boards PE actifs (Bondet, Catherine Osti, I-WAY,
ANMF, NAYA) et leurs archives, sans un seul identifiant en dur.

## Décision : Monday reste la source, la base est le miroir

Même principe que pour les régies publicitaires : **le module lit la base, jamais
l'API Monday en direct**. Une synchronisation pull recopie boards, groupes,
éléments et sous-éléments dans Postgres ; l'affichage est instantané et ne
consomme aucun quota.

L'écriture est **volontairement asymétrique** :

| Sens | Portée |
|---|---|
| Monday → Antidotes | tout : structure, colonnes, statuts, wording, budgets |
| Antidotes → Monday | **le Wording et les Commentaires, rien d'autre** |

`Status`, `Visuel`, `Propriétaire`, `Date`, `Thématique` et `OK client` ne sont
jamais réécrits. C'est la règle des skills `editorial-planner` et
`caption-writer`, et elle est appliquée dans le code, pas seulement documentée :
la fonction de push refuse toute colonne hors liste blanche.

Le push est **désactivé par défaut** et se fait sous revue : une modification de
wording est mise en file (`pending_wording`) et n'atteint Monday que sur action
explicite.

## Décision : le mapping des colonnes est une donnée, jamais du code

Les deux boards inspectés partagent la plupart des identifiants de colonne
(`texte5` pour Wording, `dup__of_status` pour Thématique, `date0` pour Date),
mais **ils divergent déjà** :

- I-WAY a une colonne `Commentaires` (`long_text_mm2v8f3h`) que Bondet n'a pas ;
- la Thématique de Bondet compte sept libellés (dont `CARROUSEL`, `DARK`),
  celle d'I-WAY trois ;
- les `Objectifs` diffèrent : `Traffic` chez Bondet, `Followers` chez I-WAY ;
- les groupes de mois ne s'écrivent même pas pareil — `AOUT` chez l'un, `AOÛT`
  chez l'autre.

Le mapping vit donc dans `planning_boards.column_mapping` et
`planning_boards.status_mapping`, en JSON, avec des valeurs par défaut déduites
à la découverte du board. Ajouter un sixième client ne demande aucune ligne de
code.

## Modèle de données

```
planning_clients     id, org_id, workspace_id?, slug, name,
                     -- null = stratégie déduite de l'historique ; renseigné =
                     -- stratégie déclarée, qui prime sur la déduction
                     strategy_override jsonb,
                     archived_at, created_at

planning_members     user_id, client_id, role: editor|viewer
                     -- `owner` d'organisation = accès à tous les clients

planning_boards      id, client_id, monday_board_id, monday_subitem_board_id,
                     name, year, url, is_archive,
                     column_mapping jsonb,   -- champ canonique → id de colonne
                     status_mapping jsonb,   -- libellé Monday → statut canonique
                     last_synced_at

planning_months      id, board_id, client_id, monday_group_id, label,
                     -- 1er du mois : ce qui rend l'ordre et les comparaisons
                     -- possibles, là où « AOUT » ne se trie pas
                     month date, position

planning_lanes       id, month_id, client_id, monday_item_id,
                     platform, name, position
                     -- un élément parent = une plateforme (META, LINKEDIN…)

planning_subjects    id, lane_id, month_id, client_id, monday_item_id,
                     name, format, format_raw, scheduled_on,
                     status, status_raw, wording, comments,
                     sponsoring numeric, objective, owner_name,
                     visual_urls text[], permalink,
                     -- file d'attente du push, jamais écrite dans Monday sans
                     -- action explicite
                     pending_wording, pending_since, pushed_at,
                     monday_updated_at, synced_at

planning_sync_runs   id, client_id, board_id, direction: pull|push,
                     status, started_at, finished_at,
                     boards_seen, subjects_upserted, error
```

Les index qui portent le produit : `planning_subjects (client_id, month_id,
scheduled_on)` pour la vue mensuelle, `planning_subjects (client_id, status)`
pour les compteurs de production, et `planning_subjects (client_id,
scheduled_on)` pour l'analyse de cadence, qui balaie plusieurs mois.

## Le cœur métier : trois analyses

Les règles des skills sont ici du code testé, pas des consignes de prompt.

### 1. Déduction de stratégie (`strategy.ts`)

À partir des mois complets de l'historique, par plateforme : nombre de
sous-éléments par mois, répartition par format, jours de publication
privilégiés, budgets de sponsorisation, templates récurrents.

Les agrégats sont des **médianes**, pas des moyennes : un mois de lancement à
douze contenus ne doit pas faire croire que le rythme est de douze. Les mois
vides sont exclus, et les mois futurs — encore en cours de remplissage — aussi.

### 2. Contrôle de cadence (`cadence.ts`)

Sur un mois donné, dans l'ordre des dates :

| Code | Ce qui est vérifié |
|---|---|
| `consecutive_format` | pas deux Stories d'affilée, pas deux Reels d'affilée |
| `weekend` | publication samedi ou dimanche |
| `coverage_gap` | trou de plus de N jours sans contenu |
| `month_edges` | le mois démarre tard ou s'arrête tôt |
| `volume_off_target` | volume du mois hors de la cible stratégique |
| `format_mix_off` | répartition des formats éloignée du pattern habituel |
| `template_repeat` | template déjà utilisé la même semaine le mois précédent |
| `undated` | sous-élément sans date |

Chaque anomalie porte les identifiants des sujets concernés : l'interface
surligne, elle ne se contente pas d'un message.

### 3. Santé de production (`health.ts`)

Ce qui manque pour que le mois parte : wording vide, visuel absent, contenu non
validé à J-3, contenu daté dans le passé et toujours pas publié. Plus un taux
d'avancement, et le prochain contenu à traiter.

## Étapes

1. **Migrations** — 0006 schéma, 0007 RLS sur les six tables.
2. **Domaine et tests** — mapping Monday configurable, déduction de stratégie,
   cadence, santé de production, permissions. Tout testé.
3. **Connecteur Monday** — client GraphQL, pull complet, journal des runs, push
   du wording sous liste blanche.
4. **Interface** — vue mensuelle en couloirs par plateforme, panneau de sujet
   avec éditeur de wording, rail de santé, panneau stratégie et alertes.
5. **Données de démonstration** — un client complet sur six mois, pour voir le
   rendu sans jeton Monday.

## Vérification

Les domaines couverts par les tests : normalisation des libellés Monday
(accents, casse, libellés inconnus), déduction de stratégie (médiane, exclusion
des mois partiels, absence d'historique), cadence (chaque code d'anomalie,
et l'absence de faux positif sur un mois sain), santé de production, liste
blanche du push (toute colonne hors Wording/Commentaires est rejetée),
permissions et isolation RLS entre clients.
