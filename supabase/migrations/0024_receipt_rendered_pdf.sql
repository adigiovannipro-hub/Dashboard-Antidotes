-- ===========================================================================
-- Le mail rendu en PDF fidèle, conservé jusqu'au transfert
--
-- Le rendu HTML vers PDF demande un navigateur. Il n'y en a pas là où le
-- transfert est déclenché — la validation manuelle est une Server Action, elle
-- s'exécute chez l'hébergeur — mais il y en a un là où les mails sont lus, sur
-- le runner de la synchronisation. Le PDF est donc rendu à la lecture du mail
-- et rangé ici ; la validation, plus tard et ailleurs, n'a plus qu'à le
-- joindre.
--
-- La colonne `receipt_documents.pdf_storage_path` existait déjà, prévue par
-- `0010` et restée vide faute de rendu qui aboutisse. Seul le bucket manquait.
--
-- Bucket privé, comme celui des justificatifs : un reçu porte un nom, une
-- adresse de livraison et un numéro de carte tronqué. L'accès passe par la clé
-- de service — aucune politique `storage.objects` n'est ouverte, et cette
-- absence est la politique.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('receipt-pdfs', 'receipt-pdfs', false, 10485760)
on conflict (id) do nothing;
