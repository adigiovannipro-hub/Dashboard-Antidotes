-- LinkedIn organique rejoint les fournisseurs de `data_sources`.
--
-- Fichier à part, et volontairement : `add value` sur un enum ne peut pas
-- être suivi d'un **usage** de la valeur dans la même transaction. Rien ici
-- ne s'en sert — la première ligne `linkedin_organic` est écrite par le
-- connecteur, longtemps après le commit.
alter type data_provider add value if not exists 'linkedin_organic';
