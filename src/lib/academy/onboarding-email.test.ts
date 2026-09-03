import { describe, expect, it } from "vitest";

import {
  buildOnboardingHtml,
  buildOnboardingMime,
  buildOnboardingText,
  onboardingLink,
  onboardingSubject,
  type OnboardingEmail,
} from "./onboarding-email";

/**
 * Le courriel d'arrivée est le seul contact que certaines élèves auront avant
 * d'entrer : un lien mal formé ou un accent cassé, et l'accès est perdu sans
 * que personne ne sache pourquoi. Ces cas lisent le message hors de toute
 * boîte mail.
 */

const email = (patch: Partial<OnboardingEmail> = {}): OnboardingEmail => ({
  from: "agence@antidotes.test",
  to: "camille@exemple.fr",
  firstName: "Camille",
  courseTitle: "Devenir libre grâce à l'UGC",
  link: "https://antidotes.test/auth/callback?token_hash=abc&type=invite&suivant=%2Facademy%2Fugc",
  senderName: "Alessandro",
  ...patch,
});

describe("onboardingLink", () => {
  it("passe par token_hash, la forme qui marche dans un autre navigateur", () => {
    const link = onboardingLink({
      siteUrl: "https://antidotes.test",
      tokenHash: "jeton-123",
      type: "invite",
      courseSlug: "devenir-libre-grace-a-l-ugc",
    });

    expect(link).toContain("/auth/callback?");
    expect(link).toContain("token_hash=jeton-123");
    expect(link).toContain("type=invite");
    // Le retour se fait sur la formation, jamais sur l'accueil.
    expect(link).toContain("suivant=%2Facademy%2Fdevenir-libre-grace-a-l-ugc");
  });

  it("ne double pas la barre oblique quand l'URL du site en porte une", () => {
    const link = onboardingLink({
      siteUrl: "https://antidotes.test/",
      tokenHash: "x",
      type: "magiclink",
      courseSlug: "ugc",
    });
    expect(link.startsWith("https://antidotes.test/auth/callback?")).toBe(true);
  });
});

describe("onboardingSubject", () => {
  it("nomme la formation, parce que c'est ce qu'on a acheté", () => {
    expect(onboardingSubject("Devenir libre grâce à l'UGC")).toBe(
      "Ton accès à « Devenir libre grâce à l'UGC »",
    );
  });
});

describe("buildOnboardingText", () => {
  it("salue par le prénom quand on le connaît", () => {
    expect(buildOnboardingText(email())).toContain("Salut Camille,");
  });

  it("salue sans prénom plutôt que d'écrire un trou", () => {
    const texte = buildOnboardingText(email({ firstName: null }));
    expect(texte).toContain("Salut,");
    expect(texte).not.toContain("Salut ,");
  });

  it("porte le lien en clair — c'est tout le travail du message", () => {
    expect(buildOnboardingText(email())).toContain(email().link);
  });
});

describe("buildOnboardingHtml", () => {
  it("échappe ce qui viendrait d'un champ libre", () => {
    const html = buildOnboardingHtml(email({ firstName: '<script>"x"' }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("garde les accents du titre — l'apostrophe et le circonflexe se rendent", () => {
    expect(buildOnboardingHtml(email())).toContain("Devenir libre grâce à l'UGC");
  });
});

describe("buildOnboardingMime", () => {
  it("porte les deux parties : un client sans HTML n'a pas une page blanche", () => {
    const mime = buildOnboardingMime(email());
    expect(mime).toContain("Content-Type: multipart/alternative");
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it("ferme la frontière — sans le tiret final, le message est tronqué", () => {
    const mime = buildOnboardingMime(email());
    expect(mime).toContain("--antidotes-academy-onboarding-boundary--");
  });

  it("encode l'objet : les accents bruts dans un en-tête ne passent pas", () => {
    const mime = buildOnboardingMime(email());
    const objet = mime.split("\r\n").find((line) => line.startsWith("Subject: "));
    expect(objet).toBeDefined();
    // eslint-disable-next-line no-control-regex
    expect(/^Subject: [\x00-\x7F]*$/.test(objet!)).toBe(true);
  });

  it("replie le base64 à 76 colonnes, comme l'exige la RFC 2045", () => {
    const corps = buildOnboardingMime(email())
      .split("\r\n")
      .filter((line) => /^[A-Za-z0-9+/=]{20,}$/.test(line));
    expect(corps.length).toBeGreaterThan(0);
    expect(corps.every((line) => line.length <= 76)).toBe(true);
  });
});
