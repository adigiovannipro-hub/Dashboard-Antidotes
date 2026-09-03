-- ===========================================================================
-- Factures — l'objet du mail devient un champ à lui
--
-- La convention précédente était que la première ligne du modèle servait
-- d'objet. Élégante à écrire, mauvaise à relire : rien ne distingue à l'œil
-- la ligne qui deviendra l'objet du premier paragraphe du corps, et une ligne
-- vide oubliée suffisait à envoyer un mail dont l'objet était « Bonjour ».
--
-- Deux colonnes de plus, et le formulaire montre ce que le client verra.
-- `null` : l'objet commun s'applique, comme pour les corps.
-- ===========================================================================

alter table billing_engagements
  add column send_subject text,
  add column reminder_subject text;
