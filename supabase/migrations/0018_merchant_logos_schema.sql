-- ===========================================================================
-- Logos de marchands — schéma
--
-- Le tableau des dépenses affiche la marque du marchand à gauche de son nom.
-- Les vrais logos ne peuvent pas être cherchés à l'affichage : « aucun fetch
-- live vers une API tierce depuis le client » — et un dashboard comptable qui
-- annonce sa liste de marchands à un service externe à chaque ouverture est
-- exactement ce que la règle interdit.
--
-- Ils sont donc récupérés **au passage de la synchronisation** (une fois par
-- marchand), rangés dans un bucket privé, servis par URL signée après
-- vérification du droit de lecture — même doctrine que les justificatifs.
--
-- La table est le journal de ces tentatives : une ligne par marchand,
-- trouvée ou non. La ligne « non trouvée » compte autant que l'autre — sans
-- elle, chaque passage retenterait les mêmes domaines sans réponse.
-- ===========================================================================

create table finance_merchant_logos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  /* Clé normalisée du marchand — minuscules, sans bruit juridique — celle que
     l'écran recalcule depuis le nom affiché pour retrouver le logo. */
  merchant_key text not null,
  /* Domaine deviné qui a répondu, à titre de trace. */
  domain text,
  /* Chemin dans le bucket `merchant-logos`. Null : recherche faite, rien
     trouvé — l'écran affiche alors les initiales. */
  storage_path text,

  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (org_id, merchant_key)
);

create index finance_merchant_logos_org_idx
  on finance_merchant_logos (org_id);

-- --- Stockage ----------------------------------------------------------------

/* Privé, comme tout le reste : un favicon est anodin, la liste des marchands
   qu'on fréquente ne l'est pas. 512 Ko — un favicon qui pèse plus est suspect. */
insert into storage.buckets (id, name, public, file_size_limit)
values ('merchant-logos', 'merchant-logos', false, 524288)
on conflict (id) do nothing;
