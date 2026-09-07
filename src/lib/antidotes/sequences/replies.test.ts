import { describe, expect, it } from "vitest";

import { classifyThread, classifyThreadMessage, type ThreadMessage } from "./replies";

const OWN = "sandro@antidotes.fr";

const message = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
  id: "m1",
  fromEmail: "camille@optique-saint-jean.fr",
  subject: "Re: Ce que Bondet a changé",
  autoSubmitted: null,
  precedence: null,
  receivedAt: new Date("2026-09-08T09:00:00Z"),
  snippet: "",
  ...overrides,
});

describe("classifyThreadMessage", () => {
  it("reconnaît nos propres messages", () => {
    expect(classifyThreadMessage(message({ fromEmail: "Sandro@Antidotes.fr" }), { ownAddress: OWN })).toBe("own");
  });

  it("voit un rebond au facteur ou à l'objet", () => {
    expect(
      classifyThreadMessage(message({ fromEmail: "mailer-daemon@googlemail.com", subject: null }), { ownAddress: OWN }),
    ).toBe("bounce");
    expect(
      classifyThreadMessage(message({ subject: "Delivery Status Notification (Failure)" }), { ownAddress: OWN }),
    ).toBe("bounce");
  });

  it("ne prend pas un répondeur d'absence pour une réponse", () => {
    expect(classifyThreadMessage(message({ autoSubmitted: "auto-replied" }), { ownAddress: OWN })).toBe("auto_reply");
    expect(classifyThreadMessage(message({ precedence: "bulk" }), { ownAddress: OWN })).toBe("auto_reply");
    expect(
      classifyThreadMessage(message({ subject: "Réponse automatique : absente jusqu'au 15" }), { ownAddress: OWN }),
    ).toBe("auto_reply");
  });

  it("tient toute autre personne pour une réponse, collègue compris", () => {
    expect(classifyThreadMessage(message({ fromEmail: "marc@optique-saint-jean.fr" }), { ownAddress: OWN })).toBe("reply");
  });
});

describe("classifyThread", () => {
  it("ignore ce qui précède le dernier relevé et nos envois, dans l'ordre", () => {
    const verdicts = classifyThread(
      [
        message({ id: "old", receivedAt: new Date("2026-09-07T09:00:00Z") }),
        message({ id: "reply", receivedAt: new Date("2026-09-08T11:00:00Z") }),
        message({ id: "own", fromEmail: OWN, receivedAt: new Date("2026-09-08T10:00:00Z") }),
        message({ id: "bounce", fromEmail: "postmaster@x.fr", receivedAt: new Date("2026-09-08T10:30:00Z") }),
      ],
      { ownAddress: OWN, since: new Date("2026-09-08T00:00:00Z") },
    );
    expect(verdicts.map((v) => `${v.message.id}:${v.kind}`)).toEqual(["bounce:bounce", "reply:reply"]);
  });
});
