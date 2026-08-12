-- Les quantités se comptent réseau par réseau.
--
-- Déclarer les réseaux ne suffisait pas : le volume restait global, alors
-- qu'il se contracte par réseau — quatre posts et huit stories sur Instagram
-- n'ont rien à voir avec les deux articles LinkedIn du même client.
--
-- `reseaux` passe donc d'une liste de noms à une liste d'objets
-- `{"nom": "Instagram", "publications": [{"categorie": "Reels", "quantite": 2}]}`.
--
-- Ce qui était saisi avant reste **où il est** : le total global devient un
-- bloc « hors réseau », visible et déplaçable à la main. Répartir
-- automatiquement un ancien total entre deux réseaux reviendrait à inventer
-- un contrat, et personne ne verrait passer l'invention.
update client_context
   set deliverables = jsonb_set(
     deliverables,
     '{reseaux}',
     coalesce(
       (
         select jsonb_agg(jsonb_build_object('nom', nom, 'publications', '[]'::jsonb))
           from jsonb_array_elements_text(deliverables -> 'reseaux') as nom
       ),
       '[]'::jsonb
     )
   )
 where jsonb_typeof(deliverables -> 'reseaux') = 'array'
   and exists (
     select 1
       from jsonb_array_elements(deliverables -> 'reseaux') as entree
      where jsonb_typeof(entree) = 'string'
   );
