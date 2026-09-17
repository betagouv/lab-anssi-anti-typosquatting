import { describe, expect, it } from "vitest";

import {
  distanceDeLevenshtein,
  similariteDEdition,
} from "../../src/noyau/levenshtein.ts";

const distanceDeReference = (gauche: string, droite: string): number => {
  const distances = Array.from({ length: gauche.length + 1 }, () =>
    new Array<number>(droite.length + 1).fill(0),
  );
  for (let i = 0; i <= gauche.length; i++) distances[i]![0] = i;
  for (let j = 0; j <= droite.length; j++) distances[0]![j] = j;
  for (let i = 1; i <= gauche.length; i++) {
    for (let j = 1; j <= droite.length; j++) {
      distances[i]![j] =
        gauche[i - 1] === droite[j - 1]
          ? distances[i - 1]![j - 1]!
          : Math.min(
              distances[i - 1]![j]!,
              distances[i]![j - 1]!,
              distances[i - 1]![j - 1]!,
            ) + 1;
    }
  }
  return distances[gauche.length]![droite.length]!;
};

const ALPHABET = "abcde-";

const chaineAleatoire = (longueurMaximale: number): string => {
  const longueur = Math.floor(Math.random() * (longueurMaximale + 1));
  return Array.from(
    { length: longueur },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!,
  ).join("");
};

const paires: [string, string][] = Array.from({ length: 300 }, () => [
  chaineAleatoire(12),
  chaineAleatoire(12),
]);

describe("La distance de Levenshtein", () => {
  it("vaut zéro pour deux chaînes identiques", () => {
    expect(distanceDeLevenshtein("belley.fr", "belley.fr")).toBe(0);
  });

  it("vaut la longueur de l'autre chaîne face à une chaîne vide", () => {
    expect(distanceDeLevenshtein("", "belley.fr")).toBe(9);
    expect(distanceDeLevenshtein("belley.fr", "")).toBe(9);
    expect(distanceDeLevenshtein("", "")).toBe(0);
  });

  it("compte une substitution, une insertion et une suppression", () => {
    expect(distanceDeLevenshtein("belley.fr", "bellry.fr")).toBe(1);
    expect(distanceDeLevenshtein("belley.fr", "bellley.fr")).toBe(1);
    expect(distanceDeLevenshtein("belley.fr", "belle.fr")).toBe(1);
  });

  it("est symétrique", () => {
    for (const [gauche, droite] of paires) {
      expect(distanceDeLevenshtein(gauche, droite)).toBe(
        distanceDeLevenshtein(droite, gauche),
      );
    }
  });

  it("respecte l'inégalité triangulaire", () => {
    for (const [gauche, droite] of paires) {
      const intermediaire = chaineAleatoire(12);
      expect(distanceDeLevenshtein(gauche, droite)).toBeLessThanOrEqual(
        distanceDeLevenshtein(gauche, intermediaire) +
          distanceDeLevenshtein(intermediaire, droite),
      );
    }
  });

  it("donne le même résultat que l'implémentation de référence", () => {
    for (const [gauche, droite] of paires) {
      expect(distanceDeLevenshtein(gauche, droite)).toBe(
        distanceDeReference(gauche, droite),
      );
    }
  });

  describe("avec une borne", () => {
    it("reste exacte tant que la distance ne dépasse pas la borne", () => {
      for (const [gauche, droite] of paires) {
        const exacte = distanceDeReference(gauche, droite);
        for (const borne of [0, 1, 2, 3, 5]) {
          const bornee = distanceDeLevenshtein(gauche, droite, borne);
          if (exacte <= borne) expect(bornee).toBe(exacte);
          else expect(bornee).toBeGreaterThan(borne);
        }
      }
    });

    it("écarte immédiatement un écart de longueur trop grand", () => {
      expect(distanceDeLevenshtein("a", "abcdefghij", 2)).toBeGreaterThan(2);
    });
  });
});

describe("La similarité d'édition", () => {
  it("vaut 1 pour deux chaînes identiques", () => {
    expect(similariteDEdition("belley.fr", "belley.fr")).toBe(1);
  });

  it("vaut 1 pour deux chaînes vides plutôt que NaN", () => {
    expect(similariteDEdition("", "")).toBe(1);
  });

  it("décroît avec le nombre de modifications", () => {
    const uneModification = similariteDEdition("belley.fr", "bellry.fr");
    const deuxModifications = similariteDEdition("belley.fr", "bwllry.fr");
    expect(uneModification).toBeGreaterThan(deuxModifications);
  });
});
