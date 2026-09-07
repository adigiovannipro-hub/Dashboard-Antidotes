/**
 * Ce qu'un fil Gmail nous dit d'une inscription : une réponse, un rebond, un
 * répondeur d'absence, ou nos propres messages.
 *
 * Module pur : on lui donne les en-têtes des messages d'un fil, il rend un
 * verdict par message. La lecture du fil vit dans le passage.
 *
 * Trois verdicts changent quelque chose :
 *   • `reply` — quelqu'un a écrit dans le fil : la séquence s'arrête, le
 *     prospect passe en « A répondu ». N'importe qui, pas seulement le
 *     contact : une réponse transférée à un collègue est une réponse.
 *   • `bounce` — le facteur a rendu le message : l'adresse devient
 *     `invalid`, l'inscription s'arrête, et le rebond compte dans la garde
 *     des 3 %.
 *   • `auto_reply` — un répondeur d'absence n'est pas une réponse : on ne
 *     s'arrête pas, on le note, et l'étape suivante part à sa date.
 */

export type ThreadMessage = {
  id: string;
  fromEmail: string;
  subject: string | null;
  /** L'en-tête `Auto-Submitted` (RFC 3834), `auto-replied` sur un répondeur. */
  autoSubmitted: string | null;
  /** L'en-tête `Precedence` : `auto_reply`, `bulk`, `junk`… */
  precedence: string | null;
  receivedAt: Date;
  snippet: string;
};

export type ReplyKind = "own" | "reply" | "bounce" | "auto_reply";

export type ReplyVerdict = { kind: ReplyKind; message: ThreadMessage };

const BOUNCE_SENDERS = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const BOUNCE_SUBJECTS =
  /delivery status notification|undeliver|mail delivery failed|delivery failure|échec de la remise|non remis|returned mail|address not found|adresse introuvable/i;
const AUTO_REPLY_SUBJECTS =
  /réponse automatique|reponse automatique|automatic reply|auto[- ]?reply|out of office|absence du bureau|absent[e]? du bureau|en congé|je suis absent/i;

export function classifyThreadMessage(
  message: ThreadMessage,
  options: { ownAddress: string },
): ReplyKind {
  const from = message.fromEmail.trim().toLowerCase();
  if (from === options.ownAddress.trim().toLowerCase()) return "own";
  if (BOUNCE_SENDERS.test(from) || BOUNCE_SUBJECTS.test(message.subject ?? "")) return "bounce";

  const auto = (message.autoSubmitted ?? "").toLowerCase();
  const precedence = (message.precedence ?? "").toLowerCase();
  if (
    (auto && auto !== "no") ||
    precedence === "auto_reply" ||
    precedence === "bulk" ||
    precedence === "junk" ||
    AUTO_REPLY_SUBJECTS.test(message.subject ?? "")
  ) {
    return "auto_reply";
  }
  return "reply";
}

/**
 * Les verdicts d'un fil, dans l'ordre chronologique, en ne gardant que les
 * messages **postérieurs** à `since` — le dernier envoi déjà pris en compte :
 * un rebond relevé hier ne se recompte pas aujourd'hui.
 */
export function classifyThread(
  messages: ThreadMessage[],
  options: { ownAddress: string; since: Date | null },
): ReplyVerdict[] {
  return messages
    .filter((message) => !options.since || message.receivedAt.getTime() > options.since.getTime())
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map((message) => ({ kind: classifyThreadMessage(message, options), message }))
    .filter((verdict) => verdict.kind !== "own");
}
