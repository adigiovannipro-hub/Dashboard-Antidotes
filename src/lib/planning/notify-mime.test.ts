import { describe, expect, it } from "vitest";

import { buildCommentHtml, buildCommentMime, type CommentEmail } from "./notify-mime";

const email = (partial: Partial<CommentEmail> = {}): CommentEmail => ({
  from: "agence@antidotes.fr",
  to: "client@bondet.fr",
  workspaceName: "Bondet",
  subjectName: "Recette d'été",
  laneName: "INSTAGRAM",
  authorName: "Alessandro",
  body: "Le visuel est trop sombre.\nOn éclaircit ?",
  link: "https://antidotes.example/espace/bondet/planning/pe-2026?sujet=abc",
  ...partial,
});

describe("buildCommentHtml", () => {
  it("cite le retour, son auteur et la publication, avec le lien", () => {
    const html = buildCommentHtml(email());
    expect(html).toContain("Recette d'été");
    expect(html).toContain("Alessandro a laissé un retour");
    expect(html).toContain("Le visuel est trop sombre.<br />On éclaircit ?");
    expect(html).toContain("?sujet=abc");
    expect(html).toContain("INSTAGRAM");
  });

  it("échappe le HTML d'un retour — un retour n'injecte rien", () => {
    const html = buildCommentHtml(email({ body: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildCommentMime", () => {
  it("porte un objet encodé RFC 2047 et un corps HTML en base64", () => {
    const mime = buildCommentMime(email());
    expect(mime).toContain("To: client@bondet.fr");
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');

    const subject = mime.match(/Subject: =\?UTF-8\?B\?(.+)\?=/);
    expect(subject).not.toBeNull();
    expect(Buffer.from(subject![1]!, "base64").toString("utf8")).toBe(
      "Retour — Recette d'été (Bondet)",
    );

    const body = mime.split("\r\n\r\n")[1] ?? "";
    const decoded = Buffer.from(body.replaceAll("\r\n", ""), "base64").toString("utf8");
    expect(decoded).toContain("Ouvrir la publication");
  });
});
