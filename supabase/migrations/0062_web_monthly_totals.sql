-- Les totaux mensuels exacts du trafic web — pas seulement les uniques.
--
-- 0060 ne rangeait au mois que les visiteurs, seuls dédoublonnés. Or les
-- sessions non plus ne se somment pas parfaitement : GA recoupe à minuit une
-- session à cheval sur deux jours, et la somme des quotidiens de juillet 2026
-- rend 18 084 là où GA — et le Looker que le client lisait — disent 18 005.
-- Sur un mois civil entier, l'écran doit dire le chiffre du rapport, pas une
-- approximation à 0,4 %. Le quotidien reste la source des courbes et des
-- plages libres.

alter table web_metrics_monthly
  add column sessions bigint not null default 0,
  add column engaged_sessions bigint not null default 0,
  add column page_views bigint not null default 0,
  add column session_seconds numeric(14, 2) not null default 0;
