-- LinkedIn Ads et TikTok Ads sont des comptes à part entière, distincts des
-- pages organiques du même réseau — comme le compte publicitaire Meta l'est
-- de la Page Facebook. Le Reporting leur ouvre un onglet chacun.
--
-- Additif seulement : `add value` passe en transaction tant que la valeur
-- n'est pas utilisée dans le même ordre, ce qui est le cas ici.
alter type social_account_kind add value if not exists 'linkedin_ad_account';
alter type social_account_kind add value if not exists 'tiktok_ad_account';
