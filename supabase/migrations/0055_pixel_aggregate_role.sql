-- L'agrégat du pixel compte comme achat chez I-WAY, et le bruit s'en va.
--
-- Le premier vrai sync après 0051 a établi deux faits que la spéculation
-- avait manqués :
--
--   1. **L'API Insights ne rend pas les noms.** Le Gestionnaire affiche
--      « Validation Shop Lyon » colonne par colonne, mais `actions` ne porte
--      que l'agrégat `offsite_conversion.fb_pixel_custom` — 11 conversions et
--      466,30 € de valeur sur juin 2026, le même champ que le « Website
--      custom conversions » du Looker de référence. Les rôles posés par 0054
--      sur les quatre noms ne rencontraient donc jamais rien : on ajoute
--      l'agrégat aux achats, en gardant les noms pour le jour où Meta les
--      rendrait (le collecteur écarte alors l'agrégat, qui en est la somme).
--
--   2. **« Tout ce qui n'est pas standard » ramassait l'engagement.** Huit
--      cartes de likes et de sauvegardes (`post_interaction_*`,
--      `onsite_conversion.post_*`), toutes redites de métriques déjà
--      affichées. Le collecteur les exclut désormais ; ici on purge ce qui
--      est déjà entré. Suppression ciblée par nom, et re-collectable par un
--      simple sync si elle se révélait trop large.

update data_sources
set purchase_event_names = array[
  'offsite_conversion.fb_pixel_custom',
  'Validation Shop Lyon',
  'Validation Shop Paris'
],
    -- Redit de 0054, pour que ce fichier porte le réglage entier : les Resa
    -- sont les mises au panier, et ne serviront que si Meta rend les noms.
    add_to_cart_event_names = array[
  'Validation Resa Lyon',
  'Validation Resa Paris'
]
where provider = 'meta_ads'
  -- Égalité stricte, pas un like non ancré : un identifiant plus long qui
  -- contiendrait celui-ci par malchance ne doit pas hériter du réglage.
  and external_account_id in ('837962101192463', 'act_837962101192463');

delete from ad_custom_events_daily
where event_name in ('post_interaction_net', 'post_interaction_gross')
   or event_name like 'onsite\_conversion.post\_%' escape '\';
