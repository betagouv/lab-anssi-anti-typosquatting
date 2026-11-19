import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normaliseLeNomDHote } from "../../src/noyau/normalisation.ts";
import { decoupeLaLigneCsv } from "../../scripts/sources/csv.ts";
import { FICHIER_DES_MARQUES, litLesMarques, mediametrie } from "../../scripts/sources/mediametrie.ts";
import { litLeManifeste } from "../../scripts/sources/manifeste.ts";

const NOMBRE_DE_MARQUES_DU_CLASSEMENT = 50;

const lignesDuFichier = (): string[][] =>
  readFileSync(FICHIER_DES_MARQUES, "utf-8")
    .split(/\r?\n/)
    .filter((ligne) => ligne.length > 0)
    .slice(1)
    .map((ligne) => decoupeLaLigneCsv(ligne, ";"));

describe("La lecture du classement Médiamétrie", () => {
  it("extrait le domaine de chaque marque", () => {
    const csv = "rang;marque;domaine\n1;Google;google.com\n2;Leboncoin.fr;leboncoin.fr\n";
    expect(litLesMarques(csv)).toEqual([
      { nomDHote: "google.com", joignable: true },
      { nomDHote: "leboncoin.fr", joignable: true },
    ]);
  });

  it("refuse un fichier sans colonne domaine", () => {
    expect(() => litLesMarques("rang;marque\n1;Google\n")).toThrow("domaine");
  });

  it("est déclarée dans le manifeste", () => {
    expect(litLeManifeste().map((source) => source.id)).toContain(mediametrie.id);
  });
});

describe("Le fichier des marques Médiamétrie", () => {
  it("couvre les rangs 1 à 50, une marque pouvant avoir plusieurs domaines", () => {
    const rangs = [...new Set(lignesDuFichier().map(([rang]) => Number(rang)))];
    expect(rangs).toEqual(Array.from({ length: NOMBRE_DE_MARQUES_DU_CLASSEMENT }, (_, position) => position + 1));
  });

  it("donne pour chaque marque un domaine enregistrable valide, sans doublon", () => {
    const domaines = lignesDuFichier().map(([, marque, domaine]) => {
      expect(marque?.trim().length).toBeGreaterThan(0);
      const normalise = normaliseLeNomDHote(domaine ?? "");
      expect(normalise, `domaine invalide : ${domaine ?? ""}`).not.toBeNull();
      return normalise?.domaineEnregistrable;
    });
    expect(new Set(domaines).size).toBe(domaines.length);
  });
});
