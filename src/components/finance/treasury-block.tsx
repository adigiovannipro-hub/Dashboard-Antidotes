import { formatMoney } from "@/lib/finance/money";
import type { Treasury } from "@/lib/finance/queries";

/**
 * Trésorerie EUR : le détail wallet par wallet.
 *
 * Le total consolidé est monté dans la bande de mesures ; le répéter ici
 * aurait donné deux fois le même chiffre à trente centimètres d'écart. Seuls
 * les wallets EUR se totalisent — additionner des devises demanderait un taux,
 * donc une date, donc un mensonge discret. Les autres sont signalées, pas
 * converties.
 */
export function TreasuryBlock({ treasury }: { treasury: Treasury }) {
  if (treasury.accounts.length === 0) {
    return (
      <p className="type-body text-text-secondary">
        Aucun compte EUR synchronisé. Les soldes apparaîtront au premier passage
        de la synchronisation Airwallex.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {treasury.accounts.map(({ account, latest }) => (
          <li
            key={account.id}
            className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="type-label truncate text-text-primary">{account.name}</p>
              {latest && latest.pending_cents > 0 ? (
                <p className="type-caption text-text-secondary tabular-nums">
                  dont {formatMoney(latest.pending_cents, account.currency)} en
                  attente
                </p>
              ) : null}
            </div>
            <p className="type-label text-text-primary tabular-nums">
              {latest ? formatMoney(latest.available_cents, account.currency) : "—"}
            </p>
          </li>
        ))}
      </ul>

      {treasury.other_currencies.length > 0 ? (
        <p className="type-caption text-text-secondary">
          Wallets hors EUR ({treasury.other_currencies.join(", ")}) — non
          totalisés.
        </p>
      ) : null}
    </div>
  );
}
