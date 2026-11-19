import { describe, expect, it } from "vitest";

import { decideLaLivraison } from "../../../classifieur/livraison/decision.ts";

const criteres = { plancherDeF1: 0.95, tolerance: 0 };

describe("La décision de livraison", () => {
  it("livre un candidat meilleur que le modèle livré", () => {
    expect(decideLaLivraison(0.99, 0.97, criteres).livre).toBe(true);
  });

  it("livre un candidat à égalité avec le modèle livré", () => {
    expect(decideLaLivraison(0.97, 0.97, criteres).livre).toBe(true);
  });

  it("garde le modèle livré si le candidat est moins bon", () => {
    const decision = decideLaLivraison(0.96, 0.97, criteres);
    expect(decision.livre).toBe(false);
    expect(decision.raison).toContain("inférieur à celui du modèle livré");
  });

  it("garde le modèle livré si le candidat est sous le plancher, même s'il fait mieux que lui", () => {
    const decision = decideLaLivraison(0.9, 0.8, criteres);
    expect(decision.livre).toBe(false);
    expect(decision.raison).toContain("sous le plancher");
  });

  it("accepte un candidat légèrement moins bon dans la limite de la tolérance", () => {
    expect(decideLaLivraison(0.965, 0.97, { ...criteres, tolerance: 0.01 }).livre).toBe(true);
    expect(decideLaLivraison(0.955, 0.97, { ...criteres, tolerance: 0.01 }).livre).toBe(false);
  });

  it("cite les deux scores dans la raison pour qu'elle soit lisible dans le registre", () => {
    expect(decideLaLivraison(0.99, 0.97, criteres).raison).toContain("0.9900");
    expect(decideLaLivraison(0.99, 0.97, criteres).raison).toContain("0.9700");
  });
});
