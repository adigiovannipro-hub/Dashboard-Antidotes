-- ===========================================================================
-- Les réglages TikTok d'une publication.
--
-- TikTok n'accepte une publication directe que si la personne a **choisi**
-- elle-même, pour ce post : la confidentialité (sans valeur par défaut), les
-- commentaires, duos et collages, la déclaration de contenu commercial — et
-- accepté la « Music Usage Confirmation ». C'est ce que l'audit de l'app
-- vérifie à l'écran. Le choix se fait dans le panneau de la publication et se
-- garde ici, avec le moment de l'accord.
--
-- Une colonne et non une table : ces réglages n'existent que pour la ligne,
-- et la RLS de `planning_subjects` s'applique telle quelle — qui peut écrire
-- la ligne peut régler sa publication TikTok, comme il en écrit le wording.
-- `null` : pas de réglages, la publication part en brouillon.
-- ===========================================================================

alter table planning_subjects add column if not exists tiktok_settings jsonb;
