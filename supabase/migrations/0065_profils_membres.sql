-- ===========================================================================
-- 0065 — La fiche d'un membre : prénom, nom, photo de profil
--
-- `profiles.full_name` et `profiles.avatar_url` existent depuis 0001 mais
-- aucun écran ne les remplit. La gestion des accès gagne les deux champs de
-- nom séparés — « Prénom Nom » recomposé dans `full_name` pour tout ce qui
-- l'affiche déjà — et la photo se pose dans un bucket dédié, `avatar_url`
-- gardant le **chemin**, jamais l'URL signée, comme les logos d'espace (0042).
--
-- Une invitation porte aussi les deux noms : la fiche se remplit au moment où
-- l'on invite, avant que le compte existe — même logique que les droits par
-- page de 0035, portés par l'adresse.
-- ===========================================================================

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

alter table invitations add column if not exists first_name text;
alter table invitations add column if not exists last_name text;

/* Bucket privé, sans aucune politique `storage.objects` : les avatars ne se
   lisent et ne s'écrivent que depuis les écrans d'administration, qui passent
   par le rôle service après la garde owner. Ouvrir le bucket au rôle
   `authenticated` n'aurait aucun lecteur légitime aujourd'hui — une politique
   sans usage est une surface en trop. */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  false,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
