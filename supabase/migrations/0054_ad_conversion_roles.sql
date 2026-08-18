-- Le rôle d'un événement personnalisé : achat, panier, ou rien.
--
-- 0053 n'offrait qu'un seul rôle, « compte comme achat ». Insuffisant dès le
-- premier client concerné : chez I-WAY le pixel émet quatre événements, et
-- ils ne disent pas la même chose — « Validation Shop » est la vente,
-- « Validation Resa » la mise en panier. Les verser tous dans les achats
-- doublerait le chiffre ; n'en verser aucun laisse l'écran à zéro.
--
-- Deux colonnes plutôt qu'une table de correspondance : un compte porte une
-- poignée d'événements, la lecture doit rester un seul `select`, et un tableau
-- Postgres se lit et se règle sans jointure.

alter table data_sources
  add column add_to_cart_event_names text[] not null default '{}';

comment on column data_sources.add_to_cart_event_names is
  'Noms d''événements personnalisés à compter comme mises au panier à la lecture. Vide = aucun.';

-- Le réglage d'I-WAY, posé ici plutôt que laissé à un clic : le client l'a
-- décrit sans ambiguïté, et le lui faire ressaisir n'apporte rien. Idempotent,
-- et sans effet sur tout autre compte — la clause `where` ne vise que le
-- compte publicitaire concerné, s'il existe dans cette base.
update data_sources
set purchase_event_names = array['Validation Shop Lyon', 'Validation Shop Paris'],
    add_to_cart_event_names = array['Validation Resa Lyon', 'Validation Resa Paris']
where provider = 'meta_ads'
  and external_account_id like '%837962101192463%';
