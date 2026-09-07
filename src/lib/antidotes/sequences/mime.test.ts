import { describe, expect, it } from "vitest";

import { buildOutreachHtml, buildOutreachMime, buildOutreachText, newMessageId, replySubject } from "./mime";

const email = {
  from: "sandro@antidotes.fr",
  fromName: "Sandro Di Giovanni",
  to: "camille@optique-saint-jean.fr",
  subject: "Ce que Bondet a changé sur Instagram",
  body: "Bonjour Camille,\n\nJ'ai vu vos publicités.\nElles tournent depuis mars.\n\nLe détail : https://antidotes.fr/cas/bondet\n\nSandro",
  messageId: "<abc@antidotes.fr>",
  inReplyTo: null,
  unsubscribeUrl: "https://antidotes.fr/desinscription/deadbeef",
};

describe("buildOutreachMime", () => {
  it("porte le Message-ID, la désinscription en un clic et les deux parties", () => {
    const mime = buildOutreachMime(email);
    expect(mime).toContain("Message-ID: <abc@antidotes.fr>");
    expect(mime).toContain("List-Unsubscribe: <https://antidotes.fr/desinscription/deadbeef>");
    expect(mime).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(mime).not.toContain("In-Reply-To");
  });

  it("répond dans le fil sur une relance", () => {
    const mime = buildOutreachMime({ ...email, inReplyTo: "<first@antidotes.fr>" });
    expect(mime).toContain("In-Reply-To: <first@antidotes.fr>");
    expect(mime).toContain("References: <first@antidotes.fr>");
  });
});

describe("buildOutreachHtml", () => {
  it("met le texte en paragraphes, rend les liens cliquables et échappe le reste", () => {
    const html = buildOutreachHtml({ ...email, body: "Un <test> & deux\n\nhttps://antidotes.fr/x" });
    expect(html).toContain("<p style=\"margin:0 0 14px;\">Un &lt;test&gt; &amp; deux</p>");
    expect(html).toContain('<a href="https://antidotes.fr/x" style="color:#2f5320;">https://antidotes.fr/x</a>');
    expect(html).toContain("Ne plus recevoir mes messages");
  });
});

describe("buildOutreachText", () => {
  it("termine par le lien de désinscription", () => {
    expect(buildOutreachText(email)).toMatch(/Pour ne plus recevoir mes messages : https:\/\/antidotes\.fr\/desinscription\/deadbeef$/);
  });
});

describe("newMessageId / replySubject", () => {
  it("forme un identifiant au domaine et un objet de relance sans double « Re: »", () => {
    expect(newMessageId("sandro@antidotes.fr", "u-1")).toBe("<u-1@antidotes.fr>");
    expect(replySubject("Objet")).toBe("Re: Objet");
    expect(replySubject("Re: Objet")).toBe("Re: Objet");
    expect(replySubject("RE : Objet")).toBe("RE : Objet");
  });
});
