-- ===========================================================================
-- « Programmé » devient le statut qui publie (7/10/2026).
--
-- « Validé » est désormais l'accord du client, et rien de plus : c'est
-- l'agence qui arme la publication de 16h00 en passant la ligne en
-- « Programmé ». Les publications d'ANMF déjà validées et à venir — les
-- reels des 9, 16, 23 et 28 octobre et le carrousel du 14 — sont passées en
-- « Programmé » à la demande de l'utilisateur, pour qu'aucune ne perde sa
-- publication au changement de règle.
--
-- Les stories restent « Validé » : elles se publient à la main. Seul ANMF a
-- des lignes validées au 7/10 ; les autres espaces ne sont pas touchés. Le
-- geste s'écrit au journal de chaque sujet, au nom de la plateforme.
-- ===========================================================================

with programmees as (
  update planning_subjects s
     set status = 'scheduled',
         updated_at = now()
    from workspaces w
   where w.id = s.workspace_id
     and w.slug = 'anmf'
     and s.status = 'validated'
     and s.format <> 'story'
     and s.scheduled_on >= current_date
     and s.deleted_at is null
     and s.archived_at is null
  returning s.id, s.workspace_id
)
insert into planning_activity (subject_id, workspace_id, actor_id, field, before, after)
select id, workspace_id, null, 'status', 'validated', 'scheduled'
  from programmees;
