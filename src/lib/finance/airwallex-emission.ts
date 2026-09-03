import "server-only";

import { AirwallexError, call, post } from "@/lib/airwallex/transport";

/**
 * L'émission d'une facture chez Airwallex — la seule écriture de tout le
 * projet vers ce service.
 *
 * Le reste du code lit Airwallex ; ici on y crée quelque chose, et la
 * prudence n'est pas la même. Trois garde-fous, tous délibérés :
 *
 *   • **la duplication plutôt que l'invention.** Une facture n'est pas créée
 *     de zéro : on lit celle du mois précédent — ou celle créée à la main la
 *     première fois — et on en reprend la forme, mentions légales comprises.
 *     Le `memo` porte l'IBAN et « TVA non applicable, article 259-1 du CGI » :
 *     personne ne veut que ces lignes-là soient réécrites par un automate ;
 *
 *   • **`request_id` stable**, dérivé de la mensualité. Airwallex refuse une
 *     seconde création portant le même — c'est l'idempotence côté service,
 *     celle qui tient même si notre base a perdu la trace de la première ;
 *
 *   • **la facture reste en brouillon jusqu'à `finalize`.** Un brouillon n'a
 *     aucun effet : pas de numéro, pas de PDF, rien chez le client. Une
 *     création qui plante à mi-chemin laisse un brouillon, pas une facture
 *     fantôme.
 *
 * Chemins d'API : `/api/v1/invoices/*` — établi par sonde le 03/09/2026, où
 * `/api/v1/invoices` et `/api/v1/billing/invoices` répondaient tous deux 200
 * sur les mêmes ressources. On garde le premier, celui que la synchronisation
 * utilise déjà.
 *
 * **Montants : Airwallex parle en unités majeures**, pas en centimes — une
 * facture de 500 € rend `total_amount: 500`. C'est le sens de la division par
 * cent à chaque frontière ici, et de sa multiplication au retour.
 */

/** Une facture Airwallex, réduite à ce dont l'envoi a besoin. */
export type EmittedInvoice = {
  external_id: string;
  /** Le numéro visible du client — « INV-A9DFDGZ3-0005 ». */
  number: string;
  /** L'échéance de règlement, `AAAA-MM-JJ`. */
  due_on: string | null;
  /** Lien signé vers le PDF, valable 35 jours. */
  pdf_url: string | null;
  amount_cents: number;
  currency: string;
};

/** La forme d'une facture existante, ce qu'on en duplique. */
export type InvoiceTemplate = {
  external_id: string;
  billing_customer_id: string | null;
  currency: string;
  memo: string | null;
  footer: string | null;
  days_until_due: number | null;
  collection_method: string | null;
  default_tax_percent: number | null;
  legal_entity_id: string | null;
};

type RawInvoice = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** « 2026-09-05T10:18:13+0000 » → « 2026-09-05 ». */
function dayOf(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toEmitted(raw: RawInvoice): EmittedInvoice {
  const amount = num(raw.total_amount) ?? num(raw.amount_due) ?? 0;
  return {
    external_id: text(raw.id) ?? "",
    number: text(raw.number) ?? "",
    due_on: dayOf(raw.due_at),
    pdf_url: text(raw.pdf_url),
    /* Unités majeures → centimes, arrondi explicite : `2102.5 * 100` vaut
       210249,999… en flottant. Même précaution que `normalize.ts`. */
    amount_cents: Math.round(amount * 100),
    currency: (text(raw.currency) ?? "EUR").toUpperCase().slice(0, 3),
  };
}

/** Une facture existante, lue pour être dupliquée ou pour être renvoyée. */
export async function getInvoice(externalId: string): Promise<EmittedInvoice | null> {
  try {
    const raw = await call<RawInvoice>(`/api/v1/invoices/${externalId}`);
    return toEmitted(raw);
  } catch (error) {
    if (error instanceof AirwallexError && error.status === 404) return null;
    throw error;
  }
}

/** La forme d'une facture, pour en fabriquer la suivante. */
export async function getInvoiceTemplate(
  externalId: string,
): Promise<InvoiceTemplate | null> {
  try {
    const raw = await call<RawInvoice>(`/api/v1/invoices/${externalId}`);
    return {
      external_id: text(raw.id) ?? externalId,
      billing_customer_id: text(raw.billing_customer_id),
      currency: (text(raw.currency) ?? "EUR").toUpperCase().slice(0, 3),
      memo: text(raw.memo),
      footer: text(raw.footer),
      days_until_due: num(raw.days_until_due),
      collection_method: text(raw.collection_method),
      default_tax_percent: num(raw.default_tax_percent),
      legal_entity_id: text(raw.legal_entity_id),
    };
  } catch (error) {
    if (error instanceof AirwallexError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Le produit facturé sur une facture existante.
 *
 * Il se lit sur ses lignes, et c'est le seul endroit où on en a besoin : une
 * fois trouvé, il est mémorisé sur le devis et cette lecture ne se refait
 * plus. `null` quand l'API ne rend pas les lignes — ce n'est pas bloquant,
 * l'appelant demandera le produit autrement.
 */
export async function getInvoiceProductId(
  externalId: string,
): Promise<string | null> {
  try {
    const page = await call<{ items?: RawInvoice[] }>(
      `/api/v1/invoice_items?invoice_id=${encodeURIComponent(externalId)}&page_size=20`,
    );
    for (const item of page.items ?? []) {
      const price = item.price;
      if (price && typeof price === "object") {
        const productId = text((price as RawInvoice).product_id);
        if (productId) return productId;
      }
      const direct = text(item.product_id);
      if (direct) return direct;
    }
    return null;
  } catch (error) {
    if (error instanceof AirwallexError) return null;
    throw error;
  }
}

/**
 * Un prix ponctuel au montant exact d'une mensualité.
 *
 * Un par facture, et c'est voulu : la division d'un devis en douze ne tombe
 * pas juste, et un prix Airwallex porte un montant fixe. Réutiliser un prix
 * approchant ferait une facture fausse d'un centime — sur un document
 * comptable, ce n'est pas un détail.
 */
async function createOneOffPrice(options: {
  productId: string;
  currency: string;
  amountCents: number;
  requestId: string;
}): Promise<string> {
  const raw = await post<RawInvoice>("/api/v1/prices/create", {
    request_id: options.requestId,
    product_id: options.productId,
    currency: options.currency,
    unit_amount: options.amountCents / 100,
    type: "ONE_OFF",
    pricing_model: "PER_UNIT",
    active: true,
  });

  const priceId = text(raw.id);
  if (!priceId) {
    throw new AirwallexError("Airwallex a créé un prix sans identifiant.");
  }
  return priceId;
}

/**
 * Crée la facture du mois à l'image d'une précédente, et la finalise.
 *
 * Trois appels, dans cet ordre, et l'ordre est la sécurité : le brouillon
 * n'existe pour personne tant qu'il n'est pas finalisé, donc un plantage
 * entre deux étapes ne laisse jamais une facture à moitié envoyée.
 *
 * `requestId` doit être **stable pour une mensualité donnée** : c'est lui qui
 * empêche une seconde facture si notre base perd la trace de la première.
 */
export async function emitInvoiceFromTemplate(options: {
  template: InvoiceTemplate;
  productId: string;
  amountCents: number;
  /** Stable pour une mensualité — voir plus haut. */
  requestId: string;
  /** Ce que la facture porte en clair, à la place du libellé du produit. */
  description?: string;
}): Promise<EmittedInvoice> {
  const { template } = options;
  if (!template.billing_customer_id) {
    throw new AirwallexError(
      `La facture modèle ${template.external_id} ne porte aucun client de facturation : impossible d'en dupliquer une.`,
    );
  }

  const priceId = await createOneOffPrice({
    productId: options.productId,
    currency: template.currency,
    amountCents: options.amountCents,
    requestId: `${options.requestId}-prix`,
  });

  const draft = await post<RawInvoice>("/api/v1/invoices/create", {
    request_id: options.requestId,
    billing_customer_id: template.billing_customer_id,
    currency: template.currency,
    /* Recopiés du modèle sans être interprétés : le `memo` porte l'IBAN et la
       mention de TVA, le `footer` ce qui va en bas de page. */
    ...(template.memo ? { memo: template.memo } : {}),
    ...(template.footer ? { footer: template.footer } : {}),
    ...(template.collection_method
      ? { collection_method: template.collection_method }
      : {}),
    ...(template.days_until_due !== null
      ? { days_until_due: template.days_until_due }
      : {}),
    ...(template.default_tax_percent !== null
      ? { default_tax_percent: template.default_tax_percent }
      : {}),
    ...(template.legal_entity_id
      ? { legal_entity_id: template.legal_entity_id }
      : {}),
  });

  const invoiceId = text(draft.id);
  if (!invoiceId) {
    throw new AirwallexError("Airwallex a créé une facture sans identifiant.");
  }

  await post<RawInvoice>(`/api/v1/invoices/${invoiceId}/add_line_items`, {
    request_id: `${options.requestId}-lignes`,
    line_items: [
      {
        price_id: priceId,
        quantity: 1,
        ...(options.description ? { description: options.description } : {}),
      },
    ],
  });

  /* La finalisation est le point de non-retour : la facture prend son numéro,
     son PDF, et devient un document comptable. Tout ce qui précède est
     annulable, plus rien ne l'est après. */
  const finalized = await post<RawInvoice>(
    `/api/v1/invoices/${invoiceId}/finalize`,
    { request_id: `${options.requestId}-finalisation` },
  );

  return toEmitted({ ...finalized, id: text(finalized.id) ?? invoiceId });
}

/**
 * Le PDF d'une facture, par son lien signé.
 *
 * Hors API : `invoice.airwallex.com` sert le fichier sans authentification,
 * le jeton étant dans l'URL. Le lien vit 35 jours — au-delà, il faut relire
 * la facture pour en obtenir un neuf, et c'est exactement ce que fait
 * l'envoi d'une relance.
 */
export async function downloadInvoicePdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl, {
    headers: { "user-agent": "Antidotes/1.0" },
  });
  if (!response.ok) {
    throw new AirwallexError(
      `Téléchargement du PDF refusé (${response.status}) — lien périmé ?`,
      response.status,
      response.status >= 500,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  /* Un lien périmé rend une page HTML avec un 200 : sans cette vérification,
     le client recevrait « facture.pdf » contenant du HTML. */
  if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
    throw new AirwallexError(
      "Le lien n'a pas rendu un PDF — jeton expiré, très probablement.",
    );
  }
  return buffer;
}
