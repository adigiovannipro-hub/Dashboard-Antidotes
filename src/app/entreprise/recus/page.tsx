import type { Metadata } from "next";

import { Inbox } from "@/components/recus/inbox";
import { SetupPanel } from "@/components/recus/setup-panel";
import { requireReceiptsAccess } from "@/lib/recus/access";
import {
  getCounters,
  getDocumentDetail,
  listDocuments,
  listUnattachedExpenses,
  type ReceiptFilters,
} from "@/lib/recus/queries";

export const metadata: Metadata = { title: "Reçus · Mon entreprise" };

type Search = Promise<Record<string, string | undefined>>;

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const query = await searchParams;
  const context = await requireReceiptsAccess();

  // Aucune boîte connectée : l'écran explique quoi brancher plutôt que
  // d'afficher une liste vide qui ne dit rien de ce qui manque.
  if (context.sources.length === 0) {
    return (
      <SetupPanel
        error={query.erreur ?? null}
        connected={query.connecte ?? null}
        canDecide={context.canDecide}
      />
    );
  }

  const filters: ReceiptFilters = {
    status: query.statut,
    kind: query.type,
    search: query.q,
    actionableOnly: query.statut ? false : true,
  };

  const [documents, counters, unattached] = await Promise.all([
    listDocuments({ orgId: context.orgId, filters }),
    getCounters(context.orgId),
    listUnattachedExpenses({ orgId: context.orgId }),
  ]);

  // La pièce ouverte vient de l'URL : un lien direct fonctionne, et le retour
  // arrière du navigateur aussi.
  const selectedId = query.piece ?? documents[0]?.id ?? null;
  const detail = selectedId ? await getDocumentDetail(selectedId) : null;

  return (
    <Inbox
      sources={context.sources}
      canDecide={context.canDecide}
      documents={documents}
      counters={counters}
      filters={filters}
      unattached={unattached}
      selectedId={selectedId}
      detail={detail}
      notice={query.connecte ?? null}
    />
  );
}
