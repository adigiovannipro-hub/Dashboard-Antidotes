-- Les événements pixel personnalisés d'un compte publicitaire.
--
-- Le Reporting ne connaissait que les événements **standards** de Meta —
-- achat, ajout au panier, vue de page. Or tous les clients ne vendent pas en
-- ligne : I-WAY optimise sur « Validation Shop Lyon » et « Validation Resa
-- Lyon », des événements que son pixel émet sous des noms à lui. Meta les rend
-- dans `actions` sous la forme :
--
--     offsite_conversion.fb_pixel_custom.Validation Shop Lyon
--
-- Aucune règle de rapprochement ne pouvait les attraper : le nom est libre,
-- il n'est connu que du client. Résultat, son Gestionnaire de publicités
-- affichait « 2 validations à 49,93 € » quand Antidotes affichait « 0 achat »
-- — non pas un désaccord de chiffres, mais deux grandeurs différentes.
--
-- Ils ne sont **pas** rangés dans `ad_metrics_daily.purchases` : une
-- validation de boutique n'est pas une vente, et les additionner fabriquerait
-- un ROAS à partir d'un événement sans montant. Ils vivent donc à part, avec
-- leur nom, et s'affichent sous ce nom.
--
-- Le grain est celui de `ad_metrics_daily` — jour × entité — plus le nom de
-- l'événement. La clé primaire porte les quatre : un même ad set peut émettre
-- plusieurs événements le même jour, et c'est le cas courant.

create table ad_custom_events_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  entity_id uuid not null references ad_entities (id) on delete cascade,
  date date not null,
  -- Le nom tel que le pixel du client l'émet : « Validation Shop Lyon ».
  -- Texte libre et non enum — il appartient au client, pas au produit.
  event_name text not null,
  count bigint not null default 0,
  -- La valeur monétaire quand l'événement en porte une. Beaucoup n'en ont
  -- pas : une validation de boutique ne vaut pas un montant, et zéro ici
  -- signifie « sans montant », jamais « gratuit ».
  value numeric(14, 4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, entity_id, date, event_name)
);

-- La lecture balaie un espace sur une période, puis regroupe par nom.
create index ad_custom_events_workspace_idx
  on ad_custom_events_daily (workspace_id, date);
