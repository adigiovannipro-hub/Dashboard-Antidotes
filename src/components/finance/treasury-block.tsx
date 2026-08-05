import { formatMoney } from "@/lib/finance/money";
import type { Treasury } from "@/lib/finance/queries";

/**
 * Trésorerie EUR : le total consolidé d'abord, le détail par compte ensuite.
 *
 * Seuls les wallets EUR se totalisent — additionner des devises entre elles
 * demanderait un taux, donc une date, donc un mensonge discret. Les autres
 * devises sont signalées, pas converties.
 */
export function TreasuryBlock({ treasury }: { treasury: Treasury }) {
  if (treasury.accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun compte EUR synchronisé. Les soldes apparaîtront au premier passage
        de la synchronisation Airwallex.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-xs">Disponible consolidé</p>
        <p className="font-heading mt-1 text-3xl tabular-nums">
          {formatMoney(treasury.total_cents, "EUR")}
        </p>
      </div>

      <ul className="space-y-2">
        {treasury.accounts.map(({ account, latest }) => (
          <li
            key={account.id}
            className="bg-background flex items-center justify-between gap-3 rounded-lg p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{account.name}</p>
              {latest && latest.pending_cents > 0 ? (
                <p className="text-muted-foreground text-xs tabular-nums">
                  dont {formatMoney(latest.pending_cents, account.currency)} en
                  attente
                </p>
              ) : null}
            </div>
            <p className="font-medium tabular-nums">
              {latest ? formatMoney(latest.available_cents, account.currency) : "—"}
            </p>
          </li>
        ))}
      </ul>

      {treasury.other_currencies.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Wallets hors EUR ({treasury.other_currencies.join(", ")}) — non
          totalisés.
        </p>
      ) : null}
    </div>
  );
}
