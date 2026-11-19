import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";
import { formateLaProvenance, fusionneLesSelections, litLaProvenance } from "../../scripts/provenance.ts";
import { litLeManifeste } from "../../scripts/sources/manifeste.ts";

const contenuDuFichier = (cheminRelatif: string): string =>
  readFileSync(new URL(`../../${cheminRelatif}`, import.meta.url), "utf-8");

describe("La fusion des sélections", () => {
  const selections = [
    { idDeLaSource: "a", domaines: ["commun.fr", "seul-a.fr"] },
    { idDeLaSource: "b", domaines: ["commun.fr", "seul-b.fr"] },
  ];

  it("garde pour chaque domaine toutes les sources qui l'ont fourni, dans l'ordre des sources", () => {
    const fusion = fusionneLesSelections(selections);
    expect(fusion.get("commun.fr")).toEqual(["a", "b"]);
    expect(fusion.get("seul-a.fr")).toEqual(["a"]);
    expect(fusion.get("seul-b.fr")).toEqual(["b"]);
  });

  it("ne répète pas une source qui fournit deux fois le même domaine", () => {
    const fusion = fusionneLesSelections([{ idDeLaSource: "a", domaines: ["x.fr", "x.fr"] }]);
    expect(fusion.get("x.fr")).toEqual(["a"]);
  });
});

describe("Le format de la provenance", () => {
  it("trie les domaines et sépare les sources par une barre verticale", () => {
    const fusion = fusionneLesSelections([
      { idDeLaSource: "a", domaines: ["z.fr", "commun.fr"] },
      { idDeLaSource: "b", domaines: ["commun.fr"] },
    ]);
    expect(formateLaProvenance(fusion)).toBe("domaine;sources\ncommun.fr;a|b\nz.fr;a\n");
  });

  it("se relit à l'identique", () => {
    const contenu = "domaine;sources\ncommun.fr;a|b\nz.fr;a\n";
    expect(formateLaProvenance(litLaProvenance(contenu))).toBe(contenu);
  });

  it("refuse un en-tête inattendu", () => {
    expect(() => litLaProvenance("nom;origine\nx.fr;a\n")).toThrow("En-tête");
  });

  it("refuse une ligne sans source", () => {
    expect(() => litLaProvenance("domaine;sources\nx.fr;\n")).toThrow("mal formée");
  });
});

describe("La provenance versionnée", () => {
  const provenance = litLaProvenance(contenuDuFichier("donnees/provenance-des-domaines.csv"));
  const domainesLegitimes = litLaListeDeDomaines(contenuDuFichier("src/donnees/domaines-legitimes.txt").replaceAll("\r\n", "\n"));

  it("couvre exactement les domaines de la liste légitime", () => {
    expect([...provenance.keys()].sort()).toEqual([...domainesLegitimes].sort());
  });

  it("n'attribue chaque domaine qu'à des sources du manifeste", () => {
    const identifiantsConnus = new Set(litLeManifeste().map((source) => source.id));
    const sourcesInconnues = [...provenance.values()].flat().filter((id) => !identifiantsConnus.has(id));
    expect(sourcesInconnues).toEqual([]);
  });
});
