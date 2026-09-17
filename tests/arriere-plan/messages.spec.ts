import { describe, expect, it } from "vitest";

import { estUneDemandeDAutorisation } from "../../src/arriere-plan/messages.ts";

describe("La reconnaissance d'une demande d'autorisation", () => {
  it("accepte un message bien formé", () => {
    expect(
      estUneDemandeDAutorisation({
        type: "autorise-le-domaine",
        domaine: "belley.com",
      }),
    ).toBe(true);
  });

  it("refuse un message d'un autre type", () => {
    expect(
      estUneDemandeDAutorisation({ type: "autre", domaine: "belley.com" }),
    ).toBe(false);
  });

  it("refuse un domaine absent ou vide", () => {
    expect(estUneDemandeDAutorisation({ type: "autorise-le-domaine" })).toBe(
      false,
    );
    expect(
      estUneDemandeDAutorisation({ type: "autorise-le-domaine", domaine: "" }),
    ).toBe(false);
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(estUneDemandeDAutorisation(null)).toBe(false);
    expect(estUneDemandeDAutorisation("autorise-le-domaine")).toBe(false);
    expect(estUneDemandeDAutorisation(undefined)).toBe(false);
  });
});
