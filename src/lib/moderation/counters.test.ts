import { describe, expect, it } from "vitest";

import { deriveCounters, networksToShow, type CounterRow, type InboxSelection } from "./counters";

const ROW = (over: Partial<CounterRow> = {}): CounterRow => ({
  client_id: "bondet",
  channel: "instagram",
  kind: "comment",
  status: "to_process",
  unread: true,
  flags: [],
  last_message_at: "2026-09-11T08:00:00Z",
  ...over,
});

const SELECTION = (over: Partial<InboxSelection> = {}): InboxSelection => ({
  networks: [],
  statusGroup: "a-traiter",
  unreadOnly: false,
  flaggedOnly: false,
  dmOnly: false,
  ...over,
});

/* Un jeu qui couvre les trois dimensions et les deux pièges — le spam, qui
   quitte « À traiter », et un réseau sans aucune conversation. */
const ROWS: CounterRow[] = [
  ROW({ client_id: "bondet", channel: "instagram", kind: "comment" }),
  ROW({ client_id: "bondet", channel: "instagram", kind: "dm" }),
  ROW({ client_id: "bondet", channel: "facebook", kind: "comment", unread: false }),
  ROW({ client_id: "iway", channel: "facebook", kind: "comment" }),
  ROW({ client_id: "iway", channel: "instagram", kind: "comment", status: "snoozed" }),
  ROW({ client_id: "iway", channel: "facebook", kind: "comment", status: "sent" }),
  ROW({ client_id: "anmf", channel: "instagram", kind: "comment", flags: ["spam"] }),
];

describe("deriveCounters", () => {
  it("compte la liste affichée, et elle seule", () => {
    const counters = deriveCounters(ROWS, SELECTION());
    // Cinq lignes sont « à traiter » sur le papier ; celle marquée spam n'en
    // est pas, et les deux rangées `snoozed`/`sent` non plus.
    expect(counters.total).toBe(4);
    expect(counters.unread).toBe(3);
  });

  it("un badge de réseau dit ce que le clic montrera", () => {
    // Filtre posé sur Facebook : le badge d'Instagram continue d'annoncer ce
    // qu'un clic sur Instagram donnerait, pas zéro.
    const counters = deriveCounters(ROWS, SELECTION({ networks: ["facebook"] }));
    expect(counters.total).toBe(2);
    expect(counters.byNetwork.instagram).toBe(2);
    expect(counters.byNetwork.facebook).toBe(2);
  });

  it("garde une case à zéro pour un réseau relevé mais vide", () => {
    const counters = deriveCounters(ROWS, SELECTION());
    // YouTube est relevé et n'a rien : son icône reste, sinon la rangée se
    // décale et l'on clique sur le mauvais réseau.
    expect(counters.byNetwork.youtube).toBe(0);
    expect(networksToShow(ROWS)).toEqual(["instagram", "facebook", "youtube"]);
  });

  it("l'invariant : sans filtre, la somme des réseaux et celle des clients valent le total", () => {
    const counters = deriveCounters(ROWS, SELECTION());
    const parNetwork = Object.values(counters.byNetwork).reduce((a, b) => a + b, 0);
    const parClient = Object.values(counters.byClient).reduce((a, b) => a + b, 0);
    expect(parNetwork).toBe(counters.total);
    expect(parClient).toBe(counters.total);
  });

  it("l'invariant tient sur chaque segment de statut", () => {
    for (const statusGroup of ["a-traiter", "en-attente", "traitees"] as const) {
      const counters = deriveCounters(ROWS, SELECTION({ statusGroup }));
      const parNetwork = Object.values(counters.byNetwork).reduce((a, b) => a + b, 0);
      const parClient = Object.values(counters.byClient).reduce((a, b) => a + b, 0);
      expect(parNetwork).toBe(counters.total);
      expect(parClient).toBe(counters.total);
    }
  });

  it("« À traiter » ne dépasse jamais ce que les autres filtres laissent", () => {
    const counters = deriveCounters(ROWS, SELECTION());
    const tousStatuts = Object.values(counters.byStatusGroup).reduce((a, b) => a + b, 0);
    expect(counters.byStatusGroup["a-traiter"]).toBeLessThanOrEqual(tousStatuts);
    // Le spam n'est nulle part dans les trois segments : il reste lisible sous
    // « Signalées », pas dans la charge de travail.
    expect(tousStatuts).toBe(ROWS.length - 1);
  });

  it("le spam ne compte ni dans « À traiter » ni dans la pastille du rail", () => {
    const counters = deriveCounters(ROWS, SELECTION());
    expect(counters.byStatusGroup["a-traiter"]).toBe(4);
    expect(counters.pending).toBe(3);
  });

  it("« Signalées » se compte sur les drapeaux, spam compris", () => {
    const counters = deriveCounters(ROWS, SELECTION({ flaggedOnly: true, statusGroup: "a-traiter" }));
    // Le fil marqué spam n'est pas dans « À traiter » : le filtre « Signalées »
    // ne le ramène pas tout seul, il faut le segment qui le contient.
    expect(counters.total).toBe(0);
    expect(counters.byStatusGroup["a-traiter"]).toBe(0);
  });

  it("la bascule « Messages privés » écarte les commentaires", () => {
    const counters = deriveCounters(ROWS, SELECTION({ dmOnly: true }));
    expect(counters.total).toBe(1);
    expect(counters.byNetwork.instagram).toBe(1);
    expect(counters.byNetwork.facebook).toBe(0);
  });

  it("l'âge du plus vieux à traiter se lit en heures", () => {
    const counters = deriveCounters(
      [ROW({ last_message_at: "2026-09-11T00:00:00Z" })],
      SELECTION(),
      new Date("2026-09-11T06:00:00Z"),
    );
    expect(counters.oldestActionableHours).toBe(6);
  });
});
