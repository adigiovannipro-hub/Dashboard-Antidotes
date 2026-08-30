import { describe, expect, it } from "vitest";

import { excerptOf, planThreadState, sanitizeText } from "./ingest";
import type { ExistingThreadState, IngestedMessage, IngestedThread } from "./ingest";

const message = (over: Partial<IngestedMessage> = {}): IngestedMessage => ({
  externalId: "m1",
  authorExternalId: "u1",
  authorHandle: "claire.d",
  authorAvatarUrl: null,
  attachments: [],
  body: "Bonjour, est-ce que le modèle existe en bleu ?",
  fromBrand: false,
  sentAt: "2026-08-10T10:00:00.000Z",
  ...over,
});

const thread = (over: Partial<IngestedThread> = {}): IngestedThread => ({
  channel: "instagram",
  kind: "comment",
  externalThreadId: "fil-1",
  participantExternalId: "u1",
  participantHandle: "claire.d",
  participantAvatarUrl: null,
  post: null,
  messages: [message()],
  ...over,
});

const existing = (over: Partial<ExistingThreadState> = {}): ExistingThreadState => ({
  status: "to_process",
  unread: true,
  priority: "normal",
  flags: [],
  last_message_at: "2026-08-10T10:00:00.000Z",
  ...over,
});

describe("excerptOf", () => {
  it("aplatit les retours à la ligne et les espaces multiples", () => {
    expect(excerptOf("Bonjour,\n\nune   question")).toBe("Bonjour, une question");
  });

  it("tronque au-delà de la limite avec une ellipse", () => {
    const long = "a".repeat(200);
    const excerpt = excerptOf(long, 140);
    expect(excerpt).toHaveLength(140);
    expect(excerpt!.endsWith("…")).toBe(true);
  });

  it("rend null pour un corps vide — jamais une chaîne vide", () => {
    expect(excerptOf("   \n ")).toBeNull();
  });
});

describe("planThreadState — extrait d'un message sans texte", () => {
  it("nomme la pièce jointe quand le commentaire n'est qu'un GIF", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({
        messages: [
          message({
            body: "",
            attachments: [
              { type: "animated_image_share", url: "https://cdn/gif.gif", href: null, title: null },
            ],
          }),
        ],
      }),
    });
    expect(plan.excerpt).toBe("GIF");
  });

  it("rend null quand il n'y a ni texte ni pièce jointe", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({ messages: [message({ body: "" })] }),
    });
    expect(plan.excerpt).toBeNull();
  });
});

describe("planThreadState", () => {
  it("ouvre un fil nouveau à traiter, non lu", () => {
    const plan = planThreadState({ existing: null, thread: thread() });
    expect(plan.status).toBe("to_process");
    expect(plan.unread).toBe(true);
    expect(plan.message_count).toBe(1);
    expect(plan.excerpt).toBe("Bonjour, est-ce que le modèle existe en bleu ?");
  });

  it("classe « répondu ailleurs » un fil nouveau où la marque a déjà répondu", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({
        messages: [
          message(),
          message({
            externalId: "m2",
            fromBrand: true,
            body: "Oui, il arrive la semaine prochaine !",
            sentAt: "2026-08-10T11:00:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.status).toBe("answered_elsewhere");
    expect(plan.unread).toBe(false);
  });

  it("referme un fil à traiter quand la marque a répondu depuis l'app", () => {
    const plan = planThreadState({
      existing: existing(),
      thread: thread({
        messages: [
          message(),
          message({
            externalId: "m2",
            fromBrand: true,
            body: "Réponse faite depuis Business Suite.",
            sentAt: "2026-08-11T09:00:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.status).toBe("answered_elsewhere");
    expect(plan.unread).toBe(false);
  });

  it("rouvre un fil ignoré quand un message entrant nouveau arrive", () => {
    const plan = planThreadState({
      existing: existing({ status: "ignored", unread: false }),
      thread: thread({
        messages: [
          message(),
          message({
            externalId: "m2",
            body: "Toujours pas de réponse ??",
            sentAt: "2026-08-12T08:00:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.status).toBe("to_process");
    expect(plan.unread).toBe(true);
  });

  it("ne touche pas au travail de l'opérateur quand rien de neuf n'est arrivé", () => {
    const plan = planThreadState({
      existing: existing({ status: "snoozed", unread: false }),
      thread: thread(),
    });
    expect(plan.status).toBe("snoozed");
    expect(plan.unread).toBe(false);
  });

  it("laisse « envoyé » un fil dont la réponse visible est la nôtre", () => {
    const plan = planThreadState({
      existing: existing({
        status: "sent",
        unread: false,
        last_message_at: "2026-08-10T12:00:00.000Z",
      }),
      thread: thread({
        messages: [
          message(),
          message({
            externalId: "m2",
            fromBrand: true,
            body: "Notre réponse envoyée depuis l'outil.",
            sentAt: "2026-08-10T12:00:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.status).toBe("sent");
  });

  it("cumule les signalements de tous les messages entrants sans jamais en perdre", () => {
    const plan = planThreadState({
      existing: existing({ flags: ["spam"], priority: "high" }),
      thread: thread({
        messages: [
          message({ body: "C'est une arnaque, je veux être remboursé." }),
          message({
            externalId: "m2",
            body: "Alors ?",
            sentAt: "2026-08-10T11:00:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.flags).toEqual(expect.arrayContaining(["insult", "refund", "spam"]));
    expect(plan.priority).toBe("high");
  });

  it("détecte la langue sur le dernier message entrant", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({
        messages: [
          message({ body: "Hello, when will you restock this please?" }),
        ],
      }),
    });
    expect(plan.detected_locale).toBe("en");
  });

  it("prend le dernier message, marque comprise, comme date du fil", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({
        messages: [
          message(),
          message({
            externalId: "m2",
            fromBrand: true,
            sentAt: "2026-08-11T09:30:00.000Z",
          }),
        ],
      }),
    });
    expect(plan.last_message_at).toBe("2026-08-11T09:30:00.000Z");
    expect(plan.message_count).toBe(2);
  });
});

describe("sanitizeText", () => {
  it("retire le caractère nul et les contrôles bruts, garde les sauts de ligne", () => {
    const zero = String.fromCharCode(0);
    const bell = String.fromCharCode(7);
    expect(sanitizeText(`bon${zero}jour${bell} !\nligne 2`)).toBe(
      "bonjour !\nligne 2",
    );
  });

  it("retire une moitié de paire UTF-16 orpheline, garde l'emoji entier", () => {
    expect(sanitizeText("ok \u{1F600} tronqué \uD83D fin")).toBe(
      "ok \u{1F600} tronqué  fin",
    );
  });

  it("laisse passer null tel quel", () => {
    expect(sanitizeText(null)).toBeNull();
  });
});

describe("planThreadState — état de lecture de la plateforme", () => {
  it("un fil ouvert chez Meta n'est jamais non-lu ici, même nouveau", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({ kind: "dm", platformUnread: false }),
    });
    expect(plan.unread).toBe(false);
    // Lire n'est pas répondre : le fil reste à traiter.
    expect(plan.status).toBe("to_process");
  });

  it("un fil non lu chez Meta suit la règle habituelle", () => {
    const plan = planThreadState({
      existing: null,
      thread: thread({ kind: "dm", platformUnread: true }),
    });
    expect(plan.unread).toBe(true);
  });

  it("sans information de la plateforme, rien ne bouge", () => {
    const existing: ExistingThreadState = {
      status: "to_process",
      unread: false,
      priority: "normal",
      flags: [],
      last_message_at: "2026-08-10T10:00:00.000Z",
    };
    const plan = planThreadState({ existing, thread: thread() });
    expect(plan.unread).toBe(false);
  });
});
