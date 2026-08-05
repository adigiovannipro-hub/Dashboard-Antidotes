# Plan d'implémentation — Planning Éditorial

## Contexte

Le planning éditorial social media se tient dans Monday.com : un board par
client et par année (`LUNETTES BONDET I PE 2026`), un groupe par mois, un
élément parent par réseau social, un sous-élément par publication. À côté, un
second board sert de FAQ.

L'objectif n'est pas de refléter Monday : c'est de **le remplacer**. Le planning
descend dans l'espace du client, à côté de son Reporting, avec les mêmes gestes
et le même vocabulaire — pour que personne n'ait à réapprendre son outil.

L'espace Bondet porte donc deux sections : le **Planning Éditorial** — deux
tableaux, l'année (mois → réseau → publication) et la FAQ alimentée par la
Modération — puis le **Reporting**. La structure des écrans est décrite dans
[`UI.md`](UI.md).

Le dashboard de performance s'appelait « Meta », du nom de sa source. Il
s'appelle désormais « Reporting », du nom de ce qu'il fait : TikTok et les
autres régies viendront s'y ajouter sans qu'il change de nom une fois de plus.

## Décision : le dashboard est l'outil, pas le miroir

Une première version synchronisait Monday dans les deux sens. Elle a été
abandonnée : deux outils qui s'écrivent mutuellement, ce sont deux vérités et un
conflit à chaque modification.

Le sens unique retenu est **Monday → Antidotes, une fois**. `pnpm import:monday`
reprend une année déjà saisie plutôt que de la faire retaper ; après quoi le
tableau du dashboard fait autorité et Monday n'est plus interrogé. L'import est
rejouable — les identifiants Monday sont conservés dans `external_id` — et une
publication créée à la main n'en a pas, donc ne sera jamais écrasée.

## Décision : l'isolation est celle des espaces

Le planning n'a pas ses propres rôles. Il vit dans un espace client et hérite de
son cloisonnement, déjà éprouvé et déjà testé.

Cela veut dire que **le client écrit dans son planning** : il réorganise, annote,
valide un wording. C'est le modèle de rôles acté pour la plateforme, où aucun
utilisateur authentifié n'est en lecture seule. Ce qui reste à l'owner de
l'organisation : supprimer un tableau, c'est-à-dire une année entière.

## Modèle de données

```
planning_boards       id, workspace_id, kind: editorial|faq, slug, name, year,
                      position, settings jsonb
                      -- settings porte les objectifs publicitaires proposés :
                      -- chaque client a les siens, c'est une donnée

planning_months       id, board_id, workspace_id, label, month date, position
                      -- `label` est le libellé affiché (« SEPTEMBRE »),
                      -- `month` est ce qui trie et compare
                      unique (board_id, month)

planning_lanes        id, month_id, board_id, workspace_id, platform, name,
                      position, external_id
                      -- pas d'unicité sur (mois, plateforme) : un même mois
                      -- porte parfois deux couloirs Meta, feed et dark

planning_subjects     id, lane_id, month_id, board_id, workspace_id,
                      name, status, format, scheduled_on, wording,
                      sponsoring, ad_objective, ad_status, owner_id,
                      visual_urls text[], position, external_id

planning_comments     id, subject_id, workspace_id, author_id, scope, body
                      -- scope : general | visual | wording

planning_faq_entries  id, board_id, workspace_id, question, answer, category,
                      position, source: manual|moderation
```

Les colonnes du tableau, dans l'ordre où elles s'affichent : **Sujet**,
retours, **Propriétaire**, **Statut**, **Type**, **Date**, **Visuel**,
**Wording**, **Sponsorisation**, **Objectif**, **Statut Ads**.

Les libellés et les couleurs reprennent exactement ceux du board d'origine —
`EN COURS` en orange, `PUBLIÉ` en vert, `REELS` en violet. Ce n'est pas de la
coquetterie : l'équipe lit ce tableau depuis des mois, et un orange qui ne veut
plus dire « en cours » coûterait plus cher qu'une palette repensée.

## Les visuels

Bucket privé `planning-visuals`, chemins en `<espace>/<publication>/<fichier>` —
le premier dossier dit à qui appartient le fichier, ce qui rend la politique de
stockage lisible. L'affichage passe par des URL signées d'une heure, générées au
rendu. Le fichier transite par une action serveur plutôt que d'aller directement
au bucket : le chemin est ainsi construit à partir de l'espace réellement
accessible, et non d'un identifiant fourni par le navigateur.

## Ce que Monday ne fait pas

Trois analyses, en code testé plutôt qu'en consignes :

| Module | Ce qu'il répond |
|---|---|
| `strategy.ts` | Quel est le rythme réel de ce client ? Médiane des mois **complets** — une moyenne ferait passer un mois de lancement pour la norme |
| `cadence.ts` | Ce mois est-il bien construit ? Alternance des formats, couverture, week-ends, rotation des templates, volume face à l'habitude |
| `health.ts` | Ce mois est-il prêt à partir ? Wording manquant, visuel absent, non validé à J-3, daté d'hier et pas publié |

Le contrôle de cadence s'affiche en une ligne dépliable au-dessus du tableau, et
porte sur le mois en cours. C'est un avis, pas une interdiction : un Reel le
dimanche parce que c'est le jour du Grand Prix est un bon choix.

## Vérification

Couvert par les tests : normalisation du vocabulaire Monday (accents, casse,
libellés inconnus, « Statut Ads » qui ne doit jamais devenir « Status »),
déduction de stratégie (médiane, exclusion des mois partiels, absence
d'historique), chaque code d'anomalie de cadence et l'absence de faux positif
sur un mois sain, santé de production, et l'isolation RLS — dans les deux sens,
puisqu'un client doit pouvoir écrire chez lui autant qu'il doit être incapable
de lire ailleurs.
