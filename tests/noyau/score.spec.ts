import { describe, expect, it } from "vitest";

import { indexeLeDomaine, scoreDeSuspicion } from "../../src/noyau/score.ts";

const score = (gauche: string, droite: string): number =>
  scoreDeSuspicion(indexeLeDomaine(gauche), indexeLeDomaine(droite));

describe("Le score de suspicion", () => {
  it("vaut 1 pour deux domaines identiques", () => {
    expect(score("belley.fr", "belley.fr")).toBeCloseTo(1);
  });

  it("est plus élevé pour une faute de frappe que pour un domaine sans rapport", () => {
    expect(score("bellley.fr", "belley.fr")).toBeGreaterThan(
      score("lemonde.fr", "belley.fr"),
    );
  });

  it("est symétrique", () => {
    expect(score("bellley.fr", "belley.fr")).toBeCloseTo(
      score("belley.fr", "bellley.fr"),
    );
  });

  it("reste dans l'intervalle [0, 1]", () => {
    for (const [gauche, droite] of [
      ["belley.fr", "belley.fr"],
      ["a.fr", "belleray.fr"],
      ["lemonde.fr", "impots.gouv.fr"],
    ] as [string, string][]) {
      const valeur = score(gauche, droite);
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThanOrEqual(1);
    }
  });

  it("ne produit pas de NaN sur un domaine trop court pour un bigramme", () => {
    expect(Number.isNaN(score("a", "belley.fr"))).toBe(false);
  });
});
