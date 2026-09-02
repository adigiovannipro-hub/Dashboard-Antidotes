-- ===========================================================================
-- Récupération automatique des factures — schéma
--
-- Un abonnement — Adobe, Google, OVH — laisse chaque mois une facture derrière
-- une session ouverte sur le site du fournisseur, là où ni le mail ni Airwallex
-- ne vont la chercher. Le dashboard n'ira pas la chercher non plus : une
-- fonction Vercel n'a pas de navigateur qui survive d'une exécution à l'autre,
-- et c'est la session qui ouvre la porte. Il retient **où** elle est, et **si**
-- celle du mois est déjà arrivée ; un passage extérieur, depuis une machine
-- qui garde ses sessions, lit cette liste, agit, et rend compte.
--
-- Une ligne par **marchand**, pas par dépense : le lien se colle une fois et
-- sert tous les mois. Posé sur la dépense, il aurait fallu le recoller à
-- chaque prélèvement — et la règle « à récupérer de nouveau quand le mois
-- change » n'aurait eu aucune ligne où s'appliquer, celle du mois suivant
-- naissant vide. La clé est celle des logos, `merchant_key` : ce qui relie
-- une dépense à sa fiche est un calcul sur le nom, pas une jointure.
-- ===========================================================================

/* `none` : fiche sans lien. `pending` : lien posé, facture du mois attendue.
   `done` : récupérée et envoyée — mais « du mois » se juge à la lecture, en
   comparant `auto_retrieved_at` au mois courant : un statut qui dépend de la
   date n'a pas sa place en base. `failed` : le passage a échoué, la cause est
   dans `last_error`, le prochain passage réessaie. */
create type finance_retrieval_status as enum ('none', 'pending', 'done', 'failed');

create table finance_retrieval_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,

  -- Même clé que `finance_merchant_logos` : calculée depuis le nom affiché.
  merchant_key text not null,
  -- Le nom tel que l'écran le montre, pour que le passage extérieur sache de
  -- qui il parle sans recalculer la clé à l'envers.
  merchant_label text not null,

  -- Le lien fourni : la page où les factures se trouvent, derrière la session.
  source_link text,
  retrieval_status finance_retrieval_status not null default 'none',
  -- Dernière récupération réussie. Comparée au mois courant à l'affichage.
  auto_retrieved_at timestamptz,
  last_error text,

  /* La session de navigateur du fournisseur, chiffrée (AES-256-GCM, clé
     `FACTURES_SESSION_KEY`) : cookies et stockage local capturés une fois
     depuis un vrai navigateur. C'est elle, et elle seule, qui permet au
     passage de s'exécuter sans écran sur un runner GitHub — une page de
     factures est réservée aux clients connectés, et personne ne sera là pour
     taper un mot de passe. Rejouée à chaque passage, réécrite rafraîchie
     après chaque succès. */
  session_encrypted text,
  session_saved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, merchant_key)
);

/* La liste de travail du passage extérieur : les fiches qui ont un lien. */
create index finance_retrieval_sources_due_idx
  on finance_retrieval_sources (org_id, retrieval_status)
  where source_link is not null;

create trigger finance_retrieval_sources_touch
  before update on finance_retrieval_sources
  for each row execute function app.touch_updated_at();
