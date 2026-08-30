-- ===========================================================================
-- Antidotes Academy — contenu de la formation
--
-- GÉNÉRÉ par `pnpm generate:academy-seed` depuis `scripts/data/academy/` —
-- ne pas éditer à la main : corriger le fichier de contenu et régénérer
-- (tant que la migration n'est pas appliquée ; ensuite, le back-office
-- `/academy/admin` est l'éditeur).
--
-- 13 modules, 54 leçons, tout publié. Identifiants stables
-- (SHA-256 du chemin) et `on conflict do nothing` : rejouer n'écrase jamais
-- une retouche faite depuis le back-office. Le cours se rattache à la
-- première organisation — la base n'en porte qu'une ; une base vierge sans
-- organisation n'insère rien, sans erreur.
--
-- Les littéraux d'un `insert ... select` ne sont pas convertis vers un enum
-- comme ceux d'un `insert ... values` : le cast `::academy_video_provider`
-- est explicite, c'est le piège documenté du CLAUDE.md.
-- ===========================================================================

insert into academy_courses (id, org_id, slug, title, description, order_index, published)
select 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid, o.id, 'devenir-freelance-social-media-manager', $sq$Antidotes Academy — Devenir freelance social media manager$sq$, $sq$La méthodologie Antidotes de bout en bout : positionnement, acquisition, production, publicité, mesure et gestion d'activité. Treize modules, un script complet par leçon, à suivre dans l'ordre ou à la carte.$sq$, 1, true
from organizations o
order by o.created_at
limit 1
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'af627a51-8271-4538-9614-05acdc913e79'::uuid, c.id, c.org_id, 'le-metier', $sq$Le métier, sans illusions$sq$, $sq$Ce module pose les fondations du métier de social media manager freelance : ce que les clients paient vraiment, les quatre livrables qui concentrent 90 % du chiffre d'affaires et les trois modes de facturation avec le mix cible 70/20/10. Il se termine par la construction d'une grille tarifaire complète à partir d'un TJM de 350 à 550 € HT.$sq$, 1, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'faa601ec-b06e-425f-b2f0-8442ae95b1e2'::uuid, m.id, m.course_id, m.org_id, 'ce-que-fait-un-smm-freelance', $sq$Ce que fait vraiment un social media manager freelance$sq$, $sq$Cette leçon distingue les deux étages du métier : l'opérationnel qui produit, publie et modère, et le conseil qui décide et arbitre à partir des données. Tu comprends ce qu'un client paie réellement dans un retainer et pourquoi la part de conseil détermine ton niveau de tarif.$sq$, $sq$## L'accroche

Tu penses que le métier de social media manager, c'est publier des posts. Tes futurs clients le pensent aussi. Et c'est exactement pour ça que certains freelances travaillent cinquante heures par semaine pour 1 800 € par mois, pendant que d'autres facturent 6 000 € en travaillant moins. La différence ne vient pas du talent. Elle vient de ce qu'ils vendent. Un client ne paie pas 1 200 € par mois pour dix visuels. Dix visuels, il peut les faire sur Canva ou les demander à son stagiaire. Il paie 1 200 € pour ne plus penser à ses réseaux, et pour que quelqu'un lui dise quoi faire, pourquoi, et si ça marche. Dans cette leçon, on démonte le métier pièce par pièce : ce qui relève de l'opérationnel, ce qui relève du conseil, et ce que ton client achète vraiment quand il signe. Comprendre cette distinction maintenant t'évitera deux ans d'erreurs de positionnement.

## Le contenu

### Les deux étages du métier

Le métier a deux étages, et tu dois savoir à chaque instant sur lequel tu te trouves.

L'étage opérationnel, c'est tout ce qui se voit : rédiger les posts, créer les visuels, monter les vidéos, programmer les publications, répondre aux commentaires et aux messages privés. C'est concret, c'est mesurable en volume — dix posts, quatre stories, trente commentaires traités — et c'est ce que le client croit acheter.

L'étage conseil, c'est tout ce qui se décide : choisir les réseaux où être présent, définir les piliers de contenu, fixer les fréquences, arbitrer le budget publicitaire, décider ce qu'on arrête. C'est invisible sur le moment, difficile à quantifier, et c'est pourtant ce qui justifie tes tarifs.

Dans la méthode SPEED que tu vas suivre tout au long de cette formation, l'opérationnel correspond à l'étape Exécution. Le conseil traverse tout le reste : Situation, Positionnement, Expression, Données.

### L'opérationnel : nécessaire, mais plafonné

Sois lucide sur les volumes. Un post carrousel bien fait, c'est 45 minutes à 1 h 30 : recherche, rédaction, création du visuel, programmation. Un reel simple, 1 h à 2 h. Dix posts par mois représentent donc deux à trois jours de production. La modération, 20 à 30 minutes par jour pour un compte actif.

Le problème de l'opérationnel, c'est qu'il se compare. Un client peut mettre trois freelances en concurrence sur « 10 posts par mois » et prendre le moins cher. Il peut aussi le confier à une plateforme à 300 € par mois. Si ta seule proposition de valeur est de produire, tu es sur un marché de prix, et ce marché descend.

### Le conseil : invisible, mais c'est lui qui se paie

Le conseil, c'est une phrase comme celle-ci : « On coupe Facebook, qui te coûte un jour de travail par mois pour 200 personnes touchées, et on réinvestit ce temps dans deux reels supplémentaires sur Instagram, où ta portée a doublé au dernier trimestre. » Cette phrase prend dix secondes à prononcer. Elle repose sur des heures de lecture de données et deux ans d'expérience, et elle vaut plus que les dix posts du mois.

Autres exemples d'arbitrages qui se paient : passer de douze posts moyens à huit posts travaillés, parce que l'algorithme récompense la rétention et pas le volume. Réallouer 300 € de budget publicitaire d'une campagne de notoriété vers du retargeting qui convertit. Refuser une tendance TikTok qui ferait des vues mais abîmerait la marque d'un client premium.

Le conseil se nourrit des données. Sans mesure, ton avis vaut celui du beau-frère du client. Avec un reporting propre, ton avis devient une décision documentée. C'est l'étape Données de SPEED, et c'est elle qui transforme un exécutant en partenaire.

### Ce que le client paie vraiment

Quand un dirigeant signe un retainer à 1 200 € par mois, il achète trois choses, dans cet ordre.

La tranquillité : il ne veut plus y penser. Ses réseaux vivent, il n'a rien à faire d'autre que valider un planning une fois par mois.

La régularité : sans toi, il publie trois semaines puis plus rien pendant deux mois. Avec toi, la machine tourne, même en août, même quand son activité déborde.

La lecture : il veut savoir si ça sert à quelque chose. Un chiffre d'affaires, des demandes de devis, des candidatures. C'est le rôle du reporting mensuel commenté, dont on reparlera dans la leçon sur les quatre livrables.

Remarque ce qui n'est pas dans la liste : « des beaux posts ». La qualité de production est un prérequis, pas un argument de vente.

### Une semaine type

Concrètement, pour un freelance installé avec quatre clients en retainer, la semaine ressemble à ça : deux jours et demi à trois jours de production et de programmation, deux à trois heures de modération réparties chaque jour, une demi-journée d'échanges clients et de validations, une demi-journée d'analyse, de reporting ou de préparation de recommandations. Le reste part en prospection et en administratif.

Regarde la répartition : environ 60 % du temps est opérationnel. Mais dans la valeur facturée, la proportion s'inverse. Le client renouvelle pour les arbitrages et la tranquillité, pas pour le volume. Ton travail des prochains mois : faire monter la part de conseil dans ce que tu vends, même si l'opérationnel reste majoritaire dans ton agenda.

## Exemple appliqué

Prenons une savonnerie artisanale. Deux fondateurs, une boutique en ville, un site de vente en ligne qui fait 8 000 € de chiffre d'affaires mensuel. Ils te signent un retainer starter à 900 € HT par mois : Instagram et Facebook, dix posts, modération incluse.

Ton mois opérationnel : deux jours et demi de production — photos produits retravaillées, vidéos d'atelier filmées lors d'une demi-journée sur place chaque mois, textes qui racontent la fabrication. Vingt minutes de modération par jour. Un planning envoyé le 20 du mois précédent, validé en 48 heures.

Au bout de trois mois, les données parlent : les vidéos d'atelier font quatre fois la portée des photos de produits, et les ventes web montent les jours de publication de ces vidéos. Ton conseil tient en trois lignes dans le reporting : « On passe de dix posts à huit. On double les vidéos d'atelier, on divise par deux les photos catalogue. Même budget, même temps. »

Deux mois plus tard : portée moyenne en hausse de 60 %, 250 abonnés gagnés, et surtout onze commandes web dont le questionnaire post-achat cite Instagram. Quand les fondateurs renouvellent, ce n'est pas parce que les posts étaient jolis. C'est parce que tu as pris une décision à leur place, que tu l'as justifiée avec des chiffres, et qu'elle a rapporté. Voilà le métier.

## Les erreurs fréquentes

Se vendre à la tâche. « 10 posts = 500 € » te place d'office sur le marché du moins-disant, face à des plateformes et des débutants. Vends un résultat et une prise en charge, jamais un volume seul.

Donner le conseil gratuitement. Tu passes quarante minutes en visio à expliquer pourquoi abandonner tel réseau, puis tu factures uniquement les posts. Le client apprend que ta réflexion ne vaut rien. Nomme ton conseil, mets-le dans tes livrables, fais-le apparaître sur la facture.

Accepter l'opérationnel sans limite. Modération le dimanche, stories « en plus », troisième aller-retour de validation sur chaque visuel : sans périmètre écrit, chaque client déborde. Fixe le cadre dès la proposition : nombre de posts, délais de réponse, nombre de retours inclus.

Fuir les chiffres. « Je suis créatif, pas analytique » est la phrase qui te condamne à rester exécutant. Lire un tableau de statistiques Meta s'apprend en quelques semaines, et c'est ce qui sépare 900 € de 1 800 € par mois pour le même client.

## Action immédiate

Prends une feuille, trace deux colonnes : opérationnel et conseil. Dans la première, liste tout ce que tu sais déjà produire : posts, visuels, vidéos, modération, programmation. Dans la seconde, liste ce que tu sais décider et justifier avec des données : choix de réseaux, arbitrage de formats, lecture d'un reporting, recommandation budgétaire.

Si ta colonne conseil compte moins de trois lignes solides, note les trois compétences à construire en priorité : lire les statistiques de Meta Business Suite, rédiger une recommandation d'une page à partir de chiffres, et présenter un reporting en quinze minutes. Ce diagnostic te prend trente minutes et il oriente toute la suite de la formation.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Matrice opérationnel vs conseil","description":"Tableau à deux colonnes pour classer tes compétences et mesurer la part de conseil dans ce que tu vends.","kind":"template","url":null},{"title":"Semaine type du SMM freelance","description":"Checklist des blocs de temps hebdomadaires : production, modération, échanges clients, analyse et prospection.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"Le tableau de bord gratuit où lire les statistiques Facebook et Instagram de tes clients.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'af627a51-8271-4538-9614-05acdc913e79'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '24e8cd0f-5a37-4050-8efa-4fb1c8b144af'::uuid, m.id, m.course_id, m.org_id, 'les-quatre-livrables', $sq$Les quatre livrables qui composent 90 % du chiffre d'affaires$sq$, $sq$Cette leçon détaille les quatre livrables qui concentrent 90 % du chiffre d'affaires d'un freelance : stratégie one-shot, accompagnement éditorial mensuel, gestion publicitaire et reporting commenté. Pour chacun, tu apprends le contenu exact, le prix de marché, le temps de production et ce que le client en voit.$sq$, $sq$## L'accroche

Claire, freelance social media à Angers depuis deux ans, a fait l'exercice en décembre : reprendre toutes ses factures de l'année et les classer par type de prestation. Résultat : 91 % de son chiffre d'affaires venait de quatre livrables. Les 9 % restants — une couverture d'événement, deux formations, un shooting — lui avaient pris presque autant d'énergie commerciale que tout le reste. Ce ratio n'est pas propre à Claire : chez la quasi-totalité des freelances installés, 90 % du chiffre d'affaires tient dans les quatre mêmes livrables. Si tu les connais, tu sais quoi construire, quoi vendre et quoi refuser. Sinon, tu passeras un an à accepter tout ce qui passe, sur des prestations qui ne se répètent jamais. Dans cette leçon, on détaille les quatre : leur contenu exact, leur prix, le temps qu'ils te prennent, et ce que le client en voit.

## Le contenu

### Livrable 1 : la stratégie social media

C'est le one-shot par excellence, vendu 1 500 à 3 000 € HT.

Ce qu'il contient : un audit de l'existant — les comptes du client, ses données sur douze mois, ses concurrents directs, son marché. C'est l'étape Situation de SPEED. Puis un positionnement : la niche, la promesse, ce qui différencie. Puis la stratégie éditoriale : trois à cinq piliers de contenu, les formats par réseau, les fréquences, les indicateurs à suivre. Le tout se termine par une feuille de route sur six mois.

Le temps de production : trois à cinq jours pleins. Une journée d'audit et d'entretien avec le client, deux à trois jours de construction, une demi-journée de mise en forme, une restitution d'une heure trente.

Ce que le client voit : un document de 25 à 40 pages, présenté de vive voix, qu'il peut montrer à son associé ou à sa direction. Un objet tangible : le one-shot doit se toucher.

Son vrai rôle : ouvrir la porte du retainer. Une stratégie bien restituée débouche sur un accompagnement mensuel dans la majorité des cas, parce que la question suivante du client est toujours « et qui exécute ça ? ».

### Livrable 2 : l'accompagnement éditorial mensuel

C'est le cœur du retainer, donc le cœur de ton revenu.

Ce qu'il contient : un planning éditorial mensuel envoyé pour validation, la production des posts — textes, visuels, vidéos courtes —, la programmation, la publication et la modération de base. En version starter, 800 à 1 500 € HT par mois pour deux réseaux et huit à douze posts. En accompagnement complet, 1 500 à 3 000 € : plus de formats, plus de réseaux, du contenu vidéo travaillé, une modération étendue.

Le temps de production : deux jours et demi à cinq jours par mois selon la formule, dont une part se compresse avec le temps — au sixième mois, tu connais la marque et tu produis 30 % plus vite qu'au premier.

Ce que le client voit : un planning propre à valider chaque mois, puis ses réseaux qui vivent sans qu'il s'en occupe. Sa charge à lui : deux heures par mois maximum.

### Livrable 3 : la gestion publicitaire Meta et Google

Ce qu'il contient : la structure des campagnes, la définition des audiences, les créations publicitaires, le suivi et l'optimisation hebdomadaire, les tests. Facturé 500 à 1 000 € HT par mois en forfait tant que le budget média du client reste sous 5 000 € par mois. Au-delà, tu bascules sur 10 à 15 % du budget géré : à ce niveau de dépense, ta responsabilité et ton temps montent avec les montants.

Le temps de production : un à deux jours par mois, concentrés sur le lancement puis répartis en points d'optimisation courts.

Ce que le client voit : ses campagnes actives, et surtout un chiffre — coût par résultat, retour sur dépense publicitaire. C'est le livrable le plus directement mesurable, donc le plus exposé : quand ça marche, tu es intouchable ; quand ça baisse, tu dois l'expliquer avant qu'il le remarque.

### Livrable 4 : le reporting mensuel commenté

Il est inclus dans le retainer — tu ne le factures pas à part — et c'est pourtant lui qui fait durer le contrat.

Ce qu'il contient : pas trente pages d'exports. Trois à cinq pages : les chiffres clés du mois comparés au mois précédent, trois enseignements en français clair, deux décisions pour le mois suivant. C'est l'étape Données de SPEED appliquée chaque mois.

Le temps de production : deux à trois heures par client, une fois ta trame construite.

Ce que le client voit : la preuve mensuelle que son argent sert à quelque chose, et quelqu'un qui prend des décisions. Un client qui comprend ce qu'il paie ne résilie pas. Un client qui reçoit des posts sans lecture finit toujours par demander « ça sert à quoi, au juste ? » — et cette question arrive toujours au moment du renouvellement.

### Comment les quatre s'articulent

La séquence type : la stratégie ouvre la relation et paie ta phase d'apprentissage du client. Le retainer installe le revenu récurrent. La publicité s'ajoute quand les fondations organiques tiennent. Le reporting verrouille l'ensemble.

Fais le calcul sur un client complet : stratégie à 2 000 €, retainer à 1 200 € sur douze mois, gestion publicitaire à 600 € sur douze mois. Total : 23 600 € HT la première année, pour un seul client. C'est pour ça que tu n'as besoin que de quatre à six clients.

## Exemple appliqué

Une marque de bougies parfumées, e-commerce lifestyle, 35 000 € de chiffre d'affaires mensuel, deux salariées, une fondatrice qui gère Instagram elle-même « quand elle a le temps ».

Mois 1 : tu vends la stratégie à 2 400 €. L'audit montre un compte Instagram à 12 000 abonnés mais 0,8 % d'engagement, aucune présence TikTok alors que trois concurrentes y font des millions de vues, et un site qui ne reçoit que 4 % de son trafic depuis les réseaux. Le document pose trois piliers : coulisses de fabrication, art de vivre autour des rituels du soir, preuve sociale clients.

Mois 2 : le retainer démarre à 1 300 € par mois — Instagram et TikTok, douze posts dont quatre vidéos. La fondatrice valide le planning le 25 de chaque mois, c'est son seul travail.

Mois 4 : les fondations tiennent, tu ajoutes la gestion Meta Ads à 800 € par mois en forfait, sur un budget média de 2 500 €.

Mois 7 : ton reporting montre que le retour sur dépense publicitaire est passé de 3,1 à 1,9 en un mois. Tu détectes la cause — une audience saturée — et tu réalloues vers une audience similaire avant que la fondatrice ait remarqué la baisse. Elle le lit dans le reporting, déjà résolu.

Première année, compte mois par mois : 2 400 € de stratégie, onze mensualités de retainer à 1 300 € soit 14 300 €, neuf mois de gestion publicitaire à 800 € soit 7 200 €. Total : 23 900 € HT sur ce seul client. Quatre livrables, aucune prestation exotique.

## Les erreurs fréquentes

Brader ou offrir la stratégie. « Je te fais l'audit gratuitement si tu signes le retainer » t'attire des clients qui ne valorisent pas la réflexion, et tu démarres chaque accompagnement sans avoir été payé pour comprendre le client. La stratégie se vend, toujours.

Vendre un retainer sans périmètre écrit. Nombre de posts, réseaux couverts, nombre d'allers-retours de validation, délais de réponse en modération : tout ce qui n'est pas écrit sera demandé en plus, gratuitement.

Accepter la gestion publicitaire sur des budgets trop petits. Sous 500 € de budget média mensuel, il n'y a rien à optimiser : les données sont trop maigres pour apprendre. Tu factures 600 € pour gérer 300 €, le client ne verra jamais de résultat, et c'est ton nom qui sera associé à l'échec.

Livrer un reporting sans commentaire. Un export de chiffres bruts transfère le travail d'interprétation au client, qui ne le fera pas. Sans lecture ni décisions, le reporting devient une pièce jointe non ouverte, puis le contrat devient une ligne de coût à couper.

S'éparpiller hors des quatre. Newsletter, refonte de site, shooting photo, événementiel : chaque prestation hors socle demande de nouveaux outils, un nouveau devis, et ne se répète pas. Si tu en acceptes une, fais-le en connaissance de cause, jamais par défaut.

## Action immédiate

Rédige tes quatre offres sur une page, maintenant, même sans client : pour chacune, un nom, trois lignes de contenu, un prix ferme dans les fourchettes vues ici, et le temps que ça te prendra. Cette page devient ta grille de réponse : au prochain prospect qui demande « tu proposes quoi ? », tu réponds en trente secondes au lieu d'improviser un devis sur mesure. C'est moins d'une heure de travail, et elle resservira telle quelle dans la leçon sur les grilles tarifaires.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Fiche des quatre offres","description":"Modèle d'une page pour formaliser tes quatre livrables : nom, contenu, prix et temps de production.","kind":"template","url":null},{"title":"Trame de reporting mensuel commenté","description":"Structure en cinq pages : chiffres clés comparés au mois précédent, trois enseignements, deux décisions pour le mois suivant.","kind":"template","url":null},{"title":"Checklist de périmètre d'un retainer","description":"Les points à écrire avant de signer : nombre de posts, réseaux, allers-retours de validation et délais de modération.","kind":"checklist","url":null},{"title":"Google Ads","description":"La plateforme publicitaire Google, à connaître pour le livrable de gestion publicitaire.","kind":"tool","url":"https://ads.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'af627a51-8271-4538-9614-05acdc913e79'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '9fa8ad0e-2b6a-4a73-87ce-34be4d041ae9'::uuid, m.id, m.course_id, m.org_id, 'modele-economique', $sq$Le modèle économique : retainer, régie, projet — quel mix viser$sq$, $sq$Cette leçon explique les trois modes de facturation — retainer, projet, régie — avec leurs avantages, leurs risques et leurs prix de référence. Tu construis ton mix cible 70/20/10 et tu apprends les règles de pilotage : plafond de 30-35 % du chiffre d'affaires par client et maximum de 4 à 6 clients en récurrent.$sq$, $sq$## L'accroche

Deux freelances font le même chiffre d'affaires : 4 500 € HT par mois. Le premier a signé trois retainers et une gestion publicitaire : en décembre, il sait déjà que janvier lui rapportera 4 000 € au minimum. Le second enchaîne les one-shots : deux stratégies ce mois-ci, rien de signé pour le mois prochain. Même chiffre, deux métiers : le premier construit une entreprise, le second recommence à zéro tous les trente jours. La différence ne se lit pas sur une facture mais sur la structure du revenu. C'est ton modèle économique, la décision la plus structurante de ton activité — avant le logo, avant le site, avant les tarifs. Dans cette leçon : les trois modes de facturation — retainer, projet, régie —, leurs forces, leurs pièges, et le mix cible qui rend une activité stable : 70 % de récurrent, 20 % de projet, 10 % de régie.

## Le contenu

### Le retainer : la colonne vertébrale

Le retainer, c'est un forfait mensuel récurrent : un périmètre défini, payé chaque mois — l'accompagnement éditorial de la leçon précédente, typiquement 800 à 1 500 € HT en starter, 1 500 à 3 000 € en complet.

Ses forces : la prévisibilité d'abord — tu sais le 1er du mois combien tu factureras le 30. La rentabilité croissante ensuite : au sixième mois chez un client, tu produis plus vite qu'au premier, à prix constant. La relation enfin : un client récurrent te confie des sujets qu'un client ponctuel ne te confiera jamais.

Ses risques : la dépendance — un gros retainer qui part, c'est un trou immédiat et durable. Fixe-toi une règle : aucun client ne doit dépasser 30 à 35 % de ton chiffre d'affaires. L'usure ensuite : au quatorzième mois, la tentation est de dérouler en pilote automatique, et le client commence à douter. Le scope creep enfin : sans périmètre écrit, un retainer gonfle silencieusement jusqu'à devenir déficitaire.

### Le projet : le carburant

Le projet, c'est le one-shot : une stratégie social media à 1 500-3 000 €, un audit, un lancement de compte, une refonte de présence.

Ses forces : du cash rapide — 2 500 € facturés sur trois semaines. Un taux journalier élevé : bien vendu, un projet se facture au-dessus de ton retainer ramené au jour. Et surtout, c'est une porte d'entrée : la stratégie d'aujourd'hui est le retainer de dans deux mois.

Ses risques : tout s'arrête quand tu arrêtes de vendre. Le projet exige une prospection permanente — rappelle-toi les ratios du métier : sur 100 prospects contactés, 8 à 12 réponses, 2 à 4 rendez-vous. Si ton revenu repose sur le projet, tu alimentes cette machine tous les mois, y compris pendant que tu produis. C'est le mode de facturation qui fatigue le plus.

### La régie : le complément

La régie, dans notre métier, c'est principalement la gestion publicitaire : 500 à 1 000 € HT par mois en forfait, ou 10 à 15 % du budget média quand le client dépense plus de 5 000 € par mois.

Ses forces : au pourcentage, ton revenu monte avec le budget du client sans que ton temps monte autant — gérer 8 000 € de budget ne prend pas deux fois plus de temps que 4 000 €. Et la facturation est ancrée sur un résultat mesurable, ce qui la rend facile à défendre.

Ses risques : tu dépends des plateformes — un compte publicitaire restreint par Meta, et ta prestation s'arrête du jour au lendemain. La saisonnalité : un e-commerçant coupe ses budgets en janvier, ton pourcentage plonge avec. Et l'exposition : c'est le livrable où l'échec se chiffre en euros, sous les yeux du client.

### Le mix cible : 70/20/10

Vise 70 % de retainer, 20 % de projet, 10 % de régie.

Traduis-le en euros sur un objectif de 6 000 € HT par mois : 4 200 € de retainers — trois clients entre 1 200 et 1 500 €, ou quatre autour de 1 000 —, 1 200 € de projet — une stratégie à 2 400 € tous les deux mois suffit —, 600 € de régie — une gestion publicitaire en forfait.

Pourquoi cette répartition ? Les 70 % de récurrent couvrent tes charges fixes et ton salaire de base : un mauvais mois commercial ne te met pas en danger. Les 20 % de projet gardent ta prospection vivante et alimentent les futurs retainers. Les 10 % de régie complètent sans t'exposer aux plateformes au-delà du raisonnable.

Claire n'a pas commencé comme ça. Sa première année : 30 % de retainer, 60 % de projet, 10 % de régie. Elle prospectait sans arrêt et son chiffre faisait le yo-yo entre 2 200 et 5 100 € selon les mois. En deuxième année, elle a systématisé une seule chose : chaque stratégie vendue se termine par une proposition de retainer, remise le jour de la restitution. Douze mois plus tard : quatre clients récurrents, un chiffre stabilisé entre 5 000 et 6 000 €, deux fois moins d'heures de prospection.

### Combien de clients au maximum

Quatre à six clients en retainer, pas plus. Au-delà, la qualité baisse chez tout le monde en même temps : plus le temps de lire les données, le conseil disparaît, il ne reste que la production — et la première leçon a montré où elle mène. L'objectif d'un freelance installé, 5 000 à 8 000 € HT par mois, se construit en montant la valeur par client, jamais en empilant les clients.

## Exemple appliqué

Une société de transport premium B2B à Lyon : douze berlines avec chauffeur, clientèle de directions d'entreprise, de cabinets d'avocats et d'organisateurs d'événements. Panier élevé, cycle de vente long, décideurs sur LinkedIn.

La relation commence en mode projet : une stratégie à 2 800 €. L'audit montre un compte LinkedIn entreprise quasi mort, aucun contenu du dirigeant alors que ses concurrents publient chaque semaine, et un Instagram qui poste des photos de voitures sans jamais montrer le service.

Elle se poursuit en retainer : 1 600 € par mois pour LinkedIn et Instagram — huit posts entreprise, deux posts par semaine rédigés pour le compte personnel du dirigeant, modération. C'est un accompagnement au-dessus du starter, justifié par la rédaction pour le dirigeant, exigeante en B2B.

Elle se complète en régie : 600 € par mois pour gérer 1 500 € de campagnes LinkedIn Ads ciblant les assistants de direction et les responsables achats de la région.

Fais le total : 2 200 € de récurrent mensuel sur un seul client. Si ton objectif est 6 000 €, il pèse 37 % de ton chiffre — au-dessus de ta règle des 35 %. Ce n'est pas une raison de refuser, mais de signer vite un deuxième retainer pour redescendre sous le seuil. Le mix se pilote en permanence, pas une fois par an.

## Les erreurs fréquentes

Tout miser sur le projet. C'est le réflexe du démarrage : les one-shots se vendent plus vite qu'un engagement mensuel. Mais chaque mois repart de zéro, et au premier trou d'air — une maladie, des vacances, un été calme — le revenu tombe à zéro avec.

Brader le retainer « pour la récurrence ». Accepter 600 € par mois pour quinze posts, c'est travailler quatre jours pour 150 € la journée. La récurrence ne vaut rien si chaque mois est déficitaire. Le prix plancher se calcule depuis ton taux journalier, jamais depuis la peur de perdre le prospect.

Prendre de la régie au pourcentage sur un petit budget. 12 % de 800 € de budget média, c'est 96 €. Personne ne peut gérer sérieusement des campagnes pour 96 € par mois. Sous 5 000 € de budget, c'est forfait, sans exception.

Laisser un client devenir trop gros. À 45 % de ton chiffre d'affaires, il le sent, et la relation change : il négocie plus dur, demande plus, paie plus tard. Et tu acceptes, parce que tu ne peux pas te permettre de le perdre. La règle des 30-35 % n'est pas comptable, elle est politique.

Signer des retainers sans conditions de sortie. Sans préavis écrit — trente jours minimum —, un client peut partir le 28 du mois et ton « récurrent » n'a de récurrent que le nom. Le préavis protège les deux parties, et un client sérieux ne le discute jamais.

## Action immédiate

Ouvre un tableur, trois colonnes : retainer, projet, régie. Si tu as déjà facturé, ventile tes six derniers mois et calcule les pourcentages réels. Si tu démarres, pars de ton objectif mensuel — mettons 5 000 € —, applique 70/20/10, et écris combien de clients et à quel prix chaque colonne suppose. Termine par la prochaine action qui rapproche ton mix réel de la cible : proposer un retainer à un client projet, renégocier une régie sous-facturée, ou prospecter pour diluer un client trop lourd. Vingt minutes suffisent.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Calculateur de mix 70/20/10","description":"Tableur à trois colonnes pour ventiler ton chiffre d'affaires par mode de facturation et mesurer l'écart au mix cible.","kind":"template","url":null},{"title":"Clauses de sortie d'un retainer","description":"Checklist des conditions à écrire dans tout contrat récurrent : préavis de trente jours, périmètre et révision annuelle.","kind":"checklist","url":null},{"title":"LinkedIn for Business","description":"Le point d'entrée des solutions LinkedIn, utile pour les clients B2B comme le transport premium de l'exemple.","kind":"link","url":"https://business.linkedin.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'af627a51-8271-4538-9614-05acdc913e79'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '8574c05b-c778-4fc8-b445-99de75330208'::uuid, m.id, m.course_id, m.org_id, 'combien-facturer', $sq$Combien facturer et comment construire ses grilles tarifaires$sq$, $sq$Cette leçon montre comment construire une grille tarifaire complète à partir d'un TJM de 350 à 550 € HT : jours estimés par livrable, prix affichés en forfait, trois niveaux d'offre. Tu apprends aussi à présenter tes prix en appel découverte : fourchette à l'oral, proposition sous 48 heures et ajustement par le périmètre plutôt que par la remise.$sq$, $sq$## L'accroche

Le moment le plus redouté d'un appel découverte, c'est celui où le prospect demande : « Et niveau budget, ça donne quoi ? » La plupart des freelances improvisent. Ils pensent aux prix vus sur Malt, retirent 20 % « pour être sûrs de l'avoir », et lâchent un chiffre qu'ils regretteront pendant douze mois. Un prix lâché sous la pression ne se rattrape pas : tu ne rappelleras pas la semaine suivante pour annoncer 40 % de plus. Résultat classique : un accompagnement à 700 € par mois qui, une fois le temps réel compté, revient à 22 € de l'heure. La solution n'est pas le culot, c'est la grille : des prix construits depuis ton taux journalier, écrits avant l'appel, jamais improvisés. Dans cette leçon, tu vas construire cette grille chiffre par chiffre, puis apprendre à la présenter sans trembler.

## Le contenu

### Le TJM : ton outil interne

Le taux journalier moyen d'un social media manager freelance se situe entre 350 et 550 € HT. Place-toi honnêtement : 350 € si tu démarres, 450 € avec deux ans d'expérience et des cas clients documentés, 550 € avec une spécialisation reconnue — un secteur, un format, un réseau où tu es identifié.

Pourquoi pas moins ? Fais le calcul à l'envers. Objectif : 5 000 € HT par mois. Sur vingt jours ouvrés, tu n'en factures que douze à treize — le reste part en prospection, administratif, formation, avant-vente. 5 000 divisé par 12,5 : il te faut 400 € par jour facturé. Un TJM à 250 € ne te mènera jamais à 5 000 €, quel que soit ton talent commercial : c'est arithmétique.

Retiens la règle d'or : le TJM ne se montre jamais au client. C'est ton outil de calcul interne. Le client, lui, voit des offres à prix fermes. Un TJM affiché invite à négocier des demi-journées ; un forfait s'accepte ou se discute en périmètre.

### Du TJM à la grille

La méthode tient en trois étapes : estimer les jours par livrable, multiplier par ton TJM, arrondir en prix d'offre. Prenons un TJM à 450 €.

La stratégie social media : quatre à cinq jours de travail — audit, entretiens, construction, restitution. 4,5 jours fois 450 € : 2 025 €. Prix affiché : 2 200 €, dans la fourchette marché de 1 500 à 3 000 €. La marge au-dessus du calcul brut couvre les imprévus et l'avant-vente.

Le retainer starter : deux jours et demi à trois jours par mois — planning, huit à douze posts sur deux réseaux, modération, reporting. 2,75 jours fois 450 € : 1 240 €. Prix affiché : 1 300 € par mois, dans la fourchette 800-1 500 €, et la rentabilité montera avec les mois puisque tu produiras plus vite.

L'accompagnement complet : quatre à six jours par mois. 5 jours fois 450 € : 2 250 €. Prix affiché : 2 400 €, dans la fourchette 1 500-3 000 €.

La gestion publicitaire : un jour et demi par mois. 1,5 jour fois 450 € : 675 €. Prix affiché : 700 € en forfait, avec bascule à 10-15 % du budget média au-delà de 5 000 € de dépense mensuelle.

Tu remarques que le prix affiché n'est jamais loin du calcul, mais qu'il est toujours rond, ferme, et rattaché à un périmètre écrit. C'est ça, une grille.

### Trois offres, pas une

Présente toujours trois niveaux : starter, standard, complet. Pas pour vendre le complet — pour vendre le standard. Face à une seule offre, le prospect compare ton prix au marché, à son beau-frère, à une plateforme. Face à trois, il compare tes offres entre elles, et la question devient « laquelle ? » au lieu de « combien ? ». La majorité choisit l'offre du milieu : construis donc ton standard comme l'offre que tu veux réellement vendre, encadrée par un starter qui sert de plancher et un complet qui sert d'ancre haute.

### Présenter sa grille sans trembler

Trois règles.

Un : ne donne jamais un prix ferme à chaud en premier appel. Donne une fourchette : « Sur ce type d'accompagnement, mes clients sont entre 1 200 et 1 900 € par mois selon le périmètre. Je t'envoie une proposition détaillée sous 48 heures. » La fourchette filtre les prospects hors budget sans fermer la porte, et le délai te laisse construire.

Deux : envoie la proposition sous 48 heures, avec les trois options, et recommandes-en une par écrit : « Au vu de tes objectifs, je te conseille la formule standard. » Un expert recommande ; un fournisseur laisse choisir.

Trois : ne baisse jamais un prix, retire du périmètre. « 1 900 €, c'est au-dessus de mon budget » n'appelle pas une remise, mais un ajustement : « On peut passer à 1 500 € en retirant les deux vidéos mensuelles. » Une remise sans contrepartie dit que ton premier prix était faux — et t'engage à négocier chaque renouvellement.

Dernier point : augmente tes prix de 10 % par an, ou à chaque nouveau client. Tes anciens clients gardent leur tarif un an de plus : leur avantage de fidélité, et ton argument pour annoncer la hausse sans friction.

## Exemple appliqué

Une mutuelle santé régionale, 40 000 adhérents, moyenne d'âge en hausse constante. L'objectif posé en appel découverte : rajeunir l'image et recruter des adhérents de moins de 35 ans. Sa page Facebook publie trois fois par an, Instagram n'existe pas.

En fin d'appel, la question tombe : « Vous facturez combien ? » Réponse préparée : « Pour une structure comme la vôtre, mes accompagnements vont de 1 200 à 2 600 € par mois selon l'intensité. Je vous envoie une proposition détaillée avec plusieurs formules d'ici jeudi. »

La proposition, envoyée 36 heures plus tard, contient trois formules. Starter à 1 200 € par mois : Facebook et Instagram, dix posts pédagogiques — décrypter les remboursements, la prévention, les démarches —, modération, reporting commenté. Standard à 1 900 € : la même base, portée à quatorze posts dont deux vidéos mensuelles face caméra avec des conseillers, le format qui crée la confiance en assurance B2C. Complet à 2 600 € : le standard, plus la gestion des campagnes Meta de recrutement d'adhérents, sur un budget média conseillé de 1 500 € par mois. La recommandation écrite pointe le standard : sans vidéo, l'objectif de rajeunissement n'est pas atteignable.

Le directeur communication répond : le standard l'intéresse, mais son budget plafonne à 1 600 €. Pas de remise : « À 1 600 €, on garde les quatorze posts et on passe à une vidéo par mois au lieu de deux. » Vérification interne : environ 3,5 jours de travail mensuel, soit 457 € par jour — au-dessus du TJM de 450 € visé. Signature en formule ajustée, périmètre écrit, préavis de trente jours. Personne n'a parlé de TJM, et pourtant c'est lui qui a piloté toute la négociation.

## Les erreurs fréquentes

Facturer à l'heure. L'heure punit ton efficacité : plus tu deviens rapide, moins tu gagnes. Elle pousse aussi le client à surveiller ton temps au lieu de regarder tes résultats. Le forfait à périmètre écrit protège les deux parties.

Copier les prix des autres. Le freelance vu sur Malt à 300 € la journée a peut-être un conjoint qui paie le loyer, une clientèle low-cost ou trois mois d'activité. Son prix ne dit rien de tes coûts ni de ton positionnement. Ta grille se construit depuis ton TJM, pas depuis la peur du voisin.

Lâcher un chiffre à chaud. Un prix improvisé en call est presque toujours trop bas, et il t'engage. La fourchette à l'oral plus la proposition sous 48 heures : cette mécanique seule peut te faire gagner 20 % de revenu sur une année.

Raisonner en chiffre d'affaires au lieu de raisonner en net. 1 200 € HT facturés en micro-entreprise, c'est environ 900 € après cotisations sociales, avant impôt, sans congés payés ni mutuelle. Quand tu fixes ton TJM, c'est ce chiffre-là que tu dois trouver acceptable, pas celui de la facture.

Baisser le prix pour conclure. Chaque euro de remise sans contrepartie apprend au client que tes prix sont gonflés. Retire du périmètre, propose un engagement plus long contre un geste, mais ne touche jamais au prix seul.

## Action immédiate

Fixe ton TJM maintenant — 350, 450 ou 550 € selon ta marche —, puis construis ta grille sur une page : tes trois formules d'accompagnement mensuel plus la stratégie en one-shot, avec pour chacune le prix affiché, le périmètre en trois lignes, et le nombre de jours que ça te coûte. Vérifie chaque ligne : le prix divisé par les jours doit rester au-dessus de ton TJM. Termine par ta phrase de fourchette, écrite mot pour mot, celle que tu diras au prochain appel découverte. Quarante-cinq minutes, et tu ne subiras plus jamais la question du budget.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Grille tarifaire à trois offres","description":"Modèle d'une page : starter, standard et complet, avec prix affiché, périmètre en trois lignes et jours de production.","kind":"template","url":null},{"title":"Checklist avant d'envoyer une proposition","description":"Les vérifications à faire : prix par jour au-dessus du TJM, recommandation écrite, périmètre chiffré et préavis mentionné.","kind":"checklist","url":null},{"title":"Urssaf","description":"Le site officiel pour estimer tes cotisations sociales et raisonner en revenu net plutôt qu'en chiffre d'affaires.","kind":"link","url":"https://www.urssaf.fr"},{"title":"Malt","description":"La place de marché où observer les fourchettes de TJM affichées par les freelances social media, sans les copier.","kind":"tool","url":"https://www.malt.fr"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'af627a51-8271-4538-9614-05acdc913e79'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'ebea35d2-1f38-4e83-913b-7d2be84d8049'::uuid, c.id, c.org_id, 'positionnement-offre', $sq$Positionnement et offre$sq$, $sq$Ce module t'apprend à choisir une niche rentable, à structurer deux lignes d'offre claires et à t'appuyer sur la méthodologie SPEED pour vendre un chemin plutôt que des posts. Il se termine par la construction d'une page d'offre en cinq blocs qui circule et convainc sans toi.$sq$, 2, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'e5656b35-6fff-4234-91f7-5ecfa7dbc744'::uuid, m.id, m.course_id, m.org_id, 'choisir-sa-niche', $sq$Choisir sa niche$sq$, $sq$Comparaison de cinq familles de clients — retail, lifestyle/e-commerce, marque employeur, institutionnel, marques en transition digitale — sur trois critères : budget du client type, cycle de vente et affinité réelle. La leçon fournit une grille de notation à remplir en 45 minutes pour identifier les deux niches à prospecter en priorité.$sq$, $sq$## L'accroche

« Je fais du social media pour tout le monde. » Si c'est ta réponse quand on te demande ce que tu fais, tu as un problème. Le prospect qui t'écoute ne retient rien. Il te compare au premier freelance venu, et la comparaison se fait sur un seul critère : le prix. Résultat : tu négocies à 300 € par mois des prestations qui en valent 1 200. Claire, freelance à Angers, a passé sa première année comme ça. Douze devis envoyés, deux signés, les deux au rabais. Le jour où elle a choisi de concentrer sa prospection sur les marques produit locales, son taux de signature a doublé et son panier moyen aussi. Pas parce qu'elle était devenue meilleure. Parce qu'elle était devenue identifiable. Cette leçon te donne une méthode pour choisir ta niche : cinq familles de clients comparées, trois critères de décision, et une grille de notation que tu remplis en moins d'une heure.

## Le contenu

### Pourquoi une niche change tes chiffres

Trois effets mécaniques. Un : la recommandation. Un client content parle de toi à des entreprises qui lui ressemblent. Si tes clients se ressemblent, chaque recommandation tombe dans ta cible. Deux : la production. Ton dixième planning éditorial pour une mutuelle te prend deux fois moins de temps que le premier, parce que tu connais les sujets, les contraintes, les formats qui marchent. Ton TJM réel monte sans que ton prix affiché bouge. Trois : le prix, justement. Un spécialiste se vend 350 à 550 € HT la journée. Un généraliste plafonne en bas de la fourchette, quand il ne descend pas en dessous.

### Les cinq familles à comparer

**Le retail.** Commerces, réseaux de boutiques, franchises. Cycle de vente court : le gérant décide seul ou presque, tu peux signer en deux semaines. Budgets moyens : compte un retainer starter à 800-1 200 € HT par mois. Besoin de volume : beaucoup de contenu, forte saisonnalité, opérations commerciales à répétition. Bon terrain d'apprentissage, mais plafond de prix réel.

**Le lifestyle et l'e-commerce.** Marques de mode, déco, cosmétique, food. Le contenu est le produit : la créa pèse lourd, les ads aussi. C'est la niche la plus concurrentielle côté freelances, mais celle où la gestion publicitaire se vend le mieux : 500 à 1 000 € HT par mois en forfait, ou 10-15 % du budget média au-delà de 5 000 € de dépense mensuelle.

**La marque employeur.** Tu travailles pour les RH, pas pour le marketing. Contenus LinkedIn, portraits de collaborateurs, culture d'entreprise. Clients : ETI et grands groupes, donc budgets solides et TJM en haut de fourchette, 450-550 €. Cycle plus long, deux à trois mois, et il faut aimer l'interview et la vie interne des boîtes. Peu de freelances s'y positionnent : c'est un espace libre.

**L'institutionnel.** Collectivités, mutuelles, fédérations, associations. Cycles longs — trois à six mois, parfois un appel d'offres — validation à étages, paiement à 45 ou 60 jours. En échange : des contrats de 12 à 24 mois, un vrai besoin de reporting sérieux, et une concurrence faible parce que la lenteur décourage. Si tu as de la trésorerie, c'est une niche stable.

**Les marques en transition digitale.** PME historiques, souvent industrielles ou familiales, quasi absentes des réseaux. Tout est à construire : c'est la niche idéale pour vendre la stratégie one-shot à 1 500-3 000 € HT en porte d'entrée, puis transformer en retainer. Contrepartie : un gros travail de pédagogie, et un interlocuteur qui ne sait pas ce qu'il achète. La qualité de ta vulgarisation fait toute la différence.

### Les trois critères qui tranchent

**Le budget.** Question test : est-ce que le client type de cette niche peut payer 1 000 € HT par mois sans trembler ? Regarde ses effectifs, son chiffre d'affaires, la présence ou non d'un budget communication. Une entreprise de 20 salariés à 2 M€ de CA peut. Un restaurant indépendant, rarement.

**Le cycle de vente.** Combien de temps entre le premier contact et la signature ? Deux semaines dans le retail, trois mois dans l'institutionnel. Rapporte ça à ta trésorerie : si tu as deux mois devant toi, une niche à cycle de six mois te met en danger, même si elle paie mieux.

**L'affinité.** Pas la passion : la capacité à tenir. Tu vas produire du contenu sur ce secteur pendant des années. Est-ce que tu comprends les enjeux ? Est-ce que tu as déjà un vocabulaire, un réseau, une expérience salariée dans ce milieu ? Une affinité réelle divise ton temps de production par deux.

### La grille de notation

Prends les cinq familles. Note chacune de 1 à 5 sur les trois critères. Pondère si tu veux : budget × 2 si ta priorité est le revenu. Ajoute une quatrième ligne : le nombre de prospects accessibles dans ta zone — compte-les vraiment, sur LinkedIn ou dans un annuaire professionnel. En dessous de 100 prospects atteignables, la niche est trop étroite pour l'outbound : sur 100 contactés, tu obtiens 8 à 12 réponses et 2 à 4 rendez-vous. Il te faut du volume, ou une stratégie de réseau à la place.

## Exemple appliqué

Prenons l'assurance mutualiste B2C. Une mutuelle régionale, 45 000 adhérents, 80 salariés, une page Facebook qui publie trois fois par an et zéro présence Instagram alors que sa cible de recrutement a entre 25 et 40 ans.

Budget : 5 sur 5. Il existe un service communication, un budget annuel voté, et l'habitude de payer des prestataires. Un retainer à 1 500-2 500 € HT par mois est dans les clous, plus une stratégie d'entrée à 3 000 €.

Cycle de vente : 2 sur 5. Compte trois à quatre mois : un premier contact, une présentation au responsable communication, puis un passage en comité de direction. Prévois deux relances et un dossier écrit qui circule sans toi.

Affinité : à toi de noter honnêtement. Les contenus sont réglementés — santé, prévoyance — et chaque post passe par une validation juridique. Si les allers-retours de validation t'insupportent, mets 1. Si tu aimes les sujets de fond et les contenus pédagogiques, mets 4 : peu de freelances savent écrire simplement sur le remboursement d'une complémentaire santé, et cette rareté se paie.

Prospects accessibles : une centaine de mutuelles et d'acteurs paritaires en France, une dizaine dans une grande région. C'est peu pour de l'outbound de masse, mais chaque contrat dure : la niche se travaille en réseau et en recommandation, pas au volume.

Verdict pour Claire : avec deux mois de trésorerie devant elle, elle écarte cette niche aujourd'hui et la garde pour dans un an, quand deux retainers stables lui permettront d'absorber un cycle de quatre mois.

## Les erreurs fréquentes

**Choisir une niche qui ne paie pas.** Les restaurants, les coiffeurs, les indépendants solos : besoin réel, budget inexistant. Si le panier moyen possible est sous 500 € par mois, tu devras empiler douze clients pour vivre — ingérable. Vérifie le budget avant l'affinité.

**Confondre niche et passion.** Aimer la mode ne veut pas dire que les marques de mode de ta région peuvent te payer 1 200 € par mois. La passion est un bonus, jamais un critère de décision.

**Se nicher sur un sujet, pas sur un marché.** « Je suis spécialiste des Reels » n'est pas une niche : personne n'achète des Reels, on achète des clients en plus ou une marque plus visible. La niche se définit par le type d'entreprise qui signe le devis.

**Changer de niche tous les trois mois.** Les effets d'une niche — recommandation, vitesse de production, réputation — mettent six à douze mois à arriver. Si tu pivotes avant, tu repars de zéro à chaque fois. Donne-toi douze mois avant de juger.

**S'interdire les clients hors niche.** La niche est une direction de prospection, pas une interdiction de vendre. Si un client hors cible arrive avec un bon budget, prends-le. C'est ton marketing qui est niché, pas ton carnet de commandes.

## Action immédiate

Ouvre un tableur. Cinq lignes : retail, lifestyle/e-commerce, marque employeur, institutionnel, transition digitale. Quatre colonnes : budget du client type, longueur du cycle de vente, ton affinité réelle, nombre de prospects accessibles dans ta zone — compte-les sur LinkedIn, vraiment, pas au doigt mouillé. Note chaque case de 1 à 5, sauf la dernière colonne où tu inscris un nombre. Additionne. Les deux niches en tête deviennent tes cibles de prospection pour les trois prochains mois. Temps total : 45 minutes.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Grille de notation des niches","description":"Un tableur cinq niches par quatre colonnes (budget, cycle de vente, affinité, prospects accessibles) avec notation de 1 à 5 et pondération possible.","kind":"template","url":null},{"title":"Checklist d'évaluation d'une niche","description":"Les questions à se poser avant de retenir une niche : capacité du client type à payer 1 000 € HT par mois, durée du cycle de vente rapportée à ta trésorerie, affinité réelle et volume de prospects atteignables.","kind":"checklist","url":null},{"title":"LinkedIn","description":"L'outil de référence pour compter concrètement les prospects accessibles de chaque niche dans ta zone avant de trancher.","kind":"tool","url":"https://www.linkedin.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'ebea35d2-1f38-4e83-913b-7d2be84d8049'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7db85950-ee71-40e3-97ee-d0f7d82c9ae4'::uuid, m.id, m.course_id, m.org_id, 'offre-lisible', $sq$Construire une offre lisible : accompagnement opérationnel vs advisory$sq$, $sq$Deux lignes d'offre distinctes : l'accompagnement opérationnel (planning, 8-12 posts, modération, reporting, 800 à 3 000 € HT par mois) où tu produis, et l'advisory (audit puis suivi mensuel facturé au TJM de 350-550 € HT) où l'équipe du client exécute. La leçon fixe les règles de cohabitation : jamais mélangées dans un devis, la stratégie one-shot comme porte d'entrée, et des exclusions écrites.$sq$, $sq$## L'accroche

« Concrètement, tu fais quoi ? » Le prospect te pose la question en call de découverte. Et toi, tu déroules : community management, création de contenu, stratégie, publicité, veille, modération, newsletters, un peu de graphisme aussi. Douze prestations, zéro offre. Le prospect note tout, te demande un devis « sur mesure », et tu passes trois heures à assembler des lignes qu'il négociera une par une. Claire a fonctionné comme ça pendant dix-huit mois : chaque devis était un prototype, chaque négociation une découpe. Le jour où elle a réduit son catalogue à deux lignes d'offre — une où elle produit, une où elle conseille — ses devis ont tenu sur une page et son taux de signature en call est monté à 30 %. Deux offres, pas douze. C'est ce qu'on construit dans cette leçon : ce que contient chaque ligne, pour quel client, à quel prix, et comment les faire cohabiter sans jamais les mélanger.

## Le contenu

### Ligne 1 : l'accompagnement opérationnel — tu produis

C'est le cœur du métier et 70 % de ton chiffre d'affaires cible. Le client te délègue l'exécution : tu penses, tu produis, tu publies, tu rends compte.

Ce que ça contient, noir sur blanc :

- le planning éditorial mensuel, validé par le client avant production ;
- la production et la publication de 8 à 12 posts sur 2 réseaux pour la formule starter ;
- la modération des commentaires et messages, avec un délai de réponse annoncé — 24 heures ouvrées, par exemple ;
- le reporting mensuel commenté. Pas un export de chiffres : une page d'analyse et des décisions. C'est lui qui fait durer le contrat.

Les prix : 800 à 1 500 € HT par mois pour le starter — 2 réseaux, 8-12 posts. 1 500 à 3 000 € HT pour l'accompagnement complet : plus de réseaux, plus de formats, et la gestion publicitaire en plus, que tu factures 500 à 1 000 € HT par mois en forfait, ou 10-15 % du budget média quand la dépense dépasse 5 000 € par mois.

Pour qui : la PME de 10 à 80 salariés sans équipe marketing, ou avec une personne qui fait déjà trois métiers. Le client type dit : « on sait qu'il faut le faire, on n'a personne pour le faire. »

Engagement : trois mois minimum. En dessous, tu n'as pas le temps de produire un résultat mesurable, et le client te juge sur un mois de rodage.

### Ligne 2 : l'advisory — tu conseilles, l'équipe exécute

Ici, tu ne produis rien. Le client a une équipe — souvent junior — et il t'achète ton regard, ta méthode, tes arbitrages.

Ce que ça contient :

- en entrée, un audit et une stratégie vendus en one-shot : 1 500 à 3 000 € HT selon la profondeur ;
- ensuite, un suivi mensuel : deux heures de call par mois, la revue du planning produit par l'équipe interne avant publication, les arbitrages sur les campagnes, et une relecture du reporting avec recommandations écrites.

Le prix se calcule au temps : ton TJM, 350 à 550 € HT, multiplié par les jours réellement engagés. Deux jours par mois à 450 € font 900 € HT mensuels. Quatre jours en font 1 800. Mais annonce un forfait mensuel, pas un compteur d'heures : le client achète une présence régulière, pas un taximètre.

Pour qui : l'ETI ou la PME structurée qui a recruté un alternant ou un chargé de communication junior, et qui veut sécuriser ce qu'il produit. Le client type dit : « on a quelqu'un, mais on avance sans cap. »

### Les règles de cohabitation

Un : les deux lignes ne se mélangent jamais dans un même devis. « Je produis vos posts et je conseille votre équipe » rend le périmètre illisible et invérifiable. Un devis égale une ligne d'offre.

Deux : la stratégie one-shot est la porte d'entrée des deux lignes. Elle se vend seule, 1 500 à 3 000 €, et débouche soit sur « on vous confie l'exécution » — ligne 1 — soit sur « accompagnez notre équipe » — ligne 2. Tu ne choisis pas à la place du client : tu présentes les deux suites possibles à la restitution.

Trois : l'advisory se vend sur preuve. Personne n'achète le conseil d'un freelance qui n'a jamais rien exécuté. Commence par l'opérationnel, documente tes résultats, et ouvre la ligne advisory quand tu as deux ou trois cas solides à raconter.

Quatre : chaque ligne dit ce qu'elle exclut. Le site web, le graphisme print, l'événementiel, la réponse aux avis Google à minuit : hors périmètre, facturés à part ou refusés. Ce qui n'est pas écrit te sera demandé.

## Exemple appliqué

Un transporteur premium B2B : navettes avec chauffeur pour les entreprises, transferts aéroport, événementiel corporate. 25 salariés, 3 M€ de chiffre d'affaires, et une assistante de direction qui publie sur LinkedIn « quand elle a le temps ».

Mauvaise réponse : lui vendre l'opérationnel complet à 2 000 € par mois. Le dirigeant trouvera ça cher pour « des posts », et l'assistante — qui connaît les clients, les chauffeurs et les coulisses — sera mise de côté alors qu'elle est la meilleure source de contenu de l'entreprise.

Bonne réponse : la ligne advisory. D'abord une stratégie one-shot à 2 500 € HT : audit de la présence LinkedIn, analyse de trois concurrents, positionnement éditorial, piliers de contenu, et un process de production taillé pour l'assistante. Ensuite un advisory à deux jours par mois, 900 € HT mensuels : un call de cadrage mensuel, la revue des posts avant publication, la montée en compétence de l'assistante, la relecture du reporting.

Six mois plus tard, l'entreprise veut accélérer sur la prospection : tu ajoutes la gestion d'une campagne LinkedIn Ads à 600 € HT par mois — un morceau de ligne 1, sur un périmètre fermé, avec son propre devis. Total : 1 500 € HT par mois récurrents, un client autonome sur son contenu, et toi positionné sur ce qui a le plus de valeur.

## Les erreurs fréquentes

**Le catalogue à quinze lignes.** Plus tu listes de prestations, plus le prospect découpe. Chaque ligne devient négociable, et le devis final ne ressemble plus à une offre mais à un panier de courses. Deux lignes, des contenus fermés, un prix par formule.

**Vendre de l'advisory sans preuve.** Le conseil se paie sur la crédibilité. Si ton portfolio est vide, ta ligne advisory est un vœu. Fais d'abord tourner l'opérationnel, construis deux études de cas chiffrées, puis ouvre la deuxième ligne.

**L'opérationnel déguisé en advisory.** Le piège classique : tu vends deux jours de conseil, et au troisième mois tu produis les posts « pour dépanner ». Tu fais alors le travail de la ligne 1 au tarif et au volume de la ligne 2, sans être payé pour. Si le client veut que tu produises, c'est un nouveau devis.

**Le prix à la carte.** « Le post à 90 €, la story à 40 € » invite le client à composer son menu et à comparer chaque ligne au marché. Tu vends un accompagnement mensuel avec un résultat visé, pas des unités de contenu.

**Aucune limite écrite.** Sans périmètre explicite, « tu gères nos réseaux » devient « tu réponds aux avis Google, tu fais la newsletter et l'affiche du salon ». Chaque offre liste trois exclusions minimum, noir sur blanc, dans le devis.

## Action immédiate

Écris tes deux lignes d'offre, maintenant, en six lignes chacune : un nom, une phrase « pour qui », trois puces de contenu, un prix — fourchette autorisée —, une durée d'engagement, une exclusion. Format libre, un document texte suffit. Si tu débutes, écris quand même la ligne advisory avec la mention « ouverture prévue » et la preuve qui te manque encore pour la lancer. Quarante-cinq minutes, pas plus : c'est un brouillon de travail, la mise en page viendra dans la leçon sur la page d'offre.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Fiche d'offre en six lignes","description":"Un gabarit à remplir pour chaque ligne d'offre : nom, cible, trois puces de contenu, prix, durée d'engagement et une exclusion.","kind":"template","url":null},{"title":"Checklist de périmètre et d'exclusions","description":"La liste des demandes hors périmètre à écarter ou facturer à part : site web, graphisme print, newsletter, événementiel, avis Google.","kind":"checklist","url":null},{"title":"Urssaf — simulateur de revenus indépendant","description":"Pour calculer ce que ton TJM et tes forfaits mensuels laissent réellement après cotisations avant de fixer tes prix.","kind":"link","url":"https://www.urssaf.fr"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'ebea35d2-1f38-4e83-913b-7d2be84d8049'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '4c0a71c5-9921-4110-853d-ef41ca53710a'::uuid, m.id, m.course_id, m.org_id, 'methodologie-speed', $sq$La méthodologie SPEED : les cinq étapes, ce qu'elles produisent, comment les vendre$sq$, $sq$Les cinq étapes de SPEED détaillées avec leur livrable : audit de 15-20 pages à trois constats (Situation), plateforme de positionnement (Positionnement), charte éditoriale avec matrice piliers-formats-réseaux (Expression), planning et process de validation (Exécution), reporting mensuel commenté (Données). La leçon montre comment la méthode découpe tes offres — stratégie one-shot à 1 500-3 000 € HT, retainer mensuel — et structure ton call de découverte en deux minutes.$sq$, $sq$## L'accroche

Deux freelances présentent la même prestation au même prospect. Le premier dit : « je peux gérer vos réseaux, faire vos posts, vos publicités ». Le second dit : « je travaille en cinq étapes : d'abord un audit, ensuite votre positionnement, puis la stratégie éditoriale, ensuite la production, et chaque mois un reporting qui décide de la suite ». Même compétence, même tarif. Le second signe, parce qu'il vend un chemin — et le prospect, qui n'y connaît rien, a besoin de voir le chemin pour acheter. C'est exactement le rôle d'une méthodologie. La nôtre s'appelle SPEED : Situation, Positionnement, Expression, Exécution, Données. Cinq étapes, cinq livrables, et une conséquence directe : ton devis, ton call de vente et ton organisation de travail découlent tous de la même structure. Dans cette leçon, on passe chaque étape en revue — ce qu'elle contient, ce qu'elle produit — puis on voit comment la méthode transforme un call de découverte en signature.

## Le contenu

### S — Situation : l'audit

Tu pars de ce qui existe. Trois volets : les réseaux du client — contenus, fréquences, engagement, courbe d'abonnés sur douze mois —, ses données — trafic, conversions, résultats des campagnes passées quand elles existent —, et son marché — trois à cinq concurrents analysés sur les mêmes critères.

Le livrable : un rapport d'audit de 15 à 20 pages, qui se termine par trois constats majeurs. Pas dix : trois. Trois phrases que le client retient et répète à son associé. Durée : une à deux semaines.

### P — Positionnement : niche, promesse, offre

Tu décides de ce que la marque doit incarner sur les réseaux. Pour qui elle parle, ce qu'elle promet, ce qui la distingue des concurrents identifiés à l'étape S.

Le livrable : une plateforme de positionnement — une page de promesse, deux ou trois personas concrets, et le territoire d'expression : ce dont on parle, ce dont on ne parle jamais. C'est le document le plus court de la méthode et le plus décisif : tout le reste s'y réfère.

### E — Expression : la stratégie éditoriale

Tu traduis le positionnement en système de contenu : trois à cinq piliers éditoriaux, les formats par réseau, les fréquences de publication.

Le livrable : la charte éditoriale, avec une matrice piliers × formats × réseaux. Exemple de ligne : pilier « coulisses », format Reel, Instagram, deux fois par mois. Ce document permet à n'importe qui — toi, le client, un remplaçant — de produire un planning cohérent.

### E — Exécution : produire et publier

Le quotidien : planning mensuel soumis à validation, production des contenus, publication, modération des commentaires et messages. C'est l'étape que le client voit, celle qui remplit ses réseaux chaque semaine.

Le livrable : le planning validé et les publications en ligne, plus un process de validation écrit — qui valide, en combien de temps, et ce qui se passe sans réponse. Sans ce process, chaque mois devient une négociation.

### D — Données : mesurer et arbitrer

Chaque mois, tu mesures, tu commentes, tu décides. Pas un export de statistiques : une page d'analyse et trois décisions — on arrête ceci, on double cela, on teste ça.

Le livrable : le reporting mensuel commenté. C'est le livrable le moins spectaculaire et le plus rentable de la méthode : c'est lui qui fait durer le contrat, parce qu'il transforme ta prestation en pilotage. Un client qui comprend ses chiffres ne résilie pas.

### Comment SPEED structure la vente

La méthode découpe naturellement tes offres. S + P + E (Expression) forment la stratégie social media, vendue en one-shot : 1 500 à 3 000 € HT selon la taille du client. E (Exécution) + D forment l'accompagnement mensuel : 800 à 1 500 € HT en starter, 1 500 à 3 000 € en complet. La gestion publicitaire s'y ajoute : 500 à 1 000 € HT par mois en forfait.

En call de découverte, tu déroules SPEED en deux minutes, une phrase par étape, chaque phrase finissant par son livrable. Le prospect voit où il va, ce qu'il reçoit, et dans quel ordre. Ton devis reprend ensuite les mêmes étapes dans le même ordre : ce que tu as raconté au call, il le relit dans le document. Cette continuité rassure plus qu'un portfolio.

Et la méthode te protège. Quand un prospect demande « juste des posts », tu peux montrer pourquoi l'exécution sans audit ni positionnement produit du contenu au hasard — et pourquoi tu ne vends pas ça.

## Exemple appliqué

Une marque e-commerce lifestyle : objets de décoration fabriqués en Europe, 300 000 € de chiffre d'affaires en ligne, 8 000 abonnés Instagram qui stagnent depuis un an.

**S.** L'audit montre que 80 % des posts sont des photos produit sur fond blanc, un taux d'engagement à 0,8 %, aucune story à la une, et deux concurrents directs qui atteignent 3 % d'engagement avec du contenu de mise en scène. Trois constats : le compte est un catalogue, pas une marque ; l'audience existante n'est jamais sollicitée ; aucun contenu ne montre la fabrication, principal argument de la marque.

**P.** Positionnement retenu : l'art de vivre autour de l'objet, pas l'objet seul. Personas : la femme de 30-45 ans qui décore par touches successives, et l'acheteur de cadeaux. Promesse : des objets qui ont une histoire de fabrication.

**E — Expression.** Quatre piliers : coulisses de fabrication, mise en scène chez les clients, UGC et avis, offres et nouveautés. Formats : Reels pour les coulisses, carrousels pour la mise en scène, stories pour l'UGC.

**E — Exécution.** 12 posts par mois, 8 stories, 2 Reels, planning validé le 20 du mois précédent.

**D.** À trois mois : engagement passé de 0,8 % à 2,1 %, chiffre d'affaires attribué au social en hausse de 18 %. Décision du reporting : doubler les Reels coulisses, qui font trois fois la portée moyenne du compte.

Facturation : stratégie 2 500 € HT, accompagnement 1 800 € HT par mois, ads 600 € HT par mois. Un seul client, 2 400 € de récurrent mensuel.

## Les erreurs fréquentes

**Vendre l'exécution sans la situation.** Le client presse : « commencez à publier, on verra la stratégie plus tard ». Trois mois plus tard, les contenus n'ont produit aucun résultat mesurable, et c'est ta compétence qui est mise en cause. L'audit n'est pas une option, c'est ton assurance.

**L'audit de 60 pages.** Personne ne le lit, et le client retient une seule chose : tu factures du volume. 15 à 20 pages, trois constats majeurs, une restitution orale de 45 minutes. La valeur est dans la synthèse, pas dans l'épaisseur.

**Sauter le D.** Sans reporting commenté, le client juge ta prestation sur son impression du moment, et un contrat jugé à l'impression meurt entre le sixième et le neuvième mois. Le reporting est inclus dans le retainer, jamais vendu en option.

**Présenter la méthode comme du jargon.** « Ma méthodologie propriétaire en cinq phases » fait fuir. Tu ne vends pas un acronyme, tu racontes un chemin : « d'abord on regarde où vous en êtes, ensuite on décide quoi dire et à qui, ensuite on produit, et chaque mois on mesure ». SPEED est ta colonne vertébrale, pas ton argument.

**Tout refaire à chaque client.** Si chaque audit repart d'une page blanche, ta méthode ne te fait rien gagner. Construis tes modèles : trame d'audit, gabarit de plateforme de positionnement, matrice éditoriale vierge. Le contenu change à chaque client, la structure jamais. C'est ce qui fait passer un audit de cinq jours à deux.

## Action immédiate

Écris ton pitch SPEED : cinq phrases, une par étape, chacune se terminant par le livrable que le client reçoit. Exemple pour la première : « Je commence par un audit de vos réseaux, de vos données et de vos concurrents, et vous recevez un rapport avec trois constats majeurs. » Puis lis-le à voix haute, chronomètre en main : tu dois tenir en moins de deux minutes. Répète jusqu'à le dire sans notes. C'est ce que tu dérouleras au prochain call de découverte.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Trame d'audit SPEED (étape Situation)","description":"Le plan type du rapport d'audit de 15 à 20 pages : réseaux, données, marché, et la page finale des trois constats majeurs.","kind":"template","url":null},{"title":"Matrice éditoriale piliers × formats × réseaux","description":"Le tableau vierge de l'étape Expression : une ligne par pilier avec format, réseau et fréquence de publication.","kind":"template","url":null},{"title":"Checklist des cinq livrables SPEED","description":"Un point de contrôle par étape pour vérifier qu'aucun livrable ne manque avant de clore une phase chez un client.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"La source des données d'audience et d'engagement nécessaires aux étapes Situation et Données sur Facebook et Instagram.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'ebea35d2-1f38-4e83-913b-7d2be84d8049'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '82571465-a83d-480e-baf6-7f48aa4eef81'::uuid, m.id, m.course_id, m.org_id, 'packager-son-offre', $sq$Packager son offre en une page qui se vend seule$sq$, $sq$La structure d'une page d'offre en cinq blocs ordonnés : promesse en une phrase (cible, résultat, mécanisme), preuve chiffrée et datée, livrables nommés en trois blocs, prix plancher affiché en fourchette, appel à l'action unique avec lien de réservation. La leçon liste aussi ce qu'on retire — biographie, liste d'outils, formules à tiroirs, jargon — et donne le test des dix secondes pour valider la page.$sq$, $sq$## L'accroche

Un prospect t'appelle, le courant passe, il te dit : « envoie-moi un truc que je puisse montrer à mon associé ». Et là, tu n'as rien. Tu bricoles un mail de vingt lignes, tu joins un vieux devis anonymisé, et l'associé — qui ne t'a jamais vu ni entendu — lit un document qui ne vend rien. Le deal meurt entre les deux. C'est le trou dans la raquette de la plupart des freelances : l'offre existe dans leur tête et se reconstruit à chaque devis, mais elle n'existe nulle part sous une forme transmissible. La page d'offre règle ça. Une page, cinq blocs, dans un ordre précis : promesse, preuve, contenu, prix, prochaine étape. Elle se lit en une minute, elle circule sans toi, et elle filtre les prospects sans budget avant même le premier call. Dans cette leçon, on construit chaque bloc — et surtout on liste ce qu'on enlève, parce qu'une page d'offre se juge autant à ce qu'elle ne dit pas.

## Le contenu

### Bloc 1 : la promesse

Une phrase, en haut de page, qui dit trois choses : pour qui, quel résultat, par quel moyen. La formule : « J'aide [cible] à [résultat] grâce à [mécanisme] ». Exemple : « J'aide les marques produit à vendre en ligne grâce à une présence Instagram régulière et pilotée. » Ce qui est interdit ici : « community management sur mesure », « stratégie digitale 360 », « accompagnement personnalisé ». Ces formules décrivent tout le monde, donc personne. Test simple : si un concurrent peut copier ta phrase telle quelle, elle est trop vague.

### Bloc 2 : la preuve

Juste sous la promesse, avant même le contenu de l'offre. L'ordre compte : le lecteur ne s'intéresse à ce que tu fais qu'après avoir vu que ça marche. Deux ou trois chiffres clients, datés et contextualisés : « +34 % de ventes en ligne en 6 mois », « taux d'engagement passé de 0,9 % à 2,4 % en un trimestre ». Un témoignage court — deux phrases, un nom, une entreprise. Des logos si tu en as.

Si tu débutes : les chiffres de tes propres réseaux, un cas documenté de ton ancien poste salarié, ou un premier client pris à tarif réduit et suivi de près. Une preuve modeste et vérifiable bat une promesse énorme et invérifiable.

### Bloc 3 : le contenu de l'offre

Trois blocs maximum, chacun avec trois ou quatre puces de livrables nommés. Pas des activités — des livrables. « Animation de vos réseaux » est une activité. « Planning éditorial mensuel validé par vos soins, 10 posts publiés sur 2 réseaux, modération sous 24 heures ouvrées, reporting mensuel commenté » : des livrables. Le lecteur doit pouvoir cocher mentalement ce qu'il recevra.

Ta méthode structure ce bloc. Les étapes SPEED donnent l'ordre naturel : l'audit et la stratégie d'abord, l'accompagnement mensuel ensuite, la publicité en option.

### Bloc 4 : le prix

Le débat classique : afficher ou pas. Tranche pour la fourchette affichée : « à partir de 900 € HT par mois, engagement 3 mois ». Trois effets. Les prospects sans budget ne réservent pas de call — tu récupères des heures. Ceux qui réservent arrivent en connaissant l'ordre de grandeur — la négociation démarre plus haut. Et l'affichage te positionne : un prix assumé dit que tu sais ce que tu vaux. Ce que tu n'affiches pas : le détail ligne par ligne, qui invite à découper. Le devis précisera ; la page annonce.

### Bloc 5 : la prochaine étape

Un seul appel à l'action : « Réserve un call de 30 minutes », avec un lien de réservation direct. Pas trois options, pas « n'hésitez pas à me contacter », pas une adresse mail qui oblige à rédiger. Le prospect convaincu doit pouvoir agir en dix secondes.

### Ce qu'on retire

Ta biographie en trois paragraphes — une ligne suffit, en pied de page. La liste d'outils — le client achète un résultat, pas ta stack. Les prestations annexes « aussi disponibles » — elles diluent l'offre principale. Les trois formules Bronze, Argent, Or — le comparatif à tiroirs paralyse ; une page porte une offre, et si tu as deux lignes d'offre, fais deux pages. Le jargon — « earned media », « brand content », « funnel » : dehors.

Le format importe peu : un PDF d'une page, une page Notion ou une page web. Le test final, lui, est fixe : montre la page dix secondes à quelqu'un qui ne connaît pas ton métier, puis demande-lui ce que tu vends, à qui, et combien. S'il hésite sur l'une des trois réponses, la page n'est pas finie.

## Exemple appliqué

Claire cible les artisans et marques produit : céramistes, coutellerie, brasseries artisanales, savonneries — des gens qui fabriquent, vendent en ligne et sur les marchés, et n'ont pas le temps de publier. Voici sa page.

Promesse : « J'aide les artisans et marques produit à vendre en ligne grâce à Instagram, sans y passer leurs soirées. »

Preuve : le cas d'un coutelier suivi depuis huit mois — « +34 % de ventes en ligne en 6 mois, 2 800 abonnés gagnés, 12 posts par mois » — et deux phrases de témoignage signées du coutelier, avec le nom de l'atelier.

Contenu, trois blocs. « Stratégie de lancement » : audit du compte, positionnement, charte éditoriale — 1 500 € HT en one-shot. « Accompagnement mensuel » : planning validé ensemble, 10 posts sur Instagram et Facebook, modération, reporting commenté chaque mois — à partir de 900 € HT par mois, engagement 3 mois. « Option publicité » : campagnes Meta pilotées — à partir de 500 € HT par mois.

Prochaine étape : « Réserve un call de 30 minutes », avec le lien de son agenda en ligne.

Ce que ça change dans ses chiffres : avant, chaque premier contact débouchait sur un long mail et un devis personnalisé — environ deux heures par prospect. Maintenant elle envoie la page dans les cinq minutes qui suivent le premier échange. Sur ses vingt derniers envois : sept calls réservés, deux signatures — cohérent avec un closing à 25-30 % — et surtout quatre prospects hors budget qui se sont éliminés seuls en voyant « à partir de 900 € », sans lui coûter un seul rendez-vous.

## Les erreurs fréquentes

**La page qui parle de toi.** « Passionnée de digital depuis dix ans, je mets ma créativité au service de… » Le lecteur cherche son problème, pas ton parcours. Chaque phrase doit parler du client ou du résultat ; ta bio tient en une ligne, tout en bas.

**Les trois formules à tiroirs.** Bronze, Argent, Or avec un tableau comparatif de quinze lignes : le prospect compare les cases au lieu de décider, et choisit souvent de ne rien choisir. Une page, une offre, une option au maximum.

**Aucun prix.** « Tarif sur devis » oblige le prospect à prendre un call pour savoir s'il peut te payer — beaucoup ne le prendront pas, et ceux qui le prennent découvrent parfois que non. Tu perds des heures en rendez-vous morts. Une fourchette plancher suffit.

**La preuve invérifiable.** « +300 % d'engagement » sans période, sans point de départ, sans nom de client : ça sonne inventé, même quand c'est vrai. Un chiffre daté, contextualisé et attribué vaut dix pourcentages spectaculaires anonymes.

**L'appel à l'action mou.** « N'hésitez pas à me contacter pour en discuter » ne déclenche rien : pas de geste précis, pas de lien, pas d'engagement demandé. Un verbe, une durée, un lien : « Réserve un call de 30 minutes. »

## Action immédiate

Ouvre un document vierge et écris la version brute de ta page, sans mise en forme : ta promesse en une phrase avec la formule cible-résultat-mécanisme ; ta meilleure preuve, même modeste, datée et chiffrée ; trois puces de livrables pour ton offre principale ; ton prix plancher en fourchette ; un appel à l'action unique avec le lien de ton agenda. Cinq blocs, une heure maximum. La mise en page attendra : une page moche qui dit la bonne chose bat une belle page vide. Relis, puis fais le test des dix secondes avec un proche dès ce soir.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Gabarit de page d'offre en cinq blocs","description":"La page type à remplir bloc par bloc : promesse, preuve, contenu en trois blocs de livrables, prix en fourchette et appel à l'action unique.","kind":"template","url":null},{"title":"Checklist du test des dix secondes","description":"Les trois questions auxquelles un lecteur extérieur doit savoir répondre après dix secondes : ce que tu vends, à qui, et combien.","kind":"checklist","url":null},{"title":"Calendly","description":"Un outil de prise de rendez-vous en ligne pour transformer ton appel à l'action en lien de réservation direct.","kind":"tool","url":"https://calendly.com"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'ebea35d2-1f38-4e83-913b-7d2be84d8049'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid, c.id, c.org_id, 'acquisition-client', $sq$Acquisition client$sq$, $sq$Ce module couvre toute la chaîne d'acquisition d'un client en freelance social media : le choix des canaux, la prospection outbound, le call de découverte, le traitement des objections et la proposition commerciale. Chaque leçon donne des chiffres de référence, des scripts rédigés mot pour mot et un cas client détaillé pour passer du prospect froid au contrat signé.$sq$, 3, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'c2d3eb09-9b86-4154-ba9a-d9ed17aa3110'::uuid, m.id, m.course_id, m.org_id, 'canaux-qui-marchent', $sq$Les canaux qui marchent réellement en freelance social media$sq$, $sq$Cette leçon hiérarchise les quatre canaux d'acquisition qui rapportent réellement des clients en freelance social media : bouche-à-oreille outillé, LinkedIn personnel, outbound ciblé et partenariats agences. Tu repars avec les chiffres honnêtes de chaque canal — rendement, délai, coût en heures — et une répartition concrète de cinq heures de prospection hebdomadaires.$sq$, $sq$## L'accroche

Tu publies trois fois par semaine sur ton propre compte Instagram. Tu soignes tes carrousels, tu réponds à chaque commentaire, tu as même acheté un pack de templates. Bilan après six mois : 840 abonnés, deux demandes de tarif, zéro client signé. Pendant ce temps, une consœur qui ne poste presque jamais vient de signer son cinquième retainer. La différence entre elle et toi, ce n'est pas le talent. C'est le canal. En freelance social media, les canaux qui rapportent des clients ne sont pas ceux qu'on te vend dans les formations grand public. Dans cette leçon, je te donne la hiérarchie réelle des canaux d'acquisition, avec les chiffres honnêtes pour chacun : ce qu'il rapporte, en combien de temps, et combien d'heures il te coûte. À la fin, tu sauras exactement où placer tes cinq heures de prospection hebdomadaires.

## Le contenu

Quatre canaux méritent ton temps. Je les classe par rentabilité à long terme, pas par facilité de démarrage — la nuance compte, parce que tu ne démarreras pas par le premier.

### Canal 1 : le bouche-à-oreille outillé

Chez les freelances installés depuis deux ans ou plus, 50 à 70 % des nouveaux clients arrivent par recommandation. C'est le canal le plus rentable : cycle de vente court, pas de mise en concurrence, confiance déjà installée. Le piège, c'est le mot « attendre ». Le bouche-à-oreille passif produit un client par an. Le bouche-à-oreille outillé, c'est trois gestes que tu déclenches toi-même.

Premier geste : la demande de recommandation à J+90. Quand tu livres ton troisième reporting mensuel et que les chiffres sont bons, tu demandes, à l'oral, en fin de point mensuel : « Est-ce que tu connais un ou deux dirigeants qui se posent les mêmes questions que toi il y a trois mois ? Une mise en relation par mail me suffit. » Ce moment précis — des résultats frais, la relation au beau fixe — multiplie tes chances par rapport à une demande à froid.

Deuxième geste : l'étude de cas d'une page par client. Le contexte en trois lignes, ce que tu as fait, trois chiffres avant-après. C'est l'outil que ton client transfère quand il te recommande : sans elle, il dit « elle est bien » ; avec elle, il envoie une preuve.

Troisième geste : réactiver ton réseau dormant deux fois par an. Anciens collègues, camarades de formation, ex-clients. Un message individuel, jamais un post générique.

Les chiffres honnêtes : sur 10 demandes de mise en relation, 2 à 3 débouchent sur une conversation, et 1 sur un client. Délai : un à trois mois. Coût : deux heures par mois. Le problème évident : il te faut déjà des clients. C'est pour ça qu'il vient en premier en rentabilité et en dernier en chronologie.

### Canal 2 : LinkedIn personnel

Tes clients sont des dirigeants de PME. Ils ne sont pas sur Instagram à regarder des freelances : ils sont sur LinkedIn. Deux à trois posts par semaine suffisent : études de cas, avant-après chiffrés, coulisses de méthode. Pas de posts sur le freelancing — ça attire des freelances, pas des clients.

Les chiffres honnêtes : trois à six mois avant la première demande entrante sérieuse. LinkedIn n'est pas un canal de volume, c'est un canal de preuve. Sa vraie fonction : quand tu prospectes en direct, le prospect visite ton profil dans les 24 heures. Un profil actif avec des cas clients transforme un message froid en message crédible. Coût : trois heures par semaine, rédaction comprise.

### Canal 3 : l'outbound ciblé

Le seul canal que tu contrôles entièrement : tu décides qui tu contactes, quand, et en quel volume. Les chiffres de référence, tu vas les retrouver dans toute la suite du module : sur 100 prospects contactés proprement, 8 à 12 réponses, 2 à 4 rendez-vous. Avec un closing à 25-30 % en call de découverte, ça fait environ un client pour 100 contacts. Délai : deux à six semaines entre le premier message et la signature. C'est le canal de démarrage et le canal de remplissage quand un client s'arrête. La leçon suivante lui est entièrement consacrée.

### Canal 4 : les partenariats agences

Les agences web, les studios de création et les agences de communication généralistes ont des clients qui demandent du social media, et personne pour le faire. Tu te présentes, tu apportes une étude de cas, tu proposes d'être leur ressource. En sous-traitance, ton TJM baisse de 15 à 20 % — tu factures 350 € HT là où tu vendrais 420 € en direct — mais tu n'as ni prospection ni avant-vente, et le flux est récurrent.

Les chiffres honnêtes : sur 10 agences contactées localement, 3 à 4 acceptent un café, 1 à 2 envoient une première mission dans les six mois. Garde-fou : jamais plus de 30 % de ton chiffre d'affaires en sous-traitance, sinon tu dépends d'un donneur d'ordre qui peut internaliser du jour au lendemain.

### Les canaux qui ne marchent pas pour démarrer

Les plateformes type Malt : la concurrence s'y joue au prix, les TJM affichés tombent à 250-300 €, loin de tes 350-550 € cibles. La publicité pour toi-même : 500 € de budget Meta produisent des curieux, pas des dirigeants de PME. Instagram pour toi-même : tu y construis une audience de pairs qui applaudissent, pas de clients qui signent.

### La répartition de tes heures

Cinq heures par semaine en phase de lancement : deux heures d'outbound, deux heures de LinkedIn, une heure pour le bouche-à-oreille et les partenariats. Une fois installé — 4 à 6 clients, 5 000 à 8 000 € HT mensuels — tu inverses : le bouche-à-oreille outillé et les partenariats tournent, l'outbound ne se rallume que quand un contrat se termine.

## Exemple appliqué

Prenons Claire, freelance social media à Angers, deux ans d'activité, quatre clients. En mars, elle livre son troisième reporting à l'une de ses clientes, une marque de cosmétiques : les ventes venues d'Instagram ont progressé de 22 % sur le trimestre. En fin de point mensuel, elle pose sa question de mise en relation. Sa cliente pense à une amie entrepreneuse : la fondatrice d'une savonnerie artisanale, 9 salariés, deux boutiques et un site marchand. Le compte Instagram de la savonnerie plafonne à 3 400 abonnés et n'a rien publié depuis cinq mois — la salariée qui s'en occupait est partie.

Le mail de mise en relation part le vendredi, avec l'étude de cas d'une page en pièce jointe. Le mardi suivant, Claire a un appel de trente minutes avec la fondatrice. Trois semaines plus tard, elle signe un retainer starter à 950 € HT par mois : Instagram et Facebook, dix publications mensuelles, reporting commenté. Compare avec son dernier client signé en outbound : 87 messages envoyés, six semaines de cycle, une mise en concurrence avec une agence locale. Ici : une demande orale, un document d'une page, zéro concurrent. C'est ça, un bouche-à-oreille outillé — le même canal que tout le monde, mais provoqué au bon moment, avec le bon support.

## Les erreurs fréquentes

Attendre le bouche-à-oreille au lieu de l'outiller. « Mes clients sont contents, ils parleront de moi » : non. Un client satisfait ne pense pas à toi spontanément. Sans demande explicite et sans étude de cas à transférer, sa satisfaction ne produit rien.

Confondre visibilité et acquisition. Poster, c'est de la visibilité. Prospecter, c'est de l'acquisition. Trois heures de création de contenu pour ton compte ne remplacent pas trente minutes de messages ciblés. Si tu dois choisir, choisis les messages.

Tout miser sur un seul canal. L'outbound seul t'épuise, LinkedIn seul est trop lent, le bouche-à-oreille seul est trop aléatoire. Deux canaux actifs minimum, en permanence.

Refuser la sous-traitance par fierté. « Je ne veux pas être invisible derrière une agence » : à 350 € le jour sans un centime de prospection, la sous-traitance finance tes débuts pendant que tes autres canaux montent. Tu la réduiras quand ton direct suffira.

Changer de canal toutes les trois semaines. LinkedIn demande trois à six mois, l'outbound quatre à six semaines. Abandonner avant le délai incompressible du canal, c'est payer le coût sans jamais toucher le résultat.

## Action immédiate

Dans l'heure qui vient : liste dix personnes qui savent ce que tu fais — anciens collègues, ex-clients, camarades de formation. Choisis-en trois et envoie à chacune ce message, adapté : « Bonjour Marc, je me lance à fond sur l'accompagnement social media des PME. Si tu croises un dirigeant qui n'a pas le temps de s'occuper de ses réseaux, tu peux nous mettre en relation par mail ? Je t'envoie une page qui résume ce que je fais, ça prend deux minutes à transférer. » Trois messages partis avant ce soir. C'est ton premier geste de bouche-à-oreille outillé.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Tableau de suivi des canaux d'acquisition","description":"Un tableur qui suit, canal par canal, les contacts engagés, les rendez-vous obtenus et les clients signés chaque mois.","kind":"template","url":null},{"title":"Checklist du bouche-à-oreille outillé","description":"Les trois gestes à déclencher — demande de mise en relation à J+90, étude de cas d'une page, réactivation du réseau dormant — avec leurs formulations types.","kind":"checklist","url":null},{"title":"LinkedIn","description":"Le réseau où se trouvent les dirigeants de PME que tu cibles, à la fois vitrine de preuve et canal de prospection.","kind":"link","url":"https://www.linkedin.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0605b953-d952-4f48-9fb1-219c15cd7ac1'::uuid, m.id, m.course_id, m.org_id, 'prospection-outbound', $sq$Prospection outbound : ciblage, séquences, taux à atteindre$sq$, $sq$Cette leçon construit ta machine de prospection outbound : une liste de prospects qualifiés par signaux d'achat, une séquence de trois messages rédigés, et les taux de référence à surveiller. Tu apprends à viser 8 à 12 réponses et 2 à 4 rendez-vous pour 100 contacts, et à diagnostiquer précisément ce qui bloque quand les chiffres décrochent.$sq$, $sq$## L'accroche

Le mois dernier, tu as envoyé trente messages sur LinkedIn. Le même, copié-collé : « Bonjour, je suis freelance en social media, auriez-vous des besoins sur le sujet ? » Résultat : deux « non merci » polis et vingt-huit silences. Conclusion tentante : « la prospection ne marche pas dans mon secteur ». Faux. Ce qui ne marche pas, c'est un message générique envoyé à une liste qui n'existe pas. L'outbound bien fait produit des chiffres stables et documentés : sur 100 prospects contactés, 8 à 12 réponses et 2 à 4 rendez-vous. C'est le seul canal d'acquisition que tu contrôles de bout en bout — pas d'algorithme, pas d'attente, pas de chance. Dans cette leçon, on construit ta machine en trois pièces : la liste, la séquence de trois messages, et le tableau de bord des taux qui te dit exactement quoi corriger quand ça ne signe pas.

## Le contenu

### La liste : 60 % du résultat

Un message moyen sur une bonne liste bat un excellent message sur une mauvaise liste. Trois critères pour construire la tienne.

Le secteur : un seul à la fois, que tu comprends. Si tu as travaillé en retail, commence par le commerce et l'e-commerce. Un secteur unique te permet de réutiliser tes observations d'un prospect à l'autre et de parler leur langue dès le premier message.

La taille : 10 à 100 salariés. En dessous de 10, le budget de 800 à 1 500 € HT mensuels d'un retainer starter est rarement disponible. Au-dessus de 100, la décision passe par un service marketing et un processus d'achat de trois mois. Entre les deux, le dirigeant décide seul et vite.

Les signaux d'achat, le critère décisif : un compte Instagram ou LinkedIn inactif depuis plus de deux mois ; une publicité Meta active — visible dans la bibliothèque publicitaire, qui est publique — alors que l'organique est mort ; une offre d'emploi de community manager publiée il y a quatre mois et jamais pourvue ; une ouverture de boutique, une levée de fonds, un nouveau site. Un signal, c'est une raison de contacter maintenant, et c'est la matière première de ton premier message.

Ton outil : un tableur à sept colonnes. Entreprise, prénom et rôle du décideur, canal de contact, signal observé, date du message 1, dates des relances, statut. Où trouver les prospects : la recherche LinkedIn par secteur et région, la presse économique régionale, les annuaires de zones d'activité, et la bibliothèque publicitaire Meta pour repérer qui dépense. Compte quatre à cinq heures pour cent lignes propres. Et retiens : 50 prospects qualifiés avec un signal battent 300 adresses grattées en vrac.

### La séquence : trois messages, pas un

Message 1, jour J : une observation précise, une question courte. Pas de pitch, pas de lien, pas de tarif, quatre phrases maximum. Exemple : « Bonjour Julie, je suis tombé sur le compte Instagram de Maison Brune : 21 000 abonnés, mais rien de publié depuis le 12 février alors que vos publicités tournent. C'est un choix de votre part, ou un sujet en attente ? Je pose la question parce que j'accompagne des marques comme la vôtre sur exactement ça. » L'objectif n'est pas de vendre : c'est d'obtenir une réponse.

Message 2, jour J+4 : un apport de valeur, jamais une relance sèche. « Avez-vous vu mon message ? » n'apporte rien. Donne quelque chose : « En regardant vos avis clients, j'ai vu une note de 4,8 sur 5 sur plus de 900 avis — et aucun n'est repris dans vos contenus. C'est en général le levier le plus rapide dans votre secteur. Si le sujet vous parle, je vous montre deux exemples en quinze minutes. »

Message 3, jour J+10 : la clôture polie qui libère. « Je ne veux pas insister : si le sujet n'est pas d'actualité, dites-le-moi et je ferme le dossier. Si c'est juste un mauvais timing, je peux revenir vers vous en septembre. » Ce message obtient des réponses parce qu'il rend le « non » facile — et un « non » daté vaut mieux qu'un silence.

Point crucial : environ 60 % des réponses arrivent sur les messages 2 et 3. S'arrêter au premier message, c'est jeter plus de la moitié de tes résultats. Le canal suit le décideur : LinkedIn s'il y est actif, l'email sinon — l'adresse se trouve sur le site ou se déduit du format des adresses de l'entreprise.

### Les taux et le rythme

La chaîne complète : 100 contactés, 8 à 12 réponses dont la moitié de refus polis, 2 à 4 rendez-vous, et avec un closing de 25 à 30 % en call de découverte, environ un client signé. Retiens l'ordre de grandeur : un client pour cent contacts propres.

Le rythme qui tient dans la durée : 25 nouveaux contacts par semaine, plus les relances programmées, soit trois à quatre heures hebdomadaires. En un mois, tu as couvert tes cent contacts.

Tes seuils d'alerte, à lire dans ton tableur. Moins de 5 réponses sur 100 : ton message 1 est générique ou ta liste est floue — revois le ciblage avant de tout réécrire. Des réponses mais aucun rendez-vous : tu pitches trop tôt, ton message 2 vend au lieu de donner. Des rendez-vous mais aucune signature : le problème n'est plus la prospection, c'est le call — et c'est la leçon suivante.

### Le suivi : rien ne se perd

Chaque ligne porte un statut : à contacter, message 1 envoyé, relancé, répondu, rendez-vous, perdu, à recontacter dans trois mois. Un « pas maintenant » n'est pas un déchet : c'est un prospect tiède avec une date. Chez les freelances qui tiennent leur tableur, environ une signature sur cinq vient du recyclage de ces lignes-là, six mois plus tard, pour un coût quasi nul.

## Exemple appliqué

Cas e-commerce lifestyle. Maison Brune, marque de décoration et de linge de maison, 18 salariés, siège à Nantes, vente en ligne et deux boutiques. Le signal repéré : 21 000 abonnés Instagram, trois publications sur les soixante derniers jours, et deux publicités Meta actives dans la bibliothèque publicitaire — l'entreprise paie pour exister pendant que son organique meurt.

Message 1 adressé à la fondatrice sur LinkedIn un mardi à 8 h 30 : celui cité plus haut, mot pour mot. Pas de réponse. Message 2 à J+4, avec l'observation sur les 900 avis clients à 4,8 jamais exploités en contenu. Réponse le lendemain : « C'est exactement notre point faible, on n'a personne dessus depuis un départ en congé maternité. Vous êtes disponible la semaine prochaine ? » Call de découverte de trente minutes, proposition, signature : un accompagnement éditorial à 1 200 € HT par mois, deux réseaux, douze publications.

Le bilan du trimestre de prospection qui a produit ce client : 87 contacts dans le secteur maison et lifestyle, 9 réponses, 3 rendez-vous, 1 signature. Exactement dans les fourchettes annoncées. Ce n'est pas spectaculaire, c'est prévisible — et c'est précisément ce qu'on demande à un canal d'acquisition.

## Les erreurs fréquentes

Le message centré sur toi. « Je suis freelance, je propose, j'accompagne » : trois phrases qui parlent de toi, zéro qui parle du prospect. Inverse la proportion : deux phrases sur son compte, une sur toi.

La liste trop large. « Toutes les PME des Pays de la Loire » n'est pas une liste, c'est un annuaire. Sans secteur commun ni signal, chaque message repart de zéro et ta personnalisation prend vingt minutes par prospect au lieu de trois.

Abandonner après un message. Tu perds les 60 % de réponses qui arrivent en relance. La séquence de trois messages n'est pas du harcèlement : c'est trois contacts en dix jours, puis le silence.

Prospecter par vagues. Trois semaines à fond en janvier, plus rien jusqu'en avril : ton pipeline se vide, ton chiffre d'affaires fait des dents de scie, et tu reprends à zéro à chaque fois. 25 contacts par semaine, toutes les semaines, même quand tu es plein — surtout quand tu es plein.

Vendre le retainer dès le premier message. Personne ne signe 1 200 € par mois sur un message LinkedIn. L'objectif unique du message est le rendez-vous. Le rendez-vous vend le reste.

## Action immédiate

Ouvre un tableur maintenant. Crée les sept colonnes : entreprise, décideur, canal, signal, date message 1, relances, statut. Choisis un secteur que tu connais, et remplis 25 lignes — avec, pour chaque ligne, un signal observé et vérifiable : compte inactif, publicité active, recrutement raté. N'envoie aucun message aujourd'hui : une liste propre d'abord, les messages demain matin, à partir des trois modèles fournis en ressource. Compte une heure, pas plus.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Modèles des trois messages de séquence","description":"Les trois messages rédigés — observation, apport de valeur, clôture polie — avec les zones à personnaliser pour chaque prospect.","kind":"template","url":null},{"title":"Tableur de prospection à sept colonnes","description":"La structure complète du fichier de suivi : entreprise, décideur, canal, signal observé, dates d'envoi, relances et statut.","kind":"template","url":null},{"title":"Bibliothèque publicitaire Meta","description":"L'outil public qui montre les publicités actives d'une entreprise, ton meilleur détecteur de signaux d'achat.","kind":"tool","url":"https://www.facebook.com/ads/library"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '72b93fed-cbc9-48d5-9aa7-032db2dc078b'::uuid, m.id, m.course_id, m.org_id, 'call-de-decouverte', $sq$Le call de découverte : questions, structure, cadrage budget$sq$, $sq$Cette leçon donne la trame du call de découverte en cinq temps — cadrage, situation, enjeu, budget, prochaine étape — avec les questions de qualification rédigées mot pour mot. Tu apprends notamment à annoncer ta fourchette de prix sans gêne et à ne jamais raccrocher sans une étape datée dans l'agenda.$sq$, $sq$## L'accroche

Quarante-cinq minutes de call. Tu as présenté ton parcours, déroulé tes offres, montré trois exemples de posts, expliqué ta vision du contenu. Le prospect a hoché la tête, dit « c'est très intéressant », promis de revenir vers toi. Il n'est jamais revenu. Ce scénario, tu l'as peut-être déjà vécu — et le diagnostic est toujours le même : tu as fait une démonstration, pas une découverte. Un call de découverte ne sert pas à convaincre. Il sert à comprendre la situation du prospect, à qualifier son budget, et à décider — dans les deux sens — si vous devez travailler ensemble. Les freelances qui closent 25 à 30 % de leurs calls ne parlent pas mieux que toi : ils parlent moins. Dans cette leçon, je te donne la trame en cinq temps, les questions qui qualifient vraiment, et la façon d'amener le budget sans gêne — le moment que presque tout le monde rate.

## Le contenu

Format cible : trente minutes, en visio. Ratio de parole : 30 % toi, 70 % le prospect. Si tu ressors d'un call en ayant beaucoup parlé, tu as perdu.

### Avant le call : quinze minutes de préparation

Regarde le profil LinkedIn du dirigeant, les comptes sociaux de la marque, le site, et la bibliothèque publicitaire Meta. Note trois observations factuelles : « compte inactif depuis mars », « publicités actives », « avis clients excellents jamais exploités ». Règle simple : ne jamais poser en call une question dont la réponse est publique. Demander « vous êtes sur quels réseaux ? » à quelqu'un dont tu aurais pu regarder les comptes te déclasse immédiatement.

### Temps 1 — le cadrage : trois minutes

Ouvre en annonçant le déroulé : « Je vous propose qu'on prenne trente minutes. Je vais surtout vous poser des questions sur votre situation, en fin d'appel je vous dis franchement si je peux vous aider et comment, et on décide ensemble de la suite. Ça vous convient ? » Cette phrase fait trois choses : elle borne la durée, elle t'installe comme celui qui mène l'entretien, et elle annonce qu'une décision sera prise. Un call cadré n'a plus rien d'un interrogatoire ni d'un pitch : c'est une consultation.

### Temps 2 — la situation : douze minutes

Le cœur du call. C'est le S de SPEED — la Situation — en version orale et commerciale : un mini-audit par les questions. Les cinq qui qualifient :

« Qui s'occupe des réseaux aujourd'hui, et combien de temps ça lui prend réellement ? » Tu apprends l'organisation — et souvent que personne ne s'en occupe vraiment.

« Qu'est-ce que vous avez déjà essayé ? Qu'est-ce qui a marché, qu'est-ce qui n'a pas marché ? » Tu apprends la maturité et les cicatrices : un prospect déçu d'une agence s'aborde autrement qu'un débutant.

« Aujourd'hui, vos clients viennent d'où, concrètement ? » Tu apprends où le social media se situe dans leur machine commerciale.

« Pourquoi vous en occuper maintenant, et pas il y a six mois ? » La question la plus importante du call. Elle révèle le déclencheur : un concurrent devenu visible, un départ dans l'équipe, une baisse d'activité, un appel d'offres perdu. Le déclencheur, c'est l'urgence réelle — et c'est lui qui fera signer.

« Qui d'autre que vous participe à la décision ? » Tu apprends si ton interlocuteur signe seul ou s'il faudra convaincre un associé absent du call.

Pendant tout ce temps, note les phrases du prospect mot pour mot. Ses formulations exactes serviront dans ta proposition commerciale — c'est la leçon 3.5.

### Temps 3 — l'objectif et l'enjeu : cinq minutes

« Dans six mois, qu'est-ce qui vous ferait dire que c'était un bon investissement ? » Puis chiffre la réponse avec lui : « Un client de plus par mois, ça représente quoi en chiffre d'affaires pour vous ? » Un enjeu chiffré par le prospect lui-même vaut tous tes arguments : ce n'est plus toi qui justifies ton tarif, c'est son propre chiffre. Retiens-le, il ressortira au moment du budget et dans la propale.

### Temps 4 — le budget : cinq minutes

Le moment que les freelances esquivent par gêne — et cette gêne coûte des heures de propositions écrites pour rien. Deux outils, dans cet ordre.

La question d'antériorité : « Sur ce sujet, vous avez déjà investi combien — outils, publicité, prestataire, agence ? » Une entreprise qui a déjà dépensé possède une référence de prix. Une entreprise qui n'a jamais mis un euro dans sa visibilité signera rarement un retainer à 1 200 € par mois : c'est une information, pas un jugement.

La fourchette annoncée : « Pour situer les choses, mes accompagnements mensuels démarrent à 900 € HT et vont jusqu'à 2 500 € selon le périmètre. Est-ce que c'est un ordre de grandeur envisageable pour vous ? » Trois réponses possibles. Oui : tu continues. Hésitation : tu creuses le périmètre — peut-être qu'un démarrage plus réduit convient. Non ferme : tu viens d'économiser quatre heures de proposition commerciale. Annoncer une fourchette n'a jamais fait fuir un prospect qui avait le budget ; ne pas l'annoncer fait perdre des semaines avec ceux qui ne l'ont pas.

### Temps 5 — la prochaine étape : cinq minutes

Jamais « je vous envoie un devis et vous me direz ». Toujours une étape datée, posée dans l'agenda avant de raccrocher : « Je vous envoie une proposition d'ici jeudi. Je vous propose vingt minutes lundi à 14 h pour la parcourir ensemble — je préfère vous la présenter que vous laisser seul avec un PDF. » Une proposition présentée en direct se signe environ deux fois plus qu'une proposition envoyée dans le vide, parce que les objections se traitent à chaud au lieu de tuer le dossier en silence.

## Exemple appliqué

Cas transport premium B2B. Une société de chauffeurs privés pour cadres dirigeants et délégations d'entreprise, 22 salariés, basée à Lyon. Rendez-vous obtenu en outbound. Préparation : page LinkedIn inactive depuis huit mois, site daté, aucune publicité en cours.

Temps 2, les questions font tomber les informations une par une : personne ne gère les réseaux depuis le départ de l'assistante de direction ; 80 % du chiffre d'affaires repose sur trois comptes grands groupes — une fragilité que la dirigeante nomme elle-même. La question du déclencheur fait mouche : « On a perdu un appel d'offres le mois dernier. L'acheteur nous a dit qu'on manquait de visibilité, qu'on ne faisait pas moderne. » Voilà l'urgence réelle.

Temps 3 : un compte grand groupe gagné représente 40 000 à 60 000 € de chiffre d'affaires annuel. L'enjeu est posé, par elle, pas par le freelance.

Temps 4 : antériorité — 800 € par mois partent déjà en publicité Google, gérée par une agence web. La fourchette de 900 à 2 500 € passe sans friction : l'entreprise sait déjà dépenser pour sa visibilité.

Temps 5 : proposition jeudi, restitution mardi à 9 h, posée dans l'agenda pendant le call. Résultat la semaine suivante : un accompagnement à 1 500 € HT par mois, centré sur LinkedIn — le réseau où vivent ses acheteurs. Durée totale du call : trente-quatre minutes, dont dix où le freelance a parlé.

## Les erreurs fréquentes

Pitcher pendant vingt minutes. Présenter tes offres avant d'avoir compris la situation, c'est prescrire avant d'ausculter. Le prospect ne retient rien, et toi non plus — tu n'as rien appris qui te serve à vendre.

Esquiver le budget par politesse. Résultat : quatre heures de proposition pour découvrir que le budget réel était de 300 € par mois. La fourchette annoncée en call est un filtre, pas une agression.

Terminer sans étape datée. « Je vous envoie ça et on se tient au courant » : le dossier meurt dans une boîte mail. La restitution se pose dans l'agenda avant de raccrocher, sans exception.

Qualifier tout le monde. Un call réussi peut conclure : « Je ne suis pas la bonne personne pour vous. » Accepter un client sans budget ou sans besoin réel, c'est acheter trois mois de frustration et une rupture de contrat.

Ne pas noter les mots exacts du prospect. « On manque de visibilité, on ne fait pas moderne » : cette phrase, replacée en première page de ta proposition, vaut plus que tout ton argumentaire. Si tu ne la notes pas en call, elle est perdue.

## Action immédiate

Écris ta trame sur une page, maintenant : les cinq temps avec leur minutage — cadrage 3 minutes, situation 12, enjeu 5, budget 5, prochaine étape 5. Sous chaque temps, rédige deux questions mot pour mot, dont obligatoirement la question d'antériorité et ta phrase de fourchette avec tes vrais tarifs. Puis lis-la à voix haute une fois, en te chronométrant. Au prochain call, cette page est ouverte à côté de ta caméra.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Trame du call de découverte en cinq temps","description":"La page à garder sous les yeux pendant le call : les cinq temps minutés et les questions de qualification rédigées mot pour mot.","kind":"template","url":null},{"title":"Checklist de préparation avant call","description":"Les vérifications à faire en quinze minutes : profil du dirigeant, comptes sociaux, site, publicités actives et trois observations factuelles à noter.","kind":"checklist","url":null},{"title":"Calendly","description":"Un outil de prise de rendez-vous qui permet de poser le call de restitution dans l'agenda avant de raccrocher.","kind":"tool","url":"https://calendly.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'af521942-0f73-44ae-968e-db6c9470f222'::uuid, m.id, m.course_id, m.org_id, 'traiter-les-objections', $sq$Traiter les objections$sq$, $sq$Cette leçon traite les quatre objections qui reviennent dans neuf calls sur dix : le prix, le report à plus tard, la personne déjà en place et le test en interne. Tu repars avec la méthode accueillir-creuser-répondre et une réponse chiffrée prête pour chaque cas, sans jamais baisser ton prix à périmètre égal.$sq$, $sq$## L'accroche

« C'est trop cher. » Trois mots au bout du fil, et tout se joue dans les cinq secondes qui suivent. La plupart des freelances font l'une de ces deux choses : ils bafouillent une justification de leur prix, ou ils lâchent immédiatement une remise — 1 200 € deviennent 900 €, sans contrepartie, en une phrase. Dans les deux cas, ils viennent de perdre : soit le contrat, soit 3 600 € sur l'année et le respect du client. Voici ce que les bons vendeurs savent : une objection n'est pas un refus. C'est une demande d'information déguisée, et souvent le signe que le prospect s'intéresse vraiment — on n'objecte pas à une offre qu'on a déjà écartée. Quatre objections reviennent dans neuf calls sur dix : le prix, le délai, « on a déjà quelqu'un », « on va tester en interne ». Dans cette leçon, tu repars avec une réponse construite pour chacune.

## Le contenu

### La méthode générale : accueillir, creuser, répondre

Avant les réponses, le réflexe. Trois temps, toujours dans cet ordre.

Accueillir : « C'est une vraie question, je comprends. » Jamais de contradiction frontale — « non mais attendez, ce n'est pas cher » braque et ferme la conversation.

Creuser : une question avant toute réponse. Une objection sur deux ne dit pas ce qu'elle semble dire : « trop cher » cache parfois « je ne vois pas ce que j'achète », et « on verra plus tard » cache « mon associé n'est pas convaincu ». Répondre à la mauvaise objection, c'est rater la vraie.

Répondre : court, chiffré, puis re-poser une question pour vérifier que l'objection est levée. Un monologue de trois minutes en réponse à une objection en crée deux nouvelles.

### Objection 1 : « C'est trop cher »

Creuse d'abord : « Trop cher par rapport à quoi ? » Trois réponses possibles, trois traitements.

Par rapport à un budget existant : le problème est le périmètre, pas le prix. Réduis le périmètre — un réseau au lieu de deux, huit posts au lieu de douze, 900 € au lieu de 1 200 €. Le prix baisse parce que le travail baisse. Jamais l'inverse : baisser le prix à périmètre égal annonce que ton premier prix était gonflé.

Par rapport à un concurrent : compare les livrables, pas les montants. « L'agence à 700 € inclut combien de publications, quel reporting, quelle modération ? » Souvent, le devis moins cher couvre moitié moins de choses.

Par rapport à rien — le cas le plus courant : recadre sur l'enjeu chiffré du call de découverte. « Vous m'avez dit qu'un client gagné représente environ 15 000 € par an. L'accompagnement coûte 14 400 € par an. Un seul client gagné le rembourse — et l'objectif qu'on a posé ensemble, c'est un par mois. » C'est exactement pour cette phrase que le temps 3 du call existe.

### Objection 2 : « On verra dans six mois »

Creuse : « Qu'est-ce qui sera différent dans six mois ? » Dans la majorité des cas, rien de précis — le report est un confort, pas une stratégie. Deux leviers.

Chiffrer le coût de l'attente, avec ses propres chiffres : « Vous perdez environ un appel d'offres par trimestre sur un déficit de visibilité — c'est vous qui me l'avez dit. Six mois d'attente, c'est deux de plus. »

Proposer une porte d'entrée réduite : le one-shot. « On peut aussi commencer plus petit : un audit complet et une stratégie social media, à 1 800 € HT, sans engagement mensuel. Vous repartez avec un plan, que vous l'exécutiez avec moi ou sans moi. » Un « plus tard » sur un retainer devient souvent un « oui » sur un projet — et la stratégie vendue en one-shot est le meilleur vestibule du retainer.

### Objection 3 : « On a déjà quelqu'un »

Règle absolue : ne jamais dénigrer la personne en place. C'est parfois l'alternante appréciée de toute l'équipe, parfois la nièce du dirigeant — et dans tous les cas, attaquer quelqu'un de la maison te disqualifie.

Creuse la couverture réelle : « Très bien. Aujourd'hui, elle couvre quoi exactement : la création de contenu, la publicité, la mesure et le reporting ? » Dans huit cas sur dix, la personne fait de la création organique, et ni la publicité ni la mesure. Ton entrée n'est pas de la remplacer, c'est de la compléter : la gestion publicitaire à 500-1 000 € HT par mois, une stratégie en one-shot pour cadrer son travail, ou le reporting mensuel commenté. Entrer en complément, prouver, puis élargir quand le contexte change : c'est le chemin le plus court — et le plus propre — vers l'accompagnement complet.

### Objection 4 : « On va tester en interne »

Ne combats pas : la décision est souvent déjà prise, et l'expérience sera ton meilleur argument dans trois mois. Accompagne le test et pose un rendez-vous : « Bonne idée. Pour que le test soit honnête, je vous conseille de suivre trois chiffres pendant quatre-vingt-dix jours : la régularité — publications prévues contre publiées —, la portée moyenne par publication, et les demandes entrantes. Je vous propose de refaire un point dans trois mois avec ces trois chiffres sur la table. » Mets un rappel dans ton agenda et envoie le message à J+90, sans faute. En interne, la motivation tient en général six semaines : la personne désignée a déjà un métier. Environ un prospect sur trois revient — et il revient sans négocier, parce qu'il a mesuré lui-même ce que ça coûte.

## Exemple appliqué

Cas assurance mutualiste B2C. Une mutuelle santé régionale, une soixantaine de salariés, qui veut rajeunir son recrutement d'adhérents. Call de découverte solide : l'objectif posé est de 200 nouveaux adhérents par an via le digital, et une adhésion représente environ 700 € de cotisation annuelle. Proposition envoyée : un accompagnement complet à 1 800 € HT par mois. Au call de restitution, double objection : « On a déjà une chargée de communication » et « 1 800 €, c'est un gros budget pour nous ».

Accueillir, puis creuser la première : la chargée de communication gère le site, les relations presse, les événements adhérents et les réseaux sociaux. Sur le social, elle publie environ deux heures par semaine, des posts institutionnels, aucune publicité, aucun reporting. La couverture réelle est minime — et personne ne le lui reproche : elle a quatre métiers en un.

Réponse par repositionnement, sans toucher au tarif unitaire : une stratégie en one-shot à 2 400 € HT pour cadrer l'ensemble, puis la gestion publicitaire Meta à 800 € HT par mois avec reporting mensuel commenté — la chargée de communication garde l'organique, alimentée par le planning fourni. Sur l'enjeu : 200 adhérents à 700 €, c'est 140 000 € de cotisations annuelles visées ; les 12 000 € annuels du dispositif s'y comparent d'eux-mêmes. Signature deux semaines plus tard. Huit mois après, la chargée de communication change de poste : le contrat évolue en accompagnement complet à 1 900 € par mois. Ni une remise ni un déni de l'existant n'auraient produit ce résultat.

## Les erreurs fréquentes

Baisser le prix sans contrepartie. La pire réponse possible : elle dit que ton premier prix était faux, elle installe la négociation comme mode de relation, et elle coûte 300 € par mois pendant toute la durée du contrat. Le prix ne bouge qu'avec le périmètre.

Répondre du tac au tac sans creuser. Tu réponds brillamment à une objection qui n'était pas la vraie. Une question d'abord, toujours.

Dénigrer l'existant. « Votre stagiaire fait ça mal » : même si c'est vrai, tu viens d'insulter un choix du dirigeant. Décris ce qui manque, jamais qui échoue.

Prendre un « non » pour un définitif. Sans rappel à J+90, le prospect qui teste en interne est perdu. Avec un rappel et trois chiffres à comparer, un sur trois revient. La différence entre les deux, c'est une ligne dans ton agenda.

Traiter une objection par écrit. Une objection reçue par mail se règle par un appel de dix minutes, pas par trois paragraphes. À l'écrit, tu argumentes dans le vide ; à l'oral, tu creuses.

## Action immédiate

Prends une feuille, trace quatre cases : prix, délai, personne en place, test en interne. Dans chaque case, écris deux lignes mot pour mot : la question pour creuser, puis ta réponse avec tes vrais chiffres — ton tarif mensuel, ton one-shot d'entrée, ta gestion publicitaire. Ensuite, lis chaque réponse à voix haute deux fois. Au prochain call, ces quatre cases sont sous tes yeux : tu n'improviseras plus jamais face à « c'est trop cher ».$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Fiche des quatre objections","description":"Les quatre cases — prix, délai, personne en place, test interne — avec pour chacune la question pour creuser et la réponse chiffrée que tu personnalises avec tes propres tarifs.","kind":"template","url":null},{"title":"Message de suivi à J+90","description":"Le message type à envoyer trois mois après un « on va tester en interne », avec les trois chiffres à demander au prospect.","kind":"template","url":null},{"title":"Checklist accueillir-creuser-répondre","description":"Le réflexe en trois temps à dérouler face à toute objection, avec les formulations d'accueil et les questions de creusage types.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'e5392413-eefa-404c-9192-1515f407d01a'::uuid, m.id, m.course_id, m.org_id, 'proposition-commerciale', $sq$Rédiger une proposition commerciale qui se signe$sq$, $sq$Cette leçon détaille la structure d'une proposition commerciale de sept pages qui confirme la décision prise en call au lieu d'essayer de vendre seule. Tu y construis le rappel du diagnostic avec les mots du prospect, les deux options de prix dont une haute d'ancrage, et la validité limitée à quinze jours.$sq$, $sq$## L'accroche

Ta dernière proposition commerciale : vingt-deux pages, six heures de travail, une partie « notre vision du social media », trois pages sur ton parcours. Réponse du prospect : aucune. Relance : « on regarde ça ». Puis le silence. Le réflexe est d'en conclure qu'il fallait une propale encore plus complète. C'est l'inverse. Une proposition commerciale ne vend pas : elle confirme une décision déjà aux trois quarts prise pendant le call de découverte. Si le prospect n'était pas chaud en call, aucun document ne le rattrapera ; s'il l'était, un document trop long peut le refroidir. Les propositions qui se signent tiennent en sept pages, s'écrivent en moins de deux heures sur une trame, proposent deux options de prix et expirent au bout de quinze jours. Dans cette leçon, on construit la tienne, page par page.

## Le contenu

### Le principe : confirmer, pas convaincre

Ta propale arrive après un call où tu as qualifié le besoin, chiffré l'enjeu et validé une fourchette de budget : elle met par écrit ce qui a déjà été accepté à l'oral. Deux conséquences pratiques : jamais de proposition sans call de découverte préalable — tu écrirais à l'aveugle — et jamais d'envoi sans call de restitution posé dans l'agenda. Temps de rédaction cible : une heure trente sur ta trame.

### La structure en sept pages

Page 1 — le contexte. Pas ta présentation : son diagnostic. Tu reprends la situation du prospect avec ses mots exacts, notés pendant le call — entre guillemets quand la phrase est forte. « Vous nous avez dit : on est le secret le mieux gardé de la ville. » Suivent trois constats factuels issus de ta préparation. C'est la page qui déclenche le « il a parfaitement compris notre situation » — la seule réaction qui fasse signer. C'est le rappel du S de SPEED : la Situation d'abord, toujours.

Page 2 — les objectifs. Deux ou trois, chiffrés et datés, tirés du temps 3 du call. Pas « développer la notoriété » : « soixante réservations de visite par trimestre d'ici six mois ».

Pages 3 et 4 — le dispositif. Des livrables concrets, quantifiés, datés : « douze publications par mois sur deux réseaux, un planning éditorial validé ensemble le 25 du mois précédent, la modération des commentaires sous 24 heures ouvrées, un reporting commenté livré le 5 ». Chaque livrable se relie à un objectif de la page 2. Ce niveau de précision différencie plus qu'un beau design : le prospect voit ce qu'il achète, mois par mois.

Page 5 — les deux options de prix. J'y reviens en détail juste après.

Page 6 — les modalités. Durée d'engagement : trois mois, puis reconduction mensuelle. Date de démarrage. Ce qui n'est pas inclus, écrit noir sur blanc : le budget média, les shootings photo, les frais de déplacement — chaque zone de flou d'aujourd'hui est un conflit dans trois mois. Et la validité de l'offre : quinze jours.

Page 7 — la preuve. Une étude de cas, une seule : contexte en trois lignes, dispositif, trois chiffres de résultat. Puis tes trois lignes de présentation.

### Les deux options de prix

Jamais une option unique : à prendre ou à laisser, le prospect compare alors ton prix à zéro. Jamais trois : la paralysie du choix, et tout le monde prend celle du milieu. Deux options, construites ainsi.

L'option cœur : celle que tu veux vendre, calibrée sur la fourchette validée au call. L'option haute : périmètre élargi, entre 1,5 et 2 fois le prix de l'option cœur. Son rôle est double : elle sert de point d'ancrage — à côté de 1 900 €, 1 100 € paraît raisonnable, alors que seul il paraît cher — et elle se vend réellement une fois sur cinq, ce qui augmente ton panier moyen sans effort. Nomme les options par leur contenu — « Éditorial », « Éditorial + Publicité » — jamais par des niveaux de métal. Silver et Gold ne disent rien de ce qu'on achète.

### La validité limitée : quinze jours, pour une vraie raison

La date de validité n'est pas une astuce de vendeur de cuisines. Elle repose sur une contrainte réelle : tu prends quatre à six clients maximum, et tu ne peux pas réserver une place indéfiniment. Écris-le tel quel en page 6 : « Cette proposition est valable jusqu'au 12 septembre. Au-delà, je ne peux pas garantir la disponibilité au démarrage prévu. » Effet mesurable : la décision se prend en une à deux semaines au lieu de traîner deux mois. Une propale qui traîne est une propale qui meurt — le déclencheur du call refroidit, un concurrent passe, le budget part ailleurs.

### L'envoi : la veille de la restitution, jamais seul

Tu envoies la proposition la veille du call de restitution — vingt minutes posées dans l'agenda dès la fin du call de découverte. Tu parcours les pages dans l'ordre, tu traites les objections à chaud avec la méthode de la leçon précédente, puis tu poses la question de clôture : « Des deux options, laquelle correspond le mieux à là où vous en êtes ? » La question présuppose le choix d'une option, pas le choix de signer. Si la réponse est une objection, tant mieux : tu es là pour la traiter.

## Exemple appliqué

Cas artisan-produit. Une brasserie artisanale, quatorze salariés, deux bars et une distribution en épiceries fines. Claire fait le call de découverte : le fondateur veut développer la vente directe et remplir ses visites de brasserie du samedi, aujourd'hui à moitié vides. Sa phrase, notée mot pour mot : « On est le secret le mieux gardé de la ville. »

La propale de Claire : sept pages, une heure vingt de rédaction sur sa trame. Page 1 : la phrase du fondateur entre guillemets, puis trois constats — 2 900 abonnés Instagram, une publication par semaine sans régularité, aucun contenu sur les visites alors qu'elles sont le produit à plus forte marge. Page 2, deux objectifs : soixante réservations de visite par trimestre, et 25 % d'abonnés locaux en plus sous six mois. Pages 3 et 4 : douze publications par mois sur Instagram et Facebook, une série mensuelle « le brassin du mois », le planning validé le 25, le reporting commenté le 5. Page 5, deux options : « Éditorial » à 950 € HT par mois ; « Éditorial + Publicité » à 1 700 € HT par mois, incluant la gestion d'une publicité locale Meta avec 300 € de budget média et la couverture des deux événements du trimestre. Page 6 : trois mois d'engagement, budget média et shootings exclus, validité quinze jours. Page 7 : l'étude de cas de sa cliente savonnerie.

Restitution le mardi suivant, dix-huit minutes. Le fondateur choisit « Éditorial » — et demande à ajouter la publicité au trimestre deux, une fois les visites relancées. C'est exactement le rôle de l'option haute : elle n'a pas été prise, elle a fait signer l'autre et préparé la montée en gamme.

## Les erreurs fréquentes

Ouvrir sur toi. Ta bio, ta vision, tes valeurs en page 1 : le prospect cherche sa situation et trouve la tienne. Le diagnostic ouvre, ton parcours ferme — trois lignes en page 7.

Proposer une seule option — ou trois. Seule, ton offre se compare à zéro. À trois, le choix se fige. Deux options dont une haute à 1,5-2 fois le prix : c'est le format qui décide le plus vite.

Écrire des livrables flous. « Community management » et « stratégie de contenu » ne disent ni combien, ni quand, ni quoi. Sans quantités ni dates, le prospect ne peut pas évaluer le prix — donc il le trouve trop haut.

Omettre la validité. Une propale sans date de fin traîne trois mois et revient dénaturée : « on la ressort, mais est-ce que vous pouvez refaire un prix ? » Quinze jours, écrits, justifiés par ta capacité réelle.

Envoyer par mail sec. « Voici ma proposition, dites-moi » : les objections naissent dans le silence et tuent le dossier sans que tu les entendes. La restitution de vingt minutes double ton taux de signature — c'est la vente la moins chère de tout ton pipeline.

## Action immédiate

Crée ta trame maintenant : un document de sept pages avec les titres posés — contexte, objectifs, dispositif, options, modalités, preuve — et, dans chaque page, les zones à personnaliser. Pré-remplis la page 5 avec tes deux options réelles et tes tarifs, et la page 6 avec tes modalités standard. Compte cinquante minutes. À la prochaine propale, tu ne partiras plus d'une page blanche : une heure trente maximum, restitution comprise dans l'agenda.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Trame de proposition commerciale en sept pages","description":"Le document réutilisable avec les sept pages titrées, les zones à personnaliser et la page des deux options pré-remplie.","kind":"template","url":null},{"title":"Checklist de relecture avant envoi","description":"Les vérifications finales : mots du prospect en page 1, objectifs chiffrés, livrables quantifiés, validité datée et call de restitution posé dans l'agenda.","kind":"checklist","url":null},{"title":"Canva","description":"Un outil de mise en page gratuit pour habiller ta trame de propale sans y passer plus de trente minutes.","kind":"tool","url":"https://www.canva.com"}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '392d6959-01ca-4c91-9a9e-307aa36fe0f1'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '67f77521-f155-4a5f-bbcc-2c35d5beaca8'::uuid, c.id, c.org_id, 'audit-strategie', $sq$Audit et stratégie$sq$, $sq$Tu apprends à auditer les réseaux d'une marque en 90 minutes, à lire les données existantes et à en tirer des objectifs et des KPIs défendables. Le module se termine par la construction d'une stratégie éditoriale complète : piliers, formats et fréquences tenables.$sq$, 4, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '4f1afe51-38fc-4834-bfc3-7dae4a045f19'::uuid, m.id, m.course_id, m.org_id, 'auditer-en-90-minutes', $sq$Auditer les réseaux d'une marque en 90 minutes$sq$, $sq$Le déroulé minute par minute d'un audit express : inventaire des comptes, analyse des 20 derniers posts, concurrents, signaux business, synthèse en une page. Tu en sors cinq constats chiffrés et une recommandation prioritaire à présenter en rendez-vous de découverte.$sq$, $sq$## L'accroche

Un prospect t'écrit : « On aimerait votre regard sur nos réseaux avant d'aller plus loin. » Tu as deux options. La première : tu passes six heures à tout éplucher, gratuitement, pour un contrat que tu n'as pas encore signé. La deuxième : tu réponds de mémoire, au feeling, et en rendez-vous tu alignes des généralités que le prospect a déjà entendues trois fois. Les deux te coûtent cher. La première te fait travailler gratuit. La deuxième te fait passer pour un amateur. Il existe une troisième voie : l'audit express de 90 minutes. Chronométré, structuré, toujours le même déroulé. Tu en sors cinq constats chiffrés et une recommandation prioritaire. C'est ce qui transforme un call de découverte en démonstration de compétence, et c'est la première brique du S de SPEED, la Situation. Dans cette vidéo, je te donne le déroulé minute par minute.

## Le contenu

### Ce que cet audit est, et ce qu'il n'est pas

L'audit express n'est pas l'audit complet que tu vends dans ta stratégie social media à 1 500-3 000 € HT. C'est un outil commercial et un outil de qualification. Il sert à trois choses : préparer un rendez-vous de découverte, décider si un prospect vaut ton temps, et poser la première couche du S de SPEED quand le contrat démarre. Il se fait avec un chrono réel lancé sur ton téléphone et une grille dans un tableur. Sans chrono, tu ne tiendras pas 90 minutes. Sans grille, tu produiras des impressions au lieu de chiffres.

### De 0 à 15 minutes : l'inventaire

Tu listes tous les comptes de la marque, même les morts. Pour chacun, tu relèves douze points dans ta grille : nombre d'abonnés, date du dernier post, nombre de posts sur les 30 derniers jours, bio, lien en bio et où il mène, cohérence du nom et du visuel entre les réseaux, présence d'une photo de profil à jour, épinglés, stories à la une, réponse aux commentaires, mentions de la marque par des tiers, avis visibles. Quinze minutes suffisent parce que tu ne juges rien : tu relèves. Les signaux d'alerte sortent tout seuls : un compte abandonné depuis sept mois, un lien qui mène vers une page 404, trois noms d'utilisateur différents pour la même marque.

### De 15 à 40 minutes : les contenus

Tu choisis un seul réseau : celui où vit l'audience de la marque, pas celui où elle poste le plus. Tu prends les 20 derniers posts et tu remplis une ligne par post : date, format, sujet, likes, commentaires. Tu calcules l'engagement moyen : likes plus commentaires, divisé par le nombre d'abonnés, multiplié par 100. Puis tu isoles le top 3 et le flop 3, et tu cherches ce qu'ils ont en commun : format, sujet, présence d'un humain, jour de publication. Vingt-cinq minutes ne permettent pas d'analyser trois réseaux en profondeur. Un seul, à fond. Les autres restent au stade de l'inventaire.

### De 40 à 60 minutes : les concurrents

Deux concurrents directs, pas cinq. Pour chacun, la version rapide de ce que tu viens de faire : fréquence de publication, formats dominants, engagement approximatif sur cinq posts, les trois publications les plus performantes visibles. Ce que tu cherches : ce que la marque ne fait pas et que le marché fait déjà. Termine par la Meta Ad Library, publique et gratuite : la marque diffuse-t-elle des publicités ? Et ses concurrents ? Un secteur où personne ne fait de pub est une information stratégique en soi.

### De 60 à 75 minutes : les signaux business

Sans accès aux statistiques, tu regardes ce qui entoure les réseaux : le site (le lien en bio mène-t-il vers une page qui vend ?), la fiche Google et ses avis, la cohérence entre la promesse du site et le contenu publié. Si c'est un client existant et que tu as les accès, tu ouvres Meta Business Suite et tu relèves portée moyenne et clics — mais quinze minutes maximum : la lecture profonde des données est une étape à part entière, c'est la prochaine leçon.

### De 75 à 90 minutes : la synthèse

Une page. Trois forces, trois faiblesses, trois opportunités, une recommandation prioritaire. Chaque ligne porte un chiffre. Pas « le contenu manque de cohérence » mais « 11 des 20 derniers posts sont des visuels produit identiques, à 0,4 % d'engagement, contre 1,8 % sur les 4 posts qui montrent l'équipe ». La recommandation prioritaire est celle qui produit un résultat visible en 90 jours. En rendez-vous, tu sors trois constats, pas la page entière : tu montres la méthode, tu gardes la profondeur pour la stratégie payante. Si le prospect signe, cette page devient le point de départ de l'audit complet.

## Exemple appliqué

Prenons « Berline Plus », transport premium avec chauffeur, Lyon, 14 salariés. Clients : directions commerciales, cabinets d'avocats, organisateurs d'événements. Le dirigeant t'a contacté via une recommandation. Tu lances le chrono la veille du rendez-vous.

Inventaire, 15 minutes : LinkedIn, 640 abonnés, dernier post il y a trois semaines. Instagram, 210 abonnés, abandonné depuis sept mois. Facebook, mort depuis deux ans. Le lien en bio mène vers une page d'accueil générique, sans page « entreprises ».

Contenus, 25 minutes, sur LinkedIn : 20 posts étalés sur quatorze mois, soit 0,3 post par semaine. Seize sont des photos de véhicules avec un texte descriptif. Engagement moyen : 0,9 %. Le top 3 : deux posts où le dirigeant raconte une mission — un client récupéré à 4 h du matin après un vol annulé — à 3,1 % et 2,7 %, et une annonce de recrutement de chauffeur à 2,4 %. Le flop 3 : trois photos de flotte.

Concurrents, 20 minutes : le concurrent A poste deux fois par semaine, alterne témoignages clients et portraits de chauffeurs, et a gagné environ 1 200 abonnés en un an. Ad Library : personne ne diffuse de publicité dans ce secteur sur la région. Terrain libre.

Signaux business, 15 minutes : 32 avis Google à 4,8 de moyenne, jamais exploités en contenu.

Synthèse : la recommandation prioritaire tient en une ligne — LinkedIn seul, deux posts par semaine, deux piliers : la preuve client et l'incarnation du dirigeant. En rendez-vous, tu ouvres avec : « Vos deux meilleurs posts font trois fois votre moyenne, et ce sont les deux seuls où on entend votre voix. » Le prospect voit que tu as regardé. C'est exactement ce qui fait passer un call de découverte dans les 25-30 % qui closent.

## Les erreurs fréquentes

**Dépasser les 90 minutes.** Sans chrono, tu glisses vers quatre heures d'audit gratuit. Le niveau de détail supplémentaire ne fait pas signer plus : ce qui fait signer, c'est trois constats précis, pas quinze.

**Auditer sans grille.** Tu produis des impressions — « le feed manque d'unité » — au lieu de chiffres. Une impression est invérifiable, incomparable d'un prospect à l'autre, et sonne amateur face à un dirigeant habitué aux tableaux de bord.

**Zapper les concurrents.** La marque seule, tu ne sais pas si 0,9 % d'engagement est un problème ou la norme du secteur. Sans point de comparaison, ton diagnostic est une opinion.

**Envoyer l'audit complet avant le rendez-vous.** Quinze pages par mail, et le prospect a récupéré ta valeur gratuitement. Il n'a plus aucune raison de payer une stratégie. Trois constats à l'oral, le reste se vend.

**Analyser trois réseaux en surface.** Trente minutes réparties sur trois réseaux donnent trois analyses creuses. Un réseau à fond donne des constats que personne d'autre n'a sortis.

## Action immédiate

Ouvre un tableur et construis ta grille en trois onglets. Onglet 1, inventaire : réseau, abonnés, date du dernier post, fréquence sur 30 jours, bio, lien. Onglet 2, contenus : date, format, sujet, likes, commentaires, engagement calculé. Onglet 3, synthèse : trois forces, trois faiblesses, trois opportunités, une recommandation. Puis choisis une marque locale que tu connais, lance un chrono de 90 minutes et déroule la méthode en entier. Tu verras exactement où tu perds du temps — c'est là que ta grille doit s'améliorer. Garde le fichier : c'est lui que tu dupliqueras pour chaque prospect à partir de maintenant.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Grille d'audit express","description":"Tableur à trois onglets : inventaire des comptes, analyse des 20 derniers posts avec engagement calculé, synthèse forces-faiblesses-opportunités et recommandation prioritaire.","kind":"template","url":null},{"title":"Les 12 points à relever par réseau","description":"La liste des relevés de l'inventaire : abonnés, date du dernier post, fréquence sur 30 jours, bio, lien, cohérence du nom et du visuel, épinglés, réponses aux commentaires, avis visibles.","kind":"checklist","url":null},{"title":"Meta Ad Library","description":"La bibliothèque publicitaire publique de Meta, pour vérifier gratuitement si une marque ou ses concurrents diffusent des publicités.","kind":"link","url":"https://www.facebook.com/ads/library"},{"title":"Meta Business Suite","description":"L'outil gratuit de Meta où vivent les statistiques Instagram et Facebook d'une marque, à ouvrir dès qu'on a les accès.","kind":"link","url":"https://business.facebook.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '67f77521-f155-4a5f-bbcc-2c35d5beaca8'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'fac1943c-64d2-4ff9-a4e7-f1417b6effc5'::uuid, m.id, m.course_id, m.org_id, 'lire-les-donnees', $sq$Lire les données existantes et repérer les vrais problèmes$sq$, $sq$Où trouver les données existantes (Meta Business Suite, LinkedIn, Google Analytics 4), quels signaux lire sur 6 à 12 mois et comment formaliser un diagnostic en cinq constats chiffrés. La leçon démonte aussi les faux problèmes classiques : algorithme accusé à tort, benchmarks génériques, abonnés qui stagnent, flops isolés.$sq$, $sq$## L'accroche

Le client te dit en rendez-vous : « Instagram ne nous rapporte plus rien, on envisage d'arrêter. » Tu ouvres Meta Business Suite. La portée est stable depuis huit mois. Ce qui s'est effondré, c'est autre chose : les clics vers le site, passés de 300 à 90 par mois. Le problème n'est pas celui que le client raconte. C'est presque toujours le cas : le ressenti du client est une hypothèse, jamais un diagnostic. Ton travail dans le S de SPEED, c'est de confronter ce ressenti aux données qui existent déjà. Elles sont là, gratuites, dans les statistiques natives, et presque personne ne les lit sérieusement. Dans cette vidéo : où chercher, quels signaux comptent vraiment, et les faux problèmes qui font perdre des mois — et parfois des budgets entiers.

## Le contenu

### Où chercher

Tout commence par Meta Business Suite, sur business.facebook.com. L'onglet Statistiques regroupe Instagram et Facebook au même endroit : portée, visites de profil, clics sur le lien, évolution des abonnés, et la performance post par post. Attention à un piège : plusieurs vues sont limitées aux 90 derniers jours. Exporte les données dès le premier jour de la mission, sinon tu perds l'historique au fil de l'eau.

Sur LinkedIn, l'onglet Statistiques d'une page entreprise donne les impressions, le taux d'engagement, et surtout la démographie des abonnés : fonction, secteur, taille d'entreprise. Pour un client B2B, cette démographie vaut plus que tous les likes. Sur TikTok, TikTok Studio donne vues, sources de trafic et rétention.

Et puis il y a la donnée que tout le monde oublie : Google Analytics 4. Les sessions venues des réseaux sociaux, et ce qu'elles font sur le site. C'est la seule source qui relie ton travail au business du client. Demande les accès en lecture avant le premier rendez-vous de travail — mets cette demande dans ton mail d'onboarding, avec la liste exacte : Business Suite, page LinkedIn, GA4.

### Les signaux qui comptent

Premier réflexe : la tendance sur 6 à 12 mois. Un mois isolé ne dit rien — il porte la saisonnalité, un jour férié, un post viral qui fausse tout.

Ensuite, cinq signaux, dans cet ordre. Un : la portée moyenne par post, pas la portée totale, qui dépend mécaniquement du nombre de publications. Deux : le taux d'engagement calculé sur la portée — interactions divisées par portée, fois 100. Calculé sur les abonnés, un compte gonflé de comptes fantômes plombe artificiellement le chiffre. Trois : l'écart entre les cinq meilleurs posts et la médiane. Ce que les cinq ont en commun — format, sujet, jour, présence d'un visage — c'est ta future stratégie éditoriale qui se dessine toute seule. Quatre : les clics et les actions — lien en bio, clics vers le site, prises de contact. C'est le signal qui intéresse le client, même s'il ne sait pas le nommer. Cinq : la corrélation entre fréquence et performance. Superpose le calendrier de publication à la courbe de portée : dans une majorité de cas, les deux racontent la même histoire.

### Les faux problèmes

« La portée baisse, l'algorithme nous a tués. » Vérifie la fréquence d'abord. Le plus souvent, la baisse suit un ralentissement de publication de six à huit semaines. L'algorithme a bon dos : il pénalise rarement, l'irrégularité pénalise toujours.

« Notre taux d'engagement est sous les 3 % qu'il faudrait. » Les benchmarks génériques mélangent des comptes de 500 abonnés et des comptes de 5 millions, tous secteurs confondus. Le seul benchmark défendable, c'est le compte comparé à lui-même six mois plus tôt.

« On ne gagne pas d'abonnés. » Si l'objectif est la vente locale ou le lead, ce n'est peut-être pas un problème du tout. Un compte de 2 000 abonnés qui génère 40 demandes de devis par mois bat un compte de 30 000 abonnés qui n'en génère aucune.

« Ce post a floppé. » Un flop isolé est du bruit statistique. Trois flops du même format sont un signal.

### Formaliser le diagnostic

Cinq constats maximum, chacun en trois temps : le chiffre, la comparaison, la conséquence. Exemple : « Clics vers le site : 90 par mois, contre 310 il y a six mois, soit −71 %. Cause probable : arrêt des stories avec lien en mars. Action : réintroduire trois stories produit par semaine. » Ce format n'est pas qu'un exercice d'audit : c'est exactement la structure de ton futur reporting mensuel commenté, le livrable qui fait durer le retainer.

## Exemple appliqué

Prenons « Maison Luma », e-commerce lifestyle : bougies et objets déco, 22 000 abonnés Instagram, 60 % du chiffre d'affaires en ligne. Le brief de la fondatrice : « Instagram ne vend plus, on veut tout miser sur TikTok. »

Tu prends une heure de lecture avant de répondre. Portée moyenne par post : 4 700, stable sur douze mois. Taux d'engagement sur portée : 3,2 %, en légère hausse. Jusque-là, rien ne va mal. Puis les clics sur le lien : 310 par mois en janvier, 85 en juin. Moins 73 %. Tu croises avec le calendrier : en mars, départ de l'alternante qui publiait quatre stories par semaine avec un lien produit. Depuis, deux stories par mois. Dernier relevé : les cinq meilleurs posts de l'année sont quatre reels de mise en scène produit, à une portée triple de la médiane — et aucun ne mentionne le site ni ne porte de CTA.

Le diagnostic tient en une phrase : Instagram vend moins parce qu'on a arrêté de lui demander de vendre. Ni l'algorithme, ni la plateforme. Ta recommandation : réinstaller trois stories par semaine avec lien, ajouter un CTA aux reels, et reparler de TikTok au trimestre suivant, une fois la mécanique réparée. Trois mois plus tard, les clics remontent à 240 par mois. La cliente a économisé un lancement TikTok précipité — production de vidéos, courbe d'apprentissage, zéro historique — et toi, tu as un cas chiffré qui ouvre ton prochain reporting.

## Les erreurs fréquentes

**Lire 30 jours au lieu de 6 à 12 mois.** Sur un mois, tu confonds saisonnalité et tendance, bruit et signal. Toutes tes conclusions deviennent fragiles, et le client s'en apercevra au premier mois qui contredit ton diagnostic.

**Calculer l'engagement sur les abonnés.** Un compte qui a acheté des abonnés en 2021 ou accumulé des inactifs affiche un taux écrasé, et tu conclus à un problème de contenu qui n'existe pas. La portée est la seule base honnête.

**Adopter le diagnostic du client.** Son ressenti est une hypothèse à vérifier, pas une conclusion à habiller. Si tu construis ta stratégie sur son intuition, tu répares un problème imaginaire et le vrai continue de coûter.

**Sortir 40 métriques.** Le client retient trois chiffres. Au-delà, il ne retient rien — et il choisira lui-même, dans ta masse de données, le chiffre qui baisse.

**Ignorer le site.** Sans GA4, tu ne sais pas si les réseaux amènent quelqu'un quelque part. L'accès en lecture se donne en deux minutes ; le demander te distingue immédiatement de la plupart des freelances.

## Action immédiate

Prends un compte auquel tu as accès — un client, ou ton propre compte. Ouvre Meta Business Suite, exporte les six derniers mois, et calcule trois chiffres : la portée moyenne par post, le taux d'engagement sur portée, les clics moyens par mois. Puis écris un seul constat au format chiffre, comparaison, conséquence. Si tu n'as accès à aucun compte, fais-le sur les données publiques d'une marque : les 20 derniers posts, l'engagement visible, la fréquence. L'objectif de l'exercice n'est pas la perfection, c'est le réflexe : plus jamais de diagnostic sans être passé par les chiffres.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Tableau de lecture sur 6 mois","description":"Export mensuel prêt à remplir : portée moyenne par post, taux d'engagement sur portée, clics vers le site, abonnés nets, fréquence de publication.","kind":"template","url":null},{"title":"Les faux problèmes à écarter","description":"Les quatre diagnostics erronés les plus fréquents et la vérification chiffrée à faire avant de conclure sur chacun.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"Le point d'entrée des statistiques Instagram et Facebook, dont plusieurs vues sont limitées à 90 jours : exporter dès le premier jour de mission.","kind":"link","url":"https://business.facebook.com"},{"title":"Google Analytics","description":"Pour mesurer les sessions venues des réseaux sociaux et relier le travail social media au site du client.","kind":"tool","url":"https://analytics.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '67f77521-f155-4a5f-bbcc-2c35d5beaca8'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ea9894f6-06ce-4949-b150-0ea8d521a7ce'::uuid, m.id, m.course_id, m.org_id, 'objectifs-et-kpis', $sq$Définir des objectifs et des KPIs défendables$sq$, $sq$La chaîne complète pour passer d'un objectif business à une cible chiffrée : objectif social media, KPI principal, KPIs secondaires, méthode de calcul écrite dans la stratégie. Tu apprends à écarter les métriques de vanité et à fixer des cibles à +20-30 % sur six mois à partir de l'historique.$sq$, $sq$## L'accroche

Le rendez-vous de renouvellement. Onze mois que tu accompagnes ce client. Il te pose la question que tous finissent par poser : « Concrètement, qu'est-ce que ça nous a rapporté ? » Si ta réponse c'est « vous êtes passés de 3 000 à 5 200 abonnés », tu viens de perdre le contrat. Pas parce que le chiffre est mauvais — parce qu'il ne répond pas à la question. Un dirigeant ne paie pas 1 200 € par mois pour des abonnés. Il paie pour un effet sur son activité. Les objectifs et les KPIs se définissent au premier mois de la mission, jamais au onzième : ce que tu poses là décide de la conversation de renouvellement un an plus tard. Cette vidéo te donne la méthode pour passer d'un objectif business flou à des KPIs que tu peux défendre chiffres en main.

## Le contenu

### La chaîne : du business au KPI

Tout tient dans une chaîne à cinq maillons : objectif business, objectif social media, KPI principal, KPIs secondaires, cible chiffrée. Tu la remontes toujours dans ce sens, en commençant par une question au client : « Qu'est-ce qui doit changer dans votre activité dans douze mois ? » Pas « que voulez-vous sur Instagram ». Ce qu'il veut sur Instagram, c'est ton métier de le déduire.

L'objectif social media appartient ensuite à l'une de trois familles. La notoriété : être connu de la bonne audience — portée qualifiée, impressions sur la cible. La considération : être envisagé — engagement, trafic vers le site, abonnés qualifiés. La conversion : déclencher un acte — leads, demandes de devis, prises de contact, ventes. Un objectif principal par période de six mois. Deux maximum. Trois objectifs, c'est aucun : tout se dilue, rien ne se pilote.

### Ce qui rend un KPI défendable

Un KPI défendable passe quatre critères. Mesurable : avec les outils réellement en place — pas de « mémorisation de marque » sans étude pour la mesurer. Attribuable : ton travail doit pouvoir l'expliquer — les ventes du site dépendent aussi du site, toi tu réponds des clics et des leads entrants que tu génères. Comparable : même méthode de calcul chaque mois, sinon la courbe ment. Relié : il doit servir l'objectif de la chaîne, pas exister pour lui-même.

La structure : un KPI principal, deux ou trois secondaires, pas plus. Le principal est celui du reporting mensuel, celui dont tu parles en premier chaque mois — et le reporting commenté, rappelle-toi, c'est le livrable qui fait durer le retainer.

Un mot sur les métriques de vanité : le total d'abonnés, les likes cumulés, les impressions brutes. Des chiffres qui montent tout seuls et ne décident de rien. Mais attention à la nuance : aucune métrique n'est une vanity metric en soi. La portée est un excellent KPI pour un objectif de notoriété. Le total d'abonnés est un mauvais KPI pour un objectif de conversion. C'est le lien à l'objectif qui juge, pas la métrique elle-même.

### Fixer des cibles réalistes

La cible sort de l'historique, jamais d'un benchmark. Méthode : tu prends la moyenne des six derniers mois — c'est exactement ce que la leçon précédente t'a fait calculer — et tu appliques une progression de 20 à 30 % à six mois, à condition de changer réellement quelque chose : la fréquence, les formats, les CTA. Pas de multiplication par dix. Un client à 80 clics par mois qui passe à 105 en six mois, c'est une vraie performance ; lui promettre 800 est un mensonge qui se retournera contre toi au troisième reporting.

Pas d'historique du tout ? Trois mois d'observation avec des cibles provisoires, annoncées comme telles, puis des cibles fermes au trimestre suivant.

Et surtout : tout s'écrit dans le document de stratégie. Le KPI, sa méthode de calcul exacte, la source — Business Suite, GA4 —, la cible et sa date. C'est ta protection : dans six mois, personne ne pourra te reprocher un chiffre défini ensemble noir sur blanc. Ensuite, la cadence : lecture mensuelle dans le reporting, arbitrage trimestriel. C'est le D de SPEED — les données servent à décider, pas à décorer.

## Exemple appliqué

Prenons « Mutuelle Ouest Santé », mutuelle régionale, cible : les 25-40 ans actifs. La directrice pose l'objectif business en rendez-vous de cadrage : 400 nouvelles adhésions cette année, dont 15 % attendues du digital. Soit 60 adhésions à aller chercher en ligne.

Tu déroules la chaîne. Objectif social media : générer des demandes de devis qualifiées — famille conversion — avec un objectif secondaire de notoriété locale sur les 25-40 ans, parce qu'une mutuelle régionale inconnue ne reçoit pas de demandes.

KPI principal : les clics vers la page devis depuis les réseaux, mesurés dans GA4 — sessions d'origine social qui atteignent la page /devis. Historique relevé pendant l'audit : 80 par mois.

La cible : 150 clics par mois à six mois. Pourquoi ce chiffre et pas un autre ? Le site transforme 7 % de ses visiteurs de la page devis en demandes réelles. 150 clics font donc 10 à 11 demandes par mois — le rythme exact des 60 adhésions annuelles attendues du digital. La cible sociale se raccroche au chiffre business du client : c'est précisément ça qui la rend défendable.

KPIs secondaires : la portée mensuelle sur la zone de couverture, le taux d'engagement sur portée, et le coût par clic sur la partie publicitaire.

Ce qu'on refuse : la directrice avait demandé « 10 000 abonnés ». Ta réponse tient en une phrase : 10 000 abonnés dont 9 000 hors zone de couverture, c'est zéro adhésion. Tu viens de gagner sa confiance en refusant un chiffre.

Six mois plus tard, la première slide du reporting dit : clics devis, 132, en progression de 65 % sur le semestre, cible 150 en vue. La conversation de renouvellement est déjà gagnée.

## Les erreurs fréquentes

**Promettre la vente quand tu ne contrôles pas le tunnel.** Si le site convertit mal, tes leads meurent après ton périmètre, et ta promesse avec eux. Engage-toi sur ce que ton travail produit directement : les clics, les leads entrants, les prises de contact.

**Douze KPIs dans le reporting.** Le client n'en retient aucun, et il choisira tout seul celui qui baisse pour te demander des comptes. Un principal, trois secondaires, terminé.

**Copier des cibles de benchmark.** « Plus 50 % d'engagement parce que c'est la moyenne du secteur » : le jour où ça décroche, tu n'as aucune méthode à défendre, juste un chiffre emprunté.

**Ne pas écrire la méthode de calcul.** Six mois plus tard, tu calcules autrement sans t'en rendre compte, la courbe fait un saut inexplicable, et ta crédibilité saute avec.

**Ne jamais réviser les cibles.** Une cible atteinte dès le deuxième mois ou manifestement hors de portée au troisième doit être rediscutée au trimestre. La laisser en l'état rend chaque reporting embarrassant — trop facile ou trop cruel.

## Action immédiate

Prends un client actuel — ou une marque fictive si tu démarres. Écris la chaîne complète en cinq lignes : l'objectif business avec le chiffre du client, l'objectif social media et sa famille, le KPI principal avec sa méthode de calcul et sa source, deux KPIs secondaires, la cible à six mois calculée depuis l'historique. Trente minutes, pas plus. Si une ligne résiste — souvent la première, parce que tu n'as jamais posé la question du chiffre business — c'est exactement la conversation qui manquait à ta mission. Programme-la cette semaine.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Chaîne objectif → KPI → cible","description":"Document d'une page : objectif business chiffré, objectif social media et sa famille, KPI principal avec méthode de calcul et source, KPIs secondaires, cible à six mois.","kind":"template","url":null},{"title":"Les 4 critères d'un KPI défendable","description":"Mesurable, attribuable, comparable, relié à l'objectif : la vérification à passer avant d'écrire un KPI dans le document de stratégie.","kind":"checklist","url":null},{"title":"Google Analytics","description":"La source des clics et sessions venus des réseaux, indispensable pour mesurer un KPI de conversion.","kind":"tool","url":"https://analytics.google.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '67f77521-f155-4a5f-bbcc-2c35d5beaca8'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '678eed22-80b7-47e7-88c3-c33ab2ef011e'::uuid, m.id, m.course_id, m.org_id, 'strategie-editoriale', $sq$Construire la stratégie éditoriale : piliers, formats, fréquences$sq$, $sq$La méthode pour poser 3 à 4 piliers éditoriaux, choisir les formats plateforme par plateforme et fixer une fréquence calculée sur la capacité de production réelle, pas sur l'ambition. Le tout tient dans une matrice pilier × format × réseau × fréquence qui alimente ensuite le planning de chaque mois.$sq$, $sq$## L'accroche

« On poste quoi la semaine prochaine ? » Si ton client — ou toi-même — pose cette question chaque semaine, il n'y a pas de stratégie éditoriale. Il y a de l'improvisation hebdomadaire. Et l'improvisation a un coût précis : des heures perdues à chercher des idées, des posts publiés pour publier, un compte qui raconte une chose différente chaque semaine, et au bout de trois mois un client qui se demande à quoi tu sers. La stratégie éditoriale, c'est ce qui transforme « trouver une idée » en « remplir une case ». Trois ou quatre piliers, des formats choisis par plateforme, une fréquence que tout le monde tient. C'est le premier E de SPEED, l'Expression, et c'est le cœur du document de stratégie que tu vends 1 500 à 3 000 € HT. Voici comment le construire, pièce par pièce.

## Le contenu

### Les piliers : trois ou quatre, pas plus

Un pilier, c'est une promesse de contenu récurrente qui sert l'objectif. Pas un thème vague — une promesse : « chaque semaine, on vous montre comment c'est fabriqué ».

La méthode pour les trouver : croise trois listes. Ce que la marque sait faire de façon crédible. Ce que l'audience cherche réellement — tes cinq meilleurs posts de l'audit te le disent déjà. Ce que l'objectif exige — un objectif de devis exige de la preuve, pas seulement de la sympathie. Un bon pilier vit à l'intersection des trois.

Quatre familles reviennent dans presque toutes les stratégies : la preuve — cas clients, avis, résultats, avant-après ; la pédagogie — expliquer le métier, le produit, les choix ; l'incarnation — coulisses, équipe, dirigeant ; l'offre — produit, nouveauté, promotion. Tu attribues à chaque pilier un pourcentage du volume, par exemple 40/30/20/10. L'offre dépasse rarement 20 % : un compte catalogue n'est suivi par personne.

Le test d'un bon pilier : tu peux lister 20 idées de posts en quinze minutes sans forcer. Si tu cales à six, ce n'est pas un pilier, c'est une idée déguisée.

### Les formats, plateforme par plateforme

Un pilier n'a pas le même format partout. Sur Instagram : le reel porte la portée, le carrousel porte la pédagogie et les sauvegardes, la story porte le quotidien et le lien — donc la conversion. Sur LinkedIn : le post texte incarné et le carrousel PDF font l'essentiel du travail ; la vidéo y progresse mais coûte plus cher à produire. Facebook sert le relais et la communauté locale, rarement comme moteur.

Deux règles fermes. Un : deux réseaux maximum en démarrage — c'est exactement ce que couvre un retainer starter à 800-1 500 € HT, avec ses 8 à 12 posts mensuels — et tu refuses poliment le « on veut être partout ». Être partout à moitié, c'est n'être nulle part. Deux : adapter, jamais dupliquer. Le même sujet devient un reel de 40 secondes sur Instagram et un post texte de 150 mots sur LinkedIn. Le copier-coller se voit, et il performe mal des deux côtés.

### La fréquence : calculée sur la capacité, pas sur l'ambition

La question n'est pas « combien il faudrait poster » mais « combien on peut produire pendant douze mois sans baisser en qualité ». La fréquence se déduit de trois contraintes : ton temps de production inclus dans le retainer, la matière que le client peut réellement fournir — photos, disponibilités pour tourner —, et le budget. Huit posts par mois tenus un an battent vingt posts tenus six semaines : la régularité est ce que les plateformes et l'audience récompensent, et son absence est ce qu'elles sanctionnent en premier.

Les repères : retainer starter, 8 à 12 posts par mois sur deux réseaux ; accompagnement complet à 1 500-3 000 € HT, 12 à 20 posts plus les stories.

### Tout tient dans un tableau

Le livrable final est une matrice : pilier, format, réseau, fréquence mensuelle. Une ligne type : « Preuve client — carrousel avant-après — Instagram — 3 par mois ». Ce tableau est un contrat de production. C'est lui qui remplit le planning éditorial de chaque mois — l'Exécution, le second E de SPEED — et c'est lui que tu ressors quand le client demande « pourquoi on ne poste pas plus ». Dans le document de stratégie, la partie éditoriale tient en deux ou trois pages : les piliers avec trois exemples chacun, la matrice, et le ton résumé en cinq lignes.

## Exemple appliqué

Prenons « L'Atelier du Chêne », ébéniste, meubles sur mesure, deux personnes — l'artisan et un apprenti. Instagram : 3 400 abonnés. Objectif posé à la leçon précédente : quatre demandes de devis qualifiées par mois. Retainer : 900 € HT mensuels.

Tu croises les trois listes. Ce qu'il sait faire de crédible : montrer la fabrication, expliquer le bois, photographier les pièces posées chez les clients. Ce que l'audience cherche : du processus — trois de ses cinq meilleurs posts sont des vidéos d'atelier —, du résultat, et des prix indicatifs, la question qui revient dans tous les commentaires. Ce que l'objectif exige : de la preuve et un chemin clair vers le devis.

Les piliers tombent : Fabrication, 40 %, en reels d'atelier de 30 à 45 secondes. Pièces finies, 30 %, en carrousels avant-après avec le contexte du projet et une fourchette de prix — c'est le pilier qui déclenche les devis. Matière, 20 %, en carrousels pédagogiques : chêne contre hêtre, les finitions, pourquoi tel bois pour telle pièce. Vie d'atelier, 10 %, en stories.

La fréquence, maintenant. L'ébéniste peut donner deux heures de captation par mois, pas une de plus. Ton retainer couvre une journée de production. Résultat : 8 posts par mois — 4 reels, 3 carrousels, 1 libre — plus trois stories par semaine. Pas quinze posts : personne ne les tiendrait, ni lui à la captation, ni toi à la production.

Effet concret : le planning de septembre se remplit en une réunion de 45 minutes au lieu d'un brainstorming chaque lundi. Et quand l'ébéniste demande « et TikTok ? », la réponse est dans la matrice : aucune capacité de production disponible sans retirer une case ailleurs — ou sans passer au retainer supérieur. La stratégie te protège aussi de ça.

## Les erreurs fréquentes

**Six piliers.** Six piliers, c'est zéro pilier : chacun sort une fois par mois, aucune récurrence ne s'installe, le compte ne ressemble à rien. Trois ou quatre, avec des pourcentages.

**Copier les formats à la mode.** Le carrousel qui cartonne chez un coach business ne dit rien d'un ébéniste ou d'une mutuelle. Le format découle du pilier et de la capacité de production, pas de ce que ton propre feed te montre cette semaine.

**Fixer la fréquence sur l'enthousiasme.** Vingt posts par mois décidés en réunion de lancement, tenus six semaines, puis un compte qui s'éteint. C'est pire qu'un rythme modeste et constant, parce que l'essoufflement se voit publiquement.

**Oublier que le client est un fournisseur.** Ta fréquence dépend de la matière qu'il livre. S'il doit envoyer des photos chaque semaine et qu'il ne le fera pas, ta stratégie est morte le jour de la signature. Prévois les sessions de captation dans le process, avec des dates.

**Des piliers déconnectés de l'objectif.** 80 % de coulisses quand l'objectif est le devis : on trouve la marque sympathique et on ne l'appelle jamais. Chaque pilier doit pouvoir dire à quel maillon de la chaîne objectif-KPI il contribue. S'il ne peut pas, il saute.

## Action immédiate

Prends un client, réel ou fictif, et bloque 45 minutes. Premièrement : écris trois piliers avec leur répartition en pourcentages et une phrase de promesse chacun. Deuxièmement : liste dix idées de posts pour le premier pilier — c'est le test des 20 en version courte. Troisièmement : pose une fréquence mensuelle que tu peux garantir douze mois avec le temps réellement disponible, le tien et celui du client. Si les dix idées sortent en un quart d'heure, ton pilier est bon. Si tu rames à la sixième, remplace-le maintenant — pas au troisième mois du contrat, quand le planning sera déjà vide.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Matrice piliers × formats × fréquences","description":"Le tableau final de la stratégie éditoriale : une ligne par pilier avec son pourcentage, son format, son réseau, sa fréquence mensuelle et un exemple de post.","kind":"template","url":null},{"title":"Banque d'idées par pilier","description":"Un onglet par pilier avec 20 idées de posts, pour vérifier qu'un pilier tient dans la durée avant de l'écrire dans la stratégie.","kind":"template","url":null},{"title":"Test de faisabilité d'une fréquence","description":"Temps de production dans le retainer, matière fournie par le client, budget : les trois contraintes à chiffrer avant de promettre un rythme de publication.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '67f77521-f155-4a5f-bbcc-2c35d5beaca8'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '45b5095f-188e-4a15-8e61-2c40553f3642'::uuid, c.id, c.org_id, 'planning-editorial', $sq$Planning éditorial$sq$, $sq$Ce module apprend à transformer une stratégie éditoriale en calendrier publiable : générer un mois d'intentions sans page blanche, le répartir sur plusieurs réseaux, le faire valider en un seul cycle. Il se termine par le board type qui permet de tenir quatre clients et quarante posts par mois sans rien perdre.$sq$, 5, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3e37f680-a226-4bcc-94f9-53c37173c470'::uuid, m.id, m.course_id, m.org_id, 'du-pilier-au-sujet', $sq$Du pilier au sujet : générer des intentions éditoriales$sq$, $sq$La mécanique en cinq étapes qui descend des piliers stratégiques vers des sujets datés : volume contractuel, pondération par pilier, bibliothèque de huit angles, croisement avec le calendrier du mois, formulation. Une session d'une heure entre le 15 et le 20 remplace quatre semaines de page blanche.$sq$, $sq$## L'accroche

On est le 25 du mois. Le planning d'octobre de ton client doit partir dans trois jours, et tu as un document vide devant toi. Tu scrolles Instagram en espérant qu'une idée tombe. Tu retombes sur les mêmes concurrents, les mêmes formats, et au bout d'une heure tu as noté deux idées molles que tu n'oses même pas écrire dans le planning. Ce moment-là, tous les freelances le connaissent. Et il coûte cher : à 400 € de TJM, une matinée de page blanche, c'est 200 € de ta marge qui partent. Multiplié par quatre clients, c'est deux jours par mois perdus à chercher des idées au lieu de produire. La bonne nouvelle : la page blanche n'est pas un problème de créativité, c'est un problème de méthode. Quand tu pars de tes piliers et que tu descends mécaniquement vers des sujets datés, générer un mois complet prend une heure. C'est cette mécanique qu'on pose maintenant.

## Le contenu

### Les trois étages : pilier, angle, sujet

D'abord le vocabulaire, parce que la confusion entre ces trois mots est la cause numéro un de la page blanche.

Le pilier, tu l'as posé à l'étape Expression de SPEED. C'est une promesse récurrente faite à l'audience : « on te montre les coulisses de la fabrication », « on t'aide à mieux choisir », « on te prouve que ça marche ». Trois à cinq piliers, pas plus. Un pilier ne se publie pas : il est trop abstrait pour ça.

L'angle, c'est la façon d'attaquer un pilier. Le même pilier « coulisses » peut se traiter par un portrait d'artisan, une vidéo de geste technique, un chiffre de production. L'angle est réutilisable d'un mois sur l'autre sans que personne ne le remarque, parce que le sujet change.

Le sujet, c'est l'intersection des deux, datée et concrète : « Reel : les trois étapes du coulage à la main, publié le mardi 7 ». C'est lui, l'intention éditoriale. Une intention complète tient sur une ligne et porte six informations : titre de travail, pilier, angle, format, réseau, date. Pas la caption. La caption viendra à la production, deux semaines plus tard. Si tu rédiges au moment où tu planifies, tu mélanges deux temps de travail et tu divises ta vitesse par trois.

### Étape 1 — pars du volume, jamais des idées

Ton contrat dit combien. Un retainer starter à 800-1 500 € HT par mois, c'est 8 à 12 posts sur deux réseaux. Disons 12. C'est ton point de départ : tu ne cherches pas « des idées », tu cherches à remplir 12 cases. La différence est énorme. Quand tu pars des idées, tu en trouves cinq bonnes et tu forces les sept dernières. Quand tu pars du volume, chaque case a déjà un pilier et un format assignés avant même que tu réfléchisses au contenu.

### Étape 2 — répartis le volume par pilier

Ta stratégie donne une pondération. Exemple classique sur quatre piliers : 40 / 25 / 25 / 10. Sur 12 posts, ça donne 5 / 3 / 3 / 1. Arrondis, écris ces chiffres en haut de ton document. Cette répartition est ta garantie d'équilibre : sans elle, tu nourris ton pilier préféré et tu affames les autres.

### Étape 3 — ouvre ta bibliothèque d'angles

Tu n'inventes pas des angles chaque mois. Tu en tiens une liste, la même pour tous tes clients. Huit angles couvrent presque tout :

1. Coulisses : montrer ce qui se passe derrière.
2. Pédagogie : expliquer un point que ton client maîtrise et que son audience ignore.
3. Preuve : un chiffre, un résultat, un avant/après.
4. Témoignage : la voix d'un client réel.
5. Objection : répondre frontalement à un frein d'achat.
6. Actualité : un temps fort du calendrier ou du secteur.
7. Portrait : une personne de l'équipe.
8. Démonstration : le produit ou le service en usage réel.

Construis la matrice : piliers en lignes, angles en colonnes. Quatre piliers fois huit angles, c'est 32 croisements possibles. Tu n'as besoin que de 12. Le rapport de force vient de s'inverser : tu ne cherches plus des idées, tu élimines des options.

### Étape 4 — croise avec le calendrier du mois

Avant de cocher tes croisements, liste les temps forts du mois visé : commerciaux (lancement, promo, réassort), sectoriels (salon, réglementation), et un ou deux marronniers utiles — pas la journée mondiale de n'importe quoi, seulement ceux qui touchent l'audience. Ces temps forts consomment des cases en priorité, parce qu'ils sont datés de force.

### Étape 5 — date et formule

Chaque croisement retenu devient une ligne datée. Le titre de travail se formule verbe + objet concret : « montrer le coulage de la cire », pas « post produit n°3 ». Un titre flou aujourd'hui, c'est une page blanche déplacée à la production.

Dernier point, le rituel : tu génères le mois M+1 entre le 15 et le 20 du mois M, en une session bloquée d'une heure. Jamais au fil de l'eau. Quatre sessions hebdomadaires de panique remplacées par une session mécanique, c'est le premier gain de marge de ce module.

## Exemple appliqué

Prenons un e-commerce lifestyle : Maison Lueur, bougies artisanales vendues en ligne, retainer à 1 200 € HT par mois, 12 posts sur Instagram et Facebook. Piliers pondérés : produit 40 % (5 posts), fabrication 25 % (3 posts), inspiration déco 25 % (3 posts), preuve sociale 10 % (1 post). Temps forts d'octobre : lancement de la collection automne le 10, et le passage à l'heure d'hiver, marronnier cocooning parfait pour une marque de bougies.

La session du 17 septembre dure 50 minutes et sort 12 lignes. En voici quatre :

- 3 octobre, carrousel Instagram, fabrication × coulisses : « Les trois étapes du coulage à la main ».
- 10 octobre, reel Instagram, produit × actualité : unboxing des quatre senteurs de la collection automne, jour du lancement.
- 14 octobre, post Facebook, preuve sociale × témoignage : avis client sur les 60 heures de combustion, capture et citation.
- 26 octobre, carrousel Instagram, inspiration × actualité : « Cinq coins lecture pour le passage à l'heure d'hiver », avec le produit dans trois photos sur cinq.

Remarque ce qui s'est passé : aucune de ces idées n'est géniale prise isolément. Mais les 12 ensemble couvrent les quatre piliers, exploitent les deux temps forts, et le client valide la logique d'un coup d'œil parce que chaque ligne dit d'où elle vient.

## Les erreurs fréquentes

Partir des idées au lieu du volume. Tu trouves cinq idées, tu forces les sept suivantes, et les posts 8 à 12 sont visiblement du remplissage. Le volume d'abord, les idées ensuite : c'est contre-intuitif et c'est ce qui marche.

Rédiger les captions pendant la session d'intentions. Tu passes de 5 minutes par ligne à 25, et le client corrige un texte fini alors qu'il aurait dû invalider l'intention en amont. Deux temps de travail, deux sessions.

Nourrir uniquement ton pilier préféré. Sans pondération écrite, tu finis à 80 % de posts produit en trois mois, et l'engagement décroche. La pondération est un garde-fou, pas une suggestion.

Ignorer le calendrier réel du client. Un lancement découvert le 2 du mois fait sauter trois posts déjà validés. Demande les temps forts par écrit avant chaque session, un mail de trois lignes suffit.

Générer semaine par semaine. C'est quatre pages blanches par mois au lieu de zéro, et un planning incohérent que le client ne peut jamais valider en entier.

## Action immédiate

Ouvre un tableur maintenant. Lignes : les piliers de ton client principal — si tu n'as pas de pondération, pose 40 / 30 / 20 / 10 en attendant de la caler. Colonnes : les huit angles de la leçon. Coche 12 croisements en respectant la pondération, date-les sur le mois prochain, formule chaque titre en verbe + objet. Quarante-cinq minutes chrono. À la fin, tu as un mois d'intentions présentable à un client — et tu viens de vivre la dernière session de ta vie qui commence par une page vide.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Matrice piliers × angles","description":"Tableur prêt à remplir avec les piliers en lignes, les huit angles en colonnes et une zone de pondération du volume mensuel.","kind":"template","url":null},{"title":"Checklist d'une intention complète","description":"Les six informations que chaque ligne d'intention doit porter — titre de travail, pilier, angle, format, réseau, date — avec un exemple conforme et un contre-exemple.","kind":"checklist","url":null},{"title":"Bibliothèque des huit angles","description":"Les huit angles réutilisables de la leçon, chacun illustré par deux exemples de sujets dans des secteurs différents.","kind":"template","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '45b5095f-188e-4a15-8e61-2c40553f3642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3f0b97de-c314-4722-80fd-46832096b412'::uuid, m.id, m.course_id, m.org_id, 'planning-mensuel-multiplateformes', $sq$Bâtir un planning mensuel multi-plateformes$sq$, $sq$Construire le calendrier dans le bon ordre : hiérarchie des réseaux, rythme hebdomadaire avant les dates, jours fixes, déclinaisons décalées plutôt que duplications, contrôle d'équilibre semaine par semaine. Sur 12 posts, on produit environ 8 contenus natifs et on en décline 4 — c'est là que se joue la marge.$sq$, $sq$## L'accroche

Tu as tes 12 intentions du mois, propres, datées, validées dans ta tête. Tu ouvres le calendrier pour les poser, et là, deuxième mur : lesquelles vont sur Instagram, lesquelles sur LinkedIn, est-ce qu'on publie le même contenu partout, quel jour, à quelle heure ? Beaucoup de freelances tranchent au feeling : tout partout, les mêmes jours, la même caption copiée-collée. Résultat, un compte LinkedIn qui parle comme un compte Instagram, des semaines à quatre posts suivies de semaines à zéro, et un client qui demande un jour : « pourquoi on a publié la même chose au même moment sur les deux réseaux ? » Tu n'as pas de réponse, parce qu'il n'y a pas de logique — juste du remplissage. Un planning multi-plateformes, ça se construit dans un ordre précis : le rythme avant les dates, les dates avant les déclinaisons. Cet ordre-là tient en cinq étapes, et c'est ce qu'on déroule maintenant.

## Le contenu

On est en plein dans le deuxième E de SPEED, l'Exécution : transformer des intentions en calendrier publiable. Le principe qui gouverne tout : un sujet n'est pas un post. Un sujet se décline par réseau, il ne se duplique pas.

### Étape 1 — hiérarchise les réseaux

Chaque client a un réseau principal et un ou deux réseaux secondaires. Le principal, c'est celui où vit l'audience qui achète — pas celui que le client préfère. Le principal reçoit les formats natifs, produits pour lui. Les secondaires reçoivent des déclinaisons. Écris cette hiérarchie noir sur blanc dans le planning : « Instagram principal, Facebook secondaire ». Le jour où le client demande « et TikTok ? », tu réponds avec la hiérarchie, pas avec un haussement d'épaules — et l'ajout d'un réseau devient un avenant, pas un cadeau.

### Étape 2 — pose le rythme hebdomadaire avant toute date

C'est l'étape que tout le monde saute, et c'est elle qui fait tenir le planning. Sur un retainer starter à 8-12 posts pour deux réseaux, le rythme type est : deux posts par semaine sur le principal, un par semaine sur le secondaire. Pas « 12 posts dans le mois » : « 2 + 1 par semaine ». La différence, c'est que le rythme se vérifie d'un coup d'œil et s'explique au client en une phrase. Un mois, c'est quatre semaines et quelque : ton rythme hebdomadaire fois quatre doit tomber sur le volume du contrat, à un post près.

### Étape 3 — cale des jours fixes

Le mardi et le jeudi sur le principal, le mercredi sur le secondaire, par exemple. Les jours fixes rendent trois services. Ils créent une habitude chez l'audience. Ils simplifient ta production : tu sais que tout doit être prêt le lundi. Et ils rendent les trous visibles : une case vide un jeudi saute aux yeux, une case vide « quelque part dans le mois » jamais. Quel jour choisir ? Au lancement, prends les créneaux classiques du secteur ; après deux mois, l'étape Données de SPEED tranche avec les chiffres réels du compte. Le planning propose, le reporting dispose.

### Étape 4 — décline, ne duplique pas

Un sujet fort du réseau principal peut vivre sur le secondaire, à trois conditions. Le format s'adapte : un reel Instagram devient un post photo + texte sur Facebook, un carrousel LinkedIn devient trois stories. La date se décale : deux à trois jours entre les deux versions, jamais le même jour — tu doubles la durée de vie du sujet au lieu de cannibaliser sa portée. Et la caption se réécrit : même message, codes du réseau. Le copier-coller intégral, c'est le signal le plus visible d'un community management au rabais, et les clients le voient.

Concrètement, sur 12 posts : 8 sujets natifs sur le principal — deux par semaine —, et 4 déclinaisons sur le secondaire. Tu ne produis pas 12 contenus de zéro, tu en produis 8 et tu en déclines 4. Une déclinaison coûte une vingtaine de minutes quand un contenu natif en coûte une heure et demie : sur un retainer starter, c'est cette ligne-là qui décide si le contrat est rentable.

### Étape 5 — vérifie l'équilibre semaine par semaine

Relis le planning en vue hebdomadaire et vérifie trois choses. Chaque semaine porte au moins un post orienté vente ou conversion — un mois dont toute la vente est tassée en semaine 4 ne convertit pas. Pas deux formats lourds la même semaine : deux reels à tourner sur sept jours, c'est toi qui exploses en production. Et les temps forts respirent : autour d'un lancement, on resserre avant, on laisse de l'air après.

Dernier réflexe : garde une case flexible par mois, non datée, prête à glisser. L'actualité du client bouge toujours, et un planning sans jeu casse au premier imprévu.

## Exemple appliqué

Cas transport premium B2B : Vectis, société de navettes avec chauffeur pour les entreprises — transferts aéroport, roadshows, séminaires. Ticket moyen élevé, cycle de décision long, acheteurs : offices managers et directions générales. Retainer à 1 400 € HT par mois, 10 posts.

Hiérarchie : LinkedIn principal — c'est là que signent les clients —, Instagram secondaire, vitrine pour rassurer sur le standing des véhicules. Rythme : 2 posts LinkedIn par semaine sauf une, 1 post Instagram par semaine. Soit 6 LinkedIn + 4 Instagram. Jours fixes : mardi et jeudi matin sur LinkedIn, mercredi sur Instagram.

Semaine type de novembre : mardi, post LinkedIn pédagogie « Ce que coûte vraiment un retard de transfert avant un conseil d'administration » ; mercredi, reel Instagram embarqué à bord d'une Classe V, préparation avant une prise en charge ; jeudi, témoignage LinkedIn d'une office manager qui a organisé un roadshow de trois jours.

La déclinaison : le témoignage LinkedIn du jeudi devient le mercredi suivant un carrousel Instagram de trois photos du roadshow avec une citation extraite. Même sujet, six jours d'écart, deux formats — personne ne voit un doublon.

Temps fort du mois : Vectis expose à un salon des travel managers les 18 et 19. Les deux posts LinkedIn de cette semaine-là s'y consacrent — annonce de présence avec numéro de stand, puis coulisses à chaud — et la case flexible sert au post de remerciement le 21. Le planning entier tient sur une grille de quatre semaines que le client lit en trente secondes.

## Les erreurs fréquentes

Dupliquer à l'identique sur tous les réseaux. Même caption, même visuel, même jour : tu signales à l'audience — et au client — que le secondaire est une photocopieuse. Décale les dates, adapte le format, réécris le texte.

Remplir les dates avant de poser le rythme. Tu obtiens un mois en accordéon : six posts sur la première quinzaine, deux sur la seconde. Le rythme hebdomadaire d'abord, les contenus dans les cases ensuite.

Promettre des horaires « optimaux » sans données. « On publie à 11 h 47 parce que c'est le meilleur créneau » : sans historique du compte, c'est de l'astrologie. Commence par des créneaux standards, laisse le reporting trancher après deux mois.

Planifier sans marge de production. Un reel publié mardi doit être tourné, monté et validé avant — si le planning ignore ce délai, tu tournes le lundi soir dans la panique. Pose la date de publication et remonte les dates de production depuis elle.

Tasser tous les posts de vente en fin de mois. L'audience sent le rattrapage d'objectif. Un post conversion par semaine, réparti, convertit mieux que quatre coups de pression les cinq derniers jours.

## Action immédiate

Prends le mois prochain de ton client principal. Avant de placer un seul contenu, pose la grille : hiérarchie des réseaux en une ligne, rythme hebdomadaire en une ligne, jours fixes surlignés sur les quatre semaines, une case flexible. Ensuite seulement, verse tes intentions de la leçon précédente dans les cases, et marque chaque post du secondaire « natif » ou « déclinaison de… ». Trente minutes. Si ton volume contractuel ne tombe pas juste sur le rythme, c'est le rythme qu'on ajuste — jamais l'inverse.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Grille de planning mensuel multi-réseaux","description":"Grille de quatre semaines avec hiérarchie des réseaux, jours fixes, case flexible, et un marquage natif ou déclinaison pour chaque post.","kind":"template","url":null},{"title":"Checklist d'équilibre hebdomadaire","description":"Les trois contrôles à passer sur chaque semaine avant d'envoyer le planning : un post conversion minimum, pas deux formats lourds, de l'air autour des temps forts.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"L'outil gratuit de Meta pour programmer les publications Facebook et Instagram posées dans le planning.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '45b5095f-188e-4a15-8e61-2c40553f3642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '8d34e1d2-c9ff-4e22-b780-b7cfc0759da5'::uuid, m.id, m.course_id, m.org_id, 'validation-client', $sq$Le process de validation client sans allers-retours infinis$sq$, $sq$Un seul cycle de validation par mois : envoi le 20, retours groupés sous 5 jours ouvrés dans un canal unique, corrections sous 3 jours, clause de validation tacite signée dès le devis. La leçon détaille aussi le tri des retours en trois familles et la séquence de relance J+3, J+5, J+6 quand le client ne répond pas.$sq$, $sq$## L'accroche

Le 28 du mois, ton planning est prêt depuis huit jours. Le client a répondu par trois vocaux WhatsApp, un mail avec des retours sur deux posts, puis un appel où il a changé d'avis sur l'un des deux. Tu en es à la version 7 du même carrousel. Les deux premiers posts du mois suivant devraient déjà être programmés : ils ne sont même pas validés. Fais le calcul : si chaque aller-retour te coûte 45 minutes et que tu en subis dix par mois et par client, à 400 € de TJM, c'est plus de 400 € de marge évaporée — sur un retainer à 1 200 €, un tiers du contrat part en frictions. Le pire, c'est que le client n'est pas de mauvaise foi. Il fait ce que ton absence de règles lui permet de faire. La validation n'est pas un moment de la relation client : c'est un process, avec un canal, un délai et une clause. On le construit maintenant.

## Le contenu

### Le principe : un seul cycle par mois

La règle fondatrice tient en une phrase : le client valide le planning complet, une fois par mois, en une seule salve de retours. Pas post par post, pas au fil de l'eau. Un cycle, c'est quatre temps datés :

1. Envoi du planning complet — intentions, wordings, visuels — le 20 du mois pour le mois suivant.
2. Retours groupés du client sous 5 jours ouvrés, en une seule fois, au même endroit.
3. Corrections livrées par toi sous 3 jours ouvrés.
4. Validation finale, et plus rien ne bouge sauf urgence réelle.

Deux passages, pas trois. Ce cadencement n'est pas une préférence d'organisation : c'est ce qui rend possible la programmation à l'avance, donc ta capacité à tenir quatre clients sans travailler le soir.

### Un seul canal, sinon rien

Tous les retours vivent au même endroit : les commentaires de ton outil de gestion, ou à défaut un seul fil de mail. Un retour donné par téléphone n'existe pas tant qu'il n'est pas écrit dans l'outil — et c'est au client de l'y écrire, pas à toi de retranscrire ses vocaux. Formule-le poliment mais tiens-le : « Je prends tout ce qui est dans le board, je risque de perdre ce qui est ailleurs. » La première semaine, le client teste. La troisième, il a pris le pli.

### Trie les retours en trois familles

Tous les retours ne se traitent pas pareil, et le dire explicitement t'évite 80 % des conflits.

La correction factuelle — une date fausse, un prix erroné, une faute — est toujours acceptée, sans compter, même hors délai. C'est ta responsabilité professionnelle.

La préférence de style — « je dirais plutôt ça comme ça » — entre dans la salve unique. Une reformulation par post, pas quatre. Au-delà, tu factures ou tu refuses, au choix, mais tu le dis.

La remise en cause stratégique — « en fait je ne veux plus parler de ce sujet », « on devrait changer de ton » — sort du cycle. Ce n'est pas un retour sur un post, c'est une décision qui touche l'étape Positionnement ou Expression : elle se traite dans un call dédié, éventuellement un avenant, jamais dans les commentaires d'un carrousel.

### La clause de validation tacite

C'est la pièce maîtresse, et elle se signe au démarrage du contrat, jamais au premier conflit. Trois phrases dans ton devis : « Le planning est transmis le 20 de chaque mois. Sans retour sous 5 jours ouvrés, il est réputé validé et publié tel quel. Les retours s'effectuent en une seule salve, dans l'outil partagé. » Tu la présentes comme une protection du client — « c'est ce qui garantit que vos posts partent à l'heure » — et c'est vrai. Sans elle, un client silencieux bloque toute ta chaîne de production et c'est toi qui portes le retard.

### Quand le client ne répond pas

Séquence en trois temps, calée sur la clause. J+3 : rappel neutre, une ligne, avec la date butoir. J+5 : dernier rappel qui énonce la conséquence — « sans retour demain soir, j'applique la validation tacite et je programme ». J+6 : tu appliques, tu programmes, tu préviens que c'est fait. Sans agressivité, sans excuse non plus. Un client qui découvre que la clause s'applique vraiment répond dans les temps le mois suivant — c'est vérifié à chaque fois. Et si le blocage devient systématique, ce n'est plus un problème de process : c'est un signal de désengagement, et il se traite au point mensuel, celui où tu présentes le reporting commenté. C'est d'ailleurs pour ça que le reporting fait durer les contrats : il crée le rendez-vous où ces sujets se disent avant de pourrir.

## Exemple appliqué

Cas assurance mutualiste B2C : la Mutuelle Ligérienne, 40 000 adhérents, communication grand public sur la santé et la prévoyance. Secteur régulé : chaque post doit être relu par la responsable communication et par la juriste conformité. Avant le process, le circuit était en série — la com relisait, puis transmettait à la conformité, qui renvoyait ses remarques, que la com re-commentait. Résultat mesuré sur trois mois : 12 allers-retours par planning en moyenne, 18 jours entre l'envoi et la validation finale, quatre posts publiés en retard.

Le process mis en place change trois choses. D'abord, les deux relectrices reçoivent le planning le même jour et commentent en parallèle dans le même outil, avec le même délai de 5 jours ouvrés — le circuit en série devient un circuit en parallèle. Ensuite, une bibliothèque de mentions légales est validée une fois pour toutes en amont avec la juriste : huit formulations pré-approuvées couvrant remboursements, délais de carence et exclusions. La conformité ne relit plus chaque phrase, elle vérifie que la bonne mention est posée — sa relecture passe de 40 minutes à 10 par planning. Enfin, la clause de validation tacite est adaptée : elle ne s'applique qu'aux posts sans enjeu réglementaire, marqués comme tels dans le planning ; les posts « produit » attendent toujours la conformité, mais ils sont identifiés dès l'envoi, donc traités en priorité.

Résultat après deux mois : un seul cycle, 6 jours entre envoi et validation, zéro post en retard. Même client, mêmes contraintes réglementaires, mêmes personnes. Seul le process a changé.

## Les erreurs fréquentes

Envoyer les posts au compte-goutte. Tu crois faciliter la relecture, tu fabriques dix micro-validations par mois au lieu d'une. Le client ne voit jamais la cohérence d'ensemble et commente chaque post comme un objet isolé.

Accepter les retours multicanaux. Un vocal WhatsApp, deux mails, une remarque en visio : tu deviens le greffier du client, tu perds un retour sur trois, et c'est toi le fautif quand il ressurgit. Un canal, un seul, annoncé dès l'onboarding.

Laisser la stratégie se renégocier dans les commentaires. « Finalement je n'aime pas ce pilier » n'est pas un retour sur un post. Si tu le traites comme tel, tu réécris ta stratégie gratuitement, un carrousel à la fois. Sors-le du cycle, ouvre un call.

Ne pas écrire la clause de validation tacite. Sans elle, le silence du client devient ton retard. Tu n'as aucun levier de relance, et « je n'ai pas eu le temps de valider » devient un motif recevable de posts non publiés — qu'on te reprochera quand même.

Relancer sans conséquence. Trois « petit rappel » sans suite apprennent au client que tes délais sont décoratifs. La relance de J+5 énonce ce qui se passe demain, et à J+6 ça se passe.

## Action immédiate

Écris ta clause de validation, maintenant : les trois phrases du script, adaptées à tes délais réels. Puis choisis ton client le plus lent à valider et envoie-lui un message de deux paragraphes : le nouveau cadencement à partir du mois prochain, présenté comme une garantie de ponctualité pour lui. Si tu n'as pas encore de client, colle la clause dans ton modèle de devis. Vingt minutes, et ton prochain cycle de validation a une colonne vertébrale.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Clause de validation tacite prête à coller","description":"Les trois phrases contractuelles du cycle de validation, avec deux variantes de délais et la formulation qui la présente comme une garantie de ponctualité.","kind":"template","url":null},{"title":"Séquence de relance en trois messages","description":"Les messages types de J+3, J+5 et J+6, du rappel neutre à l'application de la clause, à personnaliser en trente secondes.","kind":"template","url":null},{"title":"Checklist du cycle de validation","description":"Les quatre temps datés du cycle et le tri des retours en trois familles — factuel, style, stratégique — avec la réponse à donner pour chacune.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '45b5095f-188e-4a15-8e61-2c40553f3642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f2cdfcb3-96cc-48c5-864a-cfde5660cf7f'::uuid, m.id, m.course_id, m.org_id, 'industrialiser-avec-un-outil', $sq$Industrialiser avec un outil de gestion$sq$, $sq$Le board type qui fait tenir quatre clients : un board par client à structure identique, groupes par mois, dix colonnes fixes, sept statuts dont chacun désigne qui a la main, déclinaisons en sous-éléments et retours client sur la ligne. Trois rituels le font vivre : 20 minutes chaque lundi, la génération du mois suivant le 15, la relecture du mois écoulé pour le reporting.$sq$, $sq$## L'accroche

Claire, freelance à Angers, deux ans d'activité, quatre clients. Un soir de novembre, elle réalise qu'un post validé n'est jamais parti : le visuel dormait dans un mail, la caption dans son app de notes, la date dans sa tête. Le client s'en aperçoit avant elle. Rien de grave en apparence — un post raté — sauf que c'est le troisième signal du même problème : quatre clients à 10 posts par mois, c'est 40 contenus simultanés, chacun avec un statut, un visuel, un texte, une date, des retours. Ta mémoire tient très bien un client. Elle ne tient pas quatre. Et le passage de 2 500 à 6 000 € de chiffre d'affaires mensuel ne bute presque jamais sur la prospection : il bute là, sur l'incapacité à tenir la production sans rien perdre. La réponse n'est pas de travailler plus tard le soir. C'est un board. Un seul modèle, dupliqué pour chaque client, qui porte tout. On le construit colonne par colonne.

## Le contenu

### Le principe : la structure avant l'outil

Monday, Notion, Trello, ClickUp : peu importe. Ce qui industrialise, c'est la structure, pas le logiciel — et la version gratuite de Notion ou Trello suffit largement pour quatre clients. Ne paie un outil que le jour où le gratuit te fait perdre du temps mesurable. La règle non négociable : un board par client, mais la même structure partout. Si chaque client a son organisation, tu changes de logique mentale quatre fois par jour, et tu reperds ce que l'outil devait te faire gagner.

### L'anatomie du board type

Les groupes, ce sont les mois : un groupe « Novembre », un groupe « Décembre », le mois courant ouvert, les autres repliés. Les lignes, ce sont les sujets — tes intentions éditoriales de la leçon 5.1, une ligne par sujet.

Les colonnes, dix, toujours les mêmes :

1. Sujet : le titre de travail, verbe + objet.
2. Réseau : Instagram, LinkedIn, Facebook…
3. Format : reel, carrousel, post, story.
4. Pilier : celui de ta stratégie, pour vérifier l'équilibre d'un coup d'œil.
5. Date de publication.
6. Statut — on y revient, c'est la colonne qui fait tout tenir.
7. Wording : la caption, dans la cellule ou en pièce liée.
8. Visuel : le fichier, déposé sur la ligne. Jamais dans un mail.
9. Retours : les commentaires client, sur la ligne, nulle part ailleurs — c'est le canal unique de la leçon 5.3.
10. Sponsorisation : le budget éventuel si le post est amplifié.

Un sujet décliné sur un second réseau — la mécanique de la leçon 5.2 — devient un sous-élément de la ligne mère, avec sa propre date et son propre statut. Le sujet reste unique, ses versions vivent dessous.

### Les sept statuts, et pas un de plus

Intention → À produire → Wording à valider → En validation client → Validé → Programmé → Publié.

Chaque statut désigne qui a la main. « À produire », c'est toi. « En validation client », la balle est chez le client — et c'est ce statut qui objective tes relances : un filtre sur « En validation client depuis plus de 3 jours » te donne ta liste de relances du matin en dix secondes, sans réfléchir. « Programmé » veut dire que le post est réellement chargé dans l'outil de publication, pas qu'il devrait l'être. « Publié » clôt la ligne.

Résiste à la tentation d'ajouter des statuts. Douze statuts, c'est un board que plus personne ne met à jour. Sept, ça se tient.

### Les trois rituels qui font vivre le board

Un board n'est utile que s'il dit la vérité, et il ne dit la vérité que si tu le mets à jour à heure fixe.

Le lundi, 20 minutes par client : tu fais avancer les statuts, tu traites le filtre des relances, tu vérifies que la semaine qui s'ouvre est entièrement « Programmé ». Le 15 du mois, la session de génération du mois suivant — la leçon 5.1 — verse ses lignes directement dans le groupe du mois M+1, statut « Intention ». Et en début de mois, tu relis le groupe du mois écoulé, colonne Pilier et colonne Réseau, pour nourrir le reporting commenté : c'est le D de SPEED qui vient chercher ses données là où elles sont déjà rangées.

### Ce que le board te rend

Trois dividendes concrets. L'onboarding d'un nouveau client prend 30 minutes : tu dupliques le board modèle, tu vides le contenu, tu gardes colonnes, statuts et étiquettes. Tu deviens remplaçable une semaine : quelqu'un qui ouvre le board comprend où en est chaque post sans t'appeler — c'est la condition de tes vacances. Et en cas de litige, l'historique des validations est horodaté sur chaque ligne : « validé par vous le 24 » clôt la discussion.

## Exemple appliqué

Cas artisan : l'Atelier Fauvel, ébéniste sur mesure, retainer starter à 900 € HT par mois, 8 posts sur Instagram et Facebook. Client typique du monde artisan : des images magnifiques, zéro culture des outils numériques, et un goulot d'étranglement unique — les photos d'atelier, que seul l'ébéniste peut prendre.

Le board de Fauvel suit le modèle, avec un seul ajustement : une étiquette « En attente de photos » posée sur la colonne Statut, entre « À produire » et « Wording à valider ». Parce que chez cet artisan, ce qui bloque n'est jamais la rédaction : ce sont les cinq photos du banc de chêne qui n'arrivent pas. Avant le board, Claire relançait par messages dispersés, sans vue d'ensemble, et deux posts par mois sautaient faute de visuels. Avec le board, le lundi matin, le filtre « En attente de photos » sort trois lignes ; elle envoie un seul message à Fauvel avec la liste exacte — « il me faut : le banc en cours de ponçage, le tiroir à queues d'aronde, ton établi le matin » — et une date. L'ébéniste, qui ne comprend rien à Instagram mais tout à une liste de commissions, envoie ses photos dans la journée.

Résultat sur un trimestre : zéro post sauté, la validation mensuelle passe par un lien partagé en lecture sur le board — Fauvel commente directement sur les lignes, le cycle unique de la leçon 5.3 tourne — et le temps passé sur le client est tombé de 16 heures à 12 heures par mois. À 900 € le retainer, ces quatre heures gagnées font passer ton taux horaire réel de 56 à 75 € — un TJM effectif qui monte de 390 à 525 €, dans la fourchette cible de 350 à 550 €, sans avoir renégocié un centime.

## Les erreurs fréquentes

Éparpiller sur trois outils. Un board pour les dates, un drive pour les visuels, un fil WhatsApp pour les retours : tu as trois sources de vérité, donc aucune. Tout vit sur la ligne du sujet — fichier, texte, commentaires compris.

Une structure différente par client. « Ce client préfère des colonnes à lui » : refuse. Tu peux renommer une étiquette, jamais changer l'architecture. Quatre logiques différentes, c'est quatre fois plus d'erreurs et un board modèle qui ne sert plus à rien.

Laisser les statuts pourrir. Un board pas à jour est pire que pas de board : il ment avec assurance. Un post « En validation » qui est en réalité publié, et tu relances un client pour rien. D'où le rituel du lundi — 20 minutes, non négociables.

Garder les retours client hors du board. Chaque retour accepté par mail ou par vocal détruit le canal unique et l'historique horodaté. La réponse est toujours la même : « peux-tu le noter sur la ligne du post ? »

Suréquiper trop tôt. Payer 50 € par mois d'outil premium pour deux clients, c'est de la dette de confort. Le gratuit tient jusqu'à 4-6 clients — c'est-à-dire jusqu'à ton objectif de 5 000 à 8 000 € mensuels. Après, on en reparle.

## Action immédiate

Ouvre Notion ou Trello, gratuit. Crée le board de ton client principal : les groupes des deux prochains mois, les dix colonnes, les sept statuts. Puis migre le mois en cours — chaque post existant devient une ligne avec son vrai statut d'aujourd'hui, visuels déposés sur les lignes. Cinquante minutes. Le test de réussite est simple : demain matin, tu dois pouvoir répondre à « où en est le post du 14 ? » en cinq secondes, sans ouvrir ni ta boîte mail ni ta mémoire.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Board type : colonnes et statuts","description":"La structure complète à reproduire dans n'importe quel outil — les dix colonnes, les sept statuts avec leur responsable, et la logique des sous-éléments par réseau.","kind":"template","url":null},{"title":"Rituel du lundi en 20 minutes","description":"Le déroulé minuté de la revue hebdomadaire par client : avancement des statuts, filtre des relances, contrôle que la semaine qui s'ouvre est entièrement programmée.","kind":"checklist","url":null},{"title":"Trello","description":"Outil de gestion en tableaux dont la version gratuite suffit pour construire le board type jusqu'à quatre clients.","kind":"tool","url":"https://trello.com"},{"title":"Notion","description":"Alternative gratuite en base de données, adaptée si tu préfères des vues filtrées par statut ou par client.","kind":"tool","url":"https://www.notion.so"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '45b5095f-188e-4a15-8e61-2c40553f3642'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid, c.id, c.org_id, 'ecriture-copywriting', $sq$Écriture et copywriting$sq$, $sq$Ce module t'apprend à écrire des posts qui arrêtent le scroll et convertissent, plateforme par plateforme : LinkedIn, Instagram, Facebook, TikTok, X et Threads. Tu repars avec les mécaniques d'accroche, une structure de post par réseau et une méthode de dosage des CTA qui préserve la portée.$sq$, 6, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f8636f21-1d12-4911-b7b2-61fc60e63dc2'::uuid, m.id, m.course_id, m.org_id, 'mecaniques-de-l-accroche', $sq$L'accroche : les mécaniques psychologiques qui fonctionnent$sq$, $sq$Cette leçon détaille les quatre mécaniques psychologiques d'une accroche efficace : curiosité, spécificité, tension et preuve, avec des exemples réécrits avant/après. Tu apprends la méthode des dix accroches et tu constitues une banque d'accroches réutilisable, classée par mécanique et par pilier éditorial.$sq$, $sq$## L'accroche

Tu passes deux heures sur un post. Recherche, rédaction, relecture, visuel. Tu publies. Résultat : quatre likes, dont celui de ta mère et celui d'un confrère. Le réflexe, c'est de blâmer l'algorithme. Dans neuf cas sur dix, le vrai coupable, c'est ta première ligne. Sur Instagram, la légende est coupée après 125 caractères. Sur LinkedIn, après deux lignes et demie. Sur Facebook, après trois. La décision de lire ou de scroller se prend là, sur une dizaine de mots. Et ces dix mots, la plupart des freelances les écrivent en dernier, fatigués, comme on rédige un objet de mail administratif : « Découvrez notre nouvelle gamme ». Personne ne s'arrête là-dessus. Dans cette leçon, tu vas voir les quatre mécaniques psychologiques qui arrêtent réellement le scroll — curiosité, spécificité, tension, preuve — avec des accroches réécrites avant/après, que tu pourras transposer dès ton prochain post client.

## Le contenu

### Le seul travail d'une première ligne

Une accroche n'a pas à vendre, pas à résumer, pas à faire joli. Elle a un seul travail : faire lire la deuxième ligne. C'est tout. Si tu juges tes accroches sur ce critère unique, tu élimines déjà 80 % de ce que tu écris spontanément. « Retour sur notre événement du 12 mars » ne donne aucune raison de lire la suite. « On a failli annuler l'événement du 12 mars à 9 h du matin » en donne une.

### Mécanique 1 : la curiosité

Le cerveau supporte mal une information incomplète. Quand tu ouvres une boucle — tu annonces qu'une information existe sans la donner — le lecteur ressent un inconfort qu'il ne peut résoudre qu'en lisant la suite.

Avant : « Nos conseils pour mieux dormir. »
Après : « J'ai supprimé une seule habitude et je me suis endormi 40 minutes plus tôt. Ce n'est pas le café. »

La deuxième version ouvre deux boucles : quelle habitude, et pourquoi pas le café. La règle absolue : le post doit refermer la boucle. Si tu promets une réponse et que tu ne la donnes pas, tu gagnes un clic et tu perds un lecteur.

### Mécanique 2 : la spécificité

Un chiffre précis bat un adjectif, toujours. « Beaucoup de clients » ne pèse rien ; « 37 clients » pèse. Et un chiffre non arrondi bat un chiffre rond : 4 830 paraît mesuré, 5 000 paraît inventé.

Avant : « Comment améliorer votre visibilité sur Instagram. »
Après : « De 210 à 4 830 abonnés en 6 mois : les 3 décisions qui ont tout changé. »

La spécificité s'applique aussi aux situations : « un client » devient « un client qui vend des vérandas à Cholet ». Plus c'est précis, plus c'est crédible, et plus c'est crédible, plus on lit.

### Mécanique 3 : la tension

La tension naît d'une friction entre ce que le lecteur croit et ce que tu affirmes. C'est le contre-pied.

Avant : « Publier régulièrement est important. »
Après : « Tout le monde te dit de poster tous les jours. C'est le meilleur moyen de tuer ton compte. »

Deux conditions. Un : tu dois vraiment défendre la position dans le post, avec des arguments — une tension non assumée, c'est de la provocation gratuite. Deux : le contre-pied doit rester dans le champ de compétence de la marque. Une mutuelle qui prend un contre-pied sur la crypto sort de son terrain et perd sa crédibilité.

### Mécanique 4 : la preuve

Tu ouvres avec un résultat vérifiable, puis tu expliques. La preuve attire parce qu'elle promet du concret, pas de l'opinion.

Avant : « L'importance de répondre à ses avis clients. »
Après : « On a répondu aux 214 avis clients en retard. Trois mois plus tard, la note Google est passée de 3,8 à 4,4. »

La preuve exige une source : un export d'outil, une statistique interne validée par le client, un résultat que tu as mesuré toi-même. Jamais un chiffre inventé — le jour où on te demande la source, ta réputation part avec.

### Combiner sans surcharger

Les mécaniques se combinent : une preuve est plus forte avec un chiffre spécifique, une curiosité se marie bien à une tension. Mais deux par accroche suffisent. Une première ligne qui essaie les quatre ressemble à un titre de tabloïd, et le lecteur le sent.

### La méthode des dix accroches

En production, applique ce rituel : écris ton post, puis écris dix premières lignes différentes. Pas trois, dix. Les trois premières seront des titres déguisés — c'est normal, c'est l'échauffement. Les bonnes arrivent entre la sixième et la dixième. Choisis-en une, range les neuf autres dans un fichier « banque d'accroches », classé par mécanique et par pilier éditorial. Au bout de deux mois, tu ne pars plus jamais de zéro. Dernier filtre avant publication, le test de la ligne seule : lis ton accroche sans le reste du post. Donne-t-elle une raison concrète de lire la suite ? Si la réponse est « bof », retourne au fichier.

## Exemple appliqué

Prenons une mutuelle santé régionale, cible B2C 25-45 ans, 8 posts par mois dans un retainer starter à 1 200 € HT. Sujet du post : la résiliation infra-annuelle, qui permet de changer de mutuelle à tout moment après un an de contrat. L'accroche livrée par le client : « La résiliation infra-annuelle vous permet de changer de complémentaire santé à tout moment. » C'est exact, et c'est illisible : vocabulaire juridique, aucune raison de lire la suite.

Quatre réécritures, une par mécanique.

Curiosité : « Il y a une ligne dans votre contrat de mutuelle que votre assureur préfère que vous ne lisiez jamais. »

Spécificité : « 312 € par an. C'est l'écart moyen constaté entre deux mutuelles pour des garanties équivalentes. »

Tension : « Vous êtes fidèle à votre mutuelle depuis 8 ans ? C'est exactement pour ça que vous payez trop cher. »

Preuve : « Le mois dernier, 43 personnes ont changé de mutuelle en cours d'année avec notre équipe. Frais de dossier : 0 €. »

Le choix dépend de l'objectif du post, défini à l'étape Expression de la méthode SPEED. Objectif engagement : la tension, qui fait réagir en commentaires. Objectif conversion : la preuve, qui rassure avant le clic. Point de vigilance sectoriel : l'assurance est un secteur régulé. Le chiffre de 312 € doit sortir d'une étude réelle, citée en légende, et chaque affirmation chiffrée passe en validation client avant publication. Tu notes cette règle dans la charte éditoriale, pas dans ta tête.

## Les erreurs fréquentes

L'accroche-titre. Tu résumes le post au lieu d'ouvrir une boucle. « Retour sur notre partenariat avec le club de basket » dit tout, donc personne ne lit rien. Garde l'information, retire la conclusion : « Ce partenariat, on a hésité trois fois avant de le signer. »

Le teasing creux. « Vous n'allez pas en croire vos yeux » promet tout et n'engage rien. La curiosité sans substance concrète produit un lecteur méfiant qui ne reviendra pas.

Le clickbait menteur. L'accroche promet ce que le post ne tient pas. Tu gagnes des clics une semaine ; l'algorithme, qui mesure le temps passé sous le post, t'enterre le mois suivant.

Commencer par la marque. « Chez Mutuelle Untel, nous sommes fiers de vous annoncer… » Le lecteur ne suit pas un compte pour lire des communiqués. La marque arrive dans le corps du post, jamais dans les dix premiers mots.

La question fermée molle. « Et vous, aimez-vous être bien remboursé ? » La réponse est oui, l'interaction s'arrête là. Une question d'accroche doit diviser ou intriguer, jamais quémander.

## Action immédiate

Prends le dernier post publié pour ton client — ou pour ton propre compte. Chronomètre 45 minutes. Écris dix accroches alternatives : trois en curiosité, trois en spécificité, deux en tension, deux en preuve. Sélectionne la meilleure avec le test de la ligne seule. Crée ensuite un fichier « Banque d'accroches » à quatre colonnes — mécanique, accroche, pilier, statut — et ranges-y les dix lignes. Utilise la gagnante pour ton prochain post du même pilier, et compare l'engagement à 48 heures avec celui du post précédent. C'est ta première donnée d'arbitrage.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Banque d'accroches","description":"Tableau à quatre colonnes (mécanique, accroche, pilier, statut) pour capitaliser les accroches non utilisées et ne plus jamais partir de zéro.","kind":"template","url":null},{"title":"Test de l'accroche en 5 questions","description":"Checklist de validation d'une première ligne avant publication : boucle ouverte, spécificité, promesse tenue par le post, marque absente des dix premiers mots, lecture autonome.","kind":"checklist","url":null},{"title":"Grille avant/après par mécanique","description":"Modèle de réécriture d'une accroche existante selon les quatre mécaniques, avec un exemple rempli sur un cas assurance.","kind":"template","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '5436705f-381c-4adb-ad6a-48e70dae3d49'::uuid, m.id, m.course_id, m.org_id, 'ecrire-pour-linkedin', $sq$Écrire pour LinkedIn$sq$, $sq$Tu découvres la structure exacte d'un post LinkedIn performant : hook intégré aux 210 premiers caractères, vouvoiement systématique, flèches contextuelles pour aérer, zéro gras dans l'accroche et question finale à réponse courte. La leçon couvre aussi le lien en premier commentaire, la longueur cible de 1 200 à 1 800 caractères et la fenêtre de publication du mardi au jeudi entre 8 h et 10 h.$sq$, $sq$## L'accroche

Claire gère le LinkedIn d'un transporteur B2B depuis quatre mois. Trois posts par semaine, propres, informatifs, avec du gras partout et cinq hashtags. Portée moyenne : 280 impressions. Un mardi, elle réécrit un seul post en changeant trois choses : l'accroche tient entière avant le « …plus », le gras disparaît, le texte respire avec des flèches. Même sujet, même créneau. Résultat : 4 100 impressions, 6 commentaires de dirigeants, une demande de devis en message privé. LinkedIn n'est pas une loterie. C'est la plateforme la plus mécanique de toutes : les règles d'écriture y sont connues, stables depuis des années, et presque personne ne les applique proprement. Cette leçon te donne la structure exacte d'un post qui performe, du premier caractère à la question finale, avec un post complet rédigé pour un client B2B.

## Le contenu

### Le vouvoiement, sans exception

Sur LinkedIn, la marque vouvoie. Ton audience est professionnelle, le contexte est professionnel, et le tutoiement y sonne soit influenceur, soit familiarité forcée — deux registres qui coûtent de la crédibilité à un client B2B. Même quand tu écris pour le profil personnel d'un dirigeant, il vouvoie ses lecteurs. Tu fixes cette règle dans la charte éditoriale à l'étape Expression de SPEED, et tu ne dévies plus, même dans les réponses aux commentaires.

### Le hook, intégré au premier paragraphe

Sur LinkedIn, il n'y a pas de « première ligne » isolée : le lecteur voit un bloc d'environ 210 caractères sur ordinateur — moins sur mobile — avant le « …plus ». Ton accroche est donc un premier paragraphe complet, une à trois phrases, qui doit tenir entier avant la coupure. La structure qui fonctionne : une affirmation factuelle courte, puis une phrase qui ouvre la boucle. « Recruter un commercial coûte environ 30 000 € la première année. Le former à moitié coûte le double — et c'est ce que font la plupart des PME. » Prévisualise systématiquement pour vérifier où tombe la coupure : une boucle coupée au mauvais mot perd toute sa tension.

### Zéro gras dans l'accroche

Le gras n'existe pas nativement sur LinkedIn : ce sont des caractères Unicode détournés. Trois problèmes concrets. Les lecteurs d'écran ne les prononcent pas — ton accroche devient silencieuse pour une partie de l'audience. Le moteur de recherche LinkedIn ne les indexe pas — ton post disparaît des recherches sur ses propres mots-clés. Et visuellement, une accroche en gras crie « contenu marketing » : le lecteur scrolle avant d'avoir lu. Dans le corps du post, tolère-toi deux ou trois mots en gras au maximum ; dans l'accroche, zéro, jamais.

### Les flèches contextuelles pour aérer

LinkedIn n'offre ni puces, ni titres, ni mise en forme. L'aération se fabrique avec deux outils : une ligne blanche entre chaque idée, et des flèches « → » pour les énumérations. La flèche joue le rôle de la puce et crée un rythme vertical qui tire l'œil vers le bas — exactement ce que mesure l'algorithme, qui valorise le temps passé sur le post. Trois à cinq flèches par post. Au-delà, ton texte devient une liste de courses et perd sa voix.

### La structure complète

Un post qui performe suit cinq blocs, dans l'ordre. Un : l'accroche — 210 caractères, boucle ouverte, zéro gras. Deux : le contexte — deux ou trois lignes qui posent une situation concrète, avec un qui, un quoi, un combien. Trois : le développement — le cœur du post, aéré, flèches sur les points clés. Quatre : la chute — une phrase qui reformule l'idée en leçon mémorisable. Cinq : la question finale — ouverte, précise, à laquelle un professionnel peut répondre en une phrase.

Longueur cible : 1 200 à 1 800 caractères. En dessous de 800, le temps de lecture est trop court pour peser dans l'algorithme ; au-delà de 2 500, tu perds les lecteurs mobiles.

Trois règles d'hygiène complètent la structure. Le lien externe va en premier commentaire, jamais dans le corps — un post avec lien voit sa portée divisée par deux à trois. Trois hashtags maximum, de niche, en fin de post. Et tu publies du mardi au jeudi entre 8 h et 10 h, puis tu restes disponible : l'algorithme juge le post sur sa première heure, et chaque commentaire sans réponse est une occasion perdue.

## Exemple appliqué

Une PME de transport premium B2B : douze chauffeurs, des trajets avec chauffeur pour les directions d'entreprises — aéroports, roadshows, séminaires. Retainer à 1 400 € HT par mois, LinkedIn comme canal unique, objectif : des demandes de devis. Voici un post complet du pilier « preuve d'expertise ».

L'accroche, 198 caractères : « Un roadshow investisseurs, c'est 9 rendez-vous en 2 jours dans 3 villes. Le vrai risque n'est pas le retard. C'est le dirigeant qui arrive épuisé au rendez-vous qui compte. »

Le contexte : « Le mois dernier, nous avons organisé les déplacements d'une direction financière entre Paris, Lyon et Genève. 640 kilomètres, 9 étapes, 2 jours. »

Le développement : « Ce que change une logistique pensée pour la personne, pas pour le trajet :

→ Les briefs se préparent en voiture : lumière de travail, silence, wifi stable.

→ Les horaires absorbent les dépassements : 20 minutes de battement à chaque étape.

→ Un seul interlocuteur pour les 9 étapes, joignable, qui recale tout en cas d'imprévu. »

La chute : « Le transport n'est pas un poste de confort. C'est la variable qui décide dans quel état votre dirigeant entre en réunion. »

La question : « Comment gérez-vous les déplacements de vos dirigeants sur les journées à enchaînement ? »

Total : environ 1 350 caractères, vouvoiement constant, zéro gras, trois flèches, lien vers la page devis posté en premier commentaire. Sur ce format publié deux fois par semaine pendant six semaines, ce client a vu sa portée moyenne multipliée par quatre et a signé un premier contrat récurrent de 2 800 € HT, né d'une conversation ouverte en commentaires.

## Les erreurs fréquentes

Publier uniquement depuis la page entreprise. La portée organique d'une page est structurellement faible ; un profil personnel porte trois à huit fois plus. Négocie dès la signature un accès au profil du dirigeant, ou au minimum un repost systématique de la page par lui.

Le gras Unicode partout. Illisible pour les lecteurs d'écran, invisible pour le moteur de recherche, et marqueur visuel de contenu publicitaire. Le supprimer est le gain le plus rapide de toute cette leçon.

Le lien dans le corps du post. La portée est divisée par deux à trois. Le premier commentaire fait exactement le même travail, sans la pénalité.

La question finale générique. « Qu'en pensez-vous ? » n'obtient rien : trop large, trop coûteuse à traiter pour le lecteur. Une question à laquelle on répond en une phrase précise obtient des réponses.

Publier et disparaître. L'algorithme évalue la première heure. Un post publié à 8 h 30 dont les commentaires restent sans réponse jusqu'à 14 h s'éteint, quel que soit son texte.

## Action immédiate

Reprends le dernier post LinkedIn publié pour ton client — ou le tien. En 40 minutes : réécris l'accroche pour qu'elle tienne entière en 210 caractères avec une boucle ouverte ; supprime tout le gras ; aère avec une ligne blanche par idée et trois flèches sur les points clés ; déplace le lien en premier commentaire ; remplace la question finale par une question à réponse courte. Programme la publication mardi ou mercredi entre 8 h et 10 h, bloque une heure dans ton agenda pour répondre aux commentaires, et note la portée à 24 heures dans ton fichier de suivi pour la comparer à ton ancien format.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Structure de post LinkedIn en 5 blocs","description":"Trame à remplir : accroche de 210 caractères, contexte chiffré, développement fléché, chute, question finale.","kind":"template","url":null},{"title":"Relecture avant publication LinkedIn","description":"Les huit vérifications avant de publier : gras, lien, hashtags, longueur, vouvoiement, question, créneau et disponibilité pour la première heure de commentaires.","kind":"checklist","url":null},{"title":"LinkedIn","description":"La plateforme elle-même, pour repérer les posts qui performent dans la niche de ton client avant d'écrire les tiens.","kind":"link","url":"https://www.linkedin.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '40fb871a-00aa-4b6f-b6e4-87f02940e253'::uuid, m.id, m.course_id, m.org_id, 'ecrire-pour-instagram-facebook', $sq$Écrire pour Instagram et Facebook$sq$, $sq$Cette leçon montre comment écrire pour Instagram — première ligne autonome sous 125 caractères, CTA d'enregistrement, lien en bio — puis adapter la légende à Facebook, où le lien est cliquable, le partage domine et le format court gagne. Tu repars avec une méthode d'adaptation en trois gestes qui remplace le copier-coller entre les deux plateformes.$sq$, $sq$## L'accroche

Tu programmes tes posts dans Meta Business Suite. Un clic, la même légende part sur Instagram et sur Facebook. Pratique. Et faux. Sur Instagram, ton lien ne se clique pas : le « cliquez ici pour découvrir » que tu as écrit devient une promesse morte. Sur Facebook, tes huit hashtags font brocante. Résultat des deux côtés : un post qui sent le copier-coller, et des chiffres médiocres que tu ne sais pas expliquer au client. Les deux plateformes appartiennent à Meta, partagent un outil de publication, et fonctionnent différemment sur les trois points qui comptent : le lien, le signal d'engagement dominant et la longueur. Cette leçon te donne les règles d'écriture communes aux deux, puis les spécificités de chacune, et une méthode d'adaptation en trois gestes qui prend cinq minutes par post.

## Le contenu

### Le socle commun : mobile, phrases courtes, première ligne autonome

Plus de 90 % des lectures se font sur téléphone. Concrètement : une phrase par idée, sujet-verbe-complément, et une ligne blanche entre chaque bloc. Une phrase de 25 mots se relit deux fois sur un écran de six pouces ; une phrase de 10 mots se lit une fois.

La première ligne est coupée sur les deux réseaux : après environ 125 caractères sur Instagram, après deux ou trois lignes sur Facebook. Elle doit donc être autonome : porter un sens complet et donner une raison d'appuyer sur « plus ». « Nouvelle collection disponible sur notre site, on vous en dit p » coupé au mauvais endroit ne raconte rien. « L'erreur qui divise par deux la durée de vie d'une bougie. » se suffit à elle-même.

Et un seul CTA par post. La leçon 6.6 détaille le dosage, mais la règle s'applique dès maintenant : deux demandes, zéro action.

### Instagram : l'enregistrement d'abord, le lien nulle part

Le lien en légende n'est pas cliquable. N'écris jamais « cliquez sur le lien ci-dessous » : il n'y a pas de lien. Les seules portes de sortie sont la bio — d'où la formule « lien en bio » — et les stickers en story. Conséquence directe sur l'écriture : sur Instagram, le CTA prioritaire n'est pas le clic, c'est l'enregistrement et le partage. Ce sont les deux signaux que l'algorithme valorise le plus, loin devant le like. Écris donc des légendes qui donnent une raison d'enregistrer — une liste, un tutoriel, une référence à retrouver — ou d'envoyer le post à quelqu'un de précis.

Les hashtags : trois à cinq, de niche, en fin de légende. Le bloc de trente hashtags génériques ne rapporte plus rien depuis des années et signale un compte amateur.

La longueur se décide selon le rôle du visuel. Si l'image porte tout — produit, ambiance —, une légende d'une à trois lignes suffit. Si le post est un carrousel informatif, la légende peut aller loin, jusqu'à la limite des 2 200 caractères, parce qu'elle complète un contenu qu'on garde.

### Facebook : le lien roi, le partage roi

Facebook prend l'exact contre-pied sur les deux points. Le lien est cliquable : c'est ici que vivent tes CTA de trafic — vers la boutique, l'article, le formulaire. Et le signal dominant est le partage : un post Facebook performe quand quelqu'un le montre à quelqu'un d'autre. Écris donc pour être partagé : information locale utile, chiffre étonnant, question qui divise gentiment.

La longueur : court. 80 à 250 caractères pour un post standard. L'audience est en moyenne plus âgée que sur Instagram — souvent 35 ans et plus — et lit dans un fil saturé. Les hashtags : zéro ou un.

Un piège spécifique : l'« engagement bait ». Meta pénalise explicitement les formules mécaniques — « likez si vous êtes d'accord », « taguez un ami », « partagez pour participer ». Une vraie question ouverte fonctionne ; une injonction à actionner un bouton de la plateforme se paie en portée.

### La méthode d'adaptation en trois gestes

Écris toujours la version Instagram d'abord : c'est la plus contrainte, donc la meilleure base. Puis adapte pour Facebook en trois gestes. Un : supprime les hashtags et remplace « lien en bio » par l'URL réelle. Deux : coupe le corps de 30 à 40 % — garde la première ligne, le point le plus fort et le CTA. Trois : change le CTA si nécessaire — l'enregistrement n'existe pas dans les usages Facebook, remplace-le par un clic ou une question de partage. Cinq minutes par post, et chaque plateforme reçoit un texte qui lui ressemble.

## Exemple appliqué

Une marque e-commerce lifestyle : bougies artisanales coulées à la main, panier moyen 38 €, 14 000 abonnés Instagram, 3 200 sur Facebook. Lancement de la collection automne, dans un retainer starter à 1 100 € HT par mois pour 10 posts.

La version Instagram, écrite en premier :

« L'erreur qui divise par deux la durée de vie d'une bougie : la première flambée.

La première fois, laissez fondre toute la surface. Comptez deux heures.

Sinon, la cire se creuse en tunnel et vous perdez un tiers de la bougie.

Trois autres gestes qui changent tout :

Coupez la mèche à 5 mm avant chaque allumage.
Tenez-la loin des courants d'air.
Éteignez au bout de quatre heures maximum.

Enregistrez ce post pour le soir où vous allumerez la vôtre. La collection automne est en ligne — lien en bio.

#bougieartisanale #madeinfrance #decocosy »

Première ligne autonome sous 125 caractères, un conseil concret par ligne, CTA principal sur l'enregistrement — la mention du lien en bio reste une information secondaire, pas une deuxième demande —, trois hashtags de niche.

La version Facebook, adaptée en trois gestes :

« L'erreur qui divise par deux la durée de vie d'une bougie : la première flambée. Laissez fondre toute la surface la première fois — comptez deux heures — sinon la cire se creuse en tunnel.

La collection automne vient de sortir : le lien est juste ici.

Plutôt feu de bois ou fleur d'oranger ? »

Court, lien réel cliquable, question finale qui fait commenter et partager. Dans ton reporting mensuel, tu présentes les deux séparément : enregistrements et partages côté Instagram, clics et partages côté Facebook. Deux métriques différentes pour deux mécaniques différentes — les comparer entre elles n'aurait aucun sens, et le client doit le comprendre dès le premier rapport.

## Les erreurs fréquentes

Le copier-coller intégral. La même légende sur les deux réseaux garantit qu'elle est mauvaise sur au moins l'un des deux. L'adaptation prend cinq minutes ; son absence se voit immédiatement.

« Cliquez sur le lien » en légende Instagram. Il n'y a pas de lien cliquable en légende. Cette phrase dit au lecteur — et au client qui relit — que tu publies sans connaître la plateforme.

La première ligne sacrifiée. Commencer par « [Nom de la marque] vous présente » ou par une formule de salutation brûle les 125 caractères visibles. La marque est déjà dans le nom du compte, juste au-dessus du post.

Le pavé de hashtags. Trente hashtags génériques n'apportent plus de portée et dégradent la perception de la marque. Trois à cinq hashtags précis sur Instagram, zéro ou un sur Facebook.

L'engagement bait mécanique sur Facebook. « Likez si vous aimez l'automne » figure littéralement dans les formules que Meta déclasse. Pose une vraie question à la place — elle produit les mêmes commentaires, sans la pénalité.

## Action immédiate

Prends le prochain post prévu au planning de ton client. En 45 minutes : écris la version Instagram complète — première ligne autonome sous 125 caractères, une phrase par ligne, un CTA d'enregistrement ou de partage, trois à cinq hashtags de niche. Puis produis la version Facebook avec les trois gestes : hashtags supprimés et lien réel, corps raccourci de 30 à 40 %, CTA remplacé par un clic ou une question. Programme les deux dans Meta Business Suite et note dans ton fichier de suivi les métriques à relever dans une semaine : enregistrements côté Instagram, clics et partages côté Facebook.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Trame de légende Instagram","description":"Modèle en quatre blocs : première ligne autonome, corps aéré une phrase par ligne, CTA unique, trois à cinq hashtags de niche.","kind":"template","url":null},{"title":"Adaptation Instagram vers Facebook","description":"Les trois gestes d'adaptation d'une légende : hashtags et lien, coupe de 30 à 40 % du corps, remplacement du CTA d'enregistrement.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"L'outil gratuit de Meta pour programmer et adapter les publications Instagram et Facebook d'un même client.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ed60b733-b7e4-4f24-89c0-ee372e8d3ce6'::uuid, m.id, m.course_id, m.org_id, 'ecrire-pour-tiktok', $sq$Écrire pour TikTok$sq$, $sq$Sur TikTok, tu n'écris pas des posts mais des scripts pensés pour l'oral et les sous-titres, avec un ton neutre qui ne force pas la proximité. La leçon donne la structure chronométrée d'un script de 30 secondes — hook en trois couches, promesse, trois points, chute — et la question de clôture qui déclenche les tags en commentaires.$sq$, $sq$## L'accroche

Ton client savonnier veut être sur TikTok. Tu ouvres un document et tu commences à écrire… une légende. Mauvais réflexe. Sur TikTok, la légende arrive en dernier et presque personne ne la lit avant de regarder. Ce que tu écris vraiment, c'est un script : des phrases qui seront dites face caméra et lues en sous-titres, souvent sans le son. Deuxième mauvais réflexe : imiter les créateurs. « Coucou la team, aujourd'hui on se retrouve pour… » dans la bouche d'une marque de savons, tout le monde sent la fausse proximité dès le premier mot. TikTok pardonne beaucoup — les images imparfaites, la lumière moyenne, le montage simple — mais pas le ton qui sonne faux, ni les trois premières secondes ratées. Cette leçon t'apprend à écrire pour l'oral, à préparer les sous-titres, à trouver le ton neutre juste, et à clore avec la question qui déclenche des tags en commentaires.

## Le contenu

### Le ton neutre : ni corporate, ni copain

Le vouvoiement corporate de LinkedIn sonne administratif sur TikTok. Mais la fausse complicité — « les amis », « la team », « on se retrouve » — sonne pire : elle réclame une proximité que la marque n'a pas encore gagnée. Le ton juste est neutre et direct : celui de quelqu'un qui montre son métier à une personne curieuse. Techniquement, ça veut dire des formulations à la première personne — « je coule le savon », « on laisse reposer » — plutôt que des interpellations répétées du spectateur. La proximité viendra de la régularité des vidéos, pas du vocabulaire. Fixe ce ton dans la charte éditoriale à l'étape Expression de SPEED, avec trois exemples de phrases autorisées et trois exemples de phrases interdites.

### Écrire pour l'oral

Un script TikTok se dit, il ne se lit pas. Quatre règles. Un : douze mots par phrase maximum — une phrase, une respiration. Deux : vocabulaire parlé. « Néanmoins », « toutefois », « il convient de » n'existent pas à l'oral ; « mais », « et », « il faut » oui. Trois : 30 secondes de vidéo, c'est 65 à 75 mots prononcés. Pas 120. Si ton script dépasse, coupe des idées, pas des syllabes. Quatre : lis le script à voix haute avant de l'envoyer au tournage. Si tu bafouilles à la deuxième phrase, le client bafouillera aussi. Réécris.

### Écrire pour les sous-titres

Une grande partie des vues se fait sans le son — transports, bureau, canapé partagé. Les sous-titres ne sont pas une option d'accessibilité, ils sont le texte principal. Trois consignes à donner au montage : quatre à six mots par ligne affichée, synchronisation au mot près, et les deux ou trois mots pivots de la vidéo mis en couleur ou en majuscules. Le hook, lui, existe en trois couches simultanées : la première phrase dite, le geste montré à l'image, et une ligne de texte fixe en haut de l'écran qui résume l'enjeu. Tu écris les trois dans le script — sinon, c'est le monteur qui improvise.

### La structure d'un script de 30 secondes

De 0 à 2 secondes : le hook — phrase dite plus texte écran. Pas de logo, pas de jingle, pas de « bonjour ».
De 2 à 6 secondes : la promesse — ce que la vidéo va montrer ou expliquer.
De 6 à 25 secondes : le contenu. Trois points maximum, une phrase par point, une image par point.
De 25 à 30 secondes : la chute — l'idée reformulée en une phrase qui reste — puis la question de clôture.

### La question de clôture qui invite au tag

Le commentaire est le signal le plus puissant, et le tag est un commentaire qui amène un spectateur nouveau. La bonne question désigne une personne précise dans l'entourage du spectateur et prolonge le contenu de la vidéo. « Vous connaissez quelqu'un qui fait encore ça ? Taguez-le. » fonctionne parce qu'elle découle de ce qu'on vient de voir. Une injonction déconnectée — « taguez trois potes » — n'est que du bruit. Variante plus douce, la question de choix : « Plutôt version citron ou version lavande ? » Elle fait écrire un mot, c'est suffisant pour l'algorithme.

### La légende, en dernier

Courte : une phrase de contexte plus des mots-clés de recherche. TikTok est un moteur de recherche — les gens tapent « savon artisanal » ou « routine peau sensible ». Mets ces expressions dans la légende et dans le texte dit, parce que l'audio est indexé aussi. Trois à cinq hashtags descriptifs. Aucun hashtag magique de portée : ça n'existe pas.

## Exemple appliqué

Une savonnerie artisanale : vente en ligne, deux marchés par semaine, panier moyen 24 €. Objectif TikTok : notoriété locale et trafic vers la boutique, à raison de trois vidéos par semaine dans un retainer starter à 900 € HT. Voici le script complet de la première vidéo — 72 mots.

Hook, 0 à 2 secondes, dit face caméra en tenant un savon : « Ce savon n'a pas le droit d'être vendu avant quatre semaines. » Texte écran : « 4 semaines d'attente obligatoire ».

Promesse, 2 à 6 secondes : « C'est la cure. Et c'est ce qui sépare un bon savon d'un savon qui abîme la peau. »

Contenu, 6 à 25 secondes, trois plans sur l'atelier : « Pendant la cure, l'eau s'évapore : le savon durcit et dure plus longtemps. » Puis : « La soude finit de se transformer : plus aucune trace au contact de la peau. » Puis : « Le pH descend et se stabilise : c'est là que le savon devient doux. »

Chute, 25 à 30 secondes : « Un savon vendu trop tôt, c'est une réaction chimique inachevée. » Question de clôture : « Vous connaissez quelqu'un qui achète son savon sans regarder ça ? Taguez-le. »

Légende : « La cure, l'étape invisible de la saponification à froid. #savonartisanal #saponificationafroid #routinepeau »

Le script a été lu à voix haute deux fois et chronométré à 29 secondes. Les trois couches du hook sont écrites noir sur blanc : le monteur n'a rien à inventer, l'artisan sait exactement quoi dire et quoi montrer.

## Les erreurs fréquentes

La fausse proximité. « Coucou la team » et « les amis » dans la bouche d'une marque déclenchent un scroll immédiat. Le ton neutre de quelqu'un qui montre son métier gagne sur la durée.

Les phrases écrites. Une subordonnée relative de vingt mots se lit bien et se dit mal. Si le script n'a pas été lu à voix haute avant le tournage, ça s'entend à l'écran — et ça se voit au nombre de prises.

La vidéo sans sous-titres. Tu perds toutes les vues sans le son, et l'indexation du texte avec. Les sous-titres automatiques de CapCut prennent dix minutes à corriger : c'est le meilleur ratio effort-résultat de toute la production.

Le hook gaspillé. Un logo animé, un « bonjour à tous » ou un plan d'installation dans les deux premières secondes, et la vidéo est morte avant d'avoir commencé. La première image montre déjà le sujet.

La clôture générique. « Dites-nous en commentaire ce que vous en pensez » n'invite personne. Une question qui désigne quelqu'un — « taguez la personne qui… » — ou qui propose un choix binaire produit des commentaires mesurables.

## Action immédiate

Écris le script de la prochaine vidéo de ton client : 70 mots maximum, structuré en hook, promesse, trois points, chute, question de clôture. Écris aussi la ligne de texte écran du hook et la légende avec ses mots-clés de recherche. Puis lis le script à voix haute deux fois, chronomètre en main : au-delà de 32 secondes, coupe un point entier, pas des syllabes. L'ensemble tient en 45 minutes, et tu obtiens ton premier gabarit réutilisable pour toutes les vidéos suivantes du compte.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Script TikTok 30 secondes","description":"Trame chronométrée : hook 0-2 s avec texte écran, promesse, trois points, chute et question de clôture, avec compteur de 70 mots maximum.","kind":"template","url":null},{"title":"Sous-titres et tournage","description":"Vérifications avant publication : lecture à voix haute chronométrée, sous-titres synchronisés de quatre à six mots par ligne, mots pivots mis en valeur, question finale ciblée.","kind":"checklist","url":null},{"title":"CapCut","description":"Outil de montage gratuit pour générer puis corriger les sous-titres automatiques des vidéos TikTok.","kind":"tool","url":"https://www.capcut.com"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3c8aecf8-f867-48a8-b05b-a873bbc2b5d7'::uuid, m.id, m.course_id, m.org_id, 'ecrire-pour-x-threads', $sq$Écrire pour X et Threads$sq$, $sq$Tu apprends l'architecture du thread en sept tweets : hook chiffré sans mention ni lien, cinq points autonomes, synthèse avec CTA motivé, mentions et liens réservés au dernier tweet ou aux réponses. La leçon détaille aussi ce qui sépare X de Threads et comment dériver un même contenu en post conversationnel pour Threads sans le dupliquer.$sq$, $sq$## L'accroche

Ton client te demande X et Threads « puisque c'est du texte, ça ne coûte rien ». Tu publies le même contenu sur les deux. Trois semaines plus tard : 40 vues par post sur X, 12 sur Threads, zéro commentaire. Traiter ces deux plateformes comme des jumelles est l'erreur la plus répandue — elles se ressemblent visuellement et fonctionnent à l'opposé. X récompense l'affirmation tranchée, le fil argumenté, le repost. Threads récompense la conversation, la question, la réponse. Et le format qui produit le plus de résultats sur X — le thread — obéit à une architecture précise que presque personne ne respecte : sept tweets, chacun avec un rôle. Cette leçon te donne cette architecture tweet par tweet, la place exacte des mentions et des liens, la façon d'ouvrir et de clore, et la méthode pour dériver le même contenu vers Threads sans le dupliquer.

## Le contenu

### Pourquoi le thread, et pourquoi sept

Un tweet isolé vit quelques minutes. Un thread retient le lecteur sur plusieurs écrans — et le temps de lecture est le signal que X valorise le plus. Sept tweets, c'est le format d'équilibre : assez long pour développer un vrai sujet, assez court pour être lu jusqu'au bout. Au-delà de dix, le taux de lecture complète s'effondre.

L'architecture, rôle par rôle.

Tweet 1 : le hook et la promesse. C'est 80 % du résultat. Un chiffre ou une affirmation à contre-pied, puis ce que le thread va livrer. Zéro mention, zéro lien, zéro hashtag dans ce tweet — chacun de ces éléments détourne le clic ou coupe la portée.

Tweets 2 à 6 : un point par tweet. Règle d'or : chaque tweet doit être autonome. Il peut être reposté seul, cité seul, lu seul, et se comprendre seul. Une phrase coupée en deux tweets casse cette mécanique.

Tweet 7 : la synthèse et le CTA. Tu reformules l'idée principale en deux lignes, tu donnes une action unique — suivre le compte pour un rendez-vous précis —, puis tu cites le tweet 1 en dessous pour relancer le fil.

### Où positionner les mentions

Trois règles. Un : jamais en début de tweet — un tweet qui commence par un @ se lit comme une réponse et perd sa visibilité de publication. Deux : jamais dans le tweet 1 — le hook doit rester propre, et une mention y détourne l'attention vers un autre compte au moment exact où tu essaies de capter la tienne. Trois : les mentions vivent dans le tweet 7, pour créditer une source ou associer un partenaire, ou au milieu d'un tweet quand la mention est l'information elle-même. Même logique pour les liens, que X pénalise : le lien va dans le tweet 7, ou mieux, en réponse au thread une fois celui-ci publié.

### Ouvrir et clore

L'ouverture qui fonctionne combine un chiffre et une tension, puis annonce la structure : « 5 idées reçues sur votre mutuelle vous coûtent de l'argent. La quatrième concerne 9 salariés sur 10. » Le lecteur sait ce qu'il va recevoir et combien de temps ça lui prendra. La clôture reformule le bénéfice — pas un résumé scolaire, la leçon en une phrase — et donne un seul CTA. « Suivez ce compte » tout nu ne suffit pas ; « suivez ce compte pour le point mensuel sur vos garanties » donne une raison de le faire.

### X contre Threads

X : 280 caractères en version gratuite, culture du repost et de la citation, réactivité à l'actualité, ton sec et direct, hashtags quasi inutiles — zéro ou un. L'audience valorise la position tranchée et l'expertise démontrée.

Threads : 500 caractères, un seul tag de sujet par post, un algorithme qui pousse les conversations — les réponses pèsent plus que les reposts —, une audience venue d'Instagram, plus douce, moins branchée sur l'actualité chaude. Conséquence directe : le thread de sept y performe mal. Sur Threads, tu dérives : tu prends le point le plus fort de ton thread, tu en fais un post autonome de 300 à 450 caractères, et tu le termines par une vraie question — parce que c'est la réponse qui déclenche la distribution. Si le sujet le mérite, tu étales trois posts dans la semaine plutôt qu'un fil le même jour.

## Exemple appliqué

Une mutuelle santé B2C veut exister sur X auprès d'un public de 25-45 ans. Sujet du mois : les idées reçues. Voici le thread complet, sept tweets.

Tweet 1 : « 5 idées reçues sur votre mutuelle vous coûtent de l'argent chaque mois. La quatrième concerne 9 salariés sur 10. »

Tweet 2 : « Idée reçue 1 : "changer de mutuelle, c'est compliqué." Depuis 2020, la résiliation est possible à tout moment après un an de contrat. La nouvelle mutuelle gère les démarches. Vous signez, c'est tout. »

Tweet 3 : « Idée reçue 2 : "la moins chère est forcément la moins bonne." Faux. Comparez poste par poste : optique, dentaire, hospitalisation. Deux contrats équivalents peuvent varier de 300 € par an. »

Tweet 4 : « Idée reçue 3 : "je suis jeune, je n'en ai pas besoin." Une hospitalisation, c'est un forfait journalier de 20 € par jour, non remboursé par la Sécurité sociale. Sans complémentaire, c'est pour vous. »

Tweet 5 : « Idée reçue 4 : "la mutuelle d'entreprise couvre tout." Elle couvre le contrat de base négocié par l'employeur. Vos besoins réels — orthodontie des enfants, lunettes — passent souvent par une surcomplémentaire. »

Tweet 6 : « Idée reçue 5 : "la fidélité est récompensée." Aucun contrat santé ne baisse avec l'ancienneté. Les tarifs augmentent avec l'âge, fidèle ou pas. Comparer chaque année est le seul réflexe rentable. »

Tweet 7 : « En résumé : la résiliation prend dix minutes, la fidélité ne paie pas, et l'écart entre deux contrats équivalents atteint 300 € par an. Suivez ce compte pour un point clair par mois sur vos garanties. »

Chaque tweet tient sous 280 caractères et se comprend seul. Le lien vers le comparateur du client part en réponse au tweet 7 après publication. Secteur régulé oblige : les chiffres — forfait journalier, écarts de tarifs — sortent des documents du client et sont validés avant publication.

La dérivation Threads, publiée deux jours plus tard : « On croit souvent que la mutuelle d'entreprise couvre tout. Elle couvre le contrat de base négocié par l'employeur — pas forcément l'orthodontie des enfants ni vos lunettes. Vous avez déjà comparé votre contrat collectif avec vos besoins réels ? » Un seul post, une question qui appelle des réponses, aucun fil.

## Les erreurs fréquentes

La mention ou le lien dans le tweet 1. Tu détournes le clic au moment où tu le captes, et X réduit la portée des publications à lien. Hook propre, lien en réponse.

Les tweets non autonomes. Un thread écrit comme un paragraphe coupé tous les 280 caractères ne produit aucun repost : aucun tweet n'y survit seul.

Le thread-fleuve. Quinze tweets parce que le sujet est riche : le taux de lecture complète s'écroule et le tweet 7 — celui du CTA — n'est jamais atteint. Deux threads de sept valent mieux qu'un de quinze.

Le copier-coller X vers Threads. Le fil de sept posts se noie sur Threads : l'algorithme y distribue des conversations, pas des monologues. Dérive un post autonome terminé par une question.

La clôture sans CTA. Un thread lu jusqu'au bout, c'est un lecteur chaud. Le laisser partir sans lui proposer une action — suivre, répondre, cliquer — gaspille le seul moment où il était acquis.

## Action immédiate

Choisis le sujet que ton client maîtrise le mieux et écris un thread de sept tweets en 50 minutes : tweet 1 avec chiffre, tension et promesse ; cinq points autonomes de moins de 280 caractères chacun ; tweet 7 en synthèse avec un CTA motivé. Vérifie chaque tweet isolément : se comprend-il seul, hors du fil ? Puis extrais le point le plus fort et transforme-le en post Threads de 300 à 450 caractères terminé par une question. Tu obtiens deux contenus natifs pour deux plateformes, à partir d'une seule recherche.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Squelette de thread en 7 tweets","description":"Trame à remplir : tweet 1 avec chiffre et promesse, cinq points autonomes sous 280 caractères, tweet 7 en synthèse avec CTA, emplacements des mentions et du lien.","kind":"template","url":null},{"title":"Relecture d'un thread avant publication","description":"Contrôles finaux : tweet 1 sans mention ni lien ni hashtag, autonomie de chaque tweet lu seul, longueurs, CTA unique en clôture.","kind":"checklist","url":null},{"title":"X","description":"La plateforme, pour observer les threads qui performent dans le secteur du client avant de rédiger.","kind":"link","url":"https://x.com"},{"title":"Threads","description":"La plateforme de Meta, pour repérer le ton conversationnel attendu avant d'y dériver tes contenus.","kind":"link","url":"https://www.threads.net"}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'dcbffed2-9fa9-4693-b1df-06aa69991bbb'::uuid, m.id, m.course_id, m.org_id, 'le-cta', $sq$Le CTA : orienter vers la conversion sans casser la portée$sq$, $sq$Cette leçon classe les CTA en trois familles — engagement, trafic, conversion — et fixe leur dosage sur un mois de publication : environ 70/20/10 sur 10 à 12 posts. Tu vois où placer chaque CTA, comment contourner les pénalités sur les liens sortants et l'engagement bait, et comment mesurer chaque famille au reporting mensuel.$sq$, $sq$## L'accroche

Deux clients, deux échecs symétriques. Le premier a 2 400 abonnés, un engagement correct, et zéro client entrant en huit mois : ses posts ne demandent jamais rien. Le second a mis « Prenez rendez-vous » sous chacun de ses douze posts mensuels : sa portée a fondu de 60 % en un trimestre, et son compte ressemble à un panneau publicitaire que tout le monde contourne. Le CTA n'est ni un réflexe ni un tabou : c'est un dosage. Les plateformes pénalisent ce qui fait sortir l'utilisateur ; ton client te paie pour ce qui le fait entrer en contact. Entre les deux, il existe une mécanique précise : trois familles de CTA, un dosage mensuel, et des emplacements qui préservent la portée. C'est ce que cette leçon installe, chiffres à l'appui, avec le plan CTA complet d'un mois de publication.

## Le contenu

### Les trois familles de CTA

Famille 1, l'engagement : commenter, enregistrer, partager, suivre. Coût quasi nul pour le lecteur, bénéfice direct pour l'algorithme — chaque action est un signal qui étend la portée. C'est le CTA d'entretien.

Famille 2, le trafic : cliquer vers un article, une page, un site. Coût moyen : le lecteur quitte la plateforme, ce que la plateforme n'aime pas. C'est le CTA de transition.

Famille 3, la conversion : demander un devis, réserver un appel, acheter. Coût élevé : le lecteur sort et s'engage. C'est le CTA qui paie le retainer — et celui qui s'use le plus vite.

### La règle du CTA unique

Un post, un CTA. « Enregistrez ce post, partagez-le à un collègue et prenez rendez-vous » produit zéro action : face à trois demandes, le lecteur n'arbitre pas, il passe. Tu choisis la famille avant d'écrire le post — c'est même le CTA qui détermine le contenu, pas l'inverse. Un post pensé pour l'enregistrement est une ressource ; un post pensé pour la conversion est une offre. Les deux ne s'écrivent pas pareil.

### Le dosage mensuel : 70/20/10

Sur un mois de 10 à 12 posts : 7 à 8 posts à CTA d'engagement, 2 à 3 posts à CTA de trafic, 1 à 2 posts à CTA de conversion. Ce dosage n'est pas une superstition. Chaque CTA de conversion dépense la confiance que les posts de valeur ont accumulée, et chaque lien sortant coûte de la portée. Le ratio 70/20/10 maintient l'algorithme de ton côté tout en tendant la main assez souvent pour que les prospects sachent où aller. Tu remarqueras qu'il ressemble à ton mix de chiffre d'affaires — 70 % retainer, 20 % projet, 10 % régie. Même logique : le fond de roulement d'abord, les pointes ensuite.

### Où placer le CTA

En fin de post, toujours après la valeur. Un CTA en ouverture transforme le post en publicité et tue la lecture. Trois cas particuliers. Sur une vidéo, le CTA est verbal et affiché à l'écran dans les cinq dernières secondes. Sur un post LinkedIn long, un rappel à mi-texte — « le lien est en commentaire » — est toléré. Sur Instagram, le CTA d'enregistrement se justifie dans la légende : « enregistrez pour retrouver la liste ».

### Préserver la portée

Trois contournements font la différence. Le lien sortant : en premier commentaire sur LinkedIn, en bio sur Instagram, direct sur Facebook où il est cliquable et accepté. L'engagement bait : Meta déclasse les formules mécaniques — « likez si », « taguez un ami », « partagez pour gagner » ; remplace-les par de vraies questions, qui produisent les mêmes signaux sans la pénalité. La formulation : verbe d'action, bénéfice, friction minimale. « Écrivez "audit" en commentaire, je vous envoie la trame » convertit mieux que « lien dans la bio », parce que l'action reste dans la plateforme.

### Mesurer et arbitrer

Chaque famille a sa métrique : commentaires et enregistrements rapportés à la portée pour l'engagement, clics traqués par UTM pour le trafic, demandes entrantes attribuées pour la conversion. C'est le D de SPEED : au reporting mensuel, tu compares les posts entre eux famille par famille, et tu ajustes le dosage du mois suivant. Un compte jeune supporte moins de conversion qu'un compte installé — le dosage évolue avec la maturité de l'audience, jamais avec ton impatience.

## Exemple appliqué

Transport premium B2B : douze chauffeurs, clientèle de directions d'entreprises, LinkedIn comme canal unique, 10 posts par mois dans un retainer à 1 500 € HT. Voici le plan CTA du mois, poste par poste.

Sept posts d'expertise — coulisses d'un roadshow, coûts cachés des déplacements professionnels, témoignage d'un chauffeur — se terminent chacun par une question précise à laquelle un dirigeant peut répondre en une phrase. Famille engagement.

Deux posts d'étude de cas — « comment nous avons absorbé l'annulation d'un vol à 6 h du matin » — pointent vers la page références du site, lien en premier commentaire. Famille trafic.

Un post d'offre, en fin de mois : « En septembre, nous auditons gratuitement les coûts de déplacement de trois entreprises. Écrivez "audit" en commentaire ou en message privé. » Famille conversion, avec une action qui reste dans la plateforme et une rareté explicite — trois places, un mois.

Résultat type de ce dosage tenu trois mois : la portée reste stable parce que neuf posts sur dix nourrissent l'algorithme ; l'offre mensuelle ressort précisément parce qu'elle est rare ; et le pipeline se remplit — une poignée de conversations privées par mois, deux ou trois audits réalisés, et un seul contrat signé rembourse le retainer plusieurs fois. Le contre-scénario se vérifie tout aussi bien : le même client avec « Demandez votre devis » sous les dix posts aurait vu sa portée baisser dès la troisième semaine, et son offre se banaliser au point de ne plus déclencher un seul commentaire.

## Les erreurs fréquentes

La conversion partout. Le CTA de conversion tire sa force de sa rareté. Répété à chaque post, il coûte la portée et l'effet de rareté : double perte, aucun gain.

Les CTA empilés. Deux demandes dans un post divisent l'action par plus de deux. Choisis la famille avant d'écrire, et coupe à la relecture si une deuxième demande s'est glissée.

Le lien sortant par réflexe. Mettre l'URL dans le corps du post LinkedIn par habitude, c'est payer une taxe de portée sur chaque publication, alors que le premier commentaire fait le même travail gratuitement.

L'engagement bait mécanique. « Likez si vous êtes d'accord » est documenté comme pénalisé par Meta. La question ouverte produit les mêmes commentaires sans le déclassement.

Ne jamais demander. C'est l'erreur inverse, et la plus chère : des mois de posts de valeur sans jamais tendre la main. La peur de vendre coûte plus au client que n'importe quelle pénalité algorithmique — c'est son pipeline qui reste vide, et ton retainer qui devient indéfendable au renouvellement.

## Action immédiate

Fais l'audit CTA du dernier mois de ton client, en 40 minutes. Liste les posts publiés dans un tableau à quatre colonnes : sujet, CTA présent — cite-le mot pour mot —, famille (engagement, trafic, conversion, ou « aucun »), résultat mesurable. Calcule la répartition réelle et compare-la au dosage 70/20/10. Dans la grande majorité des audits, tu trouveras soit zéro CTA de conversion, soit des liens sortants dans le corps des posts. Corrige le planning du mois prochain en conséquence, et note la portée moyenne actuelle : c'est ta base de comparaison pour mesurer l'effet du rééquilibrage au prochain reporting.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Matrice CTA par objectif et par réseau","description":"Tableau croisant les trois familles de CTA avec les cinq réseaux, formulations types et emplacement du lien pour chacun.","kind":"template","url":null},{"title":"Audit CTA d'un mois de publications","description":"Grille à quatre colonnes (sujet, CTA cité mot pour mot, famille, résultat) pour calculer la répartition réelle et la comparer au dosage 70/20/10.","kind":"checklist","url":null},{"title":"Metricool","description":"Outil freemium de programmation et de statistiques pour suivre clics et engagement post par post.","kind":"tool","url":"https://metricool.com"}]$sq$::jsonb, 6, true
from academy_modules m
where m.id = '0b208cf1-b2cf-480c-97f3-9daaa511a47d'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '86266f04-4780-4a92-9bf8-44c96141acfc'::uuid, c.id, c.org_id, 'production-contenu', $sq$Production de contenu$sq$, $sq$Ce module couvre toute la chaîne de production des contenus : briefer un graphiste ou un monteur, décliner une charte de marque en système social, produire de la vidéo courte seul au smartphone et organiser une banque de fichiers propre. Tu en sors avec des process chiffrés et reproductibles qui tiennent dans un retainer sans sacrifier ta marge.$sq$, 7, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'c460b0c0-3be7-4eaa-9eb4-b667ffb99dc2'::uuid, m.id, m.course_id, m.org_id, 'brief-crea', $sq$Brief créa : ce qu'un graphiste ou monteur doit recevoir$sq$, $sq$Cette leçon détaille les huit blocs d'un brief créa complet : contexte et objectif, livrables exacts, textes définitifs, références commentées, interdits, assets, délais avec allers-retours limités et circuit de validation. Elle chiffre le coût réel d'un brief flou et montre un brief appliqué à un carrousel LinkedIn pour un client transport premium B2B.$sq$, $sq$## L'accroche

Tu envoies un vocal de trois minutes à ton graphiste : « Il me faudrait un carrousel sympa pour LinkedIn, un truc premium, tu vois l'esprit. » Quatre jours plus tard, tu reçois six slides violettes avec une typographie ronde. Ton client, lui, vit dans le bleu marine et la sobriété. Tu demandes une V2. Puis une V3. Bilan : neuf jours de délai au lieu de trois, un graphiste agacé qui augmentera son tarif au prochain devis, un client qui commence à douter de toi, et deux heures de ton temps passées à réexpliquer ce qu'un document d'une page aurait dit du premier coup. Un brief flou ne fait pas gagner du temps : il le déplace plus loin dans le mois, au moment précis où tu n'en as plus. Dans cette leçon, tu vas construire le brief qui fait tomber juste dès la première version. Huit blocs, une page, trente minutes.

## Le contenu

Un brief est un document écrit. Pas un appel, pas un vocal, pas un fil de messages étalé sur quatre jours. Écrit, daté, envoyé en une seule fois, avec tout dedans. Il appartient à l'étape Exécution de la méthode SPEED : c'est lui qui transforme ton planning éditorial en fichiers publiables sans que tu deviennes le goulot d'étranglement de ta propre production.

Avant le détail, pose le calcul. Chaque aller-retour évitable coûte deux à trois jours calendaires et quarante-cinq minutes de ton temps : relire, commenter, réexpliquer, revalider. Sur un retainer à 1 200 € HT avec dix posts par mois, trois allers-retours inutiles par semaine et ta marge fond en silence. Un brief complet prend trente minutes la première fois, quinze avec ton modèle. C'est l'heure la mieux payée de ton mois.

### Les huit blocs d'un brief complet

**1. Contexte et objectif.** Deux phrases sur le client si le prestataire ne le connaît pas, puis l'objectif du contenu : notoriété, engagement, génération de demandes. « Ce carrousel doit provoquer des demandes de devis » et « ce carrousel doit faire connaître la marque » ne produisent pas le même design. Précise aussi le pilier éditorial auquel le post appartient.

**2. Livrables exacts.** Nombre de fichiers, formats, dimensions. Un carrousel Instagram : sept images 1080 × 1350 en PNG. Un carrousel LinkedIn : un PDF au même ratio. Une story : 1080 × 1920. Ajoute les déclinaisons attendues et le format de fichier de sortie. « Un visuel » n'est pas un livrable, c'est une devinette.

**3. Les textes, définitifs et posés.** Slide par slide, relus, sans faute, validés. Le graphiste met en forme, il ne rédige pas et ne corrige pas. Règle absolue : tant que le wording n'est pas validé, le brief ne part pas. Un texte qui change après la V1 casse la mise en page et déclenche l'aller-retour que tu voulais éviter.

**4. Les références.** Deux ou trois exemples visuels précis, avec ce que tu retiens de chacun : « la hiérarchie des titres de celui-ci, pas ses couleurs », « le fond photo plein cadre de celui-là ». Une référence sans commentaire est une loterie : le graphiste peut en retenir exactement ce que tu voulais écarter.

**5. Les interdits.** Ce que le client refuse, parce que tu le sais et pas ton prestataire : pas de photos de banque d'images avec poignées de main, pas de jaune, pas d'humour, pas de superlatifs. Trois lignes qui évitent une V1 morte à l'arrivée.

**6. Les assets.** Logo en vectoriel, charte, photos HD, typographies avec leur licence. Un seul lien vers un dossier propre, pas huit pièces jointes réparties sur trois mails. Si tu as suivi la leçon sur la banque de contenus, ce lien existe déjà.

**7. Délais et allers-retours.** Date et heure de la V1, nombre de retours inclus — deux, c'est le standard —, date finale butoir alignée sur la date de publication moins deux jours de sécurité. Un retour au-delà des deux inclus se paie : dis-le dans le brief, pas au moment de la facture.

**8. Circuit de validation.** Qui valide, dans quel ordre, sous quelle forme. Toi d'abord, puis le client, avec un délai de réponse annoncé. Un fichier validé reçoit un « validé » écrit, pas un pouce sur un message vocal.

Le tout tient sur une page. Si ton brief en fait quatre, tu as écrit une stratégie, pas un brief.

## Exemple appliqué

Tu gères les réseaux de Meridian, société de transport premium B2B : berlines avec chauffeur pour dirigeants, sièges sociaux et délégations étrangères. Retainer à 1 400 € HT par mois, dix posts, LinkedIn en réseau principal. Le planning prévoit un carrousel « Pourquoi vos visiteurs VIP ne devraient jamais attendre un taxi ». Tu le confies à ta graphiste freelance. Ton brief : objectif, générer des demandes de devis auprès des offices managers et assistantes de direction — donc une slide finale avec un appel à l'action clair, pas une signature discrète. Livrable : un PDF de sept slides 1080 × 1350, plus la couverture exportée en PNG. Textes posés slide par slide, dont la couverture : « Votre client arrive de Singapour à 6 h 40. Qui l'attend ? » Références : un carrousel d'un cabinet de conseil pour la hiérarchie typographique, un d'une compagnie aérienne pour la photo pleine page. Interdits : pas de rouge — c'est la couleur du concurrent principal —, pas de photos de chauffeurs en casquette, pas du mot « VTC ». Assets : un lien vers le dossier Meridian avec logo SVG, charte PDF et douze photos de flotte HD. Délais : V1 mercredi 10 h, deux retours inclus, final vendredi 17 h pour publication mardi. Validation : toi, puis l'office manager de Meridian sous 24 h. Résultat : V1 conforme, un seul retour — un contraste à corriger slide 4 — et publication à la date prévue. Le même carrousel brifé en vocal t'avait coûté trois versions le mois précédent.

## Les erreurs fréquentes

**Le brief oral.** Un appel de vingt minutes semble plus rapide qu'un document. Mais rien n'est tracé : quand la V1 arrive à côté, chacun a sa version de ce qui a été dit, et c'est ta parole contre celle du prestataire. L'écrit protège les deux.

**« Fais-toi plaisir, carte blanche. »** Tu crois offrir de la liberté, tu livres une charge. Le graphiste ne connaît ni le client, ni ses allergies, ni l'objectif : il devine, et une V1 devinée est une V1 refusée. La liberté utile se donne à l'intérieur d'un cadre, pas à la place du cadre.

**Envoyer des textes provisoires.** « Je t'envoie le wording final dans la semaine » transforme chaque visuel en chantier permanent. Chaque changement de texte après mise en page coûte un aller-retour complet. Wording validé d'abord, brief ensuite, sans exception.

**Zéro interdit mentionné.** Tu connais les lignes rouges du client parce que tu vis avec lui depuis des mois. Ton prestataire, non. Une V1 rejetée pour une couleur interdite que tu n'avais pas signalée, c'est ta faute, pas la sienne — et c'est toi qui absorbes le délai.

**Aucune limite d'allers-retours.** Sans nombre de retours défini, le client itère sans fin, le graphiste s'épuise ou te refacture, et tu es coincé au milieu. Deux retours inclus, écrits dans le brief, le reste en supplément chiffré.

## Action immédiate

Ouvre un document vierge et crée ton modèle de brief avec les huit blocs en titres : contexte et objectif, livrables, textes, références, interdits, assets, délais et retours, validation. Puis remplis-le pour le prochain visuel de ton planning — même si c'est toi qui le produis : le brief que tu t'écris à toi-même révèle les trous avant qu'ils coûtent. Si un prestataire intervient, envoie-le-lui dans la foulée. Quarante-cinq minutes, pas plus.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Modèle de brief créa en 8 blocs","description":"Document d'une page à dupliquer par visuel, avec les huit blocs en titres et une ligne d'exemple rempli sous chacun.","kind":"template","url":null},{"title":"Checklist avant envoi du brief","description":"Les dix points à cocher avant d'envoyer un brief : wording validé, dimensions précisées, interdits listés, lien assets testé, dates posées.","kind":"checklist","url":null},{"title":"Google Drive","description":"Espace de stockage partagé pour centraliser les assets du brief dans un seul lien plutôt que huit pièces jointes.","kind":"tool","url":"https://drive.google.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '86266f04-4780-4a92-9bf8-44c96141acfc'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '12295808-ed82-4916-90ec-c73443793c59'::uuid, m.id, m.course_id, m.org_id, 'direction-artistique', $sq$Direction artistique et charte social media$sq$, $sq$Cette leçon apprend à traduire une charte de marque print en système social : palette réduite à quatre couleurs, deux typographies avec tailles minimales, six à huit gabarits adossés aux piliers éditoriaux, règles photo et vidéo écrites. Elle montre la déclinaison complète pour une assurance mutualiste B2C et explique pourquoi ce livrable se facture dans la mission stratégie.$sq$, $sq$## L'accroche

Ton client t'envoie fièrement sa « charte graphique » : un PDF de quarante pages, magnifique, pensé pour le print. Papier à en-tête, plaquette commerciale, signalétique de salon. Pas une ligne sur un post de 1080 pixels lu sur un téléphone dans le métro. Alors chaque post réinvente : une fois la typo serif, une fois une sans-serif trouvée sur Canva, un fond bleu par-ci, un dégradé par-là. Trois mois plus tard, le feed ressemble à un patchwork et le client lâche la phrase qui tue : « On ne reconnaît pas notre marque. » Il a raison, et ce n'est pas un problème de talent. C'est un problème de système. La direction artistique social media, c'est la traduction d'une charte de marque en règles applicables en cinq minutes par post. Dans cette leçon, tu construis ce système en six étapes — et tu apprends à le facturer.

## Le contenu

Ce travail appartient à l'étape Expression de la méthode SPEED, et il se vend : la déclinaison social de la charte fait partie de la stratégie que tu factures 1 500 à 3 000 € HT en one-shot. Offert « en bonus », il n'est ni respecté ni renouvelé. Chiffré, il devient un livrable.

### 1. Auditer la charte existante

Liste ce qui survit à l'écran. Les couleurs : gardent-elles un contraste lisible sur mobile, en plein soleil ? Les typographies : la licence couvre-t-elle un usage digital, et la serif fine élégante sur une plaquette reste-t-elle lisible en petit corps sur un téléphone ? Le logo : existe-t-il en version simplifiée, lisible à 30 pixels dans un coin de visuel ? Note ce qui passe, ce qui casse, ce qui manque. Cet audit tient sur une page et justifie à lui seul ton devis.

### 2. Réduire la palette

Une couleur dominante, une couleur d'accent, deux neutres. Pas plus. La règle qui évite 80 % des visuels illisibles : la couleur vive d'une marque est rarement une couleur de texte. Du texte blanc posé sur un vert ou un orange de marque tombe souvent sous le seuil de lisibilité — prends une version foncée de la teinte pour tout ce qui se lit, garde la teinte vive pour les fonds, les pastilles, les marques visuelles. Fixe aussi le dosage : l'accent occupe 10 % des surfaces, jamais 50.

### 3. Deux typographies, pas trois

Une pour les titres, une pour le corps. Si la typo print du client n'a pas de licence web ou digitale, choisis une équivalente libre sur Google Fonts et documente le choix. Fixe des tailles minimales sur un canevas de 1080 pixels : titres à 70 minimum, corps jamais sous 40. Un texte que tu dois zoomer pour lire sur ton propre téléphone est un texte que personne ne lira.

### 4. Construire six à huit gabarits

Chaque gabarit répond à un pilier éditorial : citation, chiffre clé, carrousel pédagogique — couverture, slide courante, slide finale avec appel à l'action —, couverture de reel, story question, annonce. Chaque gabarit distingue zones fixes — logo, marges, position du titre — et zones variables — texte, image. Construis-les dans un outil que le client peut ouvrir, Canva en tête, avec les éléments fixes verrouillés si quelqu'un chez lui publie parfois en direct. Six gabarits couvrent un mois entier de publication ; quinze gabarits ne forment plus un système.

### 5. Écrire les règles photo et vidéo

Les gabarits font 50 % de la cohérence, les images font le reste — et c'est là que tout s'écroule d'habitude. Photo : lumière naturelle ou artificielle, vraies personnes de l'entreprise ou banque d'images, traitement identique sur toutes les photos, cadrages types. Vidéo : sous-titres systématiques dans la typo de corps, bandeau de fin avec logo, style de rythme. Trois lignes par règle suffisent, mais elles doivent exister par écrit.

### 6. Livrer le document

Huit à dix slides : la palette avec ses codes hexadécimaux, les deux typos avec leurs tailles, les gabarits, trois exemples de posts appliqués, les interdits. Une charte social de dix pages se lit en cinq minutes et se respecte ; une charte de quarante pages décore un dossier. C'est ce document que tu remets à la fin de la mission stratégie, et que tout prestataire recevra en asset dans tes briefs.

## Exemple appliqué

Prenons Mutuelle Ouest Santé, une assurance mutualiste B2C : des contrats santé pour les familles de 30 à 55 ans, présence sur Facebook et Instagram, et une charte print bleu foncé et vert amande avec une serif institutionnelle. Avant toi, les posts étaient faits par une alternante : neuf couleurs différentes sur les douze derniers posts, trois typographies, des visuels de banque d'images avec blouses blanches et sourires parfaits. Ton système : bleu nuit en dominante — c'est le fond des chiffres clés —, vert amande en accent limité à 10 % des surfaces, blanc cassé et gris clair en neutres. Pour le texte sur fond vert amande, tu crées un vert foncé dérivé, parce que le blanc n'y était pas lisible. La serif est conservée pour les titres seulement — elle porte l'héritage institutionnel — et une sans-serif de Google Fonts prend tout le corps. Six gabarits : chiffre santé, carrousel prévention en cinq slides, témoignage d'adhérent, couverture de reel « Une minute santé », story quiz, annonce d'agence. Règle photo, non négociable et validée par le client : de vrais conseillers et de vrais adhérents photographiés en agence, jamais de banque d'images médicale — c'est l'interdit numéro un du document. Résultat mesuré au trimestre suivant : le temps de production d'un post passe de cinquante minutes à quinze, l'alternante peut publier une story sans te solliciter, et le feed se reconnaît d'un coup d'œil. C'est exactement ce que le client a acheté dans les 2 200 € HT de la mission stratégie.

## Les erreurs fréquentes

**Recopier la charte print telle quelle.** Une charte print optimise du papier à 30 centimètres des yeux ; un post se lit sur 6 centimètres de large, compressé par la plateforme. Sans traduction, tu obtiens des visuels élégants en PDF et illisibles en feed.

**Multiplier les gabarits.** Quinze gabarits « pour couvrir tous les cas », c'est zéro système : plus personne ne sait lequel utiliser, et chaque post redevient un choix. Six à huit, adossés aux piliers éditoriaux, et le choix disparaît.

**Faire une DA sans règle photo.** Les templates sont cohérents, puis une photo surexposée au flash côtoie une image de banque ultra-léchée et tout s'effondre. Les règles d'image sont la moitié du travail, pas une annexe.

**Verrouiller à l'excès.** Un système qui interdit tout format nouveau meurt au premier format tendance. Prévois la règle d'extension : tout nouveau format reprend la palette, une des deux typos et la position du logo — le reste est libre.

**Livrer sans facturer.** Une charte social offerte est perçue comme un fichier de plus. Chiffrée dans la stratégie, présentée en réunion, elle devient une référence que le client défend lui-même en interne.

## Action immédiate

Prends ton client principal. Ouvre son feed Instagram ou LinkedIn et compte les couleurs et les typographies des douze derniers posts — le chiffre te surprendra. Puis écris la première page de son système : quatre codes hexadécimaux maximum, deux typographies, trois interdits. Quarante-cinq minutes. Cette page est l'embryon de la charte social que tu présenteras — et factureras — dans ta prochaine mission stratégie.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Charte social media en 10 slides","description":"Trame du livrable à remettre au client : palette avec codes hexadécimaux, typographies et tailles, gabarits, trois exemples appliqués et interdits.","kind":"template","url":null},{"title":"Audit express d'une charte existante","description":"Grille d'une page pour évaluer ce qui survit à l'écran : contraste des couleurs, licences et lisibilité des typographies, versions du logo.","kind":"checklist","url":null},{"title":"Coolors","description":"Générateur de palettes pour dériver les versions foncées lisibles des couleurs vives d'une marque.","kind":"tool","url":"https://coolors.co"},{"title":"Google Fonts","description":"Bibliothèque de typographies libres pour remplacer une typo print sans licence digitale.","kind":"tool","url":"https://fonts.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '86266f04-4780-4a92-9bf8-44c96141acfc'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ecdc0e3d-82b6-4e7b-bdf6-8cfae8954d6c'::uuid, m.id, m.course_id, m.org_id, 'video-courte-sans-equipe', $sq$Produire du contenu vidéo court sans équipe$sq$, $sq$Cette leçon pose un process complet de production vidéo en solo : moins de 150 € de matériel, scripts de 60 à 90 mots, tournage par lots de quatre vidéos, montage de dix minutes par vidéo dans CapCut et sous-titres systématiques. Le tout tient en deux heures par lot, soit environ 28 € de coût de production par reel au lieu de 250 à 350 € en sous-traitance.$sq$, $sq$## L'accroche

Le client veut des reels. Évidemment : c'est le format qui porte la portée organique sur Instagram, TikTok et même LinkedIn. Problème : tu n'es pas vidéaste. Tu demandes un devis à un monteur freelance : 250 à 350 € la vidéo. À quatre reels par mois dans un retainer starter à 1 200 € HT, il ne te reste rien — tu travaillerais pour payer ton sous-traitant. Alors tu repousses, le client insiste, et le concurrent qui filme avec son téléphone prend la place. Voilà la bonne nouvelle : pour du contenu court organique, personne n'attend un film. On attend du vrai, du net, du sous-titré, publié régulièrement. Une vidéo authentique tournée au smartphone bat une vidéo léchée publiée une fois par trimestre. Dans cette leçon, tu montes un process reproductible : quatre vidéos en deux heures, seul, avec moins de 150 € de matériel.

## Le contenu

### Le matériel : moins de 150 €, une seule fois

Ton smartphone d'abord : n'importe quel modèle de moins de quatre ans filme en 4K, largement au-dessus de ce que les plateformes compressent de toute façon. Ensuite, dans l'ordre d'importance : un micro-cravate sans fil à 30-50 € — le son fait la moitié de la qualité perçue, une belle image avec un son de salle de bain crie amateur —, un trépied de table à 25 €, et la lumière d'une fenêtre, gratuite et meilleure que la plupart des éclairages d'appoint. Ajoute une ring light à 40 € seulement si tu tournes le soir. Total : 95 à 115 €. Le stabilisateur, le boîtier hybride, l'objectif : plus tard, ou jamais. Le matériel n'a jamais été ce qui bloque.

### Avant de tourner : le script

Une vidéo courte s'écrit avant de se filmer. Soixante à quatre-vingt-dix mots, soit trente à quarante-cinq secondes parlées. Structure en trois temps : l'accroche — une phrase qui nomme le problème, dans les cinq premières secondes, sinon le pouce a déjà scrollé —, le corps — trois points maximum —, la chute avec un appel à l'action. Écris les quatre scripts du lot avant la session de tournage, jamais pendant. Improviser face caméra, c'est quarante minutes pour une vidéo et un montage impossible.

### Le tournage par lots

Une session égale quatre vidéos, quarante-cinq minutes. C'est le cœur du process : installer le trépied, régler la lumière et se chauffer prend vingt minutes, que tu tournes une vidéo ou quatre — le lot amortit l'installation. Les règles : téléphone à hauteur des yeux, cadre vertical 9:16, sujet face à la fenêtre et jamais dos à elle, trois prises maximum par vidéo. La prise sept n'est jamais meilleure que la prise deux, elle est juste plus fatiguée. Si tu filmes ton client plutôt que toi : envoie-lui les scripts quarante-huit heures avant, il s'approprie les idées et parle avec ses mots — quelqu'un qui récite se voit à la première seconde.

### Le montage : dix minutes par vidéo

CapCut, gratuit, suffit pour tout le contenu organique. Le déroulé : couper les silences et les ratés, générer les sous-titres automatiques puis les corriger à la main — l'automatique massacre les noms de marque et les termes techniques —, poser l'habillage aux couleurs du client défini dans ta charte social media, ajouter une musique de la bibliothèque libre de droits de la plateforme. Pas de transitions spectaculaires, pas de zooms permanents : les effets découverts la veille se voient, et pas en bien.

### Les sous-titres ne sont pas une option

La majorité des vidéos d'un feed se regardent sans le son — les études tournent autour de 80 %. Sans sous-titres, ta vidéo est muette pour huit personnes sur dix. Typo lisible, deux lignes maximum à l'écran, contraste fort, position au tiers bas pour ne pas être masquée par l'interface de la plateforme.

### Le process complet : deux heures chrono

Quinze minutes pour relire les scripts et préparer le lieu. Quarante-cinq minutes de tournage pour quatre vidéos. Quarante-cinq minutes de montage. Quinze minutes pour exporter, nommer les fichiers proprement et les déposer dans le dossier du client. Deux heures, c'est un quart de journée : à 450 € de TJM, tes quatre reels te coûtent environ 112 € de production, soit 28 € par vidéo — contre 250 à 350 € pièce en sous-traitance. C'est cet écart qui rend les reels tenables dans un retainer starter.

## Exemple appliqué

Claire, freelance à Angers, gère les réseaux d'un ébéniste : atelier de meubles sur mesure et restauration. Retainer starter à 850 € HT par mois, Instagram et Facebook, dix posts dont quatre reels. Une fois par mois, elle bloque deux heures à l'atelier. Ses quatre scripts du mois : un, « Pourquoi une table en chêne massif bouge — et pourquoi c'est normal », accroche : « Ta table en chêne a bougé de deux millimètres cet hiver ? Elle n'est pas ratée. » Deux, le geste : trente secondes de rabotage à la main, son d'ambiance au micro-cravate posé près de l'établi, sous-titres explicatifs, aucune voix. Trois, l'avant-après d'une commode en restauration, deux plans fixes assemblés. Quatre, la réponse à la question la plus posée en message privé : « Chêne ou noyer pour une table familiale ? », l'ébéniste face caméra. Tournage : téléphone sur trépied près de la verrière de l'atelier, micro-cravate sur l'artisan pour les vidéos une et quatre, scripts envoyés le lundi pour un tournage le mercredi. Montage le soir même dans CapCut, habillage aux couleurs de l'atelier. Résultat sur trois mois : les reels font trois à cinq fois la portée des photos, et deux demandes de devis sont arrivées en citant la vidéo avant-après. Claire ne sait toujours pas monter « comme un pro ». Ça n'a strictement aucune importance.

## Les erreurs fréquentes

**Attendre le bon matériel.** « Je m'y mets quand j'aurai la caméra » est l'excuse la plus chère du métier : six mois sans vidéo pendant que le concurrent publie au smartphone. Le téléphone que tu as dans la poche suffit ce soir.

**Tourner sans script.** L'improvisation donne des prises de deux minutes pour trente secondes utiles, des reprises sans fin et un montage qui triple de durée. Quatre-vingt-dix mots écrits, c'est dix minutes ; elles en économisent quarante.

**Faire long.** Une vidéo de quatre-vingt-dix secondes qui pouvait en faire quarante perd la moitié de son audience en route. Coupe tout ce qui n'est pas l'idée centrale : la version courte gagne presque toujours.

**Publier les sous-titres automatiques sans relecture.** Le nom du client écorché, un terme métier transformé en absurdité — et c'est le client lui-même qui le voit en premier. La correction prend deux minutes par vidéo.

**Monter en flux tendu.** La vidéo montée la veille de sa publication saute à la première urgence, et la régularité meurt. Le lot du mois se tourne et se monte en une seule session, en avance, puis se programme.

## Action immédiate

Écris les scripts de quatre vidéos pour ton client principal — ou pour ton propre compte, c'est le meilleur terrain d'entraînement. Soixante à quatre-vingt-dix mots chacun, structure accroche-corps-chute, sur les quatre questions que son audience pose le plus. Puis ouvre ton agenda et bloque un créneau de deux heures cette semaine pour le tournage. Quarante-cinq minutes de travail, et ton premier lot est prêt à filmer.$sq$, 8, 'none'::academy_video_provider, $sq$[{"title":"Trame de script vidéo 60-90 mots","description":"Gabarit en trois temps — accroche en une phrase, corps en trois points maximum, chute avec appel à l'action — avec un exemple rempli.","kind":"template","url":null},{"title":"Checklist matériel et tournage smartphone","description":"Liste du matériel à moins de 150 € et les réglages de tournage : hauteur des yeux, cadre 9:16, sujet face à la fenêtre, trois prises maximum.","kind":"checklist","url":null},{"title":"CapCut","description":"Application de montage gratuite utilisée dans la leçon pour les coupes, les sous-titres automatiques et l'habillage aux couleurs du client.","kind":"tool","url":"https://www.capcut.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '86266f04-4780-4a92-9bf8-44c96141acfc'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ca24db6e-94bc-45db-ae20-b777c23a8e4c'::uuid, m.id, m.course_id, m.org_id, 'banque-de-contenus', $sq$Gérer une banque de contenus et un système de fichiers propre$sq$, $sq$Cette leçon met en place une arborescence unique en cinq dossiers par client, une convention de nommage CLIENT_date_reseau_format_sujet_version, une gestion des versions sans jamais de « final-final » et des accès découpés entre client et prestataires. Elle inclut la banque d'assets réutilisables avec suivi des droits à l'image et le test des trente secondes pour vérifier le système.$sq$, $sq$## L'accroche

Message du client, mardi 14 h 12 : « Tu peux me renvoyer le visuel de l'offre de mars ? Le service client en a besoin. » Vingt-cinq minutes plus tard, tu fouilles encore ton dossier Téléchargements, entre IMG_4521.jpg, « Design sans titre (3).png » et « carrousel-final-v3-OK-DEF.png » — dont tu n'es même plus sûr que ce soit la version publiée. Multiplie par quatre clients et une soixantaine de fichiers produits par mois : tu perds des heures chaque semaine, tu renvoies parfois la mauvaise version, et surtout tu as l'air amateur au moment exact où le client te regarde. Un système de fichiers n'a rien de glamour, mais c'est lui qui sépare le freelance débordé du freelance fiable. Il se construit en une heure, se maintient en quinze minutes par semaine, et rend n'importe quel asset trouvable en trente secondes. C'est l'objectif de cette leçon, chronomètre en main.

## Le contenu

### 1. Une arborescence unique, identique pour tous les clients

À la racine de ton espace de stockage, un dossier par client. Dedans, cinq dossiers numérotés, toujours les mêmes : 01-admin pour le contrat, les devis et les factures ; 02-strategie pour l'audit, la stratégie et la charte social media ; 03-production avec un sous-dossier par mois au format AAAA-MM — 2026-08, 2026-09 ; 04-assets-marque pour les logos, typographies, photos officielles et la charte du client ; 05-reportings pour les bilans mensuels. La numérotation force l'ordre d'affichage partout. La structure identique fait le reste : chez ton quatrième client, tu navigues aussi vite que chez le premier, et un futur sous-traitant comprend l'organisation sans explication.

### 2. La convention de nommage

Un nom de fichier doit dire ce qu'il est sans être ouvert : CLIENT_AAAA-MM-JJ_reseau_format_sujet_vXX. Exemple : MOS_2026-09-12_IG_carrousel_prevention-ecrans_v02.png. Le code client sur trois ou quatre lettres, la date de publication prévue en AAAA-MM-JJ — ce format trie chronologiquement tout seul, là où 12-09-2026 mélange tout —, le réseau en abrégé, le format, le sujet en deux ou trois mots. Le tout en minuscules, avec des tirets, jamais d'espace ni d'accent : certains outils et certaines plateformes les cassent au passage. La règle tient sur une ligne, épinglée quelque part, et surtout : elle s'applique au moment de l'export, pas « plus tard ». Plus tard n'existe pas.

### 3. Les versions

v01, v02, v03, et le suffixe VALIDE quand le client a validé par écrit. Jamais « final », « final2 », « DEF » — le jour où « final-final » existe, plus personne ne sait ce qui est parti en ligne. À la fin du mois, les brouillons descendent dans un sous-dossier _archives ; la version validée reste seule au niveau du mois. Tu dois pouvoir répondre en une seconde à la question : « Quelle version a été publiée ? » C'est aussi ta protection en cas de litige.

### 4. Les droits d'accès

Un dossier partagé par client, et des accès découpés. Le client accède à 03-production — c'est là qu'il valide — et à 05-reportings. Jamais à la racine : 01-admin contient ton contrat et tes conditions tarifaires. Jamais, évidemment, un dossier commun à deux clients : une erreur de partage entre concurrents ne se rattrape pas. Un prestataire ponctuel — graphiste, monteur — reçoit un lien vers le seul sous-dossier du mois concerné, pas plus. Et ton espace personnel vit ailleurs : les photos de vacances au milieu des livrables clients, c'est le rangement qui saute à la première urgence.

### 5. La banque de contenus réutilisables

Le dossier 04-assets-marque est ta réserve stratégique : rushs vidéo non utilisés, photos de shooting, déclinaisons de logo, visuels de marque. Une photo de shooting de janvier nourrit un post de juin — à condition de la retrouver. Range par événement ou par shooting, avec la date dans le nom du dossier. Et tiens à jour un fichier texte simple sur les droits : qui a pris chaque série de photos, jusqu'à quand tu peux l'utiliser, si les personnes visibles ont signé une autorisation de droit à l'image. Le jour où un ancien salarié demande le retrait de son visage des réseaux, tu réponds en dix minutes au lieu de paniquer.

### 6. La routine et le test

Quinze minutes chaque vendredi : renommer ce qui a échappé à la convention, archiver les brouillons, classer les nouveaux assets. C'est une étape d'Exécution au sens de SPEED, au même titre que la publication — pas une corvée optionnelle. Et une fois par mois, le test des trente secondes : choisis au hasard un livrable d'il y a trois mois, chronomètre le temps pour le retrouver. Plus de trente secondes : le système a une faille, répare-la.

## Exemple appliqué

Maison Palma, e-commerce lifestyle : décoration et art de la table vendus en ligne. C'est le cas le plus exigeant : deux shootings produits par saison de 150 à 250 photos chacun, douze posts par mois, des stories, deux campagnes Meta par trimestre — un volume énorme et une réutilisation permanente. L'arborescence : dans 04-assets-marque, un sous-dossier par shooting, nommé 2026-03_shooting-printemps, avec trois niveaux — bruts, selection pour les trente photos gardées, retouchees. Dans 03-production/2026-09, chaque livrable suit la convention : PALMA_2026-09-05_IG_post_nappe-lin-terracotta_v01_VALIDE.jpg. La graphiste freelance qui monte les carrousels a accès au seul dossier 2026-09 ; la responsable e-commerce du client accède à 03-production et 05-reportings, rien d'autre. Résultat en situation réelle : quand le service client demande le visuel de l'offre de mars, une recherche sur « PALMA_2026-03 » le sort en vingt secondes. Quand une campagne Meta doit relancer un visuel d'avril en 9:16, même chose. La mise en place a pris deux heures un vendredi après-midi ; l'économie constatée tourne autour de deux à trois heures par mois. Sur un retainer à 1 500 € HT, ces heures récupérées sont de la marge directe — ou du temps de prospection.

## Les erreurs fréquentes

**Tout laisser dans Téléchargements « en attendant de ranger ».** Le rangement différé n'arrive jamais, et chaque recherche coûte dix à vingt minutes. La seule parade : le fichier part au bon endroit avec le bon nom au moment de l'export, pas après.

**Garder les noms d'origine.** IMG_4521.jpg et « Design sans titre (3).png » sont muets : ni client, ni date, ni statut. Six mois plus tard, ces fichiers sont perdus même quand ils sont là, et la recherche par nom ne trouve rien.

**Donner l'accès racine au client.** Par confort, tu partages tout le dossier — et le client se promène dans ton contrat, tes tarifs, tes brouillons ratés. Le découpage des accès se règle une fois, à la création du dossier, jamais dans l'urgence.

**Mélanger les espaces.** Les fichiers clients sur ton drive perso, mêlés à ta vie privée, rendent impossible le tri, le partage propre et, un jour, la transmission : le mois où tu délègues ou où tu pars en vacances, personne ne peut reprendre.

**Ignorer les droits sur les images.** Utiliser une photo sans savoir qui l'a prise ni si les personnes ont consenti, c'est un risque juridique que le client te renverra. Trois colonnes dans un fichier texte suffisent : source, échéance, autorisations.

## Action immédiate

Prends ton client principal. Crée l'arborescence en cinq dossiers numérotés, déplace les fichiers du mois en cours dans 03-production avec son sous-dossier AAAA-MM, puis renomme les dix derniers livrables selon la convention CLIENT_date_reseau_format_sujet_version. Termine par le test : cherche le premier visuel livré à ce client, chronomètre. Une heure au total — et c'est la dernière fois que ce rangement te coûte une heure.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Arborescence type d'un dossier client","description":"Les cinq dossiers numérotés à recréer chez chaque client — admin, stratégie, production par mois, assets de marque, reportings — avec les règles d'accès associées.","kind":"template","url":null},{"title":"Convention de nommage des fichiers","description":"La règle CLIENT_AAAA-MM-JJ_reseau_format_sujet_vXX sur une page, avec dix exemples corrects et les pièges à éviter (espaces, accents, « final »).","kind":"checklist","url":null},{"title":"Registre des droits sur les images","description":"Tableau simple à trois colonnes — source du visuel, échéance d'utilisation, autorisations de droit à l'image signées — à tenir dans le dossier assets de chaque client.","kind":"template","url":null},{"title":"Google Drive","description":"Espace de stockage où construire l'arborescence partagée et découper les accès dossier par dossier.","kind":"tool","url":"https://drive.google.com"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '86266f04-4780-4a92-9bf8-44c96141acfc'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '255bb057-369e-42a8-8469-51e02e412042'::uuid, c.id, c.org_id, 'publicite-meta', $sq$Publicité Meta$sq$, $sq$Ce module t'apprend à gérer des comptes publicitaires Meta en freelance : structurer un compte lisible, choisir le bon événement d'optimisation, diagnostiquer les problèmes de budget et de créa. Tu repars avec les procédures pour lire un tunnel de conversion et scaler un budget sans casser ce qui marche.$sq$, 8, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f7ab0322-c925-46dd-9748-df288723010b'::uuid, m.id, m.course_id, m.org_id, 'structure-de-compte', $sq$Structure de compte : campagnes, ad sets, créas$sq$, $sq$Tu apprends ce qui se décide à chaque étage de la hiérarchie Meta : objectif en campagne, audience et événement d'optimisation en ad set, créa en annonce. Tu repars avec une structure type à trois campagnes (prospection 70 %, retargeting 20 %, test 10 %) et une convention de nommage applicable dès la reprise d'un compte.$sq$, $sq$## L'accroche

Tu récupères le compte publicitaire d'un nouveau client. Tu ouvres le Gestionnaire de publicités et tu trouves 17 campagnes, dont 9 actives. Des noms comme « Test 3 - copie - copie » ou « Promo aout FINAL ». Des budgets de 5 € par jour éparpillés sur 10 ad sets. Personne ne sait ce qui tourne, ni pourquoi. Le client te dit : « On dépense 1 500 € par mois et on ne sait pas ce que ça rapporte. » C'est la situation la plus fréquente que tu rencontreras en reprise de compte. Ce n'est pas un problème de créa, pas un problème de ciblage : c'est un problème de structure. Et tant que la structure est bancale, tout le reste est illisible — impossible de dire quelle audience marche, quelle créa fatigue, quel budget produit quoi. Dans cette leçon, tu vas apprendre ce qui se décide à chaque étage de la hiérarchie Meta, et une structure simple qui tient pour 90 % des comptes que tu géreras en freelance.

## Le contenu

### Les trois étages et ce qui s'y décide

Meta organise tout en trois niveaux, et chaque niveau porte des décisions précises. Si tu retiens une seule chose de cette vidéo, retiens cette répartition.

La campagne porte l'objectif. C'est là que tu dis à Meta ce que tu veux obtenir : des ventes, des prospects, du trafic, de la notoriété. Tu ne peux pas changer l'objectif après coup — il faudra recréer la campagne. La campagne peut aussi porter le budget si tu actives le budget de campagne Advantage : dans ce cas, Meta répartit lui-même la dépense entre les ad sets.

L'ad set porte quatre décisions : l'audience (qui peut voir la pub), les placements (où elle s'affiche : fil Instagram, Reels, Stories, fil Facebook), le calendrier, et surtout l'événement d'optimisation — la conversion précise que Meta va chercher à obtenir. C'est l'étage le plus important et le plus mal utilisé de tout le système. La leçon suivante lui est entièrement consacrée.

L'annonce porte la créa : visuel ou vidéo, texte principal, titre, lien, bouton d'appel à l'action. C'est le seul étage que ton audience voit. Les deux autres sont des réglages de machine.

En une phrase : la campagne dit pourquoi, l'ad set dit à qui et pour quel résultat, l'annonce dit quoi montrer.

### La structure simple qui tient la route

Pour un compte qui dépense entre 500 et 5 000 € par mois — c'est-à-dire la quasi-totalité de tes clients de freelance —, voici la structure de départ que je te recommande.

Une campagne de prospection : un seul ad set en audience large, 3 à 5 annonces dedans. Elle prend 70 % du budget. L'algorithme de Meta est meilleur que toi pour trouver les acheteurs dans une audience large, à une condition : lui donner assez de budget concentré au même endroit. C'est exactement ce que cette structure fait.

Une campagne de retargeting : un ad set qui regroupe visiteurs des 30 derniers jours, paniers des 7 derniers jours et abonnés des comptes sociaux, avec 2 à 3 annonces. Elle prend 20 % du budget.

Une campagne de test, en option : elle ne s'allume que pour valider une nouvelle créa ou un nouvel angle avant de le monter en prospection. 10 % du budget.

Trois campagnes, quatre à cinq ad sets maximum sur tout le compte. C'est tout. Chaque ad set concentre assez de budget pour apprendre, et chaque ligne du compte a un rôle que tu peux expliquer à ton client en une phrase. Cette lisibilité, c'est aussi ce qui rend ton reporting mensuel défendable.

### Le nommage, tout de suite

Impose une convention de nommage dès le premier jour : Client_Objectif_Audience_Mois. Exemple : BLEUCERAME_VENTES_LARGE_2026-09. Même logique pour les ad sets, et pour les annonces tu ajoutes l'angle de la créa : BLEUCERAME_VENTES_UGC-TEMOIGNAGE_V2. Dans trois mois, quand tu compareras 40 lignes dans un export, tu remercieras ce réflexe. Et le jour où tu passes le compte à quelqu'un d'autre — ou le jour où le client internalise —, la structure se lit sans toi. C'est une marque de professionnalisme qui coûte zéro effort.

### Budget de campagne ou budget d'ad set

Deux modes existent. Le budget au niveau de l'ad set (ABO) : tu contrôles exactement combien va où. Utile en phase de test, quand tu veux forcer 15 € par jour sur chaque variante pour les comparer à armes égales. Le budget de campagne Advantage (CBO) : Meta répartit entre les ad sets. Utile en régime de croisière, quand tu veux laisser l'algorithme arbitrer entre plusieurs ad sets qui marchent. Règle simple : ABO pour tester, CBO pour faire tourner. Et surtout, ne bascule pas d'un mode à l'autre chaque semaine — chaque changement structurel relance l'apprentissage.

## Exemple appliqué

Prenons un e-commerce lifestyle : une marque de linge de maison en lin lavé, panier moyen 85 €, budget média 3 000 € par mois. Toi, tu factures 750 € par mois en gestion publicitaire, dans la fourchette du forfait ads.

À la reprise, le compte porte 9 campagnes héritées de l'ancien prestataire, dont 5 actives, et 18 ad sets aux budgets éparpillés entre 3 et 12 € par jour — une centaine d'euros quotidiens que personne ne sait rattacher à un résultat. Tu coupes tout et tu reconstruis.

Campagne 1 — LINEA_VENTES_PROSPECTION : 70 € par jour, un ad set France 25-65 ans sans centre d'intérêt, optimisation sur l'achat. Quatre annonces : une vidéo de fabrication à l'atelier, un carrousel des trois best-sellers, un témoignage client en format UGC, une image statique avec l'offre de bienvenue.

Campagne 2 — LINEA_VENTES_RETARGETING : 20 € par jour, un ad set qui regroupe visiteurs 30 jours et paniers abandonnés 7 jours, acheteurs des 60 derniers jours exclus. Deux annonces : rappel de panier avec livraison offerte, carrousel des nouveautés.

Campagne 3 — LINEA_TEST : 10 € par jour, allumée uniquement quand une nouvelle créa doit être validée avant de rejoindre la prospection.

Résultat au premier mois : le compte passe de 23 lignes actives à 6 — trois campagnes, trois ad sets. Le CPA, illisible avant — entre 19 € et 74 € selon les lignes —, se stabilise à 31 € en prospection. Et ton reporting mensuel tient en trois blocs qui correspondent aux trois campagnes : ton client comprend enfin où va son argent, ce qui est la première raison pour laquelle il te gardera.

## Les erreurs fréquentes

Multiplier les ad sets à petit budget. Neuf ad sets à 5 € par jour n'apprennent rien : aucun n'atteindra jamais le volume de conversions dont l'algorithme a besoin pour se stabiliser. Un seul ad set à 45 € par jour, si.

Copier la structure d'un gros compte. Les architectures à 15 campagnes que tu vois dans les études de cas américaines tournent avec 100 000 € de budget mensuel. À 2 000 € par mois, cette structure dilue tout et ne produit que du bruit.

Dupliquer au lieu de comprendre. Face à un ad set qui sous-performe, le réflexe « je duplique et je relance » repart de zéro en phase d'apprentissage sans corriger la cause. Diagnostique d'abord : créa, audience ou budget.

Toucher au compte tous les jours. Chaque modification significative relance l'apprentissage de l'ad set. Fixe-toi un jour de gestion par semaine et tiens-le, sauf urgence réelle. C'est aussi ce qui rend ton forfait rentable : deux heures cadrées valent mieux que trente minutes par jour.

Négliger le nommage. « Copie de Copie de Campagne 2 » te coûtera des heures d'archéologie au premier reporting sérieux, et rendra ton travail invérifiable — donc contestable — au premier désaccord avec le client.

## Action immédiate

Ouvre le Gestionnaire de publicités d'un compte que tu gères — ou d'un compte d'entraînement si tu n'as pas encore de client. Sur une feuille, dessine la structure actuelle : chaque campagne, ses ad sets, le budget quotidien et l'objectif de chacun. Compte les lignes actives. Puis dessine à côté la structure cible : prospection 70 %, retargeting 20 %, test 10 %, quatre à cinq ad sets maximum. Note les trois premières actions pour passer de l'une à l'autre. Trente minutes, et tu sauras exactement quoi faire à ta prochaine session de gestion.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Convention de nommage publicitaire","description":"Grille Client_Objectif_Audience_Mois avec des exemples remplis pour les campagnes, les ad sets et les annonces.","kind":"template","url":null},{"title":"Audit de structure en 10 points","description":"Les 10 vérifications à faire en reprise de compte : lignes actives, budgets par ad set, doublons, mode de budget, exclusions.","kind":"checklist","url":null},{"title":"Meta Business Manager","description":"L'accès au Gestionnaire de publicités et aux actifs publicitaires de tes clients.","kind":"link","url":"https://business.facebook.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '33bd3386-7fb7-4f08-9ddc-608512778227'::uuid, m.id, m.course_id, m.org_id, 'objectif-et-evenement', $sq$Choisir le bon objectif et le bon événement d'optimisation$sq$, $sq$Tu alignes objectif de campagne, événement d'optimisation et réalité du pixel avant de dépenser un euro. Tu vois pourquoi une campagne trafic ruine un objectif de vente, et comment vérifier le Gestionnaire d'événements en dix minutes : volumes sur 7 jours, déduplication, valeur d'achat.$sq$, $sq$## L'accroche

Claire reprend le compte d'un client en début d'année. L'ancien prestataire faisait tourner une campagne « Trafic » depuis huit mois. Les rapports étaient flatteurs : 4 200 clics par mois à 0,43 € le clic. Le client était content — jusqu'au jour où il a compté ce que ça produisait vraiment : 9 demandes de devis. Neuf. Soit un coût réel de 200 € par demande, caché derrière un coût par clic qui avait l'air imbattable. Le problème n'était ni la créa ni l'audience. C'était l'instruction donnée à la machine. Meta livre exactement ce que tu lui demandes : tu demandes des clics, il te trouve des gens qui cliquent sur tout. Tu demandes des ventes, il cherche des acheteurs. Le choix de l'objectif et de l'événement d'optimisation est la décision la plus importante de toute ta gestion publicitaire, et c'est celle qui se prend en trente secondes sans réfléchir. Cette leçon t'apprend à la prendre correctement.

## Le contenu

### Ce que Meta optimise vraiment

À chaque diffusion, l'algorithme choisit à qui montrer ta pub parmi des millions de personnes. Son critère : la probabilité que la personne accomplisse l'événement que tu as désigné. C'est tout le système. Meta connaît les gens qui cliquent sans jamais acheter, ceux qui remplissent des formulaires, ceux qui sortent leur carte bancaire. Ton réglage décide quelle population il va chercher.

Deux niveaux portent cette instruction. L'objectif de campagne d'abord — il y en a six : notoriété, trafic, interactions, prospects, promotion de l'application, ventes. Il ouvre une famille de possibilités. Puis, au niveau de l'ad set, l'événement d'optimisation : la conversion précise visée — achat, ajout au panier, prospect, vue de contenu. C'est lui, l'instruction finale.

### La règle des trois alignements

Avant de lancer, vérifie que trois choses pointent dans la même direction.

Un : l'objectif business du client. Il veut vendre des contrats, pas collectionner des clics. Traduis son objectif en événement mesurable — un achat, un formulaire de devis complété, un appel réservé.

Deux : l'événement d'optimisation le plus profond possible. Plus l'événement est proche de l'argent, mieux Meta travaille pour toi. Ventes avec optimisation sur l'achat pour un e-commerce ; prospects avec optimisation sur le prospect qualifié pour du devis.

Trois : la réalité du pixel. Meta a besoin de volume pour apprendre — l'ordre de grandeur à retenir : 50 occurrences de l'événement par semaine et par ad set. Si le compte génère 12 achats par semaine, optimiser sur l'achat condamne l'ad set à un apprentissage limité permanent. Dans ce cas, remonte d'un cran — vers l'ajout au panier ou le début de checkout — en le sachant et en le disant au client : c'est un compromis temporaire, pas un choix par défaut.

### Vérifier le pixel avant de dépenser un euro

Ouvre le Gestionnaire d'événements avant tout lancement. Trois vérifications, dix minutes.

D'abord, quels événements arrivent, et en quel volume sur les 7 derniers jours. Un pixel qui ne reçoit pas d'événement Achat sur un site qui vend, c'est un chantier à régler avant toute campagne.

Ensuite, la déduplication. Si le site envoie les événements deux fois — par le pixel navigateur et par l'API Conversions — sans identifiant commun, chaque achat compte double et tout ton reporting est faux.

Enfin, les paramètres : l'événement Achat porte-t-il la valeur et la devise ? Sans eux, pas de chiffre d'affaires attribué, donc pas de ROAS, donc un reporting qui ne parle que de coûts. Utilise l'outil de test d'événements du Gestionnaire pour dérouler un parcours complet toi-même.

### Les pièges classiques

La campagne trafic pour vendre : tu paies des visites de curieux professionnels. L'objectif interactions : des likes à 0,02 €, zéro impact business. Les deux gonflent de jolis chiffres en surface — c'est pour ça qu'on les voit partout.

Dernier arbitrage : formulaire instantané Meta ou formulaire sur le site. L'instantané, pré-rempli, donne du volume et un coût par prospect bas, mais des prospects moins engagés. Le formulaire sur site filtre par la friction : moins de volume, meilleure qualité. Choisis selon la capacité du client à rappeler vite — un prospect instantané rappelé en 48 heures ne vaut plus rien.

## Exemple appliqué

Une mutuelle santé régionale, cible B2C : des particuliers de 55 à 70 ans, produit d'appel « devis complémentaire santé senior ». Budget média : 1 800 € par mois. C'est le client de Claire de l'accroche — voici ce qu'elle a fait après la reprise.

Étape 1, le pixel. Le Gestionnaire d'événements montre que le formulaire de devis déclenche bien un événement Prospect : 60 à 70 par semaine toutes sources confondues. Volume suffisant pour optimiser directement dessus.

Étape 2, la reconstruction. Elle coupe la campagne trafic et lance une campagne objectif prospects, optimisation sur l'événement Prospect, un ad set 55-70 ans en audience large régionale. Premier mois : 124 devis à 14,50 € de coût par prospect, pour 1 798 € dépensés. Contre 9 devis à 200 € auparavant, pour le même budget. Même argent, autre instruction, résultat multiplié par près de quatorze.

Étape 3, la qualité. Le client rappelle les demandes et constate que beaucoup ne sont pas éligibles. Claire ajoute deux champs de qualification au formulaire : tranche d'âge et régime actuel. Le coût par prospect monte à 19 € — moins de monde va au bout — mais le taux de transformation devis vers contrat passe de 8 % à 22 %. Le coût par contrat signé tombe de 181 € à 86 €. C'est ce chiffre-là qu'elle met en première ligne du reporting mensuel : c'est lui qui fait durer le contrat, et c'est exactement l'étape D de SPEED — mesurer ce qui compte pour le client, pas ce qui flatte la campagne.

## Les erreurs fréquentes

Lancer une campagne ventes sur un pixel qui ne reçoit pas l'événement Achat. Meta n'a rien à optimiser, la diffusion part dans le décor, et tu découvres le problème après avoir brûlé deux semaines de budget. Le Gestionnaire d'événements se vérifie avant, pas après.

Choisir trafic « pour commencer, le temps de voir ». Tu n'apprends rien d'utile : les gens qui cliquent ne sont pas les gens qui achètent, donc tes conclusions sur les créas et les audiences ne seront pas transposables.

Changer l'événement d'optimisation toutes les semaines. Chaque changement relance l'apprentissage de zéro. Choisis, laisse tourner deux à trois semaines, puis juge sur les chiffres.

Optimiser sur un événement de surface parce que le coût affiché est plus bas. 2 € par ajout au panier semble mieux que 30 € par achat — sauf que le client encaisse des achats, pas des paniers. Le seul coût qui compte est le coût par événement business final.

Ignorer la déduplication pixel et API Conversions. Des conversions comptées en double, c'est un ROAS gonflé de moitié, et un jour un client qui croise avec son back-office et perd confiance en tout ton reporting d'un coup.

## Action immédiate

Ouvre le Gestionnaire d'événements du compte de ton client — ou d'un compte auquel tu as accès. Note sur une feuille chaque événement reçu et son volume sur les 7 derniers jours. Puis ouvre le Gestionnaire de publicités et relève, pour chaque ad set actif, l'événement d'optimisation choisi. Compare les deux colonnes : tout ad set qui optimise sur un événement à moins de 50 occurrences hebdomadaires est signalé. Tu as maintenant la liste exacte des réglages à corriger, et c'est la première chose que tu traiteras à ta prochaine session de gestion.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Vérification du pixel en 8 points","description":"Les contrôles à passer dans le Gestionnaire d'événements avant tout lancement : événements reçus, volumes, déduplication, paramètres de valeur.","kind":"checklist","url":null},{"title":"Tableau objectif × événement × volume","description":"Une matrice qui croise l'objectif business du client, l'événement d'optimisation choisi et son volume hebdomadaire réel pour repérer les désalignements.","kind":"template","url":null},{"title":"Centre d'aide Meta Business","description":"La documentation officielle des objectifs de campagne, du pixel et de l'API Conversions.","kind":"link","url":"https://www.facebook.com/business/help"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'd5bfa10a-8149-42ec-ad72-526d023fd70d'::uuid, m.id, m.course_id, m.org_id, 'sous-investissement', $sq$Diagnostiquer un sous-investissement budgétaire$sq$, $sq$Tu identifies un compte qui dépense trop peu pour sortir de la phase d'apprentissage, avec la règle des 50 conversions par semaine et par ad set. Tu repars avec le calcul du budget minimum viable et cinq remèdes classés, de la consolidation des ad sets à la renégociation du mandat.$sq$, $sq$## L'accroche

« Meta, on a essayé, ça ne marche pas pour nous. » Tu entendras cette phrase des dizaines de fois en rendez-vous de découverte. Neuf fois sur dix, tu ouvres le compte et tu trouves la même chose : 8 € par jour, répartis sur trois ad sets, avec une optimisation sur l'achat et un coût par achat cible autour de 30 €. Fais le calcul avec moi : 8 € par jour, c'est 56 € par semaine. À 30 € l'achat, ça fait au mieux deux achats par semaine. Or l'algorithme de Meta a besoin d'un ordre de grandeur de 50 conversions par semaine et par ad set pour apprendre. Ce compte n'a jamais échoué : il n'a jamais eu les moyens d'essayer. Savoir diagnostiquer un sous-investissement, le chiffrer et le dire au client, c'est ce qui te distingue du prestataire précédent — et c'est parfois ce qui te fera refuser un contrat, ce qui est aussi une compétence.

## Le contenu

### La règle des 50 conversions

Quand un ad set démarre, il entre en phase d'apprentissage : Meta teste des profils, des heures, des placements, et affine sa diffusion à mesure que les conversions tombent. Pour se stabiliser, il lui faut environ 50 conversions par semaine — 50 occurrences de l'événement d'optimisation, par ad set. En dessous, l'ad set affiche « Apprentissage limité » et la diffusion reste erratique : le système n'a pas assez de signal pour distinguer un bon profil d'un mauvais.

Ce seuil n'est pas une punition, c'est de la statistique. Avec 4 conversions par semaine, impossible de savoir si une créa est meilleure qu'une autre — ni pour Meta, ni pour toi.

### Le calcul qui dit la vérité

Le budget hebdomadaire minimum pour apprendre se calcule en une ligne : coût par conversion observé multiplié par 50.

CPA de 20 € : il faut 1 000 € par semaine, soit environ 4 300 € par mois. CPA de 40 € : 2 000 € par semaine, plus de 8 500 € par mois. Coût par prospect de 8 € en génération de leads : 400 € par semaine, environ 1 700 € par mois — déjà plus accessible.

Fais ce calcul pour chaque compte que tu audites en phase S de SPEED. La plupart des petits comptes sont cinq à dix fois en dessous du seuil. Ce n'est pas une nuance : c'est la différence entre un système qui apprend et un système qui tire au hasard.

### Les signaux d'un compte qui ne peut pas apprendre

Quatre signaux, visibles en dix minutes dans le Gestionnaire de publicités.

Un : la mention « Apprentissage limité » qui ne part jamais. Deux : un CPA qui varie du simple au triple d'une semaine à l'autre sans qu'aucun réglage n'ait bougé — 18 € une semaine, 61 € la suivante. Trois : plusieurs ad sets qui se partagent des miettes — quatre lignes à 5 € par jour au lieu d'une à 20 €. Quatre : des résultats concentrés sur deux ou trois jours, puis plus rien pendant une semaine.

Si tu vois deux de ces signaux, le diagnostic est posé. Inutile de tester une nouvelle créa : le problème est structurel.

### Les remèdes, dans l'ordre

Premier remède : consolider. Une seule campagne, un seul ad set, tout le budget au même endroit. C'est le geste le plus rentable et le moins pratiqué — il donne l'impression de « faire moins », alors qu'il concentre le signal.

Deuxième : élargir l'audience. Une audience large donne à l'algorithme plus d'espace pour trouver des conversions au même prix.

Troisième : remonter d'un cran l'événement d'optimisation. Si l'achat ne tombe que 10 fois par semaine mais que l'ajout au panier tombe 70 fois, optimiser sur le panier redonne du signal. C'est un compromis : tu attires des gens qui mettent au panier, pas forcément des acheteurs. Il se dit au client, il ne se cache pas.

Quatrième : concentrer dans le temps. Plutôt que 10 € par jour toute l'année, des fenêtres courtes à budget fort — trois semaines de campagne à 70 € par jour au moment qui compte. Même dépense annuelle, mais chaque fenêtre dépasse le seuil d'apprentissage.

Cinquième : renégocier ou refuser. Il existe un budget en dessous duquel tu ne peux rien promettre. Si ton forfait de gestion — 500 à 1 000 € par mois — coûte plus cher que le budget média du client, dis-le en face : l'argent serait mieux placé dans le média ou dans l'organique. Refuser un mandat ads intenable protège ta réputation, et paradoxalement, c'est souvent ce qui fait signer le client sur autre chose.

## Exemple appliqué

Une céramiste qui vend ses pièces en ligne : bols, tasses, vases, panier moyen 55 €. Elle dépense 450 € par mois sur Meta depuis dix-huit mois, en continu, environ 105 € par semaine. Son CPA observé sur l'historique : 22 €. Elle est convaincue que « la pub ne marche pas pour l'artisanat ».

Ton diagnostic tient en une ligne : pour apprendre sur l'achat, il faudrait 22 × 50 = 1 100 € par semaine. Elle est à 10 % du seuil. Sur l'année écoulée : 5 400 € dépensés pour 96 ventes attribuées, soit 56 € par vente — deux fois et demie son CPA théorique, parce que le compte n'est jamais sorti de l'apprentissage.

Le remède que tu proposes : arrêter le fil continu et concentrer. Deux fenêtres de trois semaines par an, calées sur ses lancements de collection, à 1 500 € par fenêtre — soit 500 € par semaine. Toujours en dessous du seuil sur l'achat, donc tu assumes le compromis : optimisation sur l'ajout au panier, qu'elle génère 70 fois par semaine en période de lancement, avec un retargeting serré derrière pour transformer.

Résultat sur l'année suivante : 3 000 € dépensés au lieu de 5 400, 121 ventes attribuées au lieu de 96, CPA à 24,80 € au lieu de 56 €. Moins de budget, plus de ventes — uniquement parce que la dépense est passée au-dessus du seuil pendant les périodes où elle tournait. C'est ce tableau avant-après que tu mets dans ton reporting, et c'est lui qui justifie ton forfait.

## Les erreurs fréquentes

Découper un petit budget en quatre audiences « pour tester ». À 400 € par mois, tu n'as pas les moyens de tester des audiences : chaque découpe divise le signal. Un seul ad set large, point.

Juger un ad set en trois jours. Avec un petit budget, trois jours représentent une poignée de conversions — statistiquement rien. Le minimum de décence est une à deux semaines pleines.

Accuser la créa quand le problème est structurel. Refaire les visuels d'un compte qui dépense 60 € par semaine sur un objectif achat, c'est repeindre une voiture sans moteur. Vérifie le seuil d'abord, la créa ensuite.

Accepter un mandat de gestion à 300 € de média mensuel sans prévenir. Le client paiera ton forfait, ne verra aucun résultat — pour une raison mathématique que tu connaissais —, et racontera partout que tu ne sers à rien.

Basculer en objectif trafic « pour avoir du volume ». Oui, les clics arrivent : 50 clics par semaine, c'est facile. Mais tu remplaces un signal faible de qualité par un signal fort qui pointe vers les mauvaises personnes. Le compteur tourne, le business non.

## Action immédiate

Prends ton client ads — ou le dernier compte que tu as audité — et fais le calcul en trois lignes : CPA observé sur les 90 derniers jours, multiplié par 50, comparé au budget hebdomadaire réel. Note l'écart en pourcentage. Puis écris en une phrase l'arbitrage que tu recommandes : consolider les ad sets, remonter l'événement d'optimisation, concentrer sur des fenêtres, ou renégocier le budget média. Cette phrase, c'est le premier point de ton prochain reporting mensuel — ou l'argument central de ta prochaine proposition commerciale.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Calculateur de budget minimum viable","description":"Un tableur qui applique la formule CPA observé × 50 par semaine et compare le résultat au budget réel du compte.","kind":"template","url":null},{"title":"Diagnostic de sous-investissement","description":"Les 4 signaux à relever dans le Gestionnaire de publicités et les 5 remèdes dans l'ordre où les proposer au client.","kind":"checklist","url":null},{"title":"Meta Business Manager","description":"L'accès aux mentions d'apprentissage limité et aux budgets des ad sets du compte audité.","kind":"link","url":"https://business.facebook.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '31ec2b9e-68d4-48cf-b4b0-322d178c4784'::uuid, m.id, m.course_id, m.org_id, 'fatigue-creative', $sq$Fatigue créative : détection et rotation$sq$, $sq$Tu détectes la fatigue créative avec trois signaux mesurables : fréquence qui monte, CTR en baisse, CPA en hausse à réglages constants. Tu organises ensuite la rotation avec un pipeline de 2 à 3 créas par mois et un rythme de renouvellement adapté à la taille de l'audience.$sq$, $sq$## L'accroche

Une campagne qui tournait parfaitement se met à décrocher. Pendant six semaines : coût par prospect stable à 26-28 €, client content, reporting facile. Puis, sans que tu aies touché à rien : 34 €, puis 41 €, puis 58 €. Même audience, même budget, mêmes créas. Ton premier réflexe sera de suspecter un bug, l'algorithme, la saisonnalité, la concurrence. La vraie cause est plus simple : rien n'a changé, et c'est précisément le problème. Tes créas ont été vues, revues et re-revues par la même audience, et une pub déjà vue quatre fois ne déclenche plus rien. Ça s'appelle la fatigue créative, c'est la première cause de dégradation d'un compte qui marchait, et la bonne nouvelle, c'est qu'elle se détecte avec trois chiffres et se traite avec un calendrier. Cette leçon te donne les deux.

## Le contenu

### Les trois signaux qui ne mentent pas

Premier signal : la fréquence. C'est le nombre moyen de fois où une personne de l'audience a vu ta pub, à lire sur une fenêtre de 30 jours. En prospection sur audience large, au-delà de 3,5 à 4, tu es en zone de fatigue. Sur une petite audience — locale, B2B, retargeting —, ça monte beaucoup plus vite et le seuil d'alerte est plus bas : dès 3, ouvre l'œil.

Deuxième signal : le CTR qui baisse. Compare le CTR de chaque annonce à sa propre moyenne historique, pas à un benchmark générique. Une annonce qui perd 20 % de CTR deux semaines de suite est en train de mourir : l'audience a appris à la scroller.

Troisième signal : le CPA ou le CPL qui monte à réglages constants. Si l'audience, le budget et l'événement d'optimisation n'ont pas bougé et que le coût par résultat prend +20 à +30 %, la créa est le suspect numéro un.

Un signal isolé ne suffit pas — un mauvais CTR sur trois jours peut être du bruit. Deux signaux sur trois, constatés deux semaines de suite : le diagnostic est posé.

### La routine de détection hebdomadaire

La fatigue ne s'attrape pas en regardant le compte « de temps en temps ». Chaque semaine, à ta session de gestion, exporte pour chaque annonce active : CTR, fréquence et coût par résultat, sur les 7 derniers jours et sur les 7 jours précédents. Deux colonnes, une comparaison, dix minutes. Surligne toute annonce qui cumule CTR en baisse et coût en hausse. C'est l'étape D de SPEED appliquée à la semaine : tu mesures pour arbitrer, pas pour remplir un tableau.

### Organiser la rotation

Garde 3 à 5 annonces actives par ad set — assez pour que Meta arbitre entre elles, pas trop pour que le budget se disperse.

Construis un pipeline : 2 à 3 créas neuves par mois, prêtes avant d'en avoir besoin. C'est une question de production, donc de contrat : si ton retainer ne prévoit pas la production ou la déclinaison de créas publicitaires, tu seras à sec au premier essoufflement. Vends la rotation dès le devis.

Introduis sans tout casser : ajoute la nouvelle annonce dans l'ad set existant, laisse-la prendre sa place une semaine, puis coupe la plus faible. Ne mets jamais tout en pause d'un coup — tu perdrais l'historique de diffusion qui fait tourner ce qui marche encore.

Enfin, itère sur les gagnantes plutôt que de repartir de zéro. Ce qui s'use en premier, c'est l'accroche : les trois premières secondes d'une vidéo, la première image d'un carrousel, la promesse du texte. Une créa gagnante avec un nouveau hook, un nouveau format ou un angle décalé repart souvent pour un cycle complet, à coût de production réduit.

### Le rythme de renouvellement

Le rythme dépend de la taille de l'audience et du budget — plus tu dépenses vite sur une audience étroite, plus vite tu la satures. Repères concrets : e-commerce en audience large nationale, renouvellement toutes les 4 à 6 semaines. Génération de leads sur audience locale ou B2B, toutes les 2 à 3 semaines. Retargeting : c'est l'audience la plus petite du compte, la fatigue y est structurelle — renouvelle chaque mois et surveille la fréquence de près.

## Exemple appliqué

Une société de transport premium B2B : chauffeurs privés pour dirigeants, délégations et transferts d'affaires, clientèle d'entreprises. La cible sur Meta : assistantes de direction, office managers et dirigeants d'une grande métropole — une audience atteignable d'environ 20 000 personnes. Budget : 1 200 € par mois, soit 40 € par jour, campagne de génération de leads avec une seule créa vidéo qui marchait très bien au lancement.

Le relevé hebdomadaire raconte tout. Semaine 2 : fréquence cumulée à 2,1, CTR 1,3 %, CPL 28 €. Semaine 5 : fréquence 3,6, CTR 0,9 %, CPL 39 €. Semaine 7 : fréquence 5,2, CTR 0,55 %, CPL 63 €. À 40 € par jour pendant sept semaines, soit 1 960 € à un CPM autour de 19 €, l'audience de 20 000 personnes a vu la vidéo cinq fois. Elle n'est pas mauvaise : elle est épuisée.

La rotation mise en place : trois créas neuves, chacune sur un angle différent du même service — la ponctualité garantie, portée par un témoignage client filmé ; la simplicité de facturation, montrée par une capture de l'espace entreprise ; le confort, en vidéo courte de l'intérieur des berlines. Introduites en une semaine, l'ancienne vidéo coupée à J+10. Résultat : CPL revenu à 31 € en dix jours, CTR moyen à 1,1 %.

La vraie leçon vient après : sur une audience de 20 000 personnes, la fatigue reviendra toutes les trois semaines, mécaniquement. La rotation n'est pas une intervention d'urgence, c'est un rythme — une créa neuve toutes les trois semaines, inscrite noir sur blanc dans le planning de production du client.

## Les erreurs fréquentes

Attendre que le client le remarque. Si c'est lui qui te signale que « les résultats baissent », tu as trois semaines de retard et tu es en position de justification. Le relevé hebdomadaire existe pour que ce soit toi qui annonces le problème — avec la solution déjà en route.

Changer la créa et l'audience en même temps. Si le CPL remonte, tu ne sauras jamais lequel des deux a agi. Un changement à la fois, une semaine d'observation, puis le suivant.

Croire au « repos » d'une créa. Mettre une annonce fatiguée en pause deux semaines et la relancer ne remet pas les compteurs à zéro : l'audience est la même, la mémoire aussi. Une créa usée se remplace ou se transforme, elle ne se repose pas.

Ne produire qu'une créa par mois — ou zéro. C'est presque toujours un problème de contrat, pas de créativité : la production publicitaire n'a pas été vendue dans le retainer. Résultat, tu gères un compte que tu ne peux pas soigner.

Juger sur la fréquence seule. Une fréquence de 4 avec un CTR stable et un CPA stable, ça existe — certaines audiences supportent la répétition. La fréquence déclenche la vigilance ; ce sont le CTR et le CPA qui déclenchent l'action.

## Action immédiate

Construis ton tableau de suivi dans un tableur, une ligne par annonce active, six colonnes : CTR 7 jours, CTR 30 jours, fréquence 30 jours, CPA 7 jours, CPA 30 jours, date de mise en ligne. Remplis-le pour toutes les annonces actives d'un compte. Surligne celles qui cumulent un CTR 7 jours inférieur d'au moins 20 % à leur CTR 30 jours et une fréquence au-dessus de 3,5. Pour chaque ligne surlignée, note l'angle de la créa de remplacement à produire. Trente minutes, et ta prochaine rotation est planifiée avant que le compte décroche.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Tableau de rotation des créas","description":"Le suivi hebdomadaire par annonce : CTR 7 et 30 jours, fréquence, CPA, date de mise en ligne et angle de remplacement prévu.","kind":"template","url":null},{"title":"Signaux de fatigue créative","description":"Les seuils d'alerte par type de compte (fréquence, baisse de CTR, hausse de CPA) et la règle des deux signaux sur deux semaines.","kind":"checklist","url":null},{"title":"Bibliothèque publicitaire Meta","description":"Toutes les publicités actives des concurrents, pour nourrir tes angles de créas de remplacement.","kind":"link","url":"https://www.facebook.com/ads/library"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'bf773611-3a73-4b00-92b4-985888d9570f'::uuid, m.id, m.course_id, m.org_id, 'abandon-de-panier', $sq$Analyser l'abandon de panier et le tunnel de conversion$sq$, $sq$Tu lis le tunnel vue produit, panier, checkout, achat avec des ratios de référence pour situer la fuite en dix minutes. Tu distingues ce qui se corrige côté publicité (retargeting séquencé, exclusions) de ce qui se recommande au client côté site, chiffres à l'appui.$sq$, $sq$## L'accroche

Ton client e-commerce t'appelle : « Les pubs ne convertissent pas, il faut changer quelque chose. » Tu ouvres les chiffres : les pubs ont amené 12 000 vues de pages produit ce mois-ci, plus de 1 000 ajouts au panier — et 118 achats. Les pubs font leur travail. C'est entre le panier et le paiement que l'argent s'évapore. Si tu ne sais pas lire un tunnel de conversion, tu vas passer le mois à refaire des créas pour réparer un problème qui vit sur la page de paiement du site. Tu dépenseras l'énergie au mauvais endroit, le client perdra patience, et le contrat sautera pour une fuite que dix minutes d'analyse auraient localisée. Un freelance qui gère des ads pour un e-commerce doit savoir dire où le tunnel fuit, chiffrer ce que la fuite coûte, et séparer ce qu'il peut corriger côté publicité de ce qu'il doit recommander côté site. C'est exactement ce qu'on fait dans cette leçon.

## Le contenu

### Les quatre marches du tunnel

Le pixel Meta découpe le parcours d'achat en quatre événements standard : la vue de contenu (une page produit est ouverte), l'ajout au panier, l'initiation de checkout (la personne entame le paiement), et l'achat. Quatre marches, trois transitions — et chaque transition est un taux que tu peux mesurer.

Où lire ces volumes : le Gestionnaire d'événements de Meta pour les volumes bruts tous canaux confondus, les colonnes de conversion du Gestionnaire de publicités pour les volumes attribués aux campagnes, et Google Analytics pour recouper côté site. Les trois ne diront jamais exactement pareil — attribution et fenêtres diffèrent — mais les ordres de grandeur et surtout les ratios doivent raconter la même histoire.

### Les ratios de référence

Pour un e-commerce B2C à panier moyen courant, retiens ces fourchettes : de la vue produit à l'ajout au panier, 8 à 12 %. De l'ajout au panier au début de checkout, 40 à 50 %. Du checkout à l'achat, 50 à 60 %. Au global, de la vue produit à l'achat : 2 à 3 %.

Ces repères bougent avec le contexte : un panier moyen à 300 € aura des ratios plus bas qu'une marque à 40 €, sans que rien ne soit cassé. Utilise-les pour repérer une anomalie franche, puis compare surtout le compte à lui-même, mois après mois. Une transition qui perd dix points d'un mois sur l'autre est un signal plus fiable que n'importe quel benchmark.

### Situer la fuite

Sur 30 jours, relève les quatre volumes et calcule les trois ratios. Le ratio le plus éloigné de sa fourchette désigne la marche prioritaire. Chaque marche a ses causes typiques.

Fuite en haut — beaucoup de vues, peu de paniers : soit la page produit ne convainc pas (photos faibles, prix mal amené, avis absents), soit le trafic est mal qualifié — et là, c'est chez toi que ça se passe : vérifie l'événement d'optimisation et l'audience. Une campagne optimisée sur la vue de contenu amène des visiteurs, pas des acheteurs.

Fuite au milieu — des paniers qui ne deviennent pas des checkouts : le grand classique est le coût caché. Frais de port découverts tard, création de compte obligatoire, panier difficile à retrouver. C'est presque toujours côté site.

Fuite en bas — des checkouts qui n'aboutissent pas : moyens de paiement manquants, paiement fractionné absent sur un gros panier, bug sur mobile, réassurance invisible au moment de sortir la carte, redirection 3D Secure qui perd l'utilisateur.

### Ce que tu peux faire côté ads

Trois leviers. Le retargeting séquencé : une audience « ajout au panier 7 jours » et une audience « checkout 3 jours », chacune avec un message adapté à sa marche — réassurance sur la livraison et les retours, rappel du produit vu via le catalogue dynamique. Pas de remise systématique : si chaque abandon déclenche un code promo, tu éduques tes meilleurs prospects à abandonner exprès.

L'exclusion des acheteurs récents de toutes les audiences de retargeting — évident, souvent oublié, et double gaspillage : du budget brûlé et des clients agacés de voir la pub d'un produit qu'ils viennent de payer.

Et la qualification en amont : annoncer le prix dans la créa filtre les curieux avant le clic et améliore mécaniquement tous les ratios en aval.

### Ce qui se joue côté site — et ton rôle

Tu n'es pas développeur, et tu ne vas pas corriger la page de paiement. Ton rôle : diagnostiquer, chiffrer, recommander. La phrase qui change tout dans un reporting mensuel — c'est l'étape D de SPEED — ressemble à ça : « Chaque point gagné sur le passage checkout-achat représente environ 4 achats de plus par mois, soit 280 € de chiffre d'affaires ; voici les trois freins constatés sur mobile. » Tu passes du statut de prestataire pub à celui de conseiller sur le revenu. C'est ce genre de phrase qui fait durer un retainer.

## Exemple appliqué

Un e-commerce lifestyle : une marque de maillots de bain fabriqués au Portugal, panier moyen 70 €, budget média 2 500 € par mois, gérée à 800 € par mois de forfait.

Le relevé sur 30 jours : 12 400 vues produit, 1 050 ajouts au panier — soit 8,5 %, dans les clous. 430 checkouts initiés — 41 % des paniers, correct. 118 achats — 27 % des checkouts, très en dessous de la fourchette de 50 à 60 %. La fuite est en bas du tunnel, à la marche paiement.

Tu fais alors ce que trop peu de gestionnaires font : un achat test sur mobile, jusqu'à l'écran de paiement. Deux constats. Les frais de port de 6,90 € n'apparaissent qu'à la dernière étape — surprise de fin de parcours, cause d'abandon numéro un. Et aucun paiement fractionné n'est proposé, sur des paniers qui montent facilement à 140 € avec deux pièces.

Tes recommandations côté site : afficher « livraison offerte dès 80 € » dès la page produit — ce qui tue la surprise et pousse le panier moyen — et activer le paiement en trois fois. Côté ads : une audience de retargeting « checkout 3 jours » avec un message de pure réassurance — retours gratuits 30 jours, paiement sécurisé — sans aucune remise.

Six semaines plus tard : le passage checkout-achat est remonté à 44 %, soit 187 achats pour un trafic équivalent, et le CPA est passé de 21 € à 13 €. Aucune nouvelle créa, aucun changement d'audience : uniquement une fuite localisée puis colmatée au bon endroit.

## Les erreurs fréquentes

Tout soigner au retargeting. Le retargeting rattrape une partie des abandons, il ne répare pas la cause. Si le checkout fuit à cause des frais de port, la pub de rappel paie pour ramener des gens devant le même mur.

Offrir une remise à chaque abandon. Les acheteurs réguliers apprennent vite : panier, attente de 24 heures, code de 10 %. Tu détruis ta marge et tu fausses tous tes chiffres d'abandon.

Lire le tunnel sur trois jours. Entre les fenêtres d'attribution et le délai naturel de décision — souvent plusieurs jours sur un panier à 70 € —, une lecture courte montre des ratios faux. Trente jours minimum.

Comparer aux benchmarks sans contexte. Un produit premium, une marque inconnue, un marché de niche : les ratios « normaux » n'y sont pas ceux d'un e-commerce mainstream. La vraie référence, c'est l'évolution du compte contre lui-même.

Oublier d'exclure les acheteurs du retargeting. C'est l'erreur la plus visible pour le client final — et celle qu'un client repère lui-même quand il reçoit la pub du maillot qu'il vient de commander.

## Action immédiate

Sur le compte de ton client e-commerce — ou sur n'importe quel compte auquel tu as accès —, relève les quatre volumes sur 30 jours : vues produit, paniers, checkouts, achats. Calcule les trois ratios, compare-les aux fourchettes de la leçon, et entoure le plus faible. Puis fais un achat test complet sur mobile, jusqu'à l'écran de paiement, et note tout ce qui t'a freiné : frais surprise, champs inutiles, lenteurs, réassurance absente. Tu repars avec un diagnostic chiffré et une liste de recommandations concrètes — c'est un paragraphe entier de ton prochain reporting, prêt en moins d'une heure.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Tableau de lecture du tunnel","description":"Les quatre volumes sur 30 jours, les trois ratios calculés, les fourchettes de référence et la marche prioritaire à entourer.","kind":"template","url":null},{"title":"Parcours d'achat test sur mobile","description":"Les points à contrôler en passant soi-même commande : frais surprise, création de compte, moyens de paiement, réassurance, bugs mobile.","kind":"checklist","url":null},{"title":"Google Analytics","description":"Le recoupement côté site des volumes et des taux de passage mesurés par le pixel Meta.","kind":"link","url":"https://analytics.google.com"}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '1b0a60ed-8015-4fd1-9818-b3a76ce97c61'::uuid, m.id, m.course_id, m.org_id, 'scaling', $sq$Scaling : quand et comment augmenter les budgets$sq$, $sq$Tu vérifies les cinq conditions à remplir avant d'augmenter un budget, puis tu appliques la règle des +20 % par palier tous les 3 à 4 jours. Tu choisis entre scaling vertical et horizontal, tu anticipes ce qui casse quand on va trop vite, et tu fais évoluer ta facturation au passage des 5 000 € de média mensuel.$sq$, $sq$## L'accroche

C'est le paradoxe le plus cruel de la publicité Meta : c'est au moment où ça marche que tout peut casser. Ta campagne tourne, le coût par prospect est stable à 15 € depuis un mois, le client est ravi. Tellement ravi qu'il t'annonce : « On double le budget dès lundi. » Tu doubles. Deux semaines plus tard, le coût par prospect est à 34 €, la campagne est repartie en phase d'apprentissage, et le client — qui vient de doubler sa mise — commence à douter de toi. Rien n'était cassé : c'est la manière d'augmenter qui a tout cassé. Le scaling n'est pas une question de courage budgétaire, c'est une procédure : des conditions à vérifier avant, un rythme d'augmentation à respecter pendant, et des signaux de saturation à surveiller après. Cette leçon te donne les trois, plus la partie que personne n'enseigne : ce que le scaling change à ta facturation.

## Le contenu

### Les cinq conditions avant de scaler

Ne touche pas au budget tant que ces cinq cases ne sont pas cochées.

Un : le coût par résultat est stable depuis au moins 14 jours. Pas cinq bons jours — deux semaines pleines, week-ends compris. Cinq bons jours, c'est parfois juste une bonne semaine.

Deux : l'ad set est sorti de la phase d'apprentissage. Scaler un ad set en apprentissage, c'est accélérer une voiture qui cherche encore sa route.

Trois : l'économie est validée. À ce CPA, le client gagne-t-il de l'argent, marge et valeur client comprises ? Scaler une campagne non rentable, c'est industrialiser une perte.

Quatre : tu as des créas fraîches en réserve. Le scaling accélère la consommation d'audience, donc la fatigue créative — revois la leçon précédente. Monter le budget sans munitions créatives, c'est planifier le décrochage.

Cinq : l'aval tient. Plus de ventes, c'est plus de stock et plus de SAV ; plus de leads, c'est plus de rappels à passer. Un lead rappelé au bout de 72 heures est un lead mort — et ce sera « la faute des pubs ».

### La règle des +20 %

Le mécanisme à protéger, c'est la stabilité d'apprentissage. Une hausse brutale de budget — au-delà de 25 à 30 % d'un coup — peut renvoyer l'ad set en apprentissage, avec une diffusion erratique pendant plusieurs jours.

La procédure : augmente de 20 % maximum, au niveau où vit le budget — campagne si tu es en budget Advantage, ad set sinon —, puis attends trois à quatre jours avant le palier suivant. Concrètement : 50 € par jour, puis 60, 72, 86, 104. Tu doubles proprement en deux à trois semaines.

Et annonce la vérité au client avant de commencer : le CPA va légèrement monter. Payer 10 à 15 % plus cher chaque résultat pour en obtenir deux fois plus est un excellent arbitrage — mais s'il n'a pas été annoncé, le client ne verra que la hausse.

### Vertical et horizontal

Le scaling vertical, c'est plus de budget sur ce qui marche déjà. Simple, rapide, mais il plafonne : une audience n'est pas infinie, et plus tu la presses, plus Meta va chercher des profils moins probables.

Le scaling horizontal, c'est ouvrir de nouvelles sources de volume : une nouvelle audience, une nouvelle zone géographique, un nouvel angle créatif, un nouveau format ou placement. Plus de travail, plafond plus haut.

L'ordre pratique : vertical d'abord, par paliers, jusqu'au premier signe de saturation — fréquence qui grimpe, CPA qui dérive sur plusieurs jours. Puis horizontal pour continuer à grandir sans épuiser le socle qui fonctionne.

### Ce qui casse quand on va trop vite — et comment redescendre

Les trois casses classiques : le doublement brutal qui relance l'apprentissage et rend le compte illisible une semaine ; la fatigue créative accélérée, parce qu'au double du budget l'audience voit tout deux fois plus vite ; et l'aval saturé — le service client débordé, les leads rappelés trop tard, la conversion finale qui s'effondre pendant que tes CPL, eux, restent bons.

Prévois la marche arrière avant de monter : fixe un seuil de CPA au-delà duquel tu redescends. Si le coût par résultat dépasse ce seuil cinq à sept jours de suite, reviens au palier précédent et laisse stabiliser une semaine. Redescendre n'est pas un échec, c'est la moitié de la procédure — et le dire au client à l'avance transforme un recul en décision maîtrisée.

### Ce que le scaling change à ta facturation

Ton forfait de gestion — 500 à 1 000 € par mois — est calibré pour un budget média jusqu'à environ 5 000 € par mois. Au-delà, passe à 10-15 % du budget média : un compte qui dépense plus exige plus de surveillance, plus de créas, plus de reporting. Vérifie que le pourcentage dépasse bien ton forfait au moment de la bascule — 10 % de 5 000 € font 500 €, soit moins qu'un forfait à 800 € : tu travaillerais plus pour gagner moins. Négocie cette bascule dans le contrat dès le départ, quand tout le monde est calme — pas au moment où le client double la mise et regarde chaque euro.

## Exemple appliqué

Une mutuelle santé régionale, cible B2C. La campagne de devis « complémentaire santé senior », 55-70 ans, tourne à 1 800 € par mois — 60 € par jour — avec un coût par prospect de 15 €, stable depuis six semaines : environ 120 devis par mois. Le client veut passer à 250 devis mensuels.

Vérification des cinq conditions. CPL stable : oui. Apprentissage : sorti. Économie : un devis se transforme en contrat dans 20 % des cas, et un contrat rapporte largement plus que les 75 € que coûte donc un contrat en acquisition — validé. Créas : deux variantes neuves sont produites avant le premier palier. L'aval : deux conseillers rappellent les demandes ; 250 devis par mois, c'est 11 à 12 rappels par jour ouvré — c'est leur limite haute. Tu le dis au client, il réorganise les plannings de rappel. Cette conversation-là, presque personne ne la tient, et c'est elle qui sauvera la suite.

Le plan : 60 € par jour, puis 72 à J+4, 86 à J+8, 104 à J+12, 125 à J+16. Le CPL glisse de 15 € à 17,20 € — annoncé, accepté. À 125 € par jour, la fréquence sur 30 jours dépasse 3,8 : signe de saturation de l'audience senior régionale. Passage à l'horizontal : un deuxième ad set sur les 40-54 ans travailleurs indépendants, avec deux créas dédiées sur l'angle « une mutuelle qui couvre aussi votre activité », à 40 € par jour.

Bilan à deux mois : 4 950 € de budget média mensuel, 268 devis, CPL moyen à 18,50 € — 23 % au-dessus du point de départ, pour un volume plus que doublé. Et ton contrat prévoit déjà la bascule : au palier suivant, le compte franchit 5 000 € de média — 190 € par jour, 5 700 € par mois — et ta rémunération passe du forfait de 800 € à 15 % du budget, soit 855 €, puis autant que le compte grandit.

## Les erreurs fréquentes

Doubler le budget du jour au lendemain. C'est la casse la plus fréquente et la plus évitable : retour en apprentissage, une à deux semaines de diffusion erratique, et une confiance client entamée au pire moment.

Scaler sur cinq bons jours. Une bonne semaine n'est pas une tendance. Deux semaines de stabilité minimum, sinon tu amplifies un accident heureux.

Scaler sans créas en réserve. Le budget monte, l'audience sature en accéléré, la fatigue arrive en dix jours au lieu de quatre semaines — et tu n'as rien à mettre en face.

Ne pas annoncer la hausse mécanique du CPA. Le client retient le chiffre qui monte. Annoncée avant, la hausse est un paramètre du plan ; découverte après, c'est une contre-performance dont tu es responsable.

Ignorer l'aval. Des leads excellents rappelés en trois jours deviennent des leads « pourris » dans la bouche du client. Vérifie la capacité de traitement avant le premier palier, pas après la première plainte.

## Action immédiate

Prends ton meilleur ad set actif — ou celui du dernier compte que tu as travaillé — et passe la checklist des cinq conditions : coût par résultat stable depuis 14 jours, apprentissage terminé, rentabilité validée avec le client, au moins deux créas en réserve, aval capable d'absorber le volume. Si les cinq cases sont cochées, programme le premier palier de +20 % pour demain matin et note dans ton agenda les dates des trois paliers suivants, à quatre jours d'intervalle. S'il manque une case, écris l'action précise qui la remplit — produire une créa, valider la marge, caler les rappels — et fais d'elle ta priorité de la semaine.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Conditions avant scaling","description":"Les cinq cases à cocher avant le premier palier : stabilité 14 jours, apprentissage terminé, rentabilité validée, créas en réserve, aval capable.","kind":"checklist","url":null},{"title":"Journal de paliers budgétaires","description":"Le suivi des hausses de +20 % : date, budget, CPA constaté, seuil de redescente et décision prise à chaque palier.","kind":"template","url":null},{"title":"Meta Business Manager","description":"L'accès aux budgets, aux phases d'apprentissage et aux fréquences des ad sets à scaler.","kind":"link","url":"https://business.facebook.com"}]$sq$::jsonb, 6, true
from academy_modules m
where m.id = '255bb057-369e-42a8-8469-51e02e412042'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'c1f0f22a-9d94-49fe-88ab-3b7c8cbaa376'::uuid, c.id, c.org_id, 'publicite-google', $sq$Publicité Google$sq$, $sq$Ce module apprend à utiliser Google Ads sans gaspiller le budget des clients : choisir la bonne famille de campagne, construire un Search rentable pas à pas, et arbitrer les budgets face à Meta. Il donne les grilles de décision, les réglages à verrouiller et la méthode de mesure blended qui rend les reportings crédibles.$sq$, 9, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '8387de8e-b5e9-4357-a50c-6c8d319e80a2'::uuid, m.id, m.course_id, m.org_id, 'search-pmax-youtube', $sq$Search, Performance Max, YouTube : quoi utiliser quand$sq$, $sq$Les trois familles de campagnes Google servent des rôles distincts : le Search capte une demande existante, Performance Max automatise tout mais exige un historique de conversions, YouTube crée la demande sans livrer de conversions directes. La leçon donne une grille de décision en trois questions et les seuils de budget en dessous desquels on se concentre sur une seule campagne.$sq$, $sq$## L'accroche

Un client te dit : « On devrait faire du Google, non ? » Tu ouvres Google Ads pour la première fois depuis des mois. Le tunnel de création te demande un objectif, puis te pousse vers Performance Max, avec un budget conseillé et des cases pré-cochées. Tu valides, parce que Google a l'air de savoir ce qu'il fait. Trois semaines plus tard : 640 € dépensés, 4 conversions douteuses, des impressions sur des applis de jeux mobiles, et un client qui demande des comptes. Le problème n'est pas Google Ads. Le problème, c'est que tu as laissé la machine choisir le type de campagne à ta place. Google Ads, ce sont trois familles de campagnes qui ne servent pas la même chose, qui ne se pilotent pas pareil, et qui ne conviennent pas aux mêmes clients. Si tu sais les distinguer, tu évites déjà 80 % des budgets gaspillés. C'est exactement ce qu'on va voir.

## Le contenu

### Search : capter une demande qui existe déjà

Une campagne Search affiche une annonce texte quand quelqu'un tape une requête sur Google. C'est le seul levier publicitaire où tu ne déranges personne : la personne cherche activement une solution, tu te places sur son chemin. C'est pour ça que le Search convertit mieux que tout le reste, et c'est aussi pour ça qu'il coûte cher au clic. Ordres de grandeur en France : 0,80 à 2 € le clic pour un artisan local, 3 à 8 € pour un service B2B, 15 € et plus sur l'assurance ou le crédit.

Le Search est ton point de départ par défaut pour un client qui vend un service ou un produit que les gens cherchent déjà : « plombier Angers », « logiciel de paie PME », « location autocar avec chauffeur ». Ce qu'il ne faut pas lui demander : créer de la demande. Si personne ne tape la requête, le Search ne peut rien pour toi. Un produit innovant que personne ne connaît n'a pas de volume de recherche — vérifie-le dans le planificateur de mots-clés avant de promettre quoi que ce soit.

### Performance Max : un automate qui a besoin de carburant

Performance Max, c'est une seule campagne qui diffuse partout à la fois : Search, Shopping, YouTube, Display, Gmail, Discover. Tu fournis des visuels, des titres, un budget, un objectif de conversion, et l'algorithme décide seul où et à qui diffuser. C'est puissant, mais c'est une boîte noire : tu ne sauras jamais précisément quelle requête ou quel placement a généré quoi.

La règle qui change tout : PMax se nourrit de données de conversion. Sans historique, l'algorithme apprend au hasard, avec ton argent. Les conditions minimales avant de lancer une PMax : un suivi de conversion fiable et vérifié, idéalement 30 conversions par mois sur le compte, et pour un e-commerce un flux produit propre dans Merchant Center. PMax est excellente pour un e-commerce qui a déjà un historique de ventes. Elle est dangereuse sur un compte neuf, en B2B à cycle long, ou quand la « conversion » est un formulaire que n'importe qui peut remplir — l'algorithme optimisera vers des leads faciles et inutiles. Ce qu'il ne faut pas lui demander : de la transparence, ni de démarrer un compte à zéro.

### YouTube : créer la demande, pas la récolter

Les campagnes vidéo YouTube servent la notoriété et la considération. Le coût par vue est bas — compte 0,02 à 0,06 € la vue en France — donc tu touches beaucoup de monde pour pas cher. En échange, il ne faut pas attendre de conversions directes : quelqu'un qui regarde une vidéo entre deux tutos ne sort pas sa carte bleue. YouTube se juge sur la couverture, le taux de vue, la mémorisation, et sur ce qu'il alimente ensuite : les audiences de personnes ayant vu tes vidéos se recyclent en retargeting, et les recherches de marque augmentent dans les semaines qui suivent une campagne bien faite.

Prérequis souvent oublié : il faut des vidéos. Pas un montage de photos avec de la musique libre de droits — une vraie création pensée pour capter en 5 secondes. Si le client n'a ni les assets ni le budget pour en produire, YouTube n'est pas pour lui, point.

### La grille de décision

Trois questions, dans l'ordre. Un : la demande existe-t-elle ? Si oui, Search d'abord, toujours. Deux : le compte a-t-il un historique de conversions et, pour un e-commerce, un flux produit ? Si oui, PMax peut venir en complément du Search, jamais à la place. Trois : le client a-t-il un budget dédié à la notoriété et des vidéos ? Si oui seulement, YouTube.

Côté budget : sous 1 000 € de média par mois, une seule campagne Search bien construite. Vouloir répartir 900 € sur trois campagnes, c'est condamner les trois à ne jamais apprendre. Et rappelle-toi ton propre modèle : tu factures la gestion 500 à 1 000 € HT par mois en forfait, et 10 à 15 % du budget média au-delà de 5 000 € de dépense mensuelle. Sous 1 000 € de média, ton forfait pèse donc la moitié ou plus de ce qui part réellement en publicité. Ça ne se tient que si le ticket moyen est élevé : un projet d'artisan à 9 000 € absorbe sans problème 500 € de gestion, une vente à 40 € non. Dis-le au client avant de signer, pas au troisième reporting.

## Exemple appliqué

Prenons un cas transport premium B2B : une société de transport de personnes haut de gamme — navettes de séminaires, transferts aéroport pour cadres, événements d'entreprise. Ticket moyen d'une prestation : 3 500 € HT. Budget média accordé : 2 000 € par mois.

L'assistant de création de Google lui aurait proposé une Performance Max. Mauvaise idée : compte neuf, zéro historique de conversion, pas de flux produit, cible B2B étroite. L'algorithme aurait brûlé le budget en Display.

La bonne lecture avec la grille : la demande existe — « location autocar avec chauffeur », « transport séminaire entreprise », « navette aéroport entreprise » totalisent environ 8 000 recherches mensuelles en France d'après le planificateur. Donc 100 % du budget en Search au lancement. À 2,50 € le clic en moyenne, 2 000 € achètent environ 800 clics. Avec une page de demande de devis correcte qui convertit à 3 %, ça donne 24 demandes de devis par mois, soit 83 € le lead. Si le commercial signe une affaire sur cinq, c'est presque 5 contrats à 3 500 € : environ 17 000 € de chiffre pour 2 000 € de média. Le calcul se présente au client avant le lancement, comme hypothèse à valider — pas comme promesse.

PMax ? On en reparle dans six mois, quand le compte aura accumulé assez de conversions. YouTube ? Jamais avec ce budget : 2 000 € par mois ne financent pas la notoriété ET l'acquisition, et l'acquisition paie les factures.

## Les erreurs fréquentes

Lancer une Performance Max sur un compte vierge. Sans données de conversion, l'algorithme apprend avec l'argent du client, et il apprend mal. Tu récupères des conversions fantômes et aucun enseignement. Search d'abord, PMax quand le compte a un historique.

Accepter les réglages par défaut. À la création d'une campagne Search, Google coche le Réseau Display et les partenaires de recherche. Résultat : ton budget « Search » fuit vers des bannières sur des sites tiers. Décoche les deux, systématiquement, dès la création.

Juger YouTube sur les conversions directes. Tu regardes la colonne conversions, tu vois 2, tu conclus que YouTube ne marche pas. YouTube se mesure sur la couverture, le taux de vue et l'effet sur les recherches de marque — pas sur le dernier clic.

Saupoudrer un petit budget sur trois campagnes. 900 € répartis en 300 € par campagne, c'est trois campagnes qui n'auront jamais assez de données pour optimiser quoi que ce soit. Un petit budget se concentre sur un seul front.

Lancer sans suivi de conversion vérifié. Sans conversion mesurée, tu pilotes au clic, c'est-à-dire à l'aveugle, et aucune stratégie d'enchère intelligente ne fonctionnera jamais. Le tracking se pose et se teste avant le premier euro dépensé.

## Action immédiate

Prends le compte Google Ads d'un client actif — ou le tien, ou celui d'un prospect qui t'a donné accès. En moins d'une heure, remplis une grille simple : quels types de campagnes tournent, quelle part du budget part sur chaque type, le Réseau Display et les partenaires de recherche sont-ils cochés sur les campagnes Search, et le suivi de conversion mesure-t-il une action qui a une valeur business réelle. Quatre lignes, quatre réponses. Si tu n'as accès à aucun compte, fais l'exercice en planificateur de mots-clés : prends ton meilleur client, liste dix requêtes que ses acheteurs taperaient, et note les volumes et les CPC. Tu sauras immédiatement si le Search est un sujet pour lui.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Grille de décision Search / PMax / YouTube","description":"Un tableau à trois questions (demande existante, historique de conversions, budget et assets vidéo) qui désigne la famille de campagne adaptée à chaque client.","kind":"template","url":null},{"title":"Audit express d'un compte Google Ads","description":"Une checklist en quatre points : types de campagnes actifs, répartition du budget, Réseau Display et partenaires de recherche décochés, suivi de conversion branché sur une action à valeur business.","kind":"checklist","url":null},{"title":"Google Ads","description":"L'interface de création et de gestion des campagnes, qui contient aussi le planificateur de mots-clés pour vérifier volumes et CPC avant tout engagement.","kind":"tool","url":"https://ads.google.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'c1f0f22a-9d94-49fe-88ab-3b7c8cbaa376'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'df218785-8797-4d6e-b86d-7a944ea96fbb'::uuid, m.id, m.course_id, m.org_id, 'campagne-search-rentable', $sq$Construire une campagne Search rentable$sq$, $sq$Six étapes dans l'ordre : mots-clés transactionnels, correspondances exact et expression avec exclusions dès le jour un, annonces responsives à quatre registres, extensions, enchères adaptées à la maturité du compte, et suivi de conversion testé avant le premier euro. La leçon détaille aussi la routine hebdomadaire du rapport des termes de recherche, qui fait la rentabilité dans la durée.$sq$, $sq$## L'accroche

Tu as lancé ta première campagne Search il y a trois semaines. 420 € dépensés. Tu ouvres enfin le rapport des termes de recherche, et tu découvres la réalité : ton client vend des formations en gestion de paie, et ton budget est parti sur « formation paie gratuite », « salaire gestionnaire de paie » et « offre emploi paie Lyon ». Aucune de ces personnes n'achètera jamais rien. Ce n'est pas un bug : c'est le comportement par défaut de Google Ads quand tu ne verrouilles pas les correspondances de mots-clés et que tu ne poses pas d'exclusions. Google gagne de l'argent à chaque clic, pertinent ou non — le réglage d'usine travaille pour lui, pas pour ton client. Une campagne Search rentable, ce n'est pas une question de génie créatif. C'est une construction méthodique en six étapes, et chacune se fait en moins d'une heure. On les déroule maintenant, dans l'ordre.

## Le contenu

### Étape 1 — Les mots-clés partent de la demande réelle

Ouvre le planificateur de mots-clés et cherche ce que taperait quelqu'un prêt à acheter. Tu vises les requêtes transactionnelles : « devis », « prix », « tarif », le nom du service plus la ville, le nom du produit plus « acheter ». Tu écartes l'informationnel : « comment », « définition », « c'est quoi ». Au lancement, 10 à 20 mots-clés suffisent, répartis en groupes d'annonces serrés — 5 à 10 mots-clés par groupe, tous sur le même sujet. Un groupe « cuisine sur mesure » et un groupe « bibliothèque sur mesure », pas un groupe fourre-tout « menuiserie » avec 40 mots-clés qui partagent la même annonce.

### Étape 2 — Les correspondances décident où va ton argent

Trois syntaxes. Exact, entre crochets : [cuisine sur mesure nantes] ne se déclenche que sur cette intention précise. Expression, entre guillemets : "cuisine sur mesure" accepte des mots autour, mais garde le sens. Large, sans rien : Google diffuse sur tout ce qu'il juge proche, et son jugement est généreux — c'est comme ça que « formation paie » finit sur « offre emploi paie ». Règle de départ : exact et expression uniquement. Le large se réserve aux comptes mûrs, avec des enchères intelligentes nourries de conversions et une liste d'exclusions solide.

Les exclusions, justement : elles se posent au jour un, pas quand le mal est fait. Liste minimale à adapter au client : gratuit, emploi, salaire, formation, avis, occasion, pas cher, définition, DIY. Chaque métier a les siennes — un artisan haut de gamme exclut « pas cher », un organisme de formation ne l'exclut pas.

### Étape 3 — L'annonce responsive se rédige, elle ne se remplit pas

Une annonce responsive te demande jusqu'à 15 titres et 4 descriptions ; Google assemble les combinaisons. Ne remplis pas les 15 cases pour faire plaisir à l'indicateur d'efficacité. Vise 10 à 12 titres qui couvrent quatre registres : le mot-clé lui-même (le mot tapé, en gras dans l'annonce, fait cliquer), le bénéfice concret (« Posée en 6 semaines »), la preuve (« 120 cuisines livrées », « Garantie 10 ans »), et l'appel à l'action (« Devis gratuit sous 48 h »). Épingle le titre du mot-clé en position 1 si l'assemblage automatique produit des annonces incohérentes, mais épingle avec parcimonie : chaque épingle réduit les combinaisons testables. Une annonce responsive par groupe d'annonces suffit.

### Étape 4 — Les extensions sont de la surface gratuite

Les extensions — Google dit maintenant « composants » — agrandissent ton annonce sans coûter plus cher au clic, et une annonce plus grande se fait davantage cliquer. Le minimum : 4 liens annexes vers des pages réelles (réalisations, tarifs, avis, contact), 4 à 6 accroches (« Devis gratuit », « Fabrication française », « Showroom à Nantes »), des extraits de site structurés (types de prestations), l'extension d'appel pour un client qui vend par téléphone, et l'extension de lieu pour un commerce physique. Trente minutes de travail, souvent un à deux points de taux de clic gagnés.

### Étape 5 — Les enchères suivent la maturité du compte

Au lancement, la campagne n'a pas de données : les stratégies automatiques n'ont rien à optimiser. Démarre en « maximiser les clics » avec un plafond de CPC — mets le plafond à ce que le planificateur annonce en haut de fourchette — ou en CPC manuel si tu veux la main complète. Quand le compte a accumulé 20 à 30 conversions, passe en « maximiser les conversions », puis pose un CPA cible seulement quand tu connais ton coût par conversion réel. Poser un CPA cible à 30 € sur un compte vide alors que le marché est à 80 €, c'est demander à Google de ne rien diffuser.

### Étape 6 — Le suivi de conversion se teste avant le premier euro

Une conversion doit être une action qui a une valeur business : formulaire de devis envoyé, appel de plus de 60 secondes, achat. Pas une visite de page, pas un clic sur un bouton. Pose la balise, puis teste toi-même : remplis le formulaire, vérifie que la conversion remonte dans l'interface. Ensuite, la routine hebdomadaire qui fait la rentabilité : ouvrir le rapport des termes de recherche, exclure ce qui n'a rien à faire là, couper les mots-clés qui dépensent sans convertir après 100 clics.

## Exemple appliqué

Cas artisan : un ébéniste à Nantes, spécialisé dans le mobilier sur mesure haut de gamme. Panier moyen d'un projet : 9 000 € TTC. Budget média : 900 € par mois — et ta gestion à 500 € HT par mois en forfait, ce qui oblige la campagne à être propre pour que l'ensemble reste rentable.

Structure : une campagne, deux groupes d'annonces. Groupe 1, « cuisine sur mesure » : [cuisine sur mesure nantes], "cuisiniste haut de gamme nantes", "cuisine sur mesure 44". Groupe 2, « meuble sur mesure » : [ébéniste nantes], "meuble sur mesure nantes", "bibliothèque sur mesure". Exclusions posées au jour un : ikea, pas cher, occasion, kit, emploi, formation, leroy merlin. Annonces du groupe 1 : titres « Cuisine Sur Mesure à Nantes », « Fabriquée dans Notre Atelier », « Posée en 6 Semaines », « Devis Gratuit sous 48 h » ; extensions vers les réalisations, les avis clients et la page atelier ; extension d'appel aux horaires d'ouverture.

Les chiffres au bout de deux mois : CPC moyen 2,20 €, soit environ 410 clics par mois. La page de devis convertit à 2,5 % : une dizaine de demandes de devis mensuelles, à 90 € le lead. L'ébéniste signe environ un projet sur dix demandes — un projet à 9 000 € par mois pour 900 € de média et 500 € de gestion. Ratio de 6,4 pour 1, et un carnet de commandes qui se remplit. C'est ça, une campagne Search rentable : rien de spectaculaire, tout de méthodique.

## Les erreurs fréquentes

Lancer en requête large avec enchères automatiques sur un compte neuf. C'est la combinaison par défaut que Google te propose, et c'est la pire : l'algorithme n'a aucune donnée pour viser juste et le large lui donne un terrain de jeu illimité. Ton budget explore, toi tu paies.

Ne jamais ouvrir le rapport des termes de recherche. La campagne parfaite au lancement se dégrade en silence : Google élargit, les requêtes parasites s'accumulent. Quinze minutes par semaine d'exclusions valent plus que n'importe quelle optimisation d'annonce.

Un seul groupe d'annonces pour 40 mots-clés. L'annonce ne peut pas coller à la requête, le taux de clic chute, Google te classe moins bien et te fait payer plus cher au clic. Un sujet, un groupe, une annonce cohérente.

Poser un CPA cible trop tôt ou trop bas. Sans historique de conversions, le CPA cible étrangle la diffusion : la campagne n'affiche presque plus rien et tu conclus à tort que « Google ne marche pas ». D'abord les données, ensuite la cible.

Envoyer tous les clics vers la page d'accueil. Quelqu'un qui cherche « cuisine sur mesure nantes » doit atterrir sur la page cuisines, avec des photos et un formulaire — pas sur une home générique qu'il devra explorer. Chaque groupe d'annonces a sa page de destination.

## Action immédiate

Si tu gères déjà une campagne Search : ouvre le rapport des termes de recherche sur les 30 derniers jours, trie par coût décroissant, et exclus au minimum 10 requêtes qui n'ont rien à faire là. C'est l'heure la plus rentable de ton mois. Si tu n'as pas encore de campagne : prends un client réel et construis le squelette dans un tableur — 15 mots-clés répartis en 2 ou 3 groupes, la correspondance choisie pour chacun, et 15 exclusions. Ce document devient ta base le jour du lancement, et c'est aussi une pièce que tu peux montrer en rendez-vous de vente pour prouver ta méthode.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Squelette de campagne Search","description":"Un tableur type avec les groupes d'annonces, les mots-clés et leur correspondance, la liste d'exclusions de départ et la page de destination associée à chaque groupe.","kind":"template","url":null},{"title":"Checklist de lancement Search","description":"Les vérifications avant activation : réseaux Display et partenaires décochés, conversion testée en conditions réelles, extensions posées, plafond de CPC cohérent avec le planificateur.","kind":"checklist","url":null},{"title":"Aide Google Ads","description":"La documentation officielle de Google sur les correspondances de mots-clés, les stratégies d'enchères et les composants d'annonces.","kind":"link","url":"https://support.google.com/google-ads"},{"title":"Google Ads","description":"L'interface où se construisent la campagne, les exclusions et le rapport des termes de recherche à relire chaque semaine.","kind":"tool","url":"https://ads.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'c1f0f22a-9d94-49fe-88ab-3b7c8cbaa376'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'bf4aa5b0-4bfc-4172-8a9e-1c9fe2bdeaa3'::uuid, m.id, m.course_id, m.org_id, 'arbitrer-meta-google', $sq$Mesurer et arbitrer entre Meta et Google$sq$, $sq$Meta et Google attribuent les mêmes ventes selon des règles différentes, donc leurs chiffres ne s'additionnent jamais et ne se comparent pas directement. La leçon installe le référentiel blended (MER, coût d'acquisition global), le tableau mensuel côte à côte, et la logique d'arbitrage qui remplit d'abord le Search avant d'étendre la prospection Meta, un mouvement de budget à la fois.$sq$, $sq$## L'accroche

Fin de mois, tu prépares le reporting. Le Gestionnaire de publicités Meta annonce 42 000 € de chiffre d'affaires attribué. Google Ads en revendique 21 000 €. Tu additionnes : 63 000 €. Sauf que le back-office du client affiche 51 000 € de ventes totales — pub, SEO, email et bouche-à-oreille compris. Les deux régies revendiquent donc plus que tout ce qu'il a encaissé. Qui ment ? Personne, et tout le monde : chaque plateforme s'attribue les conversions selon ses propres règles, et la même vente est revendiquée deux fois. Si tu présentes ces chiffres bruts au client, tu perds ta crédibilité le jour où il fait l'addition lui-même. Et surtout, tu es incapable de répondre à la seule question qui compte : le prochain euro, il va chez Meta ou chez Google ? Cette leçon te donne la méthode pour comparer ce qui est comparable et trancher.

## Le contenu

### Pourquoi les chiffres ne collent jamais

Meta attribue par défaut une vente à une pub si la personne a cliqué dans les 7 jours ou simplement vu la pub dans les 24 heures avant d'acheter. Google attribue au clic, avec un modèle piloté par les données qui répartit le mérite entre les clics Google — et uniquement les clics Google. Conséquence mécanique : une cliente clique sur une pub Instagram lundi, tape le nom de la marque sur Google mercredi, clique sur l'annonce Search et achète. Meta compte la vente — le clic de lundi tombe dans sa fenêtre de 7 jours. Google compte la même vente — pour lui, le clic Search est le dernier, et c'est le seul qu'il voit. Une vente réelle, deux ventes déclarées. Aucune des deux plateformes ne voit l'autre, aucune ne dédoublonne.

### Le référentiel commun : le blended

Puisque chaque régie triche à sa façon, il te faut un juge extérieur : les chiffres réels du client. Deux indicateurs suffisent. Le MER — Marketing Efficiency Ratio — : chiffre d'affaires total divisé par dépense publicitaire totale. Et le coût d'acquisition blended : dépense publicitaire totale divisée par nombre de nouveaux clients, toutes sources confondues. Ces deux chiffres partent de la réalité comptable : ils ne mentent pas.

La règle d'usage tient en une phrase : les chiffres des plateformes servent à comparer des campagnes à l'intérieur d'une plateforme ; le blended sert à arbitrer entre les plateformes. Le ROAS Meta de la campagne A contre celui de la campagne B, oui ; le ROAS Meta contre le ROAS Google, non — ce ne sont pas les mêmes règles du jeu.

### Construire le tableau côte à côte

Un tableur, une ligne par mois, huit colonnes : dépense Meta, dépense Google, dépense totale, CA déclaré par Meta, CA déclaré par Google, CA réel du client, MER, et une colonne de commentaire pour les événements du mois — soldes, rupture de stock, passage TV. Deux précautions de lecture. Un : aligne les fenêtres autant que possible — règle Meta sur « clic 7 jours » sans la vue si tu veux te rapprocher de la logique de Google, et note le réglage dans le tableau pour ne pas comparer un mois « avec vues » à un mois « sans ». Deux : compare des périodes équivalentes, mois contre mois, jamais une semaine de soldes contre une semaine creuse.

### Décider où va le prochain euro

Le réflexe naïf : « Google a le meilleur ROAS, on remet tout sur Google. » Le problème : le Search est plafonné par la demande. Il capte les gens qui cherchent déjà — souvent parce que Meta leur a donné envie de chercher. Regarde le taux d'impressions de tes campagnes Search : s'il est à 85 %, il ne reste presque rien à capter, et doubler le budget n'achètera pas de nouvelles recherches. Meta, à l'inverse, crée de la demande et s'étend presque sans limite, mais son efficacité se dégrade à mesure que tu montes.

D'où la logique d'arbitrage, en trois temps. Un : remplis d'abord le Search — tant que le taux d'impressions sur les requêtes transactionnelles est sous 70-80 % avec un coût par conversion sain, l'euro le plus rentable est là. Deux : une fois le Search saturé, l'euro suivant va à la prospection Meta. Trois : chaque changement se teste proprement — un seul mouvement de budget à la fois, plus ou moins 20 %, fenêtre de deux à trois semaines, et c'est le MER qui rend le verdict, pas le ROAS de la plateforme qu'on vient d'augmenter. C'est exactement le D de SPEED : des données, une décision, une trace écrite.

### Le rendre lisible pour le client

Ton reporting mensuel commenté — le livrable qui fait durer le retainer — ne montre jamais les deux ROAS côte à côte sans explication. Structure en quatre blocs : dépense totale, CA réel et MER ; ce que chaque plateforme a fait dans son rôle (Google capte, Meta crée) ; la décision du mois et pourquoi ; ce qu'on surveille le mois prochain. Un client qui comprend l'arbitrage renouvelle ; celui qui reçoit deux chiffres contradictoires doute des deux — et de toi.

## Exemple appliqué

Cas e-commerce lifestyle : une marque de bougies et parfums d'intérieur, panier moyen 55 €. Chiffres du mois : 38 500 € de CA total, 4 500 € de dépense pub — 3 000 € chez Meta, 1 500 € chez Google. Meta déclare 21 000 € de CA attribué, ROAS 7. Google déclare 14 000 €, ROAS 9,3. Total revendiqué : 35 000 €, soit 91 % du CA du client — comme si le SEO, l'email et les clientes fidèles n'existaient pas. Invraisemblable, donc on juge au blended : MER de 8,6 (38 500 / 4 500). Sain pour cette marge.

Maintenant l'arbitrage. Le ROAS Google est gonflé par la campagne sur le nom de la marque : les gens qui tapent « bougies [marque] » auraient acheté de toute façon, au moins en partie. On isole donc le Search générique — « bougie parfumée naturelle », « parfum d'intérieur artisanal » — et là, le taux d'impressions n'est qu'à 45 % avec un coût par conversion de 12 €, contre 19 € chez Meta en prospection. Il reste de la demande non captée, moins chère que la création de demande. Décision : plus 300 € sur le Search générique le mois prochain — 20 % du budget Google, le plafond que s'impose le protocole — budgets Meta inchangés. Le verdict se pose d'avance et se chiffre : à 12 € la conversion, ces 300 € doivent produire environ 25 ventes, soit 1 375 € de chiffre au panier de 55 €. Le mois suivant tournerait alors à 39 875 € de CA pour 4 800 € de dépense, MER 8,3. On valide si le MER tient au-dessus de 8,3 ; s'il décroche sous 8, on revient en arrière. Le chiffre qui tranchera est écrit dans le reporting avant le mois, pas après. C'est ce qui te distingue d'un freelance qui « a un bon feeling sur Google ».

## Les erreurs fréquentes

Additionner le CA Meta et le CA Google. La même vente est comptée deux fois, et le total dépasse la réalité. Le jour où le client s'en aperçoit — et il s'en aperçoit toujours — c'est ta parole qui est dévaluée, pas celle des plateformes.

Tuer un canal en comparant les ROAS bruts. Meta compte des vues, Google ne compte que des clics : le match est truqué d'avance. Couper Meta parce que « Google est à 9 et Meta à 7 » assèche souvent les recherches de marque trois semaines plus tard — et le beau ROAS Google s'effondre avec.

Traiter la campagne sur le nom de marque comme de l'acquisition. Son ROAS de 15 ou 20 mélange des ventes qui seraient venues gratuitement en organique. Isole-la toujours dans ton tableau, et juge l'acquisition sur le générique.

Changer deux choses à la fois. Tu montes Meta et tu refais les annonces Google le même mois : le MER bouge et tu ne sauras jamais pourquoi. Un mouvement, une fenêtre de lecture, un verdict.

Décider sur une semaine de données. Une semaine, c'est du bruit : une météo, un jour férié, un aléa de diffusion. Les arbitrages budgétaires se prennent sur deux à trois semaines minimum, et sur un mois pour les gros mouvements.

## Action immédiate

Prends ton client qui investit sur les deux plateformes — ou l'un des deux canaux s'il n'en a qu'un — et construis le tableau blended sur les trois derniers mois, avec les huit colonnes décrites plus haut. Les dépenses et les CA déclarés se lisent dans les deux gestionnaires en cinq minutes ; le CA réel sort du back-office ou d'une question au client. Trente minutes de travail. Garde ce tableau : c'est la première page de ton prochain reporting et l'argument qui justifie ton arbitrage budgétaire.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Tableau blended mensuel","description":"Un tableur à huit colonnes par mois — dépenses Meta, Google et totale, CA déclaré par chaque régie, CA réel, MER, commentaire — qui sert de première page au reporting.","kind":"template","url":null},{"title":"Protocole d'arbitrage budgétaire","description":"Une checklist qui encadre chaque mouvement de budget : un seul changement à la fois, plus ou moins 20 pour cent, fenêtre de deux à trois semaines, seuil de MER qui valide ou annule la décision.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"L'accès au Gestionnaire de publicités Meta, où se lisent les dépenses et le CA attribué, et où se règle la fenêtre d'attribution à aligner avant toute comparaison.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'c1f0f22a-9d94-49fe-88ab-3b7c8cbaa376'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '2e37c79a-1aad-42d0-8633-355c68188a4c'::uuid, c.id, c.org_id, 'community-management', $sq$Community management et modération$sq$, $sq$Ce module t'apprend à professionnaliser la modération : cadrer les règles avec une charte validée par le client, répondre aux commentaires négatifs sans aggraver la situation et dérouler un protocole quand une crise se déclenche. Il se termine par le système d'organisation qui permet de tenir des temps de réponse sur plusieurs clients sans y passer tes journées.$sq$, 10, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'fb8579f7-beb5-47b8-a946-b50f513d115e'::uuid, m.id, m.course_id, m.org_id, 'cadrer-la-moderation', $sq$Cadrer la modération : charte, ton, escalade$sq$, $sq$Tu apprends à construire avec ton client une charte de modération de deux pages : réponses types, règles de masquage, cas d'escalade nommés et délais tenables. La leçon détaille l'atelier d'une heure pour la co-écrire, la faire valider par écrit et la facturer.$sq$, $sq$## L'accroche

Il est 21 h 47, un jeudi. Ton téléphone vibre. Ton client te transfère une capture d'écran : sous le post publié le matin, un commentaire dit « Votre mutuelle refuse de rembourser l'hospitalisation de ma mère depuis quatre mois. Honte à vous. » Et il te pose la question que tu redoutes : « On fait quoi ? On supprime ? »

Si rien n'a été écrit avant, tu vas improviser. Improviser à 22 h, sous pression, avec un client qui panique : c'est comme ça qu'on aggrave un problème au lieu de le régler. Tu vas répondre trop vite, ou masquer un commentaire légitime, ou promettre un remboursement que personne ne t'a autorisé à promettre.

La différence entre un community manager amateur et un pro, ce n'est pas la qualité des réponses. C'est qu'un pro a cadré les règles avant le premier commentaire. Ce cadre s'appelle une charte de modération, elle tient sur deux pages, et tu vas apprendre à l'écrire dans cette leçon.

## Le contenu

La modération vit dans le second E de la méthode SPEED, celui de l'Exécution : c'est du quotidien, du répétitif, et c'est justement pour ça qu'il faut des règles écrites. Une décision qu'on prend cinquante fois par mois ne doit jamais dépendre de ton humeur ni de celle du client.

### Les quatre gestes possibles

Face à n'importe quel message entrant, tu n'as que quatre gestes possibles. Ta charte doit dire lequel s'applique à quoi.

Premier geste : répondre. C'est le cas de 80 à 90 % des messages — questions produit, compliments, demandes de prix, réclamations formulées poliment. La charte liste les dix questions les plus fréquentes et la réponse validée pour chacune.

Deuxième geste : masquer. Sur Facebook et Instagram, masquer un commentaire le rend invisible pour tout le monde sauf son auteur et ses amis. L'auteur ne le sait pas, donc il ne revient pas à la charge. Tu masques les insultes, le spam, les liens commerciaux tiers. Jamais une critique argumentée.

Troisième geste : supprimer et signaler. Réservé à ce qui est illégal ou dangereux : menaces, contenus haineux, divulgation de données personnelles, arnaques. Tu supprimes, tu fais une capture d'écran avant, et si c'est illégal tu signales sur Pharos, la plateforme du ministère de l'Intérieur.

Quatrième geste : escalader. Tout ce qui dépasse ton mandat part chez le client, vers une personne nommée, sous un délai écrit. Tu n'es ni juriste, ni SAV, ni porte-parole de crise.

### Ce qui s'escalade toujours

Ta charte doit lister noir sur blanc les cas d'escalade. Le socle, valable pour tous les clients : toute question juridique ou contractuelle ; toute menace de procédure — « je saisis mon avocat », « je contacte 60 Millions de consommateurs » ; tout journaliste ou influenceur qui se manifeste ; toute situation médicale, financière ou personnelle sensible ; tout message qui vise un salarié nommément ; et tout emballement — plus de cinq commentaires négatifs sur le même sujet en moins de deux heures.

Pour chaque cas, la charte nomme un contact, avec un canal et un délai. Pas « le service client » : « Sophie Martin, responsable relation adhérents, par WhatsApp, réponse attendue sous 2 h ouvrées ». Si le contact n'a pas de nom, l'escalade n'existe pas.

### Le ton de réponse

Trois ou quatre lignes suffisent. Tutoiement ou vouvoiement. Signature ou pas — « L'équipe X ». Emojis ou pas, et lesquels. Puis deux exemples rédigés dans le ton : une réponse à un compliment, une réponse à une réclamation. C'est court, mais sans ça, chaque réponse devient une négociation.

### Les délais

Engage-toi sur des délais tenables, pas sur des délais flatteurs. Le standard raisonnable pour un retainer : réponse sous 4 h ouvrées aux questions d'achat, sous 24 h ouvrées au reste, du lundi au vendredi, 9 h - 18 h. Le week-end et le soir, seule la procédure de crise s'applique. Écris aussi ça : le client qui t'envoie une capture à 21 h 47 doit savoir à l'avance que ta réponse arrivera le lendemain à 9 h, sauf crise déclarée.

### Comment l'écrire : un atelier d'une heure

Tu ne rédiges pas la charte seul dans ton coin. Tu la construis avec le client, en visio, en une heure, avec cinq questions : quelles sont les dix questions qu'on vous pose le plus ? Quels sujets sont interdits de réponse publique ? Qui décide quand ça dépasse mes attributions, et comment je le joins ? Quel ton vous ressemble ? Que fait-on des messages reçus hors horaires ?

Tu repars, tu rédiges deux pages, tu envoies pour validation écrite — un mail avec « validé » suffit — et tu ranges le document là où vous travaillez déjà ensemble. Une charte que le client n'a pas validée par écrit ne te protège de rien : le jour où un masquage fait polémique, c'est ta décision, pas la sienne.

La charte se facture. Soit elle est incluse dans la stratégie social media vendue en one-shot entre 1 500 et 3 000 € HT, soit tu la produis au démarrage du retainer, sur la première mensualité. Elle te prend trois heures la première fois, une heure et demie ensuite.

## Exemple appliqué

Prenons une mutuelle santé régionale, 40 000 adhérents, présente sur Facebook et Instagram, que tu accompagnes en retainer à 1 200 € HT par mois. C'est le cas le plus sensible que tu rencontreras : les commentaires parlent de santé, d'argent, et souvent des deux.

L'atelier d'une heure avec la responsable communication produit ceci. Questions fréquentes : délais de remboursement, pièces à fournir, résiliation, tarifs jeunes. Pour chacune, une réponse validée qui oriente vers l'espace adhérent sans jamais traiter le dossier en public. Règle absolue, dictée par le secret médical et le RGPD : aucun échange sur un dossier individuel en commentaire. La réponse type est : « Bonjour, nous ne pouvons pas traiter votre dossier ici pour protéger vos données. Envoyez-nous votre numéro d'adhérent en message privé, notre équipe vous rappelle sous 24 h ouvrées. »

Escalade : toute mention d'un refus de remboursement part chez Sophie, responsable relation adhérents, par mail avec capture d'écran, sous 2 h ouvrées — parce qu'un adhérent mécontent resté sans réponse 48 h écrit à la presse locale, c'est déjà arrivé. Toute mention d'un décès ou d'une hospitalisation en cours s'escalade aussi : on ne répond pas à un deuil avec une réponse type.

Masquage : insultes et spam uniquement. La direction voulait masquer toutes les critiques. Tu as montré que la page reçoit 30 commentaires négatifs par mois pour 41 questions neutres, et qu'un masquage découvert par un adhérent — ça se vérifie avec un second compte — ferait un article de presse là où une réponse calme fait un adhérent rassuré. La direction a signé.

Résultat après trois mois : temps de réponse moyen passé de 31 h à 5 h ouvrées, et zéro appel paniqué du client le soir. La charte a coûté trois heures de travail. Elle en économise deux par semaine.

## Les erreurs fréquentes

Écrire la charte seul et l'envoyer pour information. Le client ne l'a pas construite, donc il ne l'applique pas : il continue de te transférer chaque commentaire avec « on fait quoi ? ». La charte se co-écrit en atelier.

Confondre masquer et supprimer. Une suppression se remarque : l'auteur revient, furieux, et republie ailleurs avec capture. Un masquage lui reste invisible. Et sur une critique non insultante, aucun des deux : tu réponds.

Promettre des délais que tu ne tiendras pas. « Réponse sous 1 h, 7 j/7 » sur un retainer à 1 000 € HT par mois, c'est un mensonge qui se voit dès le premier samedi. Engage 4 h ouvrées et tiens-les.

Laisser l'escalade sans nom. « On transmet au service concerné » signifie que le message meurt dans une boîte mail générique. Un nom, un canal, un délai — sinon tu portes seul des sujets qui ne sont pas les tiens.

Ne jamais relire la charte. Les contacts changent, les produits changent, les questions changent. Une charte de 18 mois envoie des réponses fausses avec assurance. Relecture semestrielle, 30 minutes, calée dans ton process.

## Action immédiate

Prends ton client le plus actif en commentaires. Ouvre un document et remplis quatre blocs : les dix questions les plus fréquentes avec une réponse de trois lignes chacune, les cas de masquage, les cas d'escalade avec un nom et un délai en face de chacun, et les délais de réponse que tu t'engages à tenir. Tu as déjà 80 % des réponses en tête : ça prend 45 minutes. Puis envoie ce brouillon au client avec une proposition de créneau de 30 minutes pour le valider ensemble. Tu viens de transformer un flou permanent en processus signé.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Trame de charte de modération","description":"Modèle deux pages en quatre blocs : réponses types aux dix questions fréquentes, règles de masquage, cas d'escalade avec contact nommé et délai, délais de réponse engagés.","kind":"template","url":null},{"title":"Checklist de l'atelier charte","description":"Les cinq questions à poser au client pendant l'atelier d'une heure, plus les validations à obtenir par écrit avant la mise en application.","kind":"checklist","url":null},{"title":"Pharos, signalement des contenus illicites","description":"La plateforme officielle du ministère de l'Intérieur pour signaler les contenus illégaux rencontrés en modération.","kind":"link","url":"https://www.internet-signalement.gouv.fr"},{"title":"Meta Business Suite","description":"L'outil gratuit de Meta pour modérer commentaires et messages Facebook et Instagram depuis une seule interface.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '2e37c79a-1aad-42d0-8633-355c68188a4c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '75e61b3b-c755-4efd-91a7-07f87cbb1721'::uuid, m.id, m.course_id, m.org_id, 'commentaires-negatifs-et-crise', $sq$Répondre aux commentaires négatifs et gérer une crise$sq$, $sq$Tu apprends à qualifier chaque commentaire négatif — mécontent réel, troll ou début de crise — puis à appliquer la grille de réponse propre à chaque cas. La leçon déroule le protocole de crise en six gestes, illustré par un incident de livraison chez un e-commerçant à 300 colis perdus.$sq$, $sq$## L'accroche

Un commentaire négatif ne prévient pas. Tu ouvres l'inbox un mardi matin et tu tombes dessus : « Commande passée le 3, on est le 21, toujours rien. Votre SAV ne répond pas. Fuyez cette marque. » Douze likes. Trois personnes ont ajouté leur propre histoire en dessous, et une quatrième tague une amie journaliste.

Ton premier réflexe sera mauvais. Supprimer ? L'auteur fera une capture et la publiera ailleurs, avec la preuve que la marque censure. Répondre sèchement que le SAV fait de son mieux ? Tu viens de te donner douze personnes de plus à convaincre. Ne rien faire en attendant les ordres ? Le fil grossit de trois commentaires par heure.

Il existe une grille simple pour ne plus jamais improviser : qualifier d'abord — mécontent réel, troll ou début de crise — puis appliquer le protocole du cas. C'est mécanique, ça s'apprend en vingt minutes, et c'est ce qu'on fait maintenant.

## Le contenu

### Qualifier avant de répondre

Tout part d'un tri en trois catégories, et le tri prend trente secondes.

Le mécontent réel a un problème concret : une commande, une date, un numéro. Il veut une solution, pas ta peau. Même agressif, même en majuscules, c'est un client — et un client qui s'exprime publiquement au lieu de partir en silence, ce qui est une chance.

Le troll n'a pas de problème à résoudre. Aucun achat vérifiable, un compte récent ou vide, des provocations générales — « de toute façon cette marque a toujours été nulle » — et il revient sous chaque réponse. Son but est ta réaction, pas une solution.

La crise, ce n'est pas un commentaire, c'est une dynamique. Trois signaux : le volume — plus de dix commentaires négatifs sur le même sujet en moins de deux heures là où la page en reçoit deux par jour, quand la charte fait déjà escalader à cinq ; la propagation — partages, stories, un compte extérieur qui s'en empare ; et la sortie de la plateforme — un journaliste, un forum, un article. Deux signaux sur trois : tu déclenches le protocole de crise.

### Répondre au mécontent : quatre temps

Un, accuse réception vite et en public, sous quatre heures ouvrées. Pas encore de solution, juste : vous êtes entendu.

Deux, personnalise. Prénom, reprise du problème précis. Quinze réponses identiques copiées-collées se voient et disent « robot ».

Trois, bascule en privé, mais annonce-le en public : « Je vous envoie un message privé pour récupérer votre numéro de commande. » Le numéro de commande, l'adresse, le montant du remboursement : rien de tout ça en public. Mais la bascule doit se voir, sinon le fil donne l'impression que la marque a fui.

Quatre, boucle en public une fois le problème résolu, sous le commentaire initial : « C'est réglé, le colis arrive jeudi. » C'est cette dernière réponse que les 200 prochains visiteurs liront.

Et une règle de plafond : jamais plus de deux réponses publiques dans le même fil. Au-delà, tout continue en privé. Un ping-pong public de six messages, tu le perds toujours, même en ayant raison.

### Le troll : une réponse, pour les autres

Tu ne réponds pas au troll, tu réponds devant lui. Une seule réponse, factuelle et calme, écrite pour les gens qui liront le fil : « Nos délais moyens sont de 4 jours ouvrés, et le SAV répond sous 24 h à l'adresse indiquée sur le site. » Puis plus rien. S'il insulte, tu masques — il ne le voit pas et s'épuise. S'il menace, capture d'écran et escalade. Ce que tu ne fais jamais : l'ironie. Tu la gagnes sur le moment et tu la paies en capture d'écran.

### La crise : six gestes dans l'ordre

Un, coupe les publications programmées. Un post produit tout sourire au milieu d'un incendie, c'est la capture d'écran parfaite.

Deux, appelle le client. Pas un mail : un appel. Vous décidez ensemble une seule chose : qui parle. Une voix unique — toi sur les réseaux, point. Un dirigeant qui répond en parallèle depuis son compte perso double les fronts.

Trois, publie une réponse d'attente sous deux heures : les faits reconnus — rien de plus que les faits —, ce qui est en cours, et l'heure du prochain point. Fixer l'heure du prochain point calme plus que n'importe quel argument.

Quatre, ouvre un journal de bord : heure, événement, capture, décision prise. C'est lui qui permettra le bilan, et il te protège si on te reproche un choix après coup.

Cinq, traite les cas individuels en privé, un par un, et épingle la réponse publique unique en tête de fil.

Six, une fois la vague retombée : bilan à froid avec le client, chiffres à l'appui, et mise à jour de la charte de modération — chaque crise révèle un cas d'escalade qui manquait.

Et connais ta limite : si la presse nationale appelle, si un avocat écrit, ce n'est plus du community management. Tu escalades vers le dirigeant, une agence RP ou un juriste, comme la charte le prévoit. Le dire n'est pas un aveu de faiblesse, c'est ton professionnalisme.

Dernier point : le temps de crise se facture. Si l'incendie vient du produit ou de la logistique du client, les heures au-delà du forfait partent au TJM — 350 à 550 € HT la journée — et cette clause se négocie à la signature du retainer, pas au milieu de la tempête.

## Exemple appliqué

Une marque de décoration en ligne, 60 000 abonnés Instagram, que tu gères en accompagnement complet à 1 800 € HT par mois. Le 14 décembre, son transporteur perd un lot de 300 colis. Des commandes de Noël.

9 h 30 : quatre commentaires sous le dernier post. 11 h : quatorze, plus une story d'une cliente suivie par 25 000 personnes. Deux signaux sur trois — volume et propagation — tu déclenches le protocole.

11 h 15, tu appelles la fondatrice : elle confirme les 300 colis, vous décidez que toi seul réponds. 11 h 30, six posts programmés coupés. 13 h, réponse d'attente publiée et épinglée : « 300 commandes sont bloquées chez notre transporteur. Nous écrivons à chaque client concerné d'ici ce soir. Prochain point demain 10 h. Les commandes passées avant le 20 seront livrées avant Noël ou remboursées. » Rien de plus que les faits, et une échéance.

Ensuite, 78 messages privés en 48 h, traités avec une trame courte et le numéro de commande vérifié un par un. Un point public par jour pendant trois jours, à 10 h, comme annoncé. Le 18, un post transparent raconte l'incident, et un code de 15 % — validé par la fondatrice, pas décidé par toi — part aux 300 clients touchés.

Bilan : 9 demandes de remboursement sur 300 commandes, aucun article de presse, un solde d'abonnés positif sur la semaine. Quatorze heures de travail au-delà du forfait, soit deux jours pleins facturés 800 € HT au TJM de 400 €, comme le contrat le prévoyait. La fondatrice a resigné pour un an le mois suivant — pas malgré la crise, à cause de sa gestion.

## Les erreurs fréquentes

Supprimer un commentaire légitime. C'est l'erreur la plus chère : l'auteur republie sa capture avec « ils censurent », et une réclamation devient un scandale. On ne supprime que l'illégal ; le reste se traite ou se masque selon la charte.

Répondre à chaud. Tu lis « voleurs », tu tapes ta réponse, tu l'envoies : elle est trop sèche, et tout le monde la lit. Écris-la, attends dix minutes, relis, envoie. Aucun commentaire n'exige une réponse en moins de dix minutes.

Copier-coller la même réponse partout. Quinze « Nous sommes désolés pour la gêne occasionnée » identiques aggravent la colère : personne ne se sent lu. Trente secondes de personnalisation par réponse changent tout.

Laisser tourner les publications programmées pendant une crise. Le post lifestyle qui sort à 18 h au milieu de 40 commentaires furieux devient le symbole de l'indifférence de la marque. Couper la programmation est le geste numéro un, avant même de répondre.

Promettre un geste commercial sans mandat. « On vous rembourse » ou « -20 % pour vous » n'est pas ta décision : c'est l'argent du client. Toute promesse chiffrée se valide avant publication, même en pleine tempête — surtout en pleine tempête.

## Action immédiate

Prends ton client principal et écris ses cinq réponses types : retard ou problème de livraison, produit décevant, prix contesté, critique du service, et la réponse unique au troll. Trois à quatre lignes chacune, dans le ton de sa charte, avec la phrase de bascule en privé. Envoie-les au client pour validation écrite. Quarante-cinq minutes de travail, et le prochain commentaire agressif trouvera une réponse prête au lieu d'un moment de panique.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Cinq réponses types aux négatifs","description":"Modèles de réponses à valider avec chaque client : retard de livraison, produit décevant, prix contesté, critique du service et réponse unique au troll.","kind":"template","url":null},{"title":"Protocole de crise en six gestes","description":"Checklist chronologique à dérouler dès que deux signaux de crise sur trois sont réunis : coupure des publications, appel client, réponse d'attente, journal de bord, traitement privé, bilan.","kind":"checklist","url":null},{"title":"Journal de bord de crise","description":"Tableau horodaté à quatre colonnes — heure, événement, capture, décision — qui trace la gestion de l'incident et sert de base au bilan à froid.","kind":"template","url":null},{"title":"Google Alerts","description":"Service gratuit d'alertes par mots-clés pour détecter quand un incident sort des réseaux sociaux et atteint le web ou la presse.","kind":"tool","url":"https://www.google.com/alerts"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '2e37c79a-1aad-42d0-8633-355c68188a4c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'fc069b7c-a8c4-4161-a72a-b514c7676af4'::uuid, m.id, m.course_id, m.org_id, 'inbox-multi-clients', $sq$Organiser une inbox de modération multi-clients$sq$, $sq$Tu montes un système de modération multi-clients : centralisation par Meta Business Suite, tableau de suivi unique, trois relevés quotidiens à heures fixes et ordre de priorité constant qui commence par les demandes d'achat. Tu apprends aussi à mesurer ce travail et à le montrer dans le reporting mensuel pour justifier le retainer.$sq$, $sq$## L'accroche

Claire, freelance à Angers, quatre clients. Huit boîtes de réception : quatre comptes Instagram, trois pages Facebook, un LinkedIn. Un lundi matin, elle ouvre par acquit de conscience la messagerie d'un client et trouve un message privé vieux de cinq jours : une demande de devis, précise, avec un budget. Le prospect n'a jamais eu de réponse. Il a commandé ailleurs.

Le problème de Claire n'est pas le volume. Quatre-vingts messages par semaine tous clients confondus, c'est seize par jour ouvré — une heure et demie de travail réel. Son problème, c'est la dispersion : huit boîtes, huit applications, zéro vue d'ensemble, et la peur permanente d'avoir raté quelque chose. Alors elle vérifie tout, tout le temps, entre deux tâches — et elle rate quand même.

La modération multi-clients ne se gagne pas en répondant plus vite. Elle se gagne avec un système : un point d'entrée par client, une liste unique, des créneaux fixes, un ordre de priorité constant. C'est ce système qu'on monte dans cette leçon.

## Le contenu

### Centraliser : de huit boîtes à cinq, puis à une liste

Premier geste, mécanique : pour chaque client présent sur Meta, ouvre la boîte de réception de Meta Business Suite. Elle regroupe commentaires Facebook, commentaires Instagram et messages privés des deux réseaux dans une seule interface, avec des statuts. Quatre clients, quatre boîtes Meta au lieu de sept ; seul le LinkedIn du quatrième reste à part, soit cinq points d'entrée au lieu de huit — et l'accès passe par un rôle nominatif dans le Business Manager du client, jamais par des identifiants partagés.

Deuxième geste : une liste unique pour toi, tous clients confondus. Un tableau — Notion ou Sheets suffisent — avec sept colonnes : client, canal, auteur, type de demande, reçu le, échéance, statut. Trois statuts, pas plus : à traiter, en attente du client, traité. N'y entre que ce qui demande une action différée : le compliment auquel tu réponds en dix secondes n'a rien à faire dans un tableau. La question technique escaladée au client, si — c'est précisément elle qu'on oublie.

### La routine à heures fixes

Le poison du community management, c'est le fil de l'eau : répondre à chaque notification quand elle tombe. Seize interruptions par jour détruisent tes plages de production — et tes posts, tes stratégies, tes reportings sont ce qui paie vraiment.

À la place, trois créneaux fixes : 9 h, 13 h, 17 h. Vingt à trente minutes chacun. À chaque créneau, tu balaies les clients dans le même ordre, toujours : boîte Business Suite, réponses immédiates, tableau pour le reste. En dehors des créneaux, notifications coupées.

Trois relevés par jour ouvré, c'est au maximum quatre heures entre deux passages : tu peux donc t'engager par écrit sur les 4 h ouvrées de la charte et les tenir sans y penser. C'est la mécanique de la leçon sur la charte : le délai promis découle du rythme de relevé, jamais l'inverse.

Reste la vraie urgence. Elle ne passe pas par les notifications : elle passe par un accord avec chaque client — « si ça déborde, appelle-moi ». Un emballement de crise se repère à l'œil nu par le client lui-même ; tout le reste attend le prochain créneau.

### Prioriser dans chaque relevé

Dans chaque créneau, l'ordre de traitement ne change jamais. Un : les questions d'achat et demandes de devis — c'est l'argent du client, et après 24 h le prospect a souvent acheté ailleurs. Deux : les réclamations — elles s'aggravent en vieillissant. Trois : les questions générales. Quatre : mentions et compliments — un like ou un merci. Cinq : le ménage — spam et masquages.

L'ordre inverse est tentant, parce que le spam et les compliments sont faciles. Mais traiter le facile d'abord, c'est laisser mûrir exactement les messages qui coûtent de l'argent.

### Prouver le travail

La modération est invisible : quand tout va bien, le client ne voit rien. Mesure deux chiffres par client et par mois : le volume traité et le temps de réponse médian. Ils sortent de ton tableau en cinq minutes, et ils entrent dans le reporting mensuel commenté — le D de SPEED. « 112 messages traités, réponse médiane 2 h 40, deux demandes de revendeurs transmises » : une ligne, et le retainer ne se discute plus. Ce que tu ne montres pas n'existe pas.

### Cadrer le périmètre et la frontière

Dans le contrat, la modération se décrit en une phrase précise : « modération des commentaires et messages privés, deux réseaux, trois relevés par jour ouvré, réponse sous 4 h ouvrées aux demandes d'achat et sous 24 h ouvrées au reste, du lundi au vendredi 9 h - 18 h ». C'est inclus dans un retainer starter à 800 - 1 500 € HT par mois. Ce qui sort du périmètre — week-ends, volume triplé pendant une campagne, SAV complet — fait l'objet d'un avenant, pas d'un effort silencieux.

Et une règle d'attribution : une boîte, un propriétaire. Toi en premier niveau, le client en second sur escalade. S'il répond aussi, au hasard de ses connexions, vous doublonnez et vous vous contredisez. Fixe la règle dès le départ : celui qui répond, c'est toi, et lui n'intervient que sur les fils que tu lui transmets.

## Exemple appliqué

Parmi les quatre clients de Claire, une brasserie artisanale près d'Angers. Deux réseaux, Instagram et Facebook, un retainer à 900 € HT par mois, environ vingt-cinq messages par semaine : où acheter les bières, horaires des visites de la brasserie, disponibilité d'une cuvée — et, noyées dans le reste, des demandes de professionnels.

Avant le système, Claire répondait au fil de l'eau. C'est chez ce client que le message du prospect a dormi cinq jours : une demande de tarifs revendeurs envoyée par un caviste, le type de message qui vaut des années de commandes, perdue entre deux questions sur les horaires.

Elle a monté le système en une matinée. Business Suite configuré avec un accès par rôle. Tableau unique à sept colonnes. Réponses types pour les huit questions récurrentes, validées avec le brasseur : les points de vente, les créneaux de visite, le lien de la boutique en ligne. Une règle d'escalade : toute demande de professionnel — caviste, bar, restaurant — part au brasseur le jour même, avec le contact en copie, et Claire relance si le brasseur n'a pas répondu sous 48 h.

Trois mois plus tard, les chiffres du reporting : réponse médiane passée de 26 h à 2 h 40 ; deux demandes de revendeurs traitées le jour même, devenues deux nouveaux points de vente ; temps de modération réel : 2 h 30 par semaine, contre 4 h éparpillées avant. Le brasseur voit chaque mois la ligne modération de son reporting. Quand il a demandé si le tarif pouvait baisser, Claire a montré la ligne : 112 messages traités, deux revendeurs signés. La discussion a duré trente secondes.

## Les erreurs fréquentes

Répondre au fil de l'eau. Chaque notification traitée sur-le-champ te coûte le quart d'heure de concentration qui suit. Seize messages traités en continu mangent une journée ; les mêmes en trois créneaux prennent une heure et demie.

Ne rien promettre par écrit. Sans délai contractualisé, le client suppose l'instantané, et chaque réponse en quatre heures devient un reproche implicite. Le délai écrit te protège plus qu'il ne te contraint.

Laisser deux personnes répondre à la même boîte. Le client répond dimanche soir à un message que tu traites lundi matin, avec une autre version. Le prospect reçoit deux réponses contradictoires. Une boîte, un propriétaire, une règle d'escalade.

Travailler sans laisser de trace. Si tes 112 messages mensuels n'apparaissent nulle part, la modération pèse zéro dans la valeur perçue du retainer — et c'est la première ligne que le client voudra couper. Deux chiffres dans le reporting suffisent.

Utiliser des identifiants partagés. Le mot de passe du compte Instagram du client dans ton gestionnaire, c'est une faute de sécurité et un piège de fin de contrat : personne ne sait plus qui a accès à quoi. Toujours des rôles nominatifs via le Business Manager.

## Action immédiate

Monte le socle du système, maintenant. Un : ouvre Meta Business Suite pour chacun de tes clients et vérifie que tu y accèdes par un rôle nominatif — sinon, demande l'invitation aujourd'hui. Deux : crée ton tableau à sept colonnes — client, canal, auteur, type, reçu le, échéance, statut. Trois : pose trois créneaux récurrents dans ton agenda dès demain, 9 h, 13 h, 17 h, et coupe les notifications des applications sociales sur ton téléphone. Quarante-cinq minutes, et demain à 9 h 30 tu sauras qu'aucun message n'attend nulle part.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Tableau de modération multi-clients","description":"Modèle de tableau à sept colonnes — client, canal, auteur, type, reçu le, échéance, statut — avec les trois statuts et l'ordre de priorité de traitement.","kind":"template","url":null},{"title":"Routine de relevé à heures fixes","description":"Checklist des trois créneaux quotidiens : ordre de balayage des clients, priorités dans chaque relevé, règles de coupure des notifications et cas d'interruption autorisés.","kind":"checklist","url":null},{"title":"Meta Business Suite","description":"La boîte de réception unifiée qui regroupe commentaires et messages Facebook et Instagram d'une page, avec accès par rôles nominatifs.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '2e37c79a-1aad-42d0-8633-355c68188a4c'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'cb2c7e8f-b09a-4927-91cd-2a0740d0a9ae'::uuid, c.id, c.org_id, 'mesure-reporting', $sq$Mesure et reporting$sq$, $sq$Ce module t'apprend à choisir les métriques qui déclenchent des décisions, à construire un reporting mensuel que ton client lit en cinq minutes, et à mener la réunion qui fait durer le retainer. Il se termine par l'automatisation de la collecte pour sortir du copier-coller sans jamais automatiser l'analyse.$sq$, 11, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '5fd2bc62-9630-42e2-bda8-419c3273ad5b'::uuid, m.id, m.course_id, m.org_id, 'metriques-par-plateforme', $sq$Les métriques qui comptent par plateforme$sq$, $sq$Pour Instagram, Facebook, LinkedIn, TikTok et la publicité, tu retiens trois ou quatre métriques capables de déclencher une décision, et tu écartes les likes bruts, les impressions et le total d'abonnés. La leçon démonte aussi les deux pièges de calcul qui faussent les reportings : la moyenne de taux ligne à ligne et la portée additionnée jour par jour.$sq$, $sq$## L'accroche

« On en est à combien de likes ce mois-ci ? » C'est la question que ton client te pose. Et c'est la mauvaise question. Mais si tu n'as rien de mieux à lui proposer, c'est celle qui restera. Tu ouvres Meta Business Suite : quarante colonnes, des impressions, des vues, trois définitions différentes de la portée. Tu passes deux heures à tout recopier dans un tableau, et à la fin tu es incapable de dire si le mois était bon. Ton client non plus. Résultat : il juge ton travail sur le seul chiffre qu'il comprend, le nombre d'abonnés. Le jour où ce chiffre stagne, ton contrat est en danger, même si les ventes ont progressé. Le problème n'est pas que tu manques de données. C'est que tu n'as pas décidé lesquelles comptent. Dans cette leçon, on fait le tri réseau par réseau : trois ou quatre métriques par plateforme, pas une de plus, et les deux pièges de calcul qui faussent la majorité des reportings que je vois passer.

## Le contenu

On est dans l'étape D de la méthode SPEED : les Données. La règle de départ tient en une phrase : une métrique mérite ta feuille de calcul uniquement si elle peut déclencher une décision. Si un chiffre monte ou descend et que tu ne changerais rien dans les deux cas, il ne sert à rien. Applique ce filtre et 80 % des colonnes disparaissent.

### Instagram : quatre métriques

Un : le taux d'engagement, c'est-à-dire les interactions divisées par la portée. Pas par le nombre d'abonnés — un compte qui a accumulé 40 000 abonnés dormants en 2019 verrait son taux écrasé, alors que ses contenus actuels performent. Entre 3 et 6 % sur la portée, tu es dans une bonne zone pour un compte de marque. Deux : la portée, le nombre de personnes uniques touchées sur la période. C'est elle qui dit si tes contenus sortent du cercle des abonnés. Trois : les abonnés nets, gagnés moins perdus. Le total brut cache les départs ; 400 gagnés et 380 perdus, ce n'est pas la même histoire que 25 gagnés et 5 perdus. Quatre : les clics vers le site ou les visites de profil, seulement si l'objectif du client est le trafic ou la vente. À ignorer : les likes bruts et les impressions. Les impressions comptent les affichages, pas les personnes — la même personne qui voit trois fois ton reel compte trois fois.

### Facebook : trois métriques

La portée des publications, les clics sortants, les interactions. C'est tout. Le nombre total de fans de la page ne veut plus rien dire : sur la plupart des pages, une publication organique touche moins de 5 % d'entre eux. Une page à 30 000 fans qui touche 900 personnes par post, c'est la norme, pas une panne.

### LinkedIn : quatre métriques

Les impressions, le taux d'engagement, les clics, et les republications. Sur LinkedIn, une republication vaut plus qu'un like : c'est de la portée gratuite sur un réseau où la portée organique se mérite, et c'est un signal fort qu'un contenu sert la crédibilité de ton client. À ignorer : les vues de la page entreprise, qui ne bougent presque jamais.

### TikTok et Reels : trois métriques

Le taux de complétion ou la durée moyenne de visionnage, les vues, les partages. Sur du format vidéo court, la complétion est la métrique reine : une vidéo de 20 secondes regardée en moyenne 6 secondes plafonne à 30 % de complétion, et ça se joue dans les trois premières secondes, pas à la fin. Les likes, ici encore, ne pilotent rien.

### La publicité Meta et Google : quatre métriques

Le coût par acquisition ou coût par lead, c'est le chiffre que le client comprend et retient. Le ROAS si le client vend en ligne : chiffre d'affaires attribué divisé par la dépense. Le CTR comme signal de qualité créative : sous 0,8 % sur Meta, ta créa fatigue. Le CPM comme signal de marché : s'il double, ce n'est pas ta faute, c'est l'enchère qui se tend — en novembre-décembre, c'est mécanique.

### Les deux pièges de calcul

Premier piège : la moyenne de taux. Ton post A touche 10 000 personnes et génère 300 interactions : 3 %. Ton post B touche 500 personnes et en génère 50 : 10 %. La moyenne des deux taux donne 6,5 %. Le vrai taux du mois, c'est 350 interactions sur 10 500 personnes : 3,3 %. Presque deux fois moins. La moyenne de taux donne à un petit post le même poids qu'à un gros. Règle absolue : on additionne les grandeurs brutes, et on recalcule le ratio sur les totaux.

Deuxième piège : la portée additionnée. La portée mesure des personnes uniques. Additionner la portée de 30 jours compte la même personne jusqu'à 30 fois. Les plateformes elles-mêmes fournissent une portée mensuelle dédupliquée, différente de la somme des portées quotidiennes. Utilise la valeur de la période, pas la somme des jours — et dis-le au client une fois pour toutes, ça t'évitera la question « pourquoi ça ne colle pas avec le total ».

Dernier réflexe : ne compare jamais un taux d'engagement Instagram à un taux LinkedIn. Les définitions et les usages diffèrent ; chaque réseau se compare à lui-même, mois après mois.

## Exemple appliqué

Prenons une marque e-commerce lifestyle : bougies et objets déco vendus en ligne, panier moyen 45 €, 24 000 abonnés Instagram, une page Facebook secondaire, 1 200 € de budget Meta Ads par mois. Sur les quarante métriques disponibles, tu en retiens six. Instagram : taux d'engagement sur portée, portée mensuelle, clics sortants. Facebook : portée seulement, le réseau est secondaire. Ads : coût par achat et ROAS. Le mois de mars donne : 26 publications, portée 92 000, taux d'engagement 4,2 %, 640 clics sortants, 38 achats attribués aux ads pour 1 200 € dépensés — soit 31,58 € le CPA, et 1 710 € de chiffre d'affaires au panier moyen, donc un ROAS de 1,43. Lecture immédiate : l'organique est sain, mais un ROAS de 1,43 sur un panier de 45 € ne couvre pas la marge. Décision déclenchée : couper les deux audiences froides les plus chères, tester un catalogue en retargeting. Sans le filtre, tu aurais présenté quarante chiffres et aucune décision. Avec six métriques, la réunion mensuelle dure vingt minutes et débouche sur un arbitrage budgétaire. C'est exactement ce qu'on te paie.

## Les erreurs fréquentes

Suivre les abonnés comme métrique principale. C'est un stock, pas un résultat : il peut monter pendant que tout le reste s'effondre. Garde les abonnés nets en indicateur secondaire, jamais en tête de reporting.

Moyenner des taux ligne à ligne. On vient de le voir : 6,5 % affiché pour 3,3 % réel. Le jour où le client recalcule, tu perds ta crédibilité sur tous les autres chiffres.

Changer de métriques chaque mois. Si tu mets en avant l'engagement en mars, la portée en avril et les clics en mai, le client comprend que tu choisis le chiffre qui t'arrange. Le jeu de métriques se fige au premier reporting et ne bouge qu'avec l'objectif.

Recopier le tableau de bord natif. Meta Business Suite n'est pas un reporting, c'est un entrepôt. Exporter quarante colonnes, c'est transférer le travail de tri au client — qui te paie précisément pour ne pas le faire.

Ignorer le contexte. Une portée en baisse de 15 % en août n'est pas une alerte, c'est l'été. Un CPM qui monte en décembre, c'est la saison des enchères. Une métrique sans son contexte fait prendre de mauvaises décisions.

## Action immédiate

Prends ton client principal. Ouvre une feuille, une ligne par réseau. Pour chaque réseau, écris les trois ou quatre métriques que tu retiens, leur définition exacte — engagement sur portée, pas sur abonnés — et, en face de chacune, la décision qu'elle peut déclencher si elle monte ou si elle baisse. Si tu ne trouves pas de décision, raye la métrique. En trente minutes, tu as le socle de tous tes prochains reportings, et la réponse à donner la prochaine fois qu'on te demande « on en est à combien de likes ».$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Checklist des métriques par plateforme","description":"La liste des trois ou quatre métriques à suivre par réseau, avec leur définition exacte, la décision qu'elles peuvent déclencher et les métriques à ignorer.","kind":"checklist","url":null},{"title":"Modèle de tableau de suivi mensuel","description":"Une feuille de calcul prête à remplir : une ligne par métrique retenue, les grandeurs brutes additives, et les ratios recalculés sur les totaux pour éviter la moyenne de taux.","kind":"template","url":null},{"title":"Meta Business Suite","description":"L'interface native où lire et exporter les statistiques Facebook et Instagram de tes clients.","kind":"tool","url":"https://business.facebook.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'cb2c7e8f-b09a-4927-91cd-2a0740d0a9ae'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f756440d-f632-4532-b639-59f60b834a08'::uuid, m.id, m.course_id, m.org_id, 'reporting-mensuel', $sq$Construire un reporting mensuel que le client comprend$sq$, $sq$Tu construis un reporting en quatre blocs — synthèse chiffrée avec variations, détail par réseau, top et flop des contenus avec hypothèses, décisions pour le mois suivant — qui répond aux trois questions du client : que s'est-il passé, est-ce bien, que fait-on. Tu retires les vignettes de posts, le jargon et les graphiques décoratifs, car ce que le client paie, c'est le commentaire qu'il ne pourrait pas écrire lui-même.$sq$, $sq$## L'accroche

Claire, freelance social media à Angers, envoyait chaque mois à ses quatre clients un reporting de 34 pages, exporté automatiquement d'un outil : un graphique par métrique, tous les posts en vignettes, des camemberts de répartition par heure de publication. Un jour, en réunion, sa cliente lui dit : « C'est très complet. Mais concrètement, le mois était bon ou pas ? » Claire s'est rendu compte que personne n'ouvrait le document. Pire : son reporting parlait à elle, pas au client. Trente-quatre pages qui ne répondaient pas à la seule question qui compte. Le reporting mensuel commenté, c'est le livrable qui fait durer le retainer — c'est lui qui, chaque mois, redémontre ta valeur. Mal fait, il produit l'effet inverse : il noie ce que tu as accompli sous des chiffres que personne ne lit. Dans cette leçon, on construit la structure d'un reporting que ton client lit en cinq minutes, comprend seul, et qui débouche sur des décisions. Quatre blocs, pas un de plus.

## Le contenu

Un bon reporting répond à trois questions, dans cet ordre : qu'est-ce qui s'est passé ? Est-ce bien ou pas ? Qu'est-ce qu'on fait maintenant ? Tout ce qui ne sert pas une de ces trois questions sort du document. C'est le cœur de l'étape D de SPEED : les données ne valent que par les arbitrages qu'elles déclenchent.

### Bloc 1 : la synthèse

Une seule page, celle que le client lira même s'il ne lit rien d'autre. Quatre à six chiffres clés — ceux que tu as choisis dans la leçon précédente — chacun avec sa variation par rapport au mois précédent, et par rapport au même mois de l'année d'avant quand la saisonnalité joue. Un chiffre seul ne dit rien : « portée 92 000 » n'apprend rien, « portée 92 000, +18 % vs février » dit tout. Sous les chiffres, trois à cinq phrases de commentaire : le fait marquant du mois, la cause principale, la tendance. Pas plus.

### Bloc 2 : le détail par réseau

Une demi-page par réseau, avec les trois ou quatre métriques retenues et leur variation, plus deux phrases de lecture par réseau. Si un réseau est secondaire dans le dispositif du client, une ligne suffit. Résiste à la tentation d'égaliser : donner la même place à Facebook qu'à Instagram quand 90 % des résultats viennent d'Instagram, c'est mentir sur la hiérarchie.

### Bloc 3 : les contenus

Le top 3 des publications du mois et le flop le plus instructif, avec pour chacun une hypothèse sur le pourquoi. « Ce reel a fait 4 fois la portée moyenne : format tutoriel, hook en 2 secondes, sujet de saison. » C'est ce bloc qui nourrit l'étape Expression : les enseignements du mois deviennent les choix éditoriaux du suivant. Un top sans hypothèse n'est qu'un palmarès ; l'hypothèse est ce qui rend le bloc utile.

### Bloc 4 : les décisions

Deux ou trois actions pour le mois suivant, chacune reliée à un chiffre du reporting. « Le format tutoriel surperforme : on passe de 1 à 3 tutoriels par mois. » « Le CPA a monté de 24 % : on coupe l'audience X et on teste Y. » C'est le bloc qui transforme un compte rendu en pilotage — et c'est celui que la plupart des freelances oublient.

### Ce qu'on retire

Les vignettes de toutes les publications : le client les a vues passer, elles gonflent le document sans rien apprendre. Les métriques sans décision possible. Les graphiques décoratifs — un camembert de répartition hommes-femmes qui ne bouge jamais n'a rien à faire dans un document mensuel. Et le jargon : tu écris « personnes touchées », pas « reach » ; « coût par client acquis », pas « CPA » — ou alors tu définis le terme une fois, en première page, et tu t'y tiens.

### Le commentaire, c'est lui qu'on paie

Ton client peut avoir tous les chiffres gratuitement dans Meta Business Suite. Ce qu'il t'achète, c'est la lecture : le lien entre un chiffre et une cause, entre une cause et une action. Règle simple : chaque page doit contenir au moins une phrase que le client serait incapable d'écrire lui-même. Si une page n'en contient pas, elle est en trop.

### Le rythme et le format

Un PDF de 4 à 6 pages ou un lien vers un tableau de bord, envoyé à date fixe — le 5 du mois par exemple — et toujours avant la réunion, jamais découvert en séance. Même structure chaque mois : le client apprend à le lire, et toi tu gagnes du temps. Le premier reporting d'un client te prendra trois heures ; à partir du troisième, avec la trame posée, compte une heure. Sur un retainer starter à 1 000 € par mois, c'est un ratio sain.

## Exemple appliqué

Prenons une assurance mutualiste B2C, régionale, dont l'objectif social media est la génération de demandes de devis santé. Page 1, quatre chiffres : 42 demandes de devis (+27 % vs mars), coût par demande 18,40 € (−12 %), portée totale 210 000 personnes (+9 %), taux d'engagement 2,8 % (stable). Commentaire : « Sur 772,80 € de budget média, la campagne témoignages adhérents a produit 26 des 42 demandes, à un coût inférieur de 30 % à la campagne produit. La portée organique progresse grâce aux deux vidéos pédagogiques sur le 100 % santé. » Page 2 : détail Facebook et Instagram — Facebook domine, c'est là que vit la cible 45-65 ans, et le reporting l'assume au lieu de gonfler Instagram. Page 3 : top 3 des contenus, dont le témoignage d'une adhérente de Cholet, 3 fois la portée moyenne, hypothèse : incarnation locale plutôt que discours produit. Page 4, deux décisions : réallouer 250 € de la campagne produit vers les témoignages, et produire deux témoignages supplémentaires en mai. La cliente lit cinq minutes, valide les deux décisions en réunion. Le document fait cinq pages. L'ancien en faisait vingt et ne déclenchait rien.

## Les erreurs fréquentes

Le reporting-catalogue. Tout montrer pour prouver qu'on a travaillé. Effet obtenu : le client ne lit plus, et ta valeur devient invisible. La preuve de ton travail, c'est la décision éclairée, pas l'épaisseur du PDF.

L'absence de comparaison. Un tableau de chiffres bruts sans variation force le client à se souvenir du mois dernier — il ne s'en souvient pas. Chaque chiffre porte sa variation, et en dessous de 5 % d'écart tu écris « stable » plutôt que de faire commenter du bruit.

Le jargon non traduit. CTR, CPM, reach, impressions : ton client hoche la tête en réunion et décroche en silence. Un terme technique non compris est un terme qui travaille contre toi.

Envoyer les chiffres sans commentaire. « Les chiffres parlent d'eux-mêmes » — non. Des chiffres sans lecture, c'est un transfert de travail vers le client, et une invitation à se demander à quoi tu sers.

Changer la structure chaque mois. Si le document se réinvente à chaque envoi, le client repart de zéro à chaque lecture, et il soupçonne — à raison — que tu mets en avant ce qui t'arrange. La trame se fige, seuls les chiffres et les commentaires changent.

## Action immédiate

Reprends ton dernier reporting envoyé. Passe chaque élément au filtre des trois questions : qu'est-ce qui s'est passé, est-ce bien, qu'est-ce qu'on fait. Supprime tout ce qui ne répond à aucune des trois. Puis réécris ta page 1 : quatre à six chiffres avec leur variation, et cinq phrases de commentaire maximum, dont au moins une que ton client ne pourrait pas écrire lui-même. Quarante-cinq minutes, et tu tiens la trame de tous tes prochains mois.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Trame de reporting mensuel en quatre blocs","description":"Le modèle de document de 4 à 6 pages : page de synthèse à quatre ou six chiffres avec variations, détail par réseau, contenus commentés, décisions du mois suivant.","kind":"template","url":null},{"title":"Checklist avant envoi du reporting","description":"Les vérifications à faire avant chaque envoi : variations présentes sur chaque chiffre, jargon traduit, au moins une phrase de lecture par page, deux à trois décisions reliées à des chiffres.","kind":"checklist","url":null},{"title":"Looker Studio","description":"L'outil gratuit de Google pour transformer ta trame de reporting en tableau de bord partageable avec le client.","kind":"tool","url":"https://lookerstudio.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'cb2c7e8f-b09a-4927-91cd-2a0740d0a9ae'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '22a799cf-83ed-4fcf-8b18-f59c0a2ac8a0'::uuid, m.id, m.course_id, m.org_id, 'presenter-les-resultats', $sq$Présenter les résultats et défendre ses recommandations$sq$, $sq$Tu mènes la réunion mensuelle en trente minutes et quatre temps — chiffres clés, ce qui a marché ou non, décisions en questions fermées, mois suivant — avec le reporting envoyé 48 heures avant. Tu apprends à annoncer un mauvais mois en donnant le chiffre d'abord, la cause prouvée, puis le plan, et à défendre chaque recommandation par un chiffre, un coût et un test réversible.$sq$, $sq$## L'accroche

C'est le 4 du mois. Le reporting est prêt depuis hier, mais tu ne l'as pas envoyé. Parce que ce mois-ci, les chiffres sont mauvais : la portée a chuté, les leads aussi, et tu redoutes la réunion. Alors tu retardes l'envoi, tu espères que le client ne relancera pas, tu prépares mentalement des excuses. Erreur complète. La réunion mensuelle est le moment où ton contrat se renouvelle ou meurt — pas à la date anniversaire, chaque mois. Un client ne résilie presque jamais à cause d'un mauvais mois ; il résilie parce qu'il a le sentiment que personne ne pilote. Et ce sentiment naît précisément dans ces réunions esquivées, ces chiffres enrobés, ces recommandations molles. Bien menée, la réunion mensuelle fait l'inverse : elle transforme même un mauvais mois en preuve que tu tiens la barre. Dans cette leçon, on voit comment la préparer, comment la dérouler en trente minutes, comment annoncer un mauvais chiffre sans te griller, et comment faire prendre des décisions au lieu de commenter le passé.

## Le contenu

### Avant la réunion : trois messages, pas un exposé

Envoie le reporting 48 heures avant, jamais en séance : un client qui découvre les chiffres en direct les subit au lieu de les discuter. Puis prépare trente minutes, avec une seule question : quels sont les trois messages que le client doit retenir ? Trois, pas dix. Par exemple : le format témoignage surperforme, le coût par lead remonte, il faut arbitrer le budget de mai. Tout le reste de la réunion sert ces trois messages. Prépare aussi les décisions que tu veux obtenir, formulées en questions fermées : « Est-ce qu'on valide 300 € de test sur l'audience X, oui ou non ? » Une question ouverte produit une discussion ; une question fermée produit une décision.

### L'ordre du jour en quatre temps, trente minutes

Premier temps, cinq minutes : les chiffres clés. Toi qui parles, page 1 du reporting, les trois messages annoncés d'entrée. Le client sait immédiatement où va la réunion.

Deuxième temps, dix minutes : ce qui a marché et ce qui n'a pas marché. Deux ou trois contenus, une ou deux campagnes, à chaque fois le chiffre, l'hypothèse, l'enseignement. C'est ici que tu montres ta lecture — la chose que le client te paie.

Troisième temps, dix minutes : les décisions. Chaque recommandation reliée à un chiffre vu dans les dix premières minutes, chiffrée en coût et en gain attendu, posée en question fermée. Tu notes chaque oui et chaque non.

Quatrième temps, cinq minutes : le mois suivant. Ce qui part en production, les dates, ce que tu attends du client — validations, accès, contenus à fournir. Une réunion qui finit sans que le client sache ce qu'il te doit produit du retard chez toi le mois d'après.

### Annoncer un mauvais mois

La règle : le chiffre d'abord, nu, dans la première minute. « La portée a baissé de 22 % ce mois-ci. » Pas d'enrobage, pas de « globalement c'est plutôt positif mais ». Un mauvais chiffre enterré en page 12 sera découvert, et sa découverte détruira la confiance sur tous les autres chiffres. Ensuite, la cause, factuelle. Il y en a trois familles : le marché ou la plateforme — un CPM qui monte pour tout le monde, une baisse d'audience saisonnière ; le contenu — un format qui fatigue, un mois moins produit ; le budget ou le dispositif — moins de posts, une campagne coupée. Nomme la bonne, avec la preuve. Enfin, le plan : ce que tu changes dès maintenant, avec une échéance. « Je bascule les trois prochains posts en format natif, on mesure au prochain reporting. » Ne t'excuse jamais d'un chiffre — tu n'as pas à t'excuser d'une mesure, tu as à y répondre. Et n'accuse jamais l'algorithme sans preuve : c'est l'excuse que tous les mauvais prestataires utilisent, ton client l'a déjà entendue.

Retiens ça : un mauvais mois annoncé par toi renforce ta crédibilité. Un mauvais mois découvert par le client la détruit.

### Défendre une recommandation

Trois appuis. Un : le chiffre d'origine — la recommandation découle d'une mesure, pas d'une envie. Deux : le chiffrage — coût, gain attendu, délai. « 300 € sur trois semaines, objectif : repasser sous 20 € le lead. » Trois : la réversibilité — propose un test borné plutôt qu'un engagement : on essaie, on mesure, on tranche au prochain reporting. Un client dit rarement non à un test réversible et chiffré. Et quand il dit non quand même : tu actes le refus par écrit dans le compte rendu, sans insister. Si le problème persiste le mois suivant, le chiffre plaidera pour toi.

### Après la réunion

Le jour même, un e-mail de cinq lignes : les décisions actées, qui fait quoi, pour quand. C'est ta protection — « on avait dit que » ne se discute plus — et c'est le signal d'un pilotage tenu. Deux minutes d'écriture, des heures de malentendus évitées.

## Exemple appliqué

Prenons un cas transport premium B2B : une société de chauffeurs privés pour dirigeants, clientèle d'assistantes de direction et de directions générales, LinkedIn en réseau principal, objectif leads entrants. Le mois est mauvais : 4 demandes de devis contre 11 le mois précédent. En préparant, tu trouves la cause : 8 posts sur 10 contenaient un lien sortant vers le site, et leur portée moyenne est tombée à 1 900 contre 6 400 pour les posts natifs du mois d'avant. Réunion : tu ouvres sur le chiffre — « 4 leads contre 11, moins 64 % ». Puis la cause, preuve à l'appui : le tableau des portées posts natifs contre posts à lien. Puis le plan : 100 % de posts natifs en mai, le lien en commentaire, et deux carrousels étude de cas. Enfin la décision demandée, fermée : « Je propose 500 € de sponsorisation sur le carrousel du cas client aéroport, pour toucher les assistantes de direction des ETI de la région. On valide ? » Le client valide. Deux mois plus tard : 14 leads. Ce client est resté deux ans — pas parce qu'il n'y a jamais eu de mauvais mois, mais parce que le premier mauvais mois a été annoncé, expliqué et traité en une réunion.

## Les erreurs fréquentes

Lire le reporting à voix haute. Le client sait lire ; il l'a reçu 48 heures avant. Une réunion qui paraphrase le document n'apporte rien et donne envie de l'annuler — puis de se demander à quoi sert le retainer.

Enterrer le mauvais chiffre. Le glisser en fin de document, l'entourer de bonnes nouvelles, espérer qu'il passe. Il ne passe pas. Et le jour où le client le repère seul, chaque reporting suivant sera relu avec suspicion.

Recommander sans chiffrer. « Il faudrait faire plus de vidéo » n'est pas une recommandation, c'est une opinion. Sans coût, sans objectif chiffré, sans échéance, le client ne peut ni valider ni refuser — donc il ne décide rien.

Repartir sans décision. Une réunion de pur commentaire, où tout le monde acquiesce et rien ne change, transforme ton reporting en rituel décoratif. Chaque réunion doit produire au moins un oui ou un non explicite.

Laisser le client dérouler. Sans ordre du jour tenu, la réunion part sur le post que le dirigeant n'a pas aimé, et tes trois messages ne sont jamais passés. C'est toi qui mènes : c'est ta réunion, c'est ton métier.

## Action immédiate

Prends ta prochaine réunion mensuelle, même si elle est dans trois semaines. Écris sa trame maintenant : les trois messages à faire retenir, le mauvais chiffre du mois s'il y en a un — avec sa cause et ton plan en trois phrases — et deux décisions à faire prendre, formulées en questions fermées avec un montant et une échéance. Trente minutes de préparation. Tu viens de transformer un compte rendu en réunion de pilotage.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Ordre du jour type de la réunion mensuelle","description":"La trame de trente minutes en quatre temps, avec les trois messages à préparer, les décisions à formuler en questions fermées et le modèle d'e-mail de compte rendu en cinq lignes.","kind":"template","url":null},{"title":"Checklist pour annoncer un mauvais mois","description":"La séquence chiffre nu, cause factuelle parmi les trois familles (marché, contenu, dispositif), plan daté — et les deux interdits : s'excuser d'une mesure et accuser l'algorithme sans preuve.","kind":"checklist","url":null},{"title":"Grille de chiffrage d'une recommandation","description":"Le format en trois appuis pour chaque recommandation : le chiffre d'origine, le coût et le gain attendu avec échéance, la version test réversible à proposer.","kind":"template","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'cb2c7e8f-b09a-4927-91cd-2a0740d0a9ae'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'd381f946-c6d6-4fb2-bbb4-f90eb44bbacb'::uuid, m.id, m.course_id, m.org_id, 'automatiser-la-collecte', $sq$Automatiser la collecte de données$sq$, $sq$Tu passes de quatre heures de copier-coller mensuel à des tableaux qui se remplissent seuls, en trois niveaux : exports CSV vers un tableur structuré, connecteurs payants vers Looker Studio, puis un modèle de tableau de bord par client alimenté en continu. Tu automatises d'abord ton plus gros retainer et les données publicitaires, tu vérifies tout chiffre aberrant avant envoi, et tu n'automatises jamais le commentaire.$sq$, $sq$## L'accroche

Le premier lundi du mois, tu connais la routine. Quatre clients, deux ou trois réseaux chacun : une douzaine d'exports à ouvrir, des CSV à retraiter, des chiffres à recopier un par un dans tes tableaux. Quatre heures de copier-coller, parfois plus quand Meta a encore changé un nom de colonne. Quatre heures que tu ne factures pas, sur la partie la moins intéressante de ton métier. Et le vrai risque n'est même pas le temps perdu : c'est l'erreur de saisie. Un 9 200 recopié en 92 000, et tu présentes un chiffre faux en réunion — le genre d'erreur qui coûte plus cher que toutes les heures économisées. À quatre clients, la collecte manuelle passe encore. À six clients, l'objectif d'un freelance installé, elle craque. Cette leçon te sort du copier-coller : les trois niveaux d'automatisation, ce que ça coûte, ce que ça rapporte, quoi automatiser en premier — et la seule chose qu'il ne faut jamais automatiser.

## Le contenu

Le principe directeur, d'abord : on automatise la collecte, jamais la lecture. Le commentaire, les hypothèses, les décisions — ce que le client te paie réellement, on l'a vu dans la leçon sur le reporting — restent humains. L'automatisation sert à déplacer ton temps de la saisie vers l'analyse, pas à supprimer l'analyse. C'est l'outillage de l'étape D de SPEED : des données fiables, disponibles sans effort, pour que l'énergie aille aux arbitrages.

### Niveau 1 : des exports natifs vers un tableau propre

Coût : zéro. Le geste : un Google Sheets par client, un onglet par mois, exactement les mêmes colonnes chaque mois — les trois ou quatre métriques par réseau que tu as choisies, pas quarante. Meta Business Suite, LinkedIn et TikTok exportent tous en CSV ; tu importes, tu ne ressaisis rien à la main. Ce niveau ne supprime pas les exports, mais il supprime la ressaisie — la source d'erreurs — et il te force à une structure stable. Gain réaliste : une heure par mois, et des historiques propres qui te serviront au niveau suivant.

### Niveau 2 : les connecteurs

Le geste : un tableau de bord Looker Studio — l'outil de Google, gratuit — branché sur tes sources. Les connecteurs Google sont natifs et gratuits : Google Analytics 4, Google Ads, Google Sheets. Pour Meta, Instagram, LinkedIn ou TikTok, il faut un connecteur tiers payant : Supermetrics, Porter Metrics, Metricool et d'autres. Compte entre 15 et 100 € par mois selon l'outil et le nombre de comptes — vérifie les tarifs au moment de choisir, ils bougent. Le calcul de rentabilité est simple : à un TJM de 400 €, ton heure vaut environ 57 €. Si un connecteur à 30 € par mois t'économise trois heures, il te rapporte 141 € nets par mois : 171 € de temps récupéré moins 30 € d'abonnement. Et ce coût d'outillage se prévoit dans tes prix : c'est une des raisons pour lesquelles un retainer se vend 800 à 1 500 €, pas 400.

### Niveau 3 : le tableau qui se remplit seul

Le geste : un modèle de tableau de bord par client, construit une fois, alimenté en continu par les connecteurs, avec des données à la veille. Ton reporting mensuel devient : ouvrir le tableau, vérifier les chiffres, écrire les commentaires et les décisions. La collecte a disparu de ta charge. Compte une journée de construction pour le premier modèle, puis deux heures d'adaptation par client suivant — tu dupliques, tu rebranches les sources. Résultat : un reporting qui prenait deux heures trente en prend quarante-cinq minutes, dont quarante d'analyse. Bonus commercial réel : tu peux donner au client un lien de consultation permanent. « Vos chiffres à jour tous les matins » est un argument qui différencie, à condition que le commentaire mensuel reste au rendez-vous.

### Quoi automatiser en premier

Pas tout, pas partout. Dans l'ordre : d'abord ton plus gros retainer — c'est là que la collecte est la plus lourde et la relation la plus précieuse. Ensuite les données publicitaires : la dépense tourne tous les jours, c'est là qu'une erreur ou un retard de détection coûte de l'argent réel — un CPA qui dérape se voit à J+1 sur un tableau automatisé, à J+30 sur une collecte manuelle. Enfin les métriques organiques mensuelles de tes autres clients. Et ce qu'on n'automatise pas : le client one-shot qui part dans deux mois, le réseau secondaire qui pèse 5 % des résultats. Une heure d'automatisation doit s'amortir sur des mois de récurrence.

### Le garde-fou : vérifier avant d'envoyer

Un connecteur, ça casse. Un jeton d'accès expire, une API change, et la case affiche zéro — pas une erreur, un zéro. Un zéro faux est pire qu'une case vide : il ressemble à une mesure. Règle : avant chaque envoi de reporting, tout chiffre aberrant — un zéro inattendu, une variation de plus de 50 % — se vérifie à la source, dans l'interface native. Deux minutes de contrôle, et tu ne présenteras jamais un chiffre de panne comme un chiffre de performance.

## Exemple appliqué

Prenons un cas artisan/produit : une savonnerie artisanale, retainer starter à 900 € par mois, Instagram et Facebook, dix posts mensuels. La collecte manuelle prenait deux heures trente chaque mois : exports Meta, retraitement, mise en forme, plus le reporting lui-même. La gérante ne regardait les chiffres qu'en réunion. Mise en place en une journée : un Looker Studio branché sur un connecteur tiers à une vingtaine d'euros par mois — absorbé dans le retainer, le calcul tient largement — avec la page 1 du reporting reproduite à l'identique : portée, taux d'engagement sur portée, clics vers la boutique, abonnés nets, chaque chiffre avec sa variation. Résultat au mois suivant : quarante-cinq minutes de travail au lieu de deux heures trente, dont quarante d'analyse et de commentaire. Effet inattendu : la gérante consulte le lien chaque semaine, arrive en réunion en ayant déjà vu les chiffres, et la réunion passe entièrement sur les décisions — le mois d'après, elle a validé sans discuter le passage à douze posts. Sur un an, c'est vingt et une heures récupérées sur un seul client, réinvesties dans le travail visible.

## Les erreurs fréquentes

Automatiser le commentaire. Envoyer un lien de tableau de bord brut à la place du reporting commenté. Le client regarde des courbes qu'il ne sait pas lire, conclut que « l'outil fait le travail », et ton retainer devient une ligne de coût à questionner. Le tableau collecte ; toi, tu expliques.

Construire une usine à gaz. Quatre clients ne justifient pas un pipeline avec scripts, base de données et automatisations en cascade que toi seul sais réparer — et qui casse un dimanche. Un tableur propre puis Looker Studio couvrent tes besoins jusqu'à six clients. La sophistication technique n'est pas le but ; le temps récupéré, si.

Faire confiance aveugle au connecteur. Jeton expiré, API modifiée, compte débranché : le tableau affiche des zéros ou s'arrête de se remplir, et personne ne le voit avant la réunion. Le contrôle des chiffres aberrants avant envoi n'est pas optionnel.

Payer sans compter. Trois outils qui se recouvrent, des abonnements par client jamais répercutés : à 80 € par mois d'outillage non pensé, tu rends un dixième d'un retainer starter à 800 €. Un seul outil, choisi pour couvrir tes réseaux, coût connu et intégré dans tes prix.

Automatiser avant d'avoir choisi. Brancher quarante métriques « pour les avoir » reproduit en automatique le reporting-catalogue qu'on a démonté dans ce module. D'abord le tri de la leçon sur les métriques, ensuite seulement l'automatisation. On automatise un choix, pas un entrepôt.

## Action immédiate

Ouvre le tableau de ton dernier reporting. Liste chaque chiffre que tu as recopié à la main : sa source, le temps que sa collecte t'a pris. Entoure les trois plus coûteux en temps — ce sont tes premiers candidats. Puis ouvre lookerstudio.google.com avec ton compte Google, crée un rapport vierge et branche une première source gratuite : un Google Sheets avec tes historiques, ou Google Analytics si ton client l'utilise. Tu n'auras pas tout automatisé en une heure, mais tu auras le point de départ — et la liste exacte de ce qu'il te reste à brancher.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Looker Studio","description":"L'outil gratuit de Google pour construire des tableaux de bord alimentés par connecteurs, avec GA4, Google Ads et Google Sheets en sources natives gratuites.","kind":"tool","url":"https://lookerstudio.google.com"},{"title":"Metricool","description":"Un outil de reporting social media avec connecteurs Meta, Instagram, LinkedIn et TikTok, une des options payantes pour alimenter Looker Studio.","kind":"tool","url":"https://metricool.com"},{"title":"Checklist : quoi automatiser en premier","description":"L'ordre de priorité — plus gros retainer, données publicitaires, organique mensuel — avec les cas à ne pas automatiser et le contrôle des chiffres aberrants avant chaque envoi.","kind":"checklist","url":null},{"title":"Inventaire de ta collecte manuelle","description":"Un tableau à remplir en une heure : chaque chiffre recopié à la main, sa source, le temps de collecte, pour identifier les trois premiers candidats à l'automatisation.","kind":"template","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'cb2c7e8f-b09a-4927-91cd-2a0740d0a9ae'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'dcc59f43-1bdd-4b45-89ee-86eafc01b361'::uuid, c.id, c.org_id, 'outils-ia-automatisation', $sq$Outils, IA et automatisation$sq$, $sq$La stack minimale qui suffit vraiment à un freelance social media, et ce qu'on n'achète pas la première année. Puis l'usage juste de l'IA — là où elle accélère sans diluer la voix d'une marque — et le seuil à partir duquel une automatisation se rembourse.$sq$, 12, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'b3ac451c-ba10-4986-b06c-444befe79f03'::uuid, m.id, m.course_id, m.org_id, 'stack-outils-minimale', $sq$La stack outils minimale d'un freelance social media$sq$, $sq$Les huit outils qui couvrent réellement le travail, avec leur coût mensuel ligne par ligne — entre 29 et 54 € en vitesse de croisière. Et la liste de ce qu'on n'achète pas la première année, avec les trois signaux qui font passer au payant.$sq$, $sq$## L'accroche

Tu viens de te lancer, et ton premier réflexe, c'est de t'équiper. Hootsuite, 99 € par mois. La suite Adobe, 67 €. Un outil de veille, 41 €. Un CRM, 29 €. Avant d'avoir signé ton premier client, tu portes déjà 236 € de charges fixes mensuelles. À un TJM de 400 €, c'est plus d'une demi-journée de travail qui part chaque mois dans des outils que tu utilises à 10 % de leurs capacités. J'ai vu des freelances arrêter au sixième mois, pas faute de clients, mais parce que leurs charges mangeaient une marge qui n'existait pas encore. La réalité, c'est qu'un freelance social media rentable tourne avec 6 à 8 outils, pour moins de 80 € par mois — et souvent moins de 50. Dans cette leçon, je te donne la liste exacte, ligne par ligne, le coût réel, et surtout ce que tu n'achètes pas la première année.

## Le contenu

### La règle avant la liste

Un outil s'achète quand une tâche récurrente te coûte plus cher en temps qu'il ne coûte en argent. Pas avant. Concrètement : tu commences toujours par la version gratuite, et tu passes en payant le jour où tu touches une limite qui te fait perdre du temps facturable. Cette règle élimine 80 % des achats impulsifs.

Deuxième règle : chaque outil doit être rattachable à un des quatre livrables qui font ton chiffre d'affaires — la stratégie, l'accompagnement éditorial, la gestion publicitaire, le reporting. Un outil que tu ne peux relier à aucun livrable facturé est un jouet.

### Les 8 outils, ligne par ligne

**1. Meta Business Suite — 0 €.** Programmation des posts Facebook et Instagram, boîte de réception des commentaires et messages, statistiques de base. C'est l'outil officiel de Meta, il est gratuit, et il couvre à lui seul la moitié du travail d'exécution — le second E de SPEED. Beaucoup de freelances paient un outil tiers pour faire ce que Business Suite fait déjà.

**2. Un programmateur multi-réseaux — 0 € au départ, 15 à 20 € par mois ensuite.** Metricool ou Buffer. Tu en as besoin le jour où tu gères LinkedIn ou TikTok en plus de Meta, pas avant. Le plan gratuit de Metricool tient largement pour un ou deux clients.

**3. Canva Pro — environ 12 € par mois.** Le seul abonnement que je te conseille dès le premier client. Le kit de marque par client — couleurs, typos, logos —, le redimensionnement automatique d'un visuel en trois formats, la bibliothèque de templates. Tu gagnes une à deux heures par semaine dès dix posts par mois.

**4. CapCut — 0 €.** Montage des Reels et TikTok. La version gratuite suffit toute la première année : sous-titres automatiques, découpes, transitions sobres.

**5. Google Workspace — environ 7 € par mois.** Une adresse en prenom@tondomaine.fr, Drive pour les livrables et les validations, Docs pour les stratégies. Une adresse Gmail nue en prospection te coûte des points de crédibilité face à un dirigeant qui s'apprête à te confier 1 200 € par mois.

**6. Notion — 0 €.** Base clients, process, bibliothèque d'idées, suivi de prospection. Le plan gratuit suffit tant que tu travailles seul. C'est ton CRM, ton wiki et ton planning en un seul endroit.

**7. Un outil de facturation — 10 à 15 € par mois.** Indy, Freebe ou Abby. Devis, factures conformes, relances automatiques, préparation des déclarations URSSAF. Le jour où une facture de 1 500 € part avec une mention légale manquante, tu comprends pourquoi ce poste n'est pas optionnel.

**8. Bitwarden — 0 €.** Gestionnaire de mots de passe. Tu vas manipuler les accès de tes clients : comptes publicitaires, pages, parfois des boîtes mail. Les stocker dans un fichier texte ou les échanger par WhatsApp est une faute professionnelle, pas une négligence.

Fais l'addition : entre 29 et 54 € par mois en vitesse de croisière, et 19 € les six premiers mois — Canva Pro et Google Workspace seuls, plans gratuits partout ailleurs.

### Ce que tu n'achètes pas la première année

**Un outil de reporting automatisé.** Souvent plus de 100 € par mois. En dessous de quatre clients, un export manuel des statistiques et un modèle de rapport bien construit font le travail en 45 minutes par client. Tu automatiseras quand le reporting te coûtera plus de trois heures par mois, soit à partir de quatre clients.

**Un outil de social listening.** Conçu pour des marques nationales qui surveillent leur réputation. Aucun de tes clients à 800 ou 1 500 € par mois n'en a l'usage.

**La suite Adobe complète.** Canva et CapCut couvrent 95 % des besoins d'un feed. Tu factureras un motion designer en sous-traitance le jour où un client voudra plus.

**Un CRM payant.** À 100 prospects dans ton pipe — soit ta prospection d'un trimestre entier —, un tableau Notion à cinq colonnes suffit : contact, statut, dernier échange, prochaine action, montant potentiel.

**Une suite de programmation entreprise.** Hootsuite, Sprout Social, les plans agence d'Agorapulse : pensés pour des équipes de cinq personnes, et tarifés pour des équipes de cinq personnes.

### Quand passer au payant

Trois signaux, et un seul suffit. Un : tu gères trois réseaux ou plus hors Meta pour au moins deux clients — passe sur un programmateur payant. Deux : ton reporting mensuel dépasse trois heures cumulées — commence à chiffrer un outil dédié, en le comparant à ton taux horaire. Trois : tu refuses un client parce qu'un outil gratuit te bloque — la limite te coûte déjà plus cher que l'abonnement.

## Exemple appliqué

Prenons une savonnerie artisanale à Lyon, ton client type artisan-produit. Retainer starter à 950 € HT par mois : Instagram et Facebook, 10 posts mensuels dont 4 Reels, reporting commenté inclus.

Voici la stack réellement mobilisée. La programmation des 10 posts passe par Meta Business Suite : 0 €. Les visuels sont produits dans Canva Pro avec le kit de marque de la savonnerie — beige, vert olive, typo serif —, ce qui garantit que même un post fait en 20 minutes reste dans la charte : 12 €. Les 4 Reels de démonstration — découpe du savon, coulée, emballage — sont montés dans CapCut avec sous-titres automatiques : 0 €. Les visuels partent en validation dans un dossier Drive partagé où la cliente commente directement : inclus dans les 7 € de Workspace. Le planning du mois vit dans Notion : 0 €. La facture part d'Indy le 1er du mois, avec relance automatique à J+15 : 12 €.

Coût d'outils imputable à ce client : environ 31 € par mois, soit 3 % du retainer. Temps d'exécution mensuel : environ deux jours. Le jour où la savonnerie veut ouvrir TikTok, tu ajoutes Metricool à 18 € — et tu factures l'extension du périmètre en passant le retainer à 1 200 €. L'outil suit le revenu, jamais l'inverse.

## Les erreurs fréquentes

**S'équiper avant de signer.** Les charges fixes avant le chiffre d'affaires, c'est le sens interdit. Tant que tu n'as pas deux clients, ta stack doit tenir sous 30 € par mois.

**Prendre l'abonnement annuel tout de suite.** Sur un abonnement à 15 € par mois, le rabais de 20 % te fait économiser 36 € sur l'année et t'enferme douze mois sur un outil que tu n'as pas éprouvé. Deux mois en mensuel d'abord, l'annuel ensuite si l'outil a survécu.

**Empiler des outils qui font la même chose.** Buffer plus Metricool plus Later, c'est trois abonnements pour une seule fonction. Un outil par fonction, une fonction par outil.

**Mélanger perso et pro.** Gmail perso pour les clients, mots de passe partagés par SMS, visuels stockés dans la pellicule du téléphone. Le jour où tu perds ton téléphone ou qu'un client part fâché, tu mesures le coût réel de ce désordre.

**Ne jamais réviser sa stack.** Un audit tous les six mois : tout outil non ouvert depuis 30 jours est résilié. Les abonnements fantômes coûtent facilement 200 à 400 € par an à un indépendant qui ne regarde pas ses relevés.

## Action immédiate

Ouvre un tableau, Notion ou Sheets, quatre colonnes : outil, coût mensuel, date de dernière utilisation réelle, livrable facturé auquel il sert. Remplis-le pour tout ce que tu paies aujourd'hui, abonnements perso inclus s'ils servent au travail. Toute ligne sans livrable en face ou sans usage depuis 30 jours : résiliation immédiate, pas à la fin du mois. Puis compare ton total à la stack de cette leçon : si tu dépasses 80 € par mois avec moins de quatre clients, tu sais quoi couper. Trente minutes, montre en main, et c'est souvent 50 à 100 € de marge mensuelle récupérée.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Tableau d'audit de stack","description":"Quatre colonnes — outil, coût mensuel, dernière utilisation réelle, livrable facturé auquel il sert — à rejouer tous les six mois pour résilier les abonnements fantômes.","kind":"template","url":null},{"title":"Meta Business Suite","description":"Programmation, boîte de réception et statistiques Facebook et Instagram, gratuitement : la moitié du travail d'exécution sans abonnement tiers.","kind":"tool","url":"https://business.facebook.com"},{"title":"Checklist « avant d'acheter un outil »","description":"Les deux règles à passer avant tout abonnement : la tâche coûte plus en temps que l'outil en argent, et l'outil se rattache à un des quatre livrables facturés.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'dcc59f43-1bdd-4b45-89ee-86eafc01b361'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '829c32ef-bbcd-428e-9300-75a76db19735'::uuid, m.id, m.course_id, m.org_id, 'ia-sans-generique', $sq$Utiliser l'IA sans produire du contenu générique$sq$, $sq$Où l'IA entre dans la chaîne de production — recherche, déclinaisons, briefs — et où elle n'entre jamais, parce qu'un client paie pour une voix qu'on reconnaît. La méthode du document de voix, qui transforme un modèle générique en assistant calé sur la marque.$sq$, $sq$## L'accroche

Ouvre LinkedIn et lis dix posts. Tu vas en reconnaître la moitié au premier coup d'œil : « Dans un monde en constante évolution », trois paragraphes parfaitement équilibrés, une chute en forme de question ouverte. Du contenu écrit par IA, publié tel quel. Le problème n'est pas moral, il est commercial : ton client te paie entre 800 et 3 000 € par mois pour une voix qu'on reconnaît, et le contenu généré sans travail produit exactement l'inverse — la moyenne statistique de tout ce qui existe déjà. Mais refuser l'IA en bloc est tout aussi coûteux : ton concurrent produit ses déclinaisons deux fois plus vite que toi, à qualité égale. La bonne question n'est donc pas « avec ou sans IA ». C'est : à quel endroit précis de ta chaîne de production l'IA entre, et à quel endroit elle n'entre jamais. C'est exactement ce qu'on découpe dans cette leçon.

## Le contenu

### Le principe : l'IA avant et après, jamais sur l'écriture

Ta chaîne de production a cinq maillons : recherche, angle, structure, écriture, relecture. L'IA est bonne sur les trois premiers et sur le dernier — chercher, proposer des angles, structurer, vérifier la cohérence — et médiocre sur le quatrième, l'écriture, là où vit la voix. Retiens la formule : l'IA propose, tu tranches, tu signes. Tout ce qui part chez le client ou en publication porte ta réécriture.

### Où l'IA te fait vraiment gagner du temps

**La recherche et l'audit — le S de SPEED.** Colle 80 avis Google d'un client et demande les dix irritants les plus cités : tu obtiens en dix minutes une matière que deux heures de lecture t'auraient donnée. Même chose pour synthétiser les questions récurrentes d'un service client, résumer les tendances d'un secteur ou préparer un benchmark de cinq concurrents.

**Les déclinaisons.** C'est l'usage le plus rentable. Un post pilier validé se décline en version story en trois écrans, version courte pour Facebook, angle témoignage pour LinkedIn. L'idée et la voix sont déjà validées ; l'IA ne fait que reformater. Gain typique : 30 à 40 minutes par post pilier.

**Les briefs.** Brief créa pour un graphiste, trame de questions pour interviewer le dirigeant, brief vidéo pour un tournage. Ce sont des documents fonctionnels, sans voix de marque, où l'exhaustivité compte plus que le style.

**Les angles.** Demande dix angles sur un sujet, garde-en deux, jette les huit autres. L'IA est un générateur de volume ; ton métier, c'est de sélectionner.

**Les textes utilitaires.** Réponses aux questions récurrentes en modération, descriptions, résumés. Du fonctionnel, pas de la signature.

### Où l'IA te nuit

**Les accroches.** Les huit premiers mots décident si on s'arrête ou si on scrolle. L'IA produit par construction des formulations moyennes — et une accroche moyenne est une accroche invisible. L'accroche s'écrit à la main, toujours.

**La voix finale.** Même rythme ternaire, mêmes retournements « Ce n'est pas X, c'est Y », mêmes conclusions ouvertes. Publie ça pendant trois mois et le compte de ton client ressemble à tous les autres — c'est littéralement la définition du contenu générique.

**Les chiffres et les faits.** L'IA invente avec aplomb. Un pourcentage faux dans un post, c'est embarrassant ; dans un secteur régulé comme l'assurance ou la finance, c'est un risque juridique pour ton client — et pour ton contrat.

**Le contexte fin.** L'IA ne sait pas que le dirigeant déteste tel mot, que le concurrent direct a eu un bad buzz le mois dernier, qu'une promesse est interdite par le régulateur du secteur. Ce contexte, c'est toi qui le portes.

### La méthode pour garder une voix reconnaissable

**Un : le document de voix.** Une page par client, quatre blocs : les dix posts qui ont le mieux fonctionné, copiés en entier ; vingt mots et expressions maison ; dix mots interdits ; trois règles de rythme — longueur des phrases, tutoiement ou vouvoiement, usage des questions. Tu colles ce document en tête de chaque session de travail avec l'IA. Sans lui, tu obtiens la moyenne d'internet ; avec lui, tu obtiens une proposition déjà à 70 % dans la voix.

**Deux : la règle du dernier kilomètre.** Quelle que soit la qualité du jet, tu réécris l'accroche et la chute à la main. Ce sont les deux endroits que l'œil lit vraiment.

**Trois : le test de l'aveugle.** Masque le nom du compte et relis le post. Si on ne peut pas deviner de quelle marque il vient, il n'est pas prêt.

**Quatre : la vérification des faits.** Tout chiffre est retrouvé à sa source avant publication. Pas de source, pas de chiffre — la règle vaut pour l'IA comme pour toi.

## Exemple appliqué

Une mutuelle santé régionale, client type assurance B2C. Accompagnement complet à 2 200 € HT par mois, pilier éditorial principal : la pédagogie prévention. Secteur régulé : chaque promesse chiffrée doit être sourcée, et le service conformité du client relit tout.

Le workflow, de bout en bout. En audit, tu récupères 120 questions reçues par le service adhérents sur un trimestre. L'IA les regroupe en quinze thèmes récurrents — remboursement des lunettes, délais de carence, téléconsultation — que tu valides avec le client comme réservoir de sujets pour six mois.

Le document de voix tient sur une page : on dit « adhérent », jamais « client » ; vouvoiement ; phrases courtes ; interdits absolus — « révolutionnaire », « opportunité unique », et toute promesse de remboursement non sourcée.

Production du post « remboursement des lunettes » : l'IA propose dix angles, tu retiens « les trois questions à se poser avant de changer de monture ». Elle structure le carrousel en cinq écrans. Toi, tu réécris l'accroche à la main — « Votre monture a plus de deux ans ? Lisez ceci avant de repasser en caisse » —, tu vérifies les montants du 100 % santé sur le site officiel de l'Assurance Maladie, et le post part en validation conformité.

Résultat mesuré sur trois mois : temps de production par post passé de 1 h 30 à 50 minutes, dix-huit posts produits au lieu de dix pour les mêmes quinze heures, taux d'engagement stable à 4,1 % — la voix n'a pas bougé, et c'est tout l'enjeu. Et zéro retour de la conformité sur un chiffre, parce qu'aucun chiffre n'est sorti d'une génération.

## Les erreurs fréquentes

**Publier le premier jet.** Même bon, il est moyen — c'est sa nature statistique. Le premier jet est un matériau, pas un livrable.

**Prompter sans contexte.** Demander « écris un post sur la prévention santé » sans positionnement, sans persona, sans exemples validés, c'est commander la moyenne d'internet et s'étonner de la recevoir.

**Laisser passer un chiffre inventé.** Une seule statistique fausse publiée sous le nom de ton client peut te coûter le contrat. La vérification des sources n'est pas négociable.

**Décliner un post faible.** L'IA amplifie, elle ne sauve pas. Dix variantes d'une idée médiocre font dix posts médiocres. On ne décline que ce qui a déjà fait ses preuves.

**Cacher l'usage de l'IA au client.** Le jour où il s'en aperçoit — et il s'en apercevra —, c'est la confiance entière qui saute, pas seulement le sujet IA. Dis-le simplement : l'IA accélère la recherche et les déclinaisons, la voix et la validation restent humaines. Aucun client sérieux ne refuse ça.

## Action immédiate

Construis le document de voix de ton meilleur client, maintenant. Ouvre un doc, quatre blocs : ses dix posts les plus performants collés en entier, vingt expressions maison relevées dedans, dix mots interdits, trois règles de rythme. Une page maximum. Puis teste-le : prends un post validé du mois dernier, colle le document en contexte, demande une déclinaison en story de trois écrans, et compare avec ce que tu obtiens sans le document. L'écart que tu vas voir, c'est exactement la différence entre l'IA qui dilue une marque et l'IA qui la sert. Quarante-cinq minutes, et ce document resservira chaque semaine.$sq$, 9, 'none'::academy_video_provider, $sq$[{"title":"Document de voix de marque","description":"Une page par client : dix posts performants collés en entier, vingt expressions maison, dix mots interdits, trois règles de rythme — le contexte à donner avant toute génération.","kind":"template","url":null},{"title":"Checklist anti-générique","description":"Les signaux qui trahissent un texte non retravaillé — tournures passe-partout, paragraphes trop réguliers, chute en question ouverte — à vérifier avant publication.","kind":"checklist","url":null},{"title":"Claude","description":"L'assistant utilisé dans la leçon pour les déclinaisons et les briefs, à nourrir du document de voix plutôt qu'à laisser écrire seul.","kind":"tool","url":"https://claude.ai"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'dcc59f43-1bdd-4b45-89ee-86eafc01b361'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '9ee3ca61-3603-4f0f-9175-36dffc363193'::uuid, m.id, m.course_id, m.org_id, 'automatiser-les-taches', $sq$Automatiser les tâches répétitives$sq$, $sq$Les quinze à vingt heures mensuelles de gestes non facturables qui empêchent de passer de quatre à six clients : publication, captures de statistiques, relances, classement. Comment les repérer, quoi automatiser en premier, et la formule qui dit si une automatisation se rembourse.$sq$, $sq$## L'accroche

Claire, freelance à Angers, quatre clients. Chaque matin à 9 h, elle publie à la main les posts du jour — même le samedi, même en vacances. Chaque début de mois, elle passe un vendredi entier à faire des captures d'écran de statistiques pour ses quatre reportings. Chaque planning part en validation, puis elle relance le client deux fois par WhatsApp. Mets tout ça bout à bout : entre 15 et 20 heures par mois de gestes répétitifs, non facturables, qui ne produisent aucune valeur visible. À quatre clients, ça passe en serrant les dents. Au cinquième, ça casse — et c'est précisément là que l'objectif de 5 000 à 8 000 € par mois avec quatre à six clients devient impossible. L'automatisation n'est pas un gadget de productivité : c'est la condition pour que ton plafond de clients monte sans que tes semaines explosent. Voyons quoi automatiser, avec quoi, et surtout à partir de quand ça vaut le coup.

## Le contenu

### La grille : trois critères pour identifier ce qui s'automatise

Une tâche s'automatise quand elle coche trois cases. **Répétitive** : le geste est identique à chaque fois. **Fréquente** : elle revient au moins chaque semaine, ou chaque mois multiplié par ton nombre de clients. **Sans jugement** : aucune décision fine à prendre en cours de route.

La publication programmée coche les trois. La collecte des statistiques aussi. Les relances de factures aussi. En revanche, répondre aux commentaires demande du jugement — un commentaire ambigu mal traité devient un bad buzz. La négociation, la création, le commentaire de reporting : jamais. Ce qui touche la relation ou l'interprétation reste humain.

### Les cinq chantiers, dans l'ordre de rentabilité

**Un : la publication.** Le plus gros gisement. Programmation native dans Meta Business Suite pour Facebook et Instagram, programmation native de LinkedIn, ou Metricool pour tout centraliser. Une session hebdomadaire de 45 minutes remplace 20 minutes de manipulation quotidienne : tu récupères six à huit heures par mois, et tes posts partent à l'heure optimale même quand tu es en rendez-vous.

**Deux : la collecte des données de reporting — le D de SPEED.** Le reporting commenté est le livrable qui fait durer tes contrats ; la collecte, elle, n'a aucune valeur. Looker Studio, gratuit, se branche nativement sur Google Ads et sur un Google Sheet où tu déposes tes exports sociaux : le rapport se pré-remplit, il ne te reste que le commentaire — la seule partie que le client paie vraiment.

**Trois : les relances de validation.** Un planning envoyé sans rappel revient validé au bout de trois relances manuelles. Un rappel automatique à J-3 et J-1 avant la date limite — email programmé ou automatisation depuis ton outil de gestion — ramène ça à un seul aller-retour.

**Quatre : les relances de factures.** Ton outil de facturation le fait déjà. Indy, Freebe et Abby savent relancer automatiquement à J+7 et J+15. C'est une case à cocher, littéralement, et c'est justement la relance que tu n'oses jamais envoyer toi-même.

**Cinq : l'onboarding.** Pas un logiciel : une standardisation. Checklist d'accès type, email de demande d'accès prérédigé, dossier Drive modèle dupliqué à chaque nouveau client. Un onboarding passe de trois heures dispersées à une heure cadrée.

### Les outils, du plus simple au plus puissant

Commence toujours par le natif : Meta Business Suite, la programmation LinkedIn, les relances de ton outil de facturation. Coût : zéro, maintenance : zéro. Ensuite, les modèles : un modèle de rapport, de brief ou d'email de relance est une automatisation sans logiciel — le gain vient de ne plus jamais repartir de zéro. Ensuite seulement, un connecteur type Make, autour de 9 € par mois, pour relier deux outils entre eux : « quand une ligne passe en Validé dans Notion, envoie-moi une notification ». Et Looker Studio pour le reporting. Un repère simple : si ton automatisation demande plus de cinq étapes pour être décrite, elle est trop complexe pour être ta première.

### Le seuil de rentabilité : la seule question qui compte

Une automatisation est un investissement, elle se calcule comme tel. La formule : temps gagné par mois multiplié par ton taux horaire, comparé au temps de mise en place plus le coût mensuel de l'outil. La règle simple : une automatisation doit se rembourser en moins de trois mois.

Exemple chiffré. La collecte de reporting te prend 45 minutes par client et par mois, sur quatre clients : trois heures. À un TJM de 420 €, ton heure vaut 60 € : le gain est de 180 € par mois. La mise en place de Looker Studio et des exports te coûte quatre heures, soit 240 €, et l'outil est gratuit. Remboursée en six semaines. Tu signes.

Contre-exemple. Trier automatiquement une boîte mail qui te prend dix minutes par mois : gain de 10 €, mise en place de trois heures. Dix-huit mois de remboursement. Tu ne signes pas. En dessous de quinze minutes gagnées par mois, on n'automatise pas — on ignore.

### Le garde-fou

Toute automatisation qui écrit vers l'extérieur — publication, email, message — garde soit une validation humaine avant envoi, soit un contrôle hebdomadaire de dix minutes : les posts sont-ils partis, les relances envoyées, y a-t-il des erreurs en file d'attente. Une publication qui échoue en silence pendant une semaine coûte plus cher que tout ce que l'automatisation a fait gagner.

## Exemple appliqué

Une société de transport premium B2B — chauffeurs pour dirigeants et délégations, clientèle grands comptes. Retainer à 1 800 € HT par mois : huit posts LinkedIn, gestion des campagnes Google Ads en forfait, reporting mensuel commenté.

Avant automatisation, le temps mécanique sur ce client : publication manuelle des huit posts, 20 minutes chacun en comptant la connexion et les vérifications, soit 2 h 40 ; reporting monté à la main — captures d'écran des statistiques LinkedIn et Google Ads recollées dans un document, puis rédaction du commentaire —, 2 h 45 ; validation du planning obtenue après trois relances d'un dirigeant injoignable par définition.

Trois automatisations posées en une journée. La programmation native LinkedIn : les huit posts partent d'une session unique de 40 minutes — deux heures récupérées. Looker Studio branché sur Google Ads, plus un export LinkedIn mensuel déposé dans un Sheet : le rapport arrive pré-rempli, il reste 45 minutes de commentaire — deux heures récupérées. Un rappel automatique de validation à J-3 et J-1 : le planning revient signé en un seul aller-retour.

Bilan : environ 4 h 30 gagnées par mois sur ce seul client, soit 270 € de temps au taux horaire, pour cinq heures de mise en place. Remboursée avant la fin du deuxième mois. Effet secondaire qui n'apparaît dans aucun calcul : le reporting part le 3 du mois au lieu du 12, et le client le remarque. La ponctualité perçue est un argument de renouvellement que tu n'as même pas eu à défendre.

## Les erreurs fréquentes

**Automatiser avant de standardiser.** Si ton process de reporting change chaque mois, l'automatiser produit du désordre plus vite. On fige le modèle d'abord, on branche ensuite.

**Construire l'usine à gaz.** Un scénario Make à quatorze modules que tu ne sais plus déboguer trois mois plus tard, c'est une dette, pas un gain. Le natif d'abord, le connecteur ensuite, et jamais plus de cinq étapes pour commencer.

**Automatiser la relation.** Messages de prospection LinkedIn entièrement automatisés — avec le risque de bannissement du compte en prime —, réponses automatiques aux commentaires, messages d'anniversaire générés. Le destinataire le sent, et ce qu'il retient, c'est que tu ne prends pas le temps.

**Ne jamais contrôler.** Une automatisation posée puis oubliée finit toujours par casser en silence : jeton expiré, format modifié, export vide. Dix minutes de contrôle chaque lundi, en revue fixe dans ton agenda.

**Compter le gain, jamais la maintenance.** Chaque automatisation coûte un peu de surveillance et de réparation. Si tu en poses dix, budgète une heure par mois pour les maintenir — et intègre-la au calcul de rentabilité.

## Action immédiate

Prends ton dernier mois et liste dix tâches de moins de 30 minutes que tu as répétées — publication, captures, relances, exports, classement de fichiers. Pour chacune, note sur trois points : répétitive, fréquente, sans jugement. Prends la mieux notée et applique la formule : temps gagné par mois multiplié par ton taux horaire, contre temps de mise en place plus coût de l'outil. Si elle se rembourse en moins de trois mois, pose-la aujourd'hui. Dans la plupart des cas, ce sera activer les relances automatiques de ton outil de facturation ou programmer ta semaine de posts en une session : vingt minutes de réglage, des heures récupérées dès ce mois-ci.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Grille de tri des tâches","description":"Noter chaque tâche répétée sur trois points — répétitive, fréquente, sans jugement — pour trouver celle qui mérite d'être automatisée en premier.","kind":"template","url":null},{"title":"Calcul du seuil de rentabilité","description":"Temps gagné par mois multiplié par le taux horaire, comparé au temps de mise en place plus le coût de l'outil : sous trois mois de retour, on pose l'automatisation.","kind":"checklist","url":null},{"title":"Make","description":"Plateforme d'automatisation sans code pour relier les outils entre eux — exports de statistiques, relances, classement de fichiers.","kind":"tool","url":"https://www.make.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'dcc59f43-1bdd-4b45-89ee-86eafc01b361'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '4112806f-8596-4b94-b80e-abf8553a9613'::uuid, c.id, c.org_id, 'gerer-son-activite', $sq$Gérer son activité$sq$, $sq$Ce module couvre la gestion de ton entreprise de freelance social media : structure juridique, facturation, trésorerie, organisation multi-clients, délégation et éventuel passage en agence. Tu en sors avec des règles chiffrées applicables dès cette semaine, du premier acompte encaissé jusqu'à la décision agence ou studio solo.$sq$, 13, true
from academy_courses c
where c.id = 'ce1b5f74-b9f9-4c07-81e3-b3d02c060313'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'e55e9398-9dd6-4729-a574-827877ce6359'::uuid, m.id, m.course_id, m.org_id, 'juridique-facturation-tresorerie', $sq$Structure juridique, facturation, trésorerie$sq$, $sq$Cette leçon compare micro-entreprise et société sur des chiffres concrets, détaille les seuils à surveiller (franchise de TVA à 37 500 €, plafond micro à 77 700 €) et liste les dix mentions obligatoires d'une facture conforme. Elle installe ensuite la mécanique de trésorerie : acompte de 40-50 % sur les one-shots, provision de 30 % sur chaque encaissement, salaire fixe mensuel et réserve de trois mois de charges.$sq$, $sq$## L'accroche

Tu as facturé 4 200 € HT le mois dernier. Bonne nouvelle. Mauvaise nouvelle : ce n'est pas ton argent. Là-dedans, il y a environ 1 100 € de cotisations sociales, ton impôt, et peut-être de la TVA que tu collectes pour l'État sans le savoir. Beaucoup de freelances découvrent ça au premier appel de l'URSSAF, douze mois après le lancement, avec un rappel de 6 000 € qu'ils ont déjà dépensés. D'autres se retrouvent à découvert un 15 du mois parce qu'un client paie à 60 jours et qu'aucun matelas n'existe. Ce ne sont pas des accidents. Ce sont les conséquences mécaniques de trois sujets que personne ne t'a appris : ta structure juridique, tes factures, ta trésorerie. Cette leçon les traite dans l'ordre. À la fin, tu sauras exactement combien tu peux te payer chaque mois, et pourquoi.

## Le contenu

### Micro-entreprise ou société : décide sur des chiffres, pas sur des on-dit

Démarre en micro-entreprise. C'est le bon choix pour 90 % des social media managers qui se lancent : création en ligne en vingt minutes, pas de comptable obligatoire, une déclaration de chiffre d'affaires chaque mois ou chaque trimestre sur autoentrepreneur.urssaf.fr, et c'est tout.

Ce que tu paies en micro, en prestations de services libérales : environ 26 % de cotisations sociales sur ton chiffre d'affaires encaissé en 2026, plus l'impôt sur le revenu. Si tu es éligible au versement libératoire, l'impôt se règle en même temps que les cotisations, à 2,2 % du CA. Retiens un ordre de grandeur simple : sur 100 € facturés, il t'en reste environ 70 avant tes frais.

Les seuils à surveiller, dans l'ordre où ils vont te concerner :

- **Le seuil de franchise de TVA.** Pour les prestations de services, il est à 37 500 € de CA annuel, avec un seuil majoré à 41 250 €. Tant que tu es en dessous, tu factures sans TVA. Au-dessus, tu factures 20 % de TVA en plus, tu la déclares, tu la reverses. Ce seuil a bougé plusieurs fois ces dernières années : vérifie le montant en vigueur sur urssaf.fr avant de t'en servir. Avec un retainer à 1 500 € par mois et deux one-shots dans l'année, tu le franchis. Anticipe-le, ne le subis pas.
- **Le plafond de la micro : 77 700 € de CA annuel** pour les prestations de services. Au-delà, tu sors du régime. À 5 000-6 000 € de CA mensuel, l'objectif d'un freelance installé, tu es à 60 000-72 000 € par an : tu t'en approches.

Quand passer en société (SASU ou EURL) ? Deux déclencheurs concrets. Premier : tu sous-traites. En micro, tu cotises sur ton CA, pas sur ta marge. Si tu factures 2 000 € et que tu paies 800 € à un monteur, tu paies quand même tes 26 % sur 2 000 €. La société, elle, déduit cette charge. Deuxième : tu dépasses durablement 5 500 € de CA mensuel. Fais alors une simulation avec un expert-comptable — compte 100 à 180 € par mois de comptabilité en société, c'est le prix de la déduction des charges.

### La facture : dix mentions, zéro improvisation

Une facture non conforme, c'est une amende possible et surtout un prétexte en or pour un client qui veut payer en retard. Chaque facture porte : ton nom et ton adresse, ton SIREN, l'identité complète du client, un numéro unique et séquentiel (2026-014, jamais deux fois le même, jamais de trou), la date d'émission, le détail des prestations avec leurs montants HT, la mention « TVA non applicable, article 293 B du CGI » tant que tu es en franchise, la date d'échéance, le taux des pénalités de retard, et l'indemnité forfaitaire de recouvrement de 40 €.

Ensuite, les règles qui protègent ta trésorerie. Pour un one-shot — une stratégie social media à 2 000 € par exemple — demande un acompte de 40 à 50 % à la signature, le solde à la livraison. Tu ne démarres jamais un audit sans acompte encaissé. Pour un retainer, facture en début de mois pour le mois en cours, paiement à 30 jours maximum. Encore mieux : propose le prélèvement automatique via GoCardless dès la signature. Un client qui prélève ne « oublie » jamais de payer.

### Te payer et tenir trois mois sans encaisser

Trois gestes, à mettre en place cette semaine.

Un, un compte bancaire dédié à l'activité. C'est obligatoire en micro au-delà de 10 000 € de CA deux années de suite, mais fais-le dès le premier euro : tant que tout est mélangé, tu ne sais pas ce que tu gagnes.

Deux, un salaire fixe. Chaque mois, le même virement du compte pro vers ton compte perso. Pas « ce qui reste » : un montant décidé. Si tu encaisses 4 500 € par mois en moyenne, provisionne 30 % pour les cotisations et l'impôt, garde tes frais pro (outils, mutuelle, comptable : compte 250-400 €), et verse-toi un fixe prudent, par exemple 2 600 €. Les bons mois gonflent la réserve, ils ne gonflent pas ton train de vie.

Trois, la réserve de trois mois. Ton objectif : trois mois de charges totales — salaire, cotisations, frais — posés sur le compte pro et jamais touchés. À 4 000 € de charges mensuelles, c'est 12 000 €. Ce matelas, c'est ce qui te permet de perdre ton plus gros client sans paniquer, donc de ne jamais négocier en position de faiblesse. Tu le construis en y versant 10 à 15 % de chaque encaissement jusqu'à l'atteindre.

## Exemple appliqué

Prenons un cas artisan : une céramiste qui vend ses pièces en ligne et sur les marchés. Tu lui as vendu une stratégie social media à 2 400 € HT en one-shot, puis un retainer starter à 900 € HT par mois — Instagram et Pinterest, 10 posts.

La stratégie d'abord. À la signature, le 3 septembre, tu émets la facture 2026-018 : acompte de 50 %, soit 1 200 € HT, mention article 293 B, échéance à réception. Tu ne poses pas une ligne de l'audit — l'étape Situation de SPEED — avant de voir le virement. Livraison le 26 septembre, facture de solde 2026-021, 1 200 €, échéance 30 jours.

Le retainer ensuite. Facture émise le 1er de chaque mois, 900 € HT, prélèvement GoCardless signé en même temps que le contrat. Résultat : zéro relance, encaissement le 8 de chaque mois, tous les mois.

Côté trésorerie, sur les 2 400 € du one-shot : 624 € partent en provision cotisations et impôt (26 % + 2,2 %), il t'en reste environ 1 720. Sur le retainer annuel de 10 800 €, environ 7 750 nets de charges sociales. La céramiste seule ne te fait pas vivre — c'est un client sur les cinq de ton portefeuille — mais elle illustre la mécanique : acompte, échéances courtes, prélèvement, provision immédiate. Applique la même grille à chaque client et ta trésorerie devient prévisible.

## Les erreurs fréquentes

**Confondre chiffre d'affaires et revenu.** Tu factures 4 000 €, tu te sens riche, tu dépenses 4 000 €. Neuf mois plus tard, l'URSSAF réclame sa part sur tout ce que tu as encaissé. Provisionne 30 % de chaque encaissement, le jour même, sur un sous-compte que tu ne regardes pas.

**Démarrer sans acompte.** Le client qui refuse un acompte de 40 % sur un one-shot te dit quelque chose : il paiera mal. L'acompte n'est pas une méfiance, c'est un standard professionnel — et c'est le seul filtre anti-mauvais-payeur qui fonctionne avant la première facture.

**Ignorer le seuil de TVA jusqu'à le franchir.** Tu le découvres en décembre, tu dois de la TVA rétroactivement sur les factures du dépassement, et tes tarifs prennent 20 % du jour au lendemain sans que tes clients aient été prévenus. Suis ton CA cumulé chaque mois ; à 30 000 €, préviens tes clients de ce qui arrive.

**Numéroter ses factures au hasard.** Deux factures « 12 », un trou entre la 15 et la 17 : en cas de contrôle, c'est une présomption de dissimulation. Un numéro séquentiel par année, un tableau qui les liste toutes, aucune exception.

**Se payer « ce qui reste ».** Sans salaire fixe, les bons mois financent des dépenses qui deviennent des habitudes, et les mauvais mois deviennent des crises. Le fixe lisse tout, et la réserve absorbe le reste.

## Action immédiate

Ouvre un tableur, maintenant. Trois colonnes : tes encaissements des trois derniers mois, 30 % de chaque ligne (ta provision cotisations et impôt), et le total de tes charges mensuelles réelles — frais pro plus le virement perso dont tu as besoin. Tu obtiens deux chiffres : ce que tu aurais déjà dû mettre de côté, et le montant de ta réserve cible (charges mensuelles × 3). Ensuite, ressors ta dernière facture et vérifie les dix mentions listées plus haut. S'il en manque une, corrige ton modèle de facture avant d'émettre la suivante. Total : quarante-cinq minutes, et tu sais enfin où tu en es.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Modèle de facture conforme","description":"Facture prête à remplir avec les dix mentions obligatoires, la numérotation séquentielle et la mention TVA article 293 B du CGI.","kind":"template","url":null},{"title":"Checklist trésorerie du freelance","description":"Les gestes mensuels dans l'ordre : provision de 30 % à chaque encaissement, virement de salaire fixe, suivi du CA cumulé face aux seuils, alimentation de la réserve de trois mois.","kind":"checklist","url":null},{"title":"Portail auto-entrepreneur de l'URSSAF","description":"Le site officiel pour créer ta micro-entreprise, déclarer ton chiffre d'affaires et vérifier les taux de cotisations et seuils en vigueur.","kind":"link","url":"https://www.autoentrepreneur.urssaf.fr"},{"title":"Site des impôts","description":"La référence officielle pour le versement libératoire, la franchise en base de TVA et tes obligations déclaratives.","kind":"link","url":"https://www.impots.gouv.fr"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '4f5a05a2-823a-4e81-b397-5a6ce0e40613'::uuid, m.id, m.course_id, m.org_id, 'organiser-sa-semaine', $sq$Organiser sa semaine sur plusieurs clients$sq$, $sq$Cette leçon montre pourquoi le changement de contexte coûte deux à trois heures par jour et le remplace par des blocs regroupés par type de tâche : production écrite, création, programmation, modération, clients, entreprise. Elle fournit une semaine type complète pour 4 à 6 clients, avec deux journées de production protégées, les réunions empilées le lundi après-midi et la modération réduite à deux rituels quotidiens de 20 minutes.$sq$, $sq$## L'accroche

Claire, freelance social media à Angers, quatre clients. Un mardi type d'il y a un an : elle commence un planning éditorial à 9 h, un client appelle à 9 h 40 pour un commentaire négatif, elle bascule sur la modération, répond à trois mails entre deux, reprend le planning à 11 h 15, réunion à 14 h, montage d'un reel à 16 h, et à 19 h le planning n'est toujours pas fini. Bilan de la journée : sept heures travaillées, rien de terminé. Multiplie par cinq jours et tu obtiens la sensation que connaissent tous les freelances multi-clients : être débordé en permanence sans produire grand-chose. Le problème n'est pas la charge de travail — quatre clients à 900-1 200 € par mois, c'est tenable en quatre jours. Le problème est le découpage. Cette leçon te donne la semaine type qui tient à 4, 5 ou 6 clients, et les règles qui l'empêchent de s'effondrer.

## Le contenu

### Le vrai coût du changement de contexte

Chaque fois que tu passes du planning du client A à la modération du client B, ton cerveau paie un droit de péage : il faut recharger l'univers du client, son ton, ses sujets en cours. Compte quinze à vingt minutes pour retrouver une vraie concentration après une interruption. Dix bascules par jour, c'est deux à trois heures perdues — un quart de ta capacité de production, évaporé sans qu'aucune tâche n'apparaisse dans ton agenda.

La réponse tient en une règle : **tu regroupes par type de tâche, pas par client**. Une session « rédaction » où tu écris les posts de trois clients d'affilée bat trois sessions « client » où tu fais de tout. Même outil, même posture mentale, même rythme : tu écris le troisième planning plus vite que le premier.

### Les six blocs qui composent ta semaine

Tout ce que tu fais entre dans six familles, qui recoupent l'étape Exécution de SPEED :

1. **Production écrite** : plannings éditoriaux, rédaction des posts, scripts de reels.
2. **Production visuelle** : création graphique, tournage, montage.
3. **Programmation et publication** : tout planifier pour la semaine, en une session.
4. **Modération et messages** : commentaires, DM, avis.
5. **Clients** : réunions, points mensuels, validations, mails.
6. **Ton entreprise** : prospection, devis, facturation, reporting — l'étape Données.

Chaque famille reçoit des créneaux fixes et récurrents dans ton agenda. Pas « quand j'aurai le temps » : des blocs posés, qui se répètent chaque semaine, que tu défends comme des rendez-vous client.

### La semaine type à 4-6 clients

- **Lundi matin** : programmation de la semaine pour tous les clients (2 h), puis revue de la semaine — échéances, validations en attente, trous dans les plannings (1 h).
- **Lundi après-midi** : bloc clients. Toutes tes réunions récurrentes s'empilent ici. Quatre points de 30 à 45 minutes tiennent dans l'après-midi.
- **Mardi, journée entière** : production écrite, protégée. Zéro réunion, notifications coupées. C'est là que naissent les plannings du mois suivant.
- **Mercredi** : production visuelle. Tournages chez les clients, montage, création des visuels. Les déplacements se groupent ce jour-là.
- **Jeudi, journée entière** : deuxième journée de production protégée. Suite de la rédaction, création, et le débordement du mardi.
- **Vendredi matin** : reporting et données — tu prépares les reportings commentés, tu regardes les chiffres de la semaine, tu notes les arbitrages à proposer.
- **Vendredi après-midi** : ton entreprise. Prospection (tes 20-25 contacts hebdomadaires pour tenir le rythme de 100 par mois), devis, facturation, admin.

Et la modération ? Elle ne mérite pas un bloc, elle mérite un rituel : **deux passages fixes par jour, 20 minutes à 9 h, 20 minutes à 17 h**, tous clients d'affilée. Entre les deux, l'application reste fermée. Un commentaire posté à 10 h et traité à 17 h, c'est un délai parfaitement professionnel. Seule exception : une crise déclarée — bad buzz, avis presse — qui, elle, interrompt tout.

### Protéger les blocs de production

La semaine type ne survit que si tu la défends. Trois mécanismes.

D'abord, annonce ton fonctionnement aux clients dès l'onboarding : « Je réponds aux messages sous 24 h ouvrées, mes réunions ont lieu le lundi après-midi. » Dit au départ, c'est un cadre professionnel ; dit après six mois de réponses en dix minutes, c'est une régression. Tu formes tes clients à ton rythme dès le premier jour.

Ensuite, rends les blocs visibles : pose-les en événements récurrents dans ton agenda, et si tu utilises un outil de prise de rendez-vous, n'ouvre que les créneaux du lundi après-midi. Le client qui veut « un call rapide jeudi matin » reçoit trois propositions du lundi suivant. Dans 95 % des cas, ça passe sans discussion.

Enfin, ne remplis jamais ta semaine à 100 %. Garde 20 % de vide — une demi-journée flottante, le jeudi après-midi par exemple. Ce vide absorbe l'imprévu : le shooting reporté, le client qui valide en retard, le devis urgent. Une semaine pleine à ras bord casse à la première perturbation, et chez toi il y a une perturbation par semaine.

## Exemple appliqué

Prenons ton client le plus lourd en process : une mutuelle d'assurance B2C, retainer à 1 800 € HT par mois, 12 posts sur Facebook, Instagram et LinkedIn. Sa particularité : chaque post passe par un circuit de validation — la responsable communication, puis la conformité. Délai réel : huit jours ouvrés entre l'envoi et le feu vert.

Sans organisation, ce client dévore ta semaine : des allers-retours de validation qui tombent tous les jours, des corrections « urgentes » le vendredi soir, un planning validé le 29 pour une publication le 1er.

Avec la semaine type, tout se cale sur un cycle mensuel. Le mardi 6, tu rédiges l'intégralité du planning d'octobre — les 12 posts, en une session de trois heures. Envoi en validation le mercredi 7. La mutuelle a jusqu'au vendredi 16 pour ses retours, date écrite dans le contrat. Les corrections passent dans ton bloc du jeudi 22. Programmation complète le lundi 26. Le point mensuel a lieu le premier lundi du mois, 14 h, 45 minutes, avec le reporting commenté préparé le vendredi précédent dans ton bloc données.

Résultat mesurable : ce client consommait douze interventions dispersées par mois, il en consomme désormais cinq, posées dans des blocs prévus. Même volume livré, deux fois moins de bascules de contexte — et une responsable communication plus sereine, parce que les échéances sont les mêmes chaque mois.

## Les erreurs fréquentes

**Organiser sa semaine par client plutôt que par tâche.** « Lundi = client A, mardi = client B » semble logique et détruit ta productivité : chaque journée mélange rédaction, création, modération et mails, donc chaque journée paie le coût de toutes les bascules. Et le client du vendredi devient structurellement le client négligé.

**Accepter les réunions n'importe quand.** Un call de 30 minutes posé à 11 h ne coûte pas 30 minutes : il coupe ta matinée en deux morceaux inutilisables. Trois calls dispersés dans une semaine peuvent annuler une journée entière de production. Empile-les sur une demi-journée unique.

**Laisser la modération ouverte en continu.** Instagram ouvert dans un onglet toute la journée, c'est une machine à interruptions qui déguise la réactivité en travail. Deux passages quotidiens cadrés font mieux, en 40 minutes au lieu d'une journée en pointillé.

**Planifier à pleine capacité.** Si chaque heure est allouée, le premier imprévu te met en retard sur tout, et le retard se propage de semaine en semaine. Les 20 % de marge ne sont pas du confort, c'est l'amortisseur du système.

**Garder son organisation secrète.** Si tes clients ignorent tes règles de réponse et tes jours de réunion, ils inventent les leurs : l'urgence permanente. Le cadre annoncé à l'onboarding n'a jamais fait fuir un bon client.

## Action immédiate

Ouvre ton agenda et pose ta semaine type en événements récurrents : deux journées de production protégée, une demi-journée clients, une demi-journée entreprise, le créneau programmation du lundi matin, et les deux rituels de modération de 20 minutes. Ensuite, écris le message de cadre en trois phrases — délai de réponse 24 h ouvrées, jour des réunions, canal à utiliser — et envoie-le à tes clients actuels comme une information d'organisation, pas comme une excuse. Trente minutes en tout. Ta semaine prochaine commence déjà différemment.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Semaine type à 4-6 clients","description":"Le planning hebdomadaire complet à recopier dans ton agenda : blocs récurrents par type de tâche, créneaux de modération, demi-journée flottante de 20 % de marge.","kind":"template","url":null},{"title":"Checklist de la revue du lundi matin","description":"Les vérifications d'ouverture de semaine : échéances des plannings, validations client en attente, programmation à jour, trous à combler et priorités des deux journées de production.","kind":"checklist","url":null},{"title":"Google Agenda","description":"L'outil gratuit suffisant pour poser tes blocs récurrents et restreindre les créneaux de réunion proposés aux clients.","kind":"tool","url":"https://calendar.google.com"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '8f6f6227-45a9-4451-8680-a435e9463f34'::uuid, m.id, m.course_id, m.org_id, 'recruter-et-deleguer', $sq$Recruter et déléguer : premiers freelances$sq$, $sq$Cette leçon établit ce qui se délègue en premier — déclinaison graphique, montage, modération de premier niveau, programmation — et ce qui ne se délègue jamais : stratégie, relation client, reporting commenté et validation finale. Elle détaille le brief en sept éléments, le contrôle sur grille avant toute livraison, et la règle des 40 % qui plafonne le coût de sous-traitance par rapport à la prestation déléguée.$sq$, $sq$## L'accroche

Le mois dernier, tu as refusé un prospect à 1 200 € par mois. Pas parce que le projet était mauvais — parce que tu n'as plus une heure disponible. Tu es à cinq clients, tes semaines sont pleines, et ton chiffre d'affaires vient de toucher son plafond : ton temps. C'est le moment précis où la plupart des freelances se trompent. Soit ils s'obstinent seuls et refusent 15 000 € de chiffre d'affaires annuel, soit ils recrutent n'importe qui, n'importe comment, et perdent un client à cause d'une livraison ratée qu'ils n'ont pas relue. Il existe une troisième voie : déléguer une partie de la production à un ou deux freelances, en gardant ce qui fait ta valeur. Bien fait, ça libère une à deux journées par semaine et ça finance largement son coût. Mal fait, ça coûte plus cher que ça ne rapporte. Cette leçon te montre la différence.

## Le contenu

### Ce que tu délègues en premier — et ce que tu ne délègues jamais

Le critère est simple : tu délègues ce qui est **répétable et cadrable**, tu gardes ce qui **porte la relation et les décisions**.

À déléguer, dans cet ordre :

1. **La déclinaison graphique.** Une fois les templates du client posés, produire les 10 visuels du mois est un travail d'exécution. C'est le premier candidat : volume élevé, brief facile, contrôle rapide.
2. **Le montage vidéo.** Tu tournes, quelqu'un d'autre monte. Un reel bien brieffé (rushs nommés, structure indiquée, exemples de rythme) se monte sans toi.
3. **La modération de premier niveau.** Réponses aux questions courantes à partir d'une FAQ que tu écris, remontée vers toi de tout ce qui sort du cadre : réclamation, avis négatif, demande commerciale.
4. **La programmation.** Charger les posts validés dans l'outil de planification, vérifier les formats. Zéro décision, pure exécution.

À ne jamais déléguer tant que tu es freelance : la stratégie (les étapes Situation et Positionnement de SPEED, c'est ce que le client t'achète), la relation client (celui qui parle au client détient le client), le reporting commenté (c'est lui qui fait durer le contrat — le sous-traiter, c'est sous-traiter ta reconduction), et la validation finale de tout ce qui part chez le client ou en ligne.

### Où trouver tes premiers sous-traitants

Trois sources, par ordre d'efficacité. D'abord ton réseau de freelances : le graphiste ou le monteur croisé sur une mission, recommandé par un pair, vu passer sur LinkedIn. Une recommandation vaut dix profils anonymes. Ensuite Malt, avec un filtre simple : un portfolio dont le style colle à tes clients, des avis clients réels, un tarif junior-intermédiaire. Enfin les écoles — BUT MMI, bachelors en communication : des profils motivés, disponibles, à qui il faut un cadre plus serré.

Dans tous les cas, la règle d'or : **tu testes avec une vraie mission payée, petite et sans enjeu client**. Par exemple : trois visuels sur un brief complet, 90 €, une semaine de délai. Tu juges trois choses — le respect du brief, le respect du délai, et la qualité des questions posées. Quelqu'un qui ne pose aucune question sur un premier brief est un signal d'alerte, pas un signe d'autonomie.

### Briefer : le document qui fait 80 % du résultat

Une livraison ratée est presque toujours un brief raté. Ton brief est écrit — jamais un vocal de quatre minutes — et contient sept éléments : l'objectif du livrable et son contexte client, le format exact (dimensions, durée, déclinaisons), la direction artistique avec le kit de marque joint, deux ou trois références de ce que tu veux, une référence de ce que tu ne veux pas, la deadline, et le nombre d'allers-retours inclus dans le prix : deux. Au-delà, soit ton brief était flou et c'est pour toi, soit le sous-traitant dérive et c'est une conversation à avoir.

Astuce qui change tout : pour la première mission d'un nouveau sous-traitant, joins un exemplaire fait par toi. Un modèle vaut mille adjectifs.

### Contrôler sans refaire

Deux règles. Un : **rien ne part chez le client sans être passé sous tes yeux**. Ton nom est sur la livraison ; le client n'a pas à savoir qui a produit, il a à recevoir ta qualité. Prévois le créneau de relecture dans ta semaine — 30 minutes le jeudi, par exemple — et exige la livraison 48 h avant ta deadline client, pour que le correctif soit possible sans stress. Deux : contrôle sur grille, pas au feeling. Cinq points suffisants : conformité au brief, respect de la charte, orthographe, formats techniques, cohérence avec les posts précédents du client. La grille rend ton feedback factuel, et le sous-traitant progresse au lieu de deviner.

### Les marges : la règle des 40 %

Tu délègues pour libérer du temps vendable, pas pour redistribuer ta marge. La règle : **le coût de sous-traitance ne dépasse pas 40 % du montant de la prestation déléguée**. Concrètement : dans un retainer à 1 500 € où la partie création graphique pèse environ 500 €, tu peux acheter cette production jusqu'à 200 €. Les tarifs de marché le permettent : un graphiste junior en déclinaison facture 25 à 35 € le visuel ou 200 à 250 € la journée ; un monteur junior, 40 à 70 € le reel court.

Et surtout, mesure ce que le temps libéré rapporte. Si déléguer te rend six heures par semaine et que ton TJM est à 400 €, ces heures valent environ 1 200 € par mois — à condition de les remplir avec un nouveau client ou de la prospection, pas avec du scrolling.

## Exemple appliqué

Ton client e-commerce lifestyle : une marque de décoration en ligne, retainer à 1 900 € HT par mois, Instagram et TikTok, 16 contenus mensuels dont 6 reels. C'est ton client le plus gourmand en production : environ 22 heures par mois, dont 9 de création graphique et de montage.

Tu décides de déléguer la déclinaison des 10 visuels et le montage des 6 reels. Tu recrutes Léa, graphiste-monteuse trouvée sur Malt, testée sur une mission de trois visuels à 90 €. Accord cadre : 30 € le visuel, 55 € le reel monté, soit 630 € par mois — 33 % du retainer, dans la règle des 40 %.

Le circuit mensuel : le 5, tu envoies le brief complet — planning validé par le client, rushs des tournages, kit de marque, deux références par format. Livraison le 15, deux allers-retours inclus. Ta relecture sur grille le 16, corrections le 18, tout est programmé le 26 pour le mois suivant. Toi, tu gardes le planning éditorial, les tournages, la relation avec la fondatrice et le reporting commenté du 3 du mois.

Bilan chiffré : tu passes de 22 à 13 heures sur ce client. Ta marge brute sur ce retainer passe de 1 900 € à 1 270 €, mais les 9 heures libérées t'ont permis de signer le prospect à 1 200 € par mois que tu refusais. Nouveau total : 3 100 € de CA sur le même temps de travail, contre 1 900 avant. La délégation ne t'a rien coûté — elle t'a payé.

## Les erreurs fréquentes

**Déléguer la relation client.** Tu envoies ton sous-traitant en réunion « pour gagner du temps » : dans six mois, le client aura compris qu'il peut travailler avec lui sans toi, à moitié prix. Celui qui parle au client possède le contrat. C'est non négociable.

**Briefer à l'oral.** Un vocal WhatsApp de trois minutes n'est pas un brief : c'est un malentendu programmé, et quand la livraison arrive à côté, impossible de dire qui a raison. Écrit, avec références, systématiquement — même pour la vingtième mission.

**Payer au lance-pierre.** Négocier un monteur à 25 € le reel te garantit trois choses : un travail bâclé, un sous-traitant qui te lâche dès qu'un client paie mieux, et le temps perdu à en re-tester un autre. Paie le juste prix de marché et exige la qualité en face.

**Livrer sans relire.** Une seule faute d'orthographe publiée sur le compte du client détruit six mois de confiance. La relecture n'est pas une option qui saute quand la semaine est chargée : c'est un créneau bloqué, comme un rendez-vous.

**Déléguer avant d'avoir un process.** Si tu n'as ni templates, ni charte documentée, ni circuit de validation, tu ne délègues pas un travail : tu délègues un flou, et tu récupères un chaos. Fais la tâche toi-même au moins trois mois, documente-la, puis délègue-la.

## Action immédiate

Prends ta semaine passée et liste tout ce que tu as produit, ligne par ligne, avec le temps passé. Surligne ce qui était répétable et cadrable : déclinaisons graphiques, montages, programmation, réponses aux questions récurrentes. Additionne les heures. Multiplie par ton taux horaire — TJM divisé par sept. Ce chiffre, c'est ce que la non-délégation te coûte chaque semaine. S'il dépasse 300 €, rédige dès maintenant le brief de la première mission test : trois visuels pour ton client le plus cadré, budget 90 €, délai une semaine. Tu as le brief en 40 minutes, et un candidat sur Malt avant ce soir.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Modèle de brief pour sous-traitant","description":"Le brief en sept éléments : objectif et contexte, format exact, direction artistique et kit de marque, références positives et négatives, deadline et nombre d'allers-retours inclus.","kind":"template","url":null},{"title":"Grille de contrôle avant livraison client","description":"Les cinq points à vérifier sur chaque livrable sous-traité : conformité au brief, respect de la charte, orthographe, formats techniques, cohérence avec les publications précédentes.","kind":"checklist","url":null},{"title":"Malt","description":"La place de marché principale pour trouver et tester des graphistes et monteurs freelances avec avis clients vérifiés.","kind":"link","url":"https://www.malt.fr"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '40ec0a9f-dcaf-4083-b6b9-61ca8cef94c0'::uuid, m.id, m.course_id, m.org_id, 'de-freelance-a-agence', $sq$Passer de freelance à agence$sq$, $sq$Cette leçon liste les signaux qui justifient d'envisager l'agence — leads refusés en flux constant, CA plafonné à 7 000-8 000 € malgré la délégation — et chiffre ce qui change : 18 000 à 20 000 € de CA mensuel nécessaires pour te payer autant qu'en freelance avec deux salariés. Elle défend aussi les alternatives légitimes, freelance premium et studio solo avec sous-traitants, et fournit la simulation en tableur pour trancher sur des chiffres.$sq$, $sq$## L'accroche

Tu es à 7 500 € HT par mois, six clients, deux sous-traitants réguliers. Tes semaines sont pleines, ton pipeline aussi : ce trimestre, tu as encore refusé deux prospects sérieux. Et la petite voix s'installe : « C'est le moment de monter une agence. » Peut-être. Mais avant de foncer, regarde les chiffres que personne ne montre : un freelance à 7 500 € de CA garde environ 5 000 € pour lui ; une agence de trois personnes à 25 000 € de CA laisse souvent 3 000 € à son fondateur, avec les prud'hommes en risque et la paie des autres à sortir chaque mois, que les clients aient payé ou non. L'agence n'est pas la suite logique du freelancing : c'est un autre métier. Parfois c'est le bon choix. Parfois, rester freelance premium est la décision la plus rentable de ta carrière. Cette leçon te donne les signaux, les vrais chiffres, et les deux chemins.

## Le contenu

### Les signaux qu'il est peut-être temps

Un seul signal ne suffit pas. C'est l'accumulation qui compte, sur au moins six mois :

- **Tu refuses du chiffre d'affaires régulièrement.** Pas un prospect de temps en temps : un flux entrant constant que tu déclines faute de capacité — deux ou trois leads qualifiés par mois, depuis deux trimestres.
- **Ton CA est au plafond avec les leviers freelance épuisés.** Tu as déjà monté tes prix, tu es à 5-6 clients bien facturés, tu délègues déjà la production, et tu plafonnes à 7 000-8 000 € depuis six mois.
- **Tes clients demandent plus large que ton périmètre.** Le social media, puis les ads, puis le site, puis les relations presse. Quand trois clients te demandent des prestations que tu refuses, il existe une agence dans ton pipeline — la tienne ou celle d'un concurrent.
- **Tu passes plus de la moitié de ton temps sur du délégable.** Si ta semaine est encore majoritairement de la production, ton problème n'est pas l'agence, c'est la leçon précédente. Le signal valable, c'est l'inverse : tu as tout délégué proprement et ça déborde encore.

### Ce qui change vraiment : la marge

En freelance, tu vends ton temps : ta marge brute frôle les 100 %, tes charges fixes tiennent en 300 € d'outils. En agence, tu vends le temps des autres, et l'équation s'inverse.

Pose les chiffres d'une agence de trois personnes : toi plus deux salariés — un chef de projet et un créatif — à 2 600 € brut chacun. Coût employeur : environ 7 000 € par mois. Ajoute un local ou des postes en coworking, la comptabilité en société, les outils multipliés, la mutuelle, l'assurance : 2 000 € de plus. Avant de te payer un euro, ta machine coûte 9 000 € par mois. Pour te sortir 5 000 € — ton niveau de freelance — avec une marge de sécurité, il te faut 18 000 à 20 000 € de CA mensuel, chaque mois, sans trou. Tu passes de « six clients à fidéliser » à « douze clients à trouver, signer et garder », avec une masse salariale qui tombe le 30 même quand un client paie à 60 jours. La réserve de trésorerie n'est plus de trois mois de tes charges : elle est de trois mois de la paie des autres.

### Ce qui change aussi : ton métier

Deux bascules que les chiffres ne montrent pas.

**Tu deviens manager.** Recruter, former, faire des points hebdomadaires, gérer une démission, recadrer sans casser. Un salarié junior produit 50 à 60 % de ce que tu produis, pendant six mois au moins, et c'est normal : ton travail est de l'amener au niveau, pas de refaire derrière lui à 23 h.

**Tu deviens commercial à plein temps.** À douze clients avec un churn normal, tu perds deux ou trois comptes par an : il faut les remplacer avant de croître. La prospection cesse d'être ton vendredi après-midi pour devenir ta fonction principale, avec la production qui s'éloigne. Question test, à te poser honnêtement : est-ce que vendre et manager te motive plus que créer ? Si la réponse est non, l'agence sera une punition quotidienne bien payée — au mieux.

Côté structure : la société devient obligatoire — une SASU en général —, avec expert-comptable, prévoyance, et un cadre juridique du travail que tu dois apprendre. Ce n'est pas un obstacle, c'est un coût et du temps à budgéter.

### Les raisons légitimes de ne pas le faire

Rester freelance n'est pas un échec d'ambition, c'est un modèle : **le freelance premium**. 8 000 € de CA, 65-70 % dans ta poche, zéro management, la liberté de prendre trois semaines en août. Beaucoup de fondateurs d'agence rêvent de revenir exactement là.

Et il existe une voie intermédiaire, souvent la meilleure : le **studio solo**. Toi en face du client sur la stratégie et le conseil, deux ou trois sous-traitants réguliers en production, une capacité de 8 à 10 clients, un CA de 10 000 à 12 000 € sans un seul contrat de travail. Tu captes une partie de l'économie d'une agence sans sa structure de coûts ni son risque social. La seule vraie limite du modèle : il repose sur toi. Pas de toi, pas de studio — c'est le prix de la légèreté.

## Exemple appliqué

Le cas qui déclenche tout, souvent, c'est un client. Prenons ton compte transport premium B2B : une société de chauffeurs haut de gamme pour entreprises, chez toi depuis dix-huit mois à 1 600 € par mois sur LinkedIn. Elle lève des fonds, ouvre Lyon et Bruxelles, et te propose un périmètre complet : LinkedIn corporate plus les pages locales, la gestion publicitaire LinkedIn et Google, la couverture de leurs événements, un rapport mensuel pour leur board. Budget évoqué : 4 500 € par mois. Seul, même bien organisé, c'est 60 % de ta capacité pour un seul client.

Chemin A, l'agence : tu recrutes un chef de projet pour absorber ce compte et libérer ta prospection. Coût employeur : 3 500 €. Le contrat le couvre à peine — il te faut signer 6 000 à 8 000 € de CA supplémentaire dans les six mois pour que la structure respire. Tu paries sur ta capacité commerciale, avec un CDI sur les bras si le pari rate ou si le client part à la fin de la levée.

Chemin B, le studio solo : tu prends le compte à 4 200 €, tu confies les pages locales et la production événementielle à deux sous-traitants éprouvés pour 1 400 € par mois, tu gardes la stratégie, les ads et le board report. Ta marge sur le compte : 2 800 €. Ton risque si le client part : zéro licenciement, tu réduis la voilure en un mois.

La bonne réponse dépend d'une seule chose : ton pipeline. Si tu refuses déjà 3 000 € de leads par mois depuis six mois, le chemin A a du carburant. Sinon, le chemin B encaisse la même opportunité sans transformer un beau contrat en usine à charges fixes.

## Les erreurs fréquentes

**Monter une agence pour le statut.** « Fondateur d'agence » sonne mieux que « freelance » en soirée networking. C'est la pire raison : l'ego ne paie pas les salaires, et il s'évapore au premier mois où tu sors les paies sur ta trésorerie personnelle.

**Recruter en CDI sur un seul gros client.** Un compte à 4 500 € te pousse à embaucher ; le client part, le salarié reste. Règle prudente : un recrutement se justifie quand il est couvert par au moins trois clients distincts, ou précédé de six mois en sous-traitance sur le même volume.

**Garder des prix de freelance avec des coûts d'agence.** Ta structure coûte 40 % de plus, tes prix doivent suivre — c'est aussi ce que le client achète : une équipe, une continuité de service. Vendre au tarif solo avec une masse salariale, c'est programmer la perte.

**Arrêter de vendre une fois l'équipe en place.** Tu recrutes pour produire, tu te noies dans le management, la prospection s'arrête trois mois — et le trou de CA arrive précisément quand tes charges sont au plus haut. En agence, ta prospection est la dernière chose que tu as le droit de suspendre.

**Décider dans le brouillard.** Ni marge réelle actuelle, ni simulation avec salarié, ni pipeline mesuré : juste une intuition et de la fatigue. Une décision qui engage trois ans de ta vie mérite une heure de tableur.

## Action immédiate

Ouvre un tableur, deux colonnes. Colonne un, ta situation réelle : CA mensuel moyen sur six mois, charges et sous-traitance, ce qui te reste. Colonne deux, la simulation agence : même CA plus 30 % d'optimisme, moins un salaire chargé à 3 500 €, moins 1 500 € de structure. Regarde ce qui reste pour toi dans chaque colonne. Puis note deux chiffres de pipeline : le montant de CA que tu as réellement refusé sur les six derniers mois, et le nombre de leads entrants par mois. Si la colonne deux est inférieure à la colonne un et que ton pipeline refusé est sous 3 000 € par mois, tu as ta réponse pour l'année : studio solo, et on en reparle dans douze mois. Cinquante minutes, et la petite voix a enfin des chiffres en face d'elle.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Simulateur de marge freelance vs agence","description":"Tableur à deux colonnes comparant ta situation réelle et la simulation agence : CA, masse salariale chargée, coûts de structure et revenu restant pour toi dans chaque scénario.","kind":"template","url":null},{"title":"Checklist des signaux avant de passer en agence","description":"Les quatre signaux à valider sur six mois : leads qualifiés refusés chaque mois, plafond de CA atteint avec les leviers freelance épuisés, demandes clients hors périmètre, production déjà déléguée.","kind":"checklist","url":null},{"title":"Entreprendre - Service Public","description":"Le portail officiel pour les démarches de création de société, le passage en SASU et les obligations d'employeur.","kind":"link","url":"https://entreprendre.service-public.fr"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;
