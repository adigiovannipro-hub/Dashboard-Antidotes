# Site Web — Google Analytics via Composio

L'onglet « Site Web » du Reporting lit le trafic Google Analytics 4 d'un
client. Antidotes ne parle jamais à Google directement : la passerelle
Composio porte l'application OAuth et les jetons (voir
`docs/composio-setup.md`), et le connecteur
(`src/lib/connectors/google-analytics/`) lui demande des rapports qu'il
range en base. Le chemin reste celui de tout le projet : API → base →
lecture locale.

## Ce qui est stocké, et pourquoi deux grains

| Table | Grain | Contenu |
|---|---|---|
| `web_metrics_daily` | jour | visiteurs, sessions, sessions engagées, vues, durée cumulée — les courbes et toutes les sommes |
| `web_metrics_monthly` | mois civil | visiteurs uniques **exacts**, dédoublonnés par GA — le chiffre du rapport |
| `web_breakdowns_monthly` | mois civil | sources, appareils, villes, nouveaux/connus |
| `web_pages_monthly` | mois civil | le tableau Top Pages |

GA4 dédoublonne les visiteurs par période demandée : additionner des uniques
quotidiens surcompte un visiteur revenu deux jours de suite. Sur un mois civil
— la lecture normale — l'écran affiche l'exact mensuel ; sur une plage libre,
il retombe sur la somme quotidienne et le dit (même approximation assumée que
la portée Meta, 0045).

La comparaison de l'onglet est **l'année N-1** (juillet 2026 vs juillet 2025),
pas la période précédente : le trafic d'un site est saisonnier, et c'est ce
que faisait le rapport Looker de référence.

## Mise en route

1. **La clé** : `COMPOSIO_API_KEY` (projet Platform, commence par `ak_`) dans
   `.env.local`, sur Vercel (Production + Preview) et dans les secrets GitHub
   Actions. Emplacements détaillés dans `docs/composio-setup.md`.
2. **Le compte Google** : dans le tableau de bord Composio, ajouter le
   toolkit **Google Analytics** (OAuth géré par Composio), puis connecter le
   compte Google qui a accès à la propriété. Comme identifiant d'utilisateur
   (« user id »), donner l'**UUID de l'espace client** — le rangement du
   projet. Tant qu'un seul compte GA est connecté dans le projet, le
   connecteur le prend même sans cet identifiant ; à deux comptes, il refuse
   de deviner et le dit dans l'erreur.
3. **Le rattachement** : dire quel espace lit quelle propriété —

   ```bash
   pnpm connect:web --workspace anmf --property properties/428494328 \
     --name "ANMF — Site web" --depuis 2024-02-01
   ```

   Idempotent (clé d'unicité de 0001). `--depuis` borne le rattrapage
   initial ; sans lui, 2023-01-01.
4. **La collecte** : `pnpm sync:web` pour le premier rattrapage, puis le cron
   Vercel quotidien (`/api/cron/sync-reporting`, 5h UTC) et le bouton
   « Synchroniser » de l'écran prennent le relais. Fenêtre glissante de 8
   jours — GA réécrit ses chiffres pendant ~72 h.

## Volumes et coût

Un passage = 7 appels d'outil Composio par propriété (1 quotidien, 1 mensuel,
4 ventilations, 1 pages). Une propriété synchronisée chaque jour ≈ **210
appels/mois** — à confronter au palier Composio le jour où ses tarifs seront
lus (`docs/composio-setup.md`, section Coût). L'API Analytics Data de Google
est gratuite (quota 25 000 jetons/jour par propriété, très au-dessus de ce
que 7 rapports consomment).

Côté base : le site ANMF pèse ~900 jours × 1 ligne quotidienne, plus quelques
milliers de lignes mensuelles — négligeable devant `ad_metrics_daily`.

## Trouver l'identifiant d'une propriété

Depuis le compte Google connecté, l'outil `GOOGLE_ANALYTICS_LIST_ACCOUNT_SUMMARIES`
de Composio liste comptes et propriétés (`properties/428494328`). Le
connecteur exige la forme complète `properties/<id>`.
