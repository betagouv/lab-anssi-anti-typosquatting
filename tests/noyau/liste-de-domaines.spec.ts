import { describe, expect, it } from "vitest";

import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";

describe("La lecture d'une liste de domaines", () => {
  it("lit un domaine par ligne", () => {
    expect(litLaListeDeDomaines("belley.fr\nambronay.fr\n")).toEqual([
      "belley.fr",
      "ambronay.fr",
    ]);
  });

  it("ignore les lignes vides et les commentaires", () => {
    const contenu = "# une liste\nbelley.fr\n\n# un commentaire\nambronay.fr\n";
    expect(litLaListeDeDomaines(contenu)).toEqual([
      "belley.fr",
      "ambronay.fr",
    ]);
  });

  it("retire les espaces autour de chaque domaine", () => {
    expect(litLaListeDeDomaines("  belley.fr  \n\tambronay.fr\n")).toEqual([
      "belley.fr",
      "ambronay.fr",
    ]);
  });

  it("renvoie une liste vide pour un contenu vide", () => {
    expect(litLaListeDeDomaines("")).toEqual([]);
    expect(litLaListeDeDomaines("\n\n")).toEqual([]);
  });
});
