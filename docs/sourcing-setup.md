# Sourcing — les campagnes du pôle Antidotes

Une campagne est un jeu de filtres nommé. Elle **tourne** en passages, sur une
machine GitHub (`.github/workflows/sourcing.yml`), jamais sur Vercel : un
passage parle à quatre tiers et dure plusieurs minutes. Chaque passage :

1. **source** — Google Maps (acteur Apify `compass/crawler-google-places`),
   une recherche par ville, bornée par « Lieux par recherche » ;
2. **qualifie** avant tout — pays, note Google minimale, taille dans la
   tolérance autour du client de référence (nombre d'avis), publicités
   actives (Ad Library de Meta). Les rejets sont comptés, jamais stockés ; ce
   qui n'a pas pu être vérifié passe en « À qualifier » ;
3. **cherche le décisionnaire** — LinkedIn (recherche Google
   `site:linkedin.com/in` par Apify), registre légal (API Recherche
   d'entreprises, gratuite), site de la société (mentions légales). On
   s'arrête au premier nom qui répond aux postes ciblés ; sans nom, le
   prospect sort en « Sans contact » ;
4. **obtient et vérifie l'adresse** — Dropcontact, Hunter, déduction de
   motif, dans l'ordre de la campagne. `valid` autorise une séquence, `risky`
   route vers LinkedIn, une déduction n'est jamais `valid` sans vérificateur.

Le taux de survie — sourcés → qualifiés → décideur trouvé → email valide —
s'affiche sur la campagne et dans son historique de passages.

## Les clés

À poser dans **Settings → Secrets and variables → Actions** du dépôt (c'est
là que tourne le passage), pas sur Vercel. Chacune est facultative : absente,
l'étape le dit dans le journal du passage et l'écran de campagne.

| Secret | Sert à | Où l'obtenir | Coût |
|---|---|---|---|
| `APIFY_TOKEN` | Google Maps, recherche LinkedIn | console.apify.com → Settings → Integrations | plan gratuit : 5 $ de crédit par mois ; ~0,4 $ pour 100 lieux, ~0,3 $ pour 100 recherches |
| `META_AD_LIBRARY_TOKEN` | publicités actives | jeton utilisateur d'une app Meta ayant accès à l'Ad Library (`ads_archive`, `ad_type=ALL`) | gratuit |
| `DROPCONTACT_API_KEY` | adresse, cible française | app.dropcontact.com → API | payant (à partir de 24 €/mois, 1 000 crédits) |
| `HUNTER_API_KEY` | adresse internationale, vérificateur | hunter.io → API | plan gratuit : 25 recherches et 50 vérifications par mois |

Le registre légal et la lecture du site n'ont pas de clé.

## Sonder avant de croire

Aucun de ces connecteurs n'a encore tourné contre le vrai service : ils sont
écrits sur la documentation publique. Avant la première campagne, jouer la
sonde depuis **Actions → Base de données → Run workflow**, champ « Sonder les
fournisseurs du sourcing » avec le nom d'une société connue (ville en plus,
mot-clé Maps pour tester l'acteur). Elle affiche les réponses **brutes** de
chaque fournisseur : c'est ce qui tranche la forme d'un connecteur, pas une
relecture.

## Ce qui n'est pas branché

- **Le moteur e-commerce** (« boutiques par catégorie et par techno ») attend
  le choix d'une source : ce sont des services payants (StoreLeads, BuiltWith)
  ou des acteurs Apify aux formes changeantes. La campagne se crée, le passage
  refuse de partir en le disant.
- **Le rayon** d'une campagne Maps est enregistré mais pas transmis à
  l'acteur, qui cherche dans la ville nommée : géocoder un cercle demande une
  sonde sur la forme de `customGeolocation`.
