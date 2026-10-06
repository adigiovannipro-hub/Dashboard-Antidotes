-- ANMF, octobre 2026 : les seize sujets posés le 25/09 ressortent de la
-- corbeille, à côté des seize générés le 30/09 — demande de l'utilisateur.
--
-- Relevé avant écriture (journal `planning_activity`) : ils ont été envoyés
-- à la corbeille le 30/09 à 10:42 UTC par la barre de sélection du tableau
-- (`bulkDeleteSubjects`, une ligne « deleted » par sujet), six minutes avant
-- une génération d'intentions qui, trouvant le mois vide, l'a refait en
-- entier. La génération n'a rien effacé ; c'est le mois vidé qui a tout
-- déclenché. Depuis, le prompt tient l'existant pour intouchable et
-- `production:generer` n'a plus d'option pour vider un mois.
--
-- Identifiants nommés un par un : rien d'autre ne sort de la corbeille.
-- Idempotente — un sujet déjà restauré n'est pas touché.

update planning_subjects s
set deleted_at = null
from workspaces w
where w.id = s.workspace_id
  and w.slug = 'anmf'
  and s.deleted_at is not null
  and s.id in (
    '84ad09b5-061b-45b4-879e-f2a5081e6e1b', -- UNE JOURNÉE AU MOULIN
    '4cead952-f96d-40e2-91eb-2584fd66ef90', -- DEVINE LE MÉTIER
    '52110843-99a4-45ee-beaa-fd122866bf85', -- CE QUE TU IGNORES SUR TA BAGUETTE
    'fd0bba3c-c7d8-44aa-b1c4-4e700de43666', -- LE CHIFFRE DU MOIS
    '09f406ec-0dc7-4681-abcc-10c6e603b54d', -- BOULANGER CONSEIL, LE MÉTIER CACHÉ
    '99164b2f-cd3e-40e4-bf48-964d1c701589', -- POV TU BOSSES DANS UN MOULIN
    '96f87ca8-da53-47c7-be2d-9ebdd8922529', -- QUELLE FORMATION POUR ENTRER DANS LA FILIÈRE
    '3480233a-862f-44c7-a6ab-ab7db87db546', -- POSEZ VOS QUESTIONS SUR LE MÉTIER
    '3f731d32-91b5-40bd-b78c-3f5c4469ddd4', -- VRAI OU FAUX SUR LA MEUNERIE
    'fa9adbbd-076b-4283-a60e-939bb58d68dc', -- DANS LE LABO QUALITÉ
    '11a272cf-4001-40e0-85f3-750908e1ea8d', -- DES ENTREPRISES PLUS PROCHES QU'ON CROIT
    'bff6c951-0a31-4a81-b05b-e7afaf5ef369', -- LA QUESTION QU'ON N'OSE PAS POSER
    'd551a263-ccb8-4e1d-9dfe-e61778f9e1d0', -- MAINTENANCE, LE MÉTIER QUI TIENT TOUT
    '59be19ed-976f-4c55-83fa-5d8cd8f28bc0', -- LES RÉPONSES DU COLLABORATEUR
    'd02cd1a6-97b2-45b4-853e-6acabc80a6da', -- DU GRAIN À LA MIE EN 30 SECONDES
    'fa496f5c-24ab-494b-a788-65e9fd6f6e15'  -- SON PREMIER MOIS EN APPRENTISSAGE
  );
