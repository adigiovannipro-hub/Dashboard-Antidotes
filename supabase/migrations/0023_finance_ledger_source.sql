-- ===========================================================================
-- Les sorties du grand livre entrent dans le tableau des dépenses
--
-- Jusqu'ici `finance_transactions` ne portait que les dépenses **carte**, lues
-- de l'API Spend. Un virement émis par RIB — un `PAYOUT` du grand livre — ne
-- s'affichait donc nulle part, alors qu'il quitte bel et bien le wallet : la
-- courbe le voyait, le tableau non.
--
-- Une valeur d'énumération suffit à les distinguer une fois dans la table.
-- Elle sert à deux choses, et c'est pour elles qu'elle existe plutôt qu'un
-- simple libellé : ne pas réclamer de justificatif à un virement bancaire, et
-- pouvoir isoler les deux natures de sortie à la lecture.
--
-- Ajout seul, sans usage dans ce fichier : une valeur d'enum ne peut pas
-- servir dans la transaction qui la crée.
-- ===========================================================================

alter type finance_transaction_source add value if not exists 'ledger';
