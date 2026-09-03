-- ===========================================================================
-- Academy — le module « Gérer son activité » revient dans la formation UGC
--
-- Correctif de `20260903c`, qui a perdu ce module en silence.
--
-- Les identifiants du seed sont dérivés d'un SHA-256 de `academy:module:<slug>`
-- et `academy:lesson:<module>/<leçon>` — **sans le cours**. Tant qu'il n'y
-- avait qu'une formation, la clé était unique. À la seconde, le slug
-- `gerer-son-activite` existait des deux côtés : le module de l'UGC est tombé
-- sur l'identifiant de celui du SMM, `on conflict (id) do nothing` l'a jeté
-- sans un mot, et ses cinq leçons se sont accrochées au module du SMM — donc
-- à la mauvaise formation. La leçon `organiser-sa-semaine`, homonyme elle
-- aussi, a été jetée de la même façon.
--
-- `20260903c` est appliquée : elle ne se retouche pas. Ce fichier répare, et
-- pose les nouveaux identifiants **nommés par formation**
-- (`academy:module:<cours>/<slug>`), forme que le générateur impose désormais
-- à toute formation ajoutée après celle-ci.
--
-- Idempotent : les suppressions sont bornées à la formation SMM et aux quatre
-- identifiants connus, les insertions sont en `on conflict do nothing`. Sur
-- une base neuve où le défaut n'a jamais eu lieu, le fichier ne retire rien.
-- ===========================================================================

-- --- Retirer les quatre intruses de la formation « social media manager » ---

delete from academy_lessons l
using academy_courses c
where l.id in (
    'd71ba2db-c3a7-4fec-a7a8-70a966457aa2'::uuid,
    'fa9df65a-9c8e-41c5-8152-8351a3dea72f'::uuid,
    '0d80b647-57f6-4023-92c8-7801e6d43dd6'::uuid,
    '1a55c981-ec31-44a8-8783-6129e006fec9'::uuid
)
  and c.id = l.course_id
  and c.slug = 'devenir-freelance-social-media-manager';

-- --- Rendre à la formation UGC son quatorzième module -----------------------


insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid, c.id, c.org_id, 'gerer-son-activite', $sq$Gérer son activité et durer$sq$, $sq$Ce module ferme la boucle : le cadre administratif minimal pour facturer légalement, le pilotage d'une trésorerie que trois décalages structurels rendent tendue, la semaine en blocs qui fait produire plus en travaillant moins, les quatre causes du burn-out créatif — premier motif d'abandon du métier — et les trois voies pour dépasser le plafond du temps.$sq$, 14, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3acad66b-4aba-4df8-9967-b08ead2cbdb3'::uuid, m.id, m.course_id, m.org_id, 'statut-et-facturation', $sq$Statut, factures, TVA : le minimum légal en France$sq$, $sq$Trente minutes en ligne, gratuit, et le cadre tient sur une page. La micro-entreprise en cinq points, les sept mentions obligatoires d'une facture, la règle de provision qui supprime la seule vraie catastrophe du métier, et ce qui n'est pas nécessaire.$sq$, $sq$## L'accroche

Une créatrice facture sa première mission depuis un compte personnel, sans numéro de SIRET, avec un simple relevé d'identité bancaire. Six mois plus tard, une marque structurée lui demande une facture conforme pour sa comptabilité et découvre qu'elle n'a pas de statut. La collaboration s'arrête là — non par méfiance, mais parce qu'une entreprise ne peut pas comptabiliser une dépense sans facture valide. Le cadre administratif de ce métier tient en une page et se met en place en trente minutes en ligne, gratuitement. Ce n'est ni compliqué ni coûteux ; c'est simplement mal expliqué. Cette leçon donne le strict nécessaire pour facturer légalement en France, et rien de plus.

## Le contenu

### Le statut : micro-entreprise

C'est le statut adapté à la quasi-totalité des créatrices UGC, et il le reste jusqu'à des niveaux de chiffre d'affaires que peu atteignent.

**Ce qu'il faut savoir :**

**La création est gratuite et en ligne**, sur le guichet unique des entreprises. Trente minutes, et le numéro SIRET arrive sous une à quatre semaines.

**L'activité à déclarer** : prestation de services — création de contenu audiovisuel, ou activité de production vidéo. Le code exact importe peu tant que la nature est correcte.

**Les cotisations** : environ 24,6 % du chiffre d'affaires encaissé pour une prestation de services, déclarées et payées mensuellement ou trimestriellement. Rien à payer si tu n'encaisses rien.

**L'impôt** : soit intégré au prélèvement libératoire si tu l'as choisi et que tu y es éligible, soit déclaré avec tes revenus. À trancher avec le simulateur officiel.

**Le seuil de franchise de TVA** : tant que tu es en dessous, tu ne factures pas de TVA et tu ne la récupères pas. C'est le cas de la grande majorité des créatrices. Au-dessus, tu la factures — et tes clients professionnels la récupèrent, donc ça ne change rien pour eux.

### Les mentions obligatoires d'une facture

Sept éléments. Une facture incomplète peut être rejetée par la comptabilité du client, ce qui retarde ton paiement de plusieurs semaines.

1. **Ton identité** : prénom, nom, adresse, numéro SIRET.
2. **L'identité du client** : raison sociale, adresse, numéro de TVA intracommunautaire s'il en a un.
3. **Le numéro de facture**, unique et **sans trou dans la séquence**.
4. **La date d'émission** et la date de la prestation.
5. **Le détail** : nature de la prestation, quantité, prix unitaire, total.
6. **La mention de TVA** : « TVA non applicable, article 293 B du CGI » si tu es en franchise.
7. **Les conditions de règlement** : délai, pénalités de retard, indemnité forfaitaire de recouvrement de 40 €.

La numérotation continue est le point le plus souvent négligé et le premier qu'un contrôle regarde.

### Ce qu'il faut conserver

**Toutes les factures émises**, dix ans.
**Les justificatifs d'achat professionnels** : matériel, logiciels, formation. Ils ne sont pas déductibles en micro-entreprise, mais ils servent si tu changes de statut.
**Les contrats et devis acceptés**, avec les échanges d'email qui valent accord.

Un dossier par année, un sous-dossier par client. Dix minutes de rangement par mois.

### Le compte bancaire

Un compte bancaire **dédié** est obligatoire au-delà d'un certain niveau de chiffre d'affaires deux années de suite, et vivement recommandé dès le début.

Un compte courant séparé suffit ; un compte professionnel n'est pas exigé. L'intérêt principal est pratique : tu vois ton activité sans la mélanger à tes courses.

### La provision, la règle qui sauve

**À chaque encaissement, mets 30 % de côté immédiatement**, sur un compte séparé.

24,6 % de cotisations, plus la marge pour l'impôt. Ce geste, fait le jour du virement, supprime la seule vraie catastrophe administrative du métier : découvrir en fin de trimestre qu'on doit 1 200 € qu'on a dépensés.

### Ce qui n'est pas nécessaire

Un expert-comptable — la micro-entreprise n'a pas de comptabilité à tenir, seulement un livre des recettes.
Une assurance responsabilité civile professionnelle — utile, non obligatoire pour cette activité, et peu coûteuse si tu la veux.
Une société — inutile tant que tu es seule et sous les seuils.
Un logiciel de facturation payant — un modèle de document suffit largement au début.

### Le livre des recettes

La seule obligation comptable : un tableau avec, pour chaque encaissement, la date, le montant, le client, le mode de règlement et le numéro de facture.

Un tableur suffit. Cinq minutes par mois.

## Exemple appliqué

Camille se déclare en janvier.

**Semaine 1.** Création en ligne sur le guichet unique. Activité : prestation de services, création de contenu audiovisuel. Vingt-cinq minutes. Elle opte pour le versement libératoire de l'impôt après avoir vérifié son éligibilité avec le simulateur.

**Semaine 3.** Le SIRET arrive. Elle l'ajoute à son media kit et à son modèle de facture.

**Son organisation :**

Un compte courant séparé, ouvert gratuitement en ligne. Un second compte, sans carte, pour la provision.

Un modèle de facture avec les sept mentions, et une numérotation `2026-001`, `2026-002`.

Un dossier par mois avec les factures émises, un tableur « livre des recettes ».

**Sa routine mensuelle**, quinze minutes le premier lundi :

Elle reporte les encaissements du mois dans le livre des recettes, vérifie que la numérotation n'a pas de trou, déclare son chiffre d'affaires sur le site de l'Urssaf, et vérifie que la provision correspond bien à 30 % des encaissements.

**Sa première déclaration**, en avril : 4 180 € encaissés sur le trimestre, 1 028 € de cotisations. Elle en avait provisionné 1 254 €. Aucune surprise.

**Ce que ça lui a coûté** : trente minutes de création, quinze minutes par mois, et zéro euro.

## Les erreurs fréquentes

Facturer sans statut. Une entreprise ne peut pas comptabiliser une dépense sans facture valide : la collaboration s'arrête là.

Oublier la mention de TVA. C'est la mention manquante la plus fréquente, et elle fait rejeter la facture.

Laisser un trou dans la numérotation. C'est la première chose qu'un contrôle regarde.

Ne pas provisionner. Découvrir en fin de trimestre qu'on doit une somme déjà dépensée est la seule vraie catastrophe du métier.

Mélanger comptes personnel et professionnel. On ne sait plus ce qu'on gagne, et le compte dédié devient obligatoire au bout de deux ans.

Prendre un expert-comptable trop tôt. La micro-entreprise n'a pas de comptabilité à tenir.

Attendre d'avoir des clients pour se déclarer. Le SIRET met une à quatre semaines, et une marque qui attend ne patiente pas.

## Action immédiate

Si tu n'es pas déclarée, fais-le cette semaine : trente minutes en ligne, gratuit. Si tu l'es, vérifie tes trois derniers documents : les sept mentions sont-elles présentes, la numérotation est-elle continue, la provision de 30 % est-elle faite ? Puis ouvre le second compte de provision, et prends l'habitude d'y virer 30 % le jour même de chaque encaissement.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Le cadre administratif minimal","description":"La micro-entreprise en cinq points, les sept mentions de facture à cocher, la règle des 30 %, ce qu'il faut conserver et le tableau de ce qui n'est pas nécessaire.","kind":"document","url":null,"body":"## Le cadre administratif minimal\n\n### La micro-entreprise en cinq points\n\n| Point | Détail |\n|---|---|\n| Création | **Gratuite, en ligne**, guichet unique des entreprises — 30 min |\n| Activité | Prestation de services — création de contenu audiovisuel |\n| Cotisations | ≈ **24,6 %** du CA encaissé, déclaré mensuel ou trimestriel |\n| Impôt | Versement libératoire si éligible, sinon déclaré avec les revenus |\n| TVA | Non applicable sous le seuil de franchise |\n\nLe SIRET arrive sous **une à quatre semaines** : se déclarer avant d'avoir des\nclients, pas après.\n\n### Les sept mentions obligatoires d'une facture\n\n1. [ ] Ton identité : prénom, nom, adresse, **SIRET**\n2. [ ] Identité du client : raison sociale, adresse, TVA intracommunautaire\n3. [ ] Numéro de facture unique, **sans trou dans la séquence**\n4. [ ] Date d'émission **et** date de prestation\n5. [ ] Détail : nature, quantité, prix unitaire, total\n6. [ ] « **TVA non applicable, article 293 B du CGI** » si franchise\n7. [ ] Conditions de règlement : délai, pénalités, indemnité de 40 €\n\nLa **numérotation continue** est le point le plus négligé et le premier qu'un\ncontrôle regarde.\n\n### La règle qui sauve\n\n**À chaque encaissement, vire 30 % sur un compte séparé, le jour même.**\n\n24,6 % de cotisations + la marge d'impôt. Ce compte n'est pas de l'épargne :\nc'est de l'argent qui ne t'appartient pas.\n\n### Ce qu'il faut conserver\n\nToutes les factures émises (10 ans) · les justificatifs d'achat professionnel ·\nles devis acceptés et les emails valant accord. Un dossier par année, un\nsous-dossier par client, dix minutes par mois.\n\n### Ce qui n'est PAS nécessaire\n\n| Idée reçue | Réalité |\n|---|---|\n| Un expert-comptable | La micro n'a qu'un **livre des recettes** à tenir |\n| Un compte professionnel | Un compte courant **dédié** suffit |\n| Une société | Inutile seule et sous les seuils |\n| Un logiciel de facturation payant | Un modèle de document suffit |\n| Une RC pro | Utile, non obligatoire, peu coûteuse |\n\n### La routine mensuelle — quinze minutes\n\nReporter les encaissements au livre des recettes · vérifier la numérotation ·\ndéclarer le CA · vérifier que la provision de 30 % est faite.\n"},{"title":"Guichet unique des entreprises","description":"Le site officiel de création d'entreprise. Trente minutes, gratuit, SIRET sous une à quatre semaines.","kind":"link","url":"https://formalites.entreprises.gouv.fr"},{"title":"Urssaf — simulateurs","description":"Pour convertir un chiffre d'affaires en revenu réellement disponible et vérifier l'éligibilité au versement libératoire.","kind":"tool","url":"https://www.urssaf.fr/accueil/outils-documentation/simulateurs.html"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '64560ba2-2d18-4bd1-b2b3-24aa2c93058b'::uuid, m.id, m.course_id, m.org_id, 'tresorerie', $sq$Se faire payer : trésorerie, décalages, mois creux$sq$, $sq$La trésorerie est ce qui tue les activités rentables. Les trois décalages structurels du métier, les trois habitudes qui les absorbent, le tableau qui fait voir un trou un mois à l'avance et les six leviers quand ça se tend.$sq$, $sq$## L'accroche

Une créatrice à 3 000 € de chiffre d'affaires mensuel peut se retrouver avec 400 € sur son compte un 20 du mois. Ce n'est pas un problème de rentabilité : c'est un problème de **décalage**. Elle a facturé en mars, sera payée en mai, a avancé le temps, le matériel et parfois les produits, et doit payer ses cotisations sur des sommes encaissées deux trimestres plus tôt. La trésorerie est ce qui tue les activités rentables, et elle se pilote avec trois habitudes simples. Cette leçon les donne, avec le tableau qui permet de voir un trou arriver un mois à l'avance plutôt que le jour où il se produit.

## Le contenu

### Les trois décalages du métier

**Le décalage de facturation.** Tu livres le 15, tu factures le 15, tu es payée entre le 30 et le 75e jour selon les clients. Le travail de mars devient de l'argent en avril ou mai.

**Le décalage de cotisations.** Tu déclares le trimestre écoulé et tu paies le mois suivant. Un bon trimestre produit une charge au trimestre suivant, parfois plus creux.

**Le décalage saisonnier.** Août et fin décembre sont creux. Janvier redémarre lentement, les budgets se recalent. Deux mois faibles par an sont normaux.

### Les trois habitudes

**1. L'acompte systématique.** 40 % à la commande. C'est ce qui transforme un métier à trésorerie tendue en métier à trésorerie normale : une partie de l'argent arrive avant le travail, pas deux mois après.

**2. La provision immédiate.** 30 % de chaque encaissement, viré le jour même sur un compte séparé. Ce compte n'est pas de l'épargne, c'est de l'argent qui ne t'appartient pas.

**3. Le matelas.** Trois mois de charges fixes, constitués avant de considérer ce métier comme un revenu principal. Il absorbe les mois creux, un impayé, une panne de matériel.

### Le tableau de trésorerie

Une page, six colonnes, mis à jour une fois par semaine. C'est l'outil qui permet de voir arriver un problème.

| Mois | Encaissements prévus | Encaissements réels | Charges fixes | Cotisations | Solde fin de mois |
|---|---|---|---|---|---|

Les « encaissements prévus » se remplissent depuis tes factures émises et leurs dates d'échéance, plus les acomptes attendus des devis signés.

Regarde trois mois devant. Un solde qui passe sous ton matelas dans deux mois est un signal d'action : relancer un impayé, accélérer une facturation, prospecter davantage.

### Les leviers quand la trésorerie se tend

Dans l'ordre, du moins coûteux au plus coûteux :

**Relancer les impayés.** C'est le premier réflexe, et souvent le seul nécessaire. Applique la procédure des quatre relances.

**Facturer ce qui est livré.** Beaucoup de créatrices ont des livraisons non facturées. Facture le jour même, toujours.

**Proposer une extension de droits** aux clients dont l'échéance approche. C'est du revenu sans production.

**Proposer un abonnement** à un client régulier, avec le premier mois payé d'avance.

**Réduire les délais de paiement** sur les nouveaux devis : 15 jours au lieu de 30.

**Demander un acompte plus élevé** sur les grosses commandes : 50 % au lieu de 40 %.

### Les charges réelles du métier

Elles sont faibles, et c'est un avantage à connaître.

| Poste | Coût annuel indicatif |
|---|---|
| Matériel (amorti sur 3 ans) | 50 à 150 € |
| Abonnements logiciels | 0 à 120 € |
| Hébergement portfolio | 0 à 100 € |
| Frais bancaires | 0 à 120 € |
| Formation | variable |

Une créatrice UGC a des charges fixes inférieures à 500 € par an. C'est ce qui rend le métier accessible, et c'est aussi pourquoi la trésorerie se pilote surtout par les encaissements, pas par les dépenses.

### Les mois creux, anticipés

Août et décembre sont prévisibles. Trois réponses :

**Facturer plus tôt** en juin-juillet et en novembre.
**Proposer des packs pour la rentrée** en juin : beaucoup de marques préfèrent engager avant les congés.
**Utiliser ces mois** pour le portfolio, la prospection et l'administratif — c'est le moment où les décideurs sont absents, mais où le travail de fond se fait.

### Le seuil de sécurité

Ne quitte pas un autre revenu tant que tu n'as pas :

Trois mois consécutifs au-dessus de ton seuil de charges.
Trois mois de charges fixes en trésorerie.
Au moins deux clients récurrents.

Ces trois conditions ensemble, pas une seule.

## Exemple appliqué

Sarah, huit mois d'activité, 2 400 € de chiffre d'affaires mensuel moyen.

**Son problème en mai** : 380 € sur son compte courant le 18, alors qu'elle a facturé 2 900 € en avril.

**Ce que montre son tableau de trésorerie**, qu'elle construit ce jour-là :

- Deux factures de mars, 1 340 €, impayées depuis 22 et 31 jours.
- Une livraison du 6 mai, 640 €, jamais facturée.
- Aucun acompte demandé sur les trois dernières commandes.

**Ce qu'elle fait dans la journée :**

Elle applique la procédure de relance sur les deux impayés : appel téléphonique pour le plus ancien, relance écrite pour l'autre. Le premier est payé en trois jours.

Elle émet la facture oubliée.

Elle ajoute l'acompte de 40 % à son devis type.

**Fin mai** : 2 180 € encaissés. Le problème n'était pas le chiffre d'affaires, c'était l'encaissement.

**Sur les six mois suivants**, avec l'acompte systématique, la facturation le jour de la livraison et la relance à J+1 : son délai moyen d'encaissement passe de 47 à 19 jours, et elle ne repasse jamais sous son matelas.

**Ce que ça a changé** : rien à son chiffre d'affaires, tout à sa tranquillité.

## Les erreurs fréquentes

Travailler sans acompte. C'est la principale cause de tension de trésorerie du métier.

Facturer en fin de mois. Chaque jour de décalage à l'émission est un jour de décalage au paiement.

Ne pas provisionner les cotisations. La somme due arrive toujours au mauvais moment.

Ne pas tenir de tableau de trésorerie. On découvre le trou le jour où il se produit au lieu d'un mois avant.

Confondre chiffre d'affaires et revenu. 3 000 € facturés, c'est environ 2 000 € réellement disponibles.

Ne pas anticiper août et décembre. Ils sont prévisibles ; les subir est un choix.

Quitter un autre revenu sur un bon mois. Trois conditions simultanées, pas une.

## Action immédiate

Construis ton tableau de trésorerie aujourd'hui, à six colonnes, sur trois mois devant. Reporte toutes tes factures émises avec leur date d'échéance. Puis vérifie deux choses : as-tu des livraisons non facturées, et des factures échues non relancées ? Ces deux vérifications règlent la majorité des tensions de trésorerie, et elles prennent vingt minutes.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Piloter sa trésorerie","description":"Les trois décalages, les trois habitudes, le tableau à six colonnes, les six leviers classés par coût, les charges réelles du métier et les trois conditions du seuil de sécurité.","kind":"document","url":null,"body":"## Piloter sa trésorerie\n\n### Les trois décalages du métier\n\n| Décalage | Effet |\n|---|---|\n| Facturation | Le travail de mars devient de l'argent en avril ou mai |\n| Cotisations | Un bon trimestre produit une charge au trimestre suivant |\n| Saison | Août et fin décembre creux, janvier lent |\n\n### Les trois habitudes\n\n1. **Acompte de 40 %** à la commande — l'argent arrive avant le travail\n2. **30 % viré le jour même** de chaque encaissement, compte séparé\n3. **Trois mois de charges fixes** en matelas avant d'en faire un revenu principal\n\n### Le tableau de trésorerie — mis à jour une fois par semaine\n\n| Mois | Encaissements prévus | Réels | Charges fixes | Cotisations | Solde fin de mois |\n|---|---|---|---|---|---|\n|  |  |  |  |  |  |\n\nRegarde **trois mois devant**. Un solde qui passe sous ton matelas dans deux\nmois est un signal d'action, pas une fatalité.\n\n### Les six leviers quand ça se tend — du moins au plus coûteux\n\n1. **Relancer les impayés** (souvent le seul nécessaire)\n2. **Facturer ce qui est livré** et ne l'est pas encore\n3. Proposer une **extension de droits** — revenu sans production\n4. Proposer un **abonnement** avec premier mois d'avance\n5. Réduire les délais de paiement : 15 jours au lieu de 30\n6. Monter l'acompte à 50 % sur les grosses commandes\n\n### Les charges réelles du métier\n\n| Poste | Coût annuel |\n|---|---|\n| Matériel (amorti sur 3 ans) | 50 – 150 € |\n| Abonnements logiciels | 0 – 120 € |\n| Hébergement portfolio | 0 – 100 € |\n| Frais bancaires | 0 – 120 € |\n\n**Moins de 500 € par an.** La trésorerie se pilote par les **encaissements**,\npas par les dépenses.\n\n### Les mois creux, anticipés\n\nFacturer plus tôt en juin-juillet et novembre · proposer des packs de rentrée\ndès juin · utiliser août et décembre pour le portfolio, la prospection et\nl'administratif.\n\n### Le seuil de sécurité — les trois conditions **ensemble**\n\n- [ ] Trois mois consécutifs au-dessus du seuil de charges\n- [ ] Trois mois de charges fixes en trésorerie\n- [ ] Au moins **deux clients récurrents**\n"},{"title":"Tableau de trésorerie","description":"Six colonnes, trois mois devant, mis à jour une fois par semaine. L'outil qui fait voir un problème avant qu'il se produise.","kind":"template","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '39bedca4-fd67-4834-b1c4-de16c1499d94'::uuid, m.id, m.course_id, m.org_id, 'organiser-sa-semaine', $sq$Organiser sa semaine : blocs de tournage et jours d'administratif$sq$, $sq$Une créatrice à temps plein travaille quarante-cinq heures et en facture douze. Le problème n'est pas la charge, c'est la fragmentation. Les quatre activités et leur poids, la semaine en cinq blocs, la règle des lots et les quatre rendez-vous mensuels.$sq$, $sq$## L'accroche

Une créatrice à temps plein travaille en moyenne quarante-cinq heures par semaine et facture l'équivalent de douze. Le reste part dans les allers-retours d'emails éparpillés, les tournages improvisés qui grignotent trois demi-journées, la prospection faite entre deux montages, et les décisions reprises dix fois faute d'être notées. Le problème n'est pas la charge de travail : c'est la fragmentation. Un métier composé de quatre activités très différentes — produire, prospecter, gérer, apprendre — ne se tient pas en passant de l'une à l'autre au fil des notifications. Il se tient en blocs. Cette leçon donne la semaine type, la règle des lots, et ce qui doit disparaître du quotidien.

## Le contenu

### Les quatre activités, et leur poids réel

**Produire** — tournage, montage, livraison. C'est la seule qui se facture, et elle doit occuper 50 à 60 % du temps.

**Prospecter** — messages, relances, propositions. 20 %, et elle ne s'arrête jamais, même les mois pleins.

**Gérer** — devis, factures, relances de paiement, échanges clients, administratif. 15 %.

**Apprendre et créer** — regarder ce qui marche, tester des formats, refaire son portfolio. 10 %, et c'est celle qu'on sacrifie en premier alors qu'elle détermine le niveau de prix.

Si la production dépasse 70 %, la prospection s'arrête et le mois suivant sera vide. C'est le cycle de l'accordéon, et il est la cause principale des abandons au sixième mois.

### La semaine type

**Lundi matin — bloc gestion.** La revue du pipeline, les devis à envoyer, les factures à émettre, les relances de paiement. Deux heures, et le reste de la semaine est libéré.

**Lundi après-midi et mardi — bloc prospection.** Vingt messages, cinq LinkedIn, les relances. Trois heures, en deux sessions.

**Mercredi — bloc tournage.** Une session de trois à quatre heures. Toujours le même jour : le décor est prêt, la lumière est connue, l'habitude fait le reste.

**Jeudi et vendredi matin — bloc montage.** Deux sessions de deux heures, deux à trois vidéos chacune.

**Vendredi après-midi — bloc apprentissage.** Regarder les créas qui tournent, tester un format, mettre à jour le portfolio, lire les performances reçues.

Total : environ vingt-cinq heures de travail structuré. Le reste de la semaine absorbe les imprévus, qui existeront de toute façon.

### La règle des lots

Elle vaut pour les quatre activités, pas seulement le tournage.

**Tourner en lots** : six vidéos en une session au lieu de six sessions.
**Monter en lots** : deux à trois vidéos par session, jamais une.
**Prospecter en lots** : vingt messages d'affilée, recherche des noms d'abord, écriture ensuite.
**Facturer en lots** : toutes les factures du lundi matin.

Le gain vient du **coût de démarrage** : chaque activité demande dix à vingt minutes pour s'y remettre. Cinq démarrages évités par semaine, c'est plus d'une heure.

### Ce qui doit disparaître

**Les notifications.** Le téléphone en mode concentration pendant les blocs. Un message client ne demande jamais une réponse en moins de deux heures.

**Les emails en continu.** Deux relèves par jour, matin et fin d'après-midi. C'est suffisant pour tous les clients du métier.

**Les appels non planifiés.** Propose un créneau. Un appel imprévu coûte l'heure qu'il dure plus vingt minutes de remise en route.

**Les décisions reprises.** Ton univers visuel, ta grille tarifaire, ton plancher, ton modèle de devis : décidés une fois, écrits, appliqués. Redécider chaque semaine coûte plus que de mal décider une fois.

### Le rythme mensuel

Quatre rendez-vous avec toi-même, une heure chacun.

**Premier lundi** : déclaration Urssaf, livre des recettes, vérification de la provision.
**Deuxième lundi** : revue des clients — qui relancer, à qui proposer un abonnement, quelles échéances de droits arrivent.
**Troisième lundi** : mise à jour du portfolio, remplacement de la vidéo la plus faible.
**Quatrième lundi** : bilan du mois — chiffre d'affaires, taux de réponse, taux d'acceptation, temps par vidéo.

Ce dernier rendez-vous est celui qui manque à presque tout le monde, et c'est celui qui permet de corriger avant que ça ne se voie.

### Le travail à temps partiel

Si tu exerces à côté d'un autre revenu, la structure reste la même, comprimée :

Un bloc tournage le samedi matin. Deux blocs montage en soirée. Un bloc prospection le mardi soir. Un bloc gestion le dimanche matin.

Douze à quinze heures par semaine suffisent à produire six à huit vidéos par mois — soit 1 200 à 2 000 € selon les tarifs.

## Exemple appliqué

Inès travaille à temps plein depuis six mois et se sent débordée sans savoir pourquoi. Elle note son temps pendant deux semaines.

**Ce qu'elle découvre :**

- 6 h par semaine en emails éparpillés, en douze relèves quotidiennes.
- 4 h en tournages fractionnés — trois demi-journées pour cinq vidéos.
- 3 h en « recherche d'inspiration » sans objectif.
- 2 h en décisions reprises : quel prix pour cette mission, quel décor, quel format.
- Prospection : 45 minutes. Sur deux semaines.

**Ce qu'elle change :**

Deux relèves d'email par jour. Un seul jour de tournage, le mercredi. Une grille tarifaire écrite et affichée, pour ne plus redécider. Les blocs posés dans l'agenda comme des rendez-vous.

**Six semaines plus tard :**

- Temps de travail : 42 h → 29 h par semaine.
- Vidéos produites : 6 → 9 par mois.
- Prospection : 45 min → 3 h par semaine.
- Chiffre d'affaires : 1 900 € → 2 700 €.

**Ce qu'elle en dit** : « je ne travaille pas plus vite, je travaille moins souvent sur chaque chose. »

C'est exactement le mécanisme : le gain ne vient pas de la vitesse d'exécution, il vient de la suppression des démarrages.

## Les erreurs fréquentes

Travailler au fil des messages. La fragmentation coûte plus que n'importe quelle lenteur d'exécution.

Arrêter de prospecter les mois chargés. C'est le cycle de l'accordéon, et il produit un mois vide sur deux.

Tourner au fil de l'eau. Six sessions au lieu d'une multiplient le temps par trois.

Relever ses emails douze fois par jour. Deux relèves suffisent pour tous les clients du métier.

Redécider ce qui est déjà décidé. Grille, plancher, univers, modèle de devis : écrits une fois.

Sacrifier le bloc apprentissage. C'est celui qui détermine ton niveau de prix dans un an.

Ne pas faire de bilan mensuel. On corrige au hasard, et souvent trop tard.

## Action immédiate

Pose les cinq blocs de la semaine type dans ton agenda, comme des rendez-vous fixes, pour les quatre prochaines semaines. Puis note ton temps pendant cinq jours, par tranches de trente minutes, sans rien changer. Compare les deux : l'écart entre ce que tu crois faire et ce que tu fais est presque toujours saisissant, et c'est lui qui indique quoi corriger en premier.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"La semaine type","description":"Le tableau des quatre activités et de leur poids, la semaine en cinq blocs, la règle des lots, ce qui doit disparaître et les quatre rendez-vous mensuels dont le bilan.","kind":"document","url":null,"body":"## La semaine type\n\n### Les quatre activités et leur poids\n\n| Activité | Part du temps | Ce qui arrive si on la sacrifie |\n|---|---|---|\n| **Produire** | 50 – 60 % | — la seule qui se facture |\n| **Prospecter** | 20 % | Le mois suivant est vide |\n| **Gérer** | 15 % | Impayés et administratif en retard |\n| **Apprendre et créer** | 10 % | Le niveau de prix stagne |\n\n**Production > 70 % = le cycle de l'accordéon**, cause principale des abandons\nau sixième mois.\n\n### La semaine\n\n| Quand | Bloc | Durée |\n|---|---|---|\n| Lundi matin | **Gestion** — pipeline, devis, factures, relances | 2 h |\n| Lundi ap.-midi + mardi | **Prospection** — 20 messages, LinkedIn, relances | 3 h |\n| **Mercredi** | **Tournage** — une session, toujours le même jour | 3 – 4 h |\n| Jeudi + vendredi matin | **Montage** — 2 sessions de 2 h | 4 h |\n| Vendredi ap.-midi | **Apprentissage** — veille, tests, portfolio | 2 h |\n\n≈ 25 h structurées. Le reste absorbe les imprévus, qui existeront de toute façon.\n\n### La règle des lots — pour les quatre activités\n\nChaque activité demande **10 à 20 minutes** pour s'y remettre.\nCinq démarrages évités par semaine = plus d'une heure gagnée.\n\nTourner 6 vidéos en une session · monter 2-3 par session · prospecter 20\nmessages d'affilée · facturer tout le lundi matin.\n\n### Ce qui doit disparaître\n\n| À supprimer | Remplacé par |\n|---|---|\n| Les notifications pendant les blocs | Mode concentration |\n| Les emails en continu | **Deux relèves par jour** |\n| Les appels non planifiés | Proposer un créneau |\n| Les décisions reprises | Grille, plancher, univers **écrits une fois** |\n\n### Le rythme mensuel — quatre rendez-vous d'une heure\n\n| Lundi | Objet |\n|---|---|\n| 1er | Déclaration Urssaf, livre des recettes, provision |\n| 2e | Revue clients : relances, abonnements, échéances de droits |\n| 3e | Portfolio : remplacer la vidéo la plus faible |\n| 4e | **Bilan** : CA, taux de réponse, taux d'acceptation, temps par vidéo |\n\nLe quatrième manque à presque tout le monde, et c'est celui qui permet de\ncorriger **avant** que ça se voie.\n\n### À temps partiel — 12 à 15 h par semaine\n\nTournage le samedi matin · deux montages en soirée · prospection le mardi\nsoir · gestion le dimanche matin. **6 à 8 vidéos par mois.**\n"},{"title":"Checklist du bilan mensuel","description":"Chiffre d'affaires, taux de réponse, taux d'acceptation, temps par vidéo. Le rendez-vous qui manque à presque tout le monde.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '174d758a-9cd5-4944-ba84-98102c25d846'::uuid, m.id, m.course_id, m.org_id, 'tenir-dans-la-duree', $sq$Le burn-out créatif : rythme tenable, stock d'idées$sq$, $sq$Le premier motif d'abandon après le sixième mois n'est pas le manque de clients. Les quatre causes de l'épuisement, le stock d'idées qui supprime définitivement la page blanche, les trois règles de rythme et les quatre signaux à reconnaître.$sq$, $sq$## L'accroche

Au huitième mois, une créatrice qui livre bien, facture correctement et a trois clients réguliers se réveille un matin sans aucune idée. Elle regarde le brief, elle sait exactement quoi faire, et elle n'arrive pas à commencer. Ce n'est pas de la paresse et ce n'est pas un manque de talent : c'est l'épuisement d'un métier qui demande de se mettre en scène, de convaincre, de recommencer, et de le faire seule. Le burn-out créatif est le premier motif d'abandon après le sixième mois — devant le manque de clients. Il n'est pas une fatalité : il vient de quatre causes identifiables, et chacune a un remède concret. Cette leçon les donne.

## Le contenu

### Les quatre causes

**1. Le vide d'idées.** Écrire un script demande une idée neuve à chaque fois. Sans réserve, chaque commande devient une page blanche.

**2. L'exposition permanente.** Se filmer, se regarder, se juger. Une créatrice se voit à l'écran plusieurs heures par semaine, ce qui est une charge mentale réelle et rarement nommée.

**3. L'isolement.** Le métier se fait seule, chez soi, sans collègues, sans retours autres que ceux des clients — qui portent sur le livrable, jamais sur la personne.

**4. L'absence de frontière.** Le lieu de tournage est le logement, l'outil de travail est le téléphone personnel, et les messages arrivent le dimanche.

### Le stock d'idées

Le remède au vide, et le plus simple à mettre en place.

**Une note unique**, dans le téléphone, où tu écris chaque idée qui passe : une accroche entendue, une objection lue dans un avis, une situation vécue, un format repéré.

Une ligne suffit : « hook — le tiroir des câbles ». « angle — les gens n'osent pas demander le prix ». « format — comparer trois produits en 20 s ».

Trois entrées par semaine, sans effort. Au bout de deux mois, la note contient vingt-cinq idées, et la page blanche disparaît définitivement.

C'est l'habitude la plus rentable de ce module, et elle coûte dix secondes par entrée.

### La banque de plans

Le pendant visuel du stock d'idées. Quand tu tournes, filme systématiquement quelques plans **sans destination** : une texture, une lumière, une ambiance, un geste.

Range-les dans un dossier. Le jour où un montage manque de matière, tu piocheras dedans — et le jour où tu n'as pas l'énergie de tourner, tu pourras monter quelque chose quand même.

### Le rythme tenable

Trois règles, chiffrées.

**Quatre heures de tournage par jour maximum.** Au-delà, la qualité baisse plus vite que le volume n'augmente, et la fatigue vocale s'entend.

**Un jour sans écran par semaine.** Complet. Pas de montage, pas de messages, pas de veille.

**Deux semaines de coupure par an**, dont une en août. Prévues, annoncées aux clients un mois avant, avec la date de retour.

Ces trois règles ne réduisent pas la production annuelle : elles la maintiennent, là où un rythme non régulé produit trois mois pleins puis un mois vide.

### La frontière

Trois gestes concrets.

**Une plage horaire de réponse**, annoncée dans ta signature : « je réponds du lundi au vendredi, entre 9 h et 18 h ». Aucun client du métier n'a besoin d'une réponse le dimanche, et l'annoncer supprime la culpabilité.

**Un coin de tournage rangé après chaque session.** Un décor de tournage visible en permanence dans un salon entretient le sentiment de ne jamais quitter le travail.

**Un second appareil ou un mode dédié.** Si le téléphone de tournage est le téléphone personnel, les notifications entrent pendant les prises et le travail entre pendant le repos.

### Rompre l'isolement

Le point le plus sous-estimé.

**Cinq créatrices** avec qui échanger — les mêmes que celles du réseau de recommandation. Un message par semaine suffit à ne plus être seule face aux refus et aux doutes.

**Un groupe ou une communauté** de créateurs, pour voir que les difficultés sont partagées.

**Un retour non client.** Fais regarder une vidéo par quelqu'un qui ne t'achète rien. Le regard extérieur, sans enjeu commercial, remet les choses à leur place.

### Reconnaître les signaux

Quatre signes qui précèdent l'épuisement, dans l'ordre d'apparition :

**Repousser le tournage** sans raison identifiable.
**Multiplier les prises** au-delà de l'habitude, sans jamais être satisfaite.
**Éviter d'ouvrir les messages** clients.
**Ne plus supporter de se voir** à l'image.

Le troisième est le plus révélateur, et le plus dangereux : c'est celui qui casse la délivrabilité, donc la relation client.

Devant deux de ces signaux : réduis le volume d'un tiers pendant deux semaines, prends deux jours sans écran, et écris à une autre créatrice. Ce n'est pas un abandon, c'est de l'entretien.

## Exemple appliqué

Claire, dix mois d'activité, 2 800 € par mois, quatre clients.

**En octobre**, elle repousse trois tournages en deux semaines et fait dix-huit prises sur une vidéo de trente secondes. Elle n'ouvre plus les emails le matin.

**Ce qu'elle met en place :**

Le stock d'idées : elle ouvre une note et y verse tout ce qui lui passe par la tête. En dix jours, trente-deux lignes.

Le volume : elle décale une commande d'une semaine — le client accepte sans commentaire — et passe de neuf à six vidéos ce mois-là.

La frontière : elle ajoute la plage horaire à sa signature et range son coin de tournage après chaque session.

L'isolement : elle écrit à trois créatrices rencontrées dans un groupe. Deux répondent, et toutes deux décrivent exactement la même phase au même moment de leur activité.

Deux jours sans écran, un week-end.

**Trois semaines plus tard** : les tournages repartent, les prises redescendent à quatre par vidéo, et elle remonte à neuf vidéos en décembre.

**Ce qui a le plus compté**, selon elle : découvrir que deux autres créatrices avaient vécu la même chose au même stade. L'isolement transformait une phase normale en preuve d'incompétence.

## Les erreurs fréquentes

Attendre le vide pour chercher des idées. Le stock se constitue en continu, dix secondes à la fois.

Tourner plus de quatre heures par jour. La qualité baisse plus vite que le volume n'augmente.

Ne jamais couper. Deux semaines par an, dont une en août, maintiennent la production annuelle plutôt qu'elles ne la réduisent.

Répondre le dimanche. Aucun client du métier n'en a besoin, et l'habitude devient une attente.

Laisser le coin de tournage installé en permanence. Le travail ne quitte jamais la pièce.

Rester seule. C'est ce qui transforme une phase normale en doute sur sa légitimité.

Ignorer les signaux. Deux d'entre eux ensemble demandent une action, pas de la volonté.

## Action immédiate

Ouvre une note dans ton téléphone, appelle-la « idées », et écris-y trois lignes maintenant : une accroche, un angle, un format. Puis ajoute ta plage horaire de réponse à ta signature d'email. Enfin, écris à une créatrice — une seule — pour lui demander comment elle s'organise. Ces trois gestes prennent quinze minutes et suppriment les trois causes les plus fréquentes d'abandon.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Tenir dans la durée","description":"Le tableau des quatre causes et de leurs remèdes, le stock d'idées, la banque de plans, les trois règles de rythme chiffrées et les quatre signaux dans leur ordre d'apparition.","kind":"document","url":null,"body":"## Tenir dans la durée\n\nLe burn-out créatif est le **premier motif d'abandon après le sixième mois**,\ndevant le manque de clients.\n\n### Les quatre causes et leurs remèdes\n\n| Cause | Remède |\n|---|---|\n| Le vide d'idées | **Le stock d'idées** — une note, trois lignes par semaine |\n| L'exposition permanente | Rythme régulé, jour sans écran |\n| L'isolement | Cinq créatrices, un groupe, un retour non client |\n| L'absence de frontière | Plage horaire annoncée, coin rangé, appareil dédié |\n\n### Le stock d'idées — l'habitude la plus rentable du module\n\nUne note unique dans le téléphone. **Une ligne suffit** :\n\n> hook — le tiroir des câbles\n> angle — les gens n'osent pas demander le prix\n> format — comparer trois produits en 20 s\n\nTrois entrées par semaine, dix secondes chacune. Au bout de deux mois :\nvingt-cinq idées, et **la page blanche disparaît définitivement**.\n\n### La banque de plans\n\nFilme systématiquement quelques plans **sans destination** : une texture, une\nlumière, une ambiance, un geste. Le jour où un montage manque de matière — ou\noù tu n'as pas l'énergie de tourner — tu piocheras dedans.\n\n### Le rythme tenable — trois règles chiffrées\n\n1. **Quatre heures de tournage par jour maximum**\n2. **Un jour sans écran par semaine** — complet\n3. **Deux semaines de coupure par an**, dont une en août, annoncées un mois avant\n\nElles ne réduisent pas la production annuelle : elles la **maintiennent**, là\noù un rythme non régulé produit trois mois pleins puis un mois vide.\n\n### La frontière — trois gestes\n\nUne **plage horaire dans la signature** (« je réponds du lundi au vendredi,\n9 h – 18 h ») · le **coin rangé** après chaque session · un **appareil ou un\nmode dédié** au tournage.\n\n### Les quatre signaux, dans l'ordre d'apparition\n\n1. Repousser le tournage sans raison identifiable\n2. Multiplier les prises sans jamais être satisfaite\n3. **Éviter d'ouvrir les messages clients** ← le plus dangereux : il casse la délivrabilité\n4. Ne plus supporter de se voir à l'image\n\n**Devant deux signaux** : réduire le volume d'un tiers pendant deux semaines,\ndeux jours sans écran, et écrire à une autre créatrice.\nCe n'est pas un abandon, c'est de l'entretien.\n"},{"title":"Checklist des signaux","description":"Repousser le tournage, multiplier les prises, éviter les messages clients, ne plus supporter de se voir. Deux signaux ensemble demandent une action, pas de la volonté.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'db1615a2-3731-43df-a5c1-88f3e240e78b'::uuid, m.id, m.course_id, m.org_id, 'de-creatrice-a-studio', $sq$De créatrice à studio : déléguer, recruter, ou monter en gamme$sq$, $sq$Au bout de dix-huit mois vient un plafond arithmétique : le temps. Trois voies pour le dépasser, avec leurs chiffres et leurs contreparties, les trois questions honnêtes qui tranchent, et les cinq compétences qui font monter les prix.$sq$, $sq$## L'accroche

Au bout de dix-huit mois, une créatrice qui a bien travaillé se retrouve devant un plafond arithmétique : son temps. À douze vidéos par semaine et 280 € l'unité, elle atteint environ 13 000 € par mois en théorie — et en pratique bien moins, parce que personne ne tient ce rythme. Trois voies existent pour dépasser ce plafond, et elles n'ont ni le même coût, ni le même risque, ni la même vie quotidienne. Monter en gamme, déléguer, ou devenir un studio. Beaucoup choisissent la troisième par défaut, sans avoir mesuré ce qu'elle demande. Cette leçon décrit les trois honnêtement, avec leurs chiffres et leurs contreparties.

## Le contenu

### Voie 1 — Monter en gamme

Rester seule, produire moins, facturer plus.

**Comment** : se spécialiser dans une niche technique ou exigeante, documenter ses résultats, viser des marques structurées et des agences, ajouter des compétences rares — une langue étrangère, un secteur réglementé, un savoir-faire particulier.

**Les chiffres** : passer de 250 € à 450-600 € la vidéo est réaliste en deux ans avec une spécialisation réelle. À six vidéos par semaine, cela représente 10 000 à 14 000 € par mois pour un rythme tenable.

**Ce que ça demande** : de la patience, de la constance, et d'accepter de refuser beaucoup.

**Ce que ça préserve** : la simplicité, l'absence de gestion humaine, la liberté totale d'organisation.

C'est la voie la plus sûre, et celle que la majorité devrait choisir.

### Voie 2 — Déléguer le montage

Rester la créatrice, sous-traiter la partie non créative.

**Comment** : trouver un monteur ou une monteuse, lui transmettre un modèle précis — le squelette en sept étapes, la charte de sous-titres, la convention de nommage — et lui confier le montage de tes rushes.

**Les chiffres** : un montage UGC se sous-traite entre 25 et 60 € selon la complexité. Sur une vidéo à 280 €, cela laisse une marge confortable et libère une à trois heures.

**Ce que ça libère** : environ 40 % de ton temps de production, à réinvestir en tournage ou en prospection.

**Ce que ça demande** : un modèle de montage écrit, une phase de rodage de quatre à six vidéos, et un contrôle qualité systématique — c'est toi qui livres, donc c'est ta responsabilité.

**Le piège** : déléguer sans modèle. Un monteur sans consignes précises produit des vidéos qui ne te ressemblent pas, et tu passeras plus de temps à corriger qu'à monter.

C'est la voie la plus rentable à court terme, et celle qui demande le moins d'engagement.

### Voie 3 — Devenir un studio

Piloter d'autres créatrices, vendre du volume aux marques et aux agences.

**Comment** : recruter deux à cinq créatrices dans des profils complémentaires — âges, univers, secteurs —, prendre les commandes, briefer, contrôler, livrer.

**Les chiffres** : une marge de 30 à 40 % sur le travail des créatrices est le standard. Cinq créatrices produisant chacune huit vidéos par mois, à 250 € facturés et 160 € reversés, représentent environ 3 600 € de marge mensuelle — pour un travail de coordination, pas de production.

**Ce que ça demande** : du volume commercial avant tout. Un studio sans commandes régulières est un problème, pas une opportunité. Il faut au minimum deux clients en abonnement et une agence avant de recruter quiconque.

**Ce que ça change dans ta vie** : tu ne tournes presque plus. Ton métier devient commercial et managérial. Beaucoup découvrent à ce moment-là qu'elles aimaient tourner.

**Le piège** : recruter avant d'avoir le volume. C'est l'erreur classique, et elle met en difficulté à la fois la structure et les créatrices recrutées.

### Comment choisir

Trois questions honnêtes.

**Est-ce que j'aime tourner ?** Si oui, la voie 3 te rendra malheureuse quel que soit son rendement.

**Est-ce que j'aime vendre et coordonner ?** Si non, la voie 3 est disqualifiée.

**Est-ce que mon problème est le temps ou le prix ?** Si c'est le prix, monte en gamme. Si c'est le temps et que tes prix sont bons, délègue.

La combinaison la plus fréquente chez celles qui durent : **monter en gamme, puis déléguer le montage**. La voie 3 reste minoritaire, et c'est normal.

### Les compétences qui font monter les prix

Cinq, par ordre de rendement :

**Un secteur technique** — santé, finance, B2B, logiciel. Peu de créatrices, budgets élevés, contraintes réglementaires qui font barrière.

**Une langue** — l'anglais ouvre les marques internationales, qui paient nettement plus.

**Le scénario et la stratégie** — proposer des angles argumentés plutôt qu'exécuter un brief.

**La lecture des performances** — vendre un résultat documenté.

**La régularité prouvée** — cinquante livraisons sans retard valent plus que n'importe quelle compétence technique.

### Le calendrier réaliste

**Mois 0 à 6** : construire. Portfolio, premiers clients, tarifs de départ.
**Mois 6 à 12** : stabiliser. Abonnements, tarifs à +50 %, capacité maîtrisée.
**Mois 12 à 24** : monter en gamme. Spécialisation, tarifs doublés, agences.
**Au-delà** : choisir. Déléguer, ou rester seule à un tarif élevé.

Rien dans ce calendrier ne demande de la chance. Tout demande de tenir les six premiers mois.

## Exemple appliqué

Manon, vingt mois d'activité, 3 400 € par mois, dix vidéos, quarante heures par semaine. Elle est au plafond.

**Ce qu'elle mesure** : 18 h de tournage, 14 h de montage, 5 h de prospection, 3 h de gestion.

**Sa décision** : déléguer le montage. Le montage est la partie qu'elle aime le moins, et c'est 35 % de son temps.

**Ce qu'elle fait :**

Elle écrit un modèle de montage de deux pages : squelette en sept étapes, charte de sous-titres, convention de nommage, exemples de trois vidéos livrées.

Elle teste deux monteurs sur une vidéo chacun, à 45 €. Le second correspond.

Rodage sur cinq vidéos, avec des retours précis à chaque fois.

**Au bout de six semaines** : elle livre les rushes le mercredi soir, reçoit les montages le vendredi, contrôle et livre le lundi.

**Ses nouveaux chiffres** : 14 vidéos par mois au lieu de 10, coût de montage 630 €, chiffre d'affaires 3 920 €, marge 3 290 € — et **28 heures** par semaine au lieu de 40.

**Six mois plus tard**, elle utilise le temps libéré pour démarcher des agences, décroche deux abonnements supplémentaires, et passe à 5 200 € mensuels avec deux monteurs.

**Ce qu'elle n'a pas fait** : recruter des créatrices. Elle aime tourner, et elle a construit sa croissance sur ce qu'elle voulait garder.

## Les erreurs fréquentes

Choisir la voie studio par défaut. C'est un métier commercial et managérial, pas une extension du métier de créatrice.

Recruter avant d'avoir le volume. Il faut deux abonnements et une agence avant d'engager qui que ce soit.

Déléguer sans modèle écrit. Tu passeras plus de temps à corriger qu'à monter.

Déléguer sans contrôler. C'est toi qui livres, donc c'est ta responsabilité.

Monter en gamme sans se spécialiser. Un prix plus élevé sans différence justifiable ne tient pas.

Attendre le plafond pour y réfléchir. Les compétences qui font monter les prix se construisent sur douze à vingt-quatre mois.

Croire qu'il faut grandir. Une créatrice seule à 600 € la vidéo, six vidéos par semaine, gagne mieux sa vie que beaucoup de studios.

## Action immédiate

Réponds aux trois questions par écrit : est-ce que j'aime tourner, est-ce que j'aime vendre et coordonner, est-ce que mon problème est le temps ou le prix. Puis choisis une seule compétence à construire dans les six prochains mois parmi les cinq listées. Note-la dans ton agenda avec une échéance. C'est cette décision, prise consciemment plutôt que subie, qui distingue une créatrice qui dure d'une créatrice qui plafonne.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Les trois voies après le plafond","description":"Les trois voies détaillées avec leurs chiffres, prérequis et pièges, les trois questions qui tranchent, les cinq compétences qui font monter les prix et le calendrier réaliste sur deux ans.","kind":"document","url":null,"body":"## Les trois voies après le plafond\n\n### Voie 1 — Monter en gamme (rester seule, facturer plus)\n\n| | |\n|---|---|\n| Comment | Spécialisation, résultats documentés, agences et marques structurées |\n| Chiffres | 250 € → **450-600 €** la vidéo en deux ans |\n| À 6 vidéos/semaine | 10 000 à 14 000 € / mois, rythme tenable |\n| Demande | Patience, constance, **beaucoup de refus** |\n| Préserve | Simplicité, zéro gestion humaine, liberté totale |\n\n**La voie la plus sûre, et celle que la majorité devrait choisir.**\n\n### Voie 2 — Déléguer le montage\n\n| | |\n|---|---|\n| Comment | Un monteur + **un modèle écrit** (squelette, charte sous-titres, nommage) |\n| Coût | 25 à 60 € par montage |\n| Libère | ≈ 40 % du temps de production |\n| Demande | Un rodage de 4 à 6 vidéos, un **contrôle qualité systématique** |\n| Piège | Déléguer **sans modèle** — tu corrigeras plus que tu ne montais |\n\n**La plus rentable à court terme, la moins engageante.**\n\n### Voie 3 — Devenir un studio\n\n| | |\n|---|---|\n| Comment | 2 à 5 créatrices de profils complémentaires ; tu prends, briefes, contrôles, livres |\n| Marge | 30 à 40 % du travail des créatrices |\n| Exemple | 5 créatrices × 8 vidéos, 250 € facturés / 160 € reversés ≈ **3 600 € de marge** |\n| Prérequis | **Deux abonnements + une agence avant de recruter qui que ce soit** |\n| Change | Tu ne tournes presque plus. Métier commercial et managérial |\n| Piège | Recruter avant d'avoir le volume |\n\n### Les trois questions honnêtes\n\n1. **Est-ce que j'aime tourner ?** Si oui, la voie 3 te rendra malheureuse.\n2. **Est-ce que j'aime vendre et coordonner ?** Si non, voie 3 disqualifiée.\n3. **Mon problème est le temps ou le prix ?** Le prix → monte en gamme.\n   Le temps, avec de bons prix → délègue.\n\nLa combinaison la plus fréquente chez celles qui durent : **monter en gamme,\npuis déléguer le montage**.\n\n### Les cinq compétences qui font monter les prix\n\n1. **Un secteur technique** — santé, finance, B2B, logiciel\n2. **Une langue** — l'anglais ouvre les marques internationales\n3. **Le scénario et la stratégie** — proposer des angles, pas exécuter un brief\n4. **La lecture des performances** — vendre un résultat documenté\n5. **La régularité prouvée** — cinquante livraisons sans retard\n\n### Le calendrier réaliste\n\n| Période | Objectif |\n|---|---|\n| Mois 0 – 6 | Construire : portfolio, premiers clients, tarifs de départ |\n| Mois 6 – 12 | Stabiliser : abonnements, tarifs +50 %, capacité maîtrisée |\n| Mois 12 – 24 | Monter en gamme : spécialisation, tarifs doublés, agences |\n| Au-delà | Choisir : déléguer, ou rester seule à tarif élevé |\n\n**Rien n'y demande de la chance. Tout demande de tenir les six premiers mois.**\n"},{"title":"Checklist avant de déléguer","description":"Un modèle de montage écrit, deux monteurs testés sur une vidéo, un rodage de cinq vidéos, un contrôle qualité systématique — c'est toi qui livres.","kind":"checklist","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = 'bba8ebbf-0904-420c-9a26-23fb1da71ace'::uuid
on conflict (id) do nothing;
