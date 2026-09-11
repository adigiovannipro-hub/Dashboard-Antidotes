# Brancher Meta — application, permissions, comptes

Le connecteur Meta (Reporting, Modération, publication du Planning) passe par
une application Meta unique, portée par le Business Manager de l'agence. Un
seul login couvre tous les clients : l'inventaire (`social_accounts`) est
celui de l'agence, l'affectation par espace se fait dans **Connexions**.

## 1. L'application

- developers.facebook.com → l'app **Antidotes** (id dans `META_APP_ID`,
  secret dans `META_APP_SECRET` — sur Vercel et dans les secrets GitHub,
  jamais en local).
- Cas d'utilisation requis : **Gérez des Pages**, **API Instagram**, et
  **Messenger** (la messagerie privée vit dans son propre cas d'utilisation —
  sans lui, `pages_messaging` est refusée en bloc par « Invalid Scopes »).

## 2. Les permissions

À **ajouter à l'app** dans chaque cas d'utilisation (accès standard : elles
fonctionnent pour les comptes ayant un rôle dans l'app, l'App Review ne sert
qu'au grand public) :

`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
`pages_read_user_content`, `read_insights`, `pages_manage_engagement`,
`pages_messaging`, `instagram_basic`, `instagram_content_publish`,
`instagram_manage_insights`, `instagram_manage_comments`,
`instagram_manage_messages`, `ads_read`, `business_management` — plus la
fonctionnalité **Agent humain** (réponses DM au-delà de 24 h).

La liste qui fait foi est `META_SCOPES` dans `src/lib/social/meta.ts` : toute
portée qui s'y ajoute doit être ajoutée à l'app **avant** le rebranchement.

## 3. Brancher et affecter

1. Espace client → Reporting → **Connexions** → brancher Meta,
   accepter toutes les portées.
2. Affecter le compte Instagram, la Page et le compte publicitaire de ce
   client — un compte par réseau et par espace.
3. Vérifier : Reporting → Synchroniser, puis Modération → Relever maintenant.

## 4. Ce que Meta refuse structurellement

- La lecture des publications d'une Page (`/published_posts`) reste fermée
  aux apps sans App Review pour le grand public — le panneau organique
  Facebook le dit à l'écran.
- Les widgets de story ne se publient pas par l'API : les stories s'excluent
  de la publication automatique.
- L'historique d'abonnés n'existe pas : chaque jour non relevé est perdu
  (d'où le relevé quotidien et `pnpm import:followers` pour l'antériorité).
