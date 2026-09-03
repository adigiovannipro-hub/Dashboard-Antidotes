-- ===========================================================================
-- Antidotes Academy — contenu de la formation
--
-- GÉNÉRÉ par `pnpm generate:academy-seed` depuis `scripts/data/academy/` —
-- ne pas éditer à la main : corriger le fichier de contenu et régénérer
-- (tant que la migration n'est pas appliquée ; ensuite, le back-office
-- `/academy/admin` est l'éditeur).
--
-- 14 modules, 65 leçons, tout publié. Identifiants stables
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
select 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid, o.id, 'devenir-libre-grace-a-l-ugc', $sq$Devenir libre grâce à l'UGC$sq$, $sq$Le métier de créatrice UGC de bout en bout : se positionner, monter un portfolio qui fait signer, trouver des marques, tarifer, négocier, tourner, monter, livrer dans les temps et fidéliser. Quatorze modules, un script complet par leçon, et les documents de travail fournis avec.$sq$, 2, true
from organizations o
order by o.created_at
limit 1
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '88c6d93f-1b62-489a-a520-31ce0f0dfdd9'::uuid, c.id, c.org_id, 'le-metier-ugc', $sq$Le métier, sans filtre$sq$, $sq$Ce module pose ce qu'est réellement l'UGC : un métier de production, payé au fichier et non à l'audience. Il sépare créatrice UGC, influenceuse et ambassadrice — trois prix, trois livrables, trois contrats — explique ce qu'une marque achète vraiment derrière son brief, et donne la trajectoire de revenus réelle des quatorze premiers mois.$sq$, 1, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0d761059-86e1-44b9-9798-a5fb32ff63ac'::uuid, m.id, m.course_id, m.org_id, 'ce-qu-est-vraiment-l-ugc', $sq$Ce qu'est vraiment l'UGC (et ce que ce n'est pas)$sq$, $sq$Tu vends un fichier vidéo à une marque qui le diffuse en publicité, pas une exposition auprès de ta communauté. Cette leçon explique pourquoi ce marché existe, ce qui le distingue de l'influence, et pourquoi quatre mille abonnés suffisent à en vivre.$sq$, $sq$## L'accroche

Léa a 4 200 abonnés sur Instagram. En dix-huit mois, elle a facturé 41 000 € à des marques. Sa voisine de promo, 87 000 abonnés, en a facturé 9 000. Les deux font de la vidéo, les deux parlent de produits, et pourtant elles n'exercent pas le même métier. Léa vend des fichiers vidéo à des marques qui les diffusent en publicité. Sa voisine vend de l'exposition auprès de sa communauté. Le premier métier se paie au livrable, le second à l'audience — et c'est pour ça que Léa peut gagner sa vie avec quatre mille abonnés. L'UGC, User Generated Content, est le seul métier créatif des réseaux sociaux où ton nombre d'abonnés n'entre pas dans l'équation. Cette leçon pose ce que tu vends exactement, à qui, et pourquoi ce marché existe.

## Le contenu

### Ce que tu produis

Tu produis des vidéos verticales de 15 à 60 secondes, filmées au téléphone, dans lesquelles tu utilises, montres ou commentes le produit d'une marque. Tu les livres en fichier. La marque en fait ce qu'elle veut : les publier sur son propre compte, les pousser en publicité Meta ou TikTok, les mettre sur sa fiche produit, les envoyer à ses revendeurs.

Le point qui déroute tout le monde au début : **ces vidéos ne sortent presque jamais sur ton compte à toi**. Tu n'es pas le média. Tu es l'atelier de production.

### Pourquoi ce marché existe

Trois causes, toutes économiques.

La première : la publicité léchée ne convertit plus. Une marque qui dépense 8 000 € en shooting studio obtient une vidéo magnifique que l'algorithme place entre deux contenus d'amis, et qui se reconnaît comme une pub en un quart de seconde. Une vidéo tournée au téléphone dans une vraie cuisine passe la barrière. Les plateformes ont même un mot pour ça, la « native fit » : plus la pub ressemble au flux, plus elle est vue.

La deuxième : le volume. Une campagne Meta correcte a besoin de quinze à trente créations différentes par trimestre, parce qu'une créa se fatigue en dix à vingt jours. Aucune agence classique ne produit trente vidéos par trimestre à un tarif tenable. Toi si.

La troisième : le test. Une marque ne sait pas à l'avance quelle accroche va marcher. Elle veut cinq versions d'ouverture sur la même vidéo pour les tester en publicité. C'est un travail de fabrication en série, pas un travail d'artiste.

### Ce que ce n'est pas

Ce n'est pas de l'influence. On ne te paie pas pour ton audience, on te paie pour un fichier.

Ce n'est pas de l'affiliation. Ta rémunération ne dépend pas des ventes générées ; elle est fixée avant le tournage.

Ce n'est pas de la figuration. Tu écris le script, tu choisis les plans, tu montes. Une marque qui te traite comme une figurante te paie mal, et c'est le premier signal d'un mauvais client.

Ce n'est pas non plus « faire des vidéos avec des produits gratuits ». Le produit offert est une matière première, pas un salaire. Une leçon entière y est consacrée plus loin.

### Le modèle économique en une ligne

Tu vends du temps de production transformé en fichiers, plus un **droit d'usage** sur ces fichiers. Le fichier a un coût de fabrication ; le droit a un prix de marché. C'est la superposition des deux qui fait un revenu décent — une créatrice qui ne facture que la fabrication plafonne à un tarif d'exécutante.

### Le profil qui marche

Trois qualités, dans l'ordre.

**La régularité de livraison** avant le talent : une marque revient chez celle qui livre le mardi quand elle a dit mardi. C'est le facteur numéro un de renouvellement, très loin devant l'esthétique.

**L'aisance face caméra**, qui n'est pas le charisme : c'est parler à un objectif comme à quelqu'un, sans réciter. Ça s'apprend en trois semaines de pratique quotidienne.

**La compréhension du produit** : savoir en trente secondes quel problème le produit résout et pour qui. C'est ce qui sépare une vidéo qui vend d'une vidéo jolie.

Ce qui n'est pas nécessaire : une grosse audience, du matériel professionnel, un diplôme, une belle maison, un physique particulier. Les trois marques qui reviennent le plus dans les briefs sont « vraie personne », « vrai intérieur », « pas trop parfait ».

## Exemple appliqué

Une marque de compléments alimentaires vend une poudre de magnésium à 29 €. Elle dépense 6 000 € par mois en publicité Meta. Son problème n'est pas le budget, c'est la créa : ses trois vidéos tournent depuis six semaines, le coût par achat est passé de 21 € à 38 €.

Elle commande douze vidéos UGC : quatre créatrices, trois vidéos chacune. Budget créa : 3 600 €, soit 300 € la vidéo.

Toi, tu livres trois vidéos. La première ouvre sur « je me réveillais à 3 h du matin toutes les nuits » — une phrase, ton visage, aucune marque à l'écran pendant huit secondes. La deuxième montre le rituel du soir, sans parler, avec une voix off. La troisième est un avant/après sur trois semaines.

La marque teste les douze. Deux fonctionnent, dont une des tiennes : coût par achat à 17 €. Elle la pousse à 4 000 € de budget sur ce seul angle. Elle te recommande trois vidéos le mois suivant, puis passe à un abonnement de six vidéos par mois à 1 500 €.

Compte ce que ça vaut pour elle : 21 € d'écart de coût par achat sur 200 achats mensuels, c'est 4 200 € économisés. Ton mois à 1 500 € est la meilleure ligne de son budget. C'est ça, la vraie proposition de valeur — et c'est ce qui te donne le droit d'augmenter tes prix.

## Les erreurs fréquentes

Croire qu'il faut d'abord construire une audience. C'est l'erreur qui coûte le plus de mois : passer six mois à essayer d'atteindre 10 000 abonnés avant d'oser démarcher, alors que ton portfolio suffit dès la première semaine. Une marque regarde tes vidéos, pas ton compteur.

Confondre le compte vitrine et le compte personnel. Ton compte sert de vitrine à ton travail — extraits, coulisses, formats. Il n'a pas besoin d'être une communauté engagée. Le juger avec les critères d'un influenceur te démoralise pour rien.

Accepter le produit offert comme paiement. Un produit à 29 € contre une journée de travail est un tarif horaire de misère. Il y a une place pour ça, très étroite, et elle est traitée plus loin.

Travailler sans savoir où la vidéo sera diffusée. Une vidéo destinée à une publicité pendant six mois dans trois pays ne vaut pas le même prix qu'une vidéo pour un post organique. Ne pas poser la question, c'est offrir la moitié de sa facture.

Se croire mauvaise parce qu'une vidéo ne performe pas. La performance dépend de l'offre, du prix, de l'audience ciblée, de la page produit — tout ce que tu ne contrôles pas. Tu es responsable de la qualité du livrable et du respect du brief, pas du taux de conversion.

## Action immédiate

Écris en une phrase ce que tu vends, sur ce modèle : « Je produis des vidéos verticales de X secondes pour des marques de [secteur], livrées en fichier, utilisables en publicité. » Puis liste cinq marques que tu utilises vraiment et dont tu pourrais parler sans mentir. Ces cinq noms sont ta première liste de prospects, et cette phrase sera la première ligne de ton portfolio.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Fiche « Ce que je vends »","description":"Ta phrase de positionnement, tes cinq premières marques à démarcher, ce que tu refuses, et le nombre de vidéos à vendre chaque mois pour vivre du métier.","kind":"document","url":null,"body":"## Fiche « Ce que je vends »\n\nÀ remplir en dix minutes, à relire tous les trois mois.\n\n### 1. La phrase\n\n« Je produis des vidéos verticales de ___ secondes pour des marques de\n______________, livrées en fichier, utilisables en publicité. »\n\n### 2. Mes cinq premières marques\n\nCinq marques que tu utilises vraiment et dont tu peux parler sans mentir.\nC'est ta première liste de prospection.\n\n| Marque | Produit utilisé | Depuis quand | Ce que je pourrais montrer |\n|---|---|---|---|\n|  |  |  |  |\n|  |  |  |  |\n|  |  |  |  |\n|  |  |  |  |\n|  |  |  |  |\n\n### 3. Ce que je ne fais pas\n\nÉcris-le : c'est ce qui te permettra de refuser vite.\n\n- Je ne poste pas sur mon compte sans facturation séparée.\n- Je n'accepte pas le produit seul comme paiement au-delà de ___ €.\n- Je ne signe aucune exclusivité sans supplément.\n- Je ne livre aucun fichier avant paiement de l'acompte.\n\n### 4. Mon seuil\n\nCharges fixes mensuelles : ______ €\nChiffre d'affaires nécessaire (charges ÷ 0,65) : ______ €\nPrix cible à la vidéo : ______ €\n**Vidéos à vendre par mois : ______**\n"},{"title":"Bibliothèque publicitaire Meta","description":"Toutes les publicités actives de n'importe quelle marque, gratuitement. C'est là qu'on voit quelles créas UGC tournent chez tes futurs clients.","kind":"tool","url":"https://www.facebook.com/ads/library"},{"title":"TikTok Creative Center","description":"Les publicités TikTok les plus performantes par pays et par secteur, avec leurs accroches. La meilleure source d'inspiration gratuite du métier.","kind":"tool","url":"https://ads.tiktok.com/business/creativecenter"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '88c6d93f-1b62-489a-a520-31ce0f0dfdd9'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '281333ca-6012-437a-9f5e-1f1b6b35cdfa'::uuid, m.id, m.course_id, m.org_id, 'ugc-influence-ambassadrice', $sq$UGC, influence, ambassadrice : trois métiers, trois contrats$sq$, $sq$Les briefs mélangent production, publication et droits publicitaires sans le dire. Cette leçon apprend à décomposer une demande en lignes séparées et à chiffrer chacune — le seul moyen de ne pas offrir la moitié de sa facture.$sq$, $sq$## L'accroche

Un message reçu par Marion, créatrice depuis huit mois : « Bonjour, on adore ton univers ! On t'envoie le produit, tu fais une story et un reel sur ton compte, et on te reposte. » Elle a répondu oui. Trois semaines plus tard, la marque lui demande les fichiers bruts « pour les mettre en pub ». Marion les a envoyés — elle n'avait rien signé. La vidéo a tourné neuf mois sur Meta, dans quatre pays, avec son visage. Elle a été payée zéro euro et un shampoing sec. Ce n'est pas une histoire de méchante marque : c'est une histoire de contrat manquant, née d'une confusion entre trois métiers qui se ressemblent de loin. Cette leçon les sépare une bonne fois, parce que le prix, les droits et le livrable ne sont les mêmes dans aucun des trois.

## Le contenu

### Les trois métiers

**Créatrice UGC.** Tu vends un fichier. La marque le diffuse chez elle. Ton audience n'entre pas dans le prix. Livrable : une ou plusieurs vidéos, plus un droit d'usage borné. Prix de marché en France : 120 à 450 € la vidéo selon complexité et droits.

**Influenceuse.** Tu vends une diffusion auprès de **ta** communauté. Le prix suit ton audience et son engagement. Livrable : une publication sur ton compte, qui reste ou non selon le contrat. Prix : très variable, une base courante étant 1 à 2 % du nombre d'abonnés en euros par publication — 10 000 abonnés, 100 à 200 € le post — avec d'énormes écarts par niche.

**Ambassadrice.** Tu vends une association durable de ton image à la marque, généralement avec exclusivité sur son secteur. Livrable : un engagement sur plusieurs mois, souvent un mélange de contenus, de présence et de droits larges. Prix : un forfait mensuel, plus une prime d'exclusivité.

### Ce qui change concrètement

| Question | UGC | Influence | Ambassadrice |
|---|---|---|---|
| Qui diffuse ? | La marque | Toi | Les deux |
| Ce qu'on paie | Le fichier + les droits | L'audience | L'image + la durée |
| Ton audience compte ? | Non | Oui, c'est le prix | Un peu |
| Ton nom apparaît ? | Rarement | Toujours | Toujours |
| Exclusivité ? | Rare, et se facture | Ponctuelle | Structurelle |

### La zone dangereuse : le mélange

Les briefs mélangent tout, presque toujours par méconnaissance. « Tu fais une vidéo, tu la postes chez toi, et on la boost. » Cette phrase contient trois prestations : une production UGC, une publication d'influence, et un droit de publicité — dont un « whitelisting » si le boost se fait depuis ton compte.

La règle : **décompose et chiffre chaque ligne**. Ne dis jamais un prix global sur un brief mélangé, parce que la marque retiendra le total et ajoutera des usages ensuite « puisque c'est compris ».

### Le whitelisting, à connaître avant de le rencontrer

Le whitelisting, ou Spark Ads sur TikTok, c'est quand la marque diffuse une publicité **depuis ton compte** : les gens voient ton pseudo, tes abonnés, ton historique. C'est beaucoup plus efficace pour elle, et beaucoup plus engageant pour toi : ton nom porte la publicité, tu ne contrôles ni le ciblage ni la durée, et les commentaires arrivent chez toi.

Ça se facture à part, en supplément du contenu — une pratique courante est 30 à 50 % du prix du contenu par mois de whitelisting — et ça se borne dans le temps, toujours.

### Comment choisir ton métier

Regarde deux chiffres : ton nombre d'abonnés, et ton envie d'être visible.

Sous 10 000 abonnés, l'influence ne paie pas ; l'UGC, si. Au-dessus de 50 000 dans une niche précise, l'influence peut rapporter plus à l'heure travaillée.

Beaucoup font les deux, et c'est très bien, à condition de tenir deux grilles tarifaires distinctes et de ne jamais les additionner en une remise.

Ce que tu ne dois pas faire, c'est glisser vers l'ambassadrice sans le décider. L'exclusivité sectorielle t'interdit tous les concurrents du client — dans une niche étroite, ça peut fermer 80 % de ton marché pour le prix d'un seul contrat.

## Exemple appliqué

Une marque de cosmétique bio écrit à Marion, six mois après l'épisode du shampoing. Le brief : « 3 vidéos, tu en postes une chez toi, on garde les trois pour la pub, et on aimerait que tu ne travailles pas avec d'autres marques beauté pendant la campagne. »

Marion décompose et répond ligne par ligne :

- 3 vidéos UGC, droits publicité 3 mois, France : 3 × 220 € = 660 €.
- 1 publication sur son compte (12 000 abonnés, taux d'engagement 4,1 %) : 180 €.
- Whitelisting depuis son compte, 3 mois : + 40 % du prix contenu, soit 264 €.
- Exclusivité beauté sur 3 mois : 400 €, « et je peux la retirer si vous préférez ».

Total : 1 504 €. La marque retire l'exclusivité — trop chère pour ce qu'elle en attendait — et signe le reste à 1 104 €. Marion a gagné trois choses : un prix cohérent, un contrat écrit, et surtout la liberté de continuer à travailler avec d'autres marques beauté, ce qui lui rapportera 2 000 € de plus sur le même trimestre.

Sans la décomposition, elle aurait dit « 600 € pour les trois vidéos » et tout le reste serait parti gratuitement.

## Les erreurs fréquentes

Répondre à un brief mélangé par un prix unique. Le total devient la référence, et chaque usage supplémentaire semble « déjà compris ».

Offrir l'exclusivité pour décrocher le contrat. C'est la concession la plus chère du métier, parce que son coût est invisible : il se paie en contrats que tu n'auras jamais et que tu ne verras jamais.

Accepter le whitelisting sans borne de durée. Une publicité qui tourne indéfiniment depuis ton compte, avec ton nom, sans que tu puisses l'arrêter, est un problème qui grossit avec le temps.

Facturer une prestation d'influence au tarif UGC. Une publication chez toi consomme ton audience, une ressource que tu ne peux vendre qu'une fois par période. Elle n'a rien à voir avec un fichier livré.

Envoyer les fichiers bruts « pour info ». Un fichier livré est un fichier utilisable. Ce qui n'est pas payé ne s'envoie pas — même en rush, même par gentillesse.

## Action immédiate

Reprends la dernière proposition qu'on t'a faite, ou invente-en une plausible, et décompose-la en lignes séparées : production, publication chez toi, droits publicitaires avec durée et territoire, whitelisting, exclusivité. Mets un prix sur chaque ligne, même approximatif. Garde ce tableau : c'est le squelette de tous tes devis, et il te servira tel quel dans le module sur la tarification.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Trame de décomposition d'un brief","description":"Le tableau à remplir devant toute demande mélangée : production, publication chez toi, droits, whitelisting, exclusivité — une ligne, un prix.","kind":"template","url":null},{"title":"Checklist des signaux d'un brief flou","description":"Les six formulations qui annoncent un usage non payé : « on te reposte », « on va peut-être booster », « pour nos réseaux », « en illimité », « pour tester ».","kind":"checklist","url":null},{"title":"Grille tarifaire de départ","description":"Les fourchettes du marché français par niveau, les suppléments de droits et de whitelisting, et les trois packs à proposer par défaut.","kind":"document","url":null,"body":"## Grille tarifaire de départ\n\nLes fourchettes du marché français pour une vidéo verticale de 15 à 45\nsecondes, livrée montée, droits publicitaires 3 mois, un territoire.\n\n| Niveau | Prix unitaire | Quand y être |\n|---|---|---|\n| Sans portfolio | 80 – 150 € | Les deux premiers mois, pas plus |\n| Portfolio + 3 clients | 180 – 280 € | À partir du 3e mois |\n| Niche identifiée | 300 – 450 € | Vers le 8e mois |\n| Expertise rare | 450 – 800 € | Secteur technique, langue, diplôme |\n\n### Les suppléments qui font le revenu\n\n| Supplément | Montant usuel |\n|---|---|\n| Droits illimités / perpétuels | + 50 à 100 % |\n| Whitelisting (pub depuis ton compte) | + 30 à 50 % par mois |\n| Territoire supplémentaire | + 20 à 30 % |\n| Version courte / déclinaison de format | + 30 à 50 € |\n| Hook alternatif supplémentaire | + 25 à 40 € |\n| Exclusivité sectorielle | à négocier, jamais offerte |\n\n### Le pack, à proposer par défaut\n\n| Pack | Contenu | Prix | Remise |\n|---|---|---|---|\n| Découverte | 3 vidéos | 3 × prix − 10 % | 10 % |\n| Test complet | 6 vidéos + 3 hooks | 6 × prix − 15 % | 15 % |\n| Abonnement | 4 à 8 vidéos / mois, 3 mois | mensuel ferme | 20 % |\n\nRègle : la remise se donne **contre du volume ou de l'engagement**, jamais\ncontre rien.\n"}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '88c6d93f-1b62-489a-a520-31ce0f0dfdd9'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7fbba8b4-8c3c-46e8-975f-d885ae9b9d7e'::uuid, m.id, m.course_id, m.org_id, 'ce-que-la-marque-achete', $sq$Ce que la marque achète réellement$sq$, $sq$Derrière chaque brief, une personne regarde un coût par achat tous les matins. Cette leçon te met dans sa tête : les trois chiffres qui décident de ton contrat, les quatre facteurs qui font qu'une créa marche, et le vocabulaire qui prouve que tu parles sa langue.$sq$, $sq$## L'accroche

Une responsable acquisition d'une marque de vêtements de sport reçoit trente candidatures de créatrices par semaine. Elle en ouvre cinq. Ce qu'elle cherche tient en une phrase qu'elle ne dira jamais dans son brief : « je veux baisser mon coût par achat ». Pas de la beauté, pas de l'authenticité, pas de la créativité. Un chiffre, qu'elle regarde tous les matins dans son gestionnaire de publicités, et qui décide de son budget du trimestre. Tant que tu ne comprends pas que ta vidéo est un levier sur ce chiffre, tu vends un objet joli à quelqu'un qui achète un résultat. Cette leçon te met dans sa tête, parce que c'est de là que viennent les bons prix et les bons arguments.

## Le contenu

### Le seul tableau de bord qui compte

La personne qui te paie regarde trois nombres.

**Le coût par achat** (ou coût par lead, ou coût par inscription selon le business). Ce que la marque dépense en publicité pour obtenir une vente. S'il monte, elle réduit les budgets, et ta commande disparaît.

**Le taux de clic sortant.** Le pourcentage de gens qui, en voyant la vidéo, cliquent vers le site. C'est là que ta créa agit le plus directement.

**Le taux de rétention à 3 secondes.** Combien de personnes regardent encore après trois secondes. C'est ton accroche, et rien d'autre.

Quand tu proposes une vidéo, tu proposes une hypothèse sur l'un de ces trois nombres. Formuler ça à voix haute te distingue de 90 % des candidatures.

### Ce qui fait qu'une créa marche

Quatre facteurs, tous sous ton contrôle.

**L'accroche des trois premières secondes.** Une phrase qui nomme un problème, une situation reconnaissable, ou une promesse chiffrée. Pas de logo, pas de « salut les amis », pas de plan d'ambiance.

**La reconnaissance.** La personne à l'écran doit ressembler à la cliente cible, pas à un mannequin. C'est pour ça que « vraie personne, vrai intérieur » revient dans tous les briefs.

**La démonstration.** Le produit doit être vu en usage, pas en présentation. Une texture qui s'étale, un vêtement qui bouge, une machine qu'on ouvre.

**L'appel à l'action.** Court, littéral, à la fin. « Le lien est en dessous » suffit ; les formules alambiquées font chuter le clic.

### Ce que la marque n'achète pas

Elle n'achète pas ton nombre d'abonnés — sauf en influence, ce qui est un autre métier.

Elle n'achète pas la qualité d'image en tant que telle. Au-delà d'un seuil de netteté et de lumière correcte, une image plus léchée n'améliore aucun des trois nombres, et peut même les dégrader en signalant « publicité ».

Elle n'achète pas ta créativité personnelle. Une idée brillante hors brief est un risque pour elle, pas un cadeau. Propose-la en variante, jamais à la place.

Elle n'achète pas une vidéo unique. Elle achète un **lot** qui lui permet de tester. C'est pour ça que vendre par pack de trois ou six est plus facile que vendre à l'unité, alors même que le montant est plus élevé.

### Les deux interlocutrices possibles

Tu tomberas sur deux profils, et ils n'écoutent pas les mêmes arguments.

**Le pôle acquisition ou performance.** Il pense en coût par achat, en volume de créas, en angles à tester. Il achète vite, renouvelle souvent, et se moque de l'esthétique. C'est le meilleur client d'une créatrice UGC.

**Le pôle marque ou social media.** Il pense en cohérence visuelle, en charte, en image. Il valide plus lentement, demande plus de retouches, mais paie parfois mieux et engage sur la durée.

Le même produit peut t'être commandé par les deux, avec des critères opposés. Demander dès le premier échange « c'est pour de la publicité ou pour vos réseaux ? » t'évite la moitié des malentendus du métier.

### Le vocabulaire à connaître

Cinq mots, qui t'ouvrent les portes parce qu'ils prouvent que tu parles leur langue : **créa** (la vidéo, vue comme un actif publicitaire), **angle** (l'argument choisi : gain de temps, prix, douleur évitée), **hook** (l'accroche des trois premières secondes), **fatigue créative** (le moment où une vidéo cesse de performer, dix à vingt jours), **itération** (une variante d'une créa qui marche).

## Exemple appliqué

Une marque de robots de cuisine à 349 € te contacte. Le brief tient en trois lignes : « une vidéo qui montre le produit, ton avis, format vertical ».

La mauvaise réponse : « d'accord, 200 €, je livre jeudi ».

La bonne : « Deux questions avant de vous répondre. C'est pour de la publicité ou pour votre compte ? Et quel est votre coût par achat aujourd'hui, ou au moins votre principal frein à l'achat ? »

Elle répond : publicité Meta, coût par achat à 62 €, et le frein est le prix — les gens trouvent l'appareil cher.

Tu proposes alors trois vidéos sur trois angles :

1. **L'angle prix décomposé.** « 349 €, ça m'a fait mal. Puis j'ai compté ce que je dépensais en plats préparés. » Accroche sur le chiffre, pas sur le produit.
2. **L'angle gain de temps.** Un plan fixe, une minute de préparation en accéléré, une phrase à la fin.
3. **L'angle objection.** « Je pensais que ça allait finir au fond d'un placard. Trois mois après, voilà à quelle fréquence je l'utilise. »

Tu factures 3 × 250 € plus 3 mois de droits, soit 900 €. La marque signe parce que tu as répondu à son problème et pas à sa demande. Deux mois plus tard, l'angle prix tourne à 38 € de coût par achat et tu es en abonnement mensuel.

## Les erreurs fréquentes

Livrer ce qui est demandé sans jamais demander pourquoi. Tu deviens interchangeable, donc négociable sur le seul prix.

Soigner l'image plutôt que l'accroche. Trois secondes décident de tout ; le reste ne rattrape jamais un début raté.

Mettre le logo et le nom du produit dans les deux premières secondes. C'est le réflexe qui tue la rétention : le cerveau identifie une publicité et passe.

Proposer une seule vidéo. Une marque qui n'a qu'une créa ne peut rien tester, donc rien conclure, donc ne reviendra pas.

Promettre un résultat chiffré. Tu ne contrôles ni le prix, ni la page produit, ni le ciblage. Promets une hypothèse et une exécution, jamais un coût par achat.

## Action immédiate

Choisis une marque que tu utilises. Écris en trois lignes : quel est son client type, quel est son frein à l'achat le plus probable, et quelle accroche de trois secondes attaquerait ce frein. Fais-le en dix minutes, sans chercher la perfection. Cet exercice est exactement le contenu du premier message de prospection que tu enverras au module 6 — et c'est ce qui fait ouvrir un message sur cinq au lieu d'un sur trente.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les deux questions à poser avant tout devis","description":"« C'est pour de la publicité ou pour vos réseaux ? » et « quel est votre principal frein à l'achat ? » — pourquoi ces deux-là, et quoi faire de chaque réponse.","kind":"checklist","url":null},{"title":"Lexique de l'acquisition","description":"Créa, angle, hook, fatigue créative, itération, coût par achat, rétention à 3 secondes : les mots que tes clients emploient entre eux.","kind":"template","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '88c6d93f-1b62-489a-a520-31ce0f0dfdd9'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ae4b3fdc-6400-44b7-a90d-865f2797a84d'::uuid, m.id, m.course_id, m.org_id, 'combien-on-gagne-vraiment', $sq$Combien on gagne vraiment, et en combien de temps$sq$, $sq$Les prix de marché réels, le calcul horaire qui juge tout, la trajectoire mois par mois des quatorze premiers mois, et le seuil du récurrent — le moment où le métier cesse de dépendre de la prospection.$sq$, $sq$## L'accroche

Sur TikTok, une vidéo à 800 000 vues promet 5 000 € par mois en UGC « sans audience, en travaillant deux heures par jour ». Dans la vraie vie, une créatrice qui démarre sérieusement facture entre 0 et 400 € son premier mois, 800 à 1 500 € au quatrième, et atteint 2 500 à 4 000 € vers le dixième si elle a construit du récurrent. Ces chiffres sont moins spectaculaires et beaucoup plus utiles, parce qu'ils permettent de décider si tu tiens le coup jusqu'au sixième mois — le moment où la plupart abandonnent, juste avant que ça démarre. Cette leçon pose la trajectoire réelle, le calcul horaire, et le seuil à partir duquel ce métier devient un revenu principal.

## Le contenu

### Les prix de marché en France

Pour une vidéo verticale de 15 à 45 secondes, livrée montée, avec droits publicitaires de trois mois sur un territoire :

- **Débutante sans portfolio** : 80 à 150 €. Cette zone existe, elle est courte, et elle ne doit pas durer plus de deux mois.
- **Créatrice avec portfolio et trois clients** : 180 à 280 €.
- **Créatrice installée, niche identifiée** : 300 à 450 €.
- **Spécialiste rare** (secteur technique, langue étrangère, expertise réelle) : 450 à 800 €.

À quoi s'ajoutent les suppléments qui font la différence entre un revenu correct et un revenu confortable : droits illimités ou perpétuels (+50 à +100 %), whitelisting (+30 à 50 % par mois), exclusivité (négociée à part), versions supplémentaires et déclinaisons de formats (+30 à 50 € l'unité).

### Le calcul horaire, seul juge

Une vidéo bien menée demande : 30 minutes d'écriture et de préparation, 45 minutes de tournage, 45 minutes de montage, 20 minutes de livraison et d'échanges. Soit **2 h 20** en moyenne au démarrage, et 1 h 15 quand tu connais la marque et que ton décor est prêt.

À 220 € la vidéo et 2 h 20 : 94 € de l'heure brut.
À 220 € la vidéo et 1 h 15 : 176 € de l'heure brut.

Retire les charges — micro-entreprise en prestation de services, 24,6 % de cotisations, plus l'impôt — et compte 60 à 70 % en net.

Ce calcul est le seul qui compte, et il explique pourquoi le vrai levier n'est pas d'augmenter les prix mais de **filmer en lots** : six vidéos pour la même marque dans une seule demi-journée font tomber le temps unitaire sous l'heure.

### La trajectoire réaliste

**Mois 1-2.** Portfolio, premières prospections, zéro à deux missions. Revenus : 0 à 400 €. C'est la phase où on abandonne. Objectif : trois vidéos de portfolio et quarante marques démarchées.

**Mois 3-4.** Deux à quatre missions. Revenus : 400 à 1 200 €. Une première marque qui recommande.

**Mois 5-8.** Le bouche-à-oreille et les premières récurrences. Revenus : 1 200 à 2 500 €. C'est ici que se décide la suite : celles qui construisent des abonnements mensuels décollent, celles qui restent à l'unité stagnent.

**Mois 9-14.** Deux à quatre marques en récurrent, plus du ponctuel. Revenus : 2 500 à 4 500 €. Le métier devient un revenu principal.

**Au-delà.** Trois voies : monter les prix en se spécialisant, déléguer le montage, ou passer studio en pilotant d'autres créatrices.

### Le seuil du récurrent

Un client ponctuel te rapporte une fois et te coûte une prospection entière. Un client en abonnement — quatre à huit vidéos par mois — te rapporte tous les mois et ne coûte plus rien à trouver.

Fais le calcul : trois marques à 1 200 € par mois, c'est 3 600 € de revenu prévisible avec **zéro prospection**. Le même chiffre en ponctuel demande une quinzaine de missions par mois et une prospection permanente.

C'est pour ça que tout, dans cette formation, pousse vers l'abonnement : la fidélisation a un module entier.

### Ce qu'il faut mettre de côté

Le métier a des trous. Août et fin décembre sont creux, les budgets marketing se recalent en janvier, une marque peut couper du jour au lendemain. Règle simple : garder trois mois de charges fixes en trésorerie avant de quitter un autre revenu, et ne jamais laisser un client dépasser **40 % de ton chiffre d'affaires**. Au-delà, ce n'est plus un client, c'est un employeur sans contrat de travail.

## Exemple appliqué

Sarah démarre en janvier, à côté d'un mi-temps.

**Janvier.** Elle tourne six vidéos de portfolio sur des produits qu'elle possède déjà. Zéro euro. Elle envoie 60 messages, obtient 4 réponses, 0 mission.

**Février.** Deux missions à 120 €. 240 €. Elle refait son portfolio avec ces deux vidéos réelles.

**Mars.** Elle monte à 180 € et décroche trois missions : 540 €. Une marque de café lui demande de refaire trois vidéos en avril.

**Avril.** 3 vidéos café à 180 € + 2 autres missions à 200 € : 940 €.

**Mai.** Elle propose au café un abonnement : 4 vidéos par mois, 640 €, engagement trois mois. Signé. Plus trois missions ponctuelles : 1 240 € au total.

**Juillet.** Deux abonnements (café + une marque de sport à 900 €), plus du ponctuel : 2 100 €. Elle réduit son mi-temps.

**Octobre.** Trois abonnements et une hausse de tarif à 260 € l'unité : 3 400 €. Elle arrête le mi-temps.

Dix mois. Aucun mois miraculeux, aucune vidéo virale, aucun coup de chance. Ce qui a tout fait : passer du ponctuel à l'abonnement dès le cinquième mois.

## Les erreurs fréquentes

Fixer ses prix sur ce que « les autres demandent » sur les groupes Facebook. C'est le meilleur moyen de s'aligner sur les moins expérimentées. Fixe-les sur ton calcul horaire.

Rester à l'unité par confort. Proposer un abonnement fait peur ; ne pas le proposer condamne à prospecter éternellement.

Compter en chiffre d'affaires et vivre en net. 3 000 € facturés en micro-entreprise, c'est environ 2 000 € réellement disponibles une fois cotisations et impôt provisionnés.

Baisser son prix pour décrocher une mission. La marque qui achète parce que c'est moins cher partira pour la même raison. La bonne variable d'ajustement est le **périmètre** — moins de vidéos, droits plus courts — jamais le prix unitaire.

Quitter son autre revenu au premier bon mois. Un mois à 2 000 € n'est pas une trajectoire. Trois mois consécutifs au-dessus de ton seuil, oui.

## Action immédiate

Calcule ton seuil : additionne tes charges fixes mensuelles, divise par 0,65 pour retrouver le chiffre d'affaires nécessaire, puis divise par ton prix cible à la vidéo. Tu obtiens le nombre de vidéos à vendre chaque mois pour vivre de ce métier. Écris ce nombre quelque part de visible. Toute la suite de la formation sert à l'atteindre, et il est presque toujours plus petit qu'on ne le craint.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Calculateur de seuil","description":"Charges fixes ÷ 0,65 = chiffre d'affaires nécessaire, divisé par ton prix cible = vidéos à vendre chaque mois. Le seul chiffre à garder sous les yeux.","kind":"template","url":null},{"title":"Checklist de sécurité financière","description":"Trois mois de charges en trésorerie avant de quitter un autre revenu, aucun client au-dessus de 40 % du chiffre d'affaires, provision de cotisations à chaque encaissement.","kind":"checklist","url":null},{"title":"Simulateur de cotisations Urssaf","description":"Pour convertir un chiffre d'affaires en revenu réellement disponible, avant de décider quoi que ce soit.","kind":"link","url":"https://www.urssaf.fr/accueil/outils-documentation/simulateurs.html"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '88c6d93f-1b62-489a-a520-31ce0f0dfdd9'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'c9381ffa-ffa6-49df-9bdb-5da17fa4ba43'::uuid, c.id, c.org_id, 'positionnement-ugc', $sq$Se positionner : niche, univers, personnage$sq$, $sq$Ce module transforme « je fais du lifestyle » en un positionnement qui fait signer : une niche vérifiée dans la bibliothèque publicitaire, un univers visuel tenu en cinq variables, un personnage à l'écran qui rend le tournage reproductible, et une vitrine où les marques te trouvent sans que tu démarches.$sq$, 2, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '97b543ac-3db3-4406-bb98-fe30cea6d51c'::uuid, m.id, m.course_id, m.org_id, 'choisir-sa-niche', $sq$Choisir sa niche (et pourquoi « lifestyle » n'en est pas une)$sq$, $sq$Une niche n'est pas un genre de contenu mais un problème de marque que tu sais résoudre. Cette leçon croise trois cercles — ce que tu utilises, ce qui dépense en publicité, ce que tu supportes de refaire trente fois — et valide le choix par un test factuel en trois questions.$sq$, $sq$## L'accroche

« Je fais du lifestyle. » C'est la réponse de neuf créatrices sur dix quand on leur demande leur niche, et c'est la raison pour laquelle huit d'entre elles ne reçoivent jamais de demande entrante. Lifestyle n'est pas une niche : c'est l'absence de niche déguisée en positionnement. Une marque de compléments pour sportifs qui cherche une créatrice ne tape pas « lifestyle » ; elle cherche quelqu'un qui court, qui parle de récupération, et dont les vidéos existantes montrent une salle de sport. Une niche, ce n'est pas un genre de contenu — c'est un **problème de marque que tu sais résoudre mieux que la moyenne**. Cette leçon te fait en choisir une, en dix minutes, avec le droit d'en changer.

## Le contenu

### Pourquoi une niche paie plus

Trois mécaniques, toutes vérifiables.

**Le prix.** Une créatrice généraliste est comparée à cinq cents autres sur le seul critère du tarif. Une créatrice qui a douze vidéos de compléments alimentaires dans son portfolio est comparée à trois personnes, et sur la compétence.

**La vitesse.** Tu connais déjà les objections du secteur, le vocabulaire réglementaire, les plans qui marchent. Tu écris un script en quinze minutes au lieu d'une heure. Ton tarif horaire double sans que ton prix bouge.

**L'entrant.** Les marques d'un même secteur se parlent, suivent les mêmes comptes, achètent aux mêmes salons. Trois clients dans une niche produisent des recommandations ; trois clients dans trois secteurs différents n'en produisent aucune.

### Les trois cercles

Une bonne niche est à l'intersection de trois choses. Prends une feuille et remplis les trois colonnes.

**Ce que tu utilises vraiment.** Les produits que tu as chez toi, les catégories où tu as un avis. C'est ce qui rend ta parole crédible en huit secondes.

**Ce qui dépense en publicité.** Une niche sans budget publicitaire n'a pas besoin de créas. Les secteurs qui dépensent : compléments et santé, beauté et soin, mode et accessoires, maison et déco, cuisine et petit électroménager, sport et fitness, animaux, puériculture, applications et logiciels grand public, e-commerce alimentaire.

**Ce que tu supportes de refaire trente fois.** Une niche, ce sont trente vidéos par an sur le même sujet. Si l'idée t'ennuie déjà, elle t'usera au sixième mois.

### Ce qui n'est pas une niche

« Lifestyle », « beauté », « bien-être », « food » : trop larges, ce sont des rayons de supermarché.

« Les femmes de 25-35 ans » : c'est une cible, pas une niche. Ton client n'est pas la consommatrice, c'est la marque.

« Vidéos esthétiques » : c'est un style, et tout le monde le revendique.

Une vraie niche ressemble à : « compléments alimentaires et nutrition sportive », « soin capillaire pour cheveux bouclés », « puériculture et premiers mois », « petit électroménager de cuisine », « applications de finance personnelle », « produits pour chiens ».

### Le test des trois questions

Avant de valider ta niche, réponds :

1. **Peux-tu citer dix marques du secteur de tête ?** Si non, tu n'y es pas assez immergée.
2. **Y en a-t-il au moins trois qui font de la publicité vidéo aujourd'hui ?** Va vérifier dans la bibliothèque publicitaire Meta. C'est un test factuel, pas une intuition.
3. **Peux-tu écrire trois accroches différentes sans chercher ?** Si les idées viennent, tu es dans ton sujet.

Trois oui, tu tiens ta niche. Deux oui, elle est jouable. Un seul, change.

### La niche secondaire

Une seule niche est fragile : un secteur peut ralentir, une réglementation changer. La bonne structure est **une niche principale et une secondaire**, choisies pour ne pas partager le même cycle. Beauté et animaux, par exemple : deux publics, deux saisonnalités, deux réseaux de marques.

Deux, jamais cinq. Cinq, c'est redevenir généraliste avec plus de travail.

### Le droit d'en changer

Une niche n'est pas un tatouage. On la reconsidère à trois mois, à six mois, puis une fois par an. Le signal d'un mauvais choix : tu as envoyé quarante messages ciblés et obtenu moins de deux réponses, ou tu repousses le tournage sans savoir pourquoi.

Changer coûte un après-midi de portfolio, pas une carrière.

## Exemple appliqué

Inès hésite. Elle a un compte « lifestyle » à 6 000 abonnés, elle aime la déco, elle fait du yoga, et elle a un chien.

Elle remplit les trois cercles.

**Ce qu'elle utilise vraiment** : croquettes premium, jouets, harnais, brosse — elle achète pour son chien tous les mois depuis quatre ans. La déco, elle la regarde plus qu'elle ne l'achète. Le yoga, elle en fait, mais n'achète aucun produit.

**Ce qui dépense** : elle ouvre la bibliothèque publicitaire Meta et cherche six marques d'alimentation pour chiens. Cinq ont des publicités actives, dont trois en format vertical avec des personnes qui parlent face caméra. La déco : deux sur six, en images fixes.

**Ce qu'elle supporte de refaire** : elle filme son chien tous les jours pour elle-même. Facile.

Verdict : niche principale **produits pour chiens**, niche secondaire **maison et rangement** — un public proche (des gens qui vivent avec un animal chez eux), une saisonnalité différente.

Elle refait son portfolio en une après-midi : quatre vidéos chien, deux vidéos maison. Elle écrit sa phrase : « Je produis des vidéos UGC pour les marques d'alimentation et d'accessoires pour chiens. »

Résultat à six semaines : 38 messages envoyés à des marques canines, 9 réponses, 3 missions. Le même volume de messages, en « lifestyle », lui avait rapporté une réponse en trois mois.

## Les erreurs fréquentes

Choisir une niche parce qu'elle paie bien, sans y être. Le manque de vécu se voit à l'écran en trois secondes, et les scripts deviennent une corvée.

Choisir un secteur sans budget publicitaire. L'artisanat, les créateurs indépendants, les petites boutiques : passionnants, sans budget créa. Vérifie toujours dans la bibliothèque publicitaire avant de t'engager.

Attendre d'être « légitime ». Personne ne l'est au début. La légitimité vient des douze vidéos que tu auras faites, pas d'un diplôme.

Empiler les niches pour ne rien rater. Cinq niches, c'est cinq portfolios à tenir et aucun message crédible.

Ne jamais reconsidérer. Une niche qui ne produit rien après quarante messages ciblés est une hypothèse fausse, pas une fatalité.

## Action immédiate

Prends une feuille, fais trois colonnes — ce que j'utilise, ce qui dépense en publicité, ce que je supporte de refaire trente fois — et remplis-les en dix minutes. Puis ouvre la bibliothèque publicitaire Meta et vérifie que trois marques de ta niche candidate diffusent bien de la vidéo verticale aujourd'hui. Écris ta phrase de positionnement. Elle sera en haut de ton portfolio et dans la première ligne de chacun de tes messages.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Fiche de choix de niche","description":"Les trois cercles à remplir, le test des trois questions, la niche secondaire et les dix secteurs à budget publicitaire réel.","kind":"document","url":null,"body":"## Fiche de choix de niche\n\n### Les trois cercles\n\n| Ce que j'utilise vraiment | Ce qui dépense en pub | Ce que je supporte de refaire 30 fois |\n|---|---|---|\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n\n**Intersection = ma niche candidate : ______________________**\n\n### Le test des trois questions\n\n| Question | Réponse | Vérifié comment |\n|---|---|---|\n| Je cite 10 marques du secteur de tête ? | oui / non | à l'écrit, sans chercher |\n| Au moins 3 diffusent de la vidéo verticale ? | oui / non | bibliothèque publicitaire Meta |\n| J'écris 3 accroches sans effort ? | oui / non | chrono de 10 minutes |\n\n3 oui → valide. 2 oui → jouable. 1 oui → change.\n\n### Niche secondaire\n\nChoisie pour ne **pas** partager la saisonnalité de la principale.\n\nPrincipale : ______________  Secondaire : ______________\n\n### Secteurs à budget publicitaire réel\n\nCompléments et santé · beauté et soin · mode et accessoires · maison et déco ·\ncuisine et petit électroménager · sport et fitness · animaux · puériculture ·\napplications grand public · e-commerce alimentaire.\n\n### Date de réexamen\n\nÀ 3 mois : ______  À 6 mois : ______  Puis une fois par an.\n\nSignal de mauvais choix : 40 messages ciblés, moins de 2 réponses.\n"},{"title":"Bibliothèque publicitaire Meta","description":"L'outil qui tranche la deuxième question : trois marques de ta niche diffusent-elles vraiment de la vidéo verticale aujourd'hui ?","kind":"tool","url":"https://www.facebook.com/ads/library"},{"title":"Checklist du réexamen","description":"Quand reconsidérer sa niche, et le signal d'un mauvais choix : quarante messages ciblés, moins de deux réponses.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'c9381ffa-ffa6-49df-9bdb-5da17fa4ba43'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f1f08a70-a835-4a08-8beb-d06342018d5b'::uuid, m.id, m.course_id, m.org_id, 'univers-visuel', $sq$Ton univers visuel : la signature qui fait revenir les marques$sq$, $sq$Cinq variables — lumière, fond, palette, cadrage, rythme — décidées une fois et tenues six mois. La cohérence vaut plus que la beauté : elle promet à la marque que la septième vidéo ressemblera aux six premières.$sq$, $sq$## L'accroche

Deux créatrices envoient leur portfolio à la même marque de soins. La première a six vidéos très différentes : une en cuisine avec une lumière chaude, une en salle de bain en contre-jour, une dehors, une en gros plan sur fond noir, deux avec des filtres opposés. La seconde a six vidéos qui se ressemblent : même lumière naturelle de côté, même fond neutre beige, même rythme, même façon de tenir le produit. La marque rappelle la seconde. Pas parce que ses vidéos sont plus belles — elles ne le sont pas — mais parce qu'elle sait exactement ce qu'elle va recevoir. Un univers visuel n'est pas de la coquetterie : c'est une **promesse de reproductibilité**, et c'est ce qu'achète quelqu'un qui doit commander six vidéos sans les voir avant.

## Le contenu

### Les cinq variables, et pas une de plus

Un univers visuel tient en cinq décisions. Prends-les une fois, tiens-les six mois.

**La lumière.** Une seule source, toujours la même. Fenêtre de côté à 45°, ou anneau lumineux frontal, ou lumière chaude de fin de journée. Choisis-en une et refuse les autres.

**Le fond.** Deux fonds maximum : un neutre (mur clair, rideau uni) et un contextuel (ta cuisine, ton bureau). Pas cinq pièces différentes.

**La palette.** Trois couleurs qui reviennent dans ce que tu portes et ce qu'on voit derrière. Beige-blanc-bois, ou noir-gris-vert, ou crème-terracotta-lin. Tu la choisis, tu ne l'improvises pas.

**Le cadrage.** Ta distance par défaut — buste, ou visage serré — et ta hauteur d'objectif, à la hauteur des yeux. Toujours la même.

**Le rythme.** Coupes serrées et énergiques, ou plans longs et posés. Ce choix se lit en deux secondes et signe autant que l'image.

### La différence entre style et signature

Un **style** se copie : un filtre, une transition à la mode, un type de police. Il vieillit en trois mois.

Une **signature** tient à des choix qui te ressemblent : ta façon d'entrer dans le plan, une manière de tenir l'objet, un geste récurrent, un type de lumière. Elle ne vieillit pas parce qu'elle n'est à personne d'autre.

Cherche la signature, pas le style. Concrètement : regarde tes cinq vidéos préférées de toi-même et note ce qu'elles ont en commun. C'est déjà ta signature ; le travail consiste à l'assumer, pas à l'inventer.

### Ce que la marque veut vraiment voir

Trois choses, dans cet ordre.

**Une image lisible.** Nette, éclairée, sans bruit numérique. C'est un seuil, pas un concours.

**Une cohérence.** Six vidéos qui se ressemblent valent plus que six vidéos brillantes et disparates, parce qu'elles prouvent que la septième leur ressemblera.

**Une compatibilité avec sa charte.** Une marque au packaging pastel n'ira pas chez une créatrice en univers noir et néon. Ce n'est pas un jugement : c'est un accord ou non.

### L'univers ne doit pas écraser le produit

Le piège de la créatrice qui soigne son image : un décor si travaillé que le produit disparaît. La règle : **le produit doit être l'objet le plus contrasté du cadre**. Si ton fond est chargé, le regard va au fond.

Test simple : mets ta vidéo en pause à trois moments au hasard, plisse les yeux. Si le produit n'est pas ce qu'on repère d'abord, le décor est trop fort.

### Construire son univers en une après-midi

1. Choisis ta source de lumière et repère l'heure où elle est bonne chez toi. Note-la.
2. Photographie trois coins de ton logement à cette heure. Garde les deux meilleurs.
3. Ouvre ton armoire, sors cinq hauts dans la même famille de couleurs. Ce sont tes tenues de tournage.
4. Filme trente secondes de test dans chaque fond, avec chaque haut. Regarde sur téléphone, à taille réelle.
5. Écris tes cinq décisions sur une fiche. Colle-la là où tu tournes.

## Exemple appliqué

Camille tourne dans quatre endroits différents selon son humeur. Ses vidéos sont correctes, ses taux de réponse mauvais.

Elle fait l'exercice un dimanche après-midi.

**Lumière** : sa fenêtre de salon donne au nord-est, elle est parfaite entre 9 h et 12 h. Toutes les vidéos se tourneront le matin.

**Fonds** : elle en garde deux. Un mur blanc cassé avec une plante à droite du cadre, et son plan de travail en bois clair vu de haut pour les plans produit.

**Palette** : blanc, bois, vert profond. Elle sort six hauts qui rentrent dedans et range les autres.

**Cadrage** : buste, objectif à hauteur d'yeux, produit tenu à hauteur de poitrine. Elle marque au sol l'emplacement du trépied avec un morceau de scotch.

**Rythme** : coupes toutes les 2 à 3 secondes, sans transition d'effet.

Elle retourne ses six vidéos de portfolio en une matinée avec ces règles. Résultat : le portfolio devient lisible, et surtout **elle tourne deux fois plus vite** — plus aucune décision à prendre au moment du tournage, ce qui est le vrai gain caché de l'exercice.

Deux mois plus tard, une marque de thé la contacte spontanément en écrivant : « votre univers correspond exactement à notre direction artistique ». Camille n'avait rien fait d'autre que de choisir cinq variables et s'y tenir.

## Les erreurs fréquentes

Changer d'univers à chaque tendance. Trois mois de cohérence valent mieux qu'une année de virages.

Confondre univers et matériel. Un mur blanc et une fenêtre battent un anneau lumineux mal placé.

Sur-décorer. Le produit doit rester l'élément le plus lisible du cadre ; un décor bavard le noie.

Filmer dans le désordre chez soi. Le désordre se voit et signale l'amateurisme, alors que la simplicité ne dit rien de mal. Deux mètres carrés rangés suffisent.

Refuser une marque parce qu'elle demande une lumière différente. Un univers est une signature, pas un dogme : une marque qui paie un plan spécifique l'obtient, elle achète aussi ta capacité à t'adapter.

## Action immédiate

Écris tes cinq variables sur une fiche : lumière, fonds, palette, cadrage, rythme. Puis filme trente secondes de test dans chacun de tes deux fonds retenus, à l'heure choisie, et regarde-les sur ton téléphone. Si les deux se ressemblent, tu tiens ton univers. Colle la fiche à l'endroit où tu tournes : elle t'évitera trente décisions par tournage.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Fiche d'univers visuel","description":"Les cinq décisions à écrire et à coller là où tu tournes, plus le test du produit le plus contrasté du cadre.","kind":"document","url":null,"body":"## Fiche d'univers visuel\n\nÀ coller là où tu tournes. Cinq décisions, tenues six mois.\n\n| Variable | Ma décision |\n|---|---|\n| Lumière (source unique + heure) |  |\n| Fond n° 1 (neutre) |  |\n| Fond n° 2 (contextuel) |  |\n| Palette (3 couleurs) |  |\n| Cadrage (distance + hauteur d'objectif) |  |\n| Rythme (durée moyenne d'un plan) |  |\n\n### Mes cinq tenues de tournage\n\n1. ______________\n2. ______________\n3. ______________\n4. ______________\n5. ______________\n\n### Le test du produit\n\nMets la vidéo en pause à trois moments au hasard et plisse les yeux.\nLe produit doit être l'élément le plus contrasté du cadre.\nSinon : simplifie le fond, pas le produit.\n\n### Ce que je ne fais pas\n\n- Pas de filtre à la mode qui datera la vidéo dans trois mois.\n- Pas de nouveau décor sans raison payée.\n- Pas de tournage hors de la fenêtre horaire choisie.\n"},{"title":"Checklist de l'après-midi de construction","description":"Les cinq étapes pour poser son univers en une demi-journée : lumière, fonds, tenues, tests, fiche.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'c9381ffa-ffa6-49df-9bdb-5da17fa4ba43'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '43d505e2-b9d0-41ca-9f47-16420762e78a'::uuid, m.id, m.course_id, m.org_id, 'le-personnage-a-l-ecran', $sq$Le personnage à l'écran : jouer soi-même, en mieux$sq$, $sq$À l'écran tu n'es pas toi-même, tu es une version cadrée de toi : un débit, un regard, une posture, un registre. Cette leçon les règle et donne l'entraînement de trois semaines qui fait passer de douze prises à trois.$sq$, $sq$## L'accroche

La question la plus fréquente en début de parcours : « je suis nulle face caméra, est-ce que je peux quand même faire de l'UGC ? » La réponse est oui, et pour une raison qui déroute : les meilleures créatrices UGC ne sont pas les plus à l'aise, ce sont les plus **précises**. À l'écran, tu n'es pas toi-même — tu es une version de toi cadrée, un personnage minimal avec un débit, une posture et un vocabulaire choisis. Un acteur n'improvise pas sa personnalité, il l'installe. Cette leçon construit ce personnage, parce que c'est lui qui rend les vidéos reproductibles et le tournage supportable.

## Le contenu

### Pourquoi un personnage

Trois raisons, toutes pratiques.

**La constance.** Une marque commande six vidéos ; elles doivent se ressembler même si tu es fatiguée le jeudi. Un personnage défini est un réglage qu'on rappelle, pas une humeur qu'on attend.

**La protection.** Ce qui est critiqué en commentaire, c'est le personnage, pas toi. Cette séparation vaut de l'or le jour où une publicité te fait vivre les commentaires de gens qui ne t'ont rien demandé.

**La vitesse.** Quand le personnage est posé, tu ne cherches plus le ton à chaque prise. Tu gagnes vingt minutes par tournage.

### Les quatre réglages

**Le débit.** Plus rapide que ta conversation normale, d'environ 15 %. Le débit naturel paraît mou à l'écran. Ne le pousse pas au-delà : au-delà de 20 %, ça sonne faux.

**Le regard.** Fixe l'objectif, pas l'écran. C'est contre-intuitif et c'est le geste qui change le plus une vidéo. Un point de couleur collé à côté de l'objectif t'y aide les premières semaines.

**La posture.** Épaules basses, buste légèrement de trois quarts, menton parallèle au sol. Le trois-quarts évite la photo d'identité ; le menton relevé donne un air condescendant, baissé un air d'excuse.

**Le registre.** Choisis-en un et tiens-le : la copine qui raconte, l'experte qui explique, ou l'utilisatrice sceptique convaincue. Les trois fonctionnent, les mélanger ne fonctionne pas.

### La règle de la première phrase

Ta première phrase se prépare, s'écrit, et se répète à voix haute cinq fois avant de tourner. C'est la seule du script qui doit être sue par cœur.

Raison : les trois premières secondes décident de la rétention, et c'est le moment où tu es la moins installée. Toutes les autres phrases peuvent être reformulées à la prise.

### Ce qui sonne faux, et pourquoi

**Réciter.** Le regard part chercher le texte en haut à gauche, le débit devient plat. Remède : ne mémorise que les idées, dans l'ordre, et laisse les mots venir.

**Sourire en permanence.** Un sourire continu est lu comme commercial. Souris à la fin, ou quand il y a une raison.

**Sur-articuler.** Le « ton présentateur » éloigne. Parle comme à quelqu'un qui est dans la pièce.

**Les formules de créateur.** « Coucou tout le monde », « n'hésitez pas à », « je vous laisse découvrir ». Elles signalent une publicité en deux secondes. Bannis-les.

### L'entraînement qui marche

Trois semaines, dix minutes par jour, et le problème est réglé.

**Semaine 1** : filme-toi 60 secondes par jour en parlant d'un objet posé devant toi. Ne regarde pas les vidéos.
**Semaine 2** : même exercice, puis regarde uniquement les trois premières secondes. Corrige une seule chose par jour.
**Semaine 3** : écris ta première phrase avant, répète-la cinq fois, puis filme. Compare la prise 1 et la prise 4 — l'écart te dira combien de prises il te faut.

C'est le seul entraînement nécessaire, et il fonctionne pour tout le monde. Ce qui ne fonctionne pas : attendre d'être à l'aise avant de commencer.

## Exemple appliqué

Nora se trouve « mauvaise à l'oral ». Elle fait douze prises par vidéo et abandonne souvent.

Elle pose son personnage.

**Registre** : l'utilisatrice sceptique. C'est son vrai tempérament, elle doute des promesses marketing. Elle en fait un atout : ses vidéos commencent souvent par une objection.

**Débit** : elle se filme deux fois, une fois normalement, une fois « comme si elle racontait un truc urgent à une amie ». La seconde est nettement meilleure. C'est son réglage.

**Regard** : elle colle une gommette orange au-dessus de l'objectif. En quatre jours, l'habitude est prise.

**Posture** : trois quarts, épaules relâchées. Elle remarque qu'elle monte les épaules quand elle stresse ; elle expire une fois avant chaque prise.

**Première phrase type** : « J'ai pas cru une seconde à ce truc. » Elle la décline selon les produits.

Après trois semaines d'exercice quotidien, elle passe de douze prises à trois. Sur une commande de six vidéos, ça représente **deux heures de tournage économisées** — et un montage bien plus rapide, parce que les prises sont utilisables.

Une marque lui écrit six mois plus tard : « on veut le même ton que votre vidéo sur le sérum, très direct ». Le personnage est devenu un argument commercial.

## Les erreurs fréquentes

Attendre d'être à l'aise pour commencer. L'aisance est le résultat de la pratique, pas sa condition.

Vouloir plaire à tout le monde. Un ton neutre ne retient personne. Le sceptique agace certains et convainc les autres : c'est exactement ce qu'on cherche en publicité.

Changer de registre à chaque marque. Une marque t'engage pour ton ton ; si elle en veut un autre, c'est une autre créatrice qu'il lui faut, et c'est très bien.

Regarder l'écran plutôt que l'objectif. Le spectateur sent que tu regardes à côté sans savoir pourquoi, et l'impression de connexion disparaît.

Multiplier les prises sans changer une variable. Douze prises identiques ne produisent pas de progrès. Change une chose entre chaque : le débit, l'attaque, la posture.

## Action immédiate

Filme-toi 60 secondes, aujourd'hui, en parlant d'un objet posé devant toi, sans script. Regarde uniquement les trois premières secondes et note une seule chose à corriger. Recommence demain avec cette correction. Fais-le dix jours de suite : c'est le seul exercice de cette formation qui demande de la répétition, et c'est celui qui change le plus de choses.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Fiche personnage","description":"Les quatre réglages, la première phrase type, les formules bannies et le programme d'entraînement quotidien sur trois semaines.","kind":"document","url":null,"body":"## Fiche personnage\n\n### Mes quatre réglages\n\n| Réglage | Ma décision |\n|---|---|\n| Débit (≈ +15 % de mon débit normal) |  |\n| Regard (objectif, repère collé si besoin) |  |\n| Posture (trois quarts, épaules basses) |  |\n| Registre (copine / experte / sceptique) |  |\n\n### Ma première phrase type\n\nElle s'écrit, se répète cinq fois à voix haute, et se sait par cœur.\nC'est la seule du script dans ce cas.\n\n« ____________________________________________ »\n\n### Formules bannies\n\n- « Coucou tout le monde »\n- « N'hésitez pas à »\n- « Je vous laisse découvrir »\n- « Je suis trop contente de vous présenter »\n- Tout sourire continu sans raison\n\n### L'entraînement des trois semaines\n\n| Semaine | Exercice quotidien (10 min) |\n|---|---|\n| 1 | 60 s face caméra sur un objet, sans regarder la vidéo |\n| 2 | Même chose, puis revoir **uniquement** les 3 premières secondes |\n| 3 | Première phrase écrite et répétée 5 fois, puis filmer |\n\nMesure du progrès : le nombre de prises nécessaires. De 12 à 3, c'est deux\nheures gagnées sur une commande de six vidéos.\n"},{"title":"Checklist d'avant-prise","description":"Expirer une fois, épaules basses, regard sur l'objectif, première phrase sue par cœur. Quatre points, dix secondes.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'c9381ffa-ffa6-49df-9bdb-5da17fa4ba43'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '51a1fe40-f495-4ca1-8641-98a8bbe072f7'::uuid, m.id, m.course_id, m.org_id, 'nommer-son-offre', $sq$Nommer son offre et se rendre trouvable$sq$, $sq$Une marque qui cherche une créatrice tape trois mots dans trois barres de recherche et a sa liste en quarante minutes. Cette leçon règle la bio, le nom de compte, le titre LinkedIn et les huit endroits où l'on doit pouvoir tomber sur toi.$sq$, $sq$## L'accroche

Une marque de cosmétiques cherche une créatrice pour six vidéos. Sa responsable acquisition tape « UGC creator France » dans la barre de recherche Instagram, puis « ugc beauté français » sur TikTok, puis regarde deux plateformes. En quarante minutes, elle a sa liste de cinq noms. Si tu n'es sur aucune de ces trois listes, tu n'existes pas pour cette commande — et pourtant tu es peut-être meilleure que les cinq. Se rendre trouvable est un travail distinct de la prospection : c'est ce qui fait venir des demandes pendant que tu dors. Cette leçon règle ta vitrine, ton nom, et les huit endroits où l'on doit pouvoir tomber sur toi.

## Le contenu

### Nommer son offre

Trois éléments à écrire une fois, à réutiliser partout.

**Le libellé de métier.** « Créatrice UGC » ou « UGC creator ». Écris les deux quelque part : les marques françaises cherchent avec les deux formulations, et beaucoup tapent l'anglais.

**La niche.** « Créatrice UGC — beauté & soin » vaut infiniment mieux que « créatrice UGC ». C'est ce mot qui te fait apparaître dans une recherche précise.

**La preuve.** Un chiffre ou un nom : « 40+ vidéos livrées », « ils m'ont fait confiance : X, Y, Z ». Sans preuve, la bio se lit comme une déclaration d'intention.

Format qui marche : **Créatrice UGC · Beauté & soin · 40+ vidéos livrées pour des marques françaises**.

### Le compte vitrine

Ton compte Instagram ou TikTok n'a pas besoin d'audience, il a besoin d'être **lisible en huit secondes**.

Quatre exigences :

- **La bio** contient le mot UGC, la niche, et un moyen de contact direct (email professionnel, pas de formulaire).
- **Les trois premières vidéos** sont tes trois meilleures créas, pas ta vie personnelle.
- **Un lien** mène au portfolio, en un clic, sans page intermédiaire.
- **Le nom du compte** contient « ugc » si possible : `lea.ugc`, `ugcparlea`. C'est un critère de recherche littéral.

Ce que ça n'a pas besoin d'être : régulier, engageant, personnel. Trois publications par mois suffisent si ce sont les bonnes.

### Les huit endroits où être trouvable

1. **Instagram** — compte vitrine, bio optimisée.
2. **TikTok** — même vitrine, mêmes mots-clés. Beaucoup de marques cherchent là en premier.
3. **Un portfolio en ligne** — page publique, sans mot de passe.
4. **LinkedIn** — le canal le plus sous-exploité du métier : c'est là que sont les responsables acquisition, et presque aucune créatrice n'y est.
5. **Deux plateformes UGC** au maximum, choisies dans la leçon dédiée.
6. **Un email professionnel** au nom de ton activité.
7. **Les groupes sectoriels** de ta niche, où les marques postent leurs recherches.
8. **La signature de tes commentaires** : commenter les publications LinkedIn de marques de ta niche te rend visible sans rien demander.

### Le mot-clé qui compte

Une marque ne cherche pas « créatrice de contenu ». Elle cherche « UGC ». Ce sigle doit apparaître dans : le nom du compte si possible, la bio, le titre LinkedIn, le titre de ton portfolio, et les légendes de tes publications vitrines.

C'est un détail de trois lettres qui décide de la moitié des demandes entrantes.

### Ce qu'on ne te demandera jamais

Ton nombre d'abonnés — sauf pour de l'influence. Ton taux d'engagement. Ta régularité de publication. Ton nombre d'années d'expérience.

Ce qu'on regardera : trois vidéos, ta niche, ta disponibilité, ton prix.

## Exemple appliqué

Julie a un compte perso à 900 abonnés, sans bio claire, avec des photos de vacances en tête de grille.

Elle passe deux heures dessus.

**Nom** : `julie.ugc.beaute` — le mot-clé est dans le nom.

**Bio** : « Créatrice UGC · Beauté & soin · 30+ vidéos pour des marques françaises · contact ↓ », avec son email en clair et le lien du portfolio.

**Grille** : elle épingle ses trois meilleures créas en tête. Elle ne supprime rien — le reste raconte une vraie personne, ce qui est un atout — mais ce qu'on voit en premier est du travail.

**LinkedIn** : elle change son titre en « Créatrice UGC — beauté & soin | vidéos publicitaires pour marques e-commerce ». Elle publie une fois par semaine une vidéo avec deux lignes d'analyse : « voici l'accroche, voici pourquoi elle retient ».

**Portfolio** : une page Notion publique, six vidéos, ses tarifs en fourchette, un bouton de contact.

Résultat sur trois mois : quatre demandes entrantes, dont trois via LinkedIn — le canal où elle avait zéro abonné au départ. Le plus rentable de ses huit points de présence est celui que personne n'utilise.

## Les erreurs fréquentes

Cacher son email derrière un formulaire ou un « DM pour collab ». Une responsable acquisition qui contacte cinq personnes ne fait pas cinq DM : elle envoie cinq emails.

Traiter le compte vitrine comme un compte perso. Les trois premières vidéos décident ; le reste peut rester humain.

Écrire « créatrice de contenu » au lieu de « créatrice UGC ». Le premier terme ne correspond à aucune recherche de marque.

Être sur six plateformes UGC. Chacune demande une fiche à tenir et des candidatures à envoyer. Deux, bien tenues, valent mieux.

Négliger LinkedIn parce qu'on n'y a pas d'audience. C'est précisément l'avantage : les décideurs y sont, et les créatrices n'y sont pas.

## Action immédiate

Réécris ta bio aujourd'hui avec les trois éléments — métier, niche, preuve — et mets ton email en clair. Puis change ton titre LinkedIn pour y faire figurer « Créatrice UGC » et ta niche. Ces deux modifications prennent quinze minutes et sont le seul travail de cette formation qui continue de produire des demandes quand tu ne fais rien.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Checklist de la vitrine","description":"Le modèle de bio, les six points à cocher, les huit points de présence et le titre LinkedIn — le canal le moins exploité du métier.","kind":"document","url":null,"body":"## Checklist de la vitrine\n\n### Bio (Instagram et TikTok)\n\nModèle : **Créatrice UGC · [niche] · [preuve] · contact ↓**\n\n- [ ] Le sigle « UGC » apparaît\n- [ ] La niche est nommée, pas « lifestyle »\n- [ ] Une preuve chiffrée ou trois noms de marques\n- [ ] Un email en clair, pas un formulaire, pas « DM pour collab »\n- [ ] Un lien qui mène au portfolio en un clic\n- [ ] Le nom de compte contient « ugc » si possible\n\n### Les huit points de présence\n\n| # | Endroit | Fait | Note |\n|---|---|---|---|\n| 1 | Instagram vitrine |  |  |\n| 2 | TikTok vitrine |  |  |\n| 3 | Portfolio public (sans mot de passe) |  |  |\n| 4 | LinkedIn (titre + 1 post / semaine) |  |  |\n| 5 | Plateforme UGC n° 1 |  |  |\n| 6 | Plateforme UGC n° 2 |  |  |\n| 7 | Email professionnel |  |  |\n| 8 | Groupes sectoriels de la niche |  |  |\n\nDeux plateformes maximum : chacune demande une fiche à tenir.\n\n### Titre LinkedIn\n\n« Créatrice UGC — [niche] | vidéos publicitaires pour marques e-commerce »\n\nC'est le canal le moins exploité du métier : les décideurs y sont, les\ncréatrices n'y sont pas.\n"},{"title":"LinkedIn","description":"Là où sont les responsables acquisition qui commandent les créas, et où presque aucune créatrice UGC n'est présente.","kind":"link","url":"https://www.linkedin.com"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'c9381ffa-ffa6-49df-9bdb-5da17fa4ba43'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid, c.id, c.org_id, 'portfolio-ugc', $sq$Le portfolio qui fait signer$sq$, $sq$Ce module produit, en une demi-journée et sans un euro, les six vidéos qui décrochent les trois premiers clients. Il enchaîne avec le spec ad — la vidéo non commandée qui multiplie par huit le taux de réponse —, le montage d'un portfolio qui s'ouvre du premier coup, le media kit en sept chiffres, et la règle du prix plancher.$sq$, 3, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '28f42eee-e0f1-491a-9c55-192eb0ddb7f9'::uuid, m.id, m.course_id, m.org_id, 'six-videos-de-depart', $sq$Les six vidéos de départ, sans aucune marque$sq$, $sq$Personne ne demande des vidéos commandées, on demande des vidéos. Six formats, une demi-journée, des produits que tu possèdes déjà : le portfolio qui rompt le cercle « pas de client sans portfolio, pas de portfolio sans client ».$sq$, $sq$## L'accroche

« Je ne peux pas faire de portfolio, je n'ai pas encore de client. » C'est le blocage le plus courant du métier, et il repose sur un malentendu : personne ne te demande des vidéos commandées, on te demande des **vidéos**. Une marque qui regarde ton portfolio veut savoir trois choses — sais-tu cadrer, sais-tu parler, sais-tu vendre un produit en trente secondes. Elle s'en moque totalement de savoir si le produit t'a été envoyé ou si tu l'avais déjà dans ta salle de bain. Ton portfolio de départ se tourne ce week-end, avec ce que tu possèdes, et il te fera signer tes trois premiers clients. Cette leçon dit exactement quelles six vidéos tourner.

## Le contenu

### Les six vidéos de départ

Six, pas trois : il faut montrer une gamme. Pas douze : personne ne regarde au-delà de six, et douze vidéos moyennes valent moins que six bonnes.

**1. Le témoignage face caméra.** Toi, buste, un produit en main, 30 secondes. Tu racontes un problème, l'essai, le résultat. C'est le format le plus commandé du métier, et le plus difficile : il n'a nulle part où se cacher.

**2. L'unboxing.** L'ouverture d'un colis ou d'un emballage, mains et produit, voix off. Rythme rapide, gros plans sur les matières. Aucun visage nécessaire — utile si tu débutes face caméra.

**3. La démonstration.** Le produit en usage, du début à la fin d'un geste : une crème qui s'étale, un appareil qu'on monte, un vêtement qu'on enfile. Zéro parole, une musique, des sous-titres.

**4. Le problème / solution.** Une accroche qui nomme une frustration, puis le produit comme réponse. C'est le format publicitaire par excellence, celui que les responsables acquisition cherchent en priorité.

**5. Le « 3 raisons ».** Trois arguments, trois plans, un rythme. Format lisible, facile à décliner, très demandé pour tester des angles.

**6. Le avant / après.** Deux états séparés par une coupe franche. Le format le plus performant en publicité, quand le produit s'y prête.

### Comment choisir les produits

Trois critères.

**Tu l'utilises vraiment.** Ça se voit dans les gestes : on tient différemment un objet qu'on connaît.

**Il appartient à ta niche.** Six vidéos dans le même secteur valent plus que six vidéos dans six secteurs. C'est ce qui rend le portfolio lisible.

**La marque a un budget publicitaire.** Vérifie dans la bibliothèque publicitaire. Filmer un produit d'une marque qui ne fait aucune publicité est un exercice, pas un argument commercial.

Ne nomme pas la marque à l'oral si tu n'as aucun accord. Montre le produit, parle du bénéfice. C'est une pratique universelle et acceptée pour un portfolio.

### Le tournage : une demi-journée

Tout se filme dans la même session, avec le même univers visuel.

- 30 minutes d'écriture : six scripts de cinq lignes, pas plus.
- 15 minutes de mise en place : lumière, trépied, marquage au sol.
- 2 heures de tournage : environ 20 minutes par vidéo, prises comprises.
- 2 heures de montage : 20 minutes par vidéo sur mobile.

Une journée, portfolio complet. Le blocage n'est jamais le temps, c'est la peur du premier plan.

### La qualité minimale, et son seuil

Il y a un seuil, et il est bas : image nette, visage éclairé, **son propre**, sous-titres lisibles. Au-delà, la beauté n'ajoute rien.

Le son est le seul point sans compromis. Une image moyenne passe ; un son avec de l'écho fait fermer la vidéo en deux secondes. Une leçon entière y est consacrée au module 4.

### Ce qu'on ne met pas dans un portfolio

Des vidéos de ta vie personnelle. Des vidéos sans produit. Des vidéos horizontales. Des vidéos de plus de 60 secondes. Des vidéos où le son est mauvais, même si l'idée est bonne.

Et surtout : **aucune vidéo dont tu ne serais pas fière si elle était la seule regardée**. Une marque regarde souvent une seule vidéo. Elle prend la première.

## Exemple appliqué

Sofia veut travailler avec des marques de soin capillaire. Elle a chez elle un shampoing solide, un masque, une brosse démêlante, un sérum et un sèche-cheveux.

Elle planifie son samedi.

**9 h — écriture.** Six scripts de cinq lignes. Le témoignage porte sur le masque : « Mes cheveux cassaient à chaque brossage. » L'unboxing sera le shampoing solide, dont l'emballage est beau. La démonstration : l'application du sérum, sans parole. Le problème/solution : la brosse démêlante contre les nœuds du matin. Le « 3 raisons » : le masque. L'avant/après : cheveux secs / cheveux après séchage.

**10 h — mise en place.** Fenêtre nord, trépied marqué au sol, micro-cravate branché, haut beige.

**10 h 30 à 12 h 30 — tournage.** Elle tourne dans l'ordre des formats les plus faciles aux plus exposés : unboxing, démonstration, avant/après, 3 raisons, problème/solution, témoignage. L'ordre compte : elle est chauffée quand arrive le format le plus difficile.

**14 h à 16 h — montage.** CapCut, sous-titres automatiques relus, une musique discrète sur les formats sans parole.

**16 h 30.** Six vidéos, publiées sur une page Notion.

Le lundi, elle envoie ses vingt premiers messages avec ce lien. Trois marques répondent, une commande deux vidéos à 150 €. Son portfolio lui a coûté un samedi et zéro euro.

## Les erreurs fréquentes

Attendre un vrai client pour faire un portfolio. C'est un cercle fermé : sans portfolio, pas de client ; sans client, pas de portfolio. Il faut le rompre par le haut.

Filmer six produits de six secteurs. Le portfolio devient illisible et ne prouve aucune spécialité.

Soigner l'esthétique et négliger le son. Le son est le seul critère éliminatoire.

Mettre douze vidéos. Personne ne regarde au-delà de la troisième. Six suffit, et les trois premières décident.

Utiliser des produits qu'on n'a jamais touchés. Les gestes trahissent, et une marque du secteur le voit immédiatement.

## Action immédiate

Ouvre tes placards et note cinq produits de ta niche que tu possèdes déjà. Bloque une demi-journée dans ton agenda, cette semaine, et écris-y « tournage portfolio ». Écris les six scripts de cinq lignes ce soir — c'est trente minutes, et c'est la seule chose qui se met entre toi et tes trois premiers clients.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Plan de tournage des six vidéos","description":"Les six formats avec ce que chacun prouve, le déroulé horaire de la demi-journée, l'ordre de tournage et le seuil de qualité.","kind":"document","url":null,"body":"## Plan de tournage : les six vidéos de portfolio\n\nUne demi-journée, zéro euro, avec ce que tu possèdes déjà.\n\n### Les six formats\n\n| # | Format | Ce qu'il prouve | Visage ? | Durée |\n|---|---|---|---|---|\n| 1 | Témoignage face caméra | Tu sais parler et convaincre | oui | 30 s |\n| 2 | Unboxing | Tu sais cadrer et rythmer | non | 20 s |\n| 3 | Démonstration | Tu sais montrer un usage | non | 25 s |\n| 4 | Problème / solution | Tu comprends la publicité | oui | 30 s |\n| 5 | « 3 raisons » | Tu sais structurer un argumentaire | oui | 35 s |\n| 6 | Avant / après | Tu sais construire une preuve | selon | 20 s |\n\n### Le déroulé de la demi-journée\n\n| Créneau | Étape | Durée |\n|---|---|---|\n| 9 h 00 | Six scripts de cinq lignes | 30 min |\n| 9 h 30 | Lumière, trépied, marquage au sol | 15 min |\n| 9 h 45 | Tournage, du plus facile au plus exposé | 2 h |\n| 14 h 00 | Montage mobile, 20 min par vidéo | 2 h |\n\n**Ordre de tournage** : unboxing → démonstration → avant/après → 3 raisons →\nproblème/solution → témoignage. Tu es chauffée quand arrive le plus difficile.\n\n### Choix des produits\n\n- [ ] Je l'utilise vraiment (les gestes trahissent)\n- [ ] Il appartient à ma niche\n- [ ] La marque diffuse de la publicité vidéo (vérifié en bibliothèque)\n\n### Seuil de qualité\n\nImage nette · visage éclairé · **son propre** · sous-titres lisibles.\nLe son est le seul critère éliminatoire. Une image moyenne passe, un écho non.\n\n### Ce qui ne rentre pas dans un portfolio\n\nVie personnelle · vidéo sans produit · format horizontal · plus de 60 secondes ·\nmauvais son · toute vidéo dont tu ne serais pas fière si c'était la seule vue.\n"},{"title":"CapCut","description":"Le montage mobile utilisé par la quasi-totalité du métier : sous-titres automatiques, formats verticaux, export sans filigrane.","kind":"tool","url":"https://www.capcut.com"},{"title":"Checklist d'avant-publication","description":"Image nette, visage éclairé, son propre, sous-titres relus, format 9:16, moins de 60 secondes.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ae9fda86-1925-4d17-afa6-d580742b9960'::uuid, m.id, m.course_id, m.org_id, 'le-spec-ad', $sq$Le spec ad : filmer pour une marque qui ne t'a rien demandé$sq$, $sq$Une vidéo tournée sans commande et offerte fait passer le taux de réponse de 5 % à 40 %. Les cinq règles pour qu'elle travaille, le message qui l'accompagne, et le cadre juridique en clair.$sq$, $sq$## L'accroche

Une créatrice envoie un message à une marque de café : « bonjour, je fais de l'UGC, voici mon portfolio ». Une autre envoie : « bonjour, j'ai tourné une vidéo pour vous ce week-end, la voici — aucune obligation, elle est à vous si elle vous plaît ». La seconde a un taux de réponse de 40 % là où la première plafonne à 5 %. Ce n'est pas de la magie commerciale : c'est la différence entre demander une chance et prouver qu'on l'a déjà saisie. Le spec ad — une créa spéculative, tournée sans commande — est l'outil le plus efficace du métier pour décrocher un premier client, et le plus mal compris. Cette leçon dit comment en faire une qui travaille, et à qui l'envoyer.

## Le contenu

### Ce qu'est un spec ad

Une vidéo publicitaire complète, tournée pour une marque précise, sans qu'elle l'ait demandée, et envoyée gratuitement.

Elle n'est pas un cadeau : c'est une démonstration. Tu ne donnes pas ton travail, tu montres ce que tu sais faire **sur leur produit**, ce qui supprime toute l'imagination que la marque devrait fournir pour te projeter.

### Pourquoi ça marche si bien

**Ça supprime la projection.** Un portfolio générique demande à ton interlocuteur d'imaginer le résultat sur ses produits. Un spec ad le lui montre.

**Ça prouve la compréhension.** Tu as choisi un angle, donc tu as compris leur client. C'est exactement ce qu'ils cherchent.

**Ça crée une dette légère.** Recevoir quelque chose d'utile gratuitement oblige à répondre, ne serait-ce que par politesse. Le taux de réponse explose.

**Ça teste sans risque pour eux.** Ils peuvent la diffuser le jour même. Certaines marques signent après avoir vu les résultats de ta vidéo offerte.

### Les cinq règles d'un bon spec ad

**1. Choisis une marque qui fait déjà de la publicité vidéo.** Vérifie dans la bibliothèque publicitaire. Une marque sans budget n'a rien à faire de ta vidéo.

**2. Regarde ce qui tourne déjà chez eux, et fais autre chose.** Si toutes leurs créas sont des démonstrations produit muettes, envoie un témoignage face caméra. Tu combles un manque, tu ne concurrences pas.

**3. Attaque une objection réelle.** Le prix, la peur que ça ne marche pas, la complexité d'usage. Va lire les avis clients sur leur site : les objections y sont écrites en toutes lettres, gratuitement.

**4. Une seule vidéo, pas trois.** Trois vidéos offertes ressemblent à du désespoir. Une seule, bien choisie, ressemble à un échantillon.

**5. Reste sous 30 secondes.** Ils la regarderont sur leur téléphone, entre deux réunions.

### Le message qui l'accompagne

Court, factuel, sans quémander.

> Bonjour [prénom],
>
> J'ai vu que vos publicités actuelles tournent surtout autour de [ce que tu as observé]. J'ai tourné une vidéo sur un autre angle — [l'objection choisie] — que vos avis clients mentionnent souvent.
>
> Elle est à vous, sans contrepartie : [lien].
>
> Si le format vous intéresse, je livre ce type de vidéo en 5 jours. Bonne journée.

Trois points comptent. Tu montres que tu as regardé leurs publicités. Tu donnes sans condition. Tu proposes une suite en une phrase, sans insister.

### Le cadre juridique, en clair

Tu peux filmer un produit que tu as acheté et montrer sa marque : c'est un usage informatif, licite. Ce que tu ne peux pas faire, c'est **diffuser toi-même** cette vidéo comme une publicité officielle, laisser croire à un partenariat, ou utiliser leur logo et leurs visuels de marque.

En pratique : tu envoies la vidéo à la marque, tu ne la publies pas comme une campagne. Si tu la mets dans ton portfolio, précise « créa spéculative, non commandée ». Cette mention te protège et, contre toute attente, impressionne : elle prouve l'initiative.

### Le rythme

Trois spec ads par mois, envoyés à trois marques différentes, choisies dans ta niche. Pas plus : c'est du travail non payé, et son rôle est d'amorcer, pas de devenir ton activité.

Au bout de trois mois, tu as neuf spec ads. Ils t'auront probablement rapporté deux à quatre clients, et surtout un portfolio entier de vraies marques.

## Exemple appliqué

Manon vise une marque de thés en vrac qui dépense visiblement en publicité Meta.

**Ce qu'elle observe.** Ses six publicités actives sont toutes des plans esthétiques de tasses fumantes, avec une voix off douce. Aucune ne montre quelqu'un.

**Ce qu'elle lit.** Sur la page produit, trois avis en deux semaines disent la même chose : « je ne savais pas comment doser ». Une objection d'usage, pas de prix.

**Ce qu'elle tourne.** Vingt-huit secondes. Accroche : « J'ai raté mon thé pendant deux ans à cause d'un truc que personne ne dit. » Puis le dosage montré en gros plan, la cuillère, l'eau, le temps. Fin : « Trois minutes, pas cinq. »

**Ce qu'elle écrit.** Le message ci-dessus, deux paragraphes, le lien, et rien d'autre.

**Ce qui se passe.** Réponse en trente-six heures : « on la diffuse dès demain, et on aimerait vous en commander cinq autres ». Cinq vidéos à 200 €, plus la première offerte. 1 000 € pour une prise de contact qui lui a coûté deux heures.

Trois mois plus tard, la marque est en abonnement mensuel. Tout est parti d'une vidéo non commandée, sur une objection lue dans les avis clients.

## Les erreurs fréquentes

Envoyer un spec ad à une marque qui ne fait aucune publicité. La vidéo n'a nulle part où aller ; le message tombe à plat.

Refaire ce qui tourne déjà. Tu te compares frontalement à ce qui fonctionne, au lieu d'ouvrir un angle libre.

Demander quelque chose en échange. « Je vous l'offre si vous me suivez » annule tout l'effet.

Envoyer trois vidéos d'un coup. Ça signale qu'on a du temps à perdre, donc pas de clients.

Publier le spec ad sur ses propres réseaux comme s'il s'agissait d'une campagne. C'est le seul point qui peut mal tourner juridiquement, et il est simple à éviter.

Faire dix spec ads par mois. C'est du travail gratuit qui remplace la prospection au lieu de l'amorcer.

## Action immédiate

Choisis une marque de ta niche, ouvre la bibliothèque publicitaire Meta et note en trois lignes ce que font déjà ses publicités. Puis va lire vingt avis clients sur son site et relève l'objection qui revient le plus. Tu as ton angle. Tourne la vidéo cette semaine et envoie-la avec le message type. C'est la seule action de cette formation dont le retour se mesure en jours.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Méthode et message du spec ad","description":"Les cinq règles, le message type mot pour mot, le tableau de ce qui est autorisé et interdit, et le rythme de trois par mois.","kind":"document","url":null,"body":"## Le spec ad : méthode et message\n\n### Les cinq règles\n\n1. La marque diffuse **déjà** de la publicité vidéo (vérifié en bibliothèque publicitaire).\n2. Tu fais **autre chose** que ce qui tourne chez elle — tu combles un manque.\n3. Tu attaques une **objection réelle**, lue dans ses avis clients.\n4. **Une seule** vidéo. Trois ressemblent à du désespoir.\n5. **Moins de 30 secondes.** Elle sera vue sur un téléphone entre deux réunions.\n\n### Le message d'accompagnement\n\n> Bonjour [prénom],\n>\n> J'ai vu que vos publicités actuelles tournent surtout autour de\n> [observation précise]. J'ai tourné une vidéo sur un autre angle —\n> [objection choisie] — que vos avis clients mentionnent souvent.\n>\n> Elle est à vous, sans contrepartie : [lien].\n>\n> Si le format vous intéresse, je livre ce type de vidéo en 5 jours.\n> Bonne journée.\n\nTrois principes : tu prouves que tu as regardé, tu donnes sans condition,\ntu proposes une suite en une phrase sans insister.\n\n### Le cadre juridique en clair\n\n| Autorisé | Interdit |\n|---|---|\n| Filmer un produit que tu as acheté | Utiliser le logo et les visuels de marque |\n| Montrer la marque à l'écran | Laisser croire à un partenariat existant |\n| Envoyer la vidéo à la marque | La diffuser toi-même comme campagne officielle |\n| La mettre au portfolio en la signalant | La présenter comme une commande |\n\nMention à porter au portfolio : « créa spéculative, non commandée ».\n\n### Rythme\n\n**Trois par mois**, pas plus. C'est un amorceur, pas une activité.\nNeuf spec ads sur un trimestre rapportent en général deux à quatre clients.\n"},{"title":"Checklist du choix de marque","description":"Publicité vidéo active, angle libre, objection lue dans les avis clients : les trois vérifications avant de tourner quoi que ce soit.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'e9b2cf6e-28c0-4338-9dfa-ece343a5070e'::uuid, m.id, m.course_id, m.org_id, 'monter-son-portfolio', $sq$Monter son portfolio : Notion, site ou PDF$sq$, $sq$Un portfolio se juge en huit secondes, et la moitié se perd sur des détails techniques invisibles. La structure en six sections, les six vérifications, et la règle d'entretien par substitution.$sq$, $sq$## L'accroche

Un portfolio se juge en huit secondes. Pas huit minutes : huit secondes, le temps de charger la page, voir la première vignette et décider de rester. Sur ces huit secondes, la moitié se perd en général à cause de détails techniques : un lien qui demande une autorisation d'accès, une page qui met six secondes à charger, une vidéo en 16:9 dans un lecteur minuscule, un mot de passe. Ces détails coûtent des contrats sans jamais laisser de trace : personne ne t'écrira pour dire « votre lien Drive était en accès restreint ». Cette leçon monte un portfolio qui ouvre du premier coup, se lit sur téléphone, et donne envie de te contacter.

## Le contenu

### Les trois formats possibles

**Une page Notion publique.** Gratuit, monté en une heure, se met à jour en dix secondes. C'est le choix par défaut, et il suffit à la grande majorité. Attention à un seul réglage : la page doit être publiée en accès public, pas partagée par lien restreint.

**Un site simple.** Un nom de domaine à quinze euros par an et un constructeur de page. Plus crédible, plus long à maintenir. Utile après six mois, pas avant.

**Un PDF.** À garder en secours pour les marques dont le pare-feu bloque tout. Il pèse vite ; garde-le sous 10 Mo avec des vignettes cliquables plutôt que des vidéos intégrées.

Ce qu'il ne faut pas faire : envoyer un dossier Drive brut. C'est la première cause de portfolio jamais ouvert.

### La structure, dans l'ordre

**1. Ta phrase.** Une ligne : métier, niche, preuve. « Créatrice UGC — beauté & soin. 40 vidéos livrées pour des marques françaises. »

**2. Les vidéos, en grille verticale.** Six maximum, les trois meilleures en premier. Format 9:16, lecture directe, sans clic supplémentaire.

**3. Les formats que tu produis.** Une liste courte : témoignage, unboxing, démonstration, problème/solution, avant/après, voix off. Ça permet à la marque de savoir quoi commander.

**4. Ce que tu livres.** Fichiers MP4, 9:16 et 1:1, sous-titres incrustés ou fichier séparé, délai de cinq jours ouvrés, deux allers-retours inclus. Cette section évite la moitié des questions.

**5. Les marques, s'il y en a.** Logos ou noms. Si tu n'en as aucune, saute la section : une section vide fait plus de mal que son absence.

**6. Le contact.** Email en clair, en gros. Pas de formulaire.

### Les tarifs : afficher ou non

Question tranchée dans la leçon suivante ; en résumé pour la page : **une fourchette de départ**, pas une grille complète. « À partir de 200 € la vidéo. » Ça filtre les demandes hors budget sans t'enfermer.

### Les erreurs techniques qui coûtent des clients

- **Le lien restreint.** Teste toujours ton lien en navigation privée. C'est le test qui sauve le plus de contrats.
- **Les vidéos qui ne se lisent pas sur mobile.** 70 % des ouvertures se font au téléphone.
- **Le poids.** Une page qui met plus de trois secondes à charger perd la moitié de ses visiteurs.
- **Les vidéos horizontales.** Elles disent « je n'ai pas compris le métier ».
- **Le mot de passe.** Aucun portfolio ne doit en avoir.

### La mise à jour

Toutes les six semaines, remplace la vidéo la plus faible par la meilleure des dernières livrées. Le portfolio doit rester à six vidéos : il grossit par substitution, pas par accumulation.

Garde une archive à part de tout ce que tu as livré — utile pour les demandes spécifiques (« vous avez déjà filmé du matériel de cuisine ? ») sans alourdir la page principale.

## Exemple appliqué

Élodie monte son portfolio Notion un mardi soir.

**En haut** : « Créatrice UGC — maison & rangement. 18 vidéos livrées. Basée à Nantes. »

**La grille** : six vidéos en 9:16, chargées directement dans Notion (pas de lien YouTube, qui ajoute un clic et une suggestion de vidéo concurrente à la fin). Les trois premières sont sa démonstration de rangement, son avant/après placard et son témoignage.

**Formats produits** : six lignes.

**Ce que je livre** : « MP4 9:16 et 1:1 · sous-titres incrustés · 5 jours ouvrés · 2 retours inclus · droits publicitaires 3 mois France, extensions possibles ».

**Marques** : trois noms, sans logo — elle n'a pas demandé l'autorisation d'utiliser les logos, et les noms suffisent.

**Contact** : son email, en taille de titre.

**Tarif** : « À partir de 220 € la vidéo ».

Elle ouvre le lien en navigation privée sur son téléphone : la page charge en deux secondes, les vidéos se lancent. Elle envoie.

Un mois plus tard, une marque lui écrit : « votre section "ce que je livre" a fait la décision, on savait exactement ce qu'on achetait ». La section la plus ennuyeuse du portfolio est celle qui a converti.

## Les erreurs fréquentes

Ne jamais tester son lien en navigation privée. C'est l'erreur la plus silencieuse et la plus fréquente.

Mettre vingt vidéos. Le portfolio devient un catalogue, la qualité moyenne baisse, et personne ne va au-delà de la troisième.

Ouvrir sur une présentation personnelle. La marque veut voir du travail, pas lire une biographie. Ta phrase suffit.

Cacher son email. Un contact difficile est un contact perdu.

Laisser un portfolio dater. Des vidéos d'il y a un an, alors que ton niveau a doublé, te font perdre des contrats que tu mériterais.

Intégrer des vidéos YouTube. À la fin de chaque lecture, la plateforme propose des vidéos d'autres créatrices. Charge les fichiers directement.

## Action immédiate

Monte la page ce soir, même incomplète : la phrase, les six vidéos, la section « ce que je livre », l'email. Une heure suffit. Puis ouvre le lien en navigation privée depuis ton téléphone et chronomètre le chargement. Si tu as dû te connecter ou attendre plus de trois secondes, corrige avant d'envoyer quoi que ce soit — c'est ce test qui sépare un portfolio utile d'un portfolio jamais vu.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Structure du portfolio","description":"L'ordre des six sections, le modèle de la section « ce que je livre » qui convertit, et les six vérifications techniques dont le test en navigation privée.","kind":"document","url":null,"body":"## Structure du portfolio\n\n### L'ordre des sections\n\n1. **Ta phrase** — métier, niche, preuve. Une ligne.\n2. **Six vidéos** en 9:16, les trois meilleures d'abord, lecture directe.\n3. **Les formats produits** — témoignage, unboxing, démonstration, problème/solution, avant/après, voix off.\n4. **Ce que je livre** — la section la plus ennuyeuse, et celle qui convertit.\n5. **Les marques**, s'il y en a. Sinon on saute : une section vide fait du mal.\n6. **Le contact** — email en clair, en gros.\n\n### Modèle de la section « Ce que je livre »\n\n> Fichiers MP4 · formats 9:16 et 1:1 · sous-titres incrustés\n> Délai : 5 jours ouvrés après réception du produit\n> 2 allers-retours inclus\n> Droits publicitaires 3 mois, France, tous supports numériques\n> Extensions de droits et de territoire sur devis\n\n### Les six vérifications techniques\n\n- [ ] Lien testé **en navigation privée** (la première cause de portfolio jamais vu)\n- [ ] Page chargée en moins de 3 secondes\n- [ ] Vidéos lues sur téléphone (70 % des ouvertures)\n- [ ] Aucun format horizontal\n- [ ] Aucun mot de passe, aucune demande d'accès\n- [ ] Fichiers chargés directement, pas d'intégration YouTube\n\n### Entretien\n\nToutes les six semaines : remplacer la vidéo la plus faible par la meilleure\ndes dernières livrées. Le portfolio grossit **par substitution**, jamais par\naccumulation. Six vidéos, toujours.\n"},{"title":"Notion","description":"La page publique gratuite qui sert de portfolio par défaut. Attention au réglage : publiée en accès public, pas partagée par lien restreint.","kind":"tool","url":"https://www.notion.so"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'fd172fba-ad46-402d-b559-8a6fc0ecdb04'::uuid, m.id, m.course_id, m.org_id, 'le-media-kit', $sq$Le media kit : une page, sept chiffres$sq$, $sq$Le media kit d'une créatrice UGC ne parle pas d'audience mais de production. Les sept chiffres qu'une marque veut, ce qu'on n'y met jamais, et le moment exact où l'envoyer — au deuxième échange, jamais au premier.$sq$, $sq$## L'accroche

Le media kit est le document que 90 % des créatrices UGC construisent mal, parce qu'elles le copient sur celui des influenceuses. Un media kit d'influenceuse est une carte d'audience : abonnés, portée, âge des followers, taux d'engagement. Le tien ne parle pas d'audience — il parle de **production**. Ce que ton client veut savoir tient en sept chiffres : combien de vidéos tu as livrées, en combien de jours, dans quels formats, à quel prix, avec quels droits, quelle capacité mensuelle, et combien de retours sont inclus. Une page. Cette leçon la construit ligne par ligne, et explique pourquoi ces sept chiffres valent mieux qu'une plaquette de douze pages.

## Le contenu

### Media kit ou portfolio ?

Deux objets différents, souvent confondus.

Le **portfolio** montre le travail : c'est une page web, publique, avec des vidéos.

Le **media kit** répond aux questions d'achat : c'est un PDF d'une à deux pages, envoyé en pièce jointe quand une marque devient sérieuse. Il sert à la personne qui doit faire valider un budget en interne, et qui a besoin d'un document à transférer.

Beaucoup s'en passent au début. Il devient utile dès que tu vises des marques structurées, où quelqu'un doit convaincre quelqu'un d'autre.

### Les sept chiffres

**1. Le volume livré.** « 42 vidéos livrées » ou « 18 vidéos depuis janvier ». Un chiffre, pas une estimation floue.

**2. Le délai.** « 5 jours ouvrés après réception du produit. » C'est le chiffre le plus regardé après le prix.

**3. Les formats.** « 9:16, 1:1, 16:9 sur demande » et la liste des types : témoignage, démonstration, unboxing, problème/solution, avant/après, voix off.

**4. Le prix de départ.** Une fourchette, pas un tarif final. « À partir de 220 € la vidéo, dégressif par pack. »

**5. Les droits inclus.** « Droits publicitaires 3 mois, France, tous supports numériques. Extensions sur devis. » C'est ce qui te distingue de celles qui ne savent pas de quoi elles parlent.

**6. La capacité mensuelle.** « Jusqu'à 12 vidéos par mois. » Ça rassure sur la possibilité d'un abonnement.

**7. Les retours inclus.** « 2 allers-retours compris, au-delà 40 € la reprise. » Poser ce chiffre évite la moitié des conflits du métier.

### Ce qu'on ajoute autour

Une phrase de positionnement en tête. Trois vignettes de vidéos avec liens cliquables. Les noms des marques déjà servies, s'il y en a. Ton email et ton statut juridique (numéro SIRET), qui rassure les services comptables.

Et rien d'autre. Pas de moodboard, pas de « ma philosophie », pas de photo pleine page.

### Le format du fichier

PDF, une à deux pages, sous 5 Mo, nommé lisiblement : `MediaKit-Prenom-Nom-UGC.pdf`. Un fichier nommé `Sans titre (3).pdf` fait mauvaise impression avant même d'être ouvert.

Les vignettes vidéo doivent être **cliquables** vers ton portfolio : un PDF ne lit pas les vidéos de façon fiable, et intégrer les fichiers le rend illisible par le poids.

### Quand l'envoyer

Jamais en premier contact — un PDF en pièce jointe d'un premier message finit en spam ou non ouvert. Le premier message contient un lien vers le portfolio.

Le media kit s'envoie au deuxième échange, quand on te demande « tu peux nous envoyer tes tarifs et tes conditions ». C'est exactement la question à laquelle il répond, et l'envoyer sous une heure te distingue.

### Le mettre à jour

Tous les trimestres. Trois chiffres bougent : le volume livré, le prix de départ, et les marques servies. Le reste est stable.

Un media kit qui affiche « 8 vidéos livrées » alors que tu en as fait 60 te fait perdre de l'argent, littéralement.

## Exemple appliqué

Chloé envoie son media kit après six mois d'activité.

**Page 1.**

En-tête : « Chloé M. — Créatrice UGC · Compléments alimentaires & nutrition sportive ».
Sous-titre : « 47 vidéos livrées · 11 marques · délai 5 jours ouvrés ».

Un bloc de trois vignettes cliquables.

Un tableau de sept lignes, exactement les sept chiffres ci-dessus.

Pied de page : email, SIRET, lien portfolio.

**Page 2.**

Les packs : 3 vidéos à 594 €, 6 vidéos à 1 122 €, abonnement 8 vidéos par mois à 1 408 € engagement 3 mois.
Les suppléments : droits illimités +60 %, whitelisting +40 % par mois, format supplémentaire 40 €, hook alternatif 30 €.
Les conditions : acompte 40 % à la commande, solde à la livraison, 2 retours inclus.

Deux pages, aucun mot inutile.

Une marque de protéines lui répond : « c'est le premier document clair qu'on reçoit, on part sur le pack 6 ». La clarté a fait la vente, pas le prix — qui était le plus élevé des trois devis reçus.

## Les erreurs fréquentes

Copier un media kit d'influenceuse. Les statistiques d'audience n'intéressent pas un acheteur de créas, et leur présence signale une confusion de métier.

Faire douze pages. Personne ne les lit, et le poids empêche le transfert interne.

Intégrer les vidéos dans le PDF. Illisible, lourd, souvent cassé. Des vignettes cliquables, toujours.

L'envoyer en premier contact. Un PDF non sollicité en pièce jointe est le meilleur moyen d'atterrir en spam.

Ne pas y mettre les droits. C'est la ligne qui te fait passer pour une professionnelle, et son absence te fera offrir des usages.

Le laisser périmer. Trois chiffres à changer tous les trois mois, dix minutes de travail.

## Action immédiate

Écris tes sept chiffres sur une feuille, maintenant, même si certains sont petits. « 6 vidéos livrées » est un vrai chiffre, et il vaut mieux que rien. Mets-les en page sur une seule feuille, exporte en PDF avec un nom propre, et range-le : il partira au deuxième échange de ta prochaine négociation, pendant que les autres mettront deux jours à répondre.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Media kit — les sept chiffres","description":"Le tableau à remplir, la page des packs et suppléments, les conditions à écrire, ce qu'on n'y met jamais et le rythme de mise à jour.","kind":"document","url":null,"body":"## Media kit — les sept chiffres\n\nUne à deux pages, PDF sous 5 Mo, nommé `MediaKit-Prenom-Nom-UGC.pdf`.\nS'envoie au **deuxième** échange, jamais en premier contact.\n\n| # | Ligne | Ma valeur |\n|---|---|---|\n| 1 | Volume livré |  |\n| 2 | Délai (jours ouvrés) |  |\n| 3 | Formats produits |  |\n| 4 | Prix de départ |  |\n| 5 | Droits inclus (durée, territoire, supports) |  |\n| 6 | Capacité mensuelle |  |\n| 7 | Retours inclus, et prix au-delà |  |\n\n### Page 2 : packs et suppléments\n\n| Pack | Contenu | Prix |\n|---|---|---|\n| Découverte | 3 vidéos |  |\n| Test complet | 6 vidéos |  |\n| Abonnement | 8 vidéos / mois, 3 mois |  |\n\n| Supplément | Montant |\n|---|---|\n| Droits illimités | + 50 à 100 % |\n| Whitelisting | + 30 à 50 % / mois |\n| Format supplémentaire | 30 à 50 € |\n| Hook alternatif | 25 à 40 € |\n\n### Conditions à écrire\n\nAcompte 40 % à la commande · solde à la livraison · 2 retours inclus ·\nSIRET · email.\n\n### Ce qu'on n'y met pas\n\nStatistiques d'audience · moodboard · « ma philosophie » · photo pleine page ·\nvidéos intégrées (des vignettes cliquables, toujours).\n\n### Mise à jour\n\nTrimestrielle. Trois lignes bougent : volume livré, prix de départ, marques\nservies. Dix minutes.\n"},{"title":"Canva","description":"Pour mettre en page le media kit en une heure et l'exporter en PDF léger, sans logiciel de PAO.","kind":"tool","url":"https://www.canva.com"}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7b37ab62-618e-46e5-837c-6dd8e53eb964'::uuid, m.id, m.course_id, m.org_id, 'afficher-ses-tarifs', $sq$Afficher ses tarifs ou non : ce que ça change$sq$, $sq$Afficher filtre et ancre, cacher ouvre et expose au bradage. La solution du prix plancher prend les avantages des deux, et les trois questions à poser avant tout chiffre évitent la perte d'argent la plus courante du métier.$sq$, $sq$## L'accroche

« Est-ce que je mets mes tarifs sur mon portfolio ? » La réponse dépend d'une seule chose, et ce n'est pas ton niveau : c'est le type de clients que tu veux attirer. Afficher un prix filtre. Ne pas l'afficher ouvre la conversation. Les deux stratégies fonctionnent, elles ne produisent simplement pas la même clientèle — et la plupart des créatrices choisissent par timidité plutôt que par stratégie, ce qui donne le pire des deux mondes : un tarif caché qu'on finit par brader au téléphone. Cette leçon tranche, avec la solution intermédiaire qui marche presque toujours.

## Le contenu

### Ce que l'affichage produit

**Il filtre.** Les marques hors budget ne t'écrivent plus. Tu perds des demandes, tu perds surtout des heures d'échanges qui n'auraient rien donné.

**Il ancre.** Le prix affiché devient la référence. Négocier depuis 250 € affichés se termine rarement sous 200 € ; négocier depuis rien se termine parfois à 90 €.

**Il crédibilise.** Un prix assumé dit « je sais ce que je vaux ». Son absence peut se lire comme « ça dépend de ce que vous êtes prêts à mettre », ce qui invite à essayer bas.

**Il te bloque à la hausse.** C'est le vrai coût : une marque très bien financée avec un besoin complexe verra ton prix affiché et ne te proposera jamais plus.

### Ce que l'absence de prix produit

**Elle ouvre la conversation**, donc plus de demandes — mais beaucoup d'entre elles sont hors sujet.

**Elle permet d'ajuster** selon le budget, la complexité et les droits. C'est le principal argument, et c'est un vrai argument : le prix juste d'une vidéo dépend d'au moins cinq variables.

**Elle coûte du temps.** Trois échanges pour découvrir qu'ils ont 80 € par vidéo.

**Elle expose au bradage.** Sans ancre, on répond au budget annoncé plutôt qu'à sa propre grille.

### La solution qui marche : le prix plancher

Affiche **« à partir de X € »** et rien d'autre.

Tu obtiens le filtrage (les marques à 80 € ne t'écrivent plus), l'ancrage (X devient le bas de la fourchette, pas le haut), et la liberté de monter selon les droits, le volume, la complexité.

Le X à choisir : ton prix normal pour une vidéo simple, droits trois mois. Pas ton prix bradé, pas ton prix de rêve.

### Comment répondre à « c'est combien ? »

Le réflexe à prendre : **ne jamais donner un prix sans avoir posé trois questions.**

1. Combien de vidéos ?
2. Où seront-elles diffusées, et pendant combien de temps ?
3. Pour quelle date ?

Ces trois réponses font varier le prix du simple au triple. Répondre « 220 € » avant de les avoir est la façon la plus courante de perdre de l'argent dans ce métier.

Formulation type : « Ça dépend du volume et des droits — trois questions rapides et je vous envoie un chiffre ferme aujourd'hui. »

### Le piège du budget annoncé

Une marque qui annonce son budget d'entrée — « on a 500 € pour cette campagne » — pose un plafond, pas un prix. La bonne réaction n'est pas de facturer exactement 500 €, c'est de **construire un périmètre qui tient dans 500 €** : deux vidéos au lieu de trois, droits trois mois au lieu de six.

Tu protèges ton prix unitaire, qui est la seule chose qui compte sur la durée, et tu restes dans leur budget. Personne ne perd.

### Le prix qui monte

Ton prix affiché n'est pas gravé. Change-le tous les trois à quatre mois, à la hausse, tant que ton taux d'acceptation reste au-dessus de 50 %.

Un taux d'acceptation de 90 % est un signal clair : tu es trop bon marché. Le bon taux se situe entre 50 et 70 % — en dessous, tu es trop cher pour ton positionnement ; au-dessus, tu laisses de l'argent sur la table.

## Exemple appliqué

Alice n'affiche rien. Elle reçoit une dizaine de demandes par mois, dont sept hors budget, et passe quatre heures par mois en échanges stériles.

Elle passe à « à partir de 200 € la vidéo » sur son portfolio.

**Mois suivant** : six demandes au lieu de dix, mais cinq sérieuses. Elle signe trois missions au lieu de deux, et gagne trois heures.

**Sur une demande précise** : une marque de bougies écrit « on aimerait 4 vidéos, budget 600 € ». Ancien réflexe : accepter, soit 150 € la vidéo. Nouveau réflexe : « Avec 600 €, je vous propose 3 vidéos avec droits 6 mois, ou 4 vidéos avec droits 3 mois — les deux tiennent dans votre budget, à vous de voir ce qui sert le mieux la campagne. »

La marque choisit trois vidéos à 200 €. Alice a tenu son prix unitaire, la marque a eu le choix, et la relation démarre sur une négociation d'égal à égal.

**Trois mois plus tard**, son taux d'acceptation est à 85 %. Elle passe à 250 €. Il redescend à 65 %. Elle y reste.

## Les erreurs fréquentes

Ne pas afficher de prix par peur de faire fuir. Le résultat est une perte de temps massive et un ancrage systématiquement bas.

Afficher une grille complète. Trop d'information invite à comparer ligne par ligne et à découper ta prestation.

Donner un prix avant les trois questions. Le prix juste dépend du volume, des droits et du délai : sans eux, tu devines.

Accepter le budget annoncé comme prix. Un budget est un plafond. Ajuste le périmètre, jamais le prix unitaire.

Ne jamais augmenter. Un tarif figé depuis un an sur un taux d'acceptation de 90 % coûte plusieurs milliers d'euros par an.

Baisser pour un « gros client qui pourrait rapporter plus tard ». Le tarif d'entrée devient le plafond de toute la relation ; le « plus tard » n'arrive jamais à un meilleur prix.

## Action immédiate

Choisis ton prix plancher et écris-le sur ton portfolio ce soir, sous la forme « à partir de X € la vidéo ». Puis note les trois questions — volume, diffusion et durée, délai — sur une note épinglée dans ton téléphone. La prochaine fois qu'on te demande un prix, tu poseras les trois avant de répondre. C'est le geste qui rapporte le plus vite dans tout ce module.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"La règle du prix plancher","description":"Le comparatif des trois stratégies, les trois questions à poser avant tout prix, la réponse à un budget annoncé et le thermomètre du taux d'acceptation.","kind":"document","url":null,"body":"## Afficher ses tarifs : la règle du prix plancher\n\n### Ce que produit chaque stratégie\n\n| | Prix affiché | Aucun prix | **Prix plancher** |\n|---|---|---|---|\n| Filtre les hors-budget | oui | non | **oui** |\n| Ancre la négociation haut | oui | non | **oui** |\n| Laisse monter selon les droits | non | oui | **oui** |\n| Coûte du temps en échanges | non | beaucoup | **peu** |\n\n**Formule à écrire au portfolio : « À partir de X € la vidéo. »**\n\nX = ton prix normal pour une vidéo simple, droits 3 mois.\nNi le prix bradé, ni le prix de rêve.\n\n### Les trois questions avant tout prix\n\nÀ épingler dans ton téléphone. Ne jamais donner un chiffre avant de les avoir\nposées — elles font varier le prix du simple au triple.\n\n1. **Combien de vidéos ?**\n2. **Diffusées où, et pendant combien de temps ?**\n3. **Pour quelle date ?**\n\nFormulation : « Ça dépend du volume et des droits — trois questions rapides et\nje vous envoie un chiffre ferme aujourd'hui. »\n\n### Face à un budget annoncé\n\nUn budget annoncé est un **plafond**, pas un prix.\nNe baisse jamais le prix unitaire : réduis le **périmètre**.\n\n> « Avec 600 €, je vous propose 3 vidéos avec droits 6 mois, ou 4 vidéos avec\n> droits 3 mois. Les deux tiennent dans votre budget. »\n\n### Le thermomètre du taux d'acceptation\n\n| Taux d'acceptation | Lecture | Action |\n|---|---|---|\n| > 85 % | Trop bon marché | Monter de 20 % |\n| 50 – 70 % | Bon niveau | Ne rien changer |\n| < 40 % | Trop cher pour le positionnement | Baisser ou monter en gamme |\n\nRéexamen tous les trois à quatre mois.\n"},{"title":"Checklist de révision tarifaire","description":"Tous les trois à quatre mois : relever le taux d'acceptation, comparer à la fourchette 50-70 %, ajuster de 20 % le cas échéant.","kind":"checklist","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '39f83a24-e1ce-4397-85f6-1f54d7ea73ce'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'e7512d8c-e646-43d7-84cf-a2e49724bd3a'::uuid, c.id, c.org_id, 'materiel-studio', $sq$Le matériel et le studio maison$sq$, $sq$Ce module coupe court à la tentation d'acheter avant de tourner : six réglages de téléphone, moins de cent euros de matériel utile, et trois variables qui décident vraiment de la qualité perçue — la lumière, le son, et un coin de tournage prêt en quatre minutes.$sq$, 4, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '4024b3df-ff99-412a-98f3-09f23d520656'::uuid, m.id, m.course_id, m.org_id, 'ton-telephone-suffit', $sq$Ton téléphone suffit — les six réglages qui changent tout$sq$, $sq$Plus une image ressemble à une publicité, moins elle fonctionne comme publicité. Les six réglages que personne n'active par défaut, la liste des quatre achats rentables, et celle du matériel qui ne sert à rien au début.$sq$, $sq$## L'accroche

Une créatrice a dépensé 1 400 € en trois mois : appareil hybride, objectif lumineux, stabilisateur, deux panneaux LED. Ses vidéos n'ont pas mieux performé. Pire, deux marques lui ont demandé de « refaire plus naturel ». Le paradoxe du métier tient en une phrase : **plus ton image ressemble à une publicité, moins elle fonctionne comme publicité**. Le téléphone que tu as dans la poche filme mieux que ce dont ce métier a besoin — à condition de connaître six réglages que personne n'active par défaut. Cette leçon les donne, et explique pourquoi ton budget matériel des six premiers mois doit rester sous 150 €.

## Le contenu

### Les six réglages à faire une fois

**1. La résolution : 1080p, pas 4K.** La 4K quadruple le poids des fichiers, sature ta mémoire, ralentit le montage, et aucune plateforme publicitaire ne diffuse au-delà de 1080p en vertical. La seule raison de filmer en 4K est de recadrer en post-production ; ce n'est pas ton cas.

**2. La cadence : 30 images par seconde.** 60 fps donne un rendu « vidéo de télé », qui casse l'effet naturel. Réserve le 60 fps aux plans que tu comptes ralentir.

**3. Le verrouillage d'exposition et de mise au point.** Sur iPhone comme sur Android : appui long sur le sujet jusqu'à ce que « AE/AF verrouillé » apparaisse. Sans ça, l'image change de luminosité chaque fois que tu bouges la main. C'est le défaut le plus visible des vidéos amateures.

**4. La caméra arrière, jamais la frontale.** La frontale est deux à trois fois moins bonne. Filme avec l'arrière et cadre à l'aide d'un miroir posé derrière le téléphone, ou de la fonction d'aperçu si ton modèle la propose.

**5. Le mode HDR désactivé.** Il produit des images qui virent au gris sur certains lecteurs et complique le montage. Désactive-le dans les réglages vidéo.

**6. Le nettoyage de l'objectif.** Trivial et pourtant responsable d'un tiers des images floues ou voilées. Un coup de tissu avant chaque tournage.

### Le matériel qui vaut vraiment son prix

Dans l'ordre du rapport résultat/euro :

**Un micro-cravate filaire — 25 à 60 €.** C'est le seul achat vraiment obligatoire. Le son est le premier critère de rejet d'une vidéo.

**Un trépied avec rotule et adaptateur téléphone — 25 à 40 €.** Il libère tes deux mains et fige le cadre. Une image stable au trépied bat une image tremblante à 2 000 €.

**Un réflecteur pliable blanc — 15 €.** Il renvoie la lumière de la fenêtre sur le côté sombre de ton visage. Effet spectaculaire, prix ridicule. Un carton blanc fait la même chose gratuitement.

**Un anneau lumineux — 40 à 80 €.** Utile seulement si tu ne peux pas tourner de jour. Il produit une lumière plate et un reflet circulaire dans les yeux qui signale « créateur de contenu ».

Total conseillé pour démarrer : **65 à 100 €**. Micro, trépied, réflecteur.

### Le matériel qui ne sert à rien au début

Un appareil hybride ou reflex : rendu trop cinéma, fichiers lourds, mise au point capricieuse sur un visage qui bouge.

Un stabilisateur : tes plans sont fixes ou très courts.

Des panneaux LED bicolores : la fenêtre fait mieux, gratuitement.

Un fond vert : personne n'en commande en UGC.

Un deuxième téléphone « pour le multicam » : la complexité de montage n'est pas payée.

### La règle de la lumière naturelle

Une fenêtre, sur le côté, sans soleil direct. C'est tout. Le soleil direct crée des ombres dures et des zones brûlées ; un ciel couvert est la meilleure lumière du monde et il est gratuit.

Repère l'heure où ta pièce est bonne, note-la, et tourne toujours dans ce créneau. C'est une contrainte qui te fera gagner plus de temps qu'elle n'en coûte.

### Ce que les marques demandent vraiment

Relis dix briefs : tu y trouveras « authentique », « vrai intérieur », « pas trop produit », « comme si c'était filmé par une cliente ». Aucun ne dit « qualité cinéma ».

Ton avantage concurrentiel n'est pas la technique. Il est dans l'accroche, le rythme et la crédibilité.

## Exemple appliqué

Emma veut « investir dans du bon matériel » avant de démarcher. Elle a 900 € de côté.

Elle fait le test conseillé : tourner la même vidéo deux fois, une au téléphone bien réglé, une avec l'appareil emprunté à son frère.

**Version téléphone** : 1080p, 30 fps, exposition verrouillée, micro-cravate à 32 €, fenêtre de côté, trépied à 29 €.

**Version hybride** : belle profondeur de champ, image plus douce, deux plans flous à cause de la mise au point automatique, son enregistré séparément à resynchroniser.

Elle envoie les deux à trois marques en demandant laquelle leur convient. Les trois choisissent la version téléphone. L'une écrit : « la deuxième fait pub, la première fait vraie cliente ».

Emma dépense finalement 61 € — micro et trépied — et garde 839 €. Elle les utilisera huit mois plus tard pour un objectif macro à clipser à 25 € et un deuxième micro, quand ses tarifs auront doublé.

Le seul achat qui a changé quelque chose dans ses vidéos, à ses propres yeux, c'est le micro-cravate. Le reste était du confort.

## Les erreurs fréquentes

Acheter avant de tourner. Le matériel devient une raison de repousser le premier tournage, et c'est sa fonction inconsciente.

Filmer en 4K. Fichiers énormes, montage lent, aucun gain diffusé.

Utiliser la caméra frontale. Deux à trois fois moins bonne, et c'est visible.

Oublier de verrouiller l'exposition. L'image qui « respire » en luminosité trahit l'amateurisme plus que n'importe quel défaut.

Tourner en contre-jour. La fenêtre doit être devant toi ou sur le côté, jamais derrière.

Croire qu'un meilleur appareil compensera une accroche faible. Rien ne compense les trois premières secondes.

## Action immédiate

Prends ton téléphone maintenant et fais les six réglages : 1080p, 30 fps, HDR désactivé, caméra arrière, objectif nettoyé, et entraîne-toi au verrouillage AE/AF par appui long. Puis filme trente secondes devant ta fenêtre principale à trois heures différentes de la journée et compare. Tu auras identifié ton créneau lumière, ce qui vaut plus que n'importe quel achat.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Les six réglages et le budget matériel","description":"Le tableau des réglages avec leur raison, les quatre achats rentables chiffrés, et ce qu'il ne faut surtout pas acheter les six premiers mois.","kind":"document","url":null,"body":"## Les six réglages du téléphone\n\nÀ faire une fois, à vérifier avant chaque session.\n\n| Réglage | Valeur | Pourquoi |\n|---|---|---|\n| Résolution | **1080p**, pas 4K | Aucune plateforme ne diffuse plus en vertical ; la 4K sature la mémoire |\n| Cadence | **30 fps** | 60 fps donne un rendu « télé » qui casse le naturel |\n| Exposition / mise au point | **verrouillées** (appui long) | Sinon l'image respire en luminosité — le défaut le plus visible |\n| Caméra | **arrière**, jamais frontale | 2 à 3 fois meilleure |\n| HDR | **désactivé** | Vire au gris sur certains lecteurs, complique le montage |\n| Objectif | **nettoyé** | Un tiers des images voilées viennent de là |\n\n### Budget matériel des six premiers mois\n\n| Achat | Prix | Obligatoire ? |\n|---|---|---|\n| Micro-cravate filaire | 25 – 60 € | **Oui, le seul** |\n| Trépied + adaptateur téléphone | 25 – 40 € | Oui en pratique |\n| Réflecteur pliable blanc (ou carton) | 0 – 15 € | Très rentable |\n| Anneau lumineux | 40 – 80 € | Seulement si tu tournes le soir |\n\n**Total conseillé : 65 à 100 €.**\n\n### Ce qui ne sert à rien au début\n\nHybride ou reflex (rendu trop cinéma, mise au point capricieuse) · stabilisateur\n(tes plans sont fixes) · panneaux LED (la fenêtre fait mieux) · fond vert\n(jamais commandé en UGC) · deuxième téléphone pour le multicam.\n\n### Le rappel qui vaut tout le matériel\n\nRelis dix briefs : « authentique », « vrai intérieur », « pas trop produit »,\n« comme si c'était filmé par une cliente ». Aucun ne dit « qualité cinéma ».\n"},{"title":"Checklist d'achat","description":"Micro-cravate d'abord, trépied ensuite, réflecteur enfin. Rien d'autre avant que les tarifs aient doublé.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'e7512d8c-e646-43d7-84cf-a2e49724bd3a'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0a9cbe69-fffa-4409-84ed-1b4cd4c6328d'::uuid, m.id, m.course_id, m.org_id, 'la-lumiere', $sq$La lumière : la seule dépense qui se voit (et elle est gratuite)$sq$, $sq$Direction, douceur, température : trois qualités et quatre schémas suffisent. L'exercice d'un après-midi qui fixe ton créneau de tournage pour de bon, et le test des yeux qui règle 80 % des problèmes en deux secondes.$sq$, $sq$## L'accroche

Prends deux vidéos identiques : même personne, même texte, même produit, même téléphone. Change une seule chose, la lumière. La première est filmée avec la fenêtre dans le dos, la seconde avec la fenêtre sur le côté. La première a un visage sombre sur un fond brûlé ; la seconde a un visage modelé, des yeux qui brillent, une peau lisible. Aucune retouche ne rattrapera la première, et aucun appareil à trois mille euros non plus. La lumière est la seule variable technique qui décide vraiment de la qualité perçue d'une vidéo UGC — et c'est la seule qui soit entièrement gratuite. Cette leçon donne les quatre schémas à connaître et le moyen de les reproduire chez toi, tous les jours, au même endroit.

## Le contenu

### Les trois qualités d'une lumière

**La direction.** D'où elle vient. C'est ce qui crée le relief. Une lumière frontale aplatit, une lumière latérale modèle, une lumière arrière découpe.

**La douceur.** Une source large et proche donne des ombres dégradées ; une source petite et lointaine donne des ombres nettes. Une fenêtre voilée est une source large : c'est pour ça qu'elle flatte tout le monde.

**La température.** Chaude (fin de journée, ampoule) ou froide (ciel couvert, néon). Ce qui compte n'est pas laquelle, c'est de **n'en mélanger qu'une seule** : deux températures dans le même plan donnent un visage moitié orange moitié bleu, et c'est irrattrapable au montage.

### Les quatre schémas à connaître

**1. La fenêtre latérale à 45°.** Tu es de trois quarts, la fenêtre à ta gauche ou ta droite, légèrement en avant. C'est le schéma par défaut de tout le métier : relief, yeux vivants, ombre douce du côté opposé. Ajoute un réflecteur ou un carton blanc du côté sombre pour adoucir.

**2. La fenêtre frontale.** Tu fais face à la fenêtre. Lumière très douce, peau lissée, peu de relief. Idéal pour les vidéos beauté et les gros plans de visage.

**3. La lumière rasante pour les textures.** La source presque de côté, très basse ou très haute, pour faire ressortir le grain d'une crème, le tissage d'un vêtement, la vapeur d'un plat. Réservée aux plans produit.

**4. L'anneau lumineux, en secours.** Frontal, plat, avec un reflet circulaire dans les yeux. Il dépanne le soir. Ne l'utilise pas comme lumière principale de jour : il signale la création de contenu, ce qui est exactement l'inverse de l'effet recherché.

### Ce qu'il faut fuir

**Le contre-jour.** Fenêtre derrière toi : ton visage devient une silhouette et le téléphone expose sur la fenêtre. Aucune correction ne sauve ça.

**Le plafonnier.** Lumière du dessus : cernes marqués, nez ombré, teint gris. C'est la pire lumière disponible chez soi.

**Le soleil direct.** Ombres dures, yeux plissés, zones brûlées. Attends un nuage ou pose un voilage.

**Le mélange.** Fenêtre bleutée plus lampe orange dans le même plan. Éteins les lampes quand tu tournes de jour.

### Le voilage, l'accessoire à trois euros

Un rideau blanc fin, un drap tendu, ou même une feuille de papier calque devant la fenêtre transforment une lumière dure en lumière de studio. C'est le meilleur rapport qualité/prix du métier, très loin devant n'importe quel panneau LED.

### Trouver son créneau

Un après-midi, une fois pour toutes : photographie ton visage devant chaque fenêtre de ton logement à 9 h, 11 h, 14 h, 16 h et 18 h. Regarde les vingt photos côte à côte.

Tu identifieras un créneau — souvent deux à trois heures — où une fenêtre donne une lumière large et sans soleil direct. Ce créneau devient ton horaire de tournage, et cette contrainte est une libération : plus jamais de décision à prendre sur la lumière.

### Le test des yeux

Un seul contrôle avant de lancer l'enregistrement : **regarde tes yeux dans l'image**. S'il y a un petit reflet de la source lumineuse dedans, ta lumière est bonne. S'ils sont éteints, la source est trop haute, trop loin ou derrière toi.

Ce test de deux secondes règle 80 % des problèmes de lumière.

## Exemple appliqué

Léna tourne le soir, après son travail, avec un anneau lumineux. Ses vidéos sont propres et sans vie ; une marque lui a écrit « on cherche quelque chose de plus naturel ».

Elle fait le tour de son appartement un samedi.

**Salon, fenêtre ouest** : superbe à 17 h, mais soleil direct qui brûle un côté du visage.
**Chambre, fenêtre nord** : lumière constante de 9 h à 15 h, douce, sans soleil direct jamais. C'est la gagnante.
**Cuisine, fenêtre sud** : trop dure sauf par temps couvert.

Elle installe son coin de tournage dans la chambre, à un mètre de la fenêtre, de trois quarts. Elle pose un carton blanc de récupération sur une chaise, à gauche, pour renvoyer la lumière.

Elle refait la même vidéo qu'elle avait envoyée à la marque. Différence : le visage a du relief, les yeux ont un reflet, la peau n'est plus grise.

Elle bascule ses tournages au samedi et dimanche matin, en lots de six vidéos. La marque la rappelle deux mois plus tard sur une autre campagne.

Coût total du changement : zéro euro et un carton.

## Les erreurs fréquentes

Acheter de la lumière avant d'avoir exploré ses fenêtres. La solution est presque toujours déjà chez toi.

Filmer en contre-jour. C'est le seul défaut d'image totalement irrattrapable.

Mélanger deux températures. Éteins les lampes quand tu tournes de jour, c'est tout.

Utiliser le plafonnier. Aucune vidéo n'a jamais été améliorée par un plafonnier.

Tourner quand ça arrange, plutôt que quand la lumière est bonne. Le créneau lumière doit dicter l'agenda, pas l'inverse.

Oublier le réflecteur. Quinze euros, ou un carton blanc, pour un gain visible immédiatement sur le côté sombre du visage.

## Action immédiate

Ce week-end, photographie-toi devant chaque fenêtre de ton logement à cinq heures différentes. Compare les vingt images et choisis la combinaison fenêtre + créneau qui donne le meilleur visage. Note-la sur ta fiche d'univers visuel. Puis pose un carton blanc du côté opposé et refais une photo : c'est la différence que ton portfolio attendait.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les quatre schémas de lumière","description":"Placement, usage et piège de chaque schéma, les quatre choses à fuir, le voilage à trois euros, la grille de repérage des fenêtres et le test des yeux.","kind":"document","url":null,"body":"## Les quatre schémas de lumière\n\n| Schéma | Placement | Pour quoi | Piège |\n|---|---|---|---|\n| Fenêtre latérale 45° | Toi de trois quarts, fenêtre en avant sur le côté | Le défaut du métier : relief, yeux vivants | Ajouter un réflecteur du côté sombre |\n| Fenêtre frontale | Face à la fenêtre | Beauté, gros plans visage | Peu de relief |\n| Rasante | Source basse ou haute, presque de côté | Textures produit, crème, tissu, vapeur | Inutilisable sur un visage |\n| Anneau lumineux | Frontal | Dépannage du soir | Reflet circulaire = signature « créateur » |\n\n### Les quatre choses à fuir\n\n| À fuir | Effet | Rattrapable ? |\n|---|---|---|\n| Contre-jour | Visage en silhouette | **Non** |\n| Plafonnier | Cernes, nez ombré, teint gris | Non |\n| Soleil direct | Ombres dures, zones brûlées | Attendre un nuage ou voiler |\n| Mélange de températures | Visage moitié orange moitié bleu | Non — éteins les lampes de jour |\n\n### Le voilage à trois euros\n\nUn rideau blanc fin, un drap tendu ou du papier calque devant la fenêtre\ntransforme une lumière dure en lumière de studio. Meilleur rapport\nqualité/prix du métier, loin devant tout panneau LED.\n\n### Trouver son créneau — l'exercice d'un après-midi\n\nPhotographie ton visage devant **chaque fenêtre** du logement à 9 h, 11 h,\n14 h, 16 h et 18 h. Compare les vingt images.\n\n| Fenêtre | 9 h | 11 h | 14 h | 16 h | 18 h |\n|---|---|---|---|---|---|\n|  |  |  |  |  |  |\n|  |  |  |  |  |  |\n\n**Mon créneau : ______________ , fenêtre ______________**\n\n### Le test des yeux\n\nAvant chaque prise : regarde tes yeux dans l'image. Un petit reflet de la\nsource dedans = lumière bonne. Yeux éteints = source trop haute, trop loin,\nou derrière toi. Deux secondes, 80 % des problèmes réglés.\n"},{"title":"Checklist du repérage lumière","description":"Photographier chaque fenêtre à cinq heures de la journée, comparer, noter le créneau. Une fois, pour toujours.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'e7512d8c-e646-43d7-84cf-a2e49724bd3a'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '5638dd4d-3de7-4bfd-a6d8-f0243df5a69e'::uuid, m.id, m.course_id, m.org_id, 'le-son', $sq$Le son : là où se trahissent 80 % des vidéos amateures$sq$, $sq$Un spectateur pardonne une image moyenne et ferme sur un son fatigant sans savoir pourquoi. Les trois ennemis, le contrôle au casque en dix secondes, et pourquoi une musique trouvée en ligne rend une vidéo inutilisable en publicité.$sq$, $sq$## L'accroche

Une marque reçoit deux candidatures. La première vidéo a une image parfaite et un son avec de l'écho, la voix un peu lointaine, un léger souffle. La seconde a une image correcte et un son propre, chaud, proche. La marque prend la seconde, et si on lui demande pourquoi, elle répondra « la deuxième était plus pro » — sans savoir nommer la cause. Le son est la variable la plus sous-estimée du métier, et la seule qui provoque une fermeture en moins de deux secondes. Un spectateur pardonne une image moyenne ; il ne supporte pas un son fatigant, même sans savoir qu'il l'est. Cette leçon règle le problème pour trente euros et deux réflexes.

## Le contenu

### Pourquoi le son compte plus que l'image

Le cerveau traite le son avant l'image pour évaluer la fiabilité d'une voix. Un son réverbéré, lointain ou bruité crée une gêne inconsciente que le spectateur attribue à la personne, pas au matériel.

En publicité, l'effet est mesurable : les créas au son propre gardent nettement plus de spectateurs après trois secondes, à contenu identique.

Et sur une vidéo sous-titrée regardée sans son ? Le son compte encore, parce que la plateforme et les tests A/B se font le plus souvent son activé.

### Les trois ennemis

**L'écho.** Causé par des surfaces dures et nues : carrelage, grandes fenêtres, murs vides, cage d'escalier. C'est le défaut numéro un des vidéos amateures, et le plus difficile à corriger après coup.

**La distance.** Le micro intégré du téléphone est à un mètre de ta bouche. À cette distance, il enregistre autant la pièce que toi.

**Le bruit de fond.** Frigo, ventilation, rue, voisins, notification. Un souffle constant fatigue au bout de dix secondes.

### La solution, dans l'ordre

**1. Un micro-cravate — 25 à 60 €.** Il place la capsule à vingt centimètres de ta bouche, ce qui écrase mécaniquement l'écho et le bruit de fond. C'est le seul achat obligatoire du métier. Filaire pour éviter les problèmes d'appairage et de batterie ; vérifie le connecteur de ton téléphone avant d'acheter.

**2. Une pièce meublée.** Tissu, tapis, rideaux, canapé, lit, vêtements : tout ce qui est mou absorbe. Une chambre sonne mieux qu'un salon, qui sonne mieux qu'une cuisine. Le meilleur studio son improvisé est un dressing.

**3. Le silence.** Coupe le frigo si tu tournes plus de dix minutes — et remets-le, c'est le piège classique. Ferme les fenêtres. Mets le téléphone en mode avion, quitte à le sortir juste avant l'enregistrement.

**4. Le placement.** Le micro à quinze-vingt centimètres, décalé sur le côté pour éviter les explosions de « p » et de « b ». Sous le col si tu veux le cacher, jamais sous un tissu qui frotte.

### Le contrôle en dix secondes

Avant de tourner : enregistre dix secondes, mets un casque, écoute.

Trois questions : entends-tu un souffle constant ? entends-tu ta voix « rebondir » ? ta voix te semble-t-elle proche ?

Si les trois réponses sont bonnes, tu peux tourner deux heures sans t'inquiéter. Sauter ce contrôle, c'est risquer de perdre une session complète — et ça arrive à tout le monde une fois.

### La musique et le mixage

La musique se met **sous** la voix, à un volume où elle ne se remarque pas quand la voix parle. Une règle simple : si tu dois monter le volume pour comprendre un mot, la musique est trop forte.

Sur les formats sans parole, la musique porte le rythme et peut être plus présente.

Utilise les bibliothèques intégrées à ton outil de montage : elles sont libres de droits pour un usage commercial, ce qui n'est pas le cas des titres trouvés en ligne.

### Ce qui ne se rattrape pas

L'écho. Il n'existe aucun traitement grand public qui retire proprement une réverbération. Les réducteurs de bruit automatiques atténuent le souffle mais rendent la voix métallique.

C'est la raison pour laquelle le son se règle **avant**, jamais après.

## Exemple appliqué

Inès tourne dans son séjour : parquet, grande baie vitrée, table en verre, peu de meubles. Ses vidéos ont un son « de visioconférence ».

Elle fait trois essais, avec le même texte.

**Essai 1 — séjour, micro du téléphone à un mètre.** Écho net, voix lointaine.

**Essai 2 — séjour, micro-cravate à 34 €.** Nettement mieux, mais un reste de réverbération sur les fins de phrase.

**Essai 3 — chambre, micro-cravate, porte du dressing ouverte derrière elle.** Son propre, chaud, aucune réverbération. Les vêtements du dressing absorbent tout ce qui repartait vers l'arrière.

Elle déplace son coin de tournage dans la chambre — ce qui, par chance, correspond aussi à sa meilleure fenêtre. Elle laisse la porte du dressing ouverte pendant chaque tournage.

Coût : 34 €. Gain : la marque de compléments qui l'avait ignorée deux mois plus tôt répond à sa relance et commande trois vidéos.

Elle ajoute une ligne à sa checklist d'avant-tournage : « dressing ouvert, frigo coupé, avion activé, dix secondes d'essai au casque ».

## Les erreurs fréquentes

Compter sur le micro du téléphone. À un mètre, il enregistre la pièce autant que toi.

Tourner dans une pièce vide et dure. C'est le générateur d'écho par excellence, et l'écho ne se retire pas.

Oublier le mode avion. Une notification pendant une bonne prise, c'est la prise perdue.

Ne pas écouter au casque avant de tourner. Dix secondes de contrôle contre deux heures de tournage à refaire.

Mettre la musique trop fort. Elle doit soutenir la voix, pas concourir avec elle.

Utiliser un titre populaire trouvé en ligne. Une marque ne peut pas diffuser en publicité une vidéo avec une musique non libérée : ta vidéo devient inutilisable.

Oublier de rebrancher le frigo. Ça arrive, et c'est une soirée désagréable.

## Action immédiate

Enregistre dix secondes de ta voix dans trois pièces différentes de chez toi, avec le micro du téléphone, et écoute au casque. Repère celle qui sonne le plus mate — c'est presque toujours la chambre. Puis commande un micro-cravate filaire à moins de 40 € et refais le test. La différence te dira pourquoi c'est le seul achat obligatoire de ce métier.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Le son : trois ennemis, quatre remèdes","description":"Le tableau des causes et des remèdes, le contrôle au casque, le placement du micro, la règle de la musique et le meilleur studio son improvisé.","kind":"document","url":null,"body":"## Le son : trois ennemis, quatre remèdes\n\n| Ennemi | Cause | Remède |\n|---|---|---|\n| Écho | Surfaces dures et nues : carrelage, baies vitrées, murs vides | Pièce meublée, tissus, dressing ouvert |\n| Distance | Micro du téléphone à un mètre | Micro-cravate à 15-20 cm |\n| Bruit de fond | Frigo, ventilation, rue, notifications | Silence, mode avion, fenêtres fermées |\n\n**L'écho ne se retire pas après coup.** Aucun traitement grand public ne le\nsupprime proprement. Le son se règle avant, jamais après.\n\n### Le contrôle en dix secondes\n\nAvant de tourner : enregistre 10 secondes, mets un casque, écoute.\n\n- [ ] Aucun souffle constant\n- [ ] Aucune voix qui « rebondit »\n- [ ] Voix perçue comme proche\n\nTrois oui → tu peux tourner deux heures tranquille.\n\n### Placement du micro\n\n15 à 20 cm de la bouche · **décalé sur le côté** (évite les explosions de\n« p » et de « b ») · sous le col si tu veux le cacher · jamais sous un tissu\nqui frotte.\n\n### Musique\n\nRègle unique : si tu dois monter le volume pour comprendre un mot, la musique\nest trop forte. Elle passe **sous** la voix.\n\nUtilise la bibliothèque de ton outil de montage : libre de droits pour un\nusage commercial. Un titre populaire trouvé en ligne rend ta vidéo\n**inutilisable en publicité** — c'est un livrable défectueux.\n\n### Le meilleur studio son improvisé\n\nUn dressing, porte ouverte, vêtements derrière toi. Gratuit, et meilleur\nqu'une pièce traitée.\n"},{"title":"Checklist de silence","description":"Frigo coupé, fenêtres fermées, mode avion, dix secondes d'essai au casque — et le rappel de rebrancher le frigo.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'e7512d8c-e646-43d7-84cf-a2e49724bd3a'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '59fe2d73-3595-4e00-97b3-66c9095ed58d'::uuid, m.id, m.course_id, m.org_id, 'coin-de-tournage', $sq$Ton coin de tournage : deux mètres carrés bien pensés$sq$, $sq$Le vrai coût d'un tournage est la mise en place. Cinq éléments, trois marques de gaffer au sol et une boîte font tomber ce temps de vingt-cinq minutes à quatre — et rendent les vidéos cohérentes sans effort.$sq$, $sq$## L'accroche

Le mot « studio » fait peur, et il est trompeur. Ce dont tu as besoin tient en deux mètres carrés : un mur, une fenêtre à côté, un trépied dont l'emplacement est marqué au sol, et une boîte où tout est rangé. Ce coin n'a pas besoin d'être joli, ni permanent, ni réservé. Il a besoin d'être **prêt** : le vrai coût d'un tournage n'est pas le tournage, c'est la mise en place — vingt minutes à chercher le trépied, régler la hauteur, dégager le fond, retrouver le micro. Multiplié par cinquante tournages par an, c'est dix-sept heures perdues. Cette leçon monte ton coin en une heure, et fait tomber la mise en place à trois minutes.

## Le contenu

### Les cinq éléments

**Le fond.** Un mur clair, un rideau uni, une bibliothèque partiellement dégagée. Deux mètres carrés suffisent, cadre vertical oblige. Ce qui compte, c'est qu'il soit **identique à chaque fois**.

**La marque au sol.** Un bout de gaffer ou de scotch coloré à l'emplacement exact des pieds du trépied, et un second pour tes pieds à toi. C'est le détail qui fait gagner le plus de temps et garantit la cohérence entre deux vidéos tournées à un mois d'intervalle.

**La hauteur notée.** Écris au marqueur la hauteur de colonne du trépied sur son montant, ou note-la sur ta fiche. Objectif à hauteur de tes yeux, assise ou debout selon ton format habituel.

**La boîte.** Une caisse ou un panier où vivent le micro, le trépion, le réflecteur, un chiffon, une multiprise. Tout dedans, rien qui traîne ailleurs.

**La surface produit.** Une planche de bois clair, un plateau, une nappe unie — 30 × 40 cm suffisent — pour les plans de produit vus de haut. Elle se range avec la boîte.

### La zone hors champ

Ce que la caméra ne voit pas peut rester en désordre, et c'est une libération : tu n'as pas besoin d'un appartement rangé, tu as besoin de deux mètres carrés propres.

En revanche, vérifie trois choses **dans** le champ, à chaque fois : rien de personnel identifiable (courrier, photos, ordonnance), rien de daté (un calendrier), rien de concurrent (une bouteille d'une marque rivale au fond du plan, la faute qui fait refaire une vidéo entière).

### La checklist d'avant-tournage

Colle-la au mur du coin. Huit lignes, trente secondes.

1. Objectif nettoyé
2. Mode avion activé
3. Batterie au-dessus de 50 %, mémoire disponible
4. Micro branché, testé dix secondes au casque
5. Lumière : fenêtre à 45°, lampes éteintes, réflecteur en place
6. Exposition et mise au point verrouillées
7. Champ vérifié : rien de personnel, daté ou concurrent
8. Produit propre, étiquette face caméra, sans traces de doigts

Cette liste évite la quasi-totalité des tournages à refaire. Elle paraît excessive jusqu'à la première session perdue pour une mémoire pleine.

### Le tournage assis ou debout

Assise : plus stable, moins fatigant sur une session de six vidéos, meilleur pour les formats témoignage. Utilise un tabouret sans dossier pour garder le dos droit.

Debout : plus d'énergie, meilleur pour les formats dynamiques et les démonstrations.

Choisis ton défaut et note la hauteur de trépied correspondante. Changer entre deux vidéos d'un même lot casse la cohérence.

### Le rangement qui fait gagner du temps

La règle : **tout ce qui sert au tournage vit dans la boîte, et la boîte vit à côté du coin**. Rien dans un tiroir, rien dans un sac, rien chez quelqu'un d'autre.

Ajoute-y une petite trousse : lingettes pour les produits, chiffon microfibre, pile ou câble de rechange, élastiques.

### Quand le coin ne suffit pas

Certaines vidéos demandent un autre lieu : la salle de bain pour les soins, la cuisine pour l'alimentaire, l'extérieur pour le sport. Traite-les comme des **décors secondaires** : repère l'heure de lumière, prends la même marque au sol, et garde le même micro.

Trois décors maximum. Au-delà, la cohérence du portfolio se perd et la mise en place recommence à coûter cher.

## Exemple appliqué

Julie tourne dans son salon, en déplaçant la table basse à chaque fois. Une session de six vidéos lui prend quatre heures, dont une de manutention.

Elle monte son coin un dimanche matin, en une heure.

**Le lieu** : l'angle de sa chambre, mur beige, fenêtre nord à gauche. Deux mètres carrés.

**Les marques** : trois croix de gaffer noir — deux pour les pieds du trépied, une pour les siens. Invisibles au montage, elles cadrent tout.

**La hauteur** : 118 cm assise sur son tabouret. Écrite au marqueur sur la colonne.

**La boîte** : une caisse en osier de 40 cm. Micro, câble rallonge, réflecteur pliable, chiffon, lingettes, élastiques, planche de bois clair de 30 × 40.

**La checklist** : imprimée, scotchée au mur, huit lignes.

Résultat mesuré sur sa session suivante : mise en place 4 minutes au lieu de 25, six vidéos tournées en 1 h 50 au lieu de 4 h. Sur une année à cinquante sessions, elle récupère plus de vingt heures.

Effet secondaire non prévu : ses vidéos sont devenues visuellement cohérentes sans effort, parce que le cadre ne bouge plus. Deux marques lui ont dit qu'elles reconnaissaient ses vidéos.

## Les erreurs fréquentes

Ne pas marquer le sol. C'est le geste à trois euros qui fait gagner vingt minutes par session et garantit la cohérence.

Ranger le matériel ailleurs qu'à côté du coin. Chercher le micro est le premier frein au tournage spontané.

Vouloir un décor parfait. Deux mètres carrés propres suffisent ; le reste de la pièce ne regarde personne.

Laisser un produit concurrent dans le champ. C'est la faute qui fait refaire une vidéo entière et qui inquiète le client sur ton sérieux.

Changer de hauteur ou de position entre deux vidéos d'un même lot. Le client voit un lot incohérent et demande des reprises.

Sauter la checklist. Elle paraît excessive jusqu'au jour où la mémoire est pleine à la quatrième vidéo.

## Action immédiate

Choisis ton coin aujourd'hui — deux mètres carrés, un mur, une fenêtre à côté — et pose trois marques au sol. Rassemble tout ton matériel dans une seule boîte que tu poses à côté. Imprime la checklist en huit lignes et scotche-la au mur. Cette heure de travail est celle qui rendra tous tes tournages suivants deux fois plus rapides.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Le coin de tournage en deux mètres carrés","description":"Les cinq éléments, la checklist d'avant-tournage en huit lignes à scotcher au mur, les trois vérifications dans le champ et le gain de temps mesuré.","kind":"document","url":null,"body":"## Le coin de tournage : deux mètres carrés\n\n### Les cinq éléments\n\n| Élément | Détail |\n|---|---|\n| Fond | Mur clair ou rideau uni, **identique à chaque fois** |\n| Marques au sol | Gaffer : deux pour le trépied, une pour tes pieds |\n| Hauteur notée | Objectif à hauteur des yeux, écrite au marqueur sur la colonne |\n| La boîte | Micro, trépied, réflecteur, chiffon, lingettes, rallonge, élastiques |\n| Surface produit | Planche ou plateau 30 × 40 cm, rangé avec la boîte |\n\n### La checklist d'avant-tournage\n\nÀ imprimer et scotcher au mur. Trente secondes, et elle évite la quasi-totalité\ndes sessions à refaire.\n\n1. [ ] Objectif nettoyé\n2. [ ] Mode avion activé\n3. [ ] Batterie > 50 %, mémoire disponible\n4. [ ] Micro branché, testé 10 s au casque\n5. [ ] Fenêtre à 45°, lampes éteintes, réflecteur en place\n6. [ ] Exposition et mise au point verrouillées\n7. [ ] Champ vérifié : rien de personnel, daté ou **concurrent**\n8. [ ] Produit propre, étiquette face caméra, sans traces de doigts\n\n### Les trois vérifications dans le champ\n\n| À traquer | Exemple | Conséquence |\n|---|---|---|\n| Personnel identifiable | Courrier, photo, ordonnance | Reprise + gêne |\n| Daté | Calendrier, saison visible | Vidéo inutilisable dans 6 mois |\n| Concurrent | Bouteille rivale au fond | **Vidéo entière à refaire** |\n\n### Assise ou debout\n\n| | Assise | Debout |\n|---|---|---|\n| Stabilité | meilleure | correcte |\n| Fatigue sur 6 vidéos | faible | forte |\n| Formats | témoignage, avis | démonstration, dynamique |\n\nChoisis ton défaut, note la hauteur, ne change pas au milieu d'un lot.\n\n### Le gain mesuré\n\nMise en place : **25 min → 4 min**. Session de six vidéos : **4 h → 1 h 50**.\nSur cinquante sessions par an, plus de vingt heures récupérées.\n"},{"title":"Checklist des décors secondaires","description":"Salle de bain, cuisine, extérieur : repérer l'heure de lumière, reprendre la marque au sol, garder le même micro. Trois décors maximum.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'e7512d8c-e646-43d7-84cf-a2e49724bd3a'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '86074810-630b-464e-a1d7-221e43568841'::uuid, c.id, c.org_id, 'trouver-des-clients', $sq$Trouver des clients : les canaux qui marchent$sq$, $sq$Ce module donne la carte des cinq canaux avec leurs rendements réels et l'ordre dans lequel les activer : les plateformes pour amorcer et en sortir au troisième mois, l'email direct pour vivre, LinkedIn et les agences — les deux gisements que presque personne ne travaille — pour installer du volume régulier.$sq$, 5, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7ae08016-44a6-4a7b-b966-9314bf8cc9b0'::uuid, m.id, m.course_id, m.org_id, 'carte-des-canaux', $sq$La carte des canaux : plateformes, direct, réseaux, agences, entrant$sq$, $sq$Cinq canaux, cinq rendements, un ordre. Le calendrier des six premiers mois, le calcul qui impose la bascule vers le direct avant le quatrième mois, et le rendement normal à connaître par cœur : cent contacts pour un à deux clients.$sq$, $sq$## L'accroche

Il existe cinq façons de trouver des marques, et elles n'ont pas le même rendement. Une créatrice qui passe ses six premiers mois uniquement sur les plateformes UGC gagnera environ 40 % de moins qu'une créatrice qui démarche en direct, pour le même travail — parce que la plateforme prend sa commission, impose ses prix et met un intermédiaire entre elle et la marque. À l'inverse, une créatrice qui ne fait que du direct met deux mois de plus à décrocher sa première mission. La bonne stratégie n'est pas de choisir un canal, c'est de les faire travailler dans un ordre précis : les plateformes pour amorcer, le direct pour vivre, l'entrant pour durer. Cette leçon donne la carte, les rendements réels, et le calendrier.

## Le contenu

### Les cinq canaux, du plus rapide au plus rentable

**1. Les plateformes UGC.** Des places de marché où les marques publient des campagnes et où tu candidates. Rendement rapide, prix bas, commission de 15 à 30 %. Utile les deux premiers mois pour obtenir de vraies références.

**2. Le démarchage direct par email.** Tu écris à la marque. Le canal le plus rentable du métier : aucun intermédiaire, tu fixes ton prix. Taux de réponse réaliste : 8 à 15 % avec un message ciblé, 1 à 2 % avec un message générique.

**3. Les réseaux sociaux en message privé.** Instagram et TikTok. Plus rapide à envoyer, moins fiable à recevoir : les demandes de messages atterrissent dans un onglet que personne n'ouvre. Bon en complément d'un email, mauvais en canal principal.

**4. LinkedIn.** Le canal le plus sous-exploité, et de très loin. Les responsables acquisition y sont, presque aucune créatrice n'y est. Taux de réponse observé : deux à trois fois celui de l'email froid.

**5. L'entrant.** Les marques qui te trouvent : recommandation d'un client, découverte par ton portfolio, repérage sur LinkedIn. Zéro coût d'acquisition, meilleur taux de conversion, mais il n'existe qu'après six à huit mois de travail sur les quatre autres.

### Le canal oublié : les agences

Entre la marque et toi, il existe une catégorie entière que presque personne ne démarche : les **agences d'acquisition** et les **agences social media**. Elles gèrent la publicité de dix à quarante marques, ont un besoin permanent de créas, et cherchent des créatrices fiables plutôt que brillantes.

Un contrat d'agence vaut cinq contrats de marque : il apporte du volume régulier, un seul interlocuteur, et zéro prospection ensuite.

### Le calendrier des six premiers mois

**Mois 1-2 — amorçage.** Deux plateformes, 15 candidatures par semaine. Objectif : deux missions payées, même mal, pour avoir des références réelles.

**Mois 2-4 — bascule.** Le direct devient le canal principal : 20 emails ciblés par semaine, plus 3 spec ads par mois. Les plateformes passent au second plan.

**Mois 3-6 — élargissement.** LinkedIn s'ajoute : un post par semaine, dix commentaires par jour sur des publications de marques de ta niche, cinq messages ciblés par semaine. Cinq agences démarchées par mois.

**Mois 6+ — l'entrant prend le relais.** Tu réduis la prospection à dix contacts par semaine et tu bascules l'effort sur la fidélisation, qui rapporte davantage.

### Le calcul qui décide tout

Une mission de 600 € trouvée par plateforme te laisse environ 450 € après commission, sur un prix imposé.
La même mission trouvée en direct te laisse 600 €, et souvent plus, parce que tu fixes ton prix.

Sur trente missions par an, l'écart dépasse 4 500 €. C'est la raison pour laquelle le direct doit devenir majoritaire avant le quatrième mois.

### Le volume réaliste

Une règle utile : **100 contacts ciblés produisent 10 réponses, 4 conversations, 1 à 2 clients**. Ce n'est pas un mauvais rendement, c'est le rendement normal.

La conséquence est mathématique : si tu veux deux clients ce mois-ci, prévois cent contacts. La plupart des créatrices en envoient quinze, n'obtiennent rien, et concluent que « ça ne marche pas ».

## Exemple appliqué

Lucie démarre en septembre, niche puériculture.

**Septembre.** Deux plateformes, 60 candidatures. Deux missions à 90 € et 120 €. Rentabilité horaire mauvaise, mais elle a deux vraies marques dans son portfolio et deux témoignages.

**Octobre.** Elle bascule : 80 emails ciblés à des marques de puériculture, portfolio refait avec les deux missions réelles. 9 réponses, 3 conversations, 2 clients à 200 € la vidéo. 1 200 € sur le mois.

**Novembre.** Elle ajoute LinkedIn : elle publie une vidéo par semaine avec deux lignes d'analyse, commente les publications de dix marques. Trois responsables acquisition la contactent en un mois — dont un directement pour un pack de six vidéos.

**Décembre.** Elle démarche cinq agences. Une répond, lui donne un test d'une vidéo, puis lui commande quatre vidéos par mois pour trois de ses clients. C'est son premier revenu prévisible.

**Février.** Répartition de son chiffre d'affaires : 55 % direct, 25 % agence, 15 % entrant, 5 % plateformes. Elle a désactivé une des deux plateformes, dont les prix ne suivaient plus.

Six mois, aucun canal magique — un ordre.

## Les erreurs fréquentes

Rester sur les plateformes après le troisième mois. Elles plafonnent tes prix et te maintiennent en concurrence directe avec des centaines de profils.

Attendre d'être « prête » pour démarcher en direct. Le portfolio de six vidéos suffit dès la première semaine.

Envoyer quinze messages et conclure que ça ne marche pas. Le rendement normal demande cent contacts pour un à deux clients.

Ignorer les agences. C'est le canal au meilleur rapport effort/volume, et presque personne ne le travaille.

Ignorer LinkedIn parce qu'on n'y a pas d'audience. C'est exactement pour ça qu'il fonctionne : peu de concurrence, décideurs présents.

Compter sur l'entrant trop tôt. Il n'existe qu'après six à huit mois de sortant.

## Action immédiate

Ouvre un tableur et fais cinq colonnes : plateformes, email direct, réseaux, LinkedIn, agences. Sous chacune, écris ton objectif hebdomadaire pour les quatre prochaines semaines, en respectant le calendrier ci-dessus. Puis compte : est-ce que ça fait au moins vingt-cinq contacts par semaine ? Si non, augmente — c'est le seul chiffre qui décide de ton mois prochain.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"La carte des canaux","description":"Le tableau comparatif des cinq canaux, le calendrier semaine par semaine des six premiers mois, le rendement normal et le calcul qui impose le direct.","kind":"document","url":null,"body":"## La carte des canaux\n\n| Canal | Délai au 1er client | Rentabilité | Effort | Quand l'activer |\n|---|---|---|---|---|\n| Plateformes UGC | 2 à 4 semaines | Faible (commission 15-30 %) | Faible | Mois 1-2, puis en fond |\n| Email direct | 4 à 8 semaines | **Élevée** (aucun intermédiaire) | Moyen | Mois 2 et pour toujours |\n| Messages privés IG / TikTok | 4 à 10 semaines | Élevée | Faible | En complément, jamais seul |\n| LinkedIn | 4 à 8 semaines | **Élevée** | Moyen | Mois 3 |\n| Agences | 6 à 12 semaines | Élevée + **volume** | Faible | Mois 4 |\n| Entrant | 6 à 8 mois | Maximale | Nul | Se construit, ne s'active pas |\n\n### Le calendrier des six premiers mois\n\n| Période | Canal principal | Objectif hebdomadaire |\n|---|---|---|\n| Mois 1-2 | Plateformes | 15 candidatures |\n| Mois 2-4 | Email direct | 20 emails + 3 spec ads / mois |\n| Mois 3-6 | + LinkedIn | 1 post, 25 commentaires, 5 messages |\n| Mois 4-6 | + Agences | 5 agences démarchées / mois |\n| Mois 6+ | Fidélisation | 10 contacts / semaine seulement |\n\n### Le rendement normal, à connaître par cœur\n\n**100 contacts ciblés → 10 réponses → 4 conversations → 1 à 2 clients.**\n\nConséquence : deux clients ce mois-ci demandent cent contacts. La plupart en\nenvoient quinze, n'obtiennent rien, et concluent que ça ne marche pas.\n\n### Le calcul qui impose le direct\n\n| | Plateforme | Direct |\n|---|---|---|\n| Mission facturée | 600 € | 600 € |\n| Commission | −150 € | 0 € |\n| Prix | imposé | fixé par toi |\n| **Net** | **450 €** | **600 €** |\n\nSur trente missions par an : plus de 4 500 € d'écart.\n"},{"title":"Tableur de suivi hebdomadaire","description":"Cinq colonnes, un objectif de contacts par canal et par semaine. Le seul chiffre qui décide du mois suivant.","kind":"template","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '86074810-630b-464e-a1d7-221e43568841'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '05be37d1-fc66-422f-a7bd-186d5bed6945'::uuid, m.id, m.course_id, m.org_id, 'plateformes-ugc', $sq$Les plateformes UGC : y entrer, en sortir au bon moment$sq$, $sq$Les plateformes ne sont pas un revenu, ce sont un billet d'entrée vers la crédibilité. Les quatre critères de choix, la candidature en trois phrases, les quatre pièges des conditions générales et la date de sortie à fixer dès le premier jour.$sq$, $sq$## L'accroche

Les plateformes UGC ont une réputation double : « c'est là qu'on démarre » et « ça paie mal ». Les deux sont vraies, et c'est précisément pour ça qu'il faut les utiliser d'une manière très précise — comme un tremplin, pendant huit à dix semaines, avec un objectif qui n'est pas l'argent. Une créatrice qui décroche trois missions à 90 € sur une plateforme en janvier ne gagne presque rien ; mais en février, elle a trois vraies marques dans son portfolio, trois témoignages, et son taux de réponse en démarchage direct triple. La plateforme n'est pas un revenu, c'est un raccourci vers la crédibilité. Cette leçon dit comment la prendre sans s'y installer.

## Le contenu

### Comment ça marche

Une marque publie une campagne : produit, brief, nombre de vidéos, rémunération. Les créatrices candidatent. La marque sélectionne. Le produit est envoyé, la vidéo est livrée dans la plateforme, le paiement passe par elle.

La plateforme prend sa part de deux façons : une commission sur ta rémunération (15 à 30 %), ou une marge invisible côté marque — dans ce cas, le prix que tu vois est déjà amputé.

### Les trois familles

**Les places de marché de campagnes.** Tu candidates à des offres publiées. Volume important, sélection à l'aveugle, prix imposés. C'est le format le plus courant.

**Les annuaires de créatrices.** Tu crées une fiche, les marques te contactent. Moins de volume, meilleures conditions, prix souvent négociables.

**Les plateformes « produit contre contenu ».** Tu reçois le produit, tu livres, tu n'es pas payée en argent. À traiter comme un exercice de portfolio, jamais comme du travail — et à limiter à deux ou trois au total.

### Choisir : deux, pas six

Chaque plateforme demande une fiche à tenir, des candidatures à écrire, des messages à suivre. Six plateformes, c'est un mi-temps non payé.

Les critères de choix, dans l'ordre :

**Y a-t-il des campagnes dans ta niche ?** Regarde les campagnes ouvertes avant de créer un compte. Une plateforme sans marques de ton secteur est une perte de temps, quelle que soit sa notoriété.

**Le paiement est-il en argent ?** Beaucoup de campagnes sont en produit seul. Filtre-les d'emblée.

**Quel est le délai de paiement ?** Trente jours est normal, soixante commence à être un problème de trésorerie.

**Peut-on négocier ?** Certaines plateformes autorisent une contre-proposition. Ce sont les meilleures.

### Écrire une candidature qui sort du lot

Une marque reçoit quarante candidatures identiques : « Bonjour, je serais ravie de collaborer, voici mon portfolio ». Trois phrases suffisent à te distinguer.

1. **Une observation.** « J'ai vu que votre gamme cible les peaux réactives. »
2. **Un angle proposé.** « Je partirais sur l'objection "encore un produit qui pique", que vos avis mentionnent. »
3. **Une preuve.** Un lien vers une vidéo pertinente, pas vers ton portfolio entier.

Trente secondes de plus par candidature, taux de sélection multiplié par trois ou quatre.

### Les pièges à connaître

**La cession de droits illimitée.** Beaucoup de plateformes imposent des droits perpétuels et mondiaux dans leurs conditions. Ton prix, lui, correspond à trois mois. Lis cette clause avant d'accepter, et intègre-la à ton calcul : une vidéo à 120 € en droits illimités vaut en réalité 250 € de travail.

**L'exclusivité cachée.** Certaines interdisent de contacter la marque en direct pendant six à douze mois après une mission. C'est la clause qui t'empêche de convertir un bon client en client direct.

**Les révisions illimitées.** Une campagne qui n'annonce pas de limite de retours peut te faire travailler trois fois pour le même prix.

**Le paiement au « clic » ou à la performance.** À éviter systématiquement : tu ne contrôles ni la diffusion ni le ciblage.

### La sortie

Fixe-toi une date de sortie dès le premier jour : **fin du troisième mois**. Ce jour-là, tu ne fermes pas les comptes — tu arrêtes d'y candidater activement et tu les laisses tourner en fond.

À ce stade, ton portfolio contient de vraies marques, et le direct paie 30 à 40 % de plus pour le même travail.

## Exemple appliqué

Anaïs, niche cuisine et petit électroménager, s'inscrit sur deux plateformes en janvier.

**Le choix.** Elle en teste quatre pendant une semaine, sans créer de fiche : elle regarde simplement les campagnes ouvertes. Deux ont des marques de cuisine, deux n'en ont aucune. Elle garde les deux premières.

**Les candidatures.** Vingt par semaine, trois phrases chacune, avec un angle proposé. Sur les cinquante premières, elle est retenue neuf fois.

**Les missions.** Sept en deux mois, entre 80 € et 160 €. Total : 780 €. Rentabilité horaire médiocre — environ 45 €/h.

**Ce qu'elle en tire.** Six marques identifiables dans son portfolio, dont deux connues. Trois témoignages écrits. Et surtout : elle sait maintenant écrire un brief, respecter un délai, livrer un fichier au bon format.

**Mars.** Elle bascule au direct avec ce portfolio. Son taux de réponse passe de 6 % à 14 %. Elle facture 220 € la vidéo, sans commission.

**Avril.** Une des marques rencontrées sur plateforme la contacte en direct — la clause d'exclusivité de six mois était expirée, elle avait vérifié. Pack de huit vidéos à 1 760 €, sans intermédiaire.

Les 780 € de janvier-février n'étaient pas le revenu. Ils étaient le billet d'entrée.

## Les erreurs fréquentes

S'inscrire sur six plateformes. Chacune demande de l'entretien ; deux suffisent.

Créer une fiche avant de regarder les campagnes ouvertes. Vérifie d'abord que ta niche existe sur la plateforme.

Accepter des droits illimités sans ajuster son prix. C'est le piège le plus coûteux, et il est écrit dans les conditions que personne ne lit.

Candidater avec un message générique. Quarante identiques arrivent, la marque en lit trois.

Rester au-delà du troisième mois. Les plateformes plafonnent les prix ; y rester, c'est refuser 30 à 40 % de revenu.

Accepter les campagnes « produit contre contenu » à répétition. Deux ou trois au total, en tout début, et seulement pour le portfolio.

Contacter une marque en direct sans vérifier la clause d'exclusivité. C'est la seule vraie faute contractuelle que tu risques sur ce canal.

## Action immédiate

Choisis deux plateformes, et avant de créer le moindre compte, passe vingt minutes à regarder les campagnes ouvertes : y a-t-il des marques de ta niche, et le paiement est-il en argent ? Puis écris ton modèle de candidature en trois phrases — observation, angle, preuve — et garde-le dans une note. Il te servira quarante fois ce mois-ci, et fixe dès aujourd'hui ta date de sortie dans ton agenda.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Plateformes UGC : mode d'emploi et sortie","description":"Les quatre critères de choix, la candidature en trois phrases, le tableau des quatre pièges contractuels et la règle de la date de sortie.","kind":"document","url":null,"body":"## Plateformes UGC : mode d'emploi et sortie\n\n### Les quatre critères de choix\n\nAvant de créer le moindre compte, regarde les campagnes ouvertes.\n\n- [ ] Y a-t-il des campagnes **dans ma niche** ?\n- [ ] Le paiement est-il **en argent**, pas en produit seul ?\n- [ ] Le délai de paiement est-il ≤ 30 jours ?\n- [ ] Peut-on **contre-proposer** un prix ?\n\n**Deux plateformes maximum.** Chacune demande une fiche à tenir.\n\n### La candidature en trois phrases\n\n1. **Une observation** : « J'ai vu que votre gamme cible les peaux réactives. »\n2. **Un angle** : « Je partirais sur l'objection \"encore un produit qui pique\". »\n3. **Une preuve** : un lien vers **une** vidéo pertinente, pas le portfolio entier.\n\nTrente secondes de plus, taux de sélection multiplié par trois ou quatre.\n\n### Les quatre pièges des conditions\n\n| Piège | Où il se cache | Ce qu'il coûte |\n|---|---|---|\n| Droits illimités / perpétuels | Conditions générales | Une vidéo à 120 € en vaut 250 |\n| Exclusivité 6-12 mois | Clause de non-contournement | Interdit de convertir en client direct |\n| Révisions illimitées | Brief de campagne | Trois fois le travail, même prix |\n| Paiement à la performance | Rémunération | Tu ne contrôles ni diffusion ni ciblage |\n\n### La date de sortie\n\n**Fin du troisième mois**, fixée dès le premier jour.\nTu ne fermes pas les comptes — tu arrêtes d'y candidater activement.\n\nÀ ce stade : portfolio avec de vraies marques, et le direct paie 30 à 40 % de\nplus pour le même travail.\n\n### Le vrai retour sur investissement\n\nCe que tu en tires n'est pas l'argent. C'est : des marques identifiables au\nportfolio · des témoignages · l'habitude de lire un brief, tenir un délai et\nlivrer au bon format.\n"},{"title":"Checklist de lecture des conditions","description":"Droits, exclusivité, révisions, mode de paiement : les quatre clauses à lire avant d'accepter une campagne.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '86074810-630b-464e-a1d7-221e43568841'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3aee2686-a489-4496-bd44-201bff9da4db'::uuid, m.id, m.course_id, m.org_id, 'demarchage-email', $sq$Le démarchage direct par email : la séquence qui obtient des réponses$sq$, $sq$Un message ciblé obtient 8 à 15 % de réponses, un message générique 1 à 2 %. Les quatre éléments qui font l'écart, le message type mot pour mot, les objets qui font ouvrir et la cadence de vingt envois par semaine.$sq$, $sq$## L'accroche

Deux cents emails envoyés, quatre réponses. C'est le résultat classique d'un démarchage mal construit, et il conduit presque toujours à la même conclusion erronée : « le démarchage ne marche pas ». Le démarchage fonctionne très bien — un message ciblé obtient 8 à 15 % de réponses, ce qui est excellent pour de la prospection à froid. Ce qui ne fonctionne pas, c'est le message qui parle de toi, envoyé à une adresse générique, sans rien montrer, en demandant « une collaboration ». La différence entre 2 % et 14 % tient dans quatre éléments, et ils s'écrivent en dix minutes. Cette leçon donne la séquence complète, mot pour mot.

## Le contenu

### Les quatre éléments d'un message qui obtient une réponse

**1. La bonne adresse.** Un message à `contact@` a trois à cinq fois moins de chances qu'un message à une personne nommée. Trouver cette personne fait l'objet de la leçon suivante ; retiens qu'aucun message parfait n'a de valeur à la mauvaise adresse.

**2. Une observation vérifiable.** La première phrase doit prouver que tu as regardé **leur** marque : une publicité vue, une objection lue dans les avis, un format absent de leur communication. C'est ce qui distingue ton message des vingt autres reçus le même jour.

**3. Une proposition concrète.** Pas « je propose mes services », mais « je partirais sur cet angle-là ». Une idée précise se juge ; une disponibilité générale se classe.

**4. Un lien qui montre, pas qui raconte.** Une vidéo pertinente, ou le portfolio en un clic. Jamais une pièce jointe en premier contact.

### L'objet de l'email

C'est ce qui décide de l'ouverture. Trois formes qui fonctionnent :

- « Vidéo UGC pour [marque] — un angle sur [objection] »
- « [Prénom], une idée de créa pour vos pubs Meta »
- « 3 formats vidéo pour [marque] »

Trois formes qui ne fonctionnent pas : « Collaboration », « Proposition de partenariat », « Créatrice de contenu disponible ». Elles annoncent un message de masse.

### Le message, mot pour mot

> **Objet :** Vidéo UGC pour [Marque] — un angle sur [objection]
>
> Bonjour [Prénom],
>
> J'ai vu vos publicités Meta sur [produit] : elles montrent surtout [ce que tu as observé]. Dans vos avis clients, l'objection qui revient le plus est [objection précise] — et elle n'est traitée par aucune de vos créas actuelles.
>
> Je suis créatrice UGC spécialisée [niche]. Je produis des vidéos verticales de 30 secondes, livrées en 5 jours, utilisables en publicité.
>
> Voici une vidéo du même type pour une autre marque : [lien direct]
>
> Si ça vous intéresse, je peux vous proposer trois angles sur [produit] cette semaine.
>
> Bonne journée,
> [Prénom] — [portfolio]

Quatre-vingts mots. Cinq paragraphes courts. Aucune pièce jointe.

### Ce qui tue un message

**Parler de soi en premier.** « Je m'appelle X, je suis passionnée par… » — la marque ne te connaît pas, elle s'en moque à cette seconde précise.

**Demander une opportunité.** « Seriez-vous intéressés par une collaboration ? » place la marque en position de rendre service.

**Le pavé.** Au-delà de 150 mots, le message est archivé pour plus tard, c'est-à-dire jamais.

**La pièce jointe.** Filtres anti-spam, méfiance, et rien à ouvrir sur téléphone.

**L'absence de proposition.** Un message sans idée n'appelle aucune réponse possible.

### Le volume et la cadence

Vingt messages par semaine, en deux sessions d'une heure. Chaque message demande cinq à sept minutes : trois pour l'observation, deux pour l'écriture, deux pour trouver l'adresse.

Ne descends pas sous vingt : le rendement normal — 100 contacts, 10 réponses, 1 à 2 clients — impose un volume minimum pour produire quoi que ce soit.

### Quand envoyer

Mardi, mercredi et jeudi, entre 8 h et 10 h ou entre 14 h et 16 h. Le lundi, la boîte est saturée ; le vendredi après-midi, tout est reporté.

C'est un détail, il vaut quelques points de taux d'ouverture.

## Exemple appliqué

Camille vise une marque de granola. Elle prépare son message en six minutes.

**Recherche (3 min).** Bibliothèque publicitaire : quatre publicités actives, toutes des plans de bol de granola en lumière dorée, voix off, aucune personne. Avis clients sur leur site : sur les quinze derniers, cinq mentionnent « trop sucré à mon goût » et trois disent « je ne savais pas quoi en faire à part le petit-déjeuner ».

**L'angle choisi.** Pas le sucre — c'est un reproche produit, pas un angle vendeur. Elle prend l'usage : « je ne savais pas quoi en faire ».

**Le message.**

> **Objet :** Vidéo UGC pour [Marque] — l'angle « autre chose qu'un petit-déj »
>
> Bonjour Claire,
>
> J'ai regardé vos publicités Meta : ce sont toutes des plans de bol en voix off, très belles, mais aucune ne montre quelqu'un. Dans vos avis, plusieurs clientes écrivent qu'elles ne savent pas quoi faire du granola en dehors du petit-déjeuner.
>
> Je suis créatrice UGC spécialisée en alimentaire. Je produis des vidéos verticales de 30 secondes, livrées en 5 jours, utilisables en publicité.
>
> Une vidéo du même type, pour une marque de compote : [lien]
>
> Si ça vous parle, je vous propose trois angles « usages » cette semaine.
>
> Bonne journée,
> Camille — [portfolio]

**Le résultat.** Réponse en deux jours : « intéressant, envoyez vos trois angles ». Deux échanges plus tard, commande de quatre vidéos à 240 €.

Sur ses vingt messages de la semaine, elle obtient trois réponses et une commande. Rendement de 15 % en réponse, 5 % en signature : au-dessus de la moyenne, grâce aux six minutes de recherche par message.

## Les erreurs fréquentes

Écrire un message et l'envoyer à cinquante marques. Le message générique se repère en une seconde et convertit à 1 %.

Envoyer à `contact@`. Trois à cinq fois moins de réponses.

Parler de soi avant de parler d'eux. C'est l'ordre qui décide de la suite de la lecture.

Joindre son media kit au premier contact. Il s'envoie au deuxième échange.

Faire long. Au-delà de 150 mots, le message est reporté à jamais.

Ne pas proposer d'angle. Sans idée précise, il n'y a rien à quoi répondre.

Arrêter après trente messages sans réponse. Trente messages, statistiquement, c'est zéro à un client. C'est normal, pas un échec.

## Action immédiate

Écris ton modèle de message ce soir, avec les crochets à remplir, et enregistre-le dans une note. Puis choisis cinq marques de ta niche, et pour chacune, passe trois minutes à noter une observation vérifiable — une publicité vue ou une objection lue dans les avis. Tu as cinq messages prêts à envoyer demain matin. Vingt par semaine à partir de là.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Le démarchage par email — séquence complète","description":"Les quatre éléments, les objets qui marchent et ceux qui tuent, le message type de quatre-vingts mots, la cadence et les six erreurs à éviter.","kind":"document","url":null,"body":"## Le démarchage par email — séquence complète\n\n### Les quatre éléments non négociables\n\n1. **La bonne adresse** — une personne nommée, jamais `contact@` (3 à 5 fois moins de réponses)\n2. **Une observation vérifiable** — une pub vue, une objection lue dans les avis\n3. **Une proposition concrète** — un angle, pas une disponibilité\n4. **Un lien qui montre** — une vidéo, jamais une pièce jointe au premier contact\n\n### Objets qui fonctionnent\n\n- « Vidéo UGC pour [Marque] — un angle sur [objection] »\n- « [Prénom], une idée de créa pour vos pubs Meta »\n- « 3 formats vidéo pour [Marque] »\n\n### Objets qui ne fonctionnent pas\n\n« Collaboration » · « Proposition de partenariat » · « Créatrice de contenu\ndisponible » — ils annoncent un envoi de masse.\n\n### Le message type\n\n> **Objet :** Vidéo UGC pour [Marque] — un angle sur [objection]\n>\n> Bonjour [Prénom],\n>\n> J'ai vu vos publicités Meta sur [produit] : elles montrent surtout\n> [observation]. Dans vos avis clients, l'objection qui revient le plus est\n> [objection] — et elle n'est traitée par aucune de vos créas actuelles.\n>\n> Je suis créatrice UGC spécialisée [niche]. Je produis des vidéos verticales\n> de 30 secondes, livrées en 5 jours, utilisables en publicité.\n>\n> Voici une vidéo du même type pour une autre marque : [lien direct]\n>\n> Si ça vous intéresse, je peux vous proposer trois angles sur [produit]\n> cette semaine.\n>\n> Bonne journée,\n> [Prénom] — [portfolio]\n\n**80 mots. Cinq paragraphes. Aucune pièce jointe.**\n\n### Cadence\n\n| Quoi | Combien |\n|---|---|\n| Messages par semaine | 20, en deux sessions d'une heure |\n| Temps par message | 5 à 7 min (3 de recherche) |\n| Jours d'envoi | mardi, mercredi, jeudi |\n| Créneaux | 8 h – 10 h ou 14 h – 16 h |\n\n### Les six choses qui tuent un message\n\nParler de soi en premier · demander une opportunité · dépasser 150 mots ·\njoindre un fichier · ne proposer aucun angle · arrêter après trente envois.\n"},{"title":"Checklist d'avant-envoi","description":"Personne nommée, observation vérifiable, angle proposé, lien direct, moins de 150 mots, aucune pièce jointe.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '86074810-630b-464e-a1d7-221e43568841'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '94e98150-8097-44e8-a51b-9eb2c9f6c89a'::uuid, m.id, m.course_id, m.org_id, 'instagram-tiktok', $sq$Instagram et TikTok : les utiliser dans le bon sens$sq$, $sq$Le message privé à froid rend 2 à 4 %. La séquence de chauffe en trois semaines — réponses aux stories, commentaires, puis message — multiplie ce taux par quatre, et le compte vitrine fait venir les marques sans rien demander.$sq$, $sq$## L'accroche

Instagram et TikTok sont les deux endroits où les marques regardent quand elles cherchent une créatrice — et les deux endroits où les créatrices envoient les messages les moins efficaces du métier. Un message privé Instagram à une marque a 2 à 4 % de chances d'obtenir une réponse, contre 8 à 15 % pour un email. La raison est mécanique : les demandes de message d'un compte non suivi tombent dans un onglet secondaire que la personne en charge ouvre une fois par semaine, quand elle l'ouvre. Ces deux réseaux ne sont pourtant pas à abandonner : ils fonctionnent très bien, mais **dans l'autre sens** — pour se faire trouver, pour préparer le terrain, et pour être déjà connue quand l'email arrive. Cette leçon les utilise correctement.

## Le contenu

### Pourquoi le message privé direct rend si peu

Trois causes.

**L'onglet des demandes.** Un message d'un compte non suivi n'apparaît pas dans la boîte principale. Il faut aller le chercher.

**Le volume.** Une marque avec 50 000 abonnés reçoit des dizaines de messages par semaine, dont beaucoup de spam.

**La personne.** Le compte Instagram est tenu par un community manager ou une agence, pas par la personne qui commande des créas. Ton message parfait arrive chez quelqu'un qui n'a ni le budget ni le mandat.

### La séquence qui fonctionne : chauffer avant d'écrire

Le principe est simple : ne plus être un inconnu au moment du contact.

**Semaine 1.** Suis la marque. Regarde ses stories. Réponds à deux ou trois d'entre elles par une phrase utile — une vraie remarque, pas un emoji. Les réponses aux stories arrivent dans la **boîte principale**, pas dans les demandes : c'est la faille qui change tout.

**Semaine 2.** Commente deux publications, avec quelque chose de substantiel. Le community manager finit par reconnaître ton pseudo.

**Semaine 3.** Envoie ton message. Il n'est plus dans les demandes si la marque a répondu à une de tes stories, et même sinon, ton pseudo est familier.

Cette séquence prend cinq minutes par semaine et par marque, et multiplie le taux de réponse par trois ou quatre.

### Le message privé, plus court que l'email

Quarante mots maximum. Le format long est illisible sur mobile dans une conversation.

> Bonjour ! Je suis créatrice UGC en [niche]. J'ai vu que vos pubs tournent surtout autour de [observation]. J'ai une idée d'angle sur [objection]. Je vous envoie une vidéo exemple si ça vous intéresse ? [pseudo] · [portfolio]

Une question à la fin : elle rend la réponse facile, y compris un simple « oui ».

### Le compte vitrine comme aimant

C'est là que le canal devient rentable. Trois types de contenus attirent les marques :

**Les extraits de créas livrées.** Avec l'accord du client, ou floutés si nécessaire. Une vidéo par semaine suffit.

**Les coulisses.** Le coin de tournage, le montage, le rangement du matériel. Ça rassure sur le professionnalisme et ça se produit en trente secondes.

**Les analyses.** « Voici pourquoi cette accroche retient. » C'est le format qui attire les responsables acquisition, parce qu'il prouve que tu comprends leur métier.

Ce qui n'attire personne : les publications de vie personnelle, les citations, les carrousels de conseils génériques.

### Les hashtags qui servent réellement

Trois familles, cinq à huit hashtags par publication, pas trente.

Le métier : `#ugc`, `#ugccreator`, `#ugcfrance`, `#creatriceugc`.
La niche : `#ugcbeaute`, `#ugcfood`, `#ugcfitness`.
Le format : `#videoverticale`, `#creapub`.

Ce sont les termes que les marques tapent réellement. Les hashtags de portée générale n'apportent que des créatrices qui te suivent.

### TikTok : la recherche est le canal

Sur TikTok, la barre de recherche fonctionne comme un moteur. Une marque tape « ugc [secteur] » et regarde les résultats.

Ce qui te rend trouvable : le mot « UGC » dans ton nom de compte, dans ta bio, dans les **légendes** de tes vidéos et prononcé dans les premières secondes de certaines d'entre elles — la plateforme indexe la parole.

Trois vidéos par semaine suffisent, sans obsession de performance.

## Exemple appliqué

Sarah passe deux mois à envoyer des messages privés directs : 120 messages, 5 réponses, 0 client.

Elle change de méthode en février.

**Ce qu'elle arrête** : les messages à froid en masse.

**Ce qu'elle met en place** : une liste de trente marques de sa niche, suivies. Chaque matin, dix minutes : elle répond à deux ou trois stories avec une remarque réelle — « la nouvelle teinte est beaucoup plus lisible en petit format » — et commente deux publications.

**Ce qu'elle publie** : deux vidéos par semaine sur son compte. Une créa livrée, une analyse d'accroche.

**Semaine 3.** Elle envoie ses premiers messages, aux marques qui ont déjà répondu à une de ses stories. Sur douze messages, sept réponses.

**Semaine 6.** Deux marques la contactent spontanément après avoir vu ses analyses d'accroches. L'une écrit : « on te voyait passer, on a regardé ton compte ».

**Mois 3.** Quatre clients issus de ce canal, dont deux entrants. Le même effort qu'avant, dans l'autre sens.

Le chiffre qui résume : 120 messages à froid, 0 client. Trente marques chauffées trois semaines, 4 clients.

## Les erreurs fréquentes

Envoyer des messages privés à froid en masse. Deux à quatre pour cent, et ton compte peut être limité par la plateforme.

Écrire un pavé en message privé. Illisible sur mobile, archivé aussitôt.

Traiter le compte vitrine comme un compte personnel. Les marques regardent les trois premières vidéos.

Répondre à une story par un emoji. Ça ne crée aucune reconnaissance ; une phrase utile, si.

Mettre trente hashtags. Cinq à huit ciblés font mieux, et les termes de métier valent plus que les termes de portée.

Attendre la viralité. Une vidéo à mille vues vue par la bonne responsable acquisition vaut mieux qu'une à cent mille vue par personne du secteur.

## Action immédiate

Fais une liste de trente marques de ta niche et suis-les toutes aujourd'hui. Bloque dix minutes chaque matin, dans ton agenda, avec l'intitulé « stories + commentaires ». Pendant trois semaines, tu ne demandes rien. À la quatrième, tu écris — et tu compareras ton taux de réponse à celui de tes messages précédents.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Instagram et TikTok dans le bon sens","description":"La séquence de chauffe semaine par semaine, le message privé de quarante mots, les trois formats qui attirent les marques et les hashtags qui servent réellement.","kind":"document","url":null,"body":"## Instagram et TikTok : les utiliser dans le bon sens\n\n### Pourquoi le message privé à froid rend si peu\n\n| Cause | Effet |\n|---|---|\n| Onglet « demandes » | Le message n'arrive pas dans la boîte principale |\n| Volume | Des dizaines par semaine, beaucoup de spam |\n| Mauvaise personne | Le compte est tenu par un CM, pas par l'acheteur de créas |\n\n**Taux de réponse : 2 à 4 %**, contre 8 à 15 % pour un email nommé.\n\n### La séquence de chauffe — 5 min / semaine / marque\n\n| Semaine | Geste | Pourquoi |\n|---|---|---|\n| 1 | Suivre + répondre à 2-3 stories par une **phrase utile** | Une réponse à story arrive dans la **boîte principale** |\n| 2 | Commenter 2 publications avec du fond | Le pseudo devient familier |\n| 3 | Envoyer le message | Tu n'es plus une inconnue |\n\nTaux de réponse multiplié par trois à quatre.\n\n### Le message privé — 40 mots maximum\n\n> Bonjour ! Je suis créatrice UGC en [niche]. J'ai vu que vos pubs tournent\n> surtout autour de [observation]. J'ai une idée d'angle sur [objection].\n> Je vous envoie une vidéo exemple si ça vous intéresse ?\n\nToujours finir par une question : elle rend un « oui » possible.\n\n### Ce qui attire les marques sur ton compte\n\n| Format | Fréquence | Effet |\n|---|---|---|\n| Extrait de créa livrée | 1 / semaine | Preuve de travail |\n| Coulisses (coin, montage) | ponctuel | Rassure sur le professionnalisme |\n| **Analyse d'accroche** | 1 / semaine | Attire les responsables acquisition |\n\nN'attire personne : vie personnelle, citations, carrousels de conseils génériques.\n\n### Hashtags — 5 à 8, jamais 30\n\n**Métier** : #ugc #ugccreator #ugcfrance #creatriceugc\n**Niche** : #ugcbeaute #ugcfood #ugcfitness\n**Format** : #videoverticale #creapub\n\n### TikTok : la recherche est le canal\n\nLe mot « UGC » doit être dans : le nom de compte · la bio · les **légendes** ·\net **prononcé** dans les premières secondes de certaines vidéos — la\nplateforme indexe la parole.\n"},{"title":"Checklist de la routine quotidienne","description":"Dix minutes : deux à trois réponses aux stories avec une phrase utile, deux commentaires de fond. Aucune demande avant la quatrième semaine.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '86074810-630b-464e-a1d7-221e43568841'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '612a956e-ba82-4b7b-b6f9-7d29c31a02a7'::uuid, m.id, m.course_id, m.org_id, 'linkedin-et-agences', $sq$LinkedIn et les agences : le canal que personne n'exploite$sq$, $sq$Les décideurs y sont nommés et joignables, les créatrices n'y sont pas. Le profil en quatre lignes, la routine de dix minutes par jour, et la manière de démarcher une agence — dont un seul contrat vaut cinq contrats de marque.$sq$, $sq$## L'accroche

Il existe un canal où les décideurs sont nommés, joignables, et où la concurrence est quasi nulle. Ce n'est ni Instagram ni TikTok : c'est LinkedIn. La responsable acquisition qui commande des créas y a un profil public avec son intitulé de poste. Son agence aussi. Et sur mille créatrices UGC françaises, une poignée y publie. Le résultat est mécanique : un message LinkedIn ciblé obtient deux à trois fois plus de réponses qu'un email froid, et les demandes entrantes qu'il génère sont mieux qualifiées. À côté, les **agences** constituent l'autre gisement ignoré du métier : une seule agence peut remplacer cinq marques en volume. Cette leçon travaille les deux ensemble, parce qu'on trouve les secondes sur le premier.

## Le contenu

### Pourquoi LinkedIn fonctionne pour ce métier

**Les bonnes personnes y sont.** « Responsable acquisition », « growth manager », « traffic manager », « head of performance », « social media manager » : ces intitulés se cherchent littéralement dans la barre de recherche.

**Il n'y a personne en face.** Le flux de ces personnes est rempli de publications d'outils et d'agences. Une créatrice qui publie une analyse de créa détonne.

**Le contexte est professionnel.** Un message y est lu comme une proposition de travail, pas comme une sollicitation.

**Le contenu dure.** Une publication LinkedIn continue de produire des vues pendant plusieurs jours, contre quelques heures ailleurs.

### Le profil en quatre lignes

**Le titre.** « Créatrice UGC — [niche] | vidéos publicitaires pour marques e-commerce ». Il contient les mots recherchés.

**La photo.** Un visage, net, neutre. Tu vends ta présence à l'écran : une photo floue est contradictoire.

**La bannière.** Trois vignettes de tes vidéos, ou une phrase et ton email. C'est de l'espace gratuit que presque personne n'utilise.

**La section « Infos ».** Cinq lignes : ce que tu produis, pour qui, en combien de temps, à partir de quel prix, et comment te joindre.

Ajoute tes vidéos en « sélection » — LinkedIn les lit directement dans le flux.

### La routine : dix minutes par jour

**Cinq commentaires** sous des publications de responsables acquisition ou de marques de ta niche. Pas « super post ! » : une remarque de professionnelle. C'est le geste qui te rend visible sans rien demander, et il est visible par tout le réseau de la personne.

**Une publication par semaine.** Le format qui marche : une vidéo, plus trois lignes d'analyse. « Cette accroche retient parce qu'elle nomme une situation avant de nommer un produit. » Deux minutes d'écriture.

**Cinq messages par semaine**, après avoir commenté leurs publications au moins deux fois.

### Le message LinkedIn

Plus court qu'un email, plus direct.

> Bonjour [Prénom], je vois que vous pilotez l'acquisition chez [Marque]. Je suis créatrice UGC en [niche] — je produis les vidéos verticales que vous diffusez en Meta et TikTok, livrées en 5 jours. J'ai regardé vos créas actuelles : elles tournent surtout autour de [observation]. J'ai un angle sur [objection] qui manque. Je vous envoie un exemple ?

Soixante mots. Une question à la fin.

### Les agences : le canal à meilleur rendement

Une agence d'acquisition gère la publicité de dix à quarante marques. Elle a un besoin **permanent** de créas, un budget déjà voté, et un problème récurrent : trouver des créatrices fiables.

Un contrat d'agence apporte du volume régulier, un interlocuteur unique, et zéro prospection ensuite.

**Comment les trouver.** Cherche sur LinkedIn « agence acquisition », « agence social ads », « growth agency » avec ta ville ou « France ». Regarde aussi les mentions « en partenariat avec » sur les publications de marques.

**À qui écrire.** Au directeur de création, au responsable de production, ou au fondateur si l'agence a moins de vingt personnes.

**Ce qu'elles veulent entendre.** Trois choses, dans cet ordre : ta **capacité mensuelle** (« jusqu'à 12 vidéos par mois »), ton **délai** (« 5 jours ouvrés »), ta **régularité**. La créativité vient après ; ce qui les inquiète, c'est qu'on leur livre en retard.

**Le prix.** Une agence négocie, et c'est normal : elle apporte du volume. Une remise de 10 à 15 % contre un engagement de volume mensuel est un bon échange. Une remise sans contrepartie, non.

### Le rythme

Cinq agences démarchées par mois, pas plus. Elles sont peu nombreuses dans une niche, et un message mal ciblé brûle une carte durablement.

Deux agences clientes suffisent à remplir la moitié d'un planning.

## Exemple appliqué

Nina, niche fitness et nutrition sportive, ouvre LinkedIn en octobre. Zéro relation dans le secteur.

**Semaine 1.** Elle refait son profil : titre, photo, bannière avec trois vignettes, section Infos en cinq lignes. Elle ajoute quatre vidéos en sélection.

**Semaines 1 à 4.** Dix minutes par jour : cinq commentaires. Elle cible douze responsables acquisition de marques sportives et six agences.

**Publications.** Une par semaine : une créa, trois lignes d'analyse. La quatrième dépasse 6 000 vues — un chiffre modeste ailleurs, énorme ici, parce que ce sont **les bonnes** 6 000 personnes.

**Semaine 5.** Elle envoie cinq messages à des personnes dont elle a commenté les publications. Trois réponses, deux appels.

**Semaine 7.** Une agence de six personnes lui donne un test : une vidéo pour un de ses clients. Elle livre en trois jours au lieu de cinq.

**Semaine 9.** L'agence lui commande six vidéos par mois pour trois marques différentes, à 210 € l'unité — un tarif négocié en échange du volume. 1 260 € par mois, prévisibles, sans prospection.

**Mois 6.** Deux agences, 2 300 € de récurrent, plus trois marques en direct trouvées par entrant LinkedIn.

Le canal que personne ne travaille lui fournit désormais 70 % de son chiffre d'affaires.

## Les erreurs fréquentes

Ne pas y aller parce qu'on n'y a « pas d'audience ». C'est justement l'avantage : très peu de créatrices, beaucoup de décideurs.

Écrire avant d'avoir commenté. Un message d'un profil totalement inconnu se traite comme du démarchage ; un profil déjà vu deux fois, non.

Commenter « super post ». Ça ne construit rien. Une remarque de professionnelle, si.

Traiter une agence comme une marque. Une agence achète de la capacité et de la fiabilité, pas une idée créative.

Accorder une remise à une agence sans engagement de volume. La remise se donne contre du volume écrit, jamais contre une promesse.

Démarcher vingt agences en un mois. Elles sont peu nombreuses, elles se parlent, et un message générique brûle la carte pour longtemps.

## Action immédiate

Réécris ton titre LinkedIn aujourd'hui — « Créatrice UGC — [niche] | vidéos publicitaires pour marques e-commerce » — et ajoute trois vidéos en sélection. Puis cherche « responsable acquisition » plus le nom de ta niche, et fais une liste de quinze personnes. Commente une de leurs publications chaque jour pendant deux semaines avant d'écrire à quiconque. C'est l'investissement le plus rentable de tout ce module.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"LinkedIn et les agences","description":"Le profil en quatre lignes, la routine quotidienne, le message de soixante mots, la méthode de démarchage d'agence et les intitulés de poste à chercher.","kind":"document","url":null,"body":"## LinkedIn et les agences\n\n### Le profil en quatre lignes\n\n| Élément | Contenu |\n|---|---|\n| Titre | Créatrice UGC — [niche] \\| vidéos publicitaires pour marques e-commerce |\n| Photo | Un visage, net, neutre |\n| Bannière | Trois vignettes de vidéos, ou une phrase + email |\n| Infos | Ce que tu produis, pour qui, délai, prix de départ, contact |\n\nAjoute tes vidéos en **sélection** : LinkedIn les lit dans le flux.\n\n### La routine — dix minutes par jour\n\n- **5 commentaires** sous des publications de décideurs de ta niche (pas « super post »)\n- **1 publication par semaine** : une vidéo + trois lignes d'analyse\n- **5 messages par semaine**, après avoir commenté deux fois la personne\n\n### Le message LinkedIn — 60 mots\n\n> Bonjour [Prénom], je vois que vous pilotez l'acquisition chez [Marque].\n> Je suis créatrice UGC en [niche] — je produis les vidéos verticales que vous\n> diffusez en Meta et TikTok, livrées en 5 jours. J'ai regardé vos créas\n> actuelles : elles tournent surtout autour de [observation]. J'ai un angle\n> sur [objection] qui manque. Je vous envoie un exemple ?\n\n### Les agences : le meilleur rendement du métier\n\nUne agence gère 10 à 40 marques, a un besoin **permanent** de créas, un budget\nvoté, et un problème : trouver des créatrices fiables.\n\n| Question | Réponse |\n|---|---|\n| Où les trouver ? | LinkedIn : « agence acquisition », « agence social ads », « growth agency » + ville |\n| À qui écrire ? | Directeur de création, responsable de production, fondateur si < 20 personnes |\n| Ce qu'elles veulent entendre | 1. Capacité mensuelle 2. Délai 3. Régularité — la créativité vient après |\n| Remise acceptable | 10 à 15 % **contre un volume mensuel écrit**, jamais contre rien |\n| Rythme de démarchage | 5 par mois maximum — elles sont peu nombreuses et se parlent |\n\n**Deux agences clientes remplissent la moitié d'un planning.**\n\n### Les intitulés à chercher\n\nResponsable acquisition · growth manager · traffic manager ·\nhead of performance · social media manager · brand manager ·\ndirecteur de création · responsable de production.\n"},{"title":"LinkedIn","description":"Le canal où se trouvent les responsables acquisition et les agences, et où la concurrence entre créatrices UGC est quasi nulle.","kind":"link","url":"https://www.linkedin.com"}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '86074810-630b-464e-a1d7-221e43568841'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid, c.id, c.org_id, 'prospection-ugc', $sq$Prospection : écrire, relancer, suivre$sq$, $sq$Ce module industrialise la recherche de clients : trouver la personne nommée en trois minutes, tenir une séquence de relance qui double le nombre de signatures, suivre soixante marques dans un tableur à sept colonnes, répondre aux huit objections réelles sans jamais baisser son prix, et transformer un « oui » en devis signé en quarante-huit heures.$sq$, 6, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ddd838a8-6f9e-42d2-b31b-0c856b38e7f0'::uuid, m.id, m.course_id, m.org_id, 'trouver-la-bonne-personne', $sq$Trouver la bonne personne dans la marque$sq$, $sq$Un message à une adresse générique obtient trois fois moins de réponses. Qui chercher selon la taille de l'entreprise, l'ordre des cinq sources, les cinq formats d'adresse et la manière de deviner le bon en une minute.$sq$, $sq$## L'accroche

Le meilleur message du monde envoyé à `contact@marque.fr` a environ trois fois moins de chances d'obtenir une réponse que le même message envoyé à `claire.d@marque.fr`. La raison n'a rien de mystérieux : l'adresse générique est relevée par un stagiaire, un service client ou personne, et l'expéditeur inconnu y est traité comme du bruit. Trouver la bonne personne prend deux à trois minutes par marque et transforme le rendement de tout ton démarchage. C'est le travail le moins glamour de ce métier et le plus rentable à l'heure. Cette leçon donne la méthode, l'ordre des sources, et les cinq formats d'adresse qui couvrent la quasi-totalité des cas.

## Le contenu

### Qui chercher, selon la taille de la marque

**Moins de 10 personnes.** Écris au fondateur ou à la fondatrice. C'est elle qui décide de tout, budget compris, et elle lit ses messages.

**10 à 50 personnes.** Cherche « responsable acquisition », « growth », « traffic manager », « responsable e-commerce » ou « responsable marketing ». C'est la zone idéale : quelqu'un dont c'est le métier, avec un budget et sans dix niveaux de validation.

**Plus de 50 personnes.** « Brand manager », « social media manager », « responsable contenu », ou l'agence qui gère leur publicité. Les cycles sont plus longs, les budgets plus grands.

**Marques distribuées par une agence.** Écris à l'agence. Elle décide des créas, et un contrat d'agence vaut plusieurs marques.

### L'ordre des sources

**1. LinkedIn.** Cherche le nom de la marque, ouvre l'onglet « Personnes », filtre sur les intitulés ci-dessus. C'est la source la plus fiable, et elle donne le prénom, le nom et le poste exact.

**2. Le site de la marque.** Pages « À propos », « L'équipe », « Presse ». Les mentions légales donnent souvent le nom du directeur de publication.

**3. Les mentions de presse.** Une interview du fondateur donne un nom et parfois une adresse.

**4. Instagram.** Certaines marques mettent l'adresse de leur responsable partenariats en bio ou en story épinglée.

**5. Le formulaire, en dernier recours.** Si vraiment rien, écris via le formulaire en demandant explicitement à être redirigée : « pourriez-vous transmettre à la personne en charge de l'acquisition ? ». Cette phrase fonctionne étonnamment bien.

### Les cinq formats d'adresse

Une fois le nom obtenu, l'adresse suit presque toujours l'un de ces cinq schémas :

- `prenom@marque.fr`
- `prenom.nom@marque.fr`
- `p.nom@marque.fr`
- `prenom.n@marque.fr`
- `pnom@marque.fr`

Pour deviner le bon : regarde une adresse publique quelconque du domaine — celle du service presse, du service client, ou d'un communiqué. Le schéma est le même pour toute l'entreprise.

En cas de doute, envoie aux deux formats les plus probables **dans deux messages séparés**, pas en copie. Une adresse invalide renvoie une erreur, ce qui te confirme l'autre.

### La vérification

Deux réflexes suffisent.

**Le message d'erreur.** Une adresse inexistante te revient en général en quelques minutes. Absence d'erreur ne prouve pas la remise, mais son arrivée prouve l'inverse.

**Le doublon.** Ne relance jamais une adresse qui a rebondi ; note-la comme morte dans ton tableau et cherche un autre nom.

### Ce qu'il ne faut pas faire

**Acheter une base d'adresses.** Qualité déplorable, adresses périmées, et tu passes pour un envoi de masse dès le premier message.

**Utiliser un outil d'envoi automatique en masse.** Il te fera classer en spam durablement, et l'adresse de ton domaine sera brûlée.

**Mettre plusieurs personnes en copie.** Chacune pense que l'autre répondra. Une seule destinataire, toujours.

**Écrire à `hello@`, `info@`, `bonjour@`.** Même problème que `contact@`.

### Le temps que ça prend

Deux à trois minutes par marque, une fois la méthode acquise. Sur vingt messages hebdomadaires, cela représente moins d'une heure — pour un taux de réponse multiplié par trois.

Fais-le en lot : une session de trente minutes pour trouver dix noms, puis une session d'écriture. Alterner recherche et rédaction coûte deux fois plus de temps.

## Exemple appliqué

Manon veut écrire à une marque de savons solides, une quinzaine de personnes.

**LinkedIn (90 secondes).** Elle tape le nom de la marque, onglet Personnes. Sept profils. Elle repère « Responsable acquisition & performance » : Julie L., en poste depuis huit mois.

**Le format d'adresse (60 secondes).** Sur le site, la page presse donne `presse@lamarque.fr` — inutile. Mais un communiqué en PDF cite « marie.dubois@lamarque.fr ». Le schéma est donc `prenom.nom@`. Elle en déduit `julie.lambert@lamarque.fr`.

**La vérification (30 secondes).** Elle envoie. Aucun rebond. L'adresse est vivante.

**Le bonus.** Sur le profil LinkedIn de Julie, une publication de la semaine précédente : « on cherche à diversifier nos créas vidéo ce trimestre ». Manon l'intègre à son message : « J'ai vu votre publication sur la diversification des créas ce trimestre. »

**Résultat.** Réponse en quatre heures : « votre timing est parfait ». Trois vidéos commandées la semaine suivante.

Trois minutes de recherche ont produit à la fois la bonne adresse et la bonne accroche. Le message générique à `contact@` n'aurait rien donné, et surtout n'aurait jamais contenu cette phrase.

## Les erreurs fréquentes

Écrire à l'adresse générique. C'est le choix par défaut, et il divise par trois le rendement de tout le reste.

Chercher le nom au moment d'écrire. Alterner recherche et rédaction double le temps total ; travaille en lots.

Mettre trois personnes en copie. Chacune attend que l'autre réponde.

Acheter une liste. Adresses mortes, réputation d'expéditeur abîmée, aucun ciblage.

Utiliser un outil d'envoi automatique. Vingt messages par semaine s'envoient à la main, et c'est précisément ce qui les rend crédibles.

Ignorer les publications récentes de la personne. C'est la source d'accroche la plus efficace du métier, et elle est gratuite.

## Action immédiate

Prends cinq marques de ta liste et, pour chacune, trouve le nom et le poste de la personne en charge de l'acquisition ou du marketing sur LinkedIn. Note-les dans un tableau avec le format d'adresse déduit. Chronomètre-toi : tu verras que les cinq prennent moins de quinze minutes, et que c'est le quart d'heure le plus rentable de ta semaine.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Trouver la bonne personne","description":"Le tableau des cibles par taille d'entreprise, l'ordre des sources, les cinq formats d'adresse et la méthode pour deviner le bon schéma.","kind":"document","url":null,"body":"## Trouver la bonne personne\n\n### Qui chercher selon la taille\n\n| Taille | Cible | Pourquoi |\n|---|---|---|\n| < 10 personnes | Fondateur / fondatrice | Décide de tout, lit ses messages |\n| 10 – 50 | Responsable acquisition, growth, traffic manager, e-commerce | Budget + mandat, peu de validations |\n| > 50 | Brand manager, social media manager, responsable contenu | Cycles longs, budgets grands |\n| Sous-traitée | L'**agence** qui gère la publicité | Un contrat vaut plusieurs marques |\n\n### L'ordre des sources\n\n1. **LinkedIn** — nom de la marque → onglet Personnes → filtrer sur l'intitulé\n2. **Le site** — pages À propos, L'équipe, Presse, mentions légales\n3. **La presse** — une interview donne un nom, parfois une adresse\n4. **Instagram** — bio ou story épinglée pour les partenariats\n5. **Le formulaire**, en dernier recours : « pourriez-vous transmettre à la personne en charge de l'acquisition ? »\n\n### Les cinq formats d'adresse\n\n- `prenom@marque.fr`\n- `prenom.nom@marque.fr`\n- `p.nom@marque.fr`\n- `prenom.n@marque.fr`\n- `pnom@marque.fr`\n\n**Pour deviner** : trouve une adresse publique du domaine (presse, communiqué,\nservice client). Le schéma est le même pour toute l'entreprise.\n\nEn cas de doute : deux messages **séparés**, jamais en copie. Un rebond\nconfirme l'autre.\n\n### Ce qu'il ne faut jamais faire\n\nAcheter une base · utiliser un outil d'envoi en masse (spam durable) ·\nmettre plusieurs personnes en copie · écrire à `hello@`, `info@`, `bonjour@`.\n\n### Le bonus qui vaut le détour\n\nRegarde les **publications récentes** de la personne sur LinkedIn. « J'ai vu\nvotre publication sur… » est l'accroche la plus efficace du métier, et elle\nest gratuite.\n\n### Organisation\n\nTravaille en **lots** : une session de 30 min pour trouver dix noms, puis une\nsession d'écriture. Alterner recherche et rédaction double le temps.\n"},{"title":"LinkedIn","description":"La source la plus fiable : nom de la marque, onglet Personnes, filtre sur l'intitulé de poste.","kind":"tool","url":"https://www.linkedin.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'b2c46ffb-9802-4149-938e-a614bdd2d09c'::uuid, m.id, m.course_id, m.org_id, 'la-relance', $sq$La relance : trois messages, un calendrier$sq$, $sq$Six clients signés sur dix le sont après une relance. La séquence à J+4, J+11 et J+25, les trois messages mot pour mot, la règle de l'élément nouveau et les formules qui t'abaissent.$sq$, $sq$## L'accroche

Sur dix clients signés en démarchage, six le sont après une relance, pas après le premier message. Ce chiffre devrait suffire à régler la question, et pourtant la relance est l'étape que presque toutes les créatrices sautent — par peur de déranger, par interprétation du silence comme un refus, ou simplement parce que personne ne leur a dit combien de fois relancer ni quand. Le silence n'est presque jamais un non : c'est un message lu un mardi à 9 h 12, entre deux réunions, avec l'intention d'y revenir. Cette leçon donne la séquence exacte — trois relances, un calendrier, et un contenu différent à chaque fois.

## Le contenu

### Pourquoi le silence n'est pas un refus

Une responsable acquisition reçoit entre trente et quatre-vingts emails par jour. Le tien arrive au mauvais moment dans neuf cas sur dix. Elle le lit, le trouve correct, se dit « à voir », et il descend.

Un refus s'écrit. Le silence, lui, signifie « pas maintenant », et « pas maintenant » se transforme régulièrement en « oui » à la deuxième ou troisième tentative.

### La séquence : trois relances, jamais plus

**Relance 1 — J+4.** Courte, sans reproche, avec **un élément nouveau**. Jamais « je me permets de revenir vers vous » tout seul.

**Relance 2 — J+11.** Un autre élément nouveau : une autre vidéo, un autre angle, une observation fraîche sur leur communication.

**Relance 3 — J+25.** La clôture polie. Elle libère la personne, et c'est paradoxalement celle qui obtient le plus de réponses.

Après la troisième, tu arrêtes. Tu remets la marque dans ton tableau avec la mention « à recontacter dans 3 mois ».

### Les trois messages

**Relance 1**

> Bonjour [Prénom],
>
> Je remonte mon message — j'ai tourné entre-temps une vidéo sur un angle proche du vôtre, la voici : [lien].
>
> Si le sujet n'est pas d'actualité, dites-le-moi simplement, je n'insisterai pas.
>
> Bonne journée.

**Relance 2**

> Bonjour [Prénom],
>
> J'ai vu que vous avez lancé [nouveauté observée]. Si vous cherchez des créas vidéo dessus, j'ai trois angles en tête, dont un sur [objection].
>
> Toujours disponible sous 5 jours.

**Relance 3**

> Bonjour [Prénom],
>
> Je clôture de mon côté pour ne pas encombrer votre boîte. Si le besoin revient dans quelques mois, mon portfolio est ici : [lien]. Bonne continuation.

Ce dernier message obtient souvent une réponse du type « ne partez pas, on relance en septembre » — et cette information vaut plus qu'un client immédiat.

### La règle de l'élément nouveau

Une relance qui n'apporte rien est une pression. Une relance qui apporte quelque chose est un second message.

Trois sources d'élément nouveau, toujours disponibles : une nouvelle vidéo de ton portfolio, une observation sur ce que la marque vient de publier, un angle supplémentaire.

Si tu n'as rien de nouveau, ne relance pas encore : attends d'avoir quelque chose.

### Le ton

Court. Aucune excuse. Aucun reproche.

Bannis : « je me permets de vous relancer », « désolée de vous déranger », « je n'ai pas eu de retour de votre part », « sauf erreur de ma part ». Ces formules t'abaissent et signalent que tu attends une faveur.

Écris comme quelqu'un qui a d'autres clients — parce que c'est le cas, ou parce que ce sera le cas.

### Ce que la relance change vraiment

Une donnée à retenir : le taux de réponse cumulé d'une séquence à trois relances est deux à trois fois supérieur à celui du premier message seul.

Autrement dit, ne pas relancer revient à jeter les deux tiers du travail de prospection déjà fait. C'est l'endroit du métier où le rapport effort/résultat est le plus favorable : deux minutes d'écriture pour un message qui a déjà été qualifié.

## Exemple appliqué

Élise écrit à quarante marques en mars. Douze réponses au premier message, deux clients.

En avril, elle applique la séquence complète sur les vingt-huit marques restées silencieuses.

**Relance 1 (J+4).** Vingt-huit messages, cinq minutes en tout — le texte est prêt, seul le lien change. Six réponses, dont deux « oui, parlons-en ».

**Relance 2 (J+11).** Vingt-deux messages restants. Elle vérifie rapidement les nouveautés de chaque marque : quatre ont lancé un produit, elle personnalise pour celles-là. Quatre réponses, un client signé.

**Relance 3 (J+25).** Dix-huit messages de clôture. Cinq réponses. Trois sont des « pas maintenant mais recontactez-nous en septembre » — qu'elle note dans son tableau. Une est un client immédiat : « justement on cherchait, votre message tombe bien ».

**Bilan.** Premier message seul : 2 clients. Avec la séquence : 4 clients et trois marques qualifiées pour la rentrée.

Temps total des trois relances : environ une heure. Rapporté au chiffre d'affaires supplémentaire, c'est l'heure la mieux payée de son trimestre.

## Les erreurs fréquentes

Ne pas relancer. Deux tiers des clients signés le sont après une relance : ne pas le faire revient à jeter la majorité de son travail.

Relancer sans rien de neuf. Une relance vide est une pression, et elle obtient des refus qui n'auraient pas existé.

S'excuser. « Désolée de vous déranger » installe un rapport de faveur.

Relancer trop vite. Moins de trois jours donne une impression d'urgence désespérée.

Relancer plus de trois fois. Au-delà, tu abîmes durablement la relation avec une marque qui reviendra peut-être plus tard.

Sauter la relance de clôture. C'est celle qui produit le plus de réponses, et la meilleure information : la date à laquelle revenir.

Ne pas noter les « pas maintenant ». Ce sont les clients les plus faciles du trimestre suivant.

## Action immédiate

Reprends tous les messages restés sans réponse depuis plus de quatre jours et envoie la relance 1 aujourd'hui, avec un lien vers une vidéo. Programme dans ton agenda les relances 2 et 3 aux bonnes dates. Si tu n'as jamais relancé personne, c'est l'action de cette formation qui produira le résultat le plus rapide — souvent dans les quarante-huit heures.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"La séquence de relance","description":"Le calendrier des trois relances, les trois messages types, la règle de l'élément nouveau et les formules bannies.","kind":"document","url":null,"body":"## La séquence de relance\n\n**Six clients signés sur dix le sont après une relance.** Ne pas relancer,\nc'est jeter les deux tiers du travail de prospection déjà fait.\n\n| Relance | Quand | Contenu | Objectif |\n|---|---|---|---|\n| 1 | J+4 | Une vidéo nouvelle | Remonter sans peser |\n| 2 | J+11 | Une observation fraîche, un autre angle | Retomber au bon moment |\n| 3 | J+25 | Clôture polie | Libérer — et souvent obtenir une date |\n\nAprès la troisième : statut « en sommeil », rappel dans trois mois.\n\n### Relance 1\n\n> Bonjour [Prénom],\n>\n> Je remonte mon message — j'ai tourné entre-temps une vidéo sur un angle\n> proche du vôtre, la voici : [lien].\n>\n> Si le sujet n'est pas d'actualité, dites-le-moi simplement, je n'insisterai\n> pas.\n>\n> Bonne journée.\n\n### Relance 2\n\n> Bonjour [Prénom],\n>\n> J'ai vu que vous avez lancé [nouveauté observée]. Si vous cherchez des créas\n> vidéo dessus, j'ai trois angles en tête, dont un sur [objection].\n>\n> Toujours disponible sous 5 jours.\n\n### Relance 3 — la clôture\n\n> Bonjour [Prénom],\n>\n> Je clôture de mon côté pour ne pas encombrer votre boîte. Si le besoin\n> revient dans quelques mois, mon portfolio est ici : [lien].\n> Bonne continuation.\n\nC'est celle qui obtient le plus de réponses — souvent « ne partez pas, on\nrelance en septembre ». **Note la date : ce sont les meilleurs prospects du\ntrimestre suivant.**\n\n### La règle de l'élément nouveau\n\nUne relance qui n'apporte rien est une pression. Trois sources toujours\ndisponibles : une nouvelle vidéo · une observation sur ce qu'ils viennent de\npublier · un angle supplémentaire. Rien de neuf ? N'envoie pas encore.\n\n### Formules bannies\n\n« Je me permets de vous relancer » · « Désolée de vous déranger » ·\n« Je n'ai pas eu de retour de votre part » · « Sauf erreur de ma part ».\nElles t'abaissent et signalent que tu attends une faveur.\n"},{"title":"Checklist d'avant-relance","description":"Ai-je un élément nouveau ? Est-ce que je m'excuse ? Est-ce la troisième ? Trois questions avant d'appuyer sur envoyer.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '2928e6a3-3e9d-4695-bfbf-66bbad1ed4aa'::uuid, m.id, m.course_id, m.org_id, 'le-pipeline', $sq$Le pipeline : suivre soixante marques sans rien oublier$sq$, $sq$Ce qu'on oublie sans système, ce sont les marques les plus avancées, parce qu'elles ne réclament rien. Sept colonnes, sept statuts, une règle qui fait tout le travail, une revue de quinze minutes le lundi et trois chiffres qui transforment une intuition en diagnostic.$sq$, $sq$## L'accroche

Au troisième mois d'activité, une créatrice suit en moyenne soixante marques à des stades différents : quinze jamais contactées, vingt en attente de relance, huit en discussion, trois qui ont dit « recontactez-nous en septembre », deux devis envoyés, quatre missions en cours, cinq clients passés à réactiver. Sans système, elle en oublie la moitié — et ce qu'elle oublie, ce sont presque toujours les plus avancées, parce qu'elles ne réclament rien. Le pipeline n'est pas un outil de gestion, c'est un outil de mémoire, et c'est la différence entre un mois à 800 € et un mois à 2 400 € avec exactement le même travail de prospection. Cette leçon monte le tien en vingt minutes, dans un tableur.

## Le contenu

### Les sept colonnes qui suffisent

Pas de logiciel, pas d'abonnement. Un tableur, sept colonnes.

**Marque.** Le nom.
**Personne.** Prénom, nom, poste.
**Contact.** L'adresse, ou le lien du profil.
**Statut.** Le stade, dans la liste ci-dessous.
**Dernière action.** Ce que tu as fait, et quand.
**Prochaine action.** Quoi, et à quelle date. C'est **la colonne qui fait tout le travail**.
**Notes.** L'observation utilisée, le budget évoqué, la date de rappel demandée.

### Les sept statuts

1. **À contacter** — identifiée, message pas encore écrit.
2. **Contactée** — premier message envoyé.
3. **Relancée** — au moins une relance partie.
4. **En discussion** — elle a répondu, l'échange est vivant.
5. **Devis envoyé** — la balle est dans son camp.
6. **Cliente** — mission en cours ou terminée.
7. **En sommeil** — refus poli, ou « recontactez-nous en [mois] ».

Le statut 7 n'est pas une poubelle : c'est une réserve. Une marque en sommeil relancée au bon moment convertit mieux qu'un contact froid.

### La règle qui rend le tableau vivant

**Aucune ligne sans prochaine action datée.**

Une ligne sans date suivante est une ligne morte : elle ne réapparaîtra jamais à ton attention. Chaque fois que tu fais quelque chose, tu écris immédiatement ce que tu feras ensuite et quand.

C'est une discipline de dix secondes, et c'est tout le système.

### La revue du lundi

Quinze minutes, chaque lundi matin, toujours.

1. Trie par « prochaine action » croissante.
2. Fais tout ce qui est daté d'aujourd'hui ou avant.
3. Repousse ou clôture ce qui n'a plus de sens.
4. Complète la ligne « à contacter » pour atteindre ton objectif hebdomadaire.

Cette revue remplace toute la gestion mentale de la prospection. Le reste de la semaine, tu n'y penses plus.

### Les trois chiffres à suivre

En bas du tableau, trois compteurs mis à jour une fois par mois :

**Le taux de réponse** — réponses ÷ contacts. Sous 5 %, ton message ou ton ciblage est à revoir.
**Le taux de conversion** — clients ÷ réponses. Sous 20 %, le problème est dans ta proposition ou ton prix.
**Le délai moyen** — jours entre le premier contact et la signature. Il te dit combien d'avance prendre : si c'est 28 jours, les contacts d'aujourd'hui paient dans un mois.

Ces trois chiffres transforment une intuition — « ça ne marche pas » — en diagnostic — « mon taux de réponse est bon, ma conversion est mauvaise, donc c'est mon devis qu'il faut revoir ».

### Le volume à tenir

Une règle utile : **le nombre de lignes en statut 1 et 2 doit toujours être au moins le triple de ton objectif mensuel de clients.**

Deux clients par mois visés, avec un rendement de 100 contacts pour 1 à 2 clients : il faut une centaine de contacts en cours à tout moment. Un pipeline vide en mars, c'est un mois d'avril vide, et la cause sera invisible sur le moment.

## Exemple appliqué

Amandine tient son pipeline dans un tableur partagé avec elle-même sur téléphone et ordinateur.

**Un lundi de mai, sa revue.**

Trois lignes datées d'aujourd'hui : une relance 2 pour une marque de thé, un devis à envoyer à une marque de bougies, un appel de suivi avec une agence.

Deux lignes en retard de trois jours : elle les traite d'abord.

Quatre lignes en sommeil avec « recontacter en mai » : elle les réveille avec un message court — « vous m'aviez dit de revenir en mai, voici où j'en suis ». Deux répondent dans la journée. Ce sont les meilleurs prospects de sa semaine et ils lui ont coûté quatre minutes.

**Ses compteurs du mois d'avril** : 84 contacts, 11 réponses (13 %), 3 clients (27 % de conversion), délai moyen 22 jours.

Elle en tire une décision concrète : son taux de réponse est bon, sa conversion aussi, donc elle n'a rien à corriger dans son message — elle doit simplement **augmenter le volume**. Elle passe de 20 à 28 contacts par semaine.

**Juin** : 112 contacts, 15 réponses, 5 clients. Aucune amélioration qualitative, juste le bon diagnostic posé grâce à trois chiffres.

Sans le tableau, elle aurait probablement réécrit son message — en corrigeant ce qui n'était pas cassé.

## Les erreurs fréquentes

Ne pas en tenir. La mémoire ne suit pas au-delà de vingt marques, et ce sont les plus avancées qu'on oublie.

Utiliser un outil complexe. Un tableur à sept colonnes se tient ; un CRM complet s'abandonne en trois semaines.

Laisser des lignes sans prochaine action datée. Elles disparaissent définitivement de ton attention.

Supprimer les refus. Une marque qui refuse en mars peut acheter en octobre. Passe-la en sommeil.

Ne pas mesurer. Sans les trois taux, on corrige au hasard — et souvent ce qui marchait déjà.

Laisser le pipeline se vider quand on a du travail. C'est l'erreur classique du troisième mois : un mois chargé, aucune prospection, un mois suivant vide.

## Action immédiate

Ouvre un tableur et crée les sept colonnes maintenant. Remplis-le avec toutes les marques que tu as déjà contactées, même de mémoire, et donne à chaque ligne une prochaine action datée. Puis bloque quinze minutes tous les lundis matin dans ton agenda, avec l'intitulé « revue pipeline ». C'est le rendez-vous le plus rentable de ta semaine.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Le pipeline en sept colonnes","description":"Le tableau à recopier, les sept statuts, la règle de la prochaine action datée, la revue du lundi, les trois indicateurs mensuels et la règle de volume.","kind":"document","url":null,"body":"## Le pipeline en sept colonnes\n\nUn tableur suffit. Pas de CRM : un outil complexe s'abandonne en trois semaines.\n\n| Marque | Personne | Contact | Statut | Dernière action | **Prochaine action + date** | Notes |\n|---|---|---|---|---|---|---|\n|  |  |  |  |  |  |  |\n\n### Les sept statuts\n\n| # | Statut | Signification |\n|---|---|---|\n| 1 | À contacter | Identifiée, message pas écrit |\n| 2 | Contactée | Premier message parti |\n| 3 | Relancée | Au moins une relance |\n| 4 | En discussion | Elle a répondu, échange vivant |\n| 5 | Devis envoyé | La balle est chez elle |\n| 6 | Cliente | Mission en cours ou passée |\n| 7 | En sommeil | Refus poli, ou « revenez en [mois] » |\n\nLe statut 7 est une **réserve**, pas une poubelle : mieux converti qu'un\ncontact froid.\n\n### La règle qui fait tout le système\n\n**Aucune ligne sans prochaine action datée.** Une ligne sans date ne\nréapparaîtra jamais. Dix secondes de discipline après chaque geste.\n\n### La revue du lundi — 15 minutes\n\n1. Trier par « prochaine action » croissante\n2. Faire tout ce qui est daté d'aujourd'hui ou avant\n3. Repousser ou clôturer ce qui n'a plus de sens\n4. Compléter « à contacter » jusqu'à l'objectif hebdomadaire\n\n### Les trois chiffres du mois\n\n| Indicateur | Calcul | Seuil d'alerte | Ce qu'il faut corriger |\n|---|---|---|---|\n| Taux de réponse | réponses ÷ contacts | < 5 % | Le message ou le ciblage |\n| Taux de conversion | clients ÷ réponses | < 20 % | La proposition ou le prix |\n| Délai moyen | jours contact → signature | — | Ton avance de prospection |\n\nIls transforment « ça ne marche pas » en diagnostic précis.\n\n### La règle de volume\n\n**Lignes en statut 1 et 2 ≥ 3 × ton objectif mensuel de clients.**\nUn pipeline vide en mars donne un avril vide — et la cause est invisible sur\nle moment.\n"},{"title":"Google Sheets","description":"Le tableur partagé entre téléphone et ordinateur, qui suffit largement là où un CRM s'abandonne en trois semaines.","kind":"tool","url":"https://sheets.google.com"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '1e759079-e74c-4579-b201-eafc79fe576d'::uuid, m.id, m.course_id, m.org_id, 'traiter-les-objections', $sq$Traiter les objections sans jamais baisser son prix$sq$, $sq$« On a déjà une équipe », « c'est trop cher », « envoyez votre book » : aucune de ces phrases n'est un refus. Les huit objections réelles, la réponse à chacune, et la règle qui traite le prix par le périmètre.$sq$, $sq$## L'accroche

« On a déjà une équipe interne. » « C'est trop cher. » « Envoyez-nous votre book, on revient vers vous. » Ces trois phrases représentent l'écrasante majorité des réponses négatives du métier, et les trois sont mal comprises. Aucune n'est un refus : la première est une information, la deuxième est une demande de justification, la troisième est une esquive polie. Les traiter comme des non fait perdre à peu près un client sur trois. Les traiter comme ce qu'elles sont — des objections, c'est-à-dire des portes entrouvertes — demande une phrase, préparée à l'avance, calme. Cette leçon donne les huit objections réelles et les réponses qui fonctionnent.

## Le contenu

### Le principe : une objection est un signe de vie

Quelqu'un qui ne veut rien ne répond pas. Une objection prouve que le message a été lu et que le sujet a été considéré. C'est déjà une conversation.

La règle de réponse tient en trois temps : **accepter, reformuler, proposer autre chose**. Jamais argumenter frontalement, jamais insister sur le même terrain.

### Les huit objections, et leurs réponses

**1. « On a déjà une équipe interne / une créatrice. »**

C'est une information, pas une porte fermée. Une équipe interne a un angle mort : elle connaît trop la marque et manque de visages nouveaux.

> « Parfait, ça veut dire que la production tourne. Ce que j'apporte, c'est un visage et un ton différents des vôtres — utile en test A/B contre vos créas internes. Je peux vous en faire une seule pour comparer ? »

**2. « C'est trop cher. »**

Ne baisse jamais le prix. Réduis le périmètre.

> « Je comprends. Mon prix couvre la production et trois mois de droits publicitaires. Si le budget est de X, je vous propose deux vidéos au lieu de trois — ou trois vidéos avec des droits d'un mois. Les deux tiennent dans X. »

**3. « Envoyez votre book, on revient vers vous. »**

C'est l'esquive la plus fréquente. Réponds en gardant l'initiative.

> « Le voici : [lien]. Pour gagner du temps, dites-moi votre produit prioritaire du trimestre et je vous envoie trois angles précis d'ici jeudi. »

Tu transformes une attente passive en action datée.

**4. « On n'a pas de budget en ce moment. »**

Une info de calendrier, pas de refus.

> « Compris. Vos budgets se recalent à quel moment, en général ? Je vous recontacte à ce moment-là. »

Note la date dans ton pipeline. Ce sont les meilleurs prospects du trimestre suivant.

**5. « On ne travaille qu'avec des créatrices qui ont une grosse audience. »**

Confusion de métier, à corriger doucement.

> « Là vous parlez d'influence — c'est un autre métier et un autre budget. Moi je vous livre des fichiers que vous diffusez en publicité depuis votre compte : mon audience n'entre pas dans l'équation, la performance de la créa oui. »

**6. « On veut voir des résultats avant de s'engager. »**

Légitime. Propose un test borné.

> « Faisons un test : deux vidéos, deux angles différents. Vous les diffusez, et si le coût par achat bouge dans le bon sens, on passe à un rythme mensuel. »

**7. « Vous êtes plus chère que les autres. »**

Différencie sur ce qui n'est pas le prix.

> « C'est possible. Ce que j'inclus : deux allers-retours, la livraison en cinq jours, les formats 9:16 et 1:1, et trois hooks alternatifs sur demande. Si l'un de ces points ne vous sert pas, on peut le retirer et ajuster. »

**8. « On préfère travailler avec une agence. »**

Ne te bats pas contre l'agence — travaille avec elle.

> « Très bien. Quelle agence, si ce n'est pas indiscret ? Beaucoup me confient directement la production vidéo, je peux les contacter de votre part. »

### Les deux règles de ton

**Ne jamais argumenter deux fois sur le même point.** Une seule réponse. Si elle ne suffit pas, change de terrain ou clôture proprement.

**Ne jamais brader.** L'objection prix se traite par le périmètre. Une remise consentie sous pression devient le prix de référence de toute la relation.

### Le vrai refus

Il existe, et il se reconnaît : « merci, ce n'est pas pour nous », sans question, sans détail.

Réponse en une ligne : « Compris, merci de la réponse. Je reviendrai vers vous si mon offre évolue. » Puis statut « en sommeil » et rappel dans quatre mois. Insister ici ne rapporte rien et coûte la porte.

## Exemple appliqué

Farida reçoit trois réponses la même semaine.

**Marque 1 — « On a déjà une créatrice qui travaille pour nous. »**
Elle répond avec la réponse 1. Retour : « c'est vrai qu'on tourne toujours avec le même visage ». Une vidéo test à 220 €. Deux mois plus tard, quatre par mois.

**Marque 2 — « 220 € c'est au-dessus de notre budget, on est à 150. »**
Elle ne baisse pas. Elle propose : trois vidéos à 150 € avec droits d'un mois seulement, ou deux vidéos à 220 € avec trois mois. La marque choisit la seconde. Prix unitaire tenu, budget respecté, et la marque a eu l'impression de décider — parce qu'elle a décidé.

**Marque 3 — « Envoyez votre book. »**
Elle envoie le lien plus la question sur le produit prioritaire. La marque répond « notre nouveau sérum ». Farida envoie trois angles le jeudi. Devis accepté le lundi.

Trois objections, trois clients. Aucune n'était un refus, et aucune n'a demandé de baisser un prix.

## Les erreurs fréquentes

Prendre une objection pour un refus. C'est l'erreur qui coûte le plus de clients, et elle est invisible.

Baisser son prix à la première résistance. Le nouveau prix devient la référence pour toujours.

Argumenter longuement. Une réponse, une proposition, et on passe à autre chose.

Se justifier sur son manque d'audience. Corrige la confusion de métier, ne t'excuse pas.

Envoyer son book et attendre. « Envoyez et on revient vers vous » sans action datée de ton côté ne produit rien.

Insister après un vrai refus. Une ligne polie, mise en sommeil, rappel dans quatre mois.

Ne pas noter la date des budgets. « Pas de budget maintenant » est une information de valeur, à condition de l'écrire.

## Action immédiate

Écris les huit réponses dans une note de ton téléphone, avec tes mots. Le but n'est pas de les réciter mais de ne jamais improviser sous pression : une objection reçue par message se répond à froid, une objection reçue au téléphone se répond en trois secondes si la phrase existe déjà. Relis-les avant chaque appel.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les huit objections et leurs réponses","description":"Chaque objection avec sa réponse mot pour mot, le principe accepter-reformuler-proposer, et la manière de reconnaître un vrai refus.","kind":"document","url":null,"body":"## Les huit objections et leurs réponses\n\n**Principe** : accepter, reformuler, proposer autre chose. Jamais argumenter\nfrontalement, jamais deux fois sur le même terrain.\n\n### 1. « On a déjà une équipe interne »\n\n> Parfait, ça veut dire que la production tourne. Ce que j'apporte, c'est un\n> visage et un ton différents des vôtres — utile en test A/B contre vos créas\n> internes. Je peux vous en faire une seule pour comparer ?\n\n### 2. « C'est trop cher »\n\n> Je comprends. Mon prix couvre la production et trois mois de droits.\n> Si le budget est de X, je vous propose deux vidéos au lieu de trois — ou\n> trois vidéos avec des droits d'un mois. Les deux tiennent dans X.\n\n**Jamais le prix unitaire. Toujours le périmètre.**\n\n### 3. « Envoyez votre book, on revient vers vous »\n\n> Le voici : [lien]. Pour gagner du temps, dites-moi votre produit prioritaire\n> du trimestre et je vous envoie trois angles précis d'ici jeudi.\n\n### 4. « Pas de budget en ce moment »\n\n> Compris. Vos budgets se recalent à quel moment, en général ?\n> Je vous recontacte à ce moment-là.\n\n**Note la date. Meilleur prospect du trimestre suivant.**\n\n### 5. « On veut une créatrice avec une grosse audience »\n\n> Là vous parlez d'influence — autre métier, autre budget. Moi je vous livre\n> des fichiers que vous diffusez depuis votre compte : mon audience n'entre\n> pas dans l'équation, la performance de la créa oui.\n\n### 6. « On veut voir des résultats avant de s'engager »\n\n> Faisons un test : deux vidéos, deux angles différents. Vous les diffusez, et\n> si le coût par achat bouge dans le bon sens, on passe à un rythme mensuel.\n\n### 7. « Vous êtes plus chère que les autres »\n\n> C'est possible. Ce que j'inclus : deux allers-retours, la livraison en cinq\n> jours, les formats 9:16 et 1:1, trois hooks alternatifs sur demande.\n> Si l'un de ces points ne vous sert pas, on le retire et on ajuste.\n\n### 8. « On préfère travailler avec une agence »\n\n> Très bien. Quelle agence, si ce n'est pas indiscret ? Beaucoup me confient\n> directement la production vidéo, je peux les contacter de votre part.\n\n### Le vrai refus\n\n« Merci, ce n'est pas pour nous », sans question, sans détail.\n\n> Compris, merci de la réponse. Je reviendrai vers vous si mon offre évolue.\n\nStatut « en sommeil », rappel dans quatre mois. Insister coûte la porte.\n"},{"title":"Checklist d'avant-appel","description":"Relire les huit réponses avant chaque échange téléphonique : une objection se répond en trois secondes si la phrase existe déjà.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3ea7334d-39a0-469d-b724-423a16bc8841'::uuid, m.id, m.course_id, m.org_id, 'du-oui-au-devis', $sq$Du « oui » au devis signé en quarante-huit heures$sq$, $sq$Un devis envoyé sous deux jours est accepté deux fois plus souvent que le même une semaine plus tard. Les trois questions, la structure en six blocs, la règle des trois options et le suivi qui récupère la moitié des devis.$sq$, $sq$## L'accroche

Une marque répond « ça nous intéresse, vous pouvez nous faire une proposition ? ». C'est le moment le plus fragile du cycle, et celui que les créatrices ratent le plus souvent — non pas en proposant mal, mais en proposant **trop tard**. Un devis envoyé sous 48 heures est accepté environ deux fois plus souvent que le même devis envoyé une semaine plus tard, parce que l'intérêt d'une responsable acquisition a une durée de vie courte : elle a d'autres sujets, un trimestre à remplir, et deux autres créatrices qui ont répondu entre-temps. La vitesse est un argument commercial à part entière, et c'est le seul qui ne coûte rien. Cette leçon transforme un « oui » en devis signé, en deux jours.

## Le contenu

### Les trois questions à poser avant tout chiffre

Toujours les mêmes, et elles tiennent en un message court.

1. **Combien de vidéos, et pour quels produits ?**
2. **Où seront-elles diffusées, et pendant combien de temps ?** (publicité Meta, TikTok, site, réseaux — durée et pays)
3. **Pour quelle date de livraison ?**

Ces trois réponses font varier le prix du simple au triple. Envoyer un chiffre sans elles, c'est deviner — et deviner bas, presque toujours.

Formulation : « Trois questions rapides et je vous envoie une proposition chiffrée dans la journée. »

### La structure du devis

Une page, six blocs. Ni plus court — ça fait amateur — ni plus long — ça ne se lit pas.

**1. Le rappel du besoin.** Deux lignes, avec leurs mots à eux. « Vous cherchez 4 vidéos verticales sur le sérum, pour vos campagnes Meta du trimestre. » Ça prouve que tu as écouté et évite les malentendus.

**2. Ce que tu livres.** Nombre de vidéos, durée, formats de fichier, sous-titres, hooks alternatifs éventuels.

**3. Les droits.** Durée, territoire, supports. C'est le bloc qui te distingue de la moitié du marché.

**4. Le délai.** Une date, pas une durée. « Livraison le 18 avril » vaut mieux que « sous 5 jours ».

**5. Le prix.** Le total, et le détail par ligne. Une seule option en avant, deux variantes en dessous.

**6. Les conditions.** Acompte, retours inclus, mode de paiement, validité de l'offre.

### La règle des trois options

Propose trois formules, jamais une seule ni cinq.

**L'essentiel** — le strict besoin exprimé.
**La recommandée** — celle que tu veux vendre, marquée comme telle, avec un peu plus de volume ou de droits.
**La complète** — plus chère, avec droits étendus et déclinaisons.

Trois options déplacent la question de « oui ou non » vers « laquelle », ce qui est une conversation entièrement différente. La recommandée est choisie dans la majorité des cas.

### La validité de l'offre

Ajoute une ligne : « Proposition valable 15 jours. » Ce n'est pas une pression artificielle, c'est une réalité — tes disponibilités changent, et une offre sans limite traîne indéfiniment.

Cette ligne accélère la décision de plusieurs jours en moyenne.

### Le format d'envoi

Un PDF nommé lisiblement : `Proposition-[Marque]-[TonNom]-[date].pdf`. Une page.

Dans le corps de l'email, **le résumé en trois lignes** : ce que tu livres, quand, combien. Beaucoup de gens décident sans ouvrir la pièce jointe ; ne les oblige pas à l'ouvrir pour connaître le prix.

### Le suivi

**J+3.** « Avez-vous eu le temps de regarder ? Je peux ajuster le périmètre si besoin. »
**J+8.** « Je maintiens le créneau de production jusqu'à vendredi, dites-moi. »
**J+15.** Clôture polie, et retour au statut « en sommeil ».

Un devis non relancé est un devis perdu dans la moitié des cas.

### Ce qui fait perdre un devis

Le délai de réponse. Les fautes. Un prix sans détail — il paraît arbitraire. L'absence de date de livraison. L'absence de mention des droits, qui inquiète les marques structurées. Et l'option unique, qui ne laisse qu'un « non » possible.

## Exemple appliqué

Léa reçoit un mardi à 16 h : « Bonjour, votre profil nous intéresse, vous pourriez nous faire une proposition pour notre gamme visage ? »

**Mardi 16 h 20.** Elle répond avec les trois questions, en quatre lignes.

**Mercredi 9 h.** La marque répond : 4 vidéos, deux produits, diffusion Meta et TikTok pendant 6 mois en France et Belgique, livraison souhaitée avant le 30.

**Mercredi 11 h.** Devis envoyé. Une page.

- Rappel du besoin : deux lignes.
- Livrables : 4 vidéos verticales 30 s, MP4 9:16 et 1:1, sous-titres incrustés, 2 hooks alternatifs sur la vidéo la plus performante.
- Droits : 6 mois, France et Belgique, tous supports numériques.
- Livraison : **le 24 avril**.
- Trois options :
  - Essentiel — 4 vidéos, droits 3 mois : 960 €
  - **Recommandé** — 4 vidéos, droits 6 mois FR+BE, 2 hooks alternatifs : 1 240 €
  - Complet — 6 vidéos, droits 12 mois, déclinaisons 1:1 et 16:9 : 1 890 €
- Conditions : acompte 40 %, solde à la livraison, 2 retours inclus, offre valable 15 jours.

Dans l'email, trois lignes de résumé avec le prix de l'option recommandée.

**Jeudi 14 h.** Réponse : « on part sur le recommandé ».

Vingt-deux heures entre la demande et l'accord. Le devis n'était pas moins cher que celui d'une concurrente contactée en parallèle — il est arrivé quatre jours plus tôt et proposait un choix.

## Les erreurs fréquentes

Donner un prix avant les trois questions. Le prix juste dépend du volume, des droits et du délai.

Mettre une semaine à envoyer. L'intérêt retombe, et quelqu'un d'autre a répondu.

Proposer une seule option. La question devient « oui ou non » au lieu de « laquelle ».

Oublier les droits. C'est le bloc qui te fait passer pour une professionnelle, et son absence te fera offrir des usages.

Écrire « sous 5 jours » au lieu d'une date. Une date engage et rassure ; une durée reste vague.

Cacher le prix dans la pièce jointe. Mets-le dans le corps du message.

Ne pas relancer le devis. La moitié des devis se signent après relance.

## Action immédiate

Prépare ton modèle de devis ce soir, avec les six blocs et les trois options laissées en blanc. Enregistre-le. La prochaine fois qu'une marque dit oui, tu poseras trois questions dans l'heure et tu enverras ta proposition le lendemain matin — et cette vitesse, à elle seule, te fera gagner des contrats que tu ne saurais pas avoir gagnés.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Du « oui » au devis signé","description":"Les trois questions, la structure en six blocs avec le piège que chacun évite, la règle des trois options, le format d'envoi et le calendrier de suivi.","kind":"document","url":null,"body":"## Du « oui » au devis signé en 48 heures\n\n### Les trois questions, avant tout chiffre\n\n1. **Combien de vidéos, et pour quels produits ?**\n2. **Diffusées où, pendant combien de temps, sur quel territoire ?**\n3. **Pour quelle date de livraison ?**\n\n> « Trois questions rapides et je vous envoie une proposition chiffrée dans\n> la journée. »\n\n### La structure en six blocs — une page\n\n| Bloc | Contenu | Piège évité |\n|---|---|---|\n| 1. Rappel du besoin | Deux lignes, **avec leurs mots** | Malentendu de périmètre |\n| 2. Livrables | Nombre, durée, formats, sous-titres, hooks | « On pensait que c'était compris » |\n| 3. Droits | Durée, territoire, supports | L'usage offert |\n| 4. Délai | **Une date**, pas une durée | Le flou qui traîne |\n| 5. Prix | Total + détail par ligne, trois options | Le prix qui paraît arbitraire |\n| 6. Conditions | Acompte, retours inclus, paiement, validité | Les impayés et les retours sans fin |\n\n### La règle des trois options\n\n| Option | Rôle |\n|---|---|\n| Essentiel | Le strict besoin exprimé |\n| **Recommandé** | Celle que tu veux vendre — marquée comme telle |\n| Complet | Droits étendus, déclinaisons, plus cher |\n\nTrois options déplacent la question de « oui ou non » vers « laquelle ».\nLa recommandée est choisie dans la majorité des cas.\n\n### L'envoi\n\nPDF nommé `Proposition-[Marque]-[TonNom]-[date].pdf`, une page.\n**Dans le corps de l'email : le résumé en trois lignes, prix compris.**\nBeaucoup décident sans ouvrir la pièce jointe.\n\nLigne à ajouter : « Proposition valable 15 jours. »\n\n### Le suivi\n\n| Quand | Message |\n|---|---|\n| J+3 | « Avez-vous eu le temps de regarder ? Je peux ajuster le périmètre. » |\n| J+8 | « Je maintiens le créneau de production jusqu'à vendredi. » |\n| J+15 | Clôture polie, retour en sommeil |\n\n**Un devis non relancé est perdu dans la moitié des cas.**\n\n### Ce qui fait perdre un devis\n\nLe délai de réponse · les fautes · un prix sans détail · pas de date de\nlivraison · pas de mention des droits · une option unique.\n"},{"title":"Modèle de devis à trois options","description":"Un fichier d'une page avec les six blocs et les trois formules laissées en blanc, prêt à remplir en vingt minutes.","kind":"template","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '7ea2f3dc-7e65-40a0-9cd8-a700c2f4712d'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '80b89081-36d2-491e-8c3f-1e4456487427'::uuid, c.id, c.org_id, 'tarifer-ugc', $sq$Tarifer sans se brader$sq$, $sq$Ce module sépare ce que tu vends en trois : la production, les droits d'usage et l'exclusivité — la distinction la plus rentable du métier, et celle que personne n'explique. Il construit ensuite une grille à quatre lignes, transforme les extensions de droits en revenu sans production, tranche la question du produit offert et donne la méthode d'augmentation qui ne fait perdre personne.$sq$, 7, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'a868eb5a-2cd0-4df0-994e-37a04f5429c7'::uuid, m.id, m.course_id, m.org_id, 'ce-qu-on-facture', $sq$Ce qu'on facture : la vidéo, les droits, l'exclusivité$sq$, $sq$Deux créatrices livrent la même vidéo, l'une facture 180 €, l'autre 330 €. La différence tient à une distinction conceptuelle : un objet fabriqué et un droit d'utiliser cet objet sont deux choses, et la seconde peut doubler la facture sans une minute de tournage de plus.$sq$, $sq$## L'accroche

Deux créatrices livrent la même vidéo à la même marque. La première facture 180 €. La seconde facture 180 € pour la vidéo, plus 90 € de droits publicitaires six mois, plus 60 € pour le territoire européen : 330 €. Elles ont fait exactement le même travail. La différence n'est pas commerciale, elle est **conceptuelle** : la seconde sait qu'elle vend deux choses distinctes — un objet fabriqué et un droit d'utiliser cet objet — là où la première croit vendre une vidéo. C'est la distinction la plus rentable du métier, et personne ne l'explique. Cette leçon la pose, avec les prix de marché de chaque composante.

## Le contenu

### Les trois composantes d'un prix

**1. La production.** Ton temps, ton matériel, ton savoir-faire. C'est ce qu'on facture d'instinct, et c'est la partie la moins élastique : elle dépend de ce que tu produis, pas de ce que le client en fait.

**2. Les droits d'usage.** Le droit, pour la marque, d'exploiter la vidéo : sur quels supports, dans quels pays, pendant combien de temps. C'est une variable **indépendante** de ton travail, qui peut doubler la facture sans ajouter une minute de tournage.

**3. L'exclusivité.** L'engagement de ne pas travailler pour ses concurrents. Ce n'est pas un usage, c'est une privation : elle se facture au prix de ce que tu renonces à gagner.

Une facture qui ne montre que la première ligne offre les deux autres.

### Les droits, expliqués simplement

Quatre variables, et chacune a un prix.

**La durée.** 1 mois, 3 mois, 6 mois, 12 mois, perpétuel. Le standard du marché est 3 mois ; c'est ce que ton prix de base doit couvrir.

**Le territoire.** France, Europe, monde. Un territoire supplémentaire vaut 20 à 30 % de plus.

**Les supports.** Publicité numérique (Meta, TikTok, Google), organique (leurs propres réseaux), site et fiche produit, affichage, télévision. Les trois premiers vont souvent ensemble ; les deux derniers se facturent lourdement à part.

**Le whitelisting.** La diffusion publicitaire depuis **ton** compte. C'est le supplément le plus cher, parce qu'il engage ton nom.

### La grille des suppléments

À partir d'un prix de base couvrant production + 3 mois + France + numérique :

| Extension | Supplément |
|---|---|
| 6 mois | + 25 % |
| 12 mois | + 50 % |
| Perpétuel | + 100 % |
| Europe | + 25 % |
| Monde | + 40 % |
| Affichage / TV | + 100 % minimum |
| Whitelisting | + 30 à 50 % par mois |
| Exclusivité sectorielle | négociée à part |

Ces pourcentages sont des repères de marché, pas une loi. Ce qui compte, c'est qu'ils **existent** et que tu les annonces.

### Pourquoi le perpétuel se facture cher

Une marque qui achète des droits perpétuels achète le droit de diffuser ta vidéo — et ton visage — pendant dix ans, dans une campagne dont tu ne sauras rien. Elle n'aura plus jamais besoin de te recommander cette vidéo.

C'est légitime de le vendre. C'est absurde de le donner au prix de trois mois.

### Le cas de l'image de la personne

Ton visage n'est pas un accessoire du fichier : c'est ton droit à l'image, distinct du droit d'auteur sur la vidéo. Une cession doit préciser la durée et les supports, exactement comme les droits d'usage.

En pratique : ta mention de droits couvre les deux, et tu écris explicitement « y compris droit à l'image de la créatrice, pour la même durée et le même territoire ». Cette phrase évite le cas — réel, fréquent — de la vidéo qui ressort trois ans plus tard.

### Comment l'annoncer sans complexifier

Tu n'as pas besoin d'expliquer tout ça au client. Une ligne dans ton devis suffit :

> Droits : 3 mois, France, supports numériques (publicité et organique), droit à l'image de la créatrice inclus sur la même période. Extensions sur devis.

Les marques structurées comprennent immédiatement et te prennent au sérieux. Les autres posent une question, et tu réponds en une phrase.

## Exemple appliqué

Nadia facture 200 € la vidéo. Une marque de cosmétiques lui commande cinq vidéos et précise, presque en passant : « on aimerait pouvoir les garder indéfiniment, et on diffuse aussi en Belgique et en Suisse ».

**Ancien réflexe** : 5 × 200 = 1 000 €.

**Nouveau calcul** :

- Production : 5 × 200 = 1 000 €
- Droits perpétuels : + 100 % → + 1 000 €
- Territoire Europe : + 25 % sur la base → + 250 €

Total : 2 250 €.

Elle ne l'annonce pas comme une augmentation, mais comme un chiffrage :

> « Sur cinq vidéos, la production est à 1 000 €. Les droits perpétuels et le territoire européen s'ajoutent : 2 250 € au total. Si vous préférez rester sur trois mois France, c'est 1 000 € — et on prolonge plus tard si les créas performent. »

La marque prend la version à 1 000 €, puis rachète six mois d'extension deux mois plus tard pour 250 €, quand deux vidéos fonctionnent bien.

Résultat : 1 250 € au lieu de 1 000 €, une marque qui n'a payé que ce qu'elle utilise, et une créatrice qui a posé un cadre pour toutes les commandes suivantes.

Sans le calcul, elle aurait cédé le perpétuel mondial pour 1 000 €.

## Les erreurs fréquentes

Facturer une vidéo sans mentionner de droits. Le silence vaut cession large : la marque suppose qu'elle peut tout faire, et elle a raison de le supposer.

Accepter « illimité » sans supplément. C'est la perte sèche la plus courante du métier.

Confondre durée de campagne et durée de droits. Une campagne de deux semaines peut être relancée dix-huit mois plus tard avec la même vidéo.

Oublier le droit à l'image. C'est le point qui pose problème des années après, quand on ne se souvient même plus du contrat.

Expliquer les droits pendant dix minutes. Une ligne dans le devis suffit ; les explications viennent seulement si on demande.

Ne pas proposer d'extension. Beaucoup de marques rachètent volontiers trois mois de plus sur une vidéo qui marche — encore faut-il que l'option existe.

## Action immédiate

Écris ta ligne de droits, une fois, avec tes conditions par défaut : durée, territoire, supports, droit à l'image. Colle-la dans ton modèle de devis. Puis construis ta grille de suppléments avec les pourcentages ci-dessus, adaptés à ton prix. La prochaine fois qu'on te dira « on aimerait les garder », tu auras un chiffre au lieu d'un silence.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les trois composantes d'un prix","description":"Le tableau des quatre variables de droits, la grille des suppléments chiffrée, et la ligne exacte à mettre dans tous tes devis.","kind":"document","url":null,"body":"## Les trois composantes d'un prix\n\n| Composante | Ce que c'est | Élastique ? |\n|---|---|---|\n| Production | Ton temps, ton matériel, ton savoir-faire | Peu |\n| **Droits d'usage** | Le droit d'exploiter le fichier | **Beaucoup** |\n| Exclusivité | La privation de travailler pour les concurrents | Négociée à part |\n\nUne facture qui ne montre que la première ligne **offre les deux autres**.\n\n### Les quatre variables de droits\n\n| Variable | Défaut recommandé | Ce qui dépasse |\n|---|---|---|\n| Durée | 3 mois | Se rachète |\n| Territoire | France | Se rachète |\n| Supports | Numérique (pub + organique) | Affichage, TV, print à part |\n| Droit à l'image | Même durée que les droits | À écrire explicitement |\n\n### Grille des suppléments\n\nBase = production + 3 mois + France + numérique.\n\n| Extension | Supplément |\n|---|---|\n| 6 mois | + 25 % |\n| 12 mois | + 50 % |\n| Perpétuel | + 100 % |\n| Europe | + 25 % |\n| Monde | + 40 % |\n| Affichage / TV / print | + 100 % minimum |\n| Whitelisting | + 30 à 50 % **par mois** |\n| Exclusivité sectorielle | négociée, jamais offerte |\n\n### La ligne à mettre dans tous tes devis\n\n> Droits d'usage : 3 mois à compter de la livraison, France, supports\n> numériques (publicité payante et publications organiques de la marque),\n> droit à l'image de la créatrice inclus sur la même période. Toute extension\n> de durée, de territoire ou de support fait l'objet d'un avenant.\n\n### La règle qui résume tout\n\n**Ce qui n'est pas limité est cédé.** Le silence vaut cession totale — et la\nmarque a raison de le supposer.\n"},{"title":"Checklist des droits","description":"Durée, territoire, supports, droit à l'image : les quatre limites à écrire, faute de quoi tout est cédé.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '80b89081-36d2-491e-8c3f-1e4456487427'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'a67aa703-35c2-4a80-b7eb-4796fd45bb2f'::uuid, m.id, m.course_id, m.org_id, 'la-grille', $sq$La grille : unitaire, pack, abonnement mensuel$sq$, $sq$Le prix unitaire n'est pas une offre, c'est une brique de calcul. Quatre lignes, des remises justifiées par une vraie contrepartie, un plancher à −25 %, et les cinq clauses qui font tenir un abonnement.$sq$, $sq$## L'accroche

La question « tu factures combien la vidéo ? » est un piège, parce qu'elle suppose que le prix unitaire est la bonne unité de vente. Il ne l'est pas. Une créatrice qui vend à l'unité passe son temps à re-négocier, à re-prospecter et à re-expliquer. Une créatrice qui vend des **packs** et des **abonnements** vend une fois et livre six fois. Le prix unitaire ne disparaît pas — il devient une brique de calcul, pas une offre. Cette leçon construit une grille à trois étages qui tient sur une page, avec les remises justifiées et les seuils à ne pas franchir.

## Le contenu

### Les trois étages

**L'unité.** Une vidéo, un prix, droits standards. Elle existe pour le test, le dépannage, la commande simple. Elle est ton prix de référence, celui qui sert à calculer tout le reste.

**Le pack.** Trois, six ou dix vidéos livrées ensemble. La remise est justifiée par un vrai gain : un seul brief, un seul tournage, un seul envoi de produit, un seul aller-retour de validation. Ton coût horaire baisse réellement, donc la remise n'est pas une concession.

**L'abonnement.** Un volume mensuel, engagement de trois mois minimum. C'est l'étage qui change une activité : revenu prévisible, zéro prospection, planification possible.

### La grille type

Sur un prix unitaire de base de 250 € :

| Formule | Contenu | Prix | Prix unitaire |
|---|---|---|---|
| Unité | 1 vidéo | 250 € | 250 € |
| Pack Test | 3 vidéos | 675 € | 225 € (−10 %) |
| Pack Campagne | 6 vidéos + 3 hooks alternatifs | 1 275 € | 212 € (−15 %) |
| Abonnement | 6 vidéos / mois, 3 mois | 1 200 € / mois | 200 € (−20 %) |

Quatre lignes. Pas huit : au-delà, le client compare au lieu de choisir.

### Le principe de la remise

Une remise se donne **contre quelque chose**. Trois contreparties valables :

**Le volume**, qui réduit ton temps unitaire.
**L'engagement**, qui supprime ta prospection.
**Le délai souple**, qui te laisse grouper les tournages.

Trois contreparties invalides : la promesse de travail futur, la visibilité, le fait que le client soit sympathique.

Le seuil : **ne descends jamais sous −25 %** du prix unitaire, quel que soit le volume. Au-delà, le gain d'efficacité ne compense plus, et tu installes un prix de référence dont tu ne remonteras pas.

### L'abonnement, en détail

C'est l'offre la plus importante du métier, et la plus mal vendue.

**Ce qu'il contient** : un volume mensuel fixe, un délai, un nombre de retours, les droits, et un rythme de brief (un point de trente minutes par mois suffit).

**La durée** : trois mois minimum. En dessous, le client teste sans s'engager et tu portes le risque.

**La facturation** : mensuelle, à échéance fixe, indépendamment du rythme de livraison. Le mois où le client ne t'envoie pas de brief à temps, tu factures quand même — c'est une capacité réservée, pas un volume consommé. Cette clause doit être écrite.

**Le report** : autorise le report d'une vidéo non commandée sur le mois suivant, une seule fois. Ça rassure sans ouvrir la porte à un stock infini.

### Ce qui ne doit jamais entrer dans le prix unitaire

Les déclinaisons de format (1:1, 16:9) : 30 à 50 € l'unité.
Les hooks alternatifs : 25 à 40 € l'unité.
Les retours au-delà du forfait : 40 € la reprise.
Les droits au-delà du standard : la grille de la leçon précédente.
Les déplacements : au réel, et annoncés d'avance.

Ces lignes représentent facilement 15 à 25 % du chiffre d'affaires d'une créatrice installée. Les inclure « pour faire simple » revient à travailler un quart du temps gratuitement.

### Le prix psychologique

Deux détails qui ne coûtent rien.

**Les chiffres ronds** rassurent sur un pack (1 275 € plutôt que 1 277,50 €).

**L'ordre de présentation** : du plus cher au moins cher. Le premier chiffre lu devient la référence, et tout ce qui suit paraît raisonnable. Présenter dans l'ordre inverse produit l'effet contraire.

## Exemple appliqué

Alicia facture 250 € à l'unité. Une marque de compléments lui demande « un tarif pour douze vidéos ».

**Ce qu'elle ne fait pas** : donner 12 × 250 € = 3 000 €, ni brader à 150 € l'unité parce que « c'est un gros volume ».

**Ce qu'elle propose**, dans cet ordre :

> **Abonnement — recommandé.** 6 vidéos par mois pendant 3 mois, soit 18 vidéos. 1 200 € par mois, 3 600 € au total. Prix unitaire 200 €. Créneau de production réservé, 2 retours par vidéo, droits 3 mois France.
>
> **Pack Campagne × 2.** 12 vidéos livrées en deux lots. 2 550 €. Prix unitaire 212 €.
>
> **À l'unité.** 12 × 250 € = 3 000 €, livrées au fil de l'eau.

La marque prend l'abonnement. Elle obtient 18 vidéos au lieu de 12 pour 600 € de plus, et Alicia obtient trois mois de revenu prévisible à 1 200 €.

Le point clé : Alicia n'a pas baissé son prix pour un gros volume. Elle a **augmenté le volume** pour justifier un meilleur prix unitaire, et le total facturé est supérieur à la demande initiale.

Sur les trois mois, elle ajoute 340 € de déclinaisons et de hooks alternatifs facturés à part. Total réel : 3 940 €.

## Les erreurs fréquentes

Vendre uniquement à l'unité. Chaque vidéo demande une nouvelle décision d'achat, donc une nouvelle négociation.

Faire une remise sans contrepartie. Elle devient le nouveau prix de référence, définitivement.

Descendre sous −25 %. Le gain d'efficacité ne compense plus, et le prix ne remonte jamais.

Inclure les déclinaisons et les hooks « pour faire simple ». C'est un quart du chiffre d'affaires offert.

Proposer huit formules. Le client compare au lieu de choisir, et repousse la décision.

Ne pas facturer un mois d'abonnement non consommé. Sans clause écrite, l'abonnement devient une option gratuite pour le client.

Présenter du moins cher au plus cher. Le premier chiffre lu ancre la perception ; commence par le haut.

## Action immédiate

Construis ta grille à quatre lignes ce soir : unité, pack de trois, pack de six, abonnement. Calcule les remises à −10 %, −15 % et −20 %, sans jamais dépasser −25 %. Puis écris la liste de ce qui se facture en plus — déclinaisons, hooks, retours au-delà du forfait, extensions de droits. Cette liste est la partie de ton chiffre d'affaires que tu offres aujourd'hui sans le savoir.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"La grille à trois étages","description":"La grille chiffrée sur une base de 250 €, le principe de la remise, les cinq clauses de l'abonnement et la liste de ce qui ne rentre jamais dans le prix unitaire.","kind":"document","url":null,"body":"## La grille à trois étages\n\nExemple sur un prix unitaire de base de 250 €.\n\n| Formule | Contenu | Prix | Unitaire | Remise |\n|---|---|---|---|---|\n| Unité | 1 vidéo | 250 € | 250 € | — |\n| Pack Test | 3 vidéos | 675 € | 225 € | −10 % |\n| Pack Campagne | 6 vidéos + 3 hooks | 1 275 € | 212 € | −15 % |\n| **Abonnement** | 6 / mois, 3 mois | 1 200 € / mois | 200 € | −20 % |\n\n**Quatre lignes, pas huit** : au-delà, le client compare au lieu de choisir.\n\n### Le principe de la remise\n\n| Contrepartie valable | Contrepartie invalide |\n|---|---|\n| Le volume (réduit ton temps unitaire) | La promesse de travail futur |\n| L'engagement (supprime ta prospection) | La visibilité |\n| Le délai souple (permet de grouper) | La sympathie du client |\n\n**Plancher absolu : −25 %.** Au-delà, le gain d'efficacité ne compense plus et\nle prix ne remonte jamais.\n\n### L'abonnement — les cinq clauses\n\n1. **Volume mensuel fixe** et délai de livraison\n2. **Trois mois minimum** — en dessous, tu portes tout le risque\n3. **Facturation à échéance fixe**, consommé ou non : c'est une capacité\n   réservée. *À écrire, sinon l'abonnement devient une option gratuite.*\n4. **Report d'une vidéo** non commandée sur le mois suivant, **une seule fois**\n5. Un point de brief de trente minutes par mois\n\n### Ce qui ne rentre jamais dans le prix unitaire\n\n| Ligne | Prix |\n|---|---|\n| Déclinaison de format (1:1, 16:9) | 30 à 50 € |\n| Hook alternatif | 25 à 40 € |\n| Retour au-delà du forfait | 40 € |\n| Extension de droits | voir la grille des droits |\n| Déplacement | au réel, annoncé d'avance |\n\n**15 à 25 % du chiffre d'affaires d'une créatrice installée.** Les inclure\n« pour faire simple », c'est travailler un quart du temps gratuitement.\n\n### Deux détails gratuits\n\nChiffres ronds sur les packs · présentation **du plus cher au moins cher**\n(le premier chiffre lu devient la référence).\n"},{"title":"Checklist de l'abonnement","description":"Volume, durée minimale, facturation à échéance fixe, report limité, point de brief : les cinq points à écrire avant de signer.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '80b89081-36d2-491e-8c3f-1e4456487427'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '99cc76c1-473d-471e-a42c-87c5009d3d77'::uuid, m.id, m.course_id, m.org_id, 'les-droits-d-usage', $sq$Les droits d'usage : le vrai levier de revenus$sq$, $sq$Ce qui n'est pas limité est cédé, et une vidéo à 160 € peut travailler deux ans et demi pour rien. La séquence d'extension à J+75, qui rapporte 10 à 20 % du chiffre d'affaires sans production, et les trois clauses à ne jamais signer.$sq$, $sq$## L'accroche

Une marque de mode a diffusé pendant deux ans et demi une vidéo payée 160 € à une créatrice débutante. Elle l'a utilisée en publicité Meta, sur sa fiche produit, dans sa newsletter, sur un écran en boutique et dans une campagne d'affichage en gare. La créatrice, entre-temps, facturait 300 € la vidéo à d'autres clients — mais celle-là continuait de travailler pour 160 €, indéfiniment, sans qu'elle puisse rien faire. Il n'y avait pas eu de tromperie : le devis ne mentionnait aucune limitation, et un usage non limité est un usage autorisé. Les droits sont le seul endroit du métier où quelques mots dans un document valent des milliers d'euros. Cette leçon les transforme en source de revenus plutôt qu'en fuite.

## Le contenu

### La règle de base

**Ce qui n'est pas limité est cédé.** Un devis qui ne parle pas de durée, de territoire ou de support autorise implicitement tout, partout, pour toujours.

Il ne s'agit pas de méfiance envers les marques : une responsable acquisition qui ne voit aucune limite en déduit logiquement qu'il n'y en a pas, et elle programme ses campagnes en conséquence.

### La formulation par défaut

Une seule phrase, dans tous tes devis :

> Droits d'usage : 3 mois à compter de la livraison, France, supports numériques (publicité payante et publications organiques de la marque), droit à l'image de la créatrice inclus sur la même période. Toute extension de durée, de territoire ou de support fait l'objet d'un avenant.

Quatre limites : durée, territoire, support, image. La dernière phrase ouvre la porte au revenu supplémentaire.

### Les quatre curseurs et leur valeur

**La durée.** 3 mois par défaut. C'est court, et c'est volontaire : une créa se fatigue en dix à vingt jours, trois mois couvrent largement une campagne. Ce qui dépasse se rachète.

**Le territoire.** France par défaut. Une marque qui vend en Belgique et en Suisse le sait et le demandera.

**Les supports.** Numérique par défaut. L'affichage, la télévision et le print sont des mondes à part, avec des budgets à part, et ils se facturent au minimum le double.

**L'exclusivité.** Jamais par défaut. Elle se demande, elle se chiffre, elle se refuse souvent.

### L'extension, ton meilleur produit

C'est le point que presque personne n'exploite : **une extension de droits est du chiffre d'affaires sans production**.

La séquence, à mettre dans ton agenda le jour de la livraison :

**J+75.** Message court : « Vos droits sur les trois vidéos arrivent à échéance le [date]. Si l'une d'elles tourne encore, je peux prolonger de six mois pour X €. »

Deux résultats possibles, tous les deux bons. Soit la marque prolonge — revenu pur, zéro travail. Soit elle ne prolonge pas, et tu sais que la vidéo ne tourne plus, ce qui est une information commerciale utile.

Une créatrice installée tire couramment 10 à 20 % de son chiffre d'affaires des extensions.

### Le cas du whitelisting

Diffuser une publicité **depuis ton compte** est une autre catégorie. Ce n'est plus un droit sur un fichier, c'est l'usage de ton identité.

Trois règles : il se facture à part (30 à 50 % du prix du contenu par mois), il se borne dans le temps, et il se retire — prévois une clause qui te permet de demander l'arrêt sous sept jours, notamment si les commentaires deviennent difficiles.

### Ce qu'il ne faut pas signer

**« Cession totale et définitive des droits, tous supports, tous territoires, toute durée »** sans supplément. C'est la clause standard de beaucoup de contrats de grandes marques et de plateformes. Elle se négocie : proposer 3 ans plutôt que perpétuel fonctionne souvent, et le supplément de +100 % passe très bien quand il est expliqué.

**Une cession de droit à l'image sans limite.** C'est le point le plus sensible et le moins réversible.

**Une clause de non-concurrence déguisée** : « la créatrice s'engage à ne pas produire de contenu pour des marques du même secteur » — c'est de l'exclusivité, et elle doit être payée.

## Exemple appliqué

Sarah livre quatre vidéos à une marque de café en janvier. Devis : 4 × 240 € = 960 €, droits 3 mois France numérique.

**Le 15 mars (J+75).** Elle envoie son message d'échéance. La marque répond : deux vidéos tournent toujours, avec de bons résultats. Elle prolonge ces deux-là de six mois : + 25 % du prix de chacune, soit 120 €.

**En mai.** La marque lance la Belgique. Elle demande l'extension de territoire sur les deux vidéos actives : + 25 %, soit 120 € de plus.

**En juillet.** Un distributeur veut utiliser une des vidéos sur un écran en boutique. C'est un support non numérique : Sarah facture + 100 % du prix de la vidéo, soit 240 €.

**Bilan sur sept mois** : 960 € de production, 480 € d'extensions. Les extensions représentent 33 % du total, pour zéro heure de tournage.

Si elle n'avait pas limité ses droits en janvier, les trois usages auraient été gratuits — et elle n'aurait même pas su qu'ils existaient.

## Les erreurs fréquentes

Ne rien écrire sur les droits. Le silence vaut cession totale, et c'est la fuite la plus coûteuse du métier.

Accorder le perpétuel au prix du trimestre. C'est une vidéo qui travaillera dix ans pour un seul paiement.

Oublier le droit à l'image. Il survit au fichier et pose problème des années plus tard.

Ne pas relancer à l'échéance. C'est du revenu sans production, laissé sur la table par simple oubli.

Accepter une exclusivité non payée. Dans une niche étroite, elle peut fermer 80 % du marché.

Signer un whitelisting sans borne ni clause de retrait. Ton nom porte la publicité, et tu dois pouvoir l'arrêter.

Craindre de paraître compliquée. Les marques structurées gèrent des droits tous les jours : c'est l'absence de mention qui les surprend, pas sa présence.

## Action immédiate

Ajoute la phrase de droits à ton modèle de devis maintenant, avec tes quatre limites. Puis reprends tes trois dernières livraisons et calcule la date J+75 de chacune : si elle est passée, envoie le message d'échéance aujourd'hui. C'est probablement le message le plus rentable que tu enverras ce mois-ci, et il ne demande aucun tournage.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Les droits d'usage : la deuxième source de revenus","description":"La séquence d'extension avec son message type, les trois règles du whitelisting, et le tableau des clauses à négocier.","kind":"document","url":null,"body":"## Les droits d'usage : la deuxième source de revenus\n\n### La séquence d'extension — à mettre à l'agenda le jour de la livraison\n\n**J+75**, message court :\n\n> Bonjour [Prénom], vos droits sur les [n] vidéos arrivent à échéance le\n> [date]. Si l'une d'elles tourne encore, je peux prolonger de six mois pour\n> X €.\n\nDeux résultats, tous deux bons :\n- Elle prolonge → **revenu pur, zéro production**\n- Elle ne prolonge pas → tu sais que la vidéo ne tourne plus (info commerciale)\n\nUne créatrice installée tire **10 à 20 % de son chiffre d'affaires** des\nextensions.\n\n### Le whitelisting — trois règles\n\n1. Se facture **à part** : 30 à 50 % du prix du contenu, **par mois**\n2. Se **borne** dans le temps, toujours\n3. Se **retire** : clause d'arrêt sous sept jours à ta demande\n\nC'est ton identité qui porte la publicité, pas seulement un fichier.\n\n### Ce qu'il ne faut pas signer\n\n| Clause | Pourquoi | Comment négocier |\n|---|---|---|\n| « Cession totale et définitive, tous supports, tous territoires, toute durée » | La vidéo travaille dix ans pour un paiement | Proposer 3 ans + 100 % |\n| Cession de droit à l'image sans limite | Le point le moins réversible | Aligner sur la durée des droits |\n| « Ne pas produire pour des marques du même secteur » | C'est de l'exclusivité déguisée | La faire payer, ou la refuser |\n\n### Le rappel qui vaut de l'argent\n\nUne campagne de deux semaines peut être **relancée dix-huit mois plus tard**\navec la même vidéo. Durée de campagne ≠ durée de droits.\n"},{"title":"Checklist d'échéance","description":"Le jour de la livraison, poser le rappel J+75 dans l'agenda. C'est le message le plus rentable du mois, et il ne demande aucun tournage.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '80b89081-36d2-491e-8c3f-1e4456487427'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'b249ca4e-693a-4b4e-a5e9-7cd482ddb013'::uuid, m.id, m.course_id, m.org_id, 'le-produit-offert', $sq$Le produit offert n'est pas un paiement$sq$, $sq$Le calcul en trente secondes qui tranche chaque proposition, les deux seules exceptions rationnelles, le message de refus qui garde la porte ouverte et la contre-proposition hybride qui transforme une demande gratuite en client payant.$sq$, $sq$## L'accroche

« On vous envoie le produit d'une valeur de 89 € en échange de deux vidéos. » Ce message arrive dans toutes les boîtes du métier, plusieurs fois par mois. Fais le calcul une seule fois : deux vidéos, c'est environ quatre heures de travail, plus la réception, plus les échanges. À 89 € de valeur affichée — dont le coût réel pour la marque est peut-être 20 € — tu travailles à cinq euros de l'heure, en fournissant ton matériel et ton logement. Il existe deux situations, exactement deux, où accepter est rationnel. Partout ailleurs, c'est un transfert de valeur à sens unique. Cette leçon donne les deux exceptions, la façon de refuser sans fermer la porte, et la contre-proposition qui convertit une demande gratuite en client payant.

## Le contenu

### Pourquoi la « valeur du produit » ne veut rien dire

Le prix affiché n'est pas le coût. Une marque qui offre un produit à 89 € le paie souvent 15 à 25 € en fabrication, et l'inscrit en dépense marketing.

Toi, tu fournis un travail dont le coût est réel : ton temps, ton matériel, ton électricité, ton logement, ta compétence.

Comparer les deux montants revient à comparer un prix de vente à un coût de production. Ce sont deux échelles différentes, et l'échange n'a jamais lieu à parité.

### Les deux exceptions

**1. Les deux ou trois premières vidéos de portfolio, au tout début.** Tu échanges du travail contre une référence identifiable. Le retour n'est pas le produit, c'est la marque dans ton portfolio. À faire deux ou trois fois, jamais plus.

**2. Un produit cher que tu voulais vraiment acheter.** Si la marque envoie un appareil à 400 € que tu comptais acquérir, et que le travail demandé est d'une vidéo, l'échange peut être rationnel. Fais le calcul en coût réel évité, pas en valeur affichée.

En dehors de ces deux cas : non.

### Le calcul à faire à chaque fois

Trois questions, trente secondes.

1. **Combien d'heures ?** Compte 2 h par vidéo, réception et échanges compris.
2. **Combien vaut le produit pour moi ?** Le prix que je paierais réellement, pas le prix affiché. Un produit que tu n'aurais jamais acheté vaut zéro.
3. **Le rapport dépasse-t-il 40 € de l'heure ?** Sous ce seuil, refuse.

Un produit à 89 € pour deux vidéos donne 22 € de l'heure au mieux, souvent zéro. La réponse est non.

### Refuser sans fermer la porte

Le refus est une occasion commerciale, pas une fin de conversation. Trois lignes suffisent.

> Bonjour [Prénom], merci pour la proposition. Je ne travaille pas en échange produit — mes tarifs commencent à 220 € la vidéo, droits 3 mois inclus.
>
> Si vous avez un budget créa ce trimestre, je peux vous proposer un pack de trois à 675 €, livré en 5 jours. Sinon, gardez mon portfolio sous la main : [lien]. Bonne journée.

Trois éléments : un refus net, un prix, une porte ouverte. Beaucoup de marques qui proposent du produit ont en réalité un budget — elles testent d'abord la version gratuite, ce qui est leur travail.

### La contre-proposition qui convertit

Quand la marque insiste sur le produit, propose l'hybride :

> « Je peux faire une vidéo en échange du produit, à condition que ce soit un test : si elle performe, on passe sur un pack payant le mois suivant. Et dans ce cas les droits sont limités à un mois. »

Deux protections dans cette phrase : le test est borné à une vidéo, et les droits courts empêchent la marque d'exploiter longtemps une vidéo non payée.

C'est la formule qui transforme le plus souvent une demande gratuite en client.

### Le cas des « gros comptes » qui ne paient pas

Une marque connue qui propose du produit contre du contenu utilise sa notoriété comme monnaie. « Ça va vous faire de la visibilité » n'est pas un paiement : ta visibilité ne dépend pas d'elle, et le fichier ne sera même pas publié sous ton nom.

Réponse simple : « Le portfolio, je le construis avec des marques qui me paient. »

### Le signal envoyé

Ce point compte plus qu'il n'y paraît. Une créatrice qui accepte le produit se positionne durablement : la marque n'a aucune raison de payer plus tard ce qu'elle a obtenu gratuitement.

À l'inverse, un refus poli et chiffré fait souvent apparaître un budget qui n'existait pas dans le premier message. Ce n'est pas de la manipulation : c'est simplement que la marque teste l'option la moins chère d'abord.

## Exemple appliqué

Inès reçoit trois propositions en échange produit le même mois.

**Marque 1 — une crème à 35 €, trois vidéos.** Calcul : six heures de travail, produit qu'elle n'utiliserait pas. Elle refuse avec le message type. Aucune réponse. Aucune perte.

**Marque 2 — un robot de cuisine à 320 €, une vidéo.** Elle voulait cet appareil depuis six mois. Deux heures de travail contre 320 € réellement évités : 160 € de l'heure. Elle accepte, en limitant les droits à trois mois et en demandant que la vidéo puisse figurer dans son portfolio. Bon échange.

**Marque 3 — une marque connue de vêtements, deux vidéos contre une tenue.** Elle refuse et contre-propose l'hybride : une vidéo test contre la tenue, droits un mois, puis pack payant si ça performe. La marque accepte le test. La vidéo obtient un bon coût par achat. Le mois suivant : pack de six vidéos à 1 275 €.

Trois propositions gratuites : un refus sec, un échange rationnel, un client à 1 275 €. Aucune des trois n'a été acceptée telle quelle.

## Les erreurs fréquentes

Accepter par peur de rater une occasion. La marque qui ne paie pas aujourd'hui ne paiera pas plus tard le prix fort.

Compter la valeur affichée du produit. Compte ce que tu aurais réellement dépensé, sinon rien.

Accepter des droits illimités sur une vidéo non payée. C'est le pire des deux mondes.

Refuser sèchement, sans prix ni porte ouverte. Le refus est un moment commercial, pas une fin.

Accepter parce que la marque est connue. La notoriété n'est pas une monnaie, et ton nom n'apparaîtra même pas.

Faire plus de trois échanges produit au total. Au-delà, ce n'est plus un amorçage, c'est un modèle économique — et il ne fonctionne pas.

## Action immédiate

Écris ton message de refus type dans une note, avec ton prix et ta contre-proposition hybride. Puis fixe ton seuil : le nombre d'échanges produit que tu t'autorises en tout — deux ou trois — et note-le. La prochaine proposition arrivera cette semaine ou la suivante, et tu répondras en trente secondes au lieu d'hésiter trois jours.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Le produit offert n'est pas un paiement","description":"Le calcul en trois questions avec ses exemples chiffrés, les deux exceptions, le message de refus et la contre-proposition qui convertit.","kind":"document","url":null,"body":"## Le produit offert n'est pas un paiement\n\n### Le calcul, à faire en trente secondes\n\n1. **Combien d'heures ?** 2 h par vidéo, réception et échanges compris.\n2. **Combien vaut le produit pour moi ?** Le prix que j'aurais **réellement**\n   payé. Un produit que je n'aurais jamais acheté vaut **zéro**.\n3. **Le rapport dépasse-t-il 40 €/h ?** Sinon, refuse.\n\n| Proposition | Heures | Valeur réelle | €/h | Verdict |\n|---|---|---|---|---|\n| Crème 35 €, 3 vidéos | 6 | 0 (jamais achetée) | 0 | Non |\n| Produit 89 €, 2 vidéos | 4 | ~20 € | 5 | Non |\n| Robot 320 €, 1 vidéo, voulu depuis 6 mois | 2 | 320 | 160 | **Oui** |\n\n### Les deux seules exceptions\n\n1. **Les 2 ou 3 premières vidéos de portfolio**, au tout début. Le retour n'est\n   pas le produit, c'est la marque identifiable dans ton portfolio.\n2. **Un produit cher que tu comptais vraiment acheter.**\n\n**Trois échanges au total, sur toute ta carrière de débutante.** Au-delà, ce\nn'est plus un amorçage, c'est un modèle économique — et il ne fonctionne pas.\n\n### Le message de refus\n\n> Bonjour [Prénom], merci pour la proposition. Je ne travaille pas en échange\n> produit — mes tarifs commencent à 220 € la vidéo, droits 3 mois inclus.\n>\n> Si vous avez un budget créa ce trimestre, je peux vous proposer un pack de\n> trois à 675 €, livré en 5 jours. Sinon, gardez mon portfolio sous la main :\n> [lien]. Bonne journée.\n\nUn refus net · un prix · une porte ouverte.\n\n### La contre-proposition qui convertit\n\n> Je peux faire **une** vidéo en échange du produit, à condition que ce soit un\n> test : si elle performe, on passe sur un pack payant le mois suivant.\n> Et dans ce cas les droits sont limités à un mois.\n\nDeux protections : le test est borné à une vidéo, les droits courts empêchent\nd'exploiter longtemps une vidéo non payée.\n\n### Face à une marque connue\n\n« Ça va vous faire de la visibilité » n'est pas un paiement : le fichier ne\nsera même pas publié sous ton nom.\n\n> Le portfolio, je le construis avec des marques qui me paient.\n"},{"title":"Checklist des trois questions","description":"Combien d'heures, combien vaut réellement le produit pour moi, le rapport dépasse-t-il 40 €/h. Trente secondes, une réponse.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '80b89081-36d2-491e-8c3f-1e4456487427'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '6b5e50aa-5a70-4265-9410-fe9bd0c31dbf'::uuid, m.id, m.course_id, m.org_id, 'augmenter-ses-prix', $sq$Augmenter ses prix sans perdre ses clients$sq$, $sq$Un taux d'acceptation de 92 % n'est pas un succès, c'est une alerte. Les trois signaux, le rythme de deux hausses par an, la méthode en trois étapes qui supprime le risque, et le message d'annonce avec le geste qui retient tout le monde.$sq$, $sq$## L'accroche

Une créatrice facture 180 € depuis quatorze mois. Elle livre mieux, plus vite, elle a trente vidéos derrière elle et quatre clients réguliers. Son taux d'acceptation des devis est de 92 %. Ce chiffre, qui la rassure, est en réalité une alerte : accepter presque toutes ses propositions signifie qu'elle est nettement en dessous du marché, et que chaque mission lui coûte l'écart. Sur quarante missions annuelles, passer de 180 à 250 € représente 2 800 € — pour exactement le même travail. Augmenter ses prix n'est pas une audace, c'est une opération d'entretien, et elle se fait sans perdre personne quand elle est faite dans le bon ordre. Cette leçon donne la méthode, les seuils et les phrases.

## Le contenu

### Les trois signaux qu'il faut augmenter

**Le taux d'acceptation dépasse 80 %.** C'est le signal le plus fiable. Un bon niveau se situe entre 50 et 70 % : en dessous, tu es trop chère pour ton positionnement ; au-dessus, tu laisses de l'argent.

**Tu refuses des missions faute de temps.** La demande dépasse la capacité : le prix est l'outil de régulation.

**Ton temps unitaire a baissé.** Si tu produis une vidéo en 1 h 15 au lieu de 2 h 20, tu peux augmenter ton prix sans augmenter ton tarif horaire perçu par le client.

### Le rythme

Deux augmentations par an, de 15 à 25 % chacune. Pas plus souvent : un client a besoin de stabilité pour construire son budget. Pas moins : l'inflation et ta progression rendent un prix figé de plus en plus faux.

Une créatrice qui démarre à 150 € et augmente deux fois par an de 20 % arrive à 310 € au bout de dix-huit mois. C'est exactement la trajectoire normale du métier.

### Les nouveaux clients d'abord

La méthode la plus simple, et celle qui ne fait perdre personne : **augmente uniquement pour les nouveaux clients pendant deux à trois mois**.

Tu observes le taux d'acceptation sur le nouveau prix. S'il reste au-dessus de 50 %, le prix est validé par le marché. Tu peux alors passer les clients existants au nouveau tarif, avec un préavis.

Cette séquence supprime le risque : tu ne touches à tes clients réguliers qu'après avoir la preuve que le prix tient.

### L'annonce aux clients existants

Un mois de préavis, un message court, aucune justification longue.

> Bonjour [Prénom],
>
> Un mot pour vous informer que mes tarifs évoluent à partir du 1er [mois] : la vidéo passe de 200 à 240 €, droits inchangés.
>
> Vos commandes en cours restent au tarif actuel. Pour votre abonnement, je maintiens le tarif actuel jusqu'à la fin de l'engagement en cours.
>
> Merci pour la confiance, et à très vite.

Trois principes : une date, aucune excuse, et un geste pour les clients réguliers — c'est ce geste qui fait que personne ne part.

### Ce qu'il ne faut pas faire

**Se justifier longuement.** « Avec l'augmentation du coût de la vie et mon matériel qui… » — plus tu expliques, plus tu invites à négocier. Une phrase suffit.

**S'excuser.** L'augmentation est un fait commercial normal, pas une faveur qu'on demande.

**Augmenter tout le monde d'un coup, sans préavis.** C'est le seul cas où l'on perd vraiment des clients.

**Ne jamais augmenter.** C'est l'erreur la plus coûteuse et la plus silencieuse du métier.

### Les autres façons d'augmenter son revenu sans toucher au prix

Trois leviers, utiles quand tu ne veux pas bouger le tarif unitaire.

**Réduire le périmètre inclus.** Passer de trois retours à deux, de six mois de droits à trois. Le prix ne bouge pas, la valeur cédée baisse.

**Facturer ce qui était offert.** Déclinaisons, hooks alternatifs, formats supplémentaires, urgences.

**Monter en gamme de clients.** Une agence ou une marque structurée paie 30 à 50 % de plus que la petite marque en direct, pour le même travail — parce que son budget est voté et que son coût d'opportunité est différent.

### Quand un client refuse l'augmentation

C'est rare, et ce n'est pas grave. Deux réponses possibles.

Si c'est un bon client sur lequel tu ne veux pas prendre de risque : maintiens son tarif six mois de plus, en le disant explicitement — « je maintiens votre tarif jusqu'en septembre, ensuite je m'alignerai ». Tu gardes le client et tu as fixé une date.

Si le client est difficile ou peu rentable : laisse-le partir. Un client qui refuse une augmentation de 20 % après un an est un client dont la marge se réduira à chaque trimestre.

## Exemple appliqué

Manon facture 200 € depuis onze mois. Taux d'acceptation : 88 %. Quatre clients réguliers, dont deux en abonnement.

**Mars.** Elle passe à 250 € pour les nouveaux clients uniquement. Elle ne prévient personne, elle change simplement son prix plancher affiché et ses devis.

**Mars-mai.** Douze devis au nouveau tarif, huit acceptés : 67 %. Le prix tient.

**Juin.** Elle annonce aux quatre clients existants, avec un mois de préavis et le message type. Elle maintient le tarif des deux abonnements jusqu'à la fin de leur engagement, en septembre.

**Résultat.** Aucun client perdu. Un a demandé « on peut rester à 200 jusqu'à la fin de l'année ? » — elle a accordé jusqu'en septembre, comme pour les abonnements, et le client a accepté.

**Sur l'année suivante.** 44 missions à 250 € au lieu de 200 € : + 2 200 €. Elle ajoute 620 € de déclinaisons et de hooks qu'elle facturait jusque-là gratuitement.

**En novembre**, elle recommence : 250 → 295 € pour les nouveaux. Taux d'acceptation à 58 %. Elle s'arrête là pour ce cycle.

Dix-huit mois après ses débuts à 150 €, elle est à 295 €, avec les mêmes clients et le même travail.

## Les erreurs fréquentes

Attendre d'être « légitime ». Le taux d'acceptation est un fait mesurable ; le sentiment de légitimité n'en est pas un.

Augmenter tout le monde d'un coup. Teste d'abord sur les nouveaux, pendant deux à trois mois.

Se justifier. Une phrase, une date, aucune excuse.

Ne pas faire de geste pour les réguliers. Maintenir le tarif jusqu'à la fin d'un engagement en cours coûte peu et retient tout le monde.

Augmenter une seule fois puis ne plus jamais y toucher. Deux fois par an, c'est le rythme.

Confondre prix et valeur perçue. Une hausse annoncée avec assurance est mieux reçue qu'une hausse annoncée en s'excusant, à montant identique.

Garder un client qui refuse toute évolution. Sa marge se réduira à chaque trimestre, et il occupera la place d'un meilleur.

## Action immédiate

Calcule ton taux d'acceptation des trois derniers mois : devis acceptés divisés par devis envoyés. S'il dépasse 80 %, augmente de 20 % dès aujourd'hui, pour les nouveaux clients seulement. Note dans ton agenda, à trois mois, le rappel « vérifier le taux et annoncer aux clients existants ». Cette seule opération vaut plusieurs milliers d'euros par an.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Augmenter ses prix sans perdre ses clients","description":"Le tableau des trois signaux avec leurs seuils, la méthode en trois étapes, le message d'annonce, et les leviers pour gagner plus sans toucher au prix.","kind":"document","url":null,"body":"## Augmenter ses prix sans perdre ses clients\n\n### Les trois signaux\n\n| Signal | Seuil | Lecture |\n|---|---|---|\n| Taux d'acceptation | > 80 % | Trop bon marché — le plus fiable |\n| Missions refusées faute de temps | ≥ 2 / mois | La demande dépasse la capacité |\n| Temps unitaire en baisse | 2 h 20 → 1 h 15 | Tu peux monter sans changer ton tarif horaire perçu |\n\n**Bon niveau : 50 à 70 % d'acceptation.**\n\n### Le rythme\n\n**Deux augmentations par an, de 15 à 25 %.**\n150 € au départ → 310 € au bout de dix-huit mois. C'est la trajectoire normale.\n\n### La méthode sans risque — trois étapes\n\n1. **Nouveaux clients seulement**, pendant deux à trois mois. Change simplement\n   ton prix plancher et tes devis, sans prévenir personne.\n2. **Mesure** le taux d'acceptation au nouveau prix. Au-dessus de 50 %, il tient.\n3. **Annonce aux clients existants**, un mois de préavis, avec un geste.\n\n### Le message d'annonce\n\n> Bonjour [Prénom],\n>\n> Un mot pour vous informer que mes tarifs évoluent à partir du 1er [mois] :\n> la vidéo passe de X à Y €, droits inchangés.\n>\n> Vos commandes en cours restent au tarif actuel. Pour votre abonnement, je\n> maintiens le tarif actuel jusqu'à la fin de l'engagement en cours.\n>\n> Merci pour la confiance, et à très vite.\n\nUne date · aucune excuse · **un geste pour les réguliers** — c'est le geste qui\nfait que personne ne part.\n\n### Augmenter son revenu sans toucher au prix\n\n| Levier | Exemple |\n|---|---|\n| Réduire le périmètre inclus | 3 retours → 2 · 6 mois de droits → 3 |\n| Facturer ce qui était offert | Déclinaisons, hooks, urgences |\n| Monter en gamme de clients | Une agence paie 30 à 50 % de plus |\n\n### Si un client refuse\n\n| Cas | Réponse |\n|---|---|\n| Bon client, tu ne veux pas de risque | « Je maintiens votre tarif jusqu'en [mois], ensuite je m'aligne » |\n| Client difficile ou peu rentable | Laisse-le partir : sa marge se réduira à chaque trimestre |\n"},{"title":"Checklist de révision trimestrielle","description":"Calculer le taux d'acceptation, comparer à la fourchette 50-70 %, décider, poser le rappel à trois mois.","kind":"checklist","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '80b89081-36d2-491e-8c3f-1e4456487427'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid, c.id, c.org_id, 'negocier-cadrer', $sq$Négocier et cadrer la mission$sq$, $sq$Ce module couvre tout ce qui se joue entre le « oui » et le tournage : les douze questions d'un appel de cadrage qui évite 90 % des reprises, les cinq mouvements de négociation qui empêchent de brader, les huit clauses d'un contrat d'une page, la mécanique d'acompte et de relance qui supprime les impayés, et la manière de refuser sans fermer de porte.$sq$, 8, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'a4ebdad8-540d-4a1a-a042-2657082b4362'::uuid, m.id, m.course_id, m.org_id, 'le-call-de-cadrage', $sq$Le call de cadrage : douze questions à poser$sq$, $sq$Trente minutes au téléphone règlent 90 % des problèmes de livraison. Les douze questions groupées par thème, celles qui évitent les catastrophes, le compte rendu de dix lignes à envoyer dans l'heure et les cinq signaux d'alerte à traduire en clauses.$sq$, $sq$## L'accroche

Une créatrice accepte une mission par email en trois échanges : « 4 vidéos, 900 €, livraison le 20 ». Elle tourne, elle livre. La marque demande une refonte complète : ce n'était pas le bon produit, le ton ne correspond pas à leur charte, et il fallait des versions carrées pour leur site. Trois jours de travail supplémentaires, non payés, et une relation abîmée. Rien de tout cela n'était de la mauvaise foi : ces informations existaient dans la tête du client, et personne ne les avait demandées. Un appel de trente minutes avant de tourner règle 90 % des problèmes de livraison du métier. Cette leçon donne les douze questions à poser, dans l'ordre, et ce qu'on fait des réponses.

## Le contenu

### Pourquoi un appel, et pas un email

Trois raisons.

**Les informations implicites sortent à l'oral.** « Ah oui, et il faudrait éviter de montrer la concurrence dans le plan » ne s'écrit jamais dans un brief.

**Tu détectes le client difficile.** Un interlocuteur qui ne sait pas répondre à « quel est votre objectif sur cette campagne » annonce des allers-retours infinis.

**Tu deviens une personne.** Un prestataire au bout d'un email se remplace ; quelqu'un avec qui on a parlé trente minutes, beaucoup moins.

Trente minutes, en visio ou au téléphone, jamais plus. Au-delà, c'est du conseil gratuit.

### Les douze questions

**Sur le produit**

1. Que fait le produit, et pour qui exactement ?
2. Quelle est l'objection la plus fréquente de vos clients avant l'achat ?
3. Qu'est-ce qui vous différencie de [concurrent que tu as repéré] ?

**Sur la campagne**

4. Où ces vidéos seront-elles diffusées, et pendant combien de temps ?
5. Quel est l'objectif : notoriété, ventes, inscriptions ?
6. Qu'est-ce qui a déjà fonctionné ou raté dans vos créas précédentes ?

**Sur le livrable**

7. Combien de vidéos, quelle durée, quels formats de fichier ?
8. Faut-il des sous-titres incrustés, une voix off, une musique particulière ?
9. Y a-t-il des mentions obligatoires, des interdits, une charte à respecter ?

**Sur le processus**

10. Qui valide, et en combien de temps ?
11. Quelle est la date limite réelle, et pourquoi cette date ?
12. Combien d'allers-retours prévoyez-vous ?

Les questions 9, 10 et 12 sont celles qui évitent les catastrophes. La 9 parce que les secteurs réglementés — santé, alimentaire, finance — ont des interdits que tu ne peux pas deviner. La 10 parce qu'un circuit de validation à quatre personnes double le délai. La 12 parce qu'elle fixe le forfait de retours avant qu'il y ait un désaccord.

### La question qui change tout

La numéro 6 : « qu'est-ce qui a déjà fonctionné ou raté ? »

Elle t'évite de proposer exactement ce qui a échoué le trimestre dernier, elle révèle le vrai niveau de maturité du client, et elle te donne les angles déjà couverts.

Si la réponse est « on ne sait pas », tu as une information capitale : le client ne mesure rien, il jugera ta vidéo à son goût personnel. Prévois plus d'allers-retours et fais valider un script avant de tourner.

### Le compte rendu

Le geste qui distingue une professionnelle : **dans l'heure qui suit l'appel, tu envoies un récapitulatif en dix lignes**.

> Merci pour l'échange. Pour cadrer :
> — 4 vidéos, 30 s, format 9:16 + version 1:1
> — Angle prioritaire : l'objection « trop cher », qui revient dans vos avis
> — Interdits : pas de comparaison directe, mention « complément alimentaire » obligatoire
> — Validation par vous seule, sous 48 h
> — 2 allers-retours inclus
> — Livraison le 24, diffusion Meta et TikTok, 3 mois, France
>
> Si tout est exact, je lance la production dès réception de l'acompte.

Ce document devient la référence en cas de désaccord. Il coûte dix minutes et il a la valeur d'un contrat léger.

### Les signaux d'alerte à repérer pendant l'appel

**« On verra à la livraison. »** Aucun critère de validation : prépare-toi à des retours subjectifs sans fin.

**Quatre validateurs.** Chaque personne ajoutera un avis, souvent contradictoire.

**« On n'a pas encore le produit. »** Le délai va glisser, et ce sera ton retard.

**« C'est urgent, on a besoin de ça pour demain. »** Une urgence se facture ; une urgence gratuite se répète.

**Aucune réponse à la question du budget.** Si la marque refuse de donner un ordre de grandeur, tu risques de travailler trois heures sur une proposition hors sujet.

Aucun de ces signaux n'est rédhibitoire, mais chacun se traduit en clause : plus de retours facturés, délai plus long, acompte plus élevé.

## Exemple appliqué

Camille a un appel avec une marque de compléments pour le sommeil.

**Ce que l'appel révèle en trente minutes :**

- L'objection principale n'est pas le prix mais la peur de l'accoutumance. Elle ne l'aurait jamais deviné.
- Deux vidéos précédentes ont échoué parce qu'elles « faisaient trop médical ».
- La législation interdit toute allégation de santé : elle ne peut pas dire « ça aide à dormir », seulement « je m'endors plus vite depuis ». La nuance est cruciale et elle est écrite dans la loi, pas dans le brief.
- La validation passe par la fondatrice **et** par leur conseil réglementaire : compter cinq jours, pas deux.
- Ils veulent trois vidéos, pas quatre : l'email initial était approximatif.

**Le compte rendu** envoyé dans l'heure reprend les cinq points.

**Le résultat** : livraison acceptée sans aucune reprise. La marque écrit « c'est la première fois qu'on n'a pas à tout refaire à cause du réglementaire ».

Sans l'appel, Camille aurait tourné quatre vidéos sur le prix, avec des allégations interdites, validées en deux jours par personne. Trois jours de travail perdus.

## Les erreurs fréquentes

Accepter une mission sans appel. C'est la cause principale des reprises non payées.

Poser les questions par email. Les informations implicites ne s'écrivent pas ; elles se disent.

Faire un appel d'une heure et demie. Trente minutes, puis un devis. Au-delà, tu fais du conseil gratuit.

Ne pas envoyer de compte rendu. Sans trace écrite, le souvenir de chacun diverge dans le même sens : celui du client.

Oublier la question des mentions obligatoires. Dans les secteurs réglementés, c'est ce qui fait tout refaire.

Ne pas demander qui valide. Un circuit à quatre personnes double le délai et multiplie les retours.

Ignorer les signaux d'alerte. Ils ne doivent pas te faire refuser, mais ils doivent changer tes conditions.

## Action immédiate

Copie les douze questions dans une note de ton téléphone, groupées par thème. Ajoute en dessous le modèle de compte rendu en dix lignes. Au prochain appel, tu poseras les douze en trente minutes et tu enverras le récapitulatif dans l'heure. C'est le geste qui te fera passer, aux yeux du client, de créatrice à prestataire fiable.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Les douze questions du call de cadrage","description":"Les douze questions dans l'ordre, le modèle de compte rendu à envoyer dans l'heure, et le tableau des cinq signaux d'alerte avec la clause à ajouter pour chacun.","kind":"document","url":null,"body":"## Les douze questions du call de cadrage\n\nTrente minutes, jamais plus. Au-delà, c'est du conseil gratuit.\n\n### Sur le produit\n1. Que fait le produit, et pour qui exactement ?\n2. Quelle est l'objection la plus fréquente avant l'achat ?\n3. Qu'est-ce qui vous différencie de [concurrent repéré] ?\n\n### Sur la campagne\n4. Où ces vidéos seront-elles diffusées, et pendant combien de temps ?\n5. Quel est l'objectif : notoriété, ventes, inscriptions ?\n6. **Qu'est-ce qui a déjà fonctionné ou raté dans vos créas précédentes ?**\n\n### Sur le livrable\n7. Combien de vidéos, quelle durée, quels formats de fichier ?\n8. Sous-titres incrustés, voix off, musique particulière ?\n9. **Mentions obligatoires, interdits, charte à respecter ?**\n\n### Sur le processus\n10. **Qui valide, et en combien de temps ?**\n11. Quelle est la date limite réelle, et pourquoi cette date ?\n12. **Combien d'allers-retours prévoyez-vous ?**\n\nLes questions **9, 10 et 12** évitent les catastrophes. La **6** révèle le\nniveau de maturité du client : « on ne sait pas » = il jugera à son goût\npersonnel, prévois plus de retours et fais valider un script avant de tourner.\n\n### Le compte rendu — dans l'heure qui suit\n\n> Merci pour l'échange. Pour cadrer :\n> — [n] vidéos, [durée], format [formats]\n> — Angle prioritaire : [angle]\n> — Interdits : [interdits] ; mention obligatoire : [mention]\n> — Validation par [qui], sous [délai]\n> — [n] allers-retours inclus\n> — Livraison le [date], diffusion [supports], [durée], [territoire]\n>\n> Si tout est exact, je lance la production dès réception de l'acompte.\n\nDix minutes d'écriture, la valeur d'un contrat léger.\n\n### Les cinq signaux d'alerte\n\n| Signal | Ce qu'il annonce | Clause à ajouter |\n|---|---|---|\n| « On verra à la livraison » | Retours subjectifs sans fin | Forfait de retours strict |\n| Quatre validateurs | Délai doublé, avis contradictoires | Délai allongé |\n| « On n'a pas encore le produit » | Le retard deviendra le tien | Condition suspensive |\n| « C'est pour demain » | L'urgence gratuite se répète | Majoration 30-50 % |\n| Aucune réponse sur le budget | Trois heures de proposition hors sujet | Fourchette avant devis |\n"},{"title":"Checklist d'avant-appel","description":"Regarder leurs publicités, lire vingt avis clients, repérer un concurrent : quinze minutes de préparation qui changent la qualité des questions.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0e2c7899-7c57-4d8d-a7f8-1821dea4c99d'::uuid, m.id, m.course_id, m.org_id, 'negocier', $sq$Négocier : ancrage, contreparties, silence$sq$, $sq$Une remise consentie devient le prix de référence de toute la relation. Cinq mouvements — ancrer, échanger, réduire le périmètre plutôt que le prix, se taire, tenir un plancher écrit — et les quatre phrases à savoir par cœur.$sq$, $sq$## L'accroche

« Vous pouvez faire un effort sur le prix ? » Cette phrase arrive dans un échange sur trois, et la réponse instinctive — accepter un peu, pour ne pas perdre la mission — coûte plus cher qu'on ne le croit. Non pas parce que la remise est grande, mais parce qu'elle devient le prix de référence de toute la relation : le client ne repassera jamais au tarif plein, et il demandera un effort supplémentaire à la commande suivante. Négocier n'est pas un talent, c'est une petite mécanique : savoir qui parle en premier, quoi donner en échange, et quand se taire. Cette leçon donne les cinq mouvements qui suffisent à ne plus jamais brader.

## Le contenu

### Mouvement 1 : ancrer

Le premier chiffre énoncé structure toute la discussion. C'est le mieux documenté des effets de négociation, et il fonctionne même quand tout le monde le connaît.

Conséquence pratique : **c'est toi qui donnes le premier chiffre**, et il doit être le prix de ta formule recommandée, pas le prix minimal que tu accepterais.

Si le client demande son budget en premier — « vous êtes dans quelle fourchette ? » — donne une fourchette qui commence à ton prix cible : « entre 250 et 400 € selon les droits et le volume ».

### Mouvement 2 : ne jamais céder sans contrepartie

Toute concession s'échange. Trois contreparties naturelles :

**Le volume.** « Je peux faire 220 € au lieu de 250 si on passe à six vidéos. »
**L'engagement.** « 200 € si on part sur trois mois d'abonnement. »
**Le périmètre.** « Je peux tenir votre budget en passant les droits à un mois. »

Une concession donnée sans rien en échange enseigne au client que ton prix était faux, et il testera à nouveau.

### Mouvement 3 : réduire le périmètre, pas le prix

C'est le mouvement central du métier, et il mérite d'être répété : **le prix unitaire est ton actif à long terme**.

Face à un budget insuffisant, tu proposes toujours moins de choses au même prix unitaire, jamais les mêmes choses moins cher.

> « Avec 600 €, je peux faire trois vidéos avec droits six mois, ou quatre vidéos avec droits un mois. Les deux tiennent. »

Le client choisit, garde la main, et ton prix reste intact.

### Mouvement 4 : le silence

Après avoir donné un prix, tu te tais. C'est l'exercice le plus difficile et le plus rentable.

Le réflexe est de meubler — « mais on peut discuter », « c'est négociable », « je sais que c'est un budget ». Chacune de ces phrases donne une remise avant même qu'on l'ait demandée.

Donne le chiffre. Arrête-toi. Laisse le blanc. Il dure trois secondes, il paraît en durer trente, et c'est très souvent le client qui le remplit — parfois par un simple « d'accord ».

### Mouvement 5 : le plancher écrit

Décide **avant** l'échange du prix en dessous duquel tu ne descends pas, et écris-le. Un plancher décidé à froid tient ; un plancher improvisé sous pression cède toujours.

Règle utile : ton plancher est à −20 % de ton prix affiché, et il n'est atteignable qu'avec une contrepartie de volume ou d'engagement.

En dessous, tu refuses — et refuser une mission mal payée libère le créneau pour une mission correcte. C'est arithmétique, mais ça ne se ressent pas comme tel sur le moment.

### Les phrases qui tiennent

À apprendre, parce qu'elles doivent sortir sans réfléchir.

> « Mon tarif est de X. Je peux ajuster le périmètre si le budget est contraint. »

> « Je comprends. Sur ce budget, voici ce que je peux faire : [option réduite]. »

> « Ce prix inclut les droits trois mois et deux allers-retours. Si un de ces points ne vous sert pas, on peut le retirer. »

> « Je préfère vous dire non plutôt que de livrer un travail bâclé à ce prix-là. »

La dernière est un refus, et elle obtient très souvent un « attendez, on peut trouver un budget ».

### Ce qui n'est pas de la négociation

Un client qui demande une remise de 40 % ne négocie pas : il teste si tu as une valeur. Un client qui compare à « quelqu'un qui le fait à 80 € » ne compare pas le même travail.

Dans les deux cas, la bonne réponse est calme et brève : « nos offres ne sont pas comparables, et à ce niveau de prix je ne suis pas la bonne personne. Bonne continuation. »

## Exemple appliqué

Nadia envoie un devis de 1 275 € pour six vidéos. Réponse : « c'est un peu au-dessus, vous pouvez faire 900 ? »

**Ce qu'elle ne fait pas** : accepter 900 €. Ni couper la poire en deux à 1 100 €, ce qui est la même erreur en plus lent.

**Ce qu'elle fait** :

> « 900 €, je peux le faire — en quatre vidéos au lieu de six, avec les mêmes droits. Ou six vidéos à 1 100 € si on passe sur un engagement de deux mois consécutifs. Dites-moi ce qui sert le mieux votre campagne. »

Puis elle se tait.

**Trois heures plus tard** : « on part sur les six à 1 100, avec les deux mois ».

Résultat : 175 € de moins que le devis initial, mais un engagement sur deux mois — soit 2 200 € au lieu de 1 275 €. Son prix unitaire est passé de 212 à 183 €, ce qui est acceptable puisque le volume double et que la prospection disparaît.

**Ce qui aurait pu se passer** sans les mouvements : 900 € pour six vidéos, soit 150 € l'unité, sans engagement — et une référence de prix cassée pour toute la relation.

## Les erreurs fréquentes

Donner un prix puis continuer de parler. Le silence après le chiffre est la partie la plus rentable de l'échange.

Céder sans contrepartie. Le client apprend que ton prix était faux.

Couper la poire en deux. C'est une concession déguisée en équité, et elle enseigne exactement la même chose.

Baisser le prix unitaire au lieu du périmètre. Tu abîmes ton actif de long terme pour un contrat.

Ne pas avoir de plancher écrit. Sous pression, on descend toujours plus bas qu'on ne l'aurait cru.

S'excuser de son prix. « Je sais que c'est cher, mais… » invite à la remise.

Accepter une comparaison avec un tarif dix fois inférieur. Ce n'est pas la même prestation, et le dire calmement suffit.

## Action immédiate

Écris ton plancher aujourd'hui, en euros, sur ta fiche de tarifs — le prix en dessous duquel tu ne descends pas, quelle que soit la contrepartie. Puis apprends les quatre phrases par cœur, à voix haute. Le jour où « vous pouvez faire un effort ? » arrivera, tu répondras en trois secondes au lieu de céder en trente.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les cinq mouvements de négociation","description":"Chaque mouvement avec sa mécanique, le tableau des contreparties, les phrases qui donnent une remise sans qu'on la demande, et les quatre répliques à apprendre.","kind":"document","url":null,"body":"## Les cinq mouvements de négociation\n\n### 1. Ancrer\n**C'est toi qui donnes le premier chiffre**, et c'est celui de ta formule\nrecommandée — pas ton minimum.\n\nSi on te demande ta fourchette : commence-la à ton prix cible.\n> « Entre 250 et 400 € selon les droits et le volume. »\n\n### 2. Ne jamais céder sans contrepartie\n\n| Concession | Contrepartie exigée |\n|---|---|\n| −10 % | Volume (6 vidéos au lieu de 3) |\n| −20 % | Engagement (3 mois d'abonnement) |\n| Budget tenu | Périmètre réduit (droits, nombre) |\n\nUne concession gratuite enseigne que ton prix était faux. Le client testera\nà nouveau.\n\n### 3. Réduire le périmètre, pas le prix\n> « Avec 600 €, je peux faire trois vidéos avec droits six mois, ou quatre\n> vidéos avec droits un mois. Les deux tiennent. »\n\n**Le prix unitaire est ton actif de long terme.**\n\n### 4. Le silence\nDonne le chiffre. **Arrête-toi.** Le blanc dure trois secondes et paraît en\ndurer trente — c'est très souvent le client qui le remplit.\n\nPhrases qui donnent une remise avant qu'on la demande : « mais on peut\ndiscuter » · « c'est négociable » · « je sais que c'est un budget ».\n\n### 5. Le plancher écrit\nDécidé **à froid**, avant l'échange. Environ **−20 %** du prix affiché, et\natteignable **seulement** avec une contrepartie.\n\n**Mon plancher : ______ €**\n\n### Les quatre phrases à savoir par cœur\n\n> Mon tarif est de X. Je peux ajuster le périmètre si le budget est contraint.\n\n> Je comprends. Sur ce budget, voici ce que je peux faire : [option réduite].\n\n> Ce prix inclut les droits trois mois et deux allers-retours. Si un de ces\n> points ne vous sert pas, on peut le retirer.\n\n> Je préfère vous dire non plutôt que de livrer un travail bâclé à ce prix-là.\n\nLa dernière obtient très souvent « attendez, on peut trouver un budget ».\n\n### Ce qui n'est pas de la négociation\n\nUne demande de −40 % · une comparaison avec « quelqu'un à 80 € ».\n\n> Nos offres ne sont pas comparables, et à ce niveau de prix je ne suis pas la\n> bonne personne. Bonne continuation.\n"},{"title":"Fiche de plancher tarifaire","description":"Le prix en dessous duquel tu ne descends pas, décidé à froid. Un plancher improvisé sous pression cède toujours.","kind":"template","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '3f3f8141-462b-4c83-a78a-73666e6bdf6a'::uuid, m.id, m.course_id, m.org_id, 'le-contrat', $sq$Le contrat : les huit clauses non négociables$sq$, $sq$Un devis d'une page accepté par email fait preuve. Les huit clauses rédigées, dont la condition suspensive sur le produit et la propriété des rushes, plus les quatre clauses à ne jamais signer dans un contrat de grande marque.$sq$, $sq$## L'accroche

La plupart des missions UGC se font sans contrat, et la plupart se passent bien. Le problème n'est pas la fréquence des conflits, c'est leur coût : une seule mission qui dérape — un client qui ne paie pas, une vidéo qui ressort trois ans plus tard, une demande de reprise sans fin — peut effacer le bénéfice de dix missions réussies. Un contrat de créatrice UGC n'a pas besoin d'être un document juridique de douze pages. Il tient en une page, en huit clauses, dans un email accepté par retour de message. Ce n'est pas un blindage, c'est une mise au clair — et son principal effet est de rendre les conflits impossibles plutôt que gagnables. Cette leçon donne les huit clauses, rédigées.

## Le contenu

### Ce qui vaut contrat

En France, un accord écrit — même un email — engage les parties dès lors qu'il précise l'objet, le prix et les conditions. Tu n'as pas besoin de signature manuscrite : un « c'est validé pour nous » par retour d'email suffit à faire preuve.

Le format le plus efficace : ton devis d'une page, envoyé en PDF, avec la phrase « merci de me confirmer votre accord par retour de message ».

### Les huit clauses

**1. L'objet.** Ce que tu livres, précisément. « 4 vidéos verticales de 30 secondes maximum, format MP4, 9:16 et 1:1, sous-titres incrustés. »

**2. Le prix et les modalités.** Le total, l'acompte, le solde, le délai de paiement. « 1 240 € HT. Acompte de 40 % à la commande, solde à la livraison, paiement à 15 jours. »

**3. Les droits d'usage.** Durée, territoire, supports, droit à l'image. C'est la clause la plus importante du document.

**4. Le délai et ses conditions.** « Livraison le 24 avril, sous réserve de réception du produit avant le 12 avril. » La condition suspensive est essentielle : sans elle, un produit envoyé en retard devient ton retard.

**5. Les retours.** « 2 allers-retours inclus, portant sur le montage et non sur le concept validé. Reprise supplémentaire : 40 €. » La précision « pas sur le concept » évite la refonte totale déguisée en retour.

**6. La propriété des rushes.** « Les fichiers bruts non montés restent la propriété de la créatrice et ne sont pas livrés. » Sans cette ligne, un client peut réclamer tes rushes et les faire remonter par quelqu'un d'autre.

**7. L'annulation.** « En cas d'annulation après tournage, l'acompte reste acquis. En cas d'annulation avant tournage, l'acompte est remboursé à 50 %. » Cette clause protège ton temps réservé.

**8. La confidentialité et l'exclusivité.** « Aucune exclusivité n'est accordée sauf mention expresse et facturation séparée. » Cette phrase, seule, vaut plusieurs milliers d'euros sur une carrière.

### Ce qu'on ajoute selon les cas

**Le whitelisting**, s'il y en a : durée, plateforme, clause de retrait sous sept jours.

**Les mentions obligatoires**, dans les secteurs réglementés : c'est le client qui en porte la responsabilité, et l'écrire le rappelle.

**La mention de collaboration commerciale** si la vidéo est publiée sur ton compte : la loi française impose de signaler un contenu rémunéré.

### La facturation, en pratique

Statut micro-entreprise dans la quasi-totalité des cas au démarrage. Trois éléments obligatoires sur ta facture : ton SIRET, la mention « TVA non applicable, art. 293 B du CGI » tant que tu es sous le seuil de franchise, et les conditions de paiement avec le taux de pénalité de retard.

Numérote tes factures sans trou — c'est une obligation, et c'est la première chose qu'un contrôle regarde.

### Ce qu'il ne faut pas signer

**Une cession de droits perpétuelle et mondiale sans supplément.** Elle apparaît dans beaucoup de contrats types de grandes marques.

**Une clause de non-concurrence sans contrepartie financière.** Elle est d'ailleurs fragile juridiquement, mais mieux vaut ne pas avoir à le démontrer.

**Un contrat qui prévoit un paiement « après diffusion »** ou « après validation du client final ». Ton paiement ne doit dépendre que de ta livraison.

**Des révisions illimitées.** Sans forfait, la reprise devient un droit sans fin.

Face à un contrat de grande marque, tu peux demander des modifications. C'est normal, ça se fait tous les jours, et le refus de discuter est en soi une information.

## Exemple appliqué

Sarah reçoit une commande de six vidéos d'une marque de 40 personnes. Elle envoie son devis d'une page avec les huit clauses.

La marque répond avec son propre contrat de sept pages. Sarah le lit et relève trois points :

**Article 4** : « cession exclusive, définitive, pour le monde entier, tous supports connus et inconnus ». Elle demande : durée de trois ans, territoire Europe, supports numériques — ou maintien du perpétuel avec un supplément de 100 %.

**Article 7** : « la créatrice s'engage à ne pas collaborer avec des marques concurrentes pendant douze mois ». Elle demande soit la suppression, soit une contrepartie de 1 500 €.

**Article 9** : « paiement à 60 jours fin de mois après diffusion ». Elle demande 30 jours après livraison, sans condition de diffusion.

**La réponse de la marque** : accord sur les trois points, avec le perpétuel maintenu et le supplément payé. L'exclusivité est supprimée — « on l'avait mise par habitude ».

**Résultat** : 1 890 € au lieu de 1 275 €, aucune exclusivité, paiement à 30 jours. Trois demandes, quinze minutes de lecture.

Le point le plus intéressant : la clause d'exclusivité était là « par habitude ». Personne ne l'avait négociée avant Sarah, donc personne ne l'avait retirée.

## Les erreurs fréquentes

Travailler sans aucun écrit. Une mission sur vingt dérape, et celle-là coûte le bénéfice de dix autres.

Croire qu'il faut un vrai contrat d'avocat. Un devis d'une page accepté par email fait preuve.

Oublier la condition suspensive sur le produit. Un envoi tardif devient ton retard.

Ne pas limiter les retours au montage. « Un aller-retour » sans précision autorise la refonte totale.

Livrer les rushes. Ils te seront remontés par quelqu'un d'autre, et ta vidéo cessera d'être la tienne.

Signer un contrat de grande marque sans le lire. Les clauses les plus coûteuses y sont standard, et souvent retirables sur simple demande.

Accepter un paiement conditionné à la diffusion. Tu es payée pour livrer, pas pour le succès d'une campagne que tu ne pilotes pas.

## Action immédiate

Écris tes huit clauses ce soir, dans un document d'une page, avec tes conditions par défaut. Ajoute la phrase « merci de me confirmer votre accord par retour de message » à la fin. Envoie-le systématiquement à partir de ta prochaine mission. Le jour où une mission dérapera — et il arrivera — cette page fera la différence entre une discussion et une perte.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Les huit clauses — contrat d'une page","description":"Chaque clause rédigée mot pour mot, les mentions de facture obligatoires, et le tableau de ce qu'il ne faut pas signer avec le coût de chaque clause.","kind":"document","url":null,"body":"## Les huit clauses — contrat d'une page\n\nUn devis PDF d'une page + « merci de me confirmer votre accord par retour de\nmessage » **fait preuve**. Pas besoin de signature manuscrite.\n\n### 1. Objet\n> 4 vidéos verticales de 30 secondes maximum, format MP4, 9:16 et 1:1,\n> sous-titres incrustés.\n\n### 2. Prix et modalités\n> 1 240 € HT. Acompte de 40 % à la commande, solde à la livraison,\n> paiement à 15 jours.\n\n### 3. Droits d'usage\n> 3 mois, France, supports numériques, droit à l'image de la créatrice inclus\n> sur la même période. Extensions par avenant.\n\n**La clause la plus importante du document.**\n\n### 4. Délai et condition suspensive\n> Livraison le 24 avril, **sous réserve de réception du produit avant le\n> 12 avril**.\n\nSans cette condition, un produit envoyé en retard devient **ton** retard.\n\n### 5. Retours\n> 2 allers-retours inclus, portant sur le montage et **non sur le concept\n> validé**. Reprise supplémentaire : 40 €.\n\n### 6. Propriété des rushes\n> Les fichiers bruts non montés restent la propriété de la créatrice et ne\n> sont pas livrés.\n\nSans cette ligne, tes rushes peuvent être remontés par quelqu'un d'autre.\n\n### 7. Annulation\n> Annulation après tournage : l'acompte reste acquis.\n> Annulation avant tournage : acompte remboursé à 50 %.\n\n### 8. Exclusivité\n> Aucune exclusivité n'est accordée sauf mention expresse et facturation\n> séparée.\n\n**Cette phrase seule vaut plusieurs milliers d'euros sur une carrière.**\n\n### Mentions de facture obligatoires\n\nSIRET · « TVA non applicable, art. 293 B du CGI » (sous le seuil de\nfranchise) · conditions de paiement · pénalités de retard · numérotation\n**sans trou**.\n\n### Ce qu'il ne faut pas signer\n\n| Clause | Ce qu'elle coûte |\n|---|---|\n| Cession perpétuelle mondiale sans supplément | Dix ans de diffusion, un paiement |\n| Non-concurrence sans contrepartie | 80 % du marché fermé dans une niche étroite |\n| Paiement « après diffusion » ou « après validation du client final » | Ton paiement dépend d'un événement que tu ne pilotes pas |\n| Révisions illimitées | La mission n'a plus de fin |\n\nFace à un contrat de grande marque : **demande des modifications**. Ces clauses\nsont souvent là par habitude, et personne ne les avait négociées avant toi.\n"},{"title":"Annuaire des entreprises","description":"Vérifier l'existence et la santé d'une société avant une grosse commande. Une entreprise en procédure collective ne paiera pas.","kind":"tool","url":"https://annuaire-entreprises.data.gouv.fr"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7eb6ba23-5599-469f-b7b2-fd2b446a498f'::uuid, m.id, m.course_id, m.org_id, 'acompte-et-impayes', $sq$Se faire payer : acompte, délais, relances$sq$, $sq$Un impayé de 900 € efface un tiers d'un mois. Trois décisions prises avant la mission — acompte de 40 %, délai écrit, quatre relances datées — et la procédure qui se déroule sans avoir à décider si on ose.$sq$, $sq$## L'accroche

Un impayé de 900 € représente, pour une créatrice qui facture 2 500 € par mois, plus d'un tiers du chiffre d'affaires mensuel. Et l'impayé n'est que la forme extrême du problème : le vrai coût quotidien du métier, c'est le décalage — livrer en avril, être payée en juillet, avancer le matériel, les produits, le temps, et attendre. La quasi-totalité de ces situations se règle avec trois décisions prises **avant** la mission : un acompte, un délai écrit, et une procédure de relance appliquée sans état d'âme. Aucune ne demande d'être dure ; toutes demandent d'être systématique. Cette leçon les met en place.

## Le contenu

### L'acompte, non négociable

**40 % à la commande**, avant tout tournage. C'est la norme du métier, et elle protège deux choses : ton temps réservé, et ta trésorerie.

Ce qu'il change concrètement : un client qui a payé 40 % annule rarement, valide plus vite, et envoie le produit dans les temps. L'acompte n'est pas qu'une sécurité financière, c'est un accélérateur de projet.

Formulation : « Je bloque le créneau de production à réception de l'acompte de 40 %. »

**Les deux exceptions** : une agence ou un grand groupe dont le processus comptable ne permet pas d'acompte — dans ce cas, demande un bon de commande, qui a la même valeur d'engagement. Et un client régulier de confiance, à qui tu factures en fin de mois.

### Le délai de paiement

Le délai légal en France est de 30 jours à réception de facture, sauf accord contraire, et il ne peut pas dépasser 60 jours.

Écris-le : « Paiement à 15 jours à réception de facture. » Quinze jours est parfaitement acceptable pour une petite structure et raccourcit le cycle d'un mois complet sur l'année.

Ajoute la mention obligatoire : « Pénalités de retard : trois fois le taux d'intérêt légal. Indemnité forfaitaire de recouvrement : 40 €. » Ces deux lignes sont obligatoires sur une facture professionnelle, et leur simple présence accélère les paiements.

### La procédure de relance

Quatre étapes, datées, appliquées sans exception.

**J+1 après échéance.** Message court et neutre. « Bonjour, ma facture n° X du [date] est arrivée à échéance hier. Merci de me confirmer la date de règlement. » Neuf fois sur dix, c'est un oubli, et ça suffit.

**J+8.** Relance avec la facture en pièce jointe et la mention des pénalités. Ton toujours neutre.

**J+15.** Appel téléphonique. C'est l'étape qui débloque le plus de situations, et celle qu'on saute le plus souvent.

**J+30.** Mise en demeure par lettre recommandée. Un modèle d'une demi-page suffit ; elle mentionne la facture, le montant, les pénalités et un délai de huit jours. Elle est souvent payée dans les jours qui suivent.

Au-delà, l'injonction de payer auprès du tribunal de commerce est une procédure simple et peu coûteuse, mais on y arrive rarement quand les quatre étapes précédentes ont été suivies.

### Ce qui prévient les impayés

**Facturer le jour de la livraison**, pas à la fin du mois. Une facture émise trois semaines après la livraison décale tout d'autant.

**Envoyer la facture à la bonne adresse.** Beaucoup d'entreprises ont une adresse dédiée : demande-la dès la commande.

**Mettre le numéro de bon de commande** quand il y en a un. Sans lui, une facture peut rester bloquée des mois dans un service comptable, sans que personne ne te prévienne.

**Vérifier l'existence de l'entreprise.** Un coup d'œil sur l'annuaire des entreprises avant une grosse commande : une société en procédure collective ne paiera pas.

### La règle des 40 %

Aucun client ne doit dépasser 40 % de ton chiffre d'affaires. Au-delà, un retard de paiement de sa part devient une crise de trésorerie pour toi, et tu perds toute capacité de négociation — parce que perdre ce client serait une catastrophe.

C'est une règle de gestion, pas de méfiance : les meilleurs clients sont aussi ceux qui deviennent dangereux par leur poids.

### La trésorerie de sécurité

Trois mois de charges fixes de côté, avant de considérer ce métier comme un revenu principal.

Le métier est saisonnier — août et fin décembre sont creux — et les budgets marketing se recalent en janvier. Un mois vide arrive à tout le monde ; il ne doit pas être un problème.

## Exemple appliqué

Julie livre trois missions en mars, sans acompte, avec « paiement à 30 jours » mentionné nulle part.

**Fin avril** : une facture payée, deux en attente. Elle n'ose pas relancer.

**Fin mai** : toujours deux impayés, 1 340 €. Elle relance par email, sans réponse.

Elle change de méthode en juin.

**Ce qu'elle met en place** : acompte de 40 %, paiement à 15 jours, mentions de pénalités, facture émise le jour de la livraison, et les quatre relances datées dans son agenda dès l'émission de chaque facture.

**Sur les impayés existants** : elle applique la procédure rétroactivement. La première facture est payée trois jours après l'appel téléphonique — « on ne l'avait pas reçue au bon service ». La seconde nécessite une mise en demeure : payée onze jours plus tard, avec les 40 € d'indemnité qu'elle a facturés.

**De juin à décembre** : dix-sept missions, zéro impayé, délai moyen de paiement de 11 jours.

Ce qui a tout changé n'est pas la fermeté, c'est le fait que chaque étape était **prévue et datée** — donc appliquée sans avoir à décider si elle osait.

## Les erreurs fréquentes

Travailler sans acompte. C'est la protection la plus simple et la plus efficace du métier.

Ne pas écrire de délai de paiement. Sans mention, le client applique son propre rythme, souvent 60 jours.

Facturer en fin de mois. Chaque jour de décalage à l'émission est un jour de décalage au paiement.

Ne pas oser relancer. Une relance à J+1 est neutre, attendue, et professionnelle. Ne pas relancer est ce qui construit un impayé.

Sauter l'appel téléphonique à J+15. C'est l'étape qui débloque le plus de situations.

Oublier les mentions de pénalités. Elles sont obligatoires, et leur présence seule accélère les règlements.

Laisser un client dépasser 40 % du chiffre d'affaires. Il devient un employeur sans contrat de travail, et tu perds tout pouvoir de négociation.

## Action immédiate

Ajoute dès aujourd'hui à ton devis type la ligne « acompte de 40 % à la commande, solde à 15 jours » et les deux mentions de pénalités sur ton modèle de facture. Puis, pour chaque facture en attente, pose les quatre dates de relance dans ton agenda. Tu n'auras plus jamais à décider si tu oses : ce sera écrit.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Acompte, délais, impayés","description":"Les trois décisions préalables, les mentions obligatoires de facture, le tableau des quatre relances datées et les deux règles de gestion du portefeuille clients.","kind":"document","url":null,"body":"## Acompte, délais, impayés\n\n### Les trois décisions à prendre AVANT la mission\n\n1. **Acompte de 40 %** à la commande, avant tout tournage\n2. **Paiement à 15 jours** à réception de facture, écrit\n3. **Quatre relances datées**, posées dans l'agenda dès l'émission\n\n### L'acompte\n\n> Je bloque le créneau de production à réception de l'acompte de 40 %.\n\nCe n'est pas qu'une sécurité : un client qui a payé 40 % annule rarement,\nvalide plus vite, et envoie le produit dans les temps.\n\n**Deux exceptions** : une agence ou un grand groupe dont la comptabilité ne\npermet pas d'acompte — demande un **bon de commande**, même valeur\nd'engagement ; et un client régulier de confiance, facturé en fin de mois.\n\n### Mentions obligatoires sur la facture\n\n> Pénalités de retard : trois fois le taux d'intérêt légal.\n> Indemnité forfaitaire de recouvrement : 40 €.\n\nLeur simple présence accélère les règlements.\n\n### La procédure de relance\n\n| Quand | Geste | Ton |\n|---|---|---|\n| J+1 après échéance | Message court : « facture n° X arrivée à échéance hier, merci de me confirmer la date de règlement » | Neutre |\n| J+8 | Relance + facture en pièce jointe + mention des pénalités | Neutre |\n| **J+15** | **Appel téléphonique** — l'étape qui débloque le plus, et la plus sautée | Neutre |\n| J+30 | Mise en demeure en recommandé, délai de 8 jours | Ferme |\n\nAu-delà : injonction de payer au tribunal de commerce — simple et peu\ncoûteuse, rarement nécessaire si les quatre étapes ont été suivies.\n\n### Ce qui prévient les impayés\n\n- [ ] Facturer **le jour de la livraison**, jamais en fin de mois\n- [ ] Demander l'**adresse de facturation dédiée** dès la commande\n- [ ] Mettre le **numéro de bon de commande** quand il existe\n- [ ] Vérifier l'existence de l'entreprise avant une grosse commande\n\n### Deux règles de gestion\n\n**Aucun client au-dessus de 40 % du chiffre d'affaires.** Au-delà, un retard\nde sa part devient une crise, et tu perds tout pouvoir de négociation.\n\n**Trois mois de charges fixes en trésorerie** avant de considérer ce métier\ncomme un revenu principal. Août et fin décembre sont creux, les budgets se\nrecalent en janvier.\n"},{"title":"Checklist d'émission de facture","description":"Le jour de la livraison, adresse de facturation dédiée, numéro de bon de commande, mentions de pénalités, quatre dates de relance à l'agenda.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '5bfa57c6-571c-4f53-ba0b-5948183e6ef2'::uuid, m.id, m.course_id, m.org_id, 'dire-non', $sq$Dire non, et dire non proprement$sq$, $sq$Chaque créneau occupé par une mauvaise mission est indisponible pour une bonne. Ce qu'il faut refuser et ce qu'il ne faut pas, les quatre messages de refus en trois lignes, et la méthode de réalignement d'un client historique devenu difficile.$sq$, $sq$## L'accroche

Une créatrice de dix mois d'ancienneté n'a jamais refusé une mission. Elle travaille avec un client qui la fait retourner trois fois chaque vidéo, un autre qui paie à soixante jours, un troisième qui envoie ses briefs le vendredi soir pour le lundi matin. Elle est occupée à temps plein, et elle gagne moins que sa voisine qui refuse une mission sur trois. Le refus n'est pas un luxe de créatrice installée : c'est l'outil qui rend possible la montée en gamme, parce que chaque créneau occupé par une mauvaise mission est un créneau indisponible pour une bonne. Encore faut-il savoir refuser sans fermer la porte — et savoir reconnaître ce qu'il faut refuser. Cette leçon donne les deux.

## Le contenu

### Ce qu'il faut refuser

**Le prix sous ton plancher**, sans contrepartie. Une mission à moitié tarif occupe le même créneau qu'une mission à plein tarif.

**Les révisions illimitées.** Sans forfait écrit, la mission n'a pas de fin.

**Les droits perpétuels sans supplément.** Une vidéo qui travaille dix ans pour un paiement unique.

**L'exclusivité gratuite.** Dans une niche étroite, elle peut fermer 80 % de ton marché.

**Un produit ou une marque qui te met mal à l'aise.** Tu mets ton visage dessus, et il y restera. Un complément aux promesses douteuses, un service financier agressif, une marque en pleine polémique : le gain est ponctuel, l'association est durable.

**L'urgence gratuite et répétée.** Une urgence se facture 30 à 50 % de plus. Une urgence gratuite se répète, toujours.

**Le client qui ne respecte pas les personnes.** Ton temps, tes réponses, tes horaires. Ça ne s'améliore jamais.

### Ce qu'il ne faut pas refuser

Une mission un peu en dessous de ton prix, **avec un vrai volume** derrière.
Une marque petite mais sérieuse, qui grandira.
Un brief exigeant : c'est souvent le signe d'un client qui sait ce qu'il veut, donc de peu de retours.
Un secteur nouveau qui t'intéresse, même hors niche, à condition que ce soit ponctuel.

### Comment refuser en trois lignes

Le refus s'écrit court. Un long message paraît hésitant et invite à la relance.

**Refus sur le prix**

> Bonjour [Prénom], merci pour la proposition. Ce budget est en dessous de mes tarifs — je démarre à 250 € la vidéo. Si un budget se libère plus tard, je serai ravie d'en reparler. Bonne journée.

**Refus sur la disponibilité**

> Bonjour [Prénom], merci de penser à moi. Mon planning est complet jusqu'au [date]. Si votre calendrier peut attendre, je peux vous réserver un créneau à partir du [date]. Sinon, bonne continuation.

**Refus sur le produit**

> Bonjour [Prénom], merci pour votre message. Je préfère décliner : je ne suis pas la bonne personne pour ce produit, et une créatrice qui n'y croit pas se voit à l'écran. Bonne recherche.

**Refus sur les conditions**

> Bonjour [Prénom], merci pour l'envoi du contrat. Deux points bloquent de mon côté : la cession perpétuelle sans supplément, et les révisions illimitées. Si ces deux points peuvent évoluer, je suis partante ; sinon je préfère décliner.

Le dernier obtient très souvent une modification du contrat, parce que la plupart de ces clauses sont là par habitude.

### La règle du créneau

Une manière simple de décider : avant d'accepter, demande-toi « si une mission à plein tarif arrive demain pour ce créneau, est-ce que je regretterai ? ».

Si la réponse est oui et que ton pipeline est fourni, refuse. Si ton pipeline est vide, accepte — un mois vide coûte plus cher qu'une mission moyenne.

Le refus se pratique quand on a le choix. Construire ce choix est le rôle des modules de prospection.

### Refuser en gardant la relation

Trois gestes qui coûtent trente secondes.

**Proposer une alternative.** « Sur ce budget, je peux faire deux vidéos au lieu de quatre. »

**Recommander quelqu'un.** Si tu connais une créatrice qui correspond, donne son nom. Elle te rendra la pareille, et le client se souviendra de toi.

**Laisser une date.** « Je suis disponible à partir du 15 » transforme un refus en report.

### Le cas du client existant devenu difficile

Le plus délicat, et le plus fréquent au bout d'un an. Un client historique qui paie mal, demande beaucoup et occupe un tiers de ton temps.

La méthode : **ne pas rompre, réaligner**. Annonce une hausse de tarif et une réduction de périmètre à la prochaine échéance. S'il accepte, la relation devient saine. S'il refuse, il part de lui-même — et c'était le résultat recherché.

Cette approche évite la rupture brutale, qui abîme la réputation dans des secteurs où tout le monde se parle.

## Exemple appliqué

Anaïs, dix mois d'activité, quatre clients, planning plein.

**Proposition 1 — 100 € la vidéo, cinq vidéos.** Son plancher est à 200 €. Elle refuse avec le message prix. Deux mois plus tard, la marque revient : « on a débloqué un budget, on peut faire 220 ». Elle accepte.

**Proposition 2 — un complément amincissant aux promesses spectaculaires.** Elle refuse avec le message produit. Elle apprendra six mois plus tard que la marque a été épinglée pour publicité mensongère, et que deux créatrices ont dû faire retirer leurs vidéos.

**Proposition 3 — un contrat de grande marque, cession perpétuelle mondiale, révisions illimitées.** Elle refuse avec le message conditions. La marque modifie les deux clauses en quarante-huit heures. Contrat signé à 1 890 €.

**Client historique difficile.** Il paie 160 € la vidéo depuis huit mois et demande trois retours à chaque fois. Elle annonce 220 € et deux retours à partir du mois suivant. Il accepte 220 € et négocie trois retours facturés. La relation devient rentable.

Sur quatre situations, trois refus — et deux d'entre eux se sont transformés en contrats meilleurs.

## Les erreurs fréquentes

Ne jamais refuser. Chaque créneau occupé par une mauvaise mission est indisponible pour une bonne.

Refuser longuement, en se justifiant. Trois lignes, un motif, une porte ouverte.

Refuser sans laisser d'alternative ni de date. Un refus sec ferme une relation qui aurait pu revenir.

Accepter un produit qui met mal à l'aise. Le gain est ponctuel, l'association à ton visage est durable.

Accepter une urgence gratuite. Elle se répétera à chaque commande.

Rompre brutalement avec un client difficile. Réaligne les conditions : il accepte, ou il part de lui-même.

Refuser quand le pipeline est vide. Le refus se pratique quand on a le choix ; le reste du temps, on accepte et on prospecte.

## Action immédiate

Écris ta liste de refus : les cinq situations dans lesquelles tu diras non, quoi qu'il arrive. Puis copie les quatre messages types dans une note. La prochaine proposition qui coche une de ces cases obtiendra une réponse en deux minutes — et tu découvriras, comme presque tout le monde, qu'un refus sur deux revient en meilleure proposition.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Dire non, et dire non proprement","description":"Le tableau de ce qui se refuse et pourquoi, les quatre messages types, la règle du créneau et la méthode pour réaligner un client devenu difficile sans rompre.","kind":"document","url":null,"body":"## Dire non, et dire non proprement\n\n### Ce qu'il faut refuser\n\n| Situation | Pourquoi |\n|---|---|\n| Prix sous le plancher, sans contrepartie | Même créneau qu'une mission à plein tarif |\n| Révisions illimitées | La mission n'a pas de fin |\n| Droits perpétuels sans supplément | Dix ans de travail pour un paiement |\n| Exclusivité gratuite | Jusqu'à 80 % du marché fermé |\n| Produit qui met mal à l'aise | Gain ponctuel, association durable à ton visage |\n| Urgence gratuite | Elle se répète toujours |\n| Client irrespectueux | Ça ne s'améliore jamais |\n\n### Ce qu'il ne faut PAS refuser\n\nUn prix un peu bas **avec du volume réel** · une petite marque sérieuse ·\nun brief exigeant (signe d'un client qui sait ce qu'il veut) · un secteur\nnouveau, ponctuellement.\n\n### Les quatre messages de refus\n\n**Prix**\n> Bonjour [Prénom], merci pour la proposition. Ce budget est en dessous de mes\n> tarifs — je démarre à 250 € la vidéo. Si un budget se libère plus tard, je\n> serai ravie d'en reparler. Bonne journée.\n\n**Disponibilité**\n> Bonjour [Prénom], merci de penser à moi. Mon planning est complet jusqu'au\n> [date]. Si votre calendrier peut attendre, je peux vous réserver un créneau\n> à partir du [date]. Sinon, bonne continuation.\n\n**Produit**\n> Bonjour [Prénom], merci pour votre message. Je préfère décliner : je ne suis\n> pas la bonne personne pour ce produit, et une créatrice qui n'y croit pas se\n> voit à l'écran. Bonne recherche.\n\n**Conditions**\n> Bonjour [Prénom], merci pour l'envoi du contrat. Deux points bloquent de mon\n> côté : la cession perpétuelle sans supplément, et les révisions illimitées.\n> Si ces deux points peuvent évoluer, je suis partante ; sinon je préfère\n> décliner.\n\nLe dernier obtient très souvent une modification du contrat.\n\n### La règle du créneau\n\n> Si une mission à plein tarif arrive demain pour ce créneau, est-ce que je\n> regretterai ?\n\nOui + pipeline fourni → refuse.\nOui + pipeline vide → accepte, et prospecte.\n\n**Le refus se pratique quand on a le choix.**\n\n### Les trois gestes qui gardent la relation\n\nProposer une alternative réduite · recommander quelqu'un (elle te rendra la\npareille) · laisser une date, qui transforme un refus en report.\n\n### Le client historique devenu difficile\n\n**Ne pas rompre, réaligner.** Annonce une hausse et une réduction de périmètre\nà la prochaine échéance. Il accepte → la relation devient saine. Il refuse →\nil part de lui-même, et c'était le résultat recherché.\n"},{"title":"Ma liste de refus","description":"Les cinq situations dans lesquelles je dirai non, quoi qu'il arrive. Écrite à froid, elle évite d'avoir à décider sous pression.","kind":"template","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '842f1e86-3ad0-4910-bb9b-17075e2bde5c'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'bb344537-0f47-410b-a1cd-264c9c2fe10e'::uuid, c.id, c.org_id, 'brief-et-script', $sq$Le brief et la préparation du tournage$sq$, $sq$Ce module transforme un brief approximatif en plan de tournage exécutable : la grille de lecture qui repère les quatre pièges, la structure de script en quatre blocs avec ses proportions, la liste de plans qui divise le temps de tournage par deux, et la checklist de la veille qui fait commencer une session à l'heure.$sq$, 9, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '592adcef-83e2-4bff-ad4f-008839e85d64'::uuid, m.id, m.course_id, m.org_id, 'lire-un-brief', $sq$Lire un brief de marque et repérer les pièges$sq$, $sq$Un brief conforme peut donner une vidéo inutilisable. Les cinq éléments qu'il doit contenir, les quatre pièges classiques avec leur remède, et les quatre questions qui le rendent exploitable — dont celle que personne ne pose.$sq$, $sq$## L'accroche

Un brief de marque est rarement un document de travail : c'est un résumé de ce que le client croit vouloir, écrit vite, entre deux réunions. Il contient presque toujours trois catégories d'informations — celles qui sont exactes, celles qui sont vagues, et celles qui manquent. La créatrice qui l'exécute à la lettre livre une vidéo conforme et inutilisable ; celle qui sait le lire repère en dix minutes les quatre zones de flou, pose quatre questions, et livre une vidéo acceptée du premier coup. Lire un brief est une compétence, pas une formalité. Cette leçon donne la grille de lecture, les pièges les plus fréquents, et la manière de reformuler ce qui manque sans passer pour compliquée.

## Le contenu

### Les cinq éléments qu'un brief doit contenir

Un brief complet dit : **quoi** (le produit et son bénéfice), **pour qui** (la cible), **où** (la diffusion), **quel angle** (l'argument), **quelles contraintes** (mentions, interdits, charte).

Compte les cinq. La plupart des briefs en contiennent deux ou trois. Ce qui manque, tu le poses en question — jamais tu ne le devines.

### Les quatre pièges classiques

**1. « Soyez naturelle, faites comme vous le sentez. »**

Traduction réelle : « je ne sais pas ce que je veux, mais je le reconnaîtrai quand je le verrai ». C'est le brief le plus dangereux, parce qu'il garantit des retours subjectifs.

Remède : fais valider un **script écrit** avant de tourner. Trois lignes suffisent. Une validation sur texte coûte cinq minutes, une reprise de tournage coûte trois heures.

**2. Le brief qui liste dix arguments.**

« Parlez de la composition naturelle, du prix, de la livraison rapide, de la fabrication française, de la texture, du packaging recyclable… » En trente secondes, on tient **un** argument.

Remède : « Je propose de concentrer cette vidéo sur [argument]. Si vous voulez couvrir les autres, il faut plusieurs vidéos — c'est d'ailleurs mieux pour tester. » Cette phrase transforme régulièrement une commande d'une vidéo en commande de trois.

**3. Le brief qui décrit une publicité de marque.**

« Plan large sur le produit, musique élégante, voix off qui présente la gamme. » C'est un film de marque, pas de l'UGC — et diffusé en publicité native, il sera ignoré.

Remède : explique le mécanisme en une phrase. « Ce format performe mal en flux natif parce qu'il se reconnaît comme une publicité en une seconde. Je vous propose la même idée en version incarnée. »

**4. Le brief sans contraintes, dans un secteur réglementé.**

Compléments alimentaires, cosmétique, santé, finance, alcool : chaque secteur a des allégations interdites. Un brief qui n'en parle pas ne signifie pas qu'il n'y en a pas.

Remède : demande explicitement. « Y a-t-il des allégations interdites ou des mentions obligatoires de votre côté ? »

### Les quatre questions qui comblent tout

Quelle que soit la qualité du brief, ces quatre questions suffisent à le rendre exploitable :

1. **Si vous ne deviez garder qu'un seul argument, lequel ?**
2. **Quelle est l'objection principale de vos clients avant l'achat ?**
3. **Y a-t-il des mots, des allégations ou des visuels interdits ?**
4. **À quoi ressemblerait une vidéo ratée pour vous ?**

La quatrième est la plus utile et personne ne la pose. Elle fait sortir des critères implicites que le client n'aurait jamais écrits : « ratée, ce serait trop jeune », « ratée, ce serait dans une salle de bain ».

### La reformulation

Après lecture et questions, tu renvoies **ta** version du brief en cinq lignes, avant de tourner.

> Pour cadrer avant tournage :
> — Argument principal : la tenue longue durée
> — Cible : femmes 30-45, actives, sensibles au côté « pas besoin de retoucher »
> — Interdits : pas de comparaison avec un concurrent, pas d'allégation « longue tenue 24 h »
> — Format : témoignage face caméra, 30 s, décor intérieur neutre
> — Une vidéo ratée pour vous : trop maquillée, trop jeune

Cette reformulation est ton assurance. Une reprise demandée hors de ces cinq lignes devient une modification de périmètre, donc facturable.

### Le brief absent

Certaines marques n'envoient rien : « on vous fait confiance ». C'est flatteur et dangereux.

Dans ce cas, **tu écris le brief toi-même** et tu le fais valider. Cinq lignes, le même format que ci-dessus, avec « si ça vous convient, je lance ». Tu passes pour une professionnelle et tu obtiens ta trace écrite.

## Exemple appliqué

Léa reçoit ce brief pour une crème solaire :

> « Bonjour, on aimerait 3 vidéos qui montrent la crème. Parlez de la protection SPF50, du fait qu'elle ne laisse pas de traces blanches, qu'elle est résistante à l'eau, qu'elle convient aux peaux sensibles et qu'elle est fabriquée en France. Soyez naturelle ! »

**Ce qu'elle repère** : cinq arguments pour trois vidéos, un « soyez naturelle » sans critère, aucune contrainte réglementaire alors que la protection solaire en est truffée, aucune cible.

**Ses quatre questions** :

La marque répond : l'argument prioritaire est l'absence de traces blanches, l'objection principale est « les crèmes solaires sont grasses », la mention « SPF 50 » doit être exacte et il est interdit de dire « protection totale », et une vidéo ratée serait « une vidéo à la plage, on veut du quotidien urbain ».

Cette dernière réponse est décisive : Léa avait prévu de tourner sur une terrasse ensoleillée.

**Sa reformulation** en cinq lignes, validée en une heure.

**Les trois vidéos** : une sur l'absence de traces (démonstration en gros plan), une sur la texture non grasse (objection principale), une sur l'usage quotidien en ville.

**Le résultat** : zéro reprise. La marque commande trois vidéos supplémentaires le mois suivant en écrivant « vous aviez compris le produit mieux que notre brief ».

Le brief initial aurait produit trois vidéos à la plage, avec cinq arguments empilés et une mention interdite.

## Les erreurs fréquentes

Exécuter le brief à la lettre. Un brief conforme peut donner une vidéo inutilisable.

Ne pas poser de questions par peur de paraître compliquée. Quatre questions font gagner du temps à tout le monde, et le client le sait.

Empiler tous les arguments demandés. Une vidéo tient un argument ; deux le diluent.

Ignorer le réglementaire dans un secteur sensible. C'est ce qui fait tout refaire, et la responsabilité en est partagée.

Ne pas reformuler par écrit. Sans trace, chaque reprise devient discutable.

Tourner sans script validé quand le brief dit « faites comme vous le sentez ». C'est le combo qui produit des allers-retours sans fin.

Accepter « on vous fait confiance » sans écrire le brief soi-même. La confiance ne protège de rien au moment de la validation.

## Action immédiate

Prends le dernier brief que tu as reçu — ou invente-en un plausible — et compte les cinq éléments : quoi, pour qui, où, quel angle, quelles contraintes. Note ce qui manque. Puis écris les quatre questions dans une note de ton téléphone, la quatrième en gras : « à quoi ressemblerait une vidéo ratée pour vous ? ». C'est celle qui te fera gagner le plus de reprises.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Lire un brief et le rendre exploitable","description":"La grille des cinq éléments, le tableau des quatre pièges et de leurs remèdes, les quatre questions et le modèle de reformulation en cinq lignes.","kind":"document","url":null,"body":"## Lire un brief et le rendre exploitable\n\n### Les cinq éléments d'un brief complet\n\n| Élément | Question | Présent ? |\n|---|---|---|\n| Quoi | Le produit et son bénéfice |  |\n| Pour qui | La cible réelle |  |\n| Où | La diffusion et sa durée |  |\n| Quel angle | L'argument unique |  |\n| Quelles contraintes | Mentions, interdits, charte |  |\n\nLa plupart des briefs en contiennent deux ou trois. **Ce qui manque se\ndemande, jamais ne se devine.**\n\n### Les quatre pièges classiques\n\n| Piège | Traduction réelle | Remède |\n|---|---|---|\n| « Soyez naturelle » | « Je le reconnaîtrai quand je le verrai » | Faire valider un **script écrit** avant de tourner |\n| Dix arguments listés | Le client n'a pas priorisé | « Une vidéo tient un argument — sinon il en faut plusieurs » |\n| Description d'un film de marque | Confusion de format | « Ce format se reconnaît comme une pub en une seconde » |\n| Aucune contrainte, secteur réglementé | Elles existent quand même | Demander explicitement les allégations interdites |\n\n### Les quatre questions qui comblent tout\n\n1. Si vous ne deviez garder qu'un seul argument, lequel ?\n2. Quelle est l'objection principale de vos clients avant l'achat ?\n3. Y a-t-il des mots, allégations ou visuels interdits ?\n4. **À quoi ressemblerait une vidéo ratée pour vous ?**\n\nLa quatrième est la plus utile, et personne ne la pose. Elle fait sortir les\ncritères implicites : « trop jeune », « pas dans une salle de bain ».\n\n### La reformulation en cinq lignes — avant tournage\n\n> Pour cadrer avant tournage :\n> — Argument principal : …\n> — Cible : …\n> — Interdits : … ; mention obligatoire : …\n> — Format : …\n> — Une vidéo ratée pour vous : …\n\n**C'est ton assurance** : une reprise demandée hors de ces cinq lignes est une\nmodification de périmètre, donc facturable.\n\n### Quand il n'y a aucun brief\n\n« On vous fait confiance » = tu écris le brief toi-même, en cinq lignes, et tu\nle fais valider. Tu passes pour une professionnelle et tu obtiens ta trace.\n"},{"title":"Checklist du brief absent","description":"Quand une marque dit « on vous fait confiance » : écrire le brief soi-même en cinq lignes et le faire valider avant de tourner.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'bb344537-0f47-410b-a1cd-264c9c2fe10e'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '50e48db3-771e-4cbb-8c4b-f4a1d7595500'::uuid, m.id, m.course_id, m.org_id, 'le-script-ugc', $sq$Le script UGC : hook, problème, preuve, appel$sq$, $sq$Soixante-dix mots pour retenir, expliquer, convaincre et faire cliquer. Les quatre blocs avec leurs proportions, six mécaniques de hook, les règles pour écrire à l'oreille et la règle de spécificité qui remplace dix adjectifs par un chiffre.$sq$, $sq$## L'accroche

Une vidéo UGC de trente secondes contient environ soixante-dix mots. Soixante-dix mots pour retenir, expliquer, convaincre et faire cliquer. À cette échelle, l'improvisation ne fonctionne pas : ce qui paraît spontané à l'écran est presque toujours écrit, resserré, et répété. La bonne nouvelle, c'est qu'il existe une structure qui marche dans la quasi-totalité des cas, en quatre blocs, et qu'elle s'écrit en dix minutes une fois qu'on la connaît. Cette leçon donne cette structure, les proportions de chaque bloc, et la façon d'écrire pour l'oreille plutôt que pour l'œil.

## Le contenu

### La structure en quatre blocs

**1. Le hook — 0 à 3 secondes.** Il ne vend rien. Son seul travail est d'empêcher le pouce de glisser. Il nomme une situation, un problème ou un résultat.

**2. Le problème — 3 à 10 secondes.** Tu développes la frustration, avec des détails concrets. C'est là que la spectatrice se reconnaît, et la reconnaissance est ce qui la fait rester.

**3. La preuve — 10 à 25 secondes.** Le produit entre. Pas comme une annonce, comme une réponse. Tu montres l'usage, tu donnes un détail vérifiable, tu racontes ce qui a changé.

**4. L'appel à l'action — 25 à 30 secondes.** Court, littéral, une seule action.

Les proportions comptent autant que les blocs : le problème doit occuper au moins un quart de la vidéo. Les créatrices débutantes le sautent pour arriver vite au produit — et c'est précisément ce qui fait décrocher.

### Écrire un hook

Six mécaniques qui fonctionnent, à alterner :

**La situation reconnaissable.** « Si tu ranges tes câbles dans un tiroir en te disant que tu trieras plus tard… »
**Le chiffre.** « J'ai dépensé 240 € en crèmes avant de comprendre un truc. »
**L'objection assumée.** « J'étais persuadée que c'était encore un gadget. »
**La question fermée.** « Tu fais aussi cette erreur en te lavant les cheveux ? »
**Le résultat d'abord.** « Trois semaines et je ne me réveille plus la nuit. »
**Le contre-pied.** « Arrête d'acheter des protéines. Enfin — celles-là. »

Ce qui ne fonctionne pas : « Salut ! », le logo, le nom du produit, une musique d'intro, un plan d'ambiance. Chacun de ces éléments dit « publicité » avant même le premier mot.

### Écrire pour l'oreille

Un texte écrit pour être lu sonne faux à l'oral. Quatre règles :

**Des phrases courtes.** Quinze mots maximum. Si tu manques de souffle en la lisant, elle est trop longue.

**Le vocabulaire parlé.** « Du coup », « en fait », « genre » : ils sonnent vrais. Le vocabulaire écrit — « néanmoins », « il s'avère que » — trahit le script.

**Une idée par phrase.** Les subordonnées se perdent à l'oral.

**Le test à voix haute.** Lis ton script debout, à vitesse normale. Chaque endroit où tu butes est un endroit à réécrire. C'est le seul contrôle qualité qui compte.

### Le compte de mots

Trente secondes ≈ 70 à 80 mots. Quarante-cinq secondes ≈ 110 mots. Soixante secondes ≈ 150 mots.

Écris toujours **10 % de moins** que le maximum : le débit ralentit à l'enregistrement, et une vidéo qui déborde se coupe mal.

### La règle de la spécificité

Un détail précis vaut dix adjectifs. « C'est super efficace » ne dit rien ; « au bout de quatre jours, plus aucune plaque sur les coudes » est une preuve.

Trois sources de spécificité, toujours disponibles : un chiffre (durée, prix, quantité), un moment (« le mardi soir, après le sport »), une sensation (« ça ne colle pas, c'est le seul truc que je demandais »).

### L'appel à l'action

Court, littéral, une seule action. « Le lien est juste en dessous. » « C'est en promo cette semaine, je mets le lien. »

Ce qui ne fonctionne pas : deux actions à la fois, une formule alambiquée, un « n'hésitez pas à ». La marque ajoutera souvent son propre appel à l'action au montage : demande-le au cadrage plutôt que de deviner.

## Exemple appliqué

Produit : une gourde filtrante à 39 €. Angle : les gens achètent des bouteilles en plastique par habitude.

**Le mauvais script**, celui qu'on écrit spontanément :

> « Salut à tous ! Aujourd'hui je vous présente la gourde X, une gourde filtrante super pratique qui permet de boire de l'eau pure partout. Elle est dotée d'un filtre à charbon actif qui élimine 99 % des impuretés. Je l'utilise depuis un mois et j'en suis ravie ! N'hésitez pas à aller voir sur leur site. »

Quatre-vingt-dix mots, aucun hook, aucun problème, un produit annoncé dès la deuxième seconde, une caractéristique technique à la place d'un bénéfice, et un appel à l'action mou.

**Le bon script**, structure en quatre blocs :

> **[Hook, 0-3 s]** J'achetais six packs d'eau par mois. Six.
>
> **[Problème, 3-10 s]** Je les montais à pied au troisième, ça encombrait toute la cuisine, et à chaque fois je me disais que c'était absurde. Mais l'eau du robinet chez moi a un goût de piscine.
>
> **[Preuve, 10-25 s]** Ça, c'est un filtre à charbon. Tu remplis au robinet — *elle remplit* — tu attends dix secondes, et le goût part complètement. Un filtre tient trois mois. Ça fait deux mois que je n'ai pas acheté une bouteille.
>
> **[Appel, 25-30 s]** Le lien est en dessous.

Soixante-quinze mots. Le produit n'apparaît qu'à la dixième seconde. Le chiffre « six packs » ouvre, « trois mois » et « deux mois » prouvent, et le bénéfice remplace la caractéristique — on ne dit pas « 99 % des impuretés », on dit « le goût part ».

La marque a diffusé les deux versions en test. Le second script a obtenu un coût par achat inférieur de 40 %.

## Les erreurs fréquentes

Sauter le bloc problème. C'est celui qui fait rester, et le premier qu'on supprime pour gagner du temps.

Mettre le produit dans les trois premières secondes. Le cerveau identifie une publicité et passe.

Écrire pour l'œil. Un texte qui se lit bien peut sonner complètement faux.

Empiler les caractéristiques techniques. « Filtre à charbon actif » n'intéresse personne ; « le goût part » intéresse tout le monde.

Rester dans le général. « Super efficace » ne prouve rien ; un chiffre ou un moment précis, si.

Écrire trop long. Une vidéo qui déborde se coupe mal, et le débit s'accélère jusqu'à devenir désagréable.

Ne pas lire à voix haute avant de tourner. Chaque hésitation à la lecture deviendra une prise ratée.

## Action immédiate

Prends un produit que tu as chez toi et écris un script de soixante-quinze mots en quatre blocs, en respectant les durées. Puis lis-le debout, à voix haute, à vitesse normale, et chronomètre. Si tu dépasses trente secondes ou si tu butes quelque part, réécris. Dix minutes, et tu as le format que tu utiliseras pour toutes tes vidéos.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"La structure d'un script UGC","description":"Les quatre blocs et leurs timings, les six mécaniques de hook avec exemples, les règles d'écriture orale, le compte de mots par durée et la règle de spécificité.","kind":"document","url":null,"body":"## La structure d'un script UGC\n\n### Les quatre blocs et leurs proportions\n\n| Bloc | Timing | Rôle | Erreur fréquente |\n|---|---|---|---|\n| **Hook** | 0 – 3 s | Empêcher le pouce de glisser | Y mettre le produit ou le logo |\n| **Problème** | 3 – 10 s | Faire se reconnaître | **Le sauter** pour aller au produit |\n| **Preuve** | 10 – 25 s | Le produit comme réponse | Empiler les caractéristiques |\n| **Appel** | 25 – 30 s | Une seule action | Deux actions, ou « n'hésitez pas à » |\n\nLe bloc **problème** doit occuper au moins un quart de la vidéo. C'est celui\nqui fait rester, et le premier qu'on supprime.\n\n### Six mécaniques de hook\n\n| Mécanique | Exemple |\n|---|---|\n| Situation reconnaissable | « Si tu ranges tes câbles en te disant que tu trieras plus tard… » |\n| Chiffre | « J'ai dépensé 240 € en crèmes avant de comprendre un truc. » |\n| Objection assumée | « J'étais persuadée que c'était encore un gadget. » |\n| Question fermée | « Tu fais aussi cette erreur en te lavant les cheveux ? » |\n| Résultat d'abord | « Trois semaines et je ne me réveille plus la nuit. » |\n| Contre-pied | « Arrête d'acheter des protéines. Enfin — celles-là. » |\n\n**Jamais** : « Salut ! » · le logo · le nom du produit · une musique d'intro ·\nun plan d'ambiance.\n\n### Écrire pour l'oreille\n\n- Phrases de **15 mots maximum** — si tu manques de souffle, c'est trop long\n- Vocabulaire **parlé** : « du coup », « en fait », « genre »\n- **Une idée par phrase** : les subordonnées se perdent à l'oral\n- **Lecture debout à voix haute** : chaque hésitation est un endroit à réécrire\n\n### Compte de mots\n\n| Durée | Mots | À viser |\n|---|---|---|\n| 30 s | 70 – 80 | 70 |\n| 45 s | ~110 | 100 |\n| 60 s | ~150 | 135 |\n\nÉcris **10 % de moins** que le maximum : le débit ralentit à l'enregistrement.\n\n### La règle de spécificité\n\nUn détail précis vaut dix adjectifs. Trois sources toujours disponibles :\nun **chiffre** (durée, prix, quantité) · un **moment** (« le mardi soir, après\nle sport ») · une **sensation** (« ça ne colle pas »).\n\n« C'est super efficace » ne prouve rien.\n« Au bout de quatre jours, plus aucune plaque sur les coudes » prouve.\n"},{"title":"Checklist de relecture d'un script","description":"Lire debout, à voix haute, chronomètre en main : chaque hésitation est un endroit à réécrire, et chaque dépassement une coupe à faire avant de tourner.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'bb344537-0f47-410b-a1cd-264c9c2fe10e'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ddc894b7-1f39-43a5-890e-d649a98aa6f0'::uuid, m.id, m.course_id, m.org_id, 'la-liste-de-plans', $sq$Le storyboard en une page et la liste de plans$sq$, $sq$Le script dit ce qu'on entend, pas ce qu'on voit — et c'est cette moitié manquante qui fait exploser les temps de tournage. Cinq valeurs de cadrage, un tableau de huit lignes, et l'ordre de tournage par famille qui divise la mise en place par trois.$sq$, $sq$## L'accroche

Deux créatrices tournent la même vidéo. La première arrive avec son script et improvise les plans : elle filme, regarde, se dit qu'il manque un plan du produit, refilme, cherche un angle, recommence. Deux heures et vingt minutes. La seconde arrive avec une liste de sept plans numérotés : elle enchaîne, coche, et repart. Quarante minutes. Le script dit **ce qu'on entend** ; il ne dit rien de **ce qu'on voit**, et c'est cette moitié manquante qui fait exploser les temps de tournage. Une page de storyboard — huit lignes, aucun dessin — supprime toute décision pendant le tournage. Cette leçon la construit.

## Le contenu

### Pourquoi une liste de plans, pas un dessin

Un storyboard dessiné est un exercice d'agence, inutile ici. Ce dont tu as besoin est une **liste de prises de vue** : pour chaque phrase du script, quel plan tu filmes.

Une ligne par plan : numéro, ce qu'on voit, cadrage, durée approximative, texte associé. Huit à douze lignes pour trente secondes.

### Le vocabulaire minimal des cadrages

Cinq valeurs suffisent pour tout le métier.

**Le plan buste.** Toi, de la taille à la tête. Le plan par défaut du témoignage.

**Le gros plan visage.** Du menton au front. Il crée de l'intimité, à utiliser sur une phrase forte.

**Le plan produit.** Le produit seul, en main ou posé. Il doit être net et lisible.

**Le macro.** Très près : une texture, un détail, un mécanisme. C'est le plan qui donne de la valeur perçue.

**Le plan d'action.** Les mains qui font quelque chose : verser, ouvrir, appliquer, ranger.

Alterner ces valeurs toutes les deux à trois secondes crée le rythme. Un plan unique de trente secondes, même parfait, fait décrocher.

### La règle de la coupe

Une coupe toutes les 2 à 3 secondes en moyenne. Ce n'est pas une convention esthétique : c'est ce qui maintient l'attention sur un flux où le pouce est toujours prêt.

Deux exceptions : un plan qui montre une transformation (une texture qui s'étale, un produit qui se déplie) peut durer cinq secondes ; le hook gagne souvent à être en plan fixe et continu, pour être crédible.

### La liste de plans, format type

| # | Ce qu'on voit | Cadrage | Durée | Texte |
|---|---|---|---|---|
| 1 | Moi, face caméra, produit hors champ | Buste | 3 s | Le hook |
| 2 | Moi qui montre le tiroir en désordre | Plan d'action | 3 s | Le problème |
| 3 | Gros plan sur le désordre | Macro | 2 s | (suite) |
| 4 | Le produit posé sur le plan de travail | Plan produit | 2 s | Transition |
| 5 | Mes mains qui l'utilisent | Plan d'action | 5 s | La démonstration |
| 6 | Gros plan sur le résultat | Macro | 3 s | La preuve |
| 7 | Moi, face caméra | Buste | 4 s | Le bénéfice |
| 8 | Moi, gros plan | Gros plan | 3 s | L'appel à l'action |

Huit lignes, vingt-cinq secondes, aucune décision à prendre pendant le tournage.

### La liste de matériel

Sous la liste de plans, trois lignes qui évitent les allers-retours :

**Accessoires** : ce qui doit être dans le cadre (le produit, un verre, une serviette, un téléphone).
**Tenue** : laquelle, parmi tes cinq tenues de tournage.
**Décor** : lequel de tes deux fonds, et ce qui doit en être retiré.

### Préparer le produit

Cinq minutes qui évitent une reprise.

**Nettoie-le.** Les traces de doigts se voient en macro, toujours.
**Vérifie l'étiquette.** Face caméra, lisible, non abîmée. Une étiquette décollée fait refaire la vidéo.
**Retire les protections.** Films plastiques, autocollants de prix, codes-barres visibles.
**Prépare l'état de départ.** Si tu montres une application, le produit doit être plein ; si tu montres un déballage, la boîte doit être fermée.
**Prévois un second exemplaire** quand c'est possible : un produit consommé ne se refilme pas.

### L'ordre de tournage

Ne tourne pas dans l'ordre du script. Tourne par **famille de plans** : tous les plans face caméra d'abord, puis tous les plans produit, puis tous les macros.

Raison : chaque changement de cadrage demande un réglage. Grouper divise le temps de mise en place par trois, et tu peux tourner les plans produit sans être coiffée.

## Exemple appliqué

Camille doit livrer six vidéos pour une marque de rangement, en une session.

**Sa préparation, la veille au soir — quarante minutes :**

Six scripts de soixante-quinze mots. Pour chacun, une liste de huit plans dans un tableau. Puis elle fait la synthèse : sur les six vidéos, il y a 18 plans face caméra, 14 plans produit, 12 macros, 4 plans d'action.

**Sa liste de matériel** : les six produits nettoyés et posés dans l'ordre, deux tenues (elle change à la moitié pour varier), un fond, le tiroir en désordre préparé à l'avance.

**Son tournage — 1 h 50 pour six vidéos :**

- 45 min : les 18 plans face caméra, à la suite, dans deux tenues.
- 30 min : les 14 plans produit, sans souci de coiffure ni de tenue.
- 25 min : les 12 macros, trépied rapproché, sur le plan de travail.
- 10 min : les 4 plans d'action.

**Ce qu'elle n'a pas fait** : chercher un plan, se demander comment cadrer, découvrir qu'il manque un accessoire, refaire une prise parce que le produit était sale.

**Comparaison** : sa session précédente, sans liste de plans, avait pris 4 h 15 pour cinq vidéos. Quarante minutes de préparation lui ont fait gagner deux heures et demie de tournage.

## Les erreurs fréquentes

Tourner sans liste de plans. Chaque décision prise pendant le tournage coûte trois à cinq minutes.

Tourner dans l'ordre du script. Chaque changement de cadrage demande un réglage ; groupe par famille.

Faire un storyboard dessiné. Perte de temps pure : une liste suffit.

Oublier de nettoyer le produit. Les traces de doigts se voient en macro et font refaire.

Ne pas prévoir de second exemplaire. Un produit consommé, ouvert ou abîmé ne se refilme pas.

Rester sur un seul cadrage. Un plan unique de trente secondes fait décrocher, même bien filmé.

Ne pas préparer le décor à l'avance. Le désordre qu'on veut montrer doit être préparé, celui qu'on ne veut pas montrer doit être retiré.

## Action immédiate

Reprends ton dernier script — ou celui de la leçon précédente — et transforme-le en liste de huit plans, dans un tableau à cinq colonnes. Ajoute les trois lignes de matériel : accessoires, tenue, décor. Chronomètre ton prochain tournage et compare-le au précédent. L'écart est en général de moitié, dès la première fois.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"La liste de plans","description":"Les cinq valeurs de cadrage, le tableau type de huit plans, l'ordre de tournage par famille et les cinq points de préparation du produit.","kind":"document","url":null,"body":"## La liste de plans\n\nPas de dessin : une **liste de prises de vue**. Huit à douze lignes pour\ntrente secondes.\n\n### Les cinq valeurs de cadrage\n\n| Valeur | Ce qu'on voit | Usage |\n|---|---|---|\n| Buste | Taille à la tête | Le témoignage par défaut |\n| Gros plan visage | Menton au front | Une phrase forte |\n| Plan produit | Le produit seul, en main ou posé | Le montrer, net et lisible |\n| Macro | Texture, détail, mécanisme | La valeur perçue |\n| Plan d'action | Les mains qui font | Verser, ouvrir, appliquer |\n\n**Une coupe toutes les 2 à 3 secondes.** Exceptions : une transformation\n(5 s) et le hook, souvent meilleur en plan fixe continu.\n\n### Le tableau type\n\n| # | Ce qu'on voit | Cadrage | Durée | Texte |\n|---|---|---|---|---|\n| 1 | Moi, face caméra, produit hors champ | Buste | 3 s | Le hook |\n| 2 | Le tiroir en désordre | Plan d'action | 3 s | Le problème |\n| 3 | Détail du désordre | Macro | 2 s | (suite) |\n| 4 | Le produit posé | Plan produit | 2 s | Transition |\n| 5 | Mes mains qui l'utilisent | Plan d'action | 5 s | Démonstration |\n| 6 | Le résultat | Macro | 3 s | La preuve |\n| 7 | Moi, face caméra | Buste | 4 s | Le bénéfice |\n| 8 | Moi, gros plan | Gros plan | 3 s | L'appel à l'action |\n\n### Sous la liste — trois lignes de matériel\n\n**Accessoires** : … **Tenue** : … **Décor** : …\n\n### L'ordre de tournage — par famille, jamais par script\n\n1. Tous les plans **face caméra** (coiffée, en tenue)\n2. Tous les plans **produit** (sans souci d'apparence)\n3. Tous les **macros** (trépied rapproché)\n4. Tous les **plans d'action**\n\nChaque changement de cadrage demande un réglage. Grouper divise le temps de\nmise en place par trois.\n\n### Préparer le produit — cinq points\n\n- [ ] Nettoyé (les traces de doigts se voient en macro)\n- [ ] Étiquette face caméra, lisible, non décollée\n- [ ] Protections retirées (film, autocollant de prix, code-barres)\n- [ ] État de départ conforme (plein / fermé selon le plan)\n- [ ] Second exemplaire si le produit se consomme\n"},{"title":"Modèle de liste de plans","description":"Un tableau à cinq colonnes — numéro, ce qu'on voit, cadrage, durée, texte — à remplir en dix minutes avant chaque tournage.","kind":"template","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'bb344537-0f47-410b-a1cd-264c9c2fe10e'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '35cc244d-d636-43c4-9796-f81ae3b21eb8'::uuid, m.id, m.course_id, m.org_id, 'preparer-le-tournage', $sq$Préparer le décor, les accessoires, la tenue$sq$, $sq$Quarante minutes se perdent avant la première prise quand rien n'a été préparé la veille. Les quatre choses à traquer dans le champ, les trois catégories d'accessoires, les cinq règles de tenue et la checklist de dix points du soir.$sq$, $sq$## L'accroche

Une créatrice arrive dans son coin de tournage, script en main, liste de plans prête. Elle allume, cadre, et remarque que le mur derrière elle porte une trace. Elle la nettoie. Puis elle se rend compte que sa tenue est la même que dans la vidéo précédente livrée à la même marque. Elle se change. Puis que le produit a une étiquette de prix. Elle la retire, ce qui laisse une trace collante. Quarante minutes se sont écoulées avant la première prise. Tout cela se prépare la veille, en dix minutes, et c'est la différence entre une session qui commence à l'heure et une session qui commence fatiguée. Cette leçon liste ce qui se prépare avant, et pourquoi chaque point y figure.

## Le contenu

### Le décor : deux vérifications, dans le champ et hors du champ

**Dans le champ**, quatre choses à traquer :

**Le personnel identifiable.** Courrier, photos de famille, ordonnance, papiers, prénom sur un mug. Une marque refuse une vidéo pour ça, et elle a raison.

**Le daté.** Calendrier, décoration saisonnière, sapin, guirlandes. Une vidéo tournée en décembre et diffusée en juin devient inutilisable.

**Le concurrent.** Une bouteille, un tube, un logo rival au fond du plan. C'est la faute qui fait refaire une vidéo entière.

**Le désordre involontaire.** Une pile de linge, un câble qui pend, une poubelle. Deux mètres carrés propres suffisent.

**Hors du champ**, rien n'a d'importance. C'est la libération de ce métier : tu n'as pas besoin d'un intérieur rangé, tu as besoin d'un cadre propre.

### Les accessoires

Trois catégories.

**Les indispensables** : le produit, et ce qui permet de le montrer en usage — un verre d'eau, une serviette, un miroir, une planche.

**Les crédibilisants** : ce qui rend la scène vraie. Une tasse à moitié bue, un carnet ouvert, une plante. Deux ou trois suffisent ; au-delà, ils volent l'attention.

**Les interdits** : tout produit d'une marque tierce reconnaissable. Masque les logos avec un morceau de gaffer si nécessaire, ou sors-les du cadre.

### La tenue

Cinq règles simples.

**Uni**, sans motif fin — les rayures serrées et les petits carreaux créent un moiré très laid à la compression vidéo.

**Dans ta palette**, pour la cohérence de tes vidéos.

**Sans logo** visible d'une autre marque.

**Contrastée avec le fond** : un haut beige sur un mur beige efface ta silhouette.

**Différente d'une vidéo à l'autre pour un même client.** Six vidéos livrées dans la même tenue se lisent comme une seule séance, et la marque le remarquera au moment de les diffuser séparément.

Prépare deux tenues par session et change à mi-parcours. C'est le geste le plus rentable pour donner l'impression de six tournages différents.

### Le produit, préparé la veille

**Nettoyé** — les traces de doigts sautent aux yeux en macro.
**Étiquette face caméra**, lisible, non décollée.
**Protections retirées** : film plastique, autocollant de prix, code-barres visible.
**État de départ conforme** : plein si tu montres une application, fermé si tu montres une ouverture.
**Second exemplaire** si le produit se consomme ou s'abîme.

Cinq points, cinq minutes, et zéro reprise pour ce motif.

### La lumière et l'heure

Ton créneau lumière est déjà décidé. Deux vérifications le jour même :

**Le ciel.** Un ciel couvert est idéal ; un grand soleil demande un voilage. Regarde par la fenêtre avant de commencer.

**Les lampes éteintes.** Toutes. Le mélange de températures est irrattrapable.

### La checklist de la veille

Dix minutes, la veille au soir. Ce n'est pas de la méticulosité, c'est ce qui permet de commencer une session à l'heure et de la finir avant d'être fatiguée.

1. Scripts imprimés ou sur un second écran
2. Listes de plans prêtes
3. Produits nettoyés et alignés dans l'ordre de tournage
4. Deux tenues sorties et repassées
5. Décor vidé de ce qui ne doit pas y être
6. Accessoires rassemblés
7. Batterie du téléphone et du micro en charge
8. Mémoire libérée
9. Frigo repérable pour être coupé le matin
10. Créneau bloqué dans l'agenda, sans rendez-vous après

### Le jour même

Trente secondes de contrôle avec la checklist du module précédent, puis tu tournes. Aucune décision créative ne se prend à ce moment-là : tout a été décidé la veille, et c'est exactement ce qui rend le tournage rapide.

## Exemple appliqué

Sofia doit livrer huit vidéos pour deux marques en une seule journée : quatre pour une marque de thé, quatre pour une marque de bougies.

**La veille, 21 h — vingt minutes :**

Elle imprime les huit scripts et les huit listes de plans. Elle nettoie les quatre boîtes de thé et les quatre bougies, retire deux autocollants de prix, remplit une théière et prépare une tasse. Elle sort deux tenues : un col roulé écru pour le thé, une chemise vert foncé pour les bougies — les deux marques auront des vidéos visuellement distinctes.

Elle vide sa table de tournage : elle y trouve un mug avec un logo de café concurrent, un courrier, et un calendrier accroché juste dans l'angle du cadre. Les trois partent.

Elle branche téléphone et micro en charge, libère 12 Go de mémoire.

**Le lendemain, 9 h 30 :** elle commence. Aucune interruption.

**11 h 40 :** huit vidéos tournées, en deux blocs de quatre, avec un changement de tenue et de décor entre les deux.

**Ce qui aurait pu arriver sans préparation** : le calendrier visible dans deux vidéos, découvert au montage ; le mug concurrent dans le champ ; une seule tenue pour les huit vidéos, donc huit vidéos qui se ressemblent ; et une session étalée sur quatre heures.

## Les erreurs fréquentes

Préparer le matin même. La fatigue de la préparation se voit dans les premières prises.

Oublier un objet concurrent dans le champ. C'est la faute qui fait refaire une vidéo entière.

Garder la même tenue pour toutes les vidéos d'un client. Elles se lisent comme une seule séance.

Porter un motif fin. Les rayures serrées créent un moiré à la compression.

Ne pas préparer de second exemplaire d'un produit consommable. Une prise ratée devient définitive.

Laisser un élément daté dans le cadre. Une vidéo de Noël diffusée en juin est perdue.

Enchaîner un rendez-vous juste après le tournage. La pression du temps se voit dans le débit et fait rater les dernières prises, qui sont souvent les plus importantes.

## Action immédiate

Écris ta checklist de la veille en dix points, adaptée à ton coin de tournage, et colle-la à côté de la checklist d'avant-tournage. Puis, ce soir, applique-la pour ta prochaine session, même si elle n'est pas prévue : prépare deux tenues, nettoie un produit, vide ton décor. Tu constateras que le tournage suivant commence à l'heure — ce qui n'arrive presque jamais autrement.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"La checklist de la veille","description":"Les dix points du soir, le tableau des quatre choses à traquer dans le champ avec leur conséquence, les catégories d'accessoires et les cinq règles de tenue.","kind":"document","url":null,"body":"## La checklist de la veille\n\nDix minutes le soir. Ce n'est pas de la méticulosité : c'est ce qui permet de\ncommencer à l'heure et de finir avant d'être fatiguée.\n\n1. [ ] Scripts imprimés ou sur un second écran\n2. [ ] Listes de plans prêtes\n3. [ ] Produits nettoyés, alignés dans l'ordre de tournage\n4. [ ] Deux tenues sorties et repassées\n5. [ ] Décor vidé de ce qui ne doit pas y être\n6. [ ] Accessoires rassemblés\n7. [ ] Batteries téléphone et micro en charge\n8. [ ] Mémoire libérée\n9. [ ] Frigo repérable pour être coupé le matin\n10. [ ] Créneau bloqué, **aucun rendez-vous après**\n\n### Les quatre choses à traquer dans le champ\n\n| À traquer | Exemple | Conséquence |\n|---|---|---|\n| Personnel identifiable | Courrier, photo, prénom sur un mug | Refus de la marque |\n| Daté | Calendrier, décoration saisonnière | Vidéo inutilisable dans six mois |\n| **Concurrent** | Une bouteille, un logo au fond | **Vidéo entière à refaire** |\n| Désordre involontaire | Linge, câble qui pend, poubelle | Amateurisme perçu |\n\n**Hors du champ, rien n'a d'importance.** Tu n'as pas besoin d'un intérieur\nrangé, tu as besoin d'un cadre propre.\n\n### Les accessoires — trois catégories\n\n| Catégorie | Exemples | Combien |\n|---|---|---|\n| Indispensables | Le produit, un verre, une serviette, un miroir | Ce que le script exige |\n| Crédibilisants | Tasse à moitié bue, carnet ouvert, plante | 2 à 3, pas plus |\n| Interdits | Tout logo tiers reconnaissable | 0 — masquer au gaffer ou sortir du cadre |\n\n### La tenue — cinq règles\n\n1. **Uni**, sans motif fin (les rayures serrées créent un moiré à la compression)\n2. Dans ta **palette**\n3. **Sans logo** d'une autre marque\n4. **Contrastée** avec le fond\n5. **Différente d'une vidéo à l'autre** pour un même client\n\nDeux tenues par session, changement à mi-parcours : le geste le plus rentable\npour donner l'impression de plusieurs tournages.\n\n### Le jour même — deux vérifications lumière\n\nLe **ciel** (couvert = idéal, grand soleil = voilage) et les **lampes\néteintes**, toutes. Le mélange de températures est irrattrapable.\n"},{"title":"Checklist du jour même","description":"Deux vérifications lumière avant de commencer : l'état du ciel, et toutes les lampes éteintes. Le mélange de températures est irrattrapable.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'bb344537-0f47-410b-a1cd-264c9c2fe10e'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '86c5f551-c72d-4499-8752-facc06f43009'::uuid, c.id, c.org_id, 'tournage-ugc', $sq$Le tournage$sq$, $sq$Ce module réduit le tournage à un vocabulaire de cinq plans et une méthode : les réglages exacts de chaque cadrage, la technique qui fait passer de douze prises à trois, les hooks alternatifs qui se tournent en six minutes et se facturent, les gestes du plan produit, le B-roll qui sauve un montage, et la journée en lot qui divise le temps unitaire par sept.$sq$, 10, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '493d97c2-7de0-4b12-bf8c-2c03ba24b6cc'::uuid, m.id, m.course_id, m.org_id, 'les-cinq-plans', $sq$Cadrer : les cinq plans qui reviennent toujours$sq$, $sq$Cinq plans couvrent 90 % des vidéos UGC. Leurs réglages exacts — distance, hauteur, mise au point —, les trois contraintes du format vertical, l'enchaînement qui tient l'attention et les trois défauts de cadrage les plus fréquents.$sq$, $sq$## L'accroche

Cinq plans reviennent dans quatre-vingt-dix pour cent des vidéos UGC. Cinq. Une créatrice qui les maîtrise peut couvrir n'importe quel brief, dans n'importe quel secteur, sans jamais se demander comment cadrer. Celle qui ne les a pas identifiés recommence à réfléchir à chaque tournage, teste trois angles, en garde un, et double son temps de production. Le cadrage n'est pas un domaine artistique dans ce métier : c'est un vocabulaire de cinq mots qu'on apprend une fois. Cette leçon donne les cinq plans, leur réglage exact, et l'ordre dans lequel les enchaîner pour tenir l'attention.

## Le contenu

### Les cinq plans

**1. Le buste.** De la taille à la tête, un peu d'air au-dessus. Ton objectif est à hauteur de tes yeux, à environ un mètre. C'est le plan du témoignage, celui où tu parles.

Réglage : trépied à hauteur de tes yeux, toi à un mètre, de trois quarts. Vérifie qu'il reste un espace d'un poing au-dessus de ta tête — coller le haut du crâne au bord est le défaut le plus courant.

**2. Le gros plan visage.** Du menton au front, ton visage occupe presque tout le cadre. Il crée de la proximité et se réserve à une phrase forte : l'aveu, le résultat, l'appel à l'action.

Réglage : rapproche-toi à cinquante centimètres. N'utilise pas le zoom numérique, qui dégrade l'image.

**3. Le plan produit.** Le produit seul, tenu ou posé, occupant environ un tiers du cadre. Il doit être net, l'étiquette lisible, sur un fond simple.

Réglage : appui long sur le produit pour verrouiller la mise au point, sinon l'appareil ira chercher le fond dès que ta main bouge.

**4. Le macro.** Très près : la texture d'une crème, le grain d'un tissu, la vapeur, un mécanisme. C'est le plan qui donne le plus de valeur perçue pour le moins d'effort.

Réglage : approche jusqu'à ce que l'image devienne floue, puis recule de dix centimètres. La plupart des téléphones font le point à partir de dix à quinze centimètres.

**5. Le plan d'action.** Les mains qui font quelque chose : verser, ouvrir, appliquer, ranger, essuyer. C'est le plan qui prouve l'usage.

Réglage : cadre les mains et le produit, pas le visage. Filme le geste **en entier**, du début à la fin — un geste coupé au montage paraît truqué.

### Le cadrage vertical, ses contraintes

Le format 9:16 impose trois règles.

**Ce qui compte est au centre vertical.** Les bords haut et bas sont rognés par l'interface des plateformes : le nom du compte, la légende, les boutons. Ne mets jamais un élément important dans les 15 % supérieurs ou inférieurs.

**Un seul sujet par plan.** Le format est étroit ; deux objets côte à côte deviennent illisibles sur un écran de téléphone.

**Les plans larges ne servent à rien.** Un plan large en vertical montre surtout du plafond et du sol. Reste serrée.

### L'enchaînement qui tient l'attention

L'ordre type d'une vidéo de trente secondes :

Buste (hook) → plan d'action ou macro (le problème montré) → plan produit (l'entrée du produit) → plan d'action (l'usage) → macro (le résultat) → buste (le bénéfice) → gros plan (l'appel).

Le principe : **alterner ce qu'on voit toutes les deux à trois secondes**, et ne jamais rester plus de cinq secondes sur la même valeur.

### Les trois défauts de cadrage les plus fréquents

**La tête coupée en haut.** Laisse un poing d'air.

**L'objectif trop bas.** Un téléphone posé sur une table filme en contre-plongée : double menton, narines, plafond. L'objectif se met à hauteur d'yeux, toujours.

**Le produit à contre-jour.** Tenu devant une fenêtre, il devient une silhouette noire. Il doit être **entre** toi et la lumière.

### Le repère au sol

Une marque de gaffer pour tes pieds, une pour le trépied. Cela garantit trois choses : la cohérence entre deux vidéos tournées à un mois d'écart, la reprise instantanée après une pause, et l'absence de dérive au fil d'une session — sans repère, on avance progressivement vers l'objectif sans s'en rendre compte.

## Exemple appliqué

Julie tourne une vidéo pour un baume à lèvres. Sa liste de plans compte huit lignes ; elle les tourne dans l'ordre des familles.

**Bloc 1 — les plans face caméra (3 plans, 12 minutes).** Trépied à 118 cm, elle à un mètre, marque au sol. Hook en buste, bénéfice en buste, appel à l'action en gros plan — elle avance simplement le trépied de cinquante centimètres pour le troisième.

**Bloc 2 — les plans produit (2 plans, 6 minutes).** Elle sort du cadre, pose le baume sur sa planche de bois clair près de la fenêtre, verrouille la mise au point dessus. Un plan du produit fermé, un plan du produit ouvert.

**Bloc 3 — les macros (2 plans, 8 minutes).** Trépied abaissé et rapproché à quinze centimètres. Un plan de la texture sur le dos de la main, un plan des lèvres après application. Elle recule de dix centimètres jusqu'à ce que la mise au point accroche.

**Bloc 4 — le plan d'action (1 plan, 4 minutes).** Ses mains qui ouvrent le tube et appliquent, geste complet, sans coupe.

**Total : trente minutes** pour une vidéo de trente secondes, prises multiples comprises.

Sa session précédente, en tournant dans l'ordre du script, lui avait pris cinquante-cinq minutes pour le même résultat — parce qu'elle réglait le trépied huit fois au lieu de quatre.

## Les erreurs fréquentes

Filmer tout en plan buste. Trente secondes sans changement de valeur font décrocher.

Poser le téléphone sur une table. La contre-plongée est le cadrage le moins flatteur qui soit.

Utiliser le zoom numérique. Il dégrade l'image ; rapproche-toi physiquement.

Oublier de verrouiller la mise au point sur un plan produit. L'appareil ira chercher le fond dès que la main bouge.

Mettre un élément important en haut ou en bas du cadre. L'interface des plateformes le recouvrira.

Filmer un geste en deux morceaux. Un geste coupé paraît truqué ; filme-le en entier, tu couperas au montage si besoin.

Ne pas marquer le sol. Sur une session d'une heure, on dérive vers l'objectif sans s'en apercevoir, et les vidéos ne se ressemblent plus.

## Action immédiate

Filme les cinq plans aujourd'hui, avec un objet quelconque : buste, gros plan, plan produit, macro, plan d'action. Regarde-les sur ton téléphone, à taille réelle. Note la hauteur de trépied et la distance de chacun sur ta fiche d'univers visuel. Ces cinq réglages notés une fois te serviront pour toutes tes vidéos à venir.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les cinq plans et leurs réglages","description":"Le tableau des cinq valeurs avec distance et hauteur d'objectif, l'enchaînement type, les contraintes du 9:16 et la fiche de tes propres réglages à noter.","kind":"document","url":null,"body":"## Les cinq plans et leurs réglages\n\n| Plan | Ce qu'on voit | Distance | Hauteur d'objectif | Usage |\n|---|---|---|---|---|\n| Buste | Taille à la tête, un poing d'air au-dessus | ~1 m | Hauteur des yeux | Le témoignage |\n| Gros plan visage | Menton au front | ~50 cm | Hauteur des yeux | Une phrase forte |\n| Plan produit | Le produit, 1/3 du cadre | 40 – 60 cm | Selon le produit | Le montrer, net |\n| Macro | Texture, détail | 10 – 15 cm | Rasante | La valeur perçue |\n| Plan d'action | Mains + produit, pas le visage | 40 – 70 cm | Au-dessus du geste | Prouver l'usage |\n\n### L'enchaînement type — 30 secondes\n\nBuste (hook) → action/macro (le problème) → plan produit (l'entrée) →\naction (l'usage) → macro (le résultat) → buste (le bénéfice) → gros plan (l'appel)\n\n**Une coupe toutes les 2 à 3 secondes.** Jamais plus de 5 secondes sur la\nmême valeur.\n\n### Les trois contraintes du 9:16\n\n1. **Rien d'important dans les 15 % du haut ni du bas** — l'interface des\n   plateformes les recouvre\n2. **Un seul sujet par plan** — le format est trop étroit pour deux\n3. **Pas de plan large** — en vertical, il montre surtout du plafond et du sol\n\n### Les trois défauts les plus fréquents\n\n| Défaut | Cause | Correction |\n|---|---|---|\n| Tête coupée en haut | Cadrage trop serré | Un poing d'air au-dessus |\n| Contre-plongée | Téléphone posé sur une table | Objectif à hauteur d'yeux |\n| Produit en silhouette | Contre-jour | Le produit **entre** toi et la lumière |\n\n### Mes réglages notés\n\n| Plan | Hauteur trépied | Distance |\n|---|---|---|\n| Buste |  |  |\n| Gros plan |  |  |\n| Produit |  |  |\n| Macro |  |  |\n"},{"title":"Checklist de cadrage","description":"Un poing d'air au-dessus de la tête, objectif à hauteur d'yeux, produit entre toi et la lumière, mise au point verrouillée.","kind":"checklist","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0638da66-7a0e-4d07-a363-a9da5691b476'::uuid, m.id, m.course_id, m.org_id, 'jouer-face-camera', $sq$Jouer face caméra : voix, rythme, regard$sq$, $sq$Douze prises ratées ne viennent presque jamais du charisme mais de quatre défauts techniques. Ne jamais mémoriser mot à mot, l'échauffement de trois minutes, la règle des trois prises à variable changée, et la technique gratuite qui change tout.$sq$, $sq$## L'accroche

Une créatrice tourne douze prises et n'en garde aucune. Elle se trouve « fausse », « raide », « pas naturelle ». Le problème n'est presque jamais le charisme : c'est un mélange de quatre défauts techniques, tous corrigeables en une séance. Le regard qui part chercher le texte. Le débit qui ralentit à mesure qu'on se concentre. Les épaules qui montent. Et surtout, la mémorisation mot à mot, qui transforme n'importe qui en récitante. Parler face caméra est une compétence mécanique, pas un don. Cette leçon donne les réglages, l'échauffement de trois minutes, et la méthode qui fait passer de douze prises à trois.

## Le contenu

### Ne mémorise jamais mot à mot

C'est la cause numéro un de l'effet « récité ». Un texte appris par cœur produit un regard qui se déplace vers le haut, un débit régulier et sans relief, et une panique à la moindre hésitation.

La méthode qui fonctionne : **mémorise les idées, dans l'ordre, pas les mots.**

Trois ou quatre points suffisent : « six packs par mois → montés à pied → goût de piscine → le filtre → deux mois sans acheter ». Les mots viennent d'eux-mêmes, différents à chaque prise, et c'est exactement ce qui donne le naturel.

Seule exception : **la première phrase**, apprise mot pour mot. Elle décide de la rétention et arrive au moment où tu es la moins installée.

### Les quatre réglages du corps

**Le regard.** Sur l'objectif, pas sur l'écran. Un point de couleur collé juste à côté aide les premières semaines. C'est le geste qui change le plus une vidéo : le spectateur sent immédiatement si tu le regardes.

**Le débit.** Environ 15 % plus rapide que ta conversation normale. Le débit naturel paraît mou à l'écran ; à l'inverse, au-delà de 20 % plus rapide, ça sonne pressé.

**Les épaules.** Basses. Elles montent sous l'effet du stress et raidissent toute la posture. Une expiration complète avant chaque prise suffit à les redescendre.

**Le menton.** Parallèle au sol. Relevé, il donne un air condescendant ; baissé, un air d'excuse.

### L'échauffement de trois minutes

Il paraît ridicule et il divise le nombre de prises par deux.

**Une minute d'articulation.** Lis ton script à voix haute, exagérément articulé, presque caricatural. Puis relis-le normalement : l'articulation reste, la caricature part.

**Une minute de souffle.** Trois respirations complètes, expiration deux fois plus longue que l'inspiration. Le débit se stabilise et la voix descend.

**Une minute de prise blanche.** Filme une prise que tu ne garderas pas, exprès. Elle absorbe la raideur du démarrage, qui autrement se retrouve dans la prise 1.

### Le rythme des prises

**Trois prises maximum par plan**, et **change une variable à chaque fois**.

Prise 1 : comme prévu.
Prise 2 : plus rapide, plus d'énergie.
Prise 3 : plus posée, en appuyant sur un mot différent.

Douze prises identiques ne produisent aucun progrès ; trois prises différentes donnent trois options au montage. Si aucune ne convient après trois, le problème est dans le texte, pas dans ton jeu — réécris la phrase.

### Les cinq défauts de voix les plus courants

**La fin de phrase qui monte.** Transforme les affirmations en questions et supprime toute assurance. Baisse la voix sur les trois derniers mots.

**Le débit qui ralentit.** Il s'installe à mesure que tu te concentres. Le remède est l'échauffement, pas la volonté.

**Le sourire permanent.** Lu comme commercial. Souris quand il y a une raison.

**Les hésitations en début de phrase.** « Alors, du coup, en fait… » Elles se coupent mal au montage. Prends une seconde de silence avant d'attaquer : le silence se coupe, l'hésitation non.

**Le ton présentateur.** Sur-articulé, appuyé, désincarné. Parle comme à quelqu'un qui est dans la pièce.

### La technique du « à qui je parle »

Avant chaque prise, choisis une personne réelle à qui tu t'adresses — une amie précise, ta sœur, une cliente que tu as en tête. Pas « les gens ».

Cette seule décision change le débit, le vocabulaire et le regard, sans aucun effort conscient. C'est la technique la plus efficace de cette leçon et elle ne coûte rien.

## Exemple appliqué

Nora fait douze prises par vidéo et en garde rarement une.

**Ce qu'elle change, sur une session :**

Elle arrête d'apprendre le texte. Elle écrit cinq mots-clés sur un papier posé sous l'objectif : « 240 € — plaques — quatre jours — texture — lien ».

Elle apprend uniquement sa première phrase : « J'ai dépensé 240 € en crèmes avant de comprendre un truc. »

Elle colle une gommette orange au-dessus de l'objectif.

Elle fait l'échauffement de trois minutes, prise blanche comprise.

Elle décide à qui elle parle : sa collègue Manon, qui a le même problème de peau.

**Résultat sur la première vidéo** : prise 1 correcte, prise 2 meilleure, prise 3 inutile. Elle garde la 2.

**Sur les six vidéos de la session** : dix-neuf prises au total, soit 3,2 par vidéo au lieu de 12. Le tournage passe de 3 h 40 à 1 h 15.

**Effet secondaire** : le montage est deux fois plus rapide, parce qu'elle n'a plus douze fichiers à comparer.

**Ce qu'elle remarque en se revoyant** : les prises sont toutes légèrement différentes dans les mots, et c'est précisément ce qui les rend crédibles. Sa version apprise par cœur était identique à chaque fois — et identiquement fausse.

## Les erreurs fréquentes

Apprendre le texte mot à mot. C'est la cause principale de l'effet récité.

Regarder l'écran plutôt que l'objectif. Le spectateur sent le décalage sans savoir le nommer.

Enchaîner douze prises identiques. Sans changer de variable, il n'y a aucun progrès possible.

Sauter l'échauffement. La raideur des trois premières minutes se retrouve dans les prises gardées.

Parler « aux gens ». Choisis une personne réelle : tout change sans effort.

Attaquer une phrase par une hésitation. Une seconde de silence se coupe, un « euh » non.

Monter la voix en fin de phrase. Chaque affirmation devient une question, et l'assurance disparaît.

## Action immédiate

Aujourd'hui, filme une vidéo en appliquant trois choses : cinq mots-clés au lieu du texte, la première phrase apprise par cœur, et une personne réelle à qui tu parles. Fais trois prises en changeant une variable à chaque fois. Compare avec ta manière habituelle : la différence de naturel est visible dès la première tentative, et le gain de temps l'est encore plus.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Parler face caméra","description":"Les quatre réglages du corps, l'échauffement de trois minutes, le rythme des prises, le tableau des cinq défauts de voix et la technique du « à qui je parle ».","kind":"document","url":null,"body":"## Parler face caméra\n\n### La règle numéro un\n\n**Ne mémorise jamais mot à mot.** C'est la cause principale de l'effet\n« récité » : regard qui part vers le haut, débit plat, panique à l'hésitation.\n\nMémorise **les idées, dans l'ordre**. Trois ou quatre mots-clés suffisent.\n\n**Seule exception : la première phrase**, apprise par cœur. Elle décide de la\nrétention et arrive quand tu es la moins installée.\n\n### Les quatre réglages du corps\n\n| Réglage | Consigne | Aide |\n|---|---|---|\n| Regard | Sur l'**objectif**, pas l'écran | Gommette collée à côté |\n| Débit | ≈ +15 % de ta conversation | Au-delà de +20 %, ça sonne pressé |\n| Épaules | Basses | Une expiration complète avant chaque prise |\n| Menton | Parallèle au sol | Relevé = condescendant, baissé = excuse |\n\n### L'échauffement de trois minutes\n\n1. **Articulation** — lire le script exagérément articulé, puis normalement\n2. **Souffle** — trois respirations, expiration deux fois plus longue\n3. **Prise blanche** — une prise qu'on ne gardera pas, exprès\n\nIl paraît ridicule et divise le nombre de prises par deux.\n\n### Le rythme des prises\n\n**Trois maximum par plan, une variable changée à chaque fois.**\n\n| Prise | Variation |\n|---|---|\n| 1 | Comme prévu |\n| 2 | Plus rapide, plus d'énergie |\n| 3 | Plus posée, en appuyant sur un autre mot |\n\nSi aucune ne convient après trois, **le problème est dans le texte** — réécris\nla phrase.\n\n### Les cinq défauts de voix\n\n| Défaut | Effet | Remède |\n|---|---|---|\n| Fin de phrase qui monte | Affirmation → question | Baisser la voix sur les 3 derniers mots |\n| Débit qui ralentit | Mollesse | L'échauffement, pas la volonté |\n| Sourire permanent | Lu comme commercial | Sourire quand il y a une raison |\n| Hésitation d'attaque | Coupe impossible au montage | **Une seconde de silence** avant d'attaquer |\n| Ton présentateur | Désincarné | Parler comme à quelqu'un dans la pièce |\n\n### La technique la plus efficace, et gratuite\n\nAvant chaque prise, choisis **une personne réelle** à qui tu parles — une amie\nprécise, pas « les gens ». Le débit, le vocabulaire et le regard changent sans\naucun effort conscient.\n"},{"title":"Checklist d'avant-prise","description":"Expirer, épaules basses, regard sur l'objectif, première phrase sue par cœur, une personne réelle choisie. Dix secondes.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '8283e5da-65f5-41d5-a3de-8ed25f22600b'::uuid, m.id, m.course_id, m.org_id, 'les-hooks', $sq$Les hooks : filmer trois ouvertures pour la même vidéo$sq$, $sq$Changer les trois premières secondes coûte cent fois moins cher qu'une nouvelle vidéo et relance souvent les performances. Les six angles à décliner, la méthode de tournage en six minutes, les trois conditions de raccord et la façon de les facturer.$sq$, $sq$## L'accroche

Une marque diffuse ta vidéo. Au bout de dix jours, le coût par achat commence à monter — la créa se fatigue. Elle a deux options : commander une nouvelle vidéo, ou changer les trois premières secondes de celle qui existe. La seconde coûte cent fois moins cher, se met en ligne en une heure, et relance souvent les performances pour deux semaines. C'est pour ça que les marques structurées demandent systématiquement des **hooks alternatifs** — et pour ça que les créatrices qui les proposent d'elles-mêmes sont rappelées. Filmer trois ouvertures différentes pour la même vidéo coûte six minutes de tournage. Cette leçon explique comment, et pourquoi c'est le meilleur supplément à facturer du métier.

## Le contenu

### Ce qu'est un hook alternatif

Une variante des trois à cinq premières secondes d'une vidéo, tournée dans les mêmes conditions, et interchangeable au montage.

La marque obtient trois vidéos différentes du point de vue de l'algorithme, avec un seul corps de vidéo. Elle peut les tester en parallèle et garder la meilleure.

### Pourquoi ça marche

L'ouverture décide de la rétention à trois secondes, qui décide du coût de diffusion. Deux hooks différents sur le même corps de vidéo peuvent produire des écarts de performance considérables.

Et surtout : la **fatigue créative** touche d'abord l'accroche. Un public qui a déjà vu le début n'ira pas plus loin, même si la suite l'intéresserait.

### Les six angles d'accroche à décliner

Pour un même produit, tourne trois hooks parmi ces six angles :

**Le problème.** « Je me réveillais à trois heures toutes les nuits. »
**Le résultat.** « Trois semaines, et plus une seule nuit coupée. »
**L'objection.** « J'étais persuadée que c'était du marketing. »
**Le chiffre.** « J'ai testé quatre marques avant celle-là. »
**La question.** « Tu dors mal depuis combien de temps, toi ? »
**Le contre-pied.** « N'achète pas ça si tu dors déjà bien. »

Ces six angles couvrent la quasi-totalité des cas, tous secteurs confondus. Choisis-en trois éloignés les uns des autres : un problème, un chiffre et un contre-pied donnent trois tests réellement différents, là que trois variantes du même problème testent la même chose.

### Comment les tourner

Le point technique qui rend tout simple : **les hooks se tournent à la suite, dans le même cadre, la même tenue, la même lumière**. Tu ne bouges rien.

Tu filmes le hook 1, tu marques une pause de deux secondes, tu enchaînes le hook 2, pause, le hook 3. Trois fichiers ou un seul, peu importe : au montage, tu couperas.

**Six minutes** pour trois hooks, échauffement compris. C'est le meilleur rapport temps/valeur de tout le métier.

### La règle de raccord

Un hook alternatif doit se raccorder au corps de la vidéo sans qu'on voie la coupe. Trois conditions :

**Même position.** Reste à la même distance, sur ta marque au sol.
**Même tenue et même coiffure.** Évidemment — d'où l'intérêt de les tourner à la suite.
**Même niveau d'énergie à la fin du hook.** Si le hook 1 finit calme et que le corps démarre calme, le hook 3 ne doit pas finir surexcité.

### Comment les facturer

Deux façons, les deux valables.

**Inclus dans un pack**, comme argument de vente : « 6 vidéos + 3 hooks alternatifs ». Cela justifie un pack plus cher et se vend très bien.

**En supplément** : 25 à 40 € par hook. Sur une commande de quatre vidéos avec deux hooks chacune, cela représente 200 à 320 € pour environ vingt minutes de tournage.

Dans les deux cas, **propose-les**. La plupart des marques ne savent pas qu'elles peuvent en demander, et celles qui le savent trouvent rarement des créatrices qui les proposent spontanément.

### Le hook comme produit à part

Certaines marques finissent par commander uniquement des hooks, sur des vidéos existantes : « on a une créa qui marche, on veut cinq nouvelles ouvertures ». C'est une commande très rentable — pas de script complet, pas de démonstration, pas de plan produit — et elle n'existe que si tu as expliqué le principe une fois.

## Exemple appliqué

Alice livre quatre vidéos à une marque de matelas. Elle propose spontanément trois hooks alternatifs sur chacune, facturés 30 € l'unité : + 360 €.

**Sur la vidéo principale**, les trois hooks qu'elle tourne :

1. **Problème** — « Je me réveillais avec mal au dos tous les matins depuis deux ans. »
2. **Contre-pied** — « N'achète pas ce matelas si tu dors bien. Sérieusement. »
3. **Chiffre** — « 890 €. C'est ce que j'ai mis dans un matelas, et je vais te dire si je regrette. »

Elle les tourne à la suite, en huit minutes, sans rien changer au cadre.

**Ce que fait la marque** : elle diffuse les trois versions en parallèle pendant six jours.

**Les résultats** : le contre-pied obtient une rétention à trois secondes nettement supérieure aux deux autres. Le chiffre arrive deuxième. Le problème, qui était le hook prévu au brief, arrive dernier.

**La suite** : la marque coupe les deux autres, met tout le budget sur le contre-pied, et commande à Alice **six hooks supplémentaires** sur la même vidéo — 180 € pour quinze minutes de tournage.

**Trois mois plus tard**, la marque est en abonnement, et le brief mensuel inclut systématiquement « 3 hooks par vidéo ».

Le hook prévu au brief était le moins bon des trois. Sans les alternatives, la vidéo aurait été jugée médiocre — et Alice avec elle.

## Les erreurs fréquentes

Ne pas en proposer. La plupart des marques ne savent pas qu'elles peuvent en demander.

Tourner les hooks à un autre moment. Tenue, coiffure et lumière changent, et le raccord devient visible.

Faire trois variantes du même angle. Trois formulations du problème testent la même chose ; il faut trois angles éloignés.

Les inclure gratuitement sans le dire. C'est un supplément réel, et l'offrir en silence n'apporte aucune reconnaissance.

Oublier le raccord d'énergie. Un hook survolté suivi d'un corps calme se voit immédiatement.

Croire que le hook du brief est le meilleur. Il est simplement le premier auquel le client a pensé.

## Action immédiate

Sur ta prochaine vidéo, tourne trois hooks au lieu d'un, en choisissant trois angles éloignés parmi les six. Ça te coûtera six minutes. Puis propose-les au client, même si le devis ne les prévoyait pas — offre-les cette fois-ci, en expliquant ce qu'ils permettent. C'est la meilleure démonstration commerciale du métier, et elle transforme régulièrement une commande unique en abonnement.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les hooks alternatifs","description":"Les six angles avec exemples, la méthode de tournage à la suite, les trois conditions de raccord, les deux façons de les facturer et la commande de hooks seuls.","kind":"document","url":null,"body":"## Les hooks alternatifs\n\nUne variante des 3 à 5 premières secondes, interchangeable au montage.\n**Six minutes de tournage, le meilleur rapport temps/valeur du métier.**\n\n### Pourquoi ça marche\n\nL'ouverture décide de la rétention à 3 secondes, qui décide du coût de\ndiffusion. Et la **fatigue créative touche d'abord l'accroche** : un public qui\na déjà vu le début n'ira pas plus loin.\n\n### Les six angles à décliner\n\n| Angle | Exemple |\n|---|---|\n| Problème | « Je me réveillais à trois heures toutes les nuits. » |\n| Résultat | « Trois semaines, et plus une seule nuit coupée. » |\n| Objection | « J'étais persuadée que c'était du marketing. » |\n| Chiffre | « J'ai testé quatre marques avant celle-là. » |\n| Question | « Tu dors mal depuis combien de temps, toi ? » |\n| Contre-pied | « N'achète pas ça si tu dors déjà bien. » |\n\n**Choisis trois angles éloignés.** Trois variantes du même problème testent la\nmême chose.\n\n### Comment les tourner\n\nÀ la suite, **sans rien bouger** : même cadre, même tenue, même lumière.\nHook 1 → pause 2 s → hook 2 → pause 2 s → hook 3.\n\n### Les trois conditions de raccord\n\n1. Même position (reste sur ta marque au sol)\n2. Même tenue et même coiffure\n3. **Même niveau d'énergie en fin de hook** que le début du corps\n\n### Comment les facturer\n\n| Formule | Montant |\n|---|---|\n| Inclus dans un pack, comme argument | Justifie un pack plus cher |\n| En supplément | 25 à 40 € par hook |\n\nSur 4 vidéos × 2 hooks : **200 à 320 € pour vingt minutes de tournage**.\n\n**Propose-les.** La plupart des marques ne savent pas qu'elles peuvent en\ndemander.\n\n### Le hook comme commande à part\n\n« On a une créa qui marche, on veut cinq nouvelles ouvertures » : pas de\nscript complet, pas de démonstration, pas de plan produit. Très rentable — et\ncette commande n'existe que si tu as expliqué le principe une fois.\n"},{"title":"TikTok Creative Center","description":"Les publicités les plus performantes par secteur, avec leurs accroches. La meilleure source pour observer ce qui retient en trois secondes.","kind":"tool","url":"https://ads.tiktok.com/business/creativecenter"}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '55f4f229-31a0-449a-9c2c-ea3b6b49c6ed'::uuid, m.id, m.course_id, m.org_id, 'filmer-le-produit', $sq$Filmer le produit : gestes, textures, macro$sq$, $sq$Le plan que les débutantes bâclent et que le client regarde image par image. Les quatre gestes, la règle de la transformation plutôt que de l'état, le réglage macro, les cinq erreurs qui font refuser un plan et les trois surfaces à moins de vingt euros.$sq$, $sq$## L'accroche

Le plan produit est celui que toutes les créatrices débutantes bâclent, et c'est pourtant le seul que la marque regarde image par image. Une crème qui brille mal, un flacon avec une trace de doigt, une étiquette de travers, un fond qui vole l'attention : ces détails ne se voient pas au tournage sur un petit écran, et ils sautent aux yeux du client qui connaît son produit par cœur. À l'inverse, un plan macro réussi — une texture qui s'étale, une vapeur qui monte, une matière qu'on devine — donne à une vidéo tournée au téléphone une valeur perçue qui dépasse largement son coût de production. Cette leçon donne les gestes, les réglages et les erreurs à ne pas commettre.

## Le contenu

### Les quatre gestes qui font un bon plan produit

**Tenir sans cacher.** Trois doigts au maximum sur l'objet, sur sa partie la moins informative. L'étiquette et le bouchon restent visibles. Une main qui enveloppe le produit le fait disparaître.

**Bouger lentement.** Un mouvement de main deux fois plus lent qu'en vrai paraît normal à l'écran et reste net. À vitesse naturelle, il devient flou.

**Poser franchement.** Pour un produit posé, laisse une seconde d'immobilité avant et après le geste : c'est ce qui donne des points de coupe propres au montage.

**Orienter vers la lumière.** Le produit se place **entre** toi et la source. À contre-jour, il devient une silhouette ; face à la lumière, il est lisible.

### La texture, plan par plan

Le plan macro qui fonctionne montre une **transformation**, pas un état.

Une crème qui s'étale, pas une crème posée. Une poudre qui tombe, pas un tas. Une vapeur qui monte, pas une tasse pleine. Un tissu qu'on froisse, pas un tissu à plat.

Le mouvement est ce qui fait durer le plan : trois à cinq secondes d'une texture qui bouge se regardent ; trois secondes d'un objet immobile font glisser le pouce.

### Le réglage macro

**La distance.** Approche jusqu'à ce que l'image devienne floue, puis recule de dix centimètres. La plupart des téléphones font le point à partir de dix à quinze centimètres ; les modèles récents ont un mode macro qui s'active seul.

**La mise au point verrouillée.** Appui long sur la zone à garder nette. En macro, la profondeur de champ est très faible : un centimètre de dérive rend le plan inutilisable.

**La stabilité.** Le trépied est obligatoire ici. À main levée, le tremblement est amplifié par la proximité.

**La lumière rasante.** C'est le seul plan où une source de côté, presque à ras, vaut mieux qu'une lumière frontale : elle révèle le relief, le grain, la matière.

### Les erreurs qui font refuser un plan produit

**La trace de doigt.** Invisible au tournage, évidente en macro. Nettoie avant chaque prise, pas seulement avant la session.

**L'étiquette de travers ou masquée.** La marque veut son produit reconnaissable.

**Le reflet parasite.** Sur un flacon brillant, ta fenêtre ou ton visage se reflètent. Change légèrement l'angle jusqu'à ce que le reflet sorte du cadre.

**Le fond chargé.** Le produit doit être l'élément le plus contrasté du cadre. Un plan de travail encombré le noie.

**Le produit hors sujet.** Le mauvais parfum, la mauvaise teinte, l'ancien packaging. Vérifie la référence exacte avec le brief : c'est une cause fréquente de reprise complète.

### Les surfaces qui marchent

Trois suffisent, et elles coûtent moins de vingt euros au total.

**Le bois clair.** Chaleureux, neutre, valorise presque tout. Une planche à découper suffit.

**Le lin ou le coton froissé.** Donne de la matière et un rendu haut de gamme. Un torchon uni fait l'affaire.

**Le fond uni mat.** Une feuille de papier épais, en blanc cassé, gris ou terracotta. Le mat est important : le brillant renvoie des reflets.

À éviter : le marbre — vu partout, il date une vidéo — et le verre, qui multiplie les reflets.

### Le plan d'action

C'est le cousin du plan produit et le plus convaincant des deux : il prouve l'usage.

Deux règles. **Filme le geste en entier**, du début à la fin — un geste coupé paraît truqué. Et **cadre les mains et le produit seulement** : le visage dans un plan d'action divise l'attention.

## Exemple appliqué

Sofia doit filmer un sérum pour le visage, flacon en verre ambré avec pipette.

**Ce qu'elle prépare** : le flacon nettoyé au chiffon microfibre, l'étiquette repérée pour être face caméra, une planche de bois clair, un torchon en lin beige, et son trépied abaissé.

**Le plan produit (2 min).** Flacon posé sur le bois, trois quarts, étiquette lisible. Elle décale de dix centimètres : le reflet de la fenêtre sur le verre disparaît. Une seconde d'immobilité, sa main entre dans le cadre, prend le flacon, sort. Une seconde d'immobilité.

**Le plan macro de texture (5 min).** Elle dépose trois gouttes sur le dos de sa main. Trépied à quinze centimètres, mise au point verrouillée sur les gouttes, lumière de côté quasi rasante. Elle filme l'étalement, lentement, pendant six secondes. Le sérum accroche la lumière et devient visiblement soyeux — le plan qui fera toute la valeur de la vidéo.

**Le plan d'action (3 min).** Ses mains seulement : la pipette qu'on sort, la goutte qui tombe, l'application. Geste complet, sans coupe.

**Ce qu'elle vérifie avant de ranger** : elle regarde les trois plans à taille réelle sur son téléphone. Le plan produit a une micro-trace de doigt sur le verre, visible seulement en grand. Elle nettoie et refait la prise : deux minutes.

**Le retour du client** : « le plan de la texture est exactement ce qu'on cherchait, on peut l'utiliser aussi sur notre fiche produit ? ». Extension de support facturée 240 €.

## Les erreurs fréquentes

Filmer le produit sans le nettoyer. La trace de doigt est invisible au tournage et évidente à l'écran.

Montrer un état plutôt qu'une transformation. Un objet immobile ne retient pas ; une matière qui bouge, si.

Filmer en macro à main levée. Le tremblement est amplifié par la proximité.

Oublier de verrouiller la mise au point. Un centimètre de dérive rend un plan macro inutilisable.

Envelopper le produit dans sa main. Trois doigts maximum, sur la partie la moins informative.

Utiliser un fond chargé ou brillant. Le produit doit être l'élément le plus contrasté du cadre.

Ne pas vérifier la référence exacte. Le mauvais parfum ou l'ancien packaging fait refaire toute la vidéo.

## Action immédiate

Prends un produit chez toi et filme trois plans : un plan produit posé, un macro de texture en mouvement, un plan d'action complet. Regarde-les à taille réelle sur ton téléphone et cherche les traces de doigts, les reflets et les zones floues. Refais-les avec les corrections. Vingt minutes, et tu auras le niveau de plan produit qui distingue une créatrice payée 250 € d'une créatrice payée 120 €.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Filmer le produit","description":"Les quatre gestes, le tableau transformation contre état, le réglage macro, les cinq erreurs rédhibitoires et les trois surfaces qui valorisent tout.","kind":"document","url":null,"body":"## Filmer le produit\n\n### Les quatre gestes\n\n| Geste | Règle |\n|---|---|\n| Tenir | **Trois doigts maximum**, sur la partie la moins informative |\n| Bouger | Deux fois plus lentement qu'en vrai |\n| Poser | Une seconde d'immobilité avant et après — points de coupe propres |\n| Orienter | Le produit **entre** toi et la lumière |\n\n### La texture : montrer une transformation, pas un état\n\n| Ce qui marche | Ce qui ne marche pas |\n|---|---|\n| Une crème qui s'étale | Une crème posée |\n| Une poudre qui tombe | Un tas de poudre |\n| Une vapeur qui monte | Une tasse pleine |\n| Un tissu qu'on froisse | Un tissu à plat |\n\nTrois à cinq secondes d'une matière qui bouge se regardent. Trois secondes\nd'un objet immobile font glisser le pouce.\n\n### Le réglage macro\n\n- **Distance** : approche jusqu'au flou, puis recule de 10 cm\n- **Mise au point verrouillée** : en macro, 1 cm de dérive rend le plan inutilisable\n- **Trépied obligatoire** : le tremblement est amplifié par la proximité\n- **Lumière rasante** : le seul plan où une source presque à ras vaut mieux que le frontal\n\n### Les cinq erreurs qui font refuser un plan\n\n| Erreur | Pourquoi c'est grave |\n|---|---|\n| Trace de doigt | Invisible au tournage, évidente en macro |\n| Étiquette de travers ou masquée | La marque veut son produit reconnaissable |\n| Reflet parasite | Ta fenêtre ou ton visage sur un flacon brillant |\n| Fond chargé | Le produit doit être l'élément le plus contrasté |\n| **Mauvaise référence** | Mauvais parfum, ancien packaging → **tout à refaire** |\n\n### Les trois surfaces qui marchent — moins de 20 €\n\n**Bois clair** (une planche à découper) · **lin ou coton froissé** (un torchon\nuni) · **fond uni mat** (papier épais blanc cassé, gris ou terracotta).\n\nÀ éviter : le **marbre** (vu partout, date la vidéo) et le **verre** (multiplie\nles reflets).\n\n### Le plan d'action\n\n**Filme le geste en entier** — un geste coupé paraît truqué.\n**Cadre les mains et le produit seulement** — le visage divise l'attention.\n"},{"title":"Checklist du plan produit","description":"Nettoyé, étiquette face caméra, protections retirées, reflet vérifié, référence conforme au brief.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'cf046254-b522-4718-bba9-6e21ff44e38c'::uuid, m.id, m.course_id, m.org_id, 'le-b-roll', $sq$Le B-roll qui sauve un montage$sq$, $sq$Sans B-roll, aucune marge : toute erreur impose un re-tournage. Les quatre fonctions techniques, la règle du double, les huit plans à filmer systématiquement — dont les deux qu'on oublie et qui sauvent le plus de montages.$sq$, $sq$## L'accroche

Le B-roll est ce qui sépare un montage confortable d'un montage impossible. C'est l'ensemble des plans qui ne portent pas la parole : le produit sur la table, les mains qui s'activent, la fenêtre, le pas dans le couloir, la tasse qu'on repose. Une créatrice qui rentre avec seulement ses plans parlés a exactement autant de matière que de texte — donc aucune marge. Si une phrase est ratée, elle doit la refaire. Si le rythme traîne, elle ne peut rien couper. Avec quinze secondes de B-roll de plus, elle peut masquer une coupe, accélérer un passage mou, et illustrer sans re-tourner. Cinq minutes de plus au tournage, une demi-heure de gagnée au montage. Cette leçon dit quoi filmer, et combien.

## Le contenu

### À quoi sert vraiment le B-roll

Quatre fonctions, toutes techniques.

**Masquer une coupe.** Deux phrases prises séparément se raccordent mal : entre les deux, un plan de mains résout tout, sans saut visible.

**Accélérer un passage.** Un morceau de texte trop long se raccourcit en gardant la voix et en couvrant l'image par un B-roll.

**Illustrer sans re-tourner.** « Je le mets dans mon sac tous les matins » se montre au lieu de se dire.

**Sauver une prise.** Quand une seule phrase est ratée dans une bonne prise, le B-roll permet de recoller une autre version sans que le raccord se voie.

### La règle du double

**Filme au moins autant de secondes de B-roll que de secondes de vidéo finale.** Pour une vidéo de trente secondes, trente secondes de B-roll. Cela paraît beaucoup ; c'est le minimum confortable.

En pratique, cela représente cinq à six plans de cinq secondes chacun, soit quatre à six minutes de tournage supplémentaires.

### Les huit B-rolls qui servent toujours

Une liste à filmer systématiquement, quel que soit le produit :

1. **Le produit posé**, dans son environnement d'usage.
2. **La main qui le prend** ou le repose.
3. **Un détail macro** de la texture ou de la matière.
4. **L'ouverture** — bouchon, couvercle, emballage.
5. **Le geste d'usage**, en entier.
6. **Le résultat** ou l'état après.
7. **Un plan d'ambiance serré** du lieu : le coin de la table, la fenêtre, une plante à côté du produit.
8. **Toi en train de faire autre chose** — boire, ranger, écrire — sans parler.

Les deux derniers sont ceux qu'on oublie et ceux qui sauvent le plus de montages, parce qu'ils s'insèrent n'importe où.

### Les règles de tournage

**Sans parler.** Un B-roll avec du son de parole ne peut pas être posé sous une voix off.

**Plus long que nécessaire.** Cinq secondes minimum par plan, même si tu n'en utiliseras qu'une seconde et demie. Un plan trop court est inutilisable ; un plan trop long ne coûte rien.

**Stable.** Trépied ou appui. Un B-roll tremblant attire l'attention sur lui-même, ce qui est exactement l'inverse de sa fonction.

**Dans la même lumière.** Un B-roll tourné à une autre heure ne se raccorde pas.

### Le mouvement, avec parcimonie

Un léger mouvement — un panoramique lent, un rapprochement doux — donne de la vie. Mais il doit être **très** lent, deux fois plus lent que ce qui paraît naturel, et effectué avec les deux mains ou en faisant glisser le téléphone sur une surface.

Un mouvement rapide ou saccadé est pire que pas de mouvement du tout.

### L'organisation

Tourne tous les B-rolls **à la fin de la session**, en un seul bloc. Tu n'as plus besoin d'être coiffée ni en tenue pour les plans de mains et de produits, et le trépied est déjà réglé.

Nomme-les immédiatement au moment du transfert : `broll-01-produit-pose`, `broll-02-main-prend`. Chercher un plan dans quarante fichiers nommés `IMG_4831` est ce qui rend le montage pénible.

## Exemple appliqué

Manon tourne trois vidéos pour une marque de café moulu. Elle prévoit dix minutes de B-roll à la fin.

**Ce qu'elle filme, sans parler, tout d'un bloc :**

1. Le paquet posé sur le plan de travail, à côté d'une tasse — 6 s
2. Sa main qui ouvre le paquet, geste complet — 7 s
3. Macro de la mouture qui tombe dans le filtre — 6 s
4. La vapeur qui monte de la tasse — 8 s
5. L'eau versée, en mouvement lent — 6 s
6. Sa main qui repose la tasse — 5 s
7. Plan serré de la fenêtre avec la tasse au premier plan — 6 s
8. Elle, de dos, qui range le paquet dans le placard — 6 s

Cinquante secondes de B-roll, dix minutes de tournage.

**Au montage :**

- Sur la vidéo 1, elle bute sur un raccord entre deux phrases : le plan 2 (l'ouverture) couvre la coupe. Problème résolu en dix secondes.
- Sur la vidéo 2, une phrase du milieu est trop longue : elle garde la voix et couvre par les plans 3 et 5. Elle gagne quatre secondes sans re-tourner.
- Sur la vidéo 3, sa dernière phrase est bonne mais son visage est fatigué : elle la couvre par le plan 8 et la fin est meilleure qu'avec le plan d'origine.
- Le plan 4, la vapeur, sert d'ouverture à deux des trois vidéos.

**Sans B-roll**, elle aurait dû re-tourner deux phrases, soit une remise en place complète : au moins trente minutes.

Le client, lui, a écrit : « les plans de la vapeur et de la mouture sont superbes, on peut les récupérer pour nos stories ? ». Extension facturée.

## Les erreurs fréquentes

Ne pas en filmer. Sans B-roll, aucune marge au montage : toute erreur impose un re-tournage.

En filmer trop peu. Trente secondes de vidéo demandent au minimum trente secondes de B-roll.

Faire des plans trop courts. Cinq secondes minimum, même pour une utilisation d'une seconde.

Parler pendant le B-roll. Le plan devient inutilisable sous une voix off.

Bouger trop vite. Un mouvement saccadé attire l'attention au lieu de la détourner.

Les tourner en début de session. La fin est le bon moment : tenue et coiffure n'ont plus d'importance.

Ne pas les nommer. Chercher dans quarante fichiers `IMG_4831` est ce qui rend le montage détestable.

## Action immédiate

À ton prochain tournage, ajoute dix minutes à la fin et filme les huit B-rolls de la liste, cinq secondes minimum chacun, sans parler. Nomme-les au transfert. Au montage, tu constateras que les deux plans les plus utiles sont ceux que tu as failli ne pas filmer : le plan d'ambiance et le plan de toi faisant autre chose.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Le B-roll","description":"Les quatre fonctions, la règle du double, la liste des huit plans à cocher, les quatre règles de tournage et la convention de nommage.","kind":"document","url":null,"body":"## Le B-roll\n\n### Les quatre fonctions\n\n1. **Masquer une coupe** entre deux phrases prises séparément\n2. **Accélérer un passage** en gardant la voix et en couvrant l'image\n3. **Illustrer sans re-tourner**\n4. **Sauver une prise** dont une seule phrase est ratée\n\n### La règle du double\n\n**Au moins autant de secondes de B-roll que de secondes de vidéo finale.**\n30 s de vidéo = 30 s de B-roll = 5 à 6 plans de 5 s = 4 à 6 minutes de tournage.\n\n### Les huit B-rolls à filmer systématiquement\n\n1. [ ] Le produit posé, dans son environnement d'usage\n2. [ ] La main qui le prend ou le repose\n3. [ ] Un détail macro de la texture\n4. [ ] L'ouverture — bouchon, couvercle, emballage\n5. [ ] Le geste d'usage, en entier\n6. [ ] Le résultat ou l'état après\n7. [ ] **Un plan d'ambiance serré** du lieu\n8. [ ] **Toi en train de faire autre chose**, sans parler\n\nLes **deux derniers** sont ceux qu'on oublie et ceux qui sauvent le plus de\nmontages : ils s'insèrent n'importe où.\n\n### Les quatre règles de tournage\n\n| Règle | Pourquoi |\n|---|---|\n| **Sans parler** | Sinon inutilisable sous une voix off |\n| **5 secondes minimum** par plan | Un plan trop court est inutilisable ; trop long ne coûte rien |\n| **Stable** (trépied ou appui) | Un B-roll tremblant attire l'attention sur lui-même |\n| **Même lumière** | Une autre heure ne se raccorde pas |\n\n### Le mouvement\n\nDeux fois plus lent que ce qui paraît naturel, à deux mains ou en faisant\nglisser le téléphone sur une surface. **Un mouvement saccadé est pire que pas\nde mouvement.**\n\n### L'organisation\n\nTourne-les **à la fin de la session** : plus besoin d'être coiffée ni en\ntenue, le trépied est déjà réglé.\n\n**Nomme-les au transfert** : `broll-01-produit-pose`, `broll-02-main-prend`.\nChercher un plan dans quarante `IMG_4831` est ce qui rend le montage\ndétestable.\n"},{"title":"Checklist de nommage des fichiers","description":"Nommer au transfert, jamais plus tard : chercher un plan dans quarante fichiers IMG_4831 est ce qui rend le montage détestable.","kind":"checklist","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '12ebaa84-1b31-48c1-8383-85c6b6f5dd25'::uuid, m.id, m.course_id, m.org_id, 'la-journee-de-tournage', $sq$La journée de tournage : six vidéos en quatre heures$sq$, $sq$Le lot fait passer de 2 h 20 à 18 minutes par vidéo, parce que la mise en place et l'échauffement sont payés une fois au lieu de six. Le déroulé heure par heure, la règle des deux tenues, la fatigue vocale et le plafond de quatre heures.$sq$, $sq$## L'accroche

Une créatrice qui tourne une vidéo à la fois y passe environ deux heures vingt, mise en place comprise. La même créatrice qui tourne six vidéos dans une session y passe une heure cinquante — **au total**, soit dix-huit minutes par vidéo. Le facteur n'est pas la vitesse d'exécution : c'est que la mise en place, l'échauffement, le réglage de lumière et le rangement sont payés une seule fois au lieu de six. Le tournage en lots est la seule décision d'organisation qui change vraiment l'économie de ce métier, et c'est aussi celle qui rend possible l'abonnement mensuel. Cette leçon donne le déroulé complet d'une session de six vidéos en quatre heures, pauses comprises.

## Le contenu

### Pourquoi le lot change tout

Trois coûts fixes disparaissent.

**La mise en place** — 25 minutes, payée une fois au lieu de six.
**L'échauffement** — 10 minutes, y compris la raideur des premières prises.
**Le rangement et le transfert** — 20 minutes.

Soit environ 55 minutes économisées cinq fois : presque cinq heures sur une commande de six vidéos.

### La journée type : quatre heures pour six vidéos

**La veille au soir — 40 minutes.** Six scripts, six listes de plans, produits nettoyés, deux tenues sorties, décor vidé, batteries en charge.

**8 h 45 — mise en place (25 min).** Trépied sur ses marques, micro testé au casque, lumière vérifiée, checklist des huit points.

**9 h 10 — échauffement (10 min).** Articulation, souffle, prise blanche.

**9 h 20 — bloc 1 : les plans face caméra, tenue A (55 min).** Les trois premières vidéos, tous leurs plans parlés, hooks alternatifs compris. Trois prises par plan maximum.

**10 h 15 — pause (15 min).** Obligatoire. Sans elle, la fatigue vocale s'entend dès la quatrième vidéo.

**10 h 30 — changement de tenue (10 min).**

**10 h 40 — bloc 2 : les plans face caméra, tenue B (55 min).** Les trois dernières vidéos.

**11 h 35 — bloc 3 : les plans produit et macros (35 min).** Sans souci d'apparence, trépied abaissé, tous les produits à la suite.

**12 h 10 — bloc 4 : les B-rolls (15 min).** La liste des huit, sans parler.

**12 h 25 — transfert et nommage (15 min).**

**12 h 40 — fin.** Six vidéos tournées, quatre heures pleines.

### La règle des deux tenues

Six vidéos dans la même tenue se lisent comme une seule séance, et le client s'en aperçoit au moment de les diffuser séparément.

Deux tenues, changées à mi-parcours, suffisent à donner l'impression de deux tournages. Trois tenues n'apportent presque rien de plus et coûtent dix minutes.

Si tu tournes pour deux marques différentes dans la même session, une tenue par marque : c'est ce qui empêche une marque de reconnaître un tournage groupé.

### La fatigue vocale

Elle est réelle et elle s'entend. Après une heure de prises, la voix se fatigue, le débit ralentit, l'articulation se relâche.

Trois remèdes : une pause de quinze minutes toutes les heures, de l'eau à température ambiante — jamais glacée —, et l'ordre de tournage qui place les vidéos les plus exigeantes en premier.

Ne dépasse pas **quatre heures de tournage** dans une journée. Au-delà, la qualité baisse plus vite que le volume n'augmente.

### L'ordre des vidéos

Deux principes.

**Les plus difficiles d'abord.** La vidéo au texte le plus long, celle qui demande le plus d'émotion, celle dont l'angle est le moins évident.

**Les plus proches ensemble.** Deux vidéos qui partagent le même décor ou le même produit se tournent à la suite.

### Ce qu'on ne fait jamais dans une session en lot

**Répondre aux messages.** Le téléphone est en mode avion, et c'est aussi l'appareil de tournage.

**Regarder les prises entre chaque vidéo.** Tu regarderas au transfert. Se relire pendant une session casse le rythme et fait douter.

**Enchaîner un rendez-vous juste après.** La pression du temps s'entend dans les dernières prises, qui sont souvent les plus importantes.

**Tourner pour plus de deux marques.** Au-delà, les changements de décor et de tenue mangent le gain du lot.

## Exemple appliqué

Léna a un abonnement mensuel : huit vidéos par mois pour deux marques, une de compléments et une de cosmétique.

**Son organisation** : une seule session mensuelle, le premier samedi du mois.

**Vendredi soir, 40 minutes.** Huit scripts validés dans la semaine, huit listes de plans, huit produits nettoyés, deux tenues, décor préparé.

**Samedi 9 h à 13 h 15.**

- 9 h 00 à 9 h 30 : mise en place et échauffement.
- 9 h 30 à 10 h 25 : quatre vidéos compléments, tenue A, plans parlés et hooks.
- 10 h 25 à 10 h 40 : pause.
- 10 h 40 à 11 h 35 : quatre vidéos cosmétique, tenue B.
- 11 h 35 à 12 h 20 : tous les plans produit et macros des huit vidéos.
- 12 h 20 à 12 h 40 : B-rolls.
- 12 h 40 à 13 h 00 : transfert, nommage, sauvegarde.

**Son montage** : quatre sessions de deux heures réparties sur la semaine suivante, deux vidéos par session.

**Son chiffre** : 4 h 15 de tournage et 8 h de montage pour 1 800 € mensuels, soit environ 147 € de l'heure brut.

**Ce que ça change dans sa vie** : un samedi par mois consacré au tournage, quatre soirées de montage, et vingt-cinq jours libres pour prospecter, se former, ou ne rien faire.

**Ce qui a rendu ça possible** : le passage à l'abonnement. Huit vidéos réparties au fil de l'eau chez deux clients ponctuels lui auraient demandé huit mises en place.

## Les erreurs fréquentes

Tourner une vidéo à la fois. C'est le choix qui coûte le plus cher en heures dans tout le métier.

Sauter la pause. La fatigue vocale s'entend dès la quatrième vidéo.

Tourner plus de quatre heures. La qualité baisse plus vite que le volume n'augmente.

Garder la même tenue. Six vidéos identiques visuellement se lisent comme une seule séance.

Regarder les prises entre chaque vidéo. Ça casse le rythme et fait douter au milieu d'une session.

Prévoir un rendez-vous juste après. La pression du temps s'entend dans les dernières prises.

Tourner pour trois marques ou plus. Les changements mangent le gain du lot.

## Action immédiate

Bloque une demi-journée dans ton agenda pour ta prochaine session, avec l'intitulé « tournage » et rien après. Prépare six scripts, même pour des vidéos de portfolio si tu n'as pas six commandes. Suis le déroulé heure par heure. À la fin, note ton temps réel par vidéo : c'est le chiffre qui décidera de ta rentabilité horaire pour les deux prochaines années.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"La journée de tournage","description":"Le calcul du gain, le déroulé heure par heure de la veille au transfert, la règle des deux tenues, les remèdes à la fatigue vocale et ce qu'on ne fait jamais pendant une session.","kind":"document","url":null,"body":"## La journée de tournage : six vidéos en quatre heures\n\n### Pourquoi le lot change l'économie du métier\n\nTrois coûts fixes payés **une fois** au lieu de six :\nmise en place (25 min) · échauffement (10 min) · rangement et transfert (20 min).\n\n**≈ 55 minutes économisées cinq fois : près de cinq heures.**\n\n| | À l'unité | En lot de six |\n|---|---|---|\n| Temps par vidéo | 2 h 20 | **18 min** |\n\n### Le déroulé heure par heure\n\n| Heure | Étape | Durée |\n|---|---|---|\n| Veille, 21 h | Scripts, listes de plans, produits, tenues, batteries | 40 min |\n| 8 h 45 | Mise en place + checklist des huit points | 25 min |\n| 9 h 10 | Échauffement (articulation, souffle, prise blanche) | 10 min |\n| 9 h 20 | **Bloc 1** — plans parlés, vidéos 1 à 3, tenue A | 55 min |\n| 10 h 15 | **Pause obligatoire** | 15 min |\n| 10 h 30 | Changement de tenue | 10 min |\n| 10 h 40 | **Bloc 2** — plans parlés, vidéos 4 à 6, tenue B | 55 min |\n| 11 h 35 | **Bloc 3** — tous les plans produit et macros | 35 min |\n| 12 h 10 | **Bloc 4** — les huit B-rolls | 15 min |\n| 12 h 25 | Transfert et nommage | 15 min |\n\n### La règle des deux tenues\n\nSix vidéos dans la même tenue se lisent comme **une seule séance**, et le\nclient s'en aperçoit en les diffusant séparément.\n\nDeux tenues, changées à mi-parcours. Trois n'apportent presque rien.\nDeux marques dans la session ⇒ **une tenue par marque**.\n\n### La fatigue vocale\n\nRéelle, et elle s'entend. Trois remèdes : une pause de 15 minutes par heure ·\nde l'eau à température ambiante, **jamais glacée** · les vidéos les plus\nexigeantes en premier.\n\n**Plafond : quatre heures de tournage par jour.** Au-delà, la qualité baisse\nplus vite que le volume n'augmente.\n\n### L'ordre des vidéos\n\n1. Les plus difficiles d'abord (texte long, émotion, angle peu évident)\n2. Les plus proches ensemble (même décor, même produit)\n\n### Ce qu'on ne fait jamais dans une session\n\nRépondre aux messages (mode avion — c'est aussi l'appareil de tournage) ·\nregarder les prises entre chaque vidéo (casse le rythme, fait douter) ·\nenchaîner un rendez-vous après (la pression s'entend) · tourner pour plus de\ndeux marques.\n"},{"title":"Checklist de fin de session","description":"Transfert, nommage, sauvegarde sur un second support, et seulement ensuite le visionnage. Jamais pendant.","kind":"checklist","url":null}]$sq$::jsonb, 6, true
from academy_modules m
where m.id = '86c5f551-c72d-4499-8752-facc06f43009'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid, c.id, c.org_id, 'montage-livraison', $sq$Montage, son et livraison$sq$, $sq$Ce module ramène le montage à un squelette de sept étapes et vingt-cinq minutes, règle la question de la musique — le piège qui rend une vidéo inutilisable en publicité —, donne les réglages d'export exacts, transforme une commande en trente variantes facturées, et construit le message de livraison qui prépare la commande suivante.$sq$, 11, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '81df0250-1d10-4fd9-a5c2-4f264c16f692'::uuid, m.id, m.course_id, m.org_id, 'monter-sur-mobile', $sq$Monter sur mobile : le squelette d'une UGC$sq$, $sq$Le montage n'a qu'un travail : ne rien gâcher. Sept étapes dans un ordre fixe, les trois leviers du rythme, les cinq fonctions de CapCut qui servent vraiment, et le seuil au-delà duquel le problème vient du tournage.$sq$, $sq$## L'accroche

Le montage est l'étape où les créatrices perdent le plus de temps sans gagner en qualité. Deux heures passées sur une vidéo de trente secondes, à essayer des transitions, à chercher une musique, à recadrer image par image — pour un résultat qui ne performera pas mieux qu'un montage fait en vingt-cinq minutes selon un squelette fixe. Parce qu'une vidéo UGC ne se juge pas au montage : elle se juge à l'accroche, à la crédibilité et au rythme. Le montage n'a qu'un travail, ne rien gâcher. Cette leçon donne le squelette en sept étapes, l'ordre dans lequel les faire, et les fonctions de CapCut qui servent réellement.

## Le contenu

### Le squelette en sept étapes

Toujours dans cet ordre. Changer l'ordre est la cause principale des montages qui s'éternisent.

**1. Trier avant d'importer.** Regarde tes prises et note les bonnes. N'importe que celles-là. Importer quarante fichiers pour en garder huit alourdit tout le montage.

**2. Poser la structure.** Mets bout à bout les plans dans l'ordre du script, sans rien affiner. Tu dois voir la vidéo entière en une minute de travail.

**3. Serrer les coupes.** Retire les silences de début et de fin de chaque plan, les hésitations, les respirations longues. C'est l'étape qui fait le plus pour le rythme, et elle prend cinq minutes.

**4. Couvrir avec le B-roll.** Les raccords qui sautent, les passages mous, les moments où ton visage n'apporte rien.

**5. Ajouter les sous-titres.** Génération automatique, puis relecture complète. La relecture n'est pas optionnelle : les erreurs sur les noms de marque sont systématiques.

**6. Poser la musique.** Sous la voix, à volume bas. Sur les formats sans parole, plus présente.

**7. Vérifier et exporter.** La checklist finale, puis l'export aux formats demandés.

### Ce qui fait le rythme

Trois leviers, dans l'ordre d'efficacité.

**Les coupes serrées.** Retirer une demi-seconde de silence au début de chaque plan sur douze plans, c'est six secondes gagnées — un cinquième d'une vidéo de trente secondes.

**L'alternance des valeurs.** Elle a été prévue au tournage ; au montage, il s'agit juste de ne pas laisser deux plans identiques se suivre.

**La vitesse légèrement accélérée.** Un passage de démonstration à 1,2× ou 1,5× gagne du temps sans devenir ridicule. Ne touche jamais à la vitesse sur un plan parlé.

### Les fonctions de CapCut qui servent

Cinq, et pas une de plus.

**Découper** (la lame). L'outil principal, utilisé quatre-vingts fois par montage.

**Les sous-titres automatiques.** Génération puis correction. Choisis une police simple, blanche, avec un contour ou une ombre noire, en bas mais **au-dessus** de la zone d'interface — environ au quart inférieur.

**La vitesse.** Pour accélérer une démonstration.

**Le volume par piste.** Voix à 100 %, musique à 10-20 %.

**L'export.** 1080p, 30 fps, qualité haute.

Ce qui ne sert à rien : les transitions animées, les effets, les filtres de couleur poussés, les modèles préfabriqués, les stickers, les compte à rebours.

### Les sous-titres, en détail

Ils sont obligatoires : une part importante des vidéos est regardée sans son.

Quatre règles :

**Trois à cinq mots par ligne**, deux lignes maximum. Une phrase entière à l'écran ne se lit pas en une seconde et demie.

**Une police simple**, sans empattement, blanche, avec ombre ou contour noir. Les polices fantaisie sont illisibles en petit.

**Au quart inférieur**, jamais tout en bas — l'interface des plateformes recouvre les 15 % du bas.

**Relus intégralement.** La reconnaissance vocale se trompe systématiquement sur les noms de marque, les chiffres et les mots techniques. Une marque dont le nom est mal orthographié dans les sous-titres fait refaire la vidéo.

### La colorimétrie, en trente secondes

N'y passe pas plus. Trois réglages suffisent : luminosité si l'image est sombre, un léger contraste, un léger réchauffement si la lumière était froide.

Ne fais **jamais** de correction de teinte poussée : elle fausse la couleur du produit, et c'est un motif de refus fréquent.

### Le temps cible

**Vingt-cinq minutes par vidéo** une fois le squelette maîtrisé. Si tu dépasses quarante-cinq minutes régulièrement, le problème vient du tournage — pas assez de B-roll, trop de prises, plans mal cadrés — pas du montage.

## Exemple appliqué

Camille monte une vidéo de trente secondes pour une marque de granola.

**Tri (3 min).** Elle a 14 fichiers. Elle en garde 9 : trois plans parlés, quatre B-rolls, deux macros.

**Structure (2 min).** Elle pose les trois plans parlés bout à bout. La vidéo dure 41 secondes. Trop long.

**Coupes serrées (6 min).** Elle retire les silences d'attaque, une hésitation au milieu, et une phrase entière qui répétait la précédente. On tombe à 32 secondes.

**B-roll (4 min).** Elle couvre le raccord entre le plan 1 et le plan 2 avec le macro du granola qui tombe dans le bol. Elle couvre une phrase où son visage est figé par le plan du bol posé sur la table. Elle passe la démonstration à 1,3× : 29 secondes.

**Sous-titres (5 min).** Génération automatique, puis relecture. Trois corrections : le nom de la marque écrit phonétiquement, « 40 g » devenu « quarante grammes », et un « c'est » devenu « ces ».

**Musique (2 min).** Une piste calme de la bibliothèque, à 15 %.

**Vérification et export (3 min).** Checklist, export 9:16, puis export 1:1.

**Total : 25 minutes.**

Sa version précédente, sans squelette, lui avait pris une heure quarante — dont trente-cinq minutes à essayer des transitions qu'elle a finalement retirées.

## Les erreurs fréquentes

Importer toutes les prises. Le tri avant import fait gagner du temps sur toutes les étapes suivantes.

Affiner avant d'avoir posé la structure. On peaufine des plans qui finiront à la poubelle.

Utiliser des transitions animées. Elles datent une vidéo et signalent l'amateurisme.

Ne pas relire les sous-titres. La reconnaissance vocale se trompe systématiquement sur les noms de marque.

Mettre les sous-titres tout en bas. L'interface des plateformes les recouvre.

Pousser la colorimétrie. Une teinte de produit faussée est un motif de refus.

Accélérer un plan parlé. La voix devient immédiatement artificielle.

Passer plus de quarante-cinq minutes sur une vidéo. Le problème est en amont, au tournage.

## Action immédiate

Monte ta prochaine vidéo en suivant les sept étapes dans l'ordre, chronomètre en marche, et interdis-toi toute transition animée. Note ton temps. Puis compare-le à ton temps habituel : l'écart est en général de moitié, et la vidéo n'est pas moins bonne — souvent l'inverse, parce que les coupes serrées font plus pour le rythme que n'importe quel effet.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Le squelette de montage en sept étapes","description":"Le tableau des sept étapes avec durée et piège, les trois leviers du rythme, les fonctions utiles et inutiles, et les quatre règles de sous-titres.","kind":"document","url":null,"body":"## Le squelette de montage en sept étapes\n\n**Toujours dans cet ordre.** Changer l'ordre est la cause principale des\nmontages qui s'éternisent.\n\n| # | Étape | Durée | Piège |\n|---|---|---|---|\n| 1 | **Trier avant d'importer** | 3 min | Importer 40 fichiers pour en garder 9 |\n| 2 | Poser la structure | 2 min | Peaufiner avant de voir l'ensemble |\n| 3 | **Serrer les coupes** | 6 min | C'est l'étape qui fait le rythme |\n| 4 | Couvrir avec le B-roll | 4 min | Ne pas en avoir tourné |\n| 5 | Sous-titres + **relecture** | 5 min | Ne pas relire |\n| 6 | Musique | 2 min | Trop fort |\n| 7 | Vérification et export | 3 min | Sauter la checklist |\n\n**Cible : 25 minutes par vidéo.** Au-delà de 45 minutes régulièrement, le\nproblème vient du **tournage**, pas du montage.\n\n### Les trois leviers du rythme\n\n1. **Coupes serrées** — retirer 0,5 s de silence sur 12 plans = 6 s gagnées\n2. **Alternance des valeurs** — jamais deux plans identiques à la suite\n3. **Vitesse à 1,2× ou 1,5×** sur une démonstration — **jamais sur un plan parlé**\n\n### Les cinq fonctions de CapCut qui servent\n\nDécouper (la lame) · sous-titres automatiques · vitesse · volume par piste ·\nexport.\n\n**Ce qui ne sert à rien** : transitions animées, effets, filtres poussés,\nmodèles préfabriqués, stickers, compte à rebours.\n\n### Les sous-titres — quatre règles\n\n| Règle | Détail |\n|---|---|\n| Longueur | 3 à 5 mots par ligne, 2 lignes maximum |\n| Police | Simple, sans empattement, blanche, contour ou ombre noire |\n| Position | **Au quart inférieur**, jamais dans les 15 % du bas |\n| Relecture | **Intégrale** — noms de marque, chiffres et mots techniques sont systématiquement faux |\n\n### La colorimétrie — 30 secondes maximum\n\nLuminosité si l'image est sombre · un léger contraste · un léger\nréchauffement si la lumière était froide.\n\n**Jamais de correction de teinte poussée** : elle fausse la couleur du\nproduit, motif de refus fréquent.\n"},{"title":"CapCut","description":"L'outil de montage mobile du métier. Cinq fonctions suffisent : découper, sous-titrer, accélérer, régler le volume, exporter.","kind":"tool","url":"https://www.capcut.com"}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '18558429-19aa-471b-8125-ee46e7930539'::uuid, m.id, m.course_id, m.org_id, 'sous-titres-musique', $sq$Sous-titres, musique, sound design : les règles des plateformes$sq$, $sq$Une musique du catalogue applicatif rend une vidéo inutilisable en publicité — le piège le plus fréquent du métier. La règle de licence, le mixage en une phrase, les trois sons du sound design et les sept motifs réels de rejet.$sq$, $sq$## L'accroche

Une vidéo livrée avec une musique populaire trouvée en ligne est un livrable défectueux. Pas médiocre : défectueux. La marque ne peut pas la diffuser en publicité, parce que la plateforme la bloquera ou lui coupera le son, et parce qu'un usage commercial non licencié l'expose. La créatrice, elle, aura livré dans les temps un fichier inutilisable, et l'apprendra une semaine plus tard par un message embarrassé. Ce piège est le plus fréquent du métier, et il est parfaitement évitable en connaissant une seule distinction : la bibliothèque musicale d'une plateforme sert au contenu organique, pas à la publicité. Cette leçon règle la musique, le sound design et les sous-titres — les trois derniers éléments qui font qu'une vidéo est utilisable ou non.

## Le contenu

### La règle de la musique en publicité

Les catalogues musicaux des applications — TikTok, Instagram, CapCut — sont licenciés pour un usage **organique** : une publication depuis un compte personnel. Ils ne le sont pas pour une publicité payante.

Une marque qui pousse ta vidéo en publicité avec un titre du catalogue s'expose au blocage du son ou au refus de diffusion.

Ce qu'il faut utiliser :

**La bibliothèque commerciale de la plateforme**, quand elle existe : TikTok propose une section spécifiquement licenciée pour les publicités.

**Une bibliothèque libre de droits** pour usage commercial, avec sa licence conservée.

**Aucune musique.** C'est parfaitement acceptable en UGC, souvent même meilleur : une vidéo de témoignage sans musique paraît plus vraie.

### Le mixage en une phrase

**Si tu dois monter le volume pour comprendre un mot, la musique est trop forte.**

Repères pratiques : voix à 100 %, musique entre 10 et 20 % sur un format parlé, entre 40 et 60 % sur un format sans parole.

Baisse la musique d'un cran supplémentaire au moment de l'appel à l'action : c'est la phrase qui doit passer.

### Le sound design, discrètement

Trois sons suffisent, et ils ne s'entendent pas consciemment :

**Le son réel du geste** — le clic d'un bouchon, le froissement d'un emballage, la cuillère dans un bol. Garde-les, ils rendent la scène crédible. C'est la raison pour laquelle il ne faut pas couper le son des B-rolls.

**Une transition discrète** — un léger souffle, un « whoosh » très bas, sur une coupe franche.

**Une accentuation** sur un moment clé, très rare, jamais plus d'une par vidéo.

Ce qui ne va pas : les effets sonores comiques, les « ding » de notification, les sons de tendance. Ils datent la vidéo en trois mois et cassent la crédibilité.

### Les sous-titres, règles complètes

**Toujours présents.** Une part importante des vues se fait sans son.

**Incrustés par défaut**, sauf demande contraire. Un fichier de sous-titres séparé ne s'affiche pas en publicité.

**Trois à cinq mots par ligne**, deux lignes maximum, un bloc à l'écran par respiration.

**Blancs, police simple, contour ou ombre noire.** Lisibles sur n'importe quel fond.

**Au quart inférieur**, jamais dans les 15 % du bas.

**Relus intégralement.** Les noms de marque, les chiffres et les mots techniques sont systématiquement mal reconnus.

**Synchronisés à la parole**, pas en avance : un sous-titre qui apparaît avant le mot casse l'effet.

### La question de la version sans sous-titres

Certaines marques préfèrent ajouter leurs propres sous-titres, avec leur charte. C'est fréquent chez les marques structurées.

Demande-le au cadrage : « préférez-vous les sous-titres incrustés, ou une version propre ? ». Si tu ne sais pas, **livre les deux** : le fichier avec sous-titres et le fichier sans. Cela coûte un export et supprime une reprise.

### Ce qui rend une vidéo inutilisable

Récapitulatif des motifs réels de rejet, tous évitables :

Une musique non licenciée pour la publicité. Un logo ou une marque tierce visible. Une allégation interdite dans un secteur réglementé. Des sous-titres qui écrivent mal le nom du produit. Un format horizontal. Un fichier trop lourd pour la plateforme de dépôt du client. Une durée qui dépasse le maximum demandé.

Aucun de ces sept points n'est une question de talent. Tous sont des points de contrôle.

## Exemple appliqué

Léa livre quatre vidéos à une marque de compléments. Elle utilise une musique du catalogue CapCut, très populaire à ce moment-là.

**Cinq jours plus tard**, la marque écrit : « on ne peut pas les pousser en pub, le son est bloqué. Vous pouvez refaire ? »

Elle refait les quatre montages — deux heures — et découvre au passage que la marque n'aurait de toute façon pas voulu de musique sur deux d'entre elles.

**Ce qu'elle met en place ensuite :**

Une règle unique : aucune musique du catalogue applicatif sur une vidéo destinée à la publicité. Elle utilise une bibliothèque libre de droits commerciale et conserve les licences dans un dossier.

Une question ajoutée à son call de cadrage : « musique ou pas ? Et voulez-vous les sous-titres incrustés ou une version propre ? »

Un export systématique en deux versions quand elle a un doute.

**Sur les six mois suivants** : zéro reprise pour ce motif. Et une remarque du client, deux mois plus tard : « merci d'avoir envoyé la version sans sous-titres, ça nous a fait gagner un aller-retour ».

Le coût de la prévention est d'un export supplémentaire. Le coût de l'erreur était de deux heures et d'une livraison en retard.

## Les erreurs fréquentes

Utiliser une musique du catalogue applicatif pour une vidéo publicitaire. C'est le piège numéro un, et il produit un livrable inutilisable.

Mettre la musique trop fort. Si un mot est difficile à comprendre, la vidéo perd son argument.

Couper le son des B-rolls. Les sons réels des gestes rendent la scène crédible.

Utiliser des effets sonores de tendance. Ils datent la vidéo en trois mois.

Ne pas relire les sous-titres. Un nom de marque mal orthographié fait refaire la vidéo.

Placer les sous-titres tout en bas. L'interface les recouvre.

Ne pas demander si la marque veut ses propres sous-titres. Un export de plus évite un aller-retour.

## Action immédiate

Ouvre ton outil de montage et repère la bibliothèque musicale libre de droits pour usage commercial. Choisis trois pistes — une calme, une rythmée, une neutre — et garde-les en favoris : tu ne chercheras plus jamais de musique. Puis ajoute à ton call de cadrage la question « sous-titres incrustés ou version propre ? ». Ces deux gestes suppriment les deux causes de reprise les plus fréquentes du métier.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Musique, sound design, sous-titres","description":"La règle de licence organique contre publicitaire, le tableau de mixage, les trois sons discrets, et la liste des sept motifs de rejet — tous évitables.","kind":"document","url":null,"body":"## Musique, sound design, sous-titres\n\n### La règle qui rend une vidéo utilisable ou non\n\nLes catalogues musicaux des applications (TikTok, Instagram, CapCut) sont\nlicenciés pour un usage **organique**, **pas pour la publicité payante**.\n\nUne marque qui pousse ta vidéo en pub avec un titre du catalogue verra le son\nbloqué ou la diffusion refusée. **Tu auras livré un fichier inutilisable.**\n\n| À utiliser | Pourquoi |\n|---|---|\n| La bibliothèque **commerciale** de la plateforme | Licenciée pour la publicité |\n| Une bibliothèque libre de droits commerciale | Garder la licence dans un dossier |\n| **Aucune musique** | Parfaitement acceptable, souvent meilleur en témoignage |\n\n### Le mixage en une phrase\n\n**Si tu dois monter le volume pour comprendre un mot, la musique est trop\nforte.**\n\n| Format | Voix | Musique |\n|---|---|---|\n| Parlé | 100 % | 10 – 20 % |\n| Sans parole | — | 40 – 60 % |\n\nBaisse d'un cran supplémentaire sur l'appel à l'action.\n\n### Le sound design — trois sons, discrets\n\n1. **Le son réel du geste** (clic, froissement, cuillère) — c'est pourquoi il\n   ne faut **pas** couper le son des B-rolls\n2. Une transition discrète sur une coupe franche\n3. Une accentuation sur un moment clé — **une seule par vidéo**\n\nÀ proscrire : effets comiques, « ding » de notification, sons de tendance.\nIls datent la vidéo en trois mois.\n\n### Sous-titres incrustés ou version propre ?\n\n**Demande-le au cadrage.** En cas de doute, **livre les deux** : un export de\nplus, une reprise en moins.\n\n### Les sept motifs réels de rejet — tous évitables\n\n1. Musique non licenciée pour la publicité\n2. Logo ou marque tierce visible\n3. Allégation interdite (secteur réglementé)\n4. Nom du produit mal orthographié dans les sous-titres\n5. Format horizontal\n6. Fichier trop lourd pour l'outil du client\n7. Durée au-dessus du maximum demandé\n\nAucun n'est une question de talent. Tous sont des points de contrôle.\n"},{"title":"Checklist musique","description":"Bibliothèque commerciale ou libre de droits, licence conservée, volume sous la voix, aucun son de tendance.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'f8c97742-e12c-445a-82f7-20a3f87e9bd4'::uuid, m.id, m.course_id, m.org_id, 'formats-et-exports', $sq$Les formats et exports demandés par les marques$sq$, $sq$Un fichier inadapté à sa destination bloque une campagne sans que personne ait mal travaillé. Les réglages exacts, les quatre formats et leurs usages, le recadrage qui se prévoit au tournage, et la méthode de livraison sans friction.$sq$, $sq$## L'accroche

Une créatrice livre une vidéo parfaite en 4K, format 9:16, fichier de 480 Mo, via un lien de partage qui expire au bout de sept jours. La marque n'arrive pas à l'importer dans son gestionnaire de publicités, la transfère à son agence qui n'arrive pas à l'ouvrir, et découvre le lien expiré au moment de lancer la campagne. Personne n'a mal travaillé : le fichier était simplement inadapté à sa destination. Les formats ne sont pas un détail technique, ce sont une partie du livrable — et les connaître évite le type de friction qui fait qu'une marque ne recommande pas. Cette leçon donne les réglages exacts, les formats à livrer, et les pièges de poids et de compatibilité.

## Le contenu

### Les réglages d'export

**Résolution : 1080 × 1920** en vertical. Pas de 4K : les plateformes publicitaires ne diffusent pas au-delà, le fichier est quatre fois plus lourd, et certains outils d'import le refusent.

**Cadence : 30 images par seconde**, sauf si tu as tourné en 60 pour du ralenti.

**Codec : H.264**, format MP4. C'est le seul universellement accepté. Le HEVC, plus efficace, n'est pas lu par tous les outils.

**Débit : 8 à 12 Mb/s.** Au-dessus, le fichier grossit sans gain visible ; en dessous, la compression se voit sur les aplats.

**Audio : AAC, 128 à 192 kb/s, stéréo.**

Un fichier de trente secondes bien réglé pèse entre 25 et 45 Mo. Si tu dépasses 100 Mo, un réglage est mauvais.

### Les trois formats à livrer

**9:16 — 1080 × 1920.** Le format principal : stories, reels, TikTok, publicités verticales. C'est celui qui est toujours demandé.

**1:1 — 1080 × 1080.** Le format carré, utilisé dans le fil Facebook et Instagram. Il se produit en recadrant le 9:16, à condition que ton cadrage d'origine ait laissé de la marge.

**4:5 — 1080 × 1350.** Le format le plus performant du fil Instagram. Beaucoup de marques le demandent, peu de créatrices le proposent.

Le 16:9 horizontal ne sert qu'à YouTube et à quelques usages web. Ne le livre que s'il est demandé.

### Le recadrage, prévu au tournage

C'est le point qui rend les déclinaisons faciles ou impossibles.

Si tu cadres au plus juste en 9:16, le passage en 1:1 coupe ta tête ou ton produit. Si tu laisses un peu d'air en haut et sur les côtés, les trois formats se déclinent en deux minutes.

La règle : **garde le sujet dans le carré central**. Filme en te disant que les bords disparaîtront.

### Le nommage des fichiers

Une convention simple, appliquée toujours :

`Marque-Produit-01-9x16.mp4`
`Marque-Produit-01-1x1.mp4`
`Marque-Produit-02-9x16-hookB.mp4`

Trois raisons : le client retrouve ses fichiers six mois plus tard, tu retrouves les tiens, et un dossier bien nommé donne une impression de sérieux avant même le visionnage.

Ne livre jamais un fichier nommé `export_final_2.mp4` ou `IMG_4831.mov`.

### La méthode de livraison

**Un dossier partagé, sans expiration.** Google Drive, Dropbox, WeTransfer en version payante. Un lien WeTransfer gratuit expire en sept jours et c'est une cause réelle de problème.

**Structure du dossier** : un sous-dossier par vidéo si tu livres plusieurs formats et hooks, sinon tout à plat.

**Droits d'accès** : lecture pour toute personne ayant le lien. Un dossier qui demande une autorisation d'accès bloque le client pendant deux jours.

**Teste le lien en navigation privée** avant d'envoyer. C'est le même réflexe que pour le portfolio, et il évite le même problème.

### Ce qu'on ne livre pas

**Les rushes.** Ils restent ta propriété, et c'est écrit dans ton contrat.

**Le projet de montage.** Sauf demande explicite et facturation.

**Les prises non retenues.** Elles n'apportent rien et invitent à des demandes de remontage.

**Les fichiers de plus de 200 Mo** sans prévenir. Certains outils d'import ont des limites.

## Exemple appliqué

Sofia livre six vidéos à une agence qui gère trois marques. C'est le client le plus exigeant qu'elle ait sur les formats.

**Ce qu'elle demande au cadrage** : « quels formats vous faut-il, et sur quelle plateforme les déposez-vous ? »

Réponse : 9:16 et 4:5, dépôt sur leur Drive, et « surtout pas de fichiers de plus de 100 Mo, notre outil les rejette ».

**Ce qu'elle prépare au tournage** : elle cadre en laissant de l'air, sujet dans le carré central, en pensant au recadrage.

**Ce qu'elle exporte** : douze fichiers, 1080p, H.264, 10 Mb/s. Le plus lourd fait 38 Mo.

**Le nommage** :
`AgenceX-MarqueA-01-9x16.mp4`, `AgenceX-MarqueA-01-4x5.mp4`, etc.

**Le dossier** : un dossier Drive partagé en lecture, trois sous-dossiers par marque, testé en navigation privée.

**Le message de livraison** : trois lignes, avec le lien, le nombre de fichiers et la mention des formats.

**Le retour de l'agence, deux jours plus tard** : « c'est la première livraison qu'on n'a pas eu à retraiter. On vous met dans notre liste de créatrices prioritaires. »

Aucun de ces points ne concerne la qualité de la vidéo. Tous concernent la facilité avec laquelle elle est utilisable — ce qui est, du point de vue du client, indissociable de la qualité.

## Les erreurs fréquentes

Exporter en 4K. Fichier quatre fois plus lourd, aucun gain, et parfois un rejet à l'import.

Utiliser le codec HEVC. Plus efficace, mais pas lu partout.

Cadrer au plus juste en 9:16. Les déclinaisons deviennent impossibles.

Envoyer un lien qui expire. La marque revient sur la campagne trois semaines plus tard et ne trouve plus rien.

Ne pas tester le lien. Une demande d'autorisation d'accès bloque le client deux jours.

Nommer les fichiers n'importe comment. Le client ne retrouvera rien, et l'impression de sérieux part avant le visionnage.

Livrer les rushes. Ils sont ta propriété, et ils permettraient un remontage par quelqu'un d'autre.

Ne pas demander les formats au cadrage. C'est une question de trente secondes qui évite un export complet.

## Action immédiate

Note tes réglages d'export dans une fiche : 1080 × 1920, 30 fps, H.264, 10 Mb/s, AAC 160. Puis crée ton modèle de nommage et un dossier de livraison type. Ajoute enfin la question des formats à ton call de cadrage. La prochaine livraison te prendra dix minutes de moins et arrivera dans un état que le client n'aura pas à retraiter.$sq$, 10, 'none'::academy_video_provider, $sq$[{"title":"Formats, exports, livraison","description":"Le tableau des réglages d'export avec leur raison, les quatre formats et leurs usages, la convention de nommage et la checklist de livraison.","kind":"document","url":null,"body":"## Formats, exports, livraison\n\n### Les réglages d'export\n\n| Paramètre | Valeur | Pourquoi |\n|---|---|---|\n| Résolution | **1080 × 1920** | Les plateformes ne diffusent pas au-delà en vertical |\n| Cadence | **30 fps** | Sauf tournage 60 fps destiné au ralenti |\n| Codec | **H.264 / MP4** | Le seul universellement accepté (le HEVC ne l'est pas) |\n| Débit | 8 à 12 Mb/s | Au-dessus : plus lourd sans gain |\n| Audio | AAC 128 – 192 kb/s | — |\n\nUn fichier de 30 s bien réglé pèse **25 à 45 Mo**. Au-delà de 100 Mo, un\nréglage est mauvais.\n\n### Les formats à livrer\n\n| Format | Dimensions | Usage |\n|---|---|---|\n| **9:16** | 1080 × 1920 | Stories, reels, TikTok, pub verticale — toujours demandé |\n| 1:1 | 1080 × 1080 | Fil Facebook et Instagram |\n| **4:5** | 1080 × 1350 | Le plus performant du fil Instagram — peu de créatrices le proposent |\n| 16:9 | 1920 × 1080 | YouTube et web, uniquement sur demande |\n\n### Le recadrage se prévoit au tournage\n\n**Garde le sujet dans le carré central.** Filme en te disant que les bords\ndisparaîtront. Un cadrage au plus juste en 9:16 rend les déclinaisons\nimpossibles.\n\n### Le nommage\n\n`Marque-Produit-01-9x16.mp4`\n`Marque-Produit-01-4x5.mp4`\n`Marque-Produit-02-9x16-hookB.mp4`\n\nJamais `export_final_2.mp4` ni `IMG_4831.mov`.\n\n### La livraison\n\n- [ ] Dossier partagé **sans expiration** (un lien WeTransfer gratuit expire en 7 jours)\n- [ ] Droits en **lecture pour toute personne ayant le lien**\n- [ ] **Testé en navigation privée** avant envoi\n- [ ] Un sous-dossier par vidéo si plusieurs formats\n\n### Ce qu'on ne livre jamais\n\nLes **rushes** (ta propriété, écrite au contrat) · le projet de montage ·\nles prises non retenues · un fichier > 200 Mo sans prévenir.\n"},{"title":"Checklist d'export","description":"1080 × 1920, 30 fps, H.264, 10 Mb/s, AAC 160, fichier sous 45 Mo, nommé selon la convention.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'ecf8d61e-a707-49ca-9b7d-1b2fe862691c'::uuid, m.id, m.course_id, m.org_id, 'les-declinaisons', $sq$Les déclinaisons : trente variantes pour une session$sq$, $sq$Une marque qui reçoit quatre vidéos a quatre créas ; avec les déclinaisons, elle en a trente-deux. Les six types, leurs prix, ce qui les rend possibles — et tout se décide au tournage, pas au montage.$sq$, $sq$## L'accroche

Une marque commande quatre vidéos. Elle en reçoit quatre. Trois semaines plus tard, deux d'entre elles fonctionnent bien et la marque voudrait « la même chose, mais en un peu différent ». Elle recommande alors quatre nouvelles vidéos à la créatrice, qui les tourne, les monte, les livre — trois semaines de délai supplémentaires. Pendant ce temps, ses concurrentes qui livrent des **déclinaisons** avec la commande initiale ont déjà quinze variantes en test. Une déclinaison, c'est la même vidéo avec un élément changé : une autre ouverture, une autre fin, un autre format, un autre montage. Elle coûte cinq à quinze minutes et se facture. C'est le moyen le plus simple de doubler la valeur d'une commande sans doubler le travail. Cette leçon liste ce qui se décline et comment le vendre.

## Le contenu

### Les six types de déclinaisons

**1. Les hooks alternatifs.** Vus au module précédent : trois ouvertures différentes, six minutes de tournage, un montage de deux minutes chacun.

**2. Les formats.** 9:16, 1:1, 4:5, et éventuellement 16:9. Deux minutes de recadrage et d'export par format, à condition d'avoir cadré large.

**3. Les durées.** Une version 30 secondes et une version 15 secondes de la même vidéo. La courte se fait en gardant le hook, un plan de preuve et l'appel. Cinq minutes de montage.

**4. Les fins.** Le même corps avec deux appels à l'action différents : « le lien est en dessous » contre « code PROMO10 dans la description ». Utile pour tester une offre.

**5. Les versions sous-titrée et sans sous-titres.** Un export supplémentaire, aucune retouche.

**6. Le montage alternatif.** Le même contenu monté avec un rythme différent : coupes très serrées contre plans plus longs. Quinze minutes, et c'est la déclinaison qui produit les écarts de performance les plus intéressants.

### Pourquoi les marques en veulent

Une campagne publicitaire a besoin de variantes pour trois raisons :

**Tester.** On ne sait pas à l'avance quelle ouverture ou quelle offre convertit.

**Répartir.** Le fil Instagram, les stories et TikTok n'ont pas les mêmes formats.

**Retarder la fatigue.** Quinze variantes tiennent plus longtemps que trois vidéos.

Une marque qui reçoit quatre vidéos a quatre créas. Une marque qui reçoit quatre vidéos avec trois hooks et deux formats en a vingt-quatre.

### Comment les vendre

Deux approches, à choisir selon le client.

**Dans le pack**, comme argument différenciant : « 6 vidéos + 3 hooks chacune + 2 formats = 36 variantes ». C'est le calcul qui impressionne, et il est exact.

**En supplément**, ligne par ligne :

| Déclinaison | Prix indicatif |
|---|---|
| Hook alternatif | 25 à 40 € |
| Format supplémentaire | 30 à 50 € |
| Version courte (15 s) | 40 à 60 € |
| Fin alternative | 25 à 40 € |
| Montage alternatif | 60 à 90 € |

Sur une commande de quatre vidéos, proposer trois hooks et un format supplémentaire représente 400 à 600 € de plus pour environ une heure de travail.

### Ce qui rend les déclinaisons possibles

Tout se décide **au tournage**, pas au montage.

**Cadrer large** pour les formats.
**Filmer trois hooks** pour les ouvertures.
**Filmer du B-roll en quantité** pour les montages alternatifs.
**Filmer deux fins** si l'offre n'est pas figée.

Une créatrice qui rentre avec le minimum ne peut décliner que les formats et les sous-titres. Celle qui a prévu large peut sortir vingt variantes d'une session.

### La règle du nommage

Avec les déclinaisons, le nombre de fichiers explose. Une convention stricte devient indispensable :

`Marque-01-9x16-hookA.mp4`
`Marque-01-9x16-hookB.mp4`
`Marque-01-4x5-hookA.mp4`
`Marque-01-15s-hookA.mp4`

Le client doit pouvoir identifier chaque fichier sans l'ouvrir. C'est ce qui fait qu'il les utilise réellement — un dossier confus finit par être ignoré au profit des deux fichiers évidents.

### Le tableau de suivi

Livre avec le dossier un petit tableau récapitulatif : une ligne par fichier, avec le hook utilisé, le format, la durée. Cela prend cinq minutes et transforme une livraison en outil de travail.

C'est le genre de détail dont un client se souvient au moment de choisir sa créatrice pour le trimestre suivant.

## Exemple appliqué

Nina livre une commande de quatre vidéos pour une marque de sport, à 250 € l'unité, soit 1 000 €.

**Ce qu'elle propose en plus, au devis :**

- 3 hooks alternatifs par vidéo : 12 × 30 € = 360 €
- Format 4:5 en plus du 9:16 : 4 × 40 € = 160 €
- Une version 15 secondes sur les deux vidéos principales : 2 × 50 € = 100 €

Total : 1 620 € au lieu de 1 000 €.

**Ce que ça lui coûte réellement :**

- Les hooks : 8 minutes de tournage supplémentaires par vidéo, 2 minutes de montage par hook, soit environ 1 h 10 au total.
- Les formats : cadrage large prévu au tournage, 2 minutes d'export par fichier, soit 8 minutes.
- Les versions courtes : 10 minutes chacune, soit 20 minutes.

**Total : environ 1 h 40 de travail supplémentaire pour 620 €**, soit 372 € de l'heure.

**Ce que ça donne au client :** 4 vidéos × 4 hooks × 2 formats = 32 variantes, plus deux versions courtes. Elle livre un dossier de 34 fichiers avec un tableau récapitulatif d'une page.

**La suite :** la marque teste, trouve deux combinaisons qui performent nettement, et passe en abonnement le mois suivant en précisant « avec le même niveau de déclinaisons ».

## Les erreurs fréquentes

Ne pas proposer de déclinaisons. C'est la ligne de facturation la plus rentable du métier, et elle est invisible pour le client si tu ne l'annonces pas.

Les inclure gratuitement. Une heure et demie de travail offerte à chaque commande.

Cadrer serré au tournage. Les formats deviennent impossibles à décliner.

Filmer un seul hook. La déclinaison la plus demandée devient impossible.

Nommer les fichiers approximativement. Un dossier de trente fichiers confus est un dossier inutilisé.

Ne pas livrer de tableau récapitulatif. Cinq minutes qui transforment une livraison en outil.

Décliner une vidéo faible. Trente variantes d'une mauvaise vidéo restent mauvaises ; décline ce qui a des chances de marcher.

## Action immédiate

Ajoute une section « déclinaisons » à ton devis type, avec les cinq lignes et leurs prix. Puis, sur ton prochain tournage, cadre large et filme trois hooks — même si le client n'a rien demandé. À la livraison, offre-lui une déclinaison en expliquant ce qu'elle permet. C'est la démonstration la plus efficace pour vendre les suivantes.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les six déclinaisons","description":"Le tableau des six types avec temps de travail et prix, le calcul qui vend, la préparation à faire au tournage et le tableau récapitulatif à livrer.","kind":"document","url":null,"body":"## Les six déclinaisons\n\nUne déclinaison = la même vidéo avec **un** élément changé.\n5 à 15 minutes de travail, et ça se facture.\n\n| Type | Travail | Prix indicatif |\n|---|---|---|\n| Hook alternatif | 8 min de tournage + 2 min de montage | 25 – 40 € |\n| Format supplémentaire | 2 min d'export | 30 – 50 € |\n| Version courte (15 s) | 10 min | 40 – 60 € |\n| Fin alternative | 5 min | 25 – 40 € |\n| Version sans sous-titres | 1 export | inclus ou 20 € |\n| **Montage alternatif** | 15 min | 60 – 90 € |\n\nLe montage alternatif produit les écarts de performance les plus intéressants.\n\n### Le calcul qui vend\n\n4 vidéos × 4 hooks × 2 formats = **32 variantes**.\nUne marque qui reçoit 4 vidéos a 4 créas. Avec les déclinaisons, elle en a 32.\n\n### Pourquoi les marques en veulent\n\n1. **Tester** — on ne sait pas quelle ouverture convertit\n2. **Répartir** — le fil, les stories et TikTok n'ont pas les mêmes formats\n3. **Retarder la fatigue** — 15 variantes tiennent plus longtemps que 3 vidéos\n\n### Tout se décide au tournage\n\n- [ ] **Cadrer large** → les formats\n- [ ] **Trois hooks** → les ouvertures\n- [ ] **Du B-roll en quantité** → les montages alternatifs\n- [ ] **Deux fins** si l'offre n'est pas figée\n\nSans cette préparation, tu ne peux décliner que les formats et les sous-titres.\n\n### Le nommage devient indispensable\n\n`Marque-01-9x16-hookA.mp4` · `Marque-01-4x5-hookB.mp4` · `Marque-01-15s-hookA.mp4`\n\nLe client doit identifier chaque fichier **sans l'ouvrir**. Un dossier confus\nfinit ignoré au profit des deux fichiers évidents.\n\n### Le tableau récapitulatif\n\nUne page, une ligne par fichier : hook, format, durée. **Cinq minutes**, et ça\ntransforme une livraison en outil de travail.\n\n### La règle qui évite le gâchis\n\n**Ne décline jamais une vidéo faible.** Trente variantes d'une mauvaise vidéo\nrestent mauvaises.\n"},{"title":"Modèle de tableau récapitulatif","description":"Une ligne par fichier : hook, format, durée. Cinq minutes qui transforment une livraison en outil de travail.","kind":"template","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '169209ec-d325-4dfb-b018-c05e79fec297'::uuid, m.id, m.course_id, m.org_id, 'la-livraison', $sq$La livraison : nommage, dossier, message d'accompagnement$sq$, $sq$Un lien nu laisse la marque seule devant douze fichiers. Le message en six lignes, dont celle qui recommande quelle vidéo tester en premier — la phrase qui fait passer de prestataire à partenaire — et le suivi à J+7 et J+21.$sq$, $sq$## L'accroche

La livraison est le dernier moment où l'on peut encore gagner ou perdre un client, et c'est celui que tout le monde traite comme une formalité. Un lien nu dans un message vide — « voilà, bonne réception » — laisse la marque seule devant douze fichiers, sans savoir lequel ouvrir en premier, ce qui a été fait, ni ce qu'elle est censée en penser. À l'inverse, un message de livraison de six lignes bien construit oriente l'attention, désamorce les objections avant qu'elles ne naissent, et prépare la commande suivante. Cette leçon donne le message type, le contenu du dossier, et le geste d'après-livraison qui déclenche le plus de recommandes.

## Le contenu

### Le dossier de livraison

Quatre éléments, toujours les mêmes.

**Les fichiers, nommés selon ta convention.** Rangés en sous-dossiers si tu livres plusieurs formats.

**Un tableau récapitulatif**, une page : une ligne par fichier, avec le hook, le format, la durée. Cinq minutes de travail.

**La facture**, si tu factures à la livraison. La joindre au dossier évite un aller-retour et accélère le paiement.

**Rien d'autre.** Pas de rushes, pas de projet de montage, pas de prises non retenues.

### Le message de livraison

Six lignes, dans cet ordre.

**1. La livraison, factuelle.** « Voici les 4 vidéos, avec les 3 hooks et les 2 formats. 26 fichiers en tout. »

**2. Ce que tu recommandes.** « Si vous ne testez qu'une seule chose : la vidéo 2 avec le hook C. C'est l'angle qui attaque l'objection prix, celui que vos avis mentionnent le plus. »

C'est la ligne qui distingue une prestataire d'une partenaire. Elle prouve que tu as réfléchi à la performance, pas seulement à la production.

**3. Une précision technique.** « Les fichiers sont en 1080p H.264, sous 40 Mo, prêts à importer dans le gestionnaire. »

**4. Les retours.** « Deux allers-retours sont inclus. Si quelque chose ne va pas, dites-le-moi d'ici vendredi, je reprends dans les 48 h. »

Poser une date de retour est le geste qui évite le retour surprise trois semaines plus tard.

**5. La facture.** « Facture jointe, réglable à 15 jours. »

**6. L'ouverture.** « Dites-moi ce qui performe, ça m'aidera à orienter les prochaines. »

Cette dernière ligne fait deux choses : elle demande une information précieuse, et elle installe l'idée qu'il y aura des prochaines.

### Le message type complet

> Bonjour [Prénom],
>
> Voici les 4 vidéos, avec 3 hooks chacune et les formats 9:16 et 4:5 — 26 fichiers, plus un récapitulatif d'une page dans le dossier : [lien]
>
> Si vous ne testez qu'une chose : la vidéo 2 avec le hook C. C'est l'angle qui attaque l'objection prix, celle qui revient le plus dans vos avis clients.
>
> Tout est en 1080p H.264, sous 40 Mo, prêt à importer.
>
> Deux allers-retours sont inclus : si quelque chose ne va pas, dites-le-moi d'ici vendredi et je reprends sous 48 h.
>
> Facture jointe, réglable à 15 jours.
>
> Dites-moi ce qui performe quand vous aurez du recul — ça m'aidera à orienter les prochaines.
>
> Bonne diffusion,
> [Prénom]

### Le moment de la livraison

**Livre en début de journée**, pas le soir. Une livraison reçue à 9 h est traitée le jour même ; une livraison reçue à 22 h est lue le lendemain, dans un flot d'autres messages.

**Livre un jour avant la date promise** quand tu peux. C'est le geste qui produit le plus de commentaires positifs pour le moins d'effort — et il ne demande que de fixer des délais réalistes.

Ne livre jamais en retard sans avoir prévenu au moins deux jours avant.

### Le suivi

**J+7.** Un message court : « les vidéos tournent ? Rien à ajuster ? »

**J+21.** « Vous avez du recul sur les performances ? Je serais curieuse de savoir quel hook a le mieux marché. »

**J+75.** Le message d'échéance des droits, vu au module 7.

Ces trois messages sont l'essentiel du travail de fidélisation, et ils prennent trois minutes au total.

### Ce qu'il ne faut pas faire à la livraison

**S'excuser.** « Désolée si ça ne correspond pas tout à fait à ce que vous vouliez » invite à des retours qui n'existaient pas.

**Demander un avis esthétique.** « Dites-moi ce que vous en pensez ! » ouvre la porte aux retours subjectifs. Demande plutôt les performances.

**Livrer sans tableau.** Un dossier de vingt-six fichiers sans récapitulatif finit en deux fichiers utilisés.

**Oublier de fixer une date pour les retours.** Sans elle, un retour peut arriver un mois plus tard, quand tu as tout oublié.

## Exemple appliqué

Alice livre six vidéos à une marque de cosmétiques, un mardi à 9 h 15, un jour avant la date promise.

**Son dossier** : trois sous-dossiers par produit, 38 fichiers nommés, un PDF récapitulatif d'une page, sa facture.

**Son message** suit exactement le modèle. La ligne de recommandation dit : « si vous ne testez qu'une chose, la vidéo 4 avec le hook B — c'est la seule qui attaque l'objection "ça pique", que vos avis mentionnent onze fois sur les trente derniers. »

**La réponse, à 10 h 40 :** « merci, on ne s'attendait pas à ce niveau de détail. On lance le test cet après-midi. »

**J+7 :** Alice envoie son message de suivi. La marque répond que trois vidéos tournent et que le hook B fonctionne effectivement le mieux — exactement ce qu'elle avait recommandé.

**J+21 :** elle demande les performances. La marque partage les chiffres : le coût par achat a baissé de 28 % depuis le lancement des nouvelles créas.

**J+24 :** la marque propose un abonnement de huit vidéos par mois.

**Ce qui a produit ce résultat** : pas la qualité des vidéos, qui était comparable à celle de ses concurrentes. La ligne de recommandation, qui a prouvé qu'elle comprenait leur problème, et le suivi à J+7 et J+21, que personne d'autre ne fait.

## Les erreurs fréquentes

Envoyer un lien nu. La marque reste seule devant un dossier et n'ouvre que deux fichiers.

Ne pas recommander une vidéo. C'est la ligne qui te fait passer de prestataire à partenaire.

S'excuser à la livraison. Ça invite à des retours qui n'existaient pas.

Demander un avis esthétique. Demande les performances, pas le goût.

Livrer le soir. La livraison est traitée le lendemain, dans le flot.

Ne pas fixer de date limite pour les retours. Un retour peut arriver un mois plus tard.

Sauter les messages J+7 et J+21. Trois minutes de travail qui produisent la majorité des recommandes.

Oublier la facture. Chaque jour de décalage à l'émission est un jour de décalage au paiement.

## Action immédiate

Écris ton message de livraison type ce soir, avec les six lignes, et enregistre-le. Puis, à ta prochaine livraison, ajoute la ligne de recommandation — celle qui dit quelle vidéo tester en premier et pourquoi. C'est une phrase, elle demande deux minutes de réflexion, et c'est la plus rentable de toute la relation client.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Le message de livraison","description":"Le message type mot pour mot, le rôle de chacune de ses six lignes, le bon moment pour livrer et les trois messages de suivi qui produisent la majorité des recommandes.","kind":"document","url":null,"body":"## Le message de livraison\n\n### Le dossier — quatre éléments\n\nLes fichiers nommés · un **tableau récapitulatif** d'une page · **la facture** ·\net rien d'autre.\n\n### Le message type\n\n> Bonjour [Prénom],\n>\n> Voici les 4 vidéos, avec 3 hooks chacune et les formats 9:16 et 4:5 —\n> 26 fichiers, plus un récapitulatif d'une page dans le dossier : [lien]\n>\n> **Si vous ne testez qu'une chose : la vidéo 2 avec le hook C.** C'est l'angle\n> qui attaque l'objection prix, celle qui revient le plus dans vos avis\n> clients.\n>\n> Tout est en 1080p H.264, sous 40 Mo, prêt à importer.\n>\n> Deux allers-retours sont inclus : si quelque chose ne va pas, dites-le-moi\n> **d'ici vendredi** et je reprends sous 48 h.\n>\n> Facture jointe, réglable à 15 jours.\n>\n> Dites-moi ce qui performe quand vous aurez du recul — ça m'aidera à orienter\n> les prochaines.\n>\n> Bonne diffusion,\n> [Prénom]\n\n### Les six lignes et ce qu'elles font\n\n| Ligne | Rôle |\n|---|---|\n| 1. La livraison, factuelle | Situer le volume |\n| 2. **Ce que tu recommandes** | Te fait passer de prestataire à **partenaire** |\n| 3. La précision technique | Désamorce les questions d'import |\n| 4. Les retours **avec une date** | Évite le retour surprise à trois semaines |\n| 5. La facture | Chaque jour d'émission = un jour de paiement |\n| 6. L'ouverture sur la suite | Demande une info utile, installe l'idée d'une suite |\n\n### Le moment\n\n**En début de journée**, jamais le soir : une livraison reçue à 22 h est lue\nle lendemain dans le flot.\n\n**Un jour avant la date promise** quand c'est possible — le geste qui produit\nle plus de commentaires positifs pour le moins d'effort.\n\n### Le suivi — trois minutes en tout\n\n| Quand | Message |\n|---|---|\n| J+7 | « Les vidéos tournent ? Rien à ajuster ? » |\n| J+21 | « Vous avez du recul sur les performances ? Quel hook a le mieux marché ? » |\n| J+75 | Le message d'échéance des droits |\n\n**C'est l'essentiel du travail de fidélisation.**\n\n### Ce qu'il ne faut pas faire\n\nS'excuser · demander un avis **esthétique** (demande les performances) ·\nlivrer sans tableau · oublier de fixer une date de retour.\n"},{"title":"Checklist d'avant-envoi","description":"Lien testé en navigation privée, fichiers nommés, tableau récapitulatif, facture jointe, date de retour fixée.","kind":"checklist","url":null}]$sq$::jsonb, 5, true
from academy_modules m
where m.id = '8f424047-018a-4c02-bee2-e5bd1775e2ec'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'c0d7d23f-9ad1-40be-bbb7-17b9bf31c642'::uuid, c.id, c.org_id, 'delivrabilite', $sq$Délivrabilité : tenir ses engagements$sq$, $sq$Ce module traite la compétence qui décide de la fidélisation, très loin devant l'esthétique : le rétroplanning et la marge de deux jours, le forfait d'allers-retours qui protège la rentabilité, la conduite à tenir dans les six situations qui dérapent, et la checklist en douze points qui rend la qualité constante.$sq$, 12, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '7395f52a-033e-4763-99f2-4abfcba8b5ca'::uuid, m.id, m.course_id, m.org_id, 'le-delai', $sq$Le délai : rétroplanning d'une commande type$sq$, $sq$Cinq jours ouvrés contiennent cinq à neuf heures de travail et une journée d'attente qu'on ne contrôle pas. La règle de la marge, le rétroplanning à l'envers, les cinq causes réelles de retard et le calendrier de capacité qui empêche d'accepter trop.$sq$, $sq$## L'accroche

Demande à dix responsables acquisition ce qui les fait changer de créatrice. Aucune ne répondra « la qualité des vidéos ». Neuf répondront une variante de « elle ne livrait pas dans les temps » ou « il fallait la relancer ». La délivrabilité — livrer ce qui a été promis, quand ça a été promis — est le premier critère de fidélisation du métier, très loin devant l'esthétique. Et c'est une bonne nouvelle : c'est aussi la seule compétence entièrement sous ton contrôle, qui ne dépend ni du talent, ni du matériel, ni de la chance. Elle se réduit à un rétroplanning et à une marge. Cette leçon les construit.

## Le contenu

### Le délai type et sa décomposition

Cinq jours ouvrés est le standard du métier. Voilà ce qu'ils contiennent réellement :

| Jour | Étape | Durée |
|---|---|---|
| J0 | Réception du produit, lecture du brief, écriture des scripts | 1 h |
| J1 | Validation des scripts par le client | attente |
| J2 | Tournage | 2 à 4 h |
| J3 | Montage | 1 à 3 h |
| J4 | Vérification, export, livraison | 1 h |

Deux constats. Le travail réel représente cinq à neuf heures, pas cinq jours. Et **une journée entière est consacrée à une attente que tu ne contrôles pas** : la validation du script.

### La règle de la marge

Annonce toujours un délai **supérieur de deux jours** à ton besoin réel.

Si tu peux livrer en trois jours, annonce cinq. Trois raisons :

**Le produit arrive en retard** dans un cas sur trois. C'est la première cause de retard du métier, et elle n'est pas de ton fait — sauf si tu n'as pas posé la condition suspensive.

**La validation prend deux jours** quand elle devait en prendre un.

**Livrer en avance produit un effet disproportionné.** Une livraison en trois jours quand cinq étaient promis génère plus de satisfaction qu'une vidéo objectivement meilleure.

### Le rétroplanning d'une commande

Pars de la date de diffusion, remonte.

Diffusion le 20 → livraison le 17 (trois jours de marge pour le client) → export le 17 au matin → montage le 15 et 16 → tournage le 14 → validation du script le 12 et 13 → scripts envoyés le 11 → produit reçu au plus tard le 10.

Cette dernière date est celle à communiquer au client, par écrit : « pour tenir le 17, il me faut le produit avant le 10 ». Sans elle, le retard du produit devient ton retard.

### Les cinq causes réelles de retard

**1. Le produit arrivé en retard.** Un tiers des cas. Remède : la condition suspensive écrite au devis.

**2. La validation qui traîne.** Remède : donner une date limite dans le message d'envoi du script — « pour tenir la livraison du 17, il me faudrait votre retour avant jeudi ».

**3. La surcharge.** Trop de missions acceptées la même semaine. Remède : un calendrier de capacité, vu plus bas.

**4. L'imprévu personnel.** Maladie, panne, urgence. Remède : la marge de deux jours.

**5. Le perfectionnisme.** Refaire un montage trois fois pour un gain invisible. Remède : le temps cible de vingt-cinq minutes.

### Le calendrier de capacité

Une page par mois, avec pour chaque semaine ton nombre de vidéos maximum.

Une créatrice à temps plein tient confortablement **huit à douze vidéos par semaine** en incluant tournage, montage et échanges. À mi-temps, quatre à six.

Avant d'accepter une mission, tu regardes la semaine concernée. Si elle est pleine, tu proposes la suivante — ce qui est presque toujours accepté, alors qu'un retard ne l'est jamais.

C'est le seul outil qui empêche l'erreur la plus coûteuse du métier : accepter trop, et livrer mal à tout le monde.

### Prévenir un retard

Si malgré tout un retard devient inévitable, une seule règle : **préviens au moins 48 heures avant l'échéance**, jamais le jour même.

> Bonjour [Prénom], je dois décaler la livraison de deux jours : au 19 au lieu du 17. La raison est [raison factuelle]. Les vidéos seront complètes, je ne réduis rien. Est-ce que ça reste compatible avec votre planning de diffusion ?

Trois éléments : une date ferme, une raison factuelle sans excuse longue, et une question qui permet au client de s'organiser.

Un retard annoncé 48 heures avant est un contretemps. Le même retard annoncé le jour J est une faute professionnelle, et c'est ce qui fait perdre les clients.

## Exemple appliqué

Marion accepte trois commandes la même semaine : quatre vidéos pour une marque de thé, trois pour une marque de bougies, deux pour une agence. Neuf vidéos.

**Sa capacité déclarée** : huit par semaine. Elle est en dépassement.

**Ce qu'elle fait** : elle accepte les trois, mais décale la troisième d'une semaine. « Je peux vous livrer le 24 plutôt que le 17 — ça vous convient ? » L'agence accepte sans commentaire.

**Ses rétroplannings**, posés dans son agenda :

- Thé : produit reçu le 8, scripts le 9, validation le 10, tournage le 12, montage le 13, livraison le 15 (promise le 17).
- Bougies : produit reçu le 9, tournage le 12 dans la même session, montage le 14, livraison le 16 (promise le 18).

**L'imprévu** : le produit de la marque de thé arrive le 11 au lieu du 8. Marion avait écrit la condition suspensive. Elle écrit le 9 : « le produit n'est pas arrivé ; si je le reçois le 11, je livre le 18 au lieu du 17. Ça vous va ? » La marque accepte et présente ses excuses.

**Le résultat** : les deux livraisons partent en avance sur les dates recalées, la troisième commande est livrée le 22 au lieu du 24.

**Ce qui a fonctionné** : le calendrier de capacité, qui l'a empêchée d'accepter neuf vidéos sur une semaine de huit ; la condition suspensive, qui a transféré le retard du produit au bon endroit ; et la marge de deux jours, qui a absorbé le reste.

## Les erreurs fréquentes

Annoncer un délai serré pour paraître réactive. La première livraison en retard efface tout le bénéfice de la rapidité promise.

Ne pas poser de condition suspensive sur le produit. Le retard de l'expéditeur devient le tien.

Ne pas donner de date limite pour la validation du script. Une validation peut traîner une semaine entière.

Accepter au-delà de sa capacité. On livre mal à tout le monde au lieu de bien à quelques-uns.

Prévenir d'un retard le jour même. C'est ce qui transforme un contretemps en faute.

Se justifier longuement. Une raison factuelle, une date ferme, une question.

Refaire un montage trois fois. Le gain est invisible, le temps est réel.

## Action immédiate

Ouvre ton agenda et crée un calendrier de capacité : pour chacune des quatre prochaines semaines, écris ton nombre maximum de vidéos. Puis, pour chaque mission en cours, pose le rétroplanning à l'envers depuis la date de livraison, en incluant la date limite de réception du produit. Communique cette date au client par écrit. C'est le geste qui supprime la première cause de retard du métier.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Le rétroplanning et la marge","description":"La décomposition réelle d'un délai de cinq jours, la méthode de rétroplanning, le tableau des cinq causes de retard avec leur remède, et le message d'annonce à 48 heures.","kind":"document","url":null,"body":"## Le rétroplanning et la marge\n\n### La décomposition d'un délai de cinq jours\n\n| Jour | Étape | Durée réelle |\n|---|---|---|\n| J0 | Réception produit, lecture du brief, scripts | 1 h |\n| J1 | **Validation des scripts par le client** | attente |\n| J2 | Tournage | 2 à 4 h |\n| J3 | Montage | 1 à 3 h |\n| J4 | Vérification, export, livraison | 1 h |\n\n**5 à 9 heures de travail réel** — et une journée entière d'attente que tu ne\ncontrôles pas.\n\n### La règle de la marge\n\n**Annonce deux jours de plus que ton besoin réel.**\n\n| Raison | Fréquence |\n|---|---|\n| Le produit arrive en retard | 1 cas sur 3 |\n| La validation prend 2 jours au lieu d'1 | courant |\n| Livrer en avance produit un effet disproportionné | toujours |\n\n### Le rétroplanning — partir de la diffusion et remonter\n\nDiffusion le 20 → livraison le 17 → export le 17 matin → montage les 15-16 →\ntournage le 14 → validation les 12-13 → scripts envoyés le 11 →\n**produit reçu au plus tard le 10**.\n\nCette dernière date se communique **par écrit** : sans elle, le retard du\nproduit devient ton retard.\n\n### Les cinq causes de retard et leur remède\n\n| Cause | Remède |\n|---|---|\n| Produit en retard | Condition suspensive écrite au devis |\n| Validation qui traîne | Date limite dans le message d'envoi du script |\n| Surcharge | Calendrier de capacité |\n| Imprévu personnel | La marge de deux jours |\n| Perfectionnisme | Le temps cible de 25 min par montage |\n\n### Le calendrier de capacité\n\n| Rythme | Vidéos par semaine |\n|---|---|\n| Temps plein | 8 à 12 |\n| Mi-temps | 4 à 6 |\n\nAvant d'accepter : regarder la semaine. Si elle est pleine, **proposer la\nsuivante** — presque toujours accepté, alors qu'un retard ne l'est jamais.\n\n### Prévenir un retard — 48 h minimum\n\n> Bonjour [Prénom], je dois décaler la livraison de deux jours : au 19 au lieu\n> du 17. La raison est [raison factuelle]. Les vidéos seront complètes, je ne\n> réduis rien. Est-ce que ça reste compatible avec votre planning de diffusion ?\n\nUne date ferme · une raison factuelle · une question.\n**Un retard annoncé 48 h avant est un contretemps. Le jour J, c'est une faute.**\n"},{"title":"Calendrier de capacité","description":"Un tableau par mois avec le nombre maximum de vidéos par semaine. Le seul outil qui empêche d'accepter trop et de livrer mal à tout le monde.","kind":"template","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'c0d7d23f-9ad1-40be-bbb7-17b9bf31c642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '644d28db-3726-4e9c-a165-e8cf9666284f'::uuid, m.id, m.course_id, m.org_id, 'les-retours-client', $sq$Les retours client : combien d'allers-retours, et lesquels$sq$, $sq$Une vidéo à 250 € reprise quatre fois devient une perte. Le forfait écrit à trois endroits, la distinction entre correction et refonte, la question à poser devant un retour flou, et les quatre retours qu'il faut accepter gratuitement.$sq$, $sq$## L'accroche

« On aimerait juste quelques petits ajustements. » Cette phrase peut désigner une correction de vingt secondes ou une refonte de trois heures, et rien dans le message ne permet de savoir laquelle. Les allers-retours sont l'endroit où se perd la rentabilité d'une mission : une vidéo facturée 250 € reprise quatre fois tombe à 60 € de l'heure, puis à 40, puis à un niveau où la mission devient une perte. Le problème n'est presque jamais un client de mauvaise foi — c'est l'absence de règle. Un forfait de retours écrit, une distinction claire entre correction et refonte, et une méthode pour traiter un retour flou suffisent à régler la question. Cette leçon les donne.

## Le contenu

### Le forfait, écrit avant

**Deux allers-retours inclus.** C'est le standard, et il doit figurer sur le devis, sur le compte rendu de cadrage et dans le message de livraison.

Au-delà : **40 € la reprise**, annoncé d'avance. Ce n'est pas une punition, c'est un tarif — et le fait qu'il existe suffit presque toujours à ce qu'on n'y arrive pas.

### La distinction qui change tout

**Une correction** porte sur l'exécution : une coupe à resserrer, un sous-titre à corriger, un plan à remplacer par un autre déjà tourné, un volume à ajuster. Elle entre dans le forfait.

**Une refonte** porte sur le concept : un autre angle, un autre décor, un autre produit, un autre script. Elle sort du forfait, parce que le concept a été validé avant tournage.

Cette distinction doit être écrite : « 2 allers-retours inclus, portant sur le montage et non sur le concept validé. »

Sans elle, « on préférerait finalement un angle sur le prix » devient un aller-retour gratuit — et c'est trois heures de travail.

### Traiter un retour flou

La règle : **ne jamais commencer à travailler sur un retour imprécis.** Une phrase de réponse suffit.

> Bonjour [Prénom], pour être sûre de bien reprendre : est-ce que vous pouvez me dire, avec le temps précis, ce qui ne va pas ? Par exemple « à 0:12, le plan produit est trop rapide ». Ça m'évitera de reprendre ce qui vous convient déjà.

Deux effets. Le client précise, et sa demande se réduit souvent d'elle-même — beaucoup de retours flous sont un inconfort général qui se dissout quand il faut le formuler. Et tu obtiens une liste actionnable au lieu d'une impression.

### Regrouper les retours

Demande **une seule liste**, pas des messages successifs.

> Envoyez-moi l'ensemble de vos remarques d'un coup, je reprends tout en une fois. Ça compte pour un aller-retour.

Sans cette règle, cinq messages étalés sur trois jours consomment cinq fois le temps de mise en route, et chacun se présente comme « juste un petit détail ».

### Le délai de reprise

Annonce-le : **48 heures ouvrées après réception de la liste complète**.

Et fixe une date limite pour les retours dans ton message de livraison : « si quelque chose ne va pas, dites-le-moi d'ici vendredi ». Sans elle, un retour peut arriver trois semaines plus tard, quand tu as tout oublié et que ton planning est plein.

### Les quatre retours qu'il faut accepter sans discuter

Même hors forfait, ces quatre-là se corrigent immédiatement et gratuitement :

**Une erreur factuelle** : un prix faux, un nom mal prononcé, une caractéristique inexacte.
**Une erreur de sous-titre** sur le nom du produit ou de la marque.
**Un problème technique** : un fichier corrompu, un mauvais format, un son coupé.
**Un élément interdit** que tu n'avais pas vu : un logo concurrent, une mention réglementaire manquante que le client t'avait signalée.

Ce sont des défauts de livraison, pas des retours. Les facturer serait indéfendable.

### Les trois retours qu'il faut refuser poliment

**« Refais-la mais avec un autre angle. »** C'est une nouvelle vidéo.

**« On a montré à notre communauté / à notre boss et ils préfèrent autre chose. »** Le concept a été validé avant tournage ; un avis nouveau après coup est une nouvelle commande.

**« On voudrait tester une autre version pour voir. »** C'est exactement ce que sont les déclinaisons, et elles se facturent.

Formulation : « Je peux tout à fait le faire — c'est une reprise hors forfait, à 40 €, ou une nouvelle vidéo à [prix] selon l'ampleur. Dites-moi ce que vous préférez. »

### Quand le client a raison et que c'est ta faute

Ça arrive. Un plan flou, un raccord raté, un contresens sur le brief.

Reprends sans discuter, sans t'excuser longuement, et sans compter l'aller-retour. « Vous avez raison, je reprends, vous avez la nouvelle version demain matin. » C'est ce qui construit la réputation, et ça coûte moins cher qu'une justification.

## Exemple appliqué

Sarah livre quatre vidéos. Le retour arrive le lendemain : « merci ! Quelques petits ajustements sur 2 et 3, on n'est pas complètement convaincus. »

**Ce qu'elle ne fait pas** : ouvrir le montage et deviner.

**Ce qu'elle écrit** :

> Volontiers. Pour être sûre de bien reprendre, vous pouvez me préciser avec le temps ? Par exemple « à 0:14, la transition est trop brusque ». Et envoyez-moi tout d'un coup, je reprends en une fois — ça compte pour un aller-retour sur les deux inclus.

**Le retour précisé, deux heures plus tard** :

- Vidéo 2 : « à 0:08, on voit le coin de la boîte d'une autre marque » → défaut de livraison, elle corrige gratuitement.
- Vidéo 2 : « les sous-titres écrivent Nutrimax au lieu de NutriMax » → erreur, correction gratuite.
- Vidéo 3 : « on préférerait finalement que ça parle du prix plutôt que de la composition » → refonte.

**Sa réponse** :

> Je corrige les deux premiers points aujourd'hui, ce sont des défauts de mon côté et ils ne comptent pas dans le forfait.
>
> Pour la vidéo 3 : changer l'angle demande un nouveau tournage — c'est une nouvelle vidéo, à 250 €, livrable jeudi. Si vous préférez rester sur la composition, je peux resserrer le montage pour la rendre plus percutante, et ça, c'est dans le forfait.

**La réponse du client** : « on garde la composition, resserrez. Et on ajoute une vidéo sur le prix au prochain lot. »

Une reprise gratuite justifiée, une reprise dans le forfait, et une vidéo supplémentaire vendue — sur un retour qui, traité sans règle, aurait été trois heures de travail non payées.

## Les erreurs fréquentes

Ne pas écrire de forfait de retours. Sans chiffre, il n'y a pas de limite.

Ne pas distinguer correction et refonte. « Un autre angle » devient un aller-retour gratuit.

Travailler sur un retour flou. Tu reprends au hasard, et souvent ce qui convenait.

Accepter des retours au fil de l'eau. Cinq messages coûtent cinq fois le temps de mise en route.

Ne pas fixer de date limite de retour. Un retour à trois semaines tombe sur un planning plein.

Facturer un défaut de livraison. Un fichier corrompu ou un sous-titre faux n'est pas un retour.

Se justifier quand on a tort. Reprends, dis-le en une phrase, et passe à autre chose.

## Action immédiate

Ajoute à ton devis et à ton message de livraison la phrase complète : « 2 allers-retours inclus, portant sur le montage et non sur le concept validé. Reprise supplémentaire : 40 €. » Puis copie dans une note la question de précision à envoyer devant tout retour flou. Ces deux phrases suppriment la principale fuite de rentabilité du métier.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les allers-retours","description":"La formule à écrire, le tableau correction contre refonte, la question de précision mot pour mot, les quatre retours gratuits et les trois à refuser poliment.","kind":"document","url":null,"body":"## Les allers-retours\n\n### Le forfait, écrit à trois endroits\n\nDevis · compte rendu de cadrage · message de livraison.\n\n> 2 allers-retours inclus, portant sur le montage et **non sur le concept\n> validé**. Reprise supplémentaire : 40 €.\n\n### La distinction qui change tout\n\n| Correction (dans le forfait) | Refonte (hors forfait) |\n|---|---|\n| Une coupe à resserrer | Un autre angle |\n| Un sous-titre à corriger | Un autre décor |\n| Un plan remplacé par un autre déjà tourné | Un autre produit |\n| Un volume à ajuster | Un autre script |\n\n### Devant un retour flou — ne jamais commencer à travailler\n\n> Bonjour [Prénom], pour être sûre de bien reprendre : est-ce que vous pouvez\n> me dire, **avec le temps précis**, ce qui ne va pas ? Par exemple « à 0:12,\n> le plan produit est trop rapide ». Ça m'évitera de reprendre ce qui vous\n> convient déjà.\n\nDeux effets : la demande se précise, et **elle se réduit souvent d'elle-même**.\n\n### Regrouper\n\n> Envoyez-moi l'ensemble de vos remarques d'un coup, je reprends tout en une\n> fois. Ça compte pour un aller-retour.\n\nSans cette règle, cinq messages coûtent cinq fois le temps de mise en route.\n\n### Les quatre retours à accepter gratuitement, même hors forfait\n\nCe sont des **défauts de livraison**, pas des retours :\n\n1. Erreur factuelle (prix faux, caractéristique inexacte)\n2. Sous-titre faux sur le nom de la marque\n3. Problème technique (fichier corrompu, mauvais format, son coupé)\n4. Élément interdit signalé au brief et non vu\n\n### Les trois retours à refuser poliment\n\n- « Refais-la avec un autre angle » → nouvelle vidéo\n- « Notre boss préfère autre chose » → le concept était validé\n- « On voudrait tester une autre version » → c'est une déclinaison, ça se facture\n\n> Je peux tout à fait le faire — c'est une reprise hors forfait, à 40 €, ou une\n> nouvelle vidéo à [prix] selon l'ampleur. Dites-moi ce que vous préférez.\n\n### Quand c'est ta faute\n\n> Vous avez raison, je reprends, vous avez la nouvelle version demain matin.\n\nSans discuter, sans s'excuser longuement, sans compter l'aller-retour.\n"},{"title":"Checklist de traitement d'un retour","description":"Une seule liste, avec des temps précis, dans le forfait ou hors forfait, reprise sous 48 heures ouvrées.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'c0d7d23f-9ad1-40be-bbb7-17b9bf31c642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '616d537c-94b2-4e77-b8db-29a2f516f73d'::uuid, m.id, m.course_id, m.org_id, 'quand-ca-derape', $sq$Quand ça dérape : retard, produit non reçu, brief qui change$sq$, $sq$Six situations arrivent à tout le monde plusieurs fois par an. Ce qui distingue une créatrice fiable n'est pas de les éviter mais d'avoir décidé à l'avance quoi écrire — les six messages, rédigés à froid.$sq$, $sq$## L'accroche

Le produit n'est jamais arrivé. Le brief change au milieu du montage. Le client ne répond plus depuis onze jours alors que la validation bloque tout. Tu tombes malade la veille du tournage. Ces situations arrivent à tout le monde, plusieurs fois par an, et ce qui distingue une créatrice fiable d'une créatrice fragile n'est pas de les éviter — c'est d'avoir décidé à l'avance quoi faire. Une situation dégradée gérée en trente minutes avec une procédure claire ne laisse aucune trace ; la même situation improvisée dans le stress coûte un client. Cette leçon donne la conduite à tenir pour les six cas qui reviennent.

## Le contenu

### Cas 1 — Le produit n'arrive pas

**Le plus fréquent.** Un tiers des commandes connaissent un décalage d'envoi.

Conduite à tenir : dès que la date limite écrite au devis est dépassée d'un jour, tu écris.

> Bonjour [Prénom], je n'ai pas encore reçu le produit — la date convenue était le 10. Pour tenir la livraison du 17, il me le faudrait avant le 12. Au-delà, je décale la livraison d'autant. Avez-vous un numéro de suivi ?

Ce message fait trois choses : il documente, il propose une solution, et il transfère le décalage là où il appartient.

**Ne commence jamais à décaler ton planning en silence.** Un retard non annoncé devient le tien au moment du bilan.

### Cas 2 — Le brief change en cours de route

Deux situations très différentes.

**Avant tournage** : c'est gratuit et normal. Tu mets à jour ton compte rendu de cadrage et tu continues.

**Après tournage** : c'est une nouvelle commande. Formulation :

> Le changement d'angle demande un nouveau tournage — les plans actuels ne s'y prêtent pas. C'est une nouvelle vidéo à [prix], livrable le [date]. Je peux aussi livrer la version prévue et faire la nouvelle en complément, si le calendrier presse.

La seconde option est souvent choisie, et elle double la commande.

### Cas 3 — Le client ne répond plus

La validation du script bloque tout, et le silence dure.

**J+2** : relance simple. « Petit rappel pour la validation du script — pour tenir le 17, il me faudrait votre retour d'ici demain. »

**J+4** : relance avec conséquence. « Sans retour aujourd'hui, je décale la livraison au [date]. Dites-moi simplement si le projet est toujours d'actualité. »

**J+8** : mise en pause écrite. « Je mets le projet en pause de mon côté et je libère le créneau. L'acompte reste acquis conformément au devis. Reprenons quand vous serez prêt : il me faudra alors un nouveau délai. »

Cette dernière étape est celle qui protège ton planning. Un projet en pause qui occupe un créneau est un créneau perdu deux fois.

### Cas 4 — Tu es malade ou empêchée

Préviens dès que tu le sais, jamais la veille de l'échéance.

> Bonjour [Prénom], je suis malade et je ne pourrai pas tourner cette semaine. Je décale la livraison au [date ferme]. Si ce délai ne convient pas à votre planning, dites-le-moi et je vous rembourse l'acompte, sans difficulté.

La proposition de remboursement change tout : elle transforme un problème subi en choix offert. Elle est presque toujours refusée, et elle laisse une impression de fiabilité paradoxale.

### Cas 5 — Le produit est cassé, périmé ou pas conforme

Tu ne tournes pas avec un produit abîmé, et tu ne le caches pas.

> Le produit est arrivé avec l'emballage écrasé / la date dépasse le [date] / la référence ne correspond pas au brief. Je préfère ne pas tourner avec : ça se verrait en macro. Pouvez-vous m'en renvoyer un ? Je décale la livraison de [n] jours en conséquence.

Tourner avec un produit non conforme est la faute la plus coûteuse : la vidéo sera refusée, et le temps sera perdu deux fois.

### Cas 6 — Un fichier est perdu

Le téléphone tombe, la carte se corrompt, un fichier disparaît.

La prévention tient en une règle : **sauvegarde le soir même du tournage, sur un second support**. Cloud, disque externe, ordinateur — n'importe lequel, mais un deuxième.

Si malgré tout un fichier est perdu et qu'il est indispensable, préviens, propose une date de re-tournage, et ne facture pas le re-tournage. C'est ta responsabilité.

### Le principe commun aux six cas

Trois éléments, toujours les mêmes :

**Écrire tôt.** Un problème annoncé à J+1 est un contretemps ; le même annoncé à J+8 est une faute.

**Proposer une solution datée.** Jamais un problème sans une option.

**Ne pas s'excuser longuement.** Une phrase factuelle. Les excuses répétées donnent l'impression d'une créatrice fragile, ce qui inquiète bien plus que le problème lui-même.

## Exemple appliqué

Léa a quatre commandes en cours. En dix jours, trois dérapent.

**Marque A** : produit non reçu à J+2 de la date limite. Elle écrit le message du cas 1. La marque découvre que le colis est parti à la mauvaise adresse. Livraison décalée de quatre jours, acceptée sans tension, et la marque s'excuse.

**Marque B** : après tournage, le client écrit « finalement on préfère mettre en avant le format familial ». Elle applique le cas 2 et propose les deux options. Le client choisit de garder la version prévue **et** de commander la nouvelle : + 250 €.

**Marque C** : silence depuis six jours sur la validation du script. À J+8, elle envoie la mise en pause. Le client répond dans l'heure : « pardon, on était en salon, on valide aujourd'hui ». Le projet repart avec un nouveau délai.

**Bilan** : trois situations dégradées, zéro client perdu, une commande supplémentaire, et un planning qui n'a jamais été bloqué par un projet dormant.

**Ce qui a fait la différence** : aucune de ces réponses n'a été improvisée. Les trois messages existaient déjà dans une note, écrits à froid.

## Les erreurs fréquentes

Décaler son planning en silence quand le produit tarde. Le retard devient le tien.

Accepter un changement de brief après tournage comme s'il était gratuit. C'est une nouvelle commande.

Laisser un projet dormant occuper un créneau. Mets-le en pause par écrit et libère la place.

Prévenir d'un empêchement la veille. Deux jours minimum, toujours.

Tourner avec un produit non conforme. La vidéo sera refusée et le temps perdu deux fois.

Ne pas sauvegarder le soir du tournage. Un support unique est une panne en attente.

S'excuser trois fois. Une phrase factuelle rassure ; les excuses répétées inquiètent.

## Action immédiate

Écris les six messages dans une note, à froid, avec tes mots — produit non reçu, changement de brief, silence du client, empêchement, produit non conforme, fichier perdu. Puis instaure la règle de sauvegarde : le soir de chaque tournage, une copie sur un second support, avant de te coucher. Ces deux gestes te feront traverser sans dommage les situations qui font perdre des clients aux autres.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les six situations dégradées","description":"Le message à envoyer pour chacune des six situations, la procédure de relance en trois temps face à un client silencieux, et le principe commun aux six cas.","kind":"document","url":null,"body":"## Les six situations dégradées\n\n**Le principe commun** : écrire tôt · proposer une solution **datée** ·\nne pas s'excuser longuement.\n\n### 1. Le produit n'arrive pas — 1 commande sur 3\n\n> Bonjour [Prénom], je n'ai pas encore reçu le produit — la date convenue\n> était le 10. Pour tenir la livraison du 17, il me le faudrait avant le 12.\n> Au-delà, je décale la livraison d'autant. Avez-vous un numéro de suivi ?\n\n**Ne décale jamais ton planning en silence** : le retard deviendrait le tien.\n\n### 2. Le brief change\n\n| Moment | Statut |\n|---|---|\n| **Avant** tournage | Gratuit et normal — mets à jour le compte rendu |\n| **Après** tournage | Nouvelle commande |\n\n> Le changement d'angle demande un nouveau tournage. C'est une nouvelle vidéo\n> à [prix], livrable le [date]. Je peux aussi livrer la version prévue **et**\n> faire la nouvelle en complément, si le calendrier presse.\n\nLa seconde option est souvent choisie — et elle double la commande.\n\n### 3. Le client ne répond plus\n\n| Quand | Message |\n|---|---|\n| J+2 | Rappel simple avec la date limite |\n| J+4 | « Sans retour aujourd'hui, je décale au [date]. » |\n| **J+8** | **Mise en pause écrite** : « je libère le créneau, l'acompte reste acquis » |\n\nUn projet dormant qui occupe un créneau est un créneau perdu deux fois.\n\n### 4. Empêchement personnel\n\n> Je suis malade et je ne pourrai pas tourner cette semaine. Je décale la\n> livraison au [date ferme]. Si ce délai ne convient pas à votre planning,\n> dites-le-moi et je vous rembourse l'acompte, sans difficulté.\n\n**La proposition de remboursement** transforme un problème subi en choix\noffert. Elle est presque toujours refusée.\n\n### 5. Produit cassé, périmé ou non conforme\n\n> Je préfère ne pas tourner avec : ça se verrait en macro. Pouvez-vous m'en\n> renvoyer un ? Je décale la livraison de [n] jours en conséquence.\n\nTourner avec un produit non conforme fait perdre le temps **deux fois**.\n\n### 6. Fichier perdu\n\n**Prévention** : sauvegarde sur un **second support le soir même du tournage**.\n\nSi un fichier indispensable est perdu : prévenir, proposer une date de\nre-tournage, et **ne pas le facturer**. C'est ta responsabilité.\n"},{"title":"Checklist de sauvegarde","description":"Le soir de chaque tournage, une copie sur un second support avant de se coucher. Un support unique est une panne en attente.","kind":"checklist","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'c0d7d23f-9ad1-40be-bbb7-17b9bf31c642'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'daee1f77-4569-473c-9b3c-1d5e01ffdcdc'::uuid, m.id, m.course_id, m.org_id, 'la-qualite-constante', $sq$La qualité constante : ta checklist de contrôle avant envoi$sq$, $sq$Un doute chez un client régulier coûte plus cher qu'un défaut chez un client nouveau. Douze points à lire à l'écran, le visionnage complet sur téléphone — le contrôle le plus rentable du métier — et le carnet des défauts qui empêche de se répéter.$sq$, $sq$## L'accroche

Une créatrice livre sa quatrième commande à la même marque. Les trois premières étaient impeccables ; la quatrième contient un plan flou de deux secondes, un sous-titre mal orthographié, et une vidéo qui dure trente-quatre secondes alors que le brief en demandait trente maximum. Rien de dramatique — sauf que le client a maintenant un doute, et qu'un doute chez un client régulier coûte beaucoup plus cher qu'un défaut chez un client nouveau. La régularité est ce qu'on achète dans ce métier, et elle ne dépend pas de l'inspiration : elle dépend d'une liste de contrôle appliquée avant chaque envoi, y compris — surtout — quand on est pressée. Cette leçon donne la liste, en douze points.

## Le contenu

### Pourquoi une checklist plutôt que de l'attention

L'attention est une ressource variable. Elle est excellente le mardi matin et mauvaise le jeudi soir après quatre montages. Une liste, elle, ne fatigue pas.

Deux principes : la liste se lit **à l'écran, une ligne à la fois**, jamais de mémoire ; et elle s'applique **même quand on est certaine**, parce que c'est précisément dans ces moments-là que les défauts passent.

### Les douze points, dans l'ordre

**Sur le fichier**

1. **Format et dimensions** conformes au brief : 9:16 en 1080 × 1920, plus les formats demandés.
2. **Durée** inférieure ou égale au maximum demandé. Vérifie au dixième de seconde : trente-quatre secondes pour un maximum de trente est un motif de reprise.
3. **Poids** raisonnable, sous 50 Mo pour trente secondes.
4. **Nommage** conforme à ta convention.

**Sur l'image**

5. **Aucun plan flou** ou tremblant. Regarde la vidéo en entier, à taille réelle, sur un téléphone — pas dans la fenêtre de montage.
6. **Aucun élément interdit** dans le champ : logo concurrent, personnel identifiable, élément daté.
7. **Produit conforme** : bonne référence, étiquette lisible, propre.

**Sur le son**

8. **Volume constant** d'un plan à l'autre. Un plan plus fort que les autres est le défaut le plus courant après un montage rapide.
9. **Musique licenciée** pour l'usage publicitaire, et sous la voix.

**Sur le texte**

10. **Sous-titres relus intégralement**, avec une attention particulière au nom de la marque et aux chiffres.
11. **Mentions obligatoires** présentes si le secteur en impose, et allégations interdites absentes.

**Sur la livraison**

12. **Lien testé en navigation privée**, tableau récapitulatif présent, facture jointe.

### Le contrôle qui compte le plus

Le point 5 mérite d'être isolé : **regarde chaque vidéo en entier, sur un téléphone, avant d'envoyer.**

Trois raisons. Le rendu diffère de celui de la fenêtre de montage. Les défauts se voient à taille réelle et pas autrement. Et c'est le seul moyen de percevoir le rythme comme le percevra le spectateur.

Deux minutes par vidéo. C'est le contrôle le plus rentable de tout le métier.

### Le contrôle croisé

Sur une commande importante, fais regarder une vidéo par quelqu'un d'autre — n'importe qui, sans consigne. Une seule question : « il y a un truc qui te gêne ? »

Un regard neuf repère en dix secondes ce que tu ne vois plus après trois heures de montage. C'est particulièrement vrai pour les défauts de son et les fautes de sous-titres.

### La régularité au-delà du fichier

Trois éléments que le client mesure sans le dire :

**Le délai tenu**, à chaque fois, sans exception.
**Le même niveau de qualité**, de la première à la vingtième vidéo.
**Le même mode de livraison** : même structure de dossier, même message, même nommage.

Ce dernier point est sous-estimé : un client qui reçoit toujours le même format de livraison n'a plus rien à apprendre à chaque commande, et cette absence de friction est une raison de rester.

### Le carnet des défauts

Tiens une liste courte des erreurs que tu as réellement commises. Trois lignes suffisent :

« Oublié de vérifier la durée — vidéo à 34 s refusée, janvier. »
« Sous-titre : "Nutrimax" au lieu de "NutriMax" — reprise, mars. »
« Musique du catalogue sur une pub — quatre remontages, avril. »

Relis-la avant chaque livraison importante. Une erreur qu'on a écrite ne se répète presque jamais ; une erreur qu'on a seulement subie se répète toujours.

## Exemple appliqué

Julie livre huit vidéos par mois à deux clients depuis six mois. Elle applique la liste depuis février, après une reprise pénible.

**Sa procédure, quinze minutes pour huit vidéos :**

Elle exporte tout, puis passe les fichiers sur son téléphone. Elle regarde les huit vidéos en entier, dans l'ordre, sans faire autre chose — seize minutes.

Elle note trois choses : la vidéo 3 a un plan à 0:11 légèrement flou, la vidéo 6 dure 31 secondes pour un maximum de 30, et les sous-titres de la vidéo 7 écrivent « 40g » alors qu'elle a dit « quarante grammes ».

Elle corrige les trois en douze minutes.

Puis elle passe les douze points sur chaque fichier : formats, poids, nommage, licence musicale, mentions. Six minutes.

**Le résultat sur six mois** : deux reprises au total, toutes deux sur des demandes de goût du client, aucune sur un défaut technique.

**Ce que le client lui a écrit au cinquième mois** : « on n'a jamais rien à vérifier avec vous, c'est pour ça qu'on ne cherche plus ailleurs. »

Cette phrase est la définition de la délivrabilité, et elle vaut plus que n'importe quel compliment sur la créativité.

## Les erreurs fréquentes

Vérifier de mémoire. La liste se lit à l'écran, ligne par ligne.

Sauter la liste quand on est pressée. C'est exactement le moment où les défauts passent.

Ne pas regarder la vidéo en entier sur un téléphone. C'est le contrôle le plus rentable, et le plus souvent sauté.

Ne pas vérifier la durée. Quatre secondes de trop suffisent à faire refuser une vidéo.

Ne pas relire les sous-titres. Les noms de marque sont systématiquement mal reconnus.

Changer de mode de livraison d'une fois sur l'autre. Le client doit réapprendre à chaque commande.

Ne pas tenir de carnet des défauts. Une erreur qu'on n'a pas écrite se répète.

## Action immédiate

Imprime les douze points et colle-les à côté de ton poste de montage. Puis, à ta prochaine livraison, applique-les dans l'ordre, à l'écran, en cochant. Ajoute enfin la règle du visionnage complet sur téléphone. Les deux premières fois te paraîtront lentes ; à la troisième, tu ne livreras plus jamais autrement.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"La checklist de contrôle en douze points","description":"Les douze points groupés par catégorie, le contrôle du visionnage sur téléphone, le contrôle croisé, les trois régularités que le client mesure et le carnet des défauts.","kind":"document","url":null,"body":"## La checklist de contrôle en douze points\n\nÀ lire **à l'écran**, ligne par ligne, jamais de mémoire — et **surtout quand\non est pressée**, parce que c'est là que les défauts passent.\n\n### Sur le fichier\n1. [ ] Format et dimensions conformes au brief\n2. [ ] **Durée ≤ maximum demandé** (34 s pour un max de 30 = reprise)\n3. [ ] Poids sous 50 Mo pour 30 s\n4. [ ] Nommage conforme à la convention\n\n### Sur l'image\n5. [ ] **Aucun plan flou ou tremblant** — vidéo regardée en entier, sur téléphone\n6. [ ] Aucun élément interdit : logo concurrent, personnel, daté\n7. [ ] Produit conforme : bonne référence, étiquette lisible, propre\n\n### Sur le son\n8. [ ] Volume constant d'un plan à l'autre\n9. [ ] Musique licenciée pour la publicité, sous la voix\n\n### Sur le texte\n10. [ ] Sous-titres relus **intégralement** (nom de marque, chiffres)\n11. [ ] Mentions obligatoires présentes, allégations interdites absentes\n\n### Sur la livraison\n12. [ ] Lien testé en navigation privée, tableau récapitulatif, facture jointe\n\n### Le contrôle le plus rentable du métier\n\n**Point 5 : regarde chaque vidéo en entier, sur un téléphone, avant d'envoyer.**\n\nLe rendu diffère de la fenêtre de montage · les défauts ne se voient qu'à\ntaille réelle · c'est le seul moyen de percevoir le rythme comme le\nspectateur. **Deux minutes par vidéo.**\n\n### Le contrôle croisé\n\nSur une commande importante, fais regarder une vidéo par quelqu'un d'autre,\nsans consigne. Une seule question : « il y a un truc qui te gêne ? »\n\nUn regard neuf repère en dix secondes ce que tu ne vois plus après trois\nheures de montage.\n\n### Les trois régularités que le client mesure sans le dire\n\nLe **délai** tenu à chaque fois · le **même niveau** de la première à la\nvingtième vidéo · le **même mode de livraison** (structure, message,\nnommage) — un client qui n'a plus rien à réapprendre a une raison de rester.\n\n### Le carnet des défauts\n\nTrois lignes suffisent. À relire avant chaque livraison importante.\n\n> Oublié de vérifier la durée — vidéo à 34 s refusée, janvier.\n> Sous-titre « Nutrimax » au lieu de « NutriMax » — reprise, mars.\n> Musique du catalogue sur une pub — quatre remontages, avril.\n\n**Une erreur qu'on a écrite ne se répète presque jamais.**\n"},{"title":"Carnet des défauts","description":"Trois lignes par erreur réellement commise, relues avant chaque livraison importante. Une erreur écrite ne se répète presque jamais.","kind":"template","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'c0d7d23f-9ad1-40be-bbb7-17b9bf31c642'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select 'fbbb8ac0-b1c7-4463-ad63-6ee6bd553922'::uuid, c.id, c.org_id, 'fideliser', $sq$Fidéliser et faire grandir le compte$sq$, $sq$Ce module travaille du côté où le rendement est cent fois meilleur : les trois messages de la fenêtre de dix jours après livraison, le passage à l'abonnement qui change la nature du métier, la lecture des performances qui permet de vendre un résultat plutôt qu'une vidéo, et la recommandation rendue systématique.$sq$, 13, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '67d67c3d-46fd-40ed-b8a0-3a3c3f254d84'::uuid, m.id, m.course_id, m.org_id, 'le-message-d-apres-livraison', $sq$Le message d'après-livraison qui déclenche la commande suivante$sq$, $sq$Un nouveau client coûte cent contacts ; un client existant coûte un message de six lignes. Les trois messages de la fenêtre des dix jours, dont celui de J+10 — le plus important du métier — qui obtient une information introuvable ailleurs.$sq$, $sq$## L'accroche

Trouver un nouveau client coûte environ cent contacts, dix réponses, quatre conversations et trois semaines. Faire revenir un client existant coûte un message de six lignes. Le rapport est de un à cent, et pourtant la quasi-totalité de l'énergie du métier se dépense du mauvais côté : on prospecte pendant qu'on livre, et on oublie de recontacter ceux qui ont déjà payé. Le moment décisif est étroit — les dix jours qui suivent une livraison. Passé ce délai, la marque est passée à autre chose et il faudra la reconquérir. Cette leçon donne les trois messages de cette fenêtre, et celui qui déclenche le plus de commandes suivantes.

## Le contenu

### La fenêtre des dix jours

Après une livraison, l'attention du client suit une courbe simple : très haute pendant trois jours, moyenne jusqu'à dix, quasi nulle ensuite.

Trois messages se placent dans cette fenêtre, et ils prennent trois minutes au total.

### Message 1 — J+3 : le contrôle

> Bonjour [Prénom], tout s'est bien passé à l'import ? Si vous avez besoin d'un format ou d'une version différente, dites-le-moi, c'est rapide.

Deux fonctions. Il attrape un problème technique avant qu'il ne devienne une contrariété silencieuse. Et il rappelle l'existence des déclinaisons, qui se vendent souvent à ce moment-là.

### Message 2 — J+10 : la performance

> Bonjour [Prénom], vous avez du recul sur les créas ? Je suis curieuse de savoir laquelle a le mieux tourné — ça m'aide à orienter les prochaines.

C'est **le message le plus important du métier**, et voilà pourquoi.

Il obtient une information que tu ne peux avoir nulle part ailleurs : quel angle fonctionne chez ce client. Cette information améliore toutes tes vidéos suivantes, chez lui et chez les autres.

Il présuppose une suite — « les prochaines » — sans rien demander.

Et il te positionne du côté de la performance, pas de la production. C'est la différence entre une prestataire et une partenaire.

Dans un cas sur trois, la réponse contient d'elle-même une nouvelle commande.

### Message 3 — J+18 : la proposition

Il ne s'envoie **que si les deux premiers ont obtenu une réponse**. Sinon, tu passes au suivi long.

> Bonjour [Prénom], puisque [angle] a bien tourné, je vous propose trois nouvelles vidéos sur cette piste : [angle 1], [angle 2], [angle 3]. Livrables sous 5 jours, [prix]. Je bloque un créneau la semaine prochaine si ça vous intéresse.

Trois éléments qui font la différence : la proposition **part de leurs résultats**, elle est **précise** — trois angles nommés, pas « d'autres vidéos » —, et elle contient une **contrainte de créneau** qui accélère la décision.

### Le suivi long

Pour les clients qui n'ont pas répondu, ou dont la commande était ponctuelle :

**J+75** — le message d'échéance des droits, vu au module 7. Il rapporte du revenu sans production et donne une information sur ce qui tourne encore.

**Tous les deux mois** — un message court avec un élément nouveau : une vidéo récente, une observation sur leur communication, un angle. Jamais « je reviens vers vous pour savoir si ».

**À chaque lancement produit repéré** — c'est le meilleur moment pour recontacter, et il se repère en suivant leurs réseaux.

### Ce qu'il ne faut pas faire

**Attendre que le client revienne.** Il ne reviendra pas : il a d'autres sujets, et une créatrice qui ne se manifeste plus disparaît de la liste.

**Demander « avez-vous d'autres projets ? ».** Question fermée, sans matière, qui obtient un « pas pour l'instant » qui ferme la porte trois mois.

**Envoyer une relance commerciale sans élément nouveau.** Elle se lit comme une sollicitation, pas comme une proposition.

**Envoyer les trois messages à un client qui n'a jamais répondu.** Deux suffisent ; au-delà, tu passes en suivi long.

### Le tableau de suivi client

Une ligne par client, cinq colonnes : nom, date de dernière livraison, résultat obtenu s'il est connu, prochaine action, date.

C'est le même mécanisme que le pipeline de prospection, appliqué à ceux qui ont déjà payé — et c'est celui qui rapporte le plus, puisqu'il travaille sur des relations qui existent déjà.

## Exemple appliqué

Manon livre six vidéos à une marque de thé le 4 mars.

**7 mars (J+3).** Message de contrôle. Réponse : « tout est nickel, on lance demain ». Elle ajoute : « on aurait besoin du format carré finalement ». Elle facture 4 × 40 € = 160 € pour vingt minutes de travail.

**14 mars (J+10).** Message de performance. Réponse détaillée : deux vidéos tournent, celle sur le dosage marche nettement mieux que les autres, le coût par achat est passé de 34 à 21 €.

**22 mars (J+18).** Elle propose trois nouvelles vidéos sur la piste « usages et dosage » : le thé glacé, le dosage pour deux personnes, le thé du soir. 750 €, livrables sous cinq jours, créneau bloqué la semaine du 1er avril.

**24 mars.** Commande validée.

**Bilan sur la relation** : 1 500 € de commande initiale, 160 € de déclinaisons, 750 € de recommande. 2 410 € en un mois, avec un seul effort de prospection — celui de janvier.

**Deux mois plus tard**, la marque passe en abonnement à 1 200 € par mois.

Le déclencheur de toute la chaîne est le message du 14 mars, qui a demandé quarante secondes d'écriture.

## Les erreurs fréquentes

Ne pas recontacter après une livraison. C'est l'erreur la plus coûteuse du métier, et elle est invisible.

Attendre plus de dix jours. Passé ce délai, la marque est passée à autre chose.

Demander « avez-vous d'autres projets ? ». Ça obtient un non qui ferme la porte pour trois mois.

Ne pas demander les performances. C'est l'information la plus précieuse du métier, et elle est gratuite.

Proposer « d'autres vidéos » sans préciser. Une proposition floue ne se décide pas.

Ne pas partir des résultats obtenus. Une proposition adossée à leurs chiffres se refuse difficilement.

Ne pas tenir de tableau de suivi client. On oublie ceux qui ont payé au profit de ceux qu'on n'a pas encore convaincus.

## Action immédiate

Reprends tes trois dernières livraisons. Pour chacune, envoie aujourd'hui le message correspondant à son ancienneté : contrôle si c'est récent, performance si c'est autour de dix jours, échéance de droits si c'est autour de soixante-quinze. Puis crée ton tableau de suivi client à cinq colonnes. Ces trois messages produiront probablement plus de résultat que ta semaine de prospection.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Les trois messages d'après-livraison","description":"Les trois messages mot pour mot avec leur rôle, le calendrier du suivi long, ce qu'il ne faut pas faire et le tableau de suivi client à cinq colonnes.","kind":"document","url":null,"body":"## Les trois messages d'après-livraison\n\n**La fenêtre est de dix jours.** Attention très haute pendant 3 jours, moyenne\njusqu'à 10, quasi nulle ensuite. Trois messages, trois minutes en tout.\n\n### J+3 — le contrôle\n\n> Bonjour [Prénom], tout s'est bien passé à l'import ? Si vous avez besoin\n> d'un format ou d'une version différente, dites-le-moi, c'est rapide.\n\nAttrape un problème technique avant qu'il ne devienne une contrariété\nsilencieuse, et rappelle l'existence des déclinaisons.\n\n### J+10 — la performance · **le message le plus important du métier**\n\n> Bonjour [Prénom], vous avez du recul sur les créas ? Je suis curieuse de\n> savoir laquelle a le mieux tourné — ça m'aide à orienter les prochaines.\n\n| Ce qu'il fait | Pourquoi ça compte |\n|---|---|\n| Obtient une info introuvable ailleurs | Améliore toutes tes vidéos suivantes |\n| Présuppose une suite (« les prochaines ») | Sans rien demander |\n| Te place du côté de la performance | Prestataire → **partenaire** |\n\n**Dans un cas sur trois, la réponse contient une nouvelle commande.**\n\n### J+18 — la proposition\n\n*Uniquement si les deux premiers ont obtenu une réponse.*\n\n> Bonjour [Prénom], puisque [angle] a bien tourné, je vous propose trois\n> nouvelles vidéos sur cette piste : [angle 1], [angle 2], [angle 3].\n> Livrables sous 5 jours, [prix]. Je bloque un créneau la semaine prochaine si\n> ça vous intéresse.\n\nPart de **leurs** résultats · **trois angles nommés**, pas « d'autres vidéos » ·\nune contrainte de créneau qui accélère la décision.\n\n### Le suivi long\n\n| Quand | Quoi |\n|---|---|\n| J+75 | Message d'échéance des droits |\n| Tous les 2 mois | Message court **avec un élément nouveau** |\n| À chaque lancement produit repéré | Le meilleur moment pour recontacter |\n\n### Ce qu'il ne faut pas faire\n\nAttendre que le client revienne · demander « avez-vous d'autres projets ? »\n(question fermée qui ferme la porte 3 mois) · relancer sans élément nouveau.\n\n### Le tableau de suivi client\n\n| Client | Dernière livraison | Résultat connu | Prochaine action | Date |\n|---|---|---|---|---|\n|  |  |  |  |  |\n"},{"title":"Tableau de suivi client","description":"Le pipeline appliqué à ceux qui ont déjà payé — celui qui rapporte le plus, puisqu'il travaille sur des relations qui existent.","kind":"template","url":null}]$sq$::jsonb, 1, true
from academy_modules m
where m.id = 'fbbb8ac0-b1c7-4463-ad63-6ee6bd553922'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '5b6ba462-a22c-4f30-b097-e847522704bf'::uuid, m.id, m.course_id, m.org_id, 'passer-a-l-abonnement', $sq$Passer d'une commande à un abonnement mensuel$sq$, $sq$Dix clients ponctuels et trois clients en abonnement peuvent rapporter autant, mais ce n'est pas le même métier. Le bon moment, la proposition mot pour mot avec son option de repli, les cinq clauses à écrire et les quatre objections classiques.$sq$, $sq$## L'accroche

Une créatrice avec dix clients ponctuels et une créatrice avec trois clients en abonnement peuvent gagner la même somme. Elles ne font pas le même métier. La première prospecte en permanence, ne sait jamais de quoi son mois prochain sera fait, et négocie chaque commande. La seconde connaît son chiffre d'affaires du trimestre, tourne en lots, et consacre le temps libéré à monter en gamme. Le passage à l'abonnement est la transition la plus structurante du métier, et il ne dépend pas de l'ancienneté : il dépend d'une proposition faite au bon moment, dans les bons termes. La plupart des créatrices ne le proposent jamais, en attendant que le client le demande. Il ne le demandera pas. Cette leçon donne le moment, la formulation et les clauses.

## Le contenu

### Le bon moment

Un abonnement se propose **après la deuxième commande réussie**, jamais avant.

Avant, tu n'as pas la preuve que la collaboration fonctionne, et la marque n'a pas la preuve que tu tiens tes délais. Après trois ou quatre commandes ponctuelles, une routine s'installe et il devient plus difficile de changer la forme de la relation.

Le signal idéal : le client revient de lui-même pour une deuxième commande, et il te dit que la première a bien fonctionné.

### Ce que l'abonnement apporte au client

C'est ce qu'il faut dire, et pas les avantages pour toi.

**Un prix unitaire plus bas.** 15 à 20 % de moins qu'à l'unité.

**Un créneau réservé.** Il n'a plus à vérifier ta disponibilité ni à s'y prendre à l'avance.

**Un délai raccourci.** Tu connais la marque, tu produis plus vite.

**Une cohérence.** Les vidéos d'un même trimestre se ressemblent, ce qui sert sa marque.

**Moins de gestion.** Un devis, une facture par mois, un point de brief.

### Ce qu'il t'apporte

Un revenu prévisible, la disparition de la prospection sur ce client, le tournage en lots — donc un temps unitaire divisé — et la capacité de planifier ta vie.

### La formulation

Elle part de ce qui vient de se passer, pas d'une offre abstraite.

> Bonjour [Prénom],
>
> Puisqu'on est sur la deuxième série et que le rythme fonctionne, je vous propose de passer sur un format mensuel : **6 vidéos par mois, 1 200 €, engagement de 3 mois.**
>
> Concrètement, ça vous donne : un prix unitaire à 200 € au lieu de 250, un créneau de production réservé chaque mois, une livraison en 3 jours au lieu de 5, et un seul point de brief de trente minutes en début de mois.
>
> De mon côté, ça me permet de bloquer le temps et d'aller plus vite parce que je connais vos produits.
>
> Si le volume vous semble élevé, on peut démarrer à 4 vidéos par mois à 880 €. Dites-moi ce qui vous arrange.

Quatre points font que ça fonctionne : le chiffre précis, les bénéfices **pour eux** en premier, l'honnêteté sur ce que tu y gagnes, et une option de repli qui évite le « non » sec.

### Les cinq clauses à écrire

**Le volume mensuel** et la durée d'engagement — trois mois minimum.

**La facturation à échéance fixe**, consommée ou non. C'est une capacité réservée, pas un volume à consommer. Sans cette clause, l'abonnement devient une option gratuite pour le client.

**Le report d'une vidéo** non commandée sur le mois suivant, **une seule fois**. Ça rassure sans ouvrir un stock infini.

**Le délai de brief** : les briefs du mois doivent arriver avant une date, sinon le rythme glisse.

**La révision tarifaire** à chaque renouvellement d'engagement. Sans elle, un abonnement signé aujourd'hui te bloque à ce prix pendant deux ans.

### Les objections classiques

**« On préfère voir au fil de l'eau. »**
> Je comprends. On peut faire un premier engagement de deux mois seulement, pour tester le rythme — ensuite on ajuste.

**« Six par mois c'est trop. »**
> Alors partons sur quatre. L'intérêt est le rythme, pas le volume.

**« Et si on n'a pas de produit à mettre en avant un mois ? »**
> On reporte une vidéo sur le mois suivant, une fois par trimestre. Au-delà, on ajuste le volume au renouvellement.

**« On doit faire valider un engagement. »**
> Bien sûr. Je vous envoie une proposition d'une page, avec les conditions, pour votre validation interne.

### Le renouvellement

Trois semaines avant la fin de l'engagement, tu écris.

> Bonjour [Prénom], notre engagement se termine fin [mois]. Je vous propose de repartir sur trois mois. À cette occasion, mes tarifs évoluent : le mensuel passe de 1 200 à 1 320 €. Le volume et le délai restent identiques. Dites-moi si ça vous convient.

C'est le moment naturel de la hausse tarifaire : elle est attendue, elle est adossée à un renouvellement, et elle ne surprend personne.

## Exemple appliqué

Alicia a livré deux commandes à une marque de compléments : quatre vidéos en janvier, cinq en février. Les deux ont bien fonctionné.

**Début mars**, elle envoie la proposition d'abonnement : 6 vidéos par mois, 1 200 €, engagement trois mois, avec l'option de repli à 4 vidéos.

**La réponse** : « intéressant, mais on ne peut pas s'engager sur trois mois en interne. Deux, c'est possible. »

Elle accepte deux mois, avec les cinq clauses écrites.

**Ce que ça change immédiatement** : elle tourne les six vidéos en une seule session de quatre heures, au lieu de deux sessions étalées. Son temps unitaire passe de 2 h 10 à 45 minutes.

**Fin du deuxième mois** : le client renouvelle, cette fois sur trois mois, et accepte la hausse à 1 320 €.

**Six mois plus tard** : deux abonnements et une marque en ponctuel. 2 900 € de revenu prévisible chaque mois, une session de tournage par mois, et zéro prospection sur ces clients.

**Ce qu'elle fait du temps libéré** : elle démarche des agences, ce qui lui apporte un troisième abonnement en septembre.

Le point de bascule est un seul message, envoyé après la deuxième commande.

## Les erreurs fréquentes

Attendre que le client propose. Il ne le fera pas ; il ne sait pas que c'est possible.

Proposer trop tôt. Avant la deuxième commande réussie, il n'y a pas de preuve de part et d'autre.

Ne présenter que ses propres avantages. Le client achète ce que ça lui apporte à lui.

Oublier la clause de facturation à échéance fixe. L'abonnement devient une option gratuite.

Ne pas prévoir de révision tarifaire au renouvellement. Un prix signé aujourd'hui te bloque pour deux ans.

Accepter un engagement d'un mois. C'est du ponctuel déguisé, avec la remise en plus.

Ne pas prévoir de repli. Un « six par mois » sans alternative obtient un non sec.

## Action immédiate

Identifie le client avec lequel tu as fait au moins deux commandes réussies, et envoie-lui la proposition d'abonnement cette semaine, en reprenant la formulation ci-dessus avec tes chiffres. Prévois l'option de repli. Si tu n'as pas encore deux commandes chez un même client, écris quand même le message et garde-le : tu l'enverras au bon moment, et c'est le message qui change le plus la vie de ce métier.$sq$, 12, 'none'::academy_video_provider, $sq$[{"title":"Passer à l'abonnement","description":"Le moment de la proposition, le tableau des bénéfices client et créatrice, la proposition rédigée, les cinq clauses et les réponses aux quatre objections.","kind":"document","url":null,"body":"## Passer à l'abonnement\n\n### Le bon moment\n\n**Après la deuxième commande réussie.** Avant : aucune preuve de part et\nd'autre. Après trois ou quatre commandes ponctuelles : une routine s'installe\net il devient difficile de changer la forme de la relation.\n\n### Ce qu'il apporte — au client d'abord\n\n| Pour lui | Pour toi |\n|---|---|\n| Prix unitaire −15 à −20 % | Revenu prévisible |\n| Créneau réservé | Zéro prospection sur ce client |\n| Délai raccourci | Tournage en lots, temps unitaire divisé |\n| Cohérence visuelle du trimestre | Capacité de planifier sa vie |\n| Un devis, une facture, un brief par mois | — |\n\n### La proposition\n\n> Bonjour [Prénom],\n>\n> Puisqu'on est sur la deuxième série et que le rythme fonctionne, je vous\n> propose de passer sur un format mensuel : **6 vidéos par mois, 1 200 €,\n> engagement de 3 mois.**\n>\n> Concrètement, ça vous donne : un prix unitaire à 200 € au lieu de 250, un\n> créneau de production réservé chaque mois, une livraison en 3 jours au lieu\n> de 5, et un seul point de brief de trente minutes en début de mois.\n>\n> De mon côté, ça me permet de bloquer le temps et d'aller plus vite parce que\n> je connais vos produits.\n>\n> Si le volume vous semble élevé, on peut démarrer à 4 vidéos par mois à 880 €.\n> Dites-moi ce qui vous arrange.\n\nChiffre précis · bénéfices **pour eux** en premier · honnêteté sur ton gain ·\n**option de repli** qui évite le non sec.\n\n### Les cinq clauses à écrire\n\n1. **Volume mensuel** et durée d'engagement (3 mois minimum)\n2. **Facturation à échéance fixe, consommée ou non** — c'est une capacité\n   réservée. *Sans cette clause, l'abonnement est une option gratuite.*\n3. **Report d'une vidéo** sur le mois suivant, **une seule fois**\n4. **Délai de brief** : les briefs arrivent avant une date, sinon le rythme glisse\n5. **Révision tarifaire** à chaque renouvellement\n\n### Les quatre objections\n\n| Objection | Réponse |\n|---|---|\n| « On préfère voir au fil de l'eau » | « Un premier engagement de deux mois, pour tester le rythme » |\n| « Six par mois c'est trop » | « Partons sur quatre. L'intérêt est le rythme, pas le volume » |\n| « Et si on n'a rien à mettre en avant ? » | « On reporte une vidéo, une fois par trimestre » |\n| « On doit faire valider » | « Je vous envoie une proposition d'une page pour votre validation interne » |\n\n### Le renouvellement — trois semaines avant la fin\n\n> Notre engagement se termine fin [mois]. Je vous propose de repartir sur trois\n> mois. À cette occasion, mes tarifs évoluent : le mensuel passe de 1 200 à\n> 1 320 €. Le volume et le délai restent identiques.\n\n**C'est le moment naturel de la hausse** : elle est attendue et ne surprend\npersonne.\n"},{"title":"Checklist de renouvellement","description":"Trois semaines avant la fin de l'engagement : proposer trois mois de plus et annoncer la hausse. C'est le moment naturel, et il ne surprend personne.","kind":"checklist","url":null}]$sq$::jsonb, 2, true
from academy_modules m
where m.id = 'fbbb8ac0-b1c7-4463-ad63-6ee6bd553922'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '9f8b2141-a92b-4a71-a48b-bb821b97c208'::uuid, m.id, m.course_id, m.org_id, 'lire-les-performances', $sq$Lire les performances de tes vidéos et t'en servir pour vendre$sq$, $sq$Une créatrice qui documente ses résultats n'est plus comparable à une créatrice qui documente son délai. Les trois indicateurs et à qui chacun appartient, les formulations qui les obtiennent, et le carnet de performance qui devient l'outil commercial le plus fort.$sq$, $sq$## L'accroche

Une créatrice qui sait dire « ma vidéo sur le dosage a fait baisser votre coût par achat de 34 à 21 € » ne vend plus des vidéos : elle vend un résultat, et elle le vend au prix qu'elle veut. Une créatrice qui ne sait rien des performances de son travail est condamnée à parler de son processus, de son matériel et de son délai — c'est-à-dire à être comparée sur le prix. La différence entre les deux ne tient pas à un accès privilégié aux données : elle tient à une habitude, celle de demander, et à la capacité de comprendre trois indicateurs. Cette leçon donne les indicateurs, les questions qui les obtiennent, et l'usage commercial qu'on en fait.

## Le contenu

### Les trois indicateurs à connaître

**La rétention à 3 secondes.** Le pourcentage de personnes encore présentes après trois secondes. C'est **ton** indicateur : il mesure l'accroche, et rien d'autre ne l'influence.

Un bon niveau se situe autour de 25 à 40 % selon les plateformes et les secteurs. En dessous de 20 %, le hook est à revoir.

**Le taux de clic sortant.** Le pourcentage de gens qui cliquent vers le site. Il mesure la capacité de la vidéo à donner envie. Il dépend de ta vidéo **et** de l'offre.

**Le coût par achat.** Ce que la marque dépense en publicité pour une vente. C'est l'indicateur du client, pas le tien : il dépend du prix, de la page produit, du ciblage. Tu peux le faire baisser, tu ne le contrôles pas.

Cette distinction est essentielle : **assume la rétention, revendique le clic, ne promets jamais le coût par achat.**

### Comment les obtenir

La plupart des marques les donnent volontiers si on demande simplement. Trois formulations :

> Vous avez du recul sur les créas ? Je suis curieuse de savoir laquelle a le mieux tourné.

> Est-ce que vous avez la rétention à 3 secondes sur les trois hooks ? Ça m'aiderait à orienter les prochaines.

> Sans chiffres précis si c'est confidentiel : est-ce qu'il y en a une qui se détache ?

La troisième débloque les marques réticentes : elle demande un classement, pas des données.

### Ce qu'on en fait, concrètement

**Améliorer.** Si le hook « contre-pied » gagne systématiquement chez trois clients différents, tu en fais ton hook par défaut. Tes vidéos deviennent meilleures sans que ton travail augmente.

**Vendre au même client.** « Puisque l'angle prix a bien tourné, je vous propose trois vidéos sur cette piste. » C'est le message du J+18, et il s'appuie sur leurs chiffres.

**Vendre à d'autres clients.** « Sur une marque de compléments, mes vidéos ont fait baisser le coût par achat de 38 %. » C'est l'argument le plus fort d'un message de prospection, et il est vrai.

**Justifier un prix.** Une créatrice qui documente ses résultats n'est plus comparable à une créatrice qui documente son délai.

### Le carnet de performance

Une page, une ligne par vidéo livrée : le client, l'angle, le hook, et le résultat connu.

| Client | Angle | Hook | Résultat connu |
|---|---|---|---|
| Marque thé | dosage | question | meilleure des 6, CPA −38 % |
| Marque sport | objection prix | contre-pied | rétention 3 s la plus haute |
| Marque soin | usage quotidien | situation | pas de retour |

Au bout de six mois, ce tableau contient une vingtaine de lignes et devient ton meilleur outil commercial — et ton meilleur outil créatif, parce qu'il montre ce qui marche pour **toi**, avec ton visage et ton ton.

### Ce qu'on ne fait jamais avec des chiffres

**Promettre un résultat.** « Je vous garantis un coût par achat sous 20 € » est intenable et te met en défaut.

**Citer un client nommément sans accord.** Les performances publicitaires sont des données sensibles. Anonymise : « une marque de compléments », pas le nom.

**S'attribuer un résultat global.** Si la marque a changé son prix le même mois, la baisse du coût par achat ne t'appartient pas entièrement. Dis « mes créas ont accompagné une baisse de », pas « j'ai fait baisser ».

**Se décourager d'un mauvais chiffre.** Une vidéo qui ne performe pas peut avoir dix causes hors de ton contrôle. Ce qui compte, c'est la tendance sur dix vidéos, pas une.

### Quand le client ne donne rien

Certaines marques ne communiquent aucune donnée. Deux solutions.

**Les indicateurs publics.** Si la vidéo est diffusée en organique, les vues, les partages et les commentaires sont visibles. C'est imparfait mais indicatif.

**La commande suivante.** Le meilleur indicateur de performance est qu'on te recommande. Une marque qui repasse commande après avoir diffusé a obtenu ce qu'elle voulait, même sans le dire.

## Exemple appliqué

Nina livre depuis huit mois et n'a jamais demandé de chiffres. Elle commence en septembre.

**Sur ses six clients actifs**, elle envoie le message de performance à J+10. Quatre répondent.

**Ce qu'elle apprend :**

- Chez la marque de sport, le hook « contre-pied » a une rétention de 41 % contre 26 % pour le hook « problème ».
- Chez la marque de compléments, la vidéo « avant/après » a un taux de clic double des autres.
- Chez la marque de cuisine, la vidéo la plus longue — 45 secondes — performe mieux que les courtes, ce qui va contre tout ce qu'elle croyait.
- Chez la quatrième, aucune ne se détache.

**Ce qu'elle en fait :**

Elle met le contre-pied en hook par défaut sur ses propositions. Elle propose systématiquement un avant/après quand le produit s'y prête. Elle arrête de raccourcir ses vidéos par principe.

**En prospection**, son message change. Il contient désormais : « sur mes dernières campagnes, les hooks en contre-pied obtiennent une rétention à 3 secondes de 40 % là où l'accroche classique plafonne à 25 %. »

**Le résultat sur trois mois** : son taux de réponse en prospection passe de 9 % à 17 %. Et elle augmente ses tarifs de 20 % sans perdre un client, parce qu'elle ne vend plus une vidéo mais une hypothèse documentée.

Tout est parti de quatre messages de quarante secondes.

## Les erreurs fréquentes

Ne jamais demander les chiffres. C'est l'information la plus précieuse du métier, et elle est gratuite.

Demander des données confidentielles trop directement. La formulation « il y en a une qui se détache ? » débloque presque toujours.

Promettre un coût par achat. Tu ne contrôles ni le prix, ni la page produit, ni le ciblage.

S'attribuer tout un résultat. « Mes créas ont accompagné une baisse » est vrai ; « j'ai fait baisser » ne l'est pas toujours.

Citer un client nommément. Anonymise : le secteur suffit.

Se décourager d'une vidéo qui ne marche pas. La tendance sur dix vidéos compte, pas une.

Ne pas tenir de carnet. Au bout de six mois, c'est ton meilleur outil commercial et créatif.

## Action immédiate

Envoie aujourd'hui le message de performance à tes trois dernières livraisons, en utilisant la formulation souple si tu penses que le client sera réticent. Puis crée ton carnet de performance à quatre colonnes et remplis-le avec ce que tu sais déjà, même approximativement. Dans six mois, ce tableau vaudra plus que ton portfolio.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Lire les performances de ses vidéos","description":"Le tableau des trois indicateurs, les trois formulations pour les obtenir dont celle qui débloque les marques réticentes, les quatre usages et le carnet de performance.","kind":"document","url":null,"body":"## Lire les performances de ses vidéos\n\n### Les trois indicateurs\n\n| Indicateur | Ce qu'il mesure | À qui il appartient |\n|---|---|---|\n| **Rétention à 3 s** | L'accroche, et rien d'autre | **Toi** — assume-la |\n| Taux de clic sortant | L'envie donnée | Toi + l'offre — revendique-le |\n| Coût par achat | La rentabilité de la campagne | Le client — **ne le promets jamais** |\n\nBon niveau de rétention à 3 s : **25 à 40 %**. Sous 20 %, le hook est à revoir.\n\n### Les trois formulations pour les obtenir\n\n> Vous avez du recul sur les créas ? Je suis curieuse de savoir laquelle a le\n> mieux tourné.\n\n> Est-ce que vous avez la rétention à 3 secondes sur les trois hooks ?\n\n> Sans chiffres précis si c'est confidentiel : est-ce qu'il y en a une qui se\n> détache ?\n\n**La troisième débloque les marques réticentes** : elle demande un classement,\npas des données.\n\n### Les quatre usages\n\n1. **Améliorer** — le hook qui gagne partout devient ton défaut\n2. **Vendre au même client** — le message J+18, adossé à leurs chiffres\n3. **Vendre à d'autres** — « sur une marque de compléments, mes vidéos ont\n   accompagné une baisse de 38 % du coût par achat »\n4. **Justifier un prix** — documenter des résultats, pas un délai\n\n### Le carnet de performance\n\n| Client | Angle | Hook | Résultat connu |\n|---|---|---|---|\n| Marque thé | dosage | question | meilleure des 6, CPA −38 % |\n| Marque sport | objection prix | contre-pied | rétention 3 s la plus haute |\n| Marque soin | usage quotidien | situation | pas de retour |\n\nAu bout de six mois : **ton meilleur outil commercial et créatif**, parce qu'il\nmontre ce qui marche avec **ton** visage et **ton** ton.\n\n### Les quatre choses à ne jamais faire\n\nPromettre un résultat chiffré · citer un client nommément (anonymise par\nsecteur) · s'attribuer tout un résultat (« mes créas ont accompagné », pas\n« j'ai fait ») · se décourager d'un mauvais chiffre — c'est la tendance sur\ndix vidéos qui compte.\n\n### Quand le client ne donne rien\n\nLes **indicateurs publics** en organique (vues, partages, commentaires) · et\nsurtout **la commande suivante** : une marque qui repasse commande a obtenu ce\nqu'elle voulait, même sans le dire.\n"},{"title":"Carnet de performance","description":"Une ligne par vidéo livrée : client, angle, hook, résultat connu. Au bout de six mois, il vaut plus que ton portfolio.","kind":"template","url":null}]$sq$::jsonb, 3, true
from academy_modules m
where m.id = 'fbbb8ac0-b1c7-4463-ad63-6ee6bd553922'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '431b6763-4033-40a0-b289-4a097174f92b'::uuid, m.id, m.course_id, m.org_id, 'les-recommandations', $sq$Les recommandations : faire venir les marques par les marques$sq$, $sq$Une recommandation convertit à 50-70 % contre 1 à 2 % en démarchage froid, et elle se provoque. Les trois sources dont le réseau de créatrices, le message prêt à transférer qui multiplie les recommandations effectives, et ce qui les empêche.$sq$, $sq$## L'accroche

Une créatrice de dix-huit mois d'activité tire 60 % de son chiffre d'affaires de clients qu'elle n'a jamais démarchés. Ils sont venus par trois chemins : une marque a parlé d'elle à une autre, une agence l'a recommandée à un confrère, un ancien client a changé d'entreprise et l'a emmenée avec lui. Aucun de ces trois chemins n'est le fruit du hasard : tous se provoquent, avec des gestes simples que presque personne ne fait — demander, faciliter, et rester présente. La recommandation est le canal le moins coûteux et le mieux converti du métier ; c'est aussi celui qu'on laisse le plus au hasard. Cette leçon le rend systématique.

## Le contenu

### Pourquoi la recommandation convertit si bien

Un prospect recommandé arrive avec trois choses qu'un prospect froid n'a pas : la preuve sociale, la confiance sur les délais, et souvent une idée du prix, déjà acceptée.

Le taux de conversion d'une recommandation se situe autour de 50 à 70 %, contre 1 à 2 % en démarchage froid.

### Les trois sources de recommandation

**Les clients satisfaits.** Ils recommandent naturellement, mais seulement si on leur en donne l'occasion.

**Les agences.** Une agence qui travaille bien avec toi te propose à d'autres clients internes. C'est la source la plus productive.

**Les autres créatrices.** Contre-intuitif et pourtant très réel : une créatrice complète, indisponible ou hors niche, passe la main. Encore faut-il qu'elle sache que tu existes et ce que tu fais.

### Demander une recommandation

Le moment : **juste après un retour positif.** Pas trois mois plus tard.

> Merci beaucoup, ça me touche. Si vous connaissez d'autres marques qui cherchent des créas vidéo, je serais ravie que vous leur passiez mon nom — c'est comme ça que je trouve mes meilleurs clients.

Deux détails comptent. La demande est **explicite** — beaucoup de clients ne pensent tout simplement pas à recommander. Et elle explique **pourquoi**, ce qui la rend légitime plutôt que quémandeuse.

### Faciliter la recommandation

Une recommandation demande un effort à celui qui la fait. Réduis cet effort à zéro.

**Un message prêt à transférer.** Envoie-le après la demande :

> Si ça peut aider, voici un message que vous pouvez transférer tel quel :
>
> « Bonjour, je te recommande [Prénom], créatrice UGC en [niche]. Elle a produit nos dernières créas vidéo, livrées en 5 jours, très bon rapport qualité/prix. Son portfolio : [lien]. Son email : [email]. »

Cette phrase multiplie les recommandations effectives, parce qu'elle supprime le seul obstacle réel : avoir à écrire quelque chose.

**Un portfolio à jour**, qu'on peut envoyer sans réfléchir.

### Le témoignage écrit

Demande-le au même moment, et sois précise sur ce que tu veux.

> Est-ce que je peux vous demander deux ou trois phrases sur notre collaboration ? Le plus utile pour moi, ce serait ce qui vous a décidée à travailler avec moi, et ce qui a bien marché.

Deux ou trois phrases se donnent en deux minutes ; « un témoignage » paraît être un devoir. Précise le format.

Ce témoignage va dans ton portfolio, dans ton media kit, et dans tes messages de prospection.

### Les créatrices comme réseau

C'est le point le plus contre-intuitif du module, et il fonctionne remarquablement.

Une créatrice qui refuse une mission — planning plein, hors niche, budget bas — cherche souvent quelqu'un à recommander. Si tu es dans sa tête, tu récupères la mission.

Trois gestes : connais cinq créatrices dans des niches différentes de la tienne, dis-leur explicitement ce que tu fais et ce que tu ne fais pas, et **recommande-les en premier**. La réciprocité est presque automatique dans ce métier.

C'est aussi ce qui rend un refus utile : quand tu refuses une mission, tu recommandes quelqu'un — et cette personne se souviendra.

### Rester présente

Deux gestes trimestriels, dix minutes chacun.

**Un message aux anciens clients** avec un élément nouveau : une vidéo récente, un format que tu proposes désormais, une observation.

**Un suivi des changements de poste.** Un client qui change d'entreprise est le meilleur prospect qui existe : il connaît ton travail et arrive dans une structure où personne ne te connaît. LinkedIn signale ces changements.

### Ce qui empêche les recommandations

**Un délai raté.** Personne ne recommande quelqu'un dont il n'est pas sûr.

**Une relation purement transactionnelle.** Un client qui n'a jamais parlé à un être humain ne recommande pas un fournisseur.

**Un portfolio périmé.** Si ce qu'on envoie ne ressemble plus à ce que tu fais, la recommandation dessert.

**Le silence.** Une créatrice dont on n'a plus de nouvelles depuis huit mois ne vient plus à l'esprit.

## Exemple appliqué

Chloé, quatorze mois d'activité, décide de rendre la recommandation systématique.

**Ce qu'elle met en place :**

À chaque retour positif, la demande explicite plus le message prêt à transférer. Elle le fait sept fois en trois mois.

Un témoignage demandé au même moment, avec le format précisé. Elle en obtient cinq sur sept.

Cinq créatrices identifiées dans d'autres niches — beauté, food, tech, animaux, enfants — à qui elle écrit pour se présenter et préciser sa niche à elle, la maison et le rangement. Elle leur recommande deux marques dans les semaines qui suivent.

Un message trimestriel à ses anciens clients.

**Les résultats sur six mois :**

- Trois clients arrivés par recommandation directe de clients satisfaits.
- Deux missions passées par des créatrices dont le planning était plein.
- Une agence recommandée par une autre agence.
- Un ancien client passé chez un concurrent, qui l'a fait venir dans sa nouvelle entreprise.

Sept clients sur les onze qu'elle a signés dans la période. Coût de prospection : zéro.

**Ce qui a produit le plus** : le message prêt à transférer. Sur les sept demandes, cinq ont donné lieu à un transfert effectif — un taux qu'elle n'obtenait jamais avec une simple demande orale.

## Les erreurs fréquentes

Ne pas demander. La plupart des clients ne pensent simplement pas à recommander.

Demander trop tard. Le bon moment est juste après un retour positif.

Ne pas faciliter. Une recommandation qui demande d'écrire un message n'est pas faite.

Demander « un témoignage » sans préciser le format. Deux ou trois phrases se donnent ; un devoir se remet à plus tard.

Ignorer les autres créatrices. C'est un réseau de recommandation mutuelle très efficace, et presque inexploité.

Ne pas suivre les changements de poste. Un ancien client dans une nouvelle entreprise est le meilleur prospect qui existe.

Disparaître. Une créatrice silencieuse depuis huit mois ne vient plus à l'esprit de personne.

## Action immédiate

Envoie aujourd'hui, à ton dernier client satisfait, la demande de recommandation avec le message prêt à transférer et la demande de témoignage en deux phrases. Puis identifie cinq créatrices dans des niches différentes de la tienne et écris-leur pour te présenter. Ces deux gestes prennent une heure et construisent le canal qui, dans un an, apportera la majorité de tes clients.$sq$, 11, 'none'::academy_video_provider, $sq$[{"title":"Faire venir les marques par les marques","description":"Le tableau des trois sources, la demande explicite, le message prêt à transférer mot pour mot, la demande de témoignage et les trois gestes du réseau de créatrices.","kind":"document","url":null,"body":"## Faire venir les marques par les marques\n\n**Taux de conversion d'une recommandation : 50 à 70 %**, contre 1 à 2 % en\ndémarchage froid.\n\n### Les trois sources\n\n| Source | Productivité | Comment l'activer |\n|---|---|---|\n| Clients satisfaits | Bonne | Demander **explicitement**, juste après un retour positif |\n| **Agences** | La meilleure | Bien livrer : elles proposent à leurs autres clients |\n| **Autres créatrices** | Sous-exploitée | Se faire connaître, et recommander en premier |\n\n### Demander — juste après un retour positif\n\n> Merci beaucoup, ça me touche. Si vous connaissez d'autres marques qui\n> cherchent des créas vidéo, je serais ravie que vous leur passiez mon nom —\n> c'est comme ça que je trouve mes meilleurs clients.\n\nExplicite (beaucoup de clients n'y pensent pas) et **expliquée** (légitime,\npas quémandeuse).\n\n### Faciliter — le message prêt à transférer\n\n> Si ça peut aider, voici un message que vous pouvez transférer tel quel :\n>\n> « Bonjour, je te recommande [Prénom], créatrice UGC en [niche]. Elle a\n> produit nos dernières créas vidéo, livrées en 5 jours, très bon rapport\n> qualité/prix. Son portfolio : [lien]. Son email : [email]. »\n\n**C'est ce qui multiplie les recommandations effectives** : le seul obstacle\nréel est d'avoir à écrire quelque chose.\n\n### Le témoignage — préciser le format\n\n> Est-ce que je peux vous demander deux ou trois phrases sur notre\n> collaboration ? Le plus utile pour moi, ce serait ce qui vous a décidée à\n> travailler avec moi, et ce qui a bien marché.\n\n« Deux ou trois phrases » se donne en deux minutes ; « un témoignage » paraît\nêtre un devoir.\n\n### Le réseau de créatrices — trois gestes\n\n1. Connais **cinq créatrices** dans des niches différentes de la tienne\n2. Dis-leur explicitement ce que tu fais **et ce que tu ne fais pas**\n3. **Recommande-les en premier** — la réciprocité est presque automatique\n\nC'est aussi ce qui rend un refus utile : quand tu refuses une mission, tu\nrecommandes quelqu'un, et cette personne s'en souviendra.\n\n### Rester présente — deux gestes trimestriels\n\nUn message aux anciens clients **avec un élément nouveau** · un suivi des\n**changements de poste** sur LinkedIn : un ancien client dans une nouvelle\nentreprise est le meilleur prospect qui existe.\n\n### Ce qui empêche les recommandations\n\nUn délai raté · une relation purement transactionnelle · un portfolio périmé ·\n**le silence** — une créatrice dont on n'a plus de nouvelles depuis huit mois\nne vient plus à l'esprit.\n"},{"title":"Checklist trimestrielle de présence","description":"Un message aux anciens clients avec un élément nouveau, et un tour des changements de poste sur LinkedIn. Vingt minutes par trimestre.","kind":"checklist","url":null}]$sq$::jsonb, 4, true
from academy_modules m
where m.id = 'fbbb8ac0-b1c7-4463-ad63-6ee6bd553922'::uuid
on conflict (id) do nothing;

insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '4112806f-8596-4b94-b80e-abf8553a9613'::uuid, c.id, c.org_id, 'gerer-son-activite', $sq$Gérer son activité et durer$sq$, $sq$Ce module ferme la boucle : le cadre administratif minimal pour facturer légalement, le pilotage d'une trésorerie que trois décalages structurels rendent tendue, la semaine en blocs qui fait produire plus en travaillant moins, les quatre causes du burn-out créatif — premier motif d'abandon du métier — et les trois voies pour dépasser le plafond du temps.$sq$, 14, true
from academy_courses c
where c.id = 'ddd9126d-6471-4de4-abf4-07e24c097cff'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'd71ba2db-c3a7-4fec-a7a8-70a966457aa2'::uuid, m.id, m.course_id, m.org_id, 'statut-et-facturation', $sq$Statut, factures, TVA : le minimum légal en France$sq$, $sq$Trente minutes en ligne, gratuit, et le cadre tient sur une page. La micro-entreprise en cinq points, les sept mentions obligatoires d'une facture, la règle de provision qui supprime la seule vraie catastrophe du métier, et ce qui n'est pas nécessaire.$sq$, $sq$## L'accroche

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
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select 'fa9df65a-9c8e-41c5-8152-8351a3dea72f'::uuid, m.id, m.course_id, m.org_id, 'tresorerie', $sq$Se faire payer : trésorerie, décalages, mois creux$sq$, $sq$La trésorerie est ce qui tue les activités rentables. Les trois décalages structurels du métier, les trois habitudes qui les absorbent, le tableau qui fait voir un trou un mois à l'avance et les six leviers quand ça se tend.$sq$, $sq$## L'accroche

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
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '4f5a05a2-823a-4e81-b397-5a6ce0e40613'::uuid, m.id, m.course_id, m.org_id, 'organiser-sa-semaine', $sq$Organiser sa semaine : blocs de tournage et jours d'administratif$sq$, $sq$Une créatrice à temps plein travaille quarante-cinq heures et en facture douze. Le problème n'est pas la charge, c'est la fragmentation. Les quatre activités et leur poids, la semaine en cinq blocs, la règle des lots et les quatre rendez-vous mensuels.$sq$, $sq$## L'accroche

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
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '0d80b647-57f6-4023-92c8-7801e6d43dd6'::uuid, m.id, m.course_id, m.org_id, 'tenir-dans-la-duree', $sq$Le burn-out créatif : rythme tenable, stock d'idées$sq$, $sq$Le premier motif d'abandon après le sixième mois n'est pas le manque de clients. Les quatre causes de l'épuisement, le stock d'idées qui supprime définitivement la page blanche, les trois règles de rythme et les quatre signaux à reconnaître.$sq$, $sq$## L'accroche

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
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;

insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '1a55c981-ec31-44a8-8783-6129e006fec9'::uuid, m.id, m.course_id, m.org_id, 'de-creatrice-a-studio', $sq$De créatrice à studio : déléguer, recruter, ou monter en gamme$sq$, $sq$Au bout de dix-huit mois vient un plafond arithmétique : le temps. Trois voies pour le dépasser, avec leurs chiffres et leurs contreparties, les trois questions honnêtes qui tranchent, et les cinq compétences qui font monter les prix.$sq$, $sq$## L'accroche

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
where m.id = '4112806f-8596-4b94-b80e-abf8553a9613'::uuid
on conflict (id) do nothing;
