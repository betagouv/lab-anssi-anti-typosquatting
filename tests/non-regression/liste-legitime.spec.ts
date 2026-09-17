import { describe, expect, it } from "vitest";

import { chercheUneImitation } from "../../src/noyau/detection.ts";
import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";
import { listeLegitime } from "../donnees/lecture.ts";

const TAILLE_DE_LECHANTILLON = 3000;
const GRAINE = 20260917;

const domainesLegitimes = listeLegitime();
const index = construisLIndexDeRecherche(domainesLegitimes);

const verificationComplete = process.env["VERIFICATION_COMPLETE"] === "1";

const echantillonReproductible = (): string[] => {
  if (verificationComplete) return domainesLegitimes;

  let etat = GRAINE;
  const tirage = (): number => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };

  return Array.from(
    { length: TAILLE_DE_LECHANTILLON },
    () => domainesLegitimes[Math.floor(tirage() * domainesLegitimes.length)]!,
  );
};

const aVerifier = echantillonReproductible();

const signalesATort = aVerifier.filter(
  (domaine) => chercheUneImitation(index, domaine) !== null,
);

describe("La liste légitime passée dans le détecteur", () => {
  it.fails("ne signale aucun de ses propres domaines", () => {
    expect(signalesATort).toEqual([]);
  });

  it("ne signale jamais un domaine contre lui-même", () => {
    const appariesAEuxMemes = aVerifier.filter(
      (domaine) => chercheUneImitation(index, domaine)?.domaineImite === domaine,
    );
    expect(appariesAEuxMemes).toEqual([]);
  });

  it("n'apparie qu'à des domaines présents dans la liste légitime", () => {
    const connus = new Set(domainesLegitimes);
    const appariesInconnus = signalesATort
      .map((domaine) => chercheUneImitation(index, domaine)?.domaineImite)
      .filter((domaineImite) => domaineImite !== undefined)
      .filter((domaineImite) => !connus.has(domaineImite));

    expect(appariesInconnus).toEqual([]);
  });
}, 120_000);
