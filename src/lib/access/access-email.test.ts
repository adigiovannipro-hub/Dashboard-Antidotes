import { describe, expect, it } from "vitest";

import {
  accessButtonLabel,
  accessLink,
  accessSubject,
  buildAccessHtml,
  buildAccessMime,
  buildAccessText,
  type AccessEmail,
} from "./access-email";

const email = (overrides: Partial<AccessEmail> = {}): AccessEmail => ({
  kind: "invitation",
  from: "agence@antidotes.fr",
  to: "justine@client.fr",
  firstName: "Justine",
  workspaceName: "ANMF",
  link: "https://app.test/auth/acces?token_hash=abc&type=magiclink&suivant=%2Fespace%2Fanmf",
  loginUrl: "https://app.test/login",
  senderName: "Alessandro",
  ...overrides,
});

/** Le corps d'une partie, décodé. */
function part(mime: string, contentType: string): string {
  const start = mime.indexOf(`Content-Type: ${contentType}`);
  const body = mime.slice(start).split("\r\n\r\n")[1]!.split("\r\n--")[0]!;
  return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
}

describe("accessLink", () => {
  it("passe par la page à un bouton, jeton et destination en paramètres", () => {
    const link = new URL(
      accessLink({
        siteUrl: "https://app.test/",
        tokenHash: "abc",
        type: "invite",
        destination: "/espace/anmf",
      }),
    );
    expect(link.origin + link.pathname).toBe("https://app.test/auth/acces");
    expect(link.searchParams.get("token_hash")).toBe("abc");
    expect(link.searchParams.get("type")).toBe("invite");
    expect(link.searchParams.get("suivant")).toBe("/espace/anmf");
  });
});

describe("accessButtonLabel", () => {
  it("dit où mène le bouton", () => {
    expect(accessButtonLabel("/espace/anmf/planning")).toBe("Accéder à mon espace");
    expect(accessButtonLabel("/academy/ugc")).toBe("Entrer dans la formation");
    expect(accessButtonLabel("/")).toBe("Me connecter");
    expect(accessButtonLabel(undefined)).toBe("Me connecter");
  });
});

describe("accessSubject", () => {
  it("nomme l'espace d'une invitation", () => {
    expect(accessSubject(email())).toBe("Votre espace ANMF est ouvert");
  });

  it("reste neutre pour un lien de connexion", () => {
    expect(accessSubject(email({ kind: "connexion", workspaceName: null }))).toBe(
      "Votre lien de connexion",
    );
  });
});

describe("buildAccessHtml", () => {
  it("porte le lien entier dans le bouton, échappé", () => {
    const html = buildAccessHtml(email());
    expect(html).toContain(
      'href="https://app.test/auth/acces?token_hash=abc&amp;type=magiclink&amp;suivant=%2Fespace%2Fanmf"',
    );
    expect(html).toContain("Accéder à mon espace");
    expect(html).toContain("Bonjour Justine,");
  });

  it("échappe ce qui vient d'une saisie", () => {
    const html = buildAccessHtml(email({ firstName: "<b>Jo</b>", workspaceName: "A & B" }));
    expect(html).toContain("Bonjour &lt;b&gt;Jo&lt;/b&gt;,");
    expect(html).toContain("A &amp; B");
  });

  it("dit « Bonjour, » sans prénom", () => {
    expect(buildAccessHtml(email({ firstName: null }))).toContain("Bonjour,<br />");
  });
});

describe("buildAccessText", () => {
  it("donne le lien en clair et où en redemander un", () => {
    const text = buildAccessText(email());
    expect(text).toContain(email().link);
    expect(text).toContain("https://app.test/login");
  });
});

describe("buildAccessMime", () => {
  const mime = buildAccessMime(email());

  it("est un multipart/alternative à deux parties", () => {
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="antidotes-acces-espace-boundary"');
    expect(mime.match(/--antidotes-acces-espace-boundary\r\n/g)).toHaveLength(2);
    expect(mime.trimEnd().endsWith("--antidotes-acces-espace-boundary--")).toBe(true);
  });

  it("encode l'objet accentué, laisse l'ASCII en clair", () => {
    expect(mime).toMatch(/^Subject: Votre espace ANMF est ouvert$/m);
    expect(buildAccessMime(email({ workspaceName: "Élise" }))).toMatch(
      /^Subject: =\?UTF-8\?B\?/m,
    );
  });

  it("rend les deux corps décodables, lien compris", () => {
    expect(part(mime, "text/plain")).toContain(email().link);
    expect(part(mime, "text/html")).toContain("Accéder à mon espace");
  });
});
