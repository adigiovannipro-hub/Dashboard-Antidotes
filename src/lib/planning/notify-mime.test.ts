import { describe, expect, it } from "vitest";

import {
  approvalSubject,
  buildApprovalHtml,
  buildApprovalMime,
  buildCommentHtml,
  buildCommentMime,
  type ApprovalEmail,
  type CommentEmail,
} from "./notify-mime";

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

const approval = (partial: Partial<ApprovalEmail> = {}): ApprovalEmail => ({
  from: "agence@antidotes.fr",
  to: "alessandro@antidotes.fr",
  workspaceName: "ANMF",
  subjectName: "POV : LES MÉTIERS QUE L'IA NE REMPLACERA PAS",
  laneName: "META",
  formatLabel: "Reel",
  dateLabel: "jeudi 15 octobre 2026",
  approverName: "Candice HEYMAN",
  wording: "Ligne une\nLigne deux",
  link: "https://app.antidotes.agency/espace/anmf/planning/pe-2026?sujet=abc",
  ...partial,
});

describe("buildApprovalMime", () => {
  it("dit dans l'objet quelle publication et quel client", () => {
    expect(approvalSubject(approval())).toBe(
      "Validé — POV : LES MÉTIERS QUE L'IA NE REMPLACERA PAS (ANMF)",
    );
    const mime = buildApprovalMime(approval());
    expect(mime).toContain("To: alessandro@antidotes.fr");
    expect(mime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
  });

  it("porte le réseau, le format, la date, qui a validé, la caption et le lien", () => {
    const html = buildApprovalHtml(approval());
    for (const part of ["ANMF · META", "Validé par Candice HEYMAN", "Reel · prévue le jeudi 15 octobre 2026", "Ligne une<br />Ligne deux", "?sujet=abc"]) {
      expect(html).toContain(part);
    }
  });

  it("tronque une longue caption, dit « sans date », et échappe le HTML", () => {
    const html = buildApprovalHtml(
      approval({ wording: `<b>${"x".repeat(900)}`, dateLabel: null, approverName: "<i>Eve</i>" }),
    );
    expect(html).toContain("sans date");
    expect(html).toContain("…");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;i&gt;Eve&lt;/i&gt;");
  });
});
