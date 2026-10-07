-- Andrea De Luca n'a pas de publicité Meta : son Reporting ouvrait pourtant
-- un onglet Meta Ads vide.
--
-- « Meta » seul, aux livrables du Contexte, se lit comme le réseau tel qu'on
-- le vend — payant et organique — et ouvre trois onglets
-- (`networksFromContextName`). Andrea n'est que sur l'organique : le réseau
-- devient « Instagram » et « Facebook ». Les quantités contractuelles de
-- « Meta » passent à Instagram seul : les recopier sur Facebook doublerait le
-- volume dû (Andrea n'en a d'ailleurs aucune). Seule la version active est
-- touchée, l'historique garde ce qui était déclaré. Rejouable : sans « Meta »
-- dans la liste, rien ne bouge.

update client_context as context
set deliverables = jsonb_set(
  context.deliverables,
  '{reseaux}',
  (
    select jsonb_agg(network order by position)
    from (
      select
        case
          when entry->>'nom' is distinct from 'Meta' then entry
          when name.rank = 0 then jsonb_set(entry, '{nom}', to_jsonb(name.value))
          else jsonb_set(jsonb_set(entry, '{nom}', to_jsonb(name.value)), '{publications}', '[]'::jsonb)
        end as network,
        ordinality * 10 + name.rank as position
      from jsonb_array_elements(context.deliverables->'reseaux') with ordinality as list(entry, ordinality)
      cross join lateral (
        select value, rank
        from (values ('Instagram', 0), ('Facebook', 1)) as names(value, rank)
        where entry->>'nom' = 'Meta' or rank = 0
      ) as name
    ) as expanded
  )
)
from workspaces
where workspaces.id = context.workspace_id
  and workspaces.slug = 'andrea-de-luca'
  and context.is_active
  and context.deliverables->'reseaux' @> '[{"nom": "Meta"}]';
