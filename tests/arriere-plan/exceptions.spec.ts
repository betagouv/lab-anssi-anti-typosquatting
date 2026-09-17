import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { stockage } = vi.hoisted(() => ({
  stockage: { contenu: Object.create(null) as Record<string, unknown> },
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        get: (cle: string) =>
          Promise.resolve({ [cle]: stockage.contenu[cle] }),
        set: (valeurs: Record<string, unknown>) => {
          Object.assign(stockage.contenu, valeurs);
          return Promise.resolve();
        },
      },
    },
  },
}));

const { autoriseLeDomaine, domainesAutorises } = await import(
  "../../src/arriere-plan/exceptions.ts"
);

const UNE_JOURNEE = 24 * 60 * 60 * 1000;

describe("Les exceptions utilisateur", () => {
  beforeEach(() => {
    stockage.contenu = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sont vides au départ", async () => {
    expect([...(await domainesAutorises())]).toEqual([]);
  });

  it("retiennent un domaine autorisé", async () => {
    await autoriseLeDomaine("belley.com");
    expect([...(await domainesAutorises())]).toEqual(["belley.com"]);
  });

  it("en accumulent plusieurs", async () => {
    await autoriseLeDomaine("belley.com");
    await autoriseLeDomaine("ameli-fr.com");
    expect([...(await domainesAutorises())].sort()).toEqual([
      "ameli-fr.com",
      "belley.com",
    ]);
  });

  it("expirent au bout de vingt-quatre heures", async () => {
    await autoriseLeDomaine("belley.com");

    vi.setSystemTime(Date.now() + UNE_JOURNEE - 1000);
    expect([...(await domainesAutorises())]).toEqual(["belley.com"]);

    vi.setSystemTime(Date.now() + 2000);
    expect([...(await domainesAutorises())]).toEqual([]);
  });

  it("purgent les entrées expirées à la prochaine écriture", async () => {
    await autoriseLeDomaine("belley.com");
    vi.setSystemTime(Date.now() + UNE_JOURNEE + 1000);

    await autoriseLeDomaine("ameli-fr.com");

    expect(Object.keys(stockage.contenu["exceptions"] as object)).toEqual([
      "ameli-fr.com",
    ]);
  });

  it("ignorent un stockage corrompu", async () => {
    stockage.contenu["exceptions"] = "pas un objet d'exceptions";
    expect([...(await domainesAutorises())]).toEqual([]);
  });
});
