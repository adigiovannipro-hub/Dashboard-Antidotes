## L'accroche

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

Ouvre le tableau de ton dernier reporting. Liste chaque chiffre que tu as recopié à la main : sa source, le temps que sa collecte t'a pris. Entoure les trois plus coûteux en temps — ce sont tes premiers candidats. Puis ouvre lookerstudio.google.com avec ton compte Google, crée un rapport vierge et branche une première source gratuite : un Google Sheets avec tes historiques, ou Google Analytics si ton client l'utilise. Tu n'auras pas tout automatisé en une heure, mais tu auras le point de départ — et la liste exacte de ce qu'il te reste à brancher.
