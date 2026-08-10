-- ===========================================================================
-- Échéances — la correspondance des noms de clients, et la TVA remise à zéro
--
-- Le rapprochement compare le nom du client du devis à celui de la facture.
-- Il ne pouvait pas fonctionner : les devis portent la **marque** telle que
-- le board Monday l'écrivait — « BONDET », « CHASSEURS DE GRAINES » — et les
-- factures portent la **raison sociale** qu'Airwallex connaît — « NIGHT
-- SESSION », « MEDIAPILOTE ANGERS ». Deux vocabulaires pour les mêmes gens,
-- et donc chaque prestation affichée deux fois : la mensualité d'un côté, sa
-- facture de l'autre.
--
-- Une table de correspondance résout ça une fois pour toutes, et reste
-- éditable : un nouveau client se déclare ici, pas dans le code.
--
-- Un alias sans nom de client (`client_name is null`) désigne une facture
-- qui **n'est pas une prestation client** : l'auto-facturation de la SASU,
-- par exemple. Elle reste dans le module Finance, où elle a sa place, et
-- disparaît de l'écran des échéances, où elle n'en a aucune.
-- ===========================================================================

create table billing_client_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,

  /* Le nom tel qu'il arrive de la source externe. Stocké normalisé — sans
     accent, en minuscules, espaces réduits — parce que c'est sous cette
     forme qu'il sera comparé, et qu'une comparaison qui doit normaliser à
     la lecture finit toujours par le faire d'une façon ici et d'une autre
     là. */
  alias text not null,

  /* Le nom du client tel que les devis le portent. `null` : la facture
     n'est pas une prestation client, l'écran des échéances l'ignore. */
  client_name text,

  note text,
  created_at timestamptz not null default now(),

  unique (org_id, alias)
);

/* La seule lecture : « à quel client correspond ce nom de facture ». */
create index billing_client_aliases_org_idx
  on billing_client_aliases (org_id, alias);

-- --- Les correspondances connues au 10 août 2026 ---------------------------

/* Déduites du croisement des montants et des périodes : chaque alias facture
   au centime près et au même rythme que la mensualité du devis qu'il vise.
   Elles se corrigent par un simple `update` — aucune n'est gravée dans le
   code. */
insert into billing_client_aliases (org_id, alias, client_name, note)
select o.id, v.alias, v.client_name, v.note
from (select id from organizations order by created_at limit 1) o,
  (values
    ('i-vent (i-way)',     'I-WAY',                'Raison sociale d''I-WAY'),
    ('mediapilote angers', 'CHASSEURS DE GRAINES', 'Éditeur de Chasseurs de graines'),
    ('night session',      'BONDET',               'Raison sociale de Bondet'),
    ('hmz production llp', 'HOLY',                 'Production de Hamza SDT x Holy'),
    -- Sans client : nos propres factures, hors périmètre des échéances.
    ('sasu antidotes',     null,                   'Auto-facturation Antidotes')
  ) as v(alias, client_name, note)
on conflict (org_id, alias) do nothing;

-- --- La TVA des devis repris de Monday -------------------------------------

/* Le board affichait un TTC calculé à 20 %, mais les factures réellement
   émises portent le montant hors taxe tel quel : Antidotes facture sans
   TVA. Le taux importé rendait donc tout rapprochement impossible — le
   montant cherché était supérieur d'un cinquième à celui d'Airwallex.
   Gardé par la note d'import : une saisie manuelle n'est jamais touchée. */
update billing_engagements
   set vat_rate = 0
 where notes = 'Repris du board Monday' and vat_rate <> 0;

update billing_installments i
   set vat_rate = 0
  from billing_engagements e
 where e.id = i.engagement_id
   and e.notes = 'Repris du board Monday'
   and i.vat_rate <> 0;
