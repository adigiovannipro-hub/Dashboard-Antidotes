import { describe, expect, it } from "vitest";

import { pickNewestAccount, type ComposioAccountLike } from "./pick";

const account = (overrides: Partial<ComposioAccountLike> = {}): ComposioAccountLike => ({
  id: "ca_ancien",
  isDisabled: false,
  createdAt: "2026-09-02T12:00:00.000Z",
  ...overrides,
});

describe("pickNewestAccount", () => {
  it("prend la connexion la plus récente, celle d'un rebranchement", () => {
    const picked = pickNewestAccount([
      account(),
      account({ id: "ca_neuf", createdAt: "2026-10-01T10:35:00.000Z" }),
    ]);
    expect(picked?.id).toBe("ca_neuf");
  });

  it("écarte un compte désactivé, même plus récent", () => {
    const picked = pickNewestAccount([
      account(),
      account({ id: "ca_neuf", createdAt: "2026-10-01T10:35:00.000Z", isDisabled: true }),
    ]);
    expect(picked?.id).toBe("ca_ancien");
  });

  it("préfère un compte daté à un compte sans date", () => {
    const picked = pickNewestAccount([
      account({ id: "ca_sans_date", createdAt: null }),
      account(),
    ]);
    expect(picked?.id).toBe("ca_ancien");
  });

  it("rend null sans compte utilisable", () => {
    expect(pickNewestAccount([])).toBeNull();
    expect(pickNewestAccount([account({ isDisabled: true })])).toBeNull();
  });
});
