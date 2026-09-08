import { describe, expect, it } from "vitest";

import { parseCsv, parseSharesCsv } from "./shares-csv";

describe("parseCsv", () => {
  it("lit guillemets doublés, virgules et sauts de ligne dans une cellule", () => {
    expect(parseCsv('a,"b, ""c""\nd",e\r\n1,2,3\n')).toEqual([
      ["a", 'b, "c"\nd', "e"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseSharesCsv", () => {
  const csv = [
    "Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility",
    '2026-08-12 09:15:00,https://www.linkedin.com/feed/update/urn:li:share:1,"Pourquoi vos posts d\'expertise n\'attirent aucun client, et ce que j\'ai changé.",,,MEMBER_NETWORK',
    "2026-08-01 08:00:00,https://www.linkedin.com/feed/update/urn:li:share:2,court,,,MEMBER_NETWORK",
    '2026-09-01 08:00:00,https://www.linkedin.com/feed/update/urn:li:share:3,"Deuxième post, assez long pour compter comme une vraie publication.",,,MEMBER_NETWORK',
  ].join("\n");

  it("garde les vrais posts, écarte les partages sans texte, trie du plus récent", () => {
    const { posts, skipped } = parseSharesCsv(csv);
    expect(skipped).toBe(1);
    expect(posts.map((post) => post.url)).toEqual([
      "https://www.linkedin.com/feed/update/urn:li:share:3",
      "https://www.linkedin.com/feed/update/urn:li:share:1",
    ]);
    expect(posts[1]).toMatchObject({ published_at: "2026-08-12T09:15:00.000Z" });
  });

  it("refuse un fichier qui n'est pas l'export", () => {
    expect(() => parseSharesCsv("a,b\n1,2")).toThrow(/ShareCommentary/);
  });
});
