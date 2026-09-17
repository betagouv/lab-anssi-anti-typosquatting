import { describe, expect, it } from "vitest";

import {
  similariteCosinus,
  vecteurDeBigrammes,
} from "../../src/noyau/bigrammes.ts";

describe("Le vecteur de bigrammes", () => {
  it("découpe la chaîne en paires de caractères consécutifs", () => {
    expect([...vecteurDeBigrammes("abcd")]).toEqual([
      ["ab", 1],
      ["bc", 1],
      ["cd", 1],
    ]);
  });

  it("compte les répétitions", () => {
    expect(vecteurDeBigrammes("ababa").get("ab")).toBe(2);
    expect(vecteurDeBigrammes("ababa").get("ba")).toBe(2);
  });

  it("est vide pour une chaîne de moins de deux caractères", () => {
    expect(vecteurDeBigrammes("").size).toBe(0);
    expect(vecteurDeBigrammes("a").size).toBe(0);
  });
});

describe("La similarité cosinus", () => {
  it("vaut 1 pour deux vecteurs identiques", () => {
    const vecteur = vecteurDeBigrammes("belley.fr");
    expect(similariteCosinus(vecteur, vecteur)).toBeCloseTo(1);
  });

  it("vaut 0 pour deux chaînes sans bigramme commun", () => {
    expect(
      similariteCosinus(vecteurDeBigrammes("abcd"), vecteurDeBigrammes("wxyz")),
    ).toBe(0);
  });

  it("renvoie 0 plutôt que NaN quand un vecteur est vide", () => {
    const vide = vecteurDeBigrammes("a");
    const plein = vecteurDeBigrammes("belley.fr");
    expect(similariteCosinus(vide, plein)).toBe(0);
    expect(similariteCosinus(plein, vide)).toBe(0);
    expect(similariteCosinus(vide, vide)).toBe(0);
  });

  it("est symétrique", () => {
    const gauche = vecteurDeBigrammes("belley.fr");
    const droite = vecteurDeBigrammes("belleray.fr");
    expect(similariteCosinus(gauche, droite)).toBeCloseTo(
      similariteCosinus(droite, gauche),
    );
  });
});
