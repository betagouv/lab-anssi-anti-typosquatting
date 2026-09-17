import { describe, expect, it } from "vitest";

import { chercheUneImitation } from "../../src/noyau/detection.ts";
import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";

const detecteDans = (domainesLegitimes: string[], domaineVisite: string) =>
  chercheUneImitation(
    construisLIndexDeRecherche(domainesLegitimes),
    domaineVisite,
  );

describe("La recherche d'imitation", () => {
  it("ne signale rien quand le domaine visité est lui-même légitime", () => {
    expect(detecteDans(["belley.fr", "lemonde.fr"], "belley.fr")).toBeNull();
  });

  it("signale une faute de frappe sur un domaine légitime", () => {
    const imitation = detecteDans(["belley.fr"], "bellley.fr");
    expect(imitation?.domaineImite).toBe("belley.fr");
  });

  it("ne signale rien pour un domaine sans rapport", () => {
    expect(detecteDans(["belley.fr", "ambronay.fr"], "lemonde.fr")).toBeNull();
  });

  it("retient le meilleur candidat et non le premier rencontré", () => {
    const domainesLegitimes = ["bellcy.fr", "belley.fr", "bellzy.fr"];
    const imitation = detecteDans(domainesLegitimes, "bellley.fr");

    expect(imitation?.domaineImite).toBe("belley.fr");
  });

  it("donne le même résultat quel que soit l'ordre de la liste légitime", () => {
    const domainesLegitimes = ["bellcy.fr", "belley.fr", "bellzy.fr"];
    const inverse = [...domainesLegitimes].reverse();

    expect(detecteDans(domainesLegitimes, "bellley.fr")).toEqual(
      detecteDans(inverse, "bellley.fr"),
    );
  });

  it("rapporte un score compris entre le seuil et 1", () => {
    const imitation = detecteDans(["belley.fr"], "bellley.fr");
    expect(imitation?.scoreDeSuspicion).toBeGreaterThan(0.85);
    expect(imitation?.scoreDeSuspicion).toBeLessThanOrEqual(1);
  });

  it("ne signale rien sur une liste légitime vide", () => {
    expect(detecteDans([], "bellley.fr")).toBeNull();
  });
});
