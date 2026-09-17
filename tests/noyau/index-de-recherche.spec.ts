import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  chercheLesCandidats,
  construisLIndexDeRecherche,
} from "../../src/noyau/index-de-recherche.ts";
import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";
import { indexeLeDomaine } from "../../src/noyau/score.ts";

const candidatsPour = (domaines: string[], recherche: string): string[] =>
  chercheLesCandidats(
    construisLIndexDeRecherche(domaines),
    indexeLeDomaine(recherche),
  ).map((candidat) => candidat.domaine);

const domainesLegitimes = litLaListeDeDomaines(
  readFileSync(
    new URL("../../src/donnees/domaines-legitimes.txt", import.meta.url),
    "utf-8",
  ),
);

const tirageReproductible = (graine: number): (() => number) => {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz-";

const avecUneModification = (domaine: string, tirage: () => number): string => {
  const separateur = domaine.indexOf(".");
  const etiquette = domaine.slice(0, separateur);
  const suffixe = domaine.slice(separateur);
  const position = Math.floor(tirage() * etiquette.length);
  const remplacant = ALPHABET[Math.floor(tirage() * ALPHABET.length)]!;

  switch (Math.floor(tirage() * 3)) {
    case 0:
      return etiquette.slice(0, position) + etiquette.slice(position + 1) + suffixe;
    case 1:
      return (
        etiquette.slice(0, position) + remplacant + etiquette.slice(position) + suffixe
      );
    default:
      return (
        etiquette.slice(0, position) +
        remplacant +
        etiquette.slice(position + 1) +
        suffixe
      );
  }
};

describe("L'index de recherche", () => {
  it("retient un domaine identique à la recherche", () => {
    expect(candidatsPour(["belley.fr", "lemonde.fr"], "belley.fr")).toContain(
      "belley.fr",
    );
  });

  it("retient un domaine à une faute de frappe", () => {
    expect(candidatsPour(["belley.fr", "lemonde.fr"], "bellley.fr")).toContain(
      "belley.fr",
    );
  });

  it("écarte un domaine sans bigramme commun", () => {
    expect(candidatsPour(["belley.fr", "xwqzkj.pm"], "belley.fr")).not.toContain(
      "xwqzkj.pm",
    );
  });

  it("écarte un domaine de longueur trop différente", () => {
    const tresLong = "une-communaute-de-communes-tres-longue.fr";
    expect(candidatsPour([tresLong], "belley.fr")).toEqual([]);
  });

  it("ne renvoie aucun candidat pour une recherche trop courte pour un bigramme", () => {
    expect(candidatsPour(["belley.fr"], "a")).toEqual([]);
  });

  describe("sur la liste légitime réelle", () => {
    const index = construisLIndexDeRecherche(domainesLegitimes);

    it("réduit fortement le nombre de comparaisons", () => {
      const candidats = chercheLesCandidats(
        index,
        indexeLeDomaine("bellley.fr"),
      );
      expect(candidats.length).toBeGreaterThan(0);
      expect(candidats.length).toBeLessThan(domainesLegitimes.length / 10);
    });

    it("conserve toujours le domaine source pour une mutation à une édition", () => {
      const tirage = tirageReproductible(20260917);
      const echantillon = Array.from(
        { length: 400 },
        () => domainesLegitimes[Math.floor(tirage() * domainesLegitimes.length)]!,
      );

      const manquants = echantillon.filter((source) => {
        const mutant = avecUneModification(source, tirage);
        const candidats = chercheLesCandidats(index, indexeLeDomaine(mutant));
        return !candidats.some((candidat) => candidat.domaine === source);
      });

      expect(manquants).toEqual([]);
    });
  });
});
