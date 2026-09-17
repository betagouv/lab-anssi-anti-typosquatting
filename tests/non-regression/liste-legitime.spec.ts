import { describe, expect, it } from "vitest";

import { classifie } from "../../src/noyau/classification.ts";
import { analyseLUrl } from "../../src/noyau/detection.ts";
import {
  construisLIndexDeRecherche,
  type IndexDeRecherche,
} from "../../src/noyau/index-de-recherche.ts";
import { normaliseLeNomDHote } from "../../src/noyau/normalisation.ts";
import { domainesExclus, listeLegitime } from "../donnees/lecture.ts";

const TAILLE_DE_LECHANTILLON = 3000;
const GRAINE = 20260917;
const PART_MAXIMALE_DE_BLOCAGES = 0.001;
const PART_MAXIMALE_DAVERTISSEMENTS = 0.08;

const domainesLegitimes = listeLegitime();
const index = construisLIndexDeRecherche(domainesLegitimes);
const exclus = domainesExclus();

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

const commeSIlEtaitInconnu = (domaine: string): IndexDeRecherche => ({
  ...index,
  domaines: {
    has: (autre: string) => autre !== domaine && index.domaines.has(autre),
  } as ReadonlySet<string>,
});

const verdictSiInconnu = (domaine: string) => {
  const normalise = normaliseLeNomDHote(domaine);
  return normalise === null ? null : classifie(commeSIlEtaitInconnu(domaine), normalise);
};

describe("La liste légitime passée dans le détecteur", () => {
  it("ne signale aucun de ses propres domaines", () => {
    const signales = aVerifier.filter(
      (domaine) => analyseLUrl(index, exclus, `https://${domaine}/`) !== null,
    );
    expect(signales).toEqual([]);
  });
});

describe("Un domaine public légitime absent de la liste", () => {
  const verdicts = aVerifier
    .map(verdictSiInconnu)
    .filter((verdict) => verdict !== null);

  const blocages = verdicts.filter(({ severite }) => severite === "blocage");

  it("n'est presque jamais bloqué", () => {
    expect(blocages.length / aVerifier.length).toBeLessThan(
      PART_MAXIMALE_DE_BLOCAGES,
    );
  });

  it("n'est averti que dans une minorité de cas", () => {
    expect(verdicts.length / aVerifier.length).toBeLessThan(
      PART_MAXIMALE_DAVERTISSEMENTS,
    );
  });

  it("n'est jamais apparié à un domaine absent de la liste légitime", () => {
    const connus = new Set(domainesLegitimes);
    const apparieAUnInconnu = verdicts.filter(
      ({ domaineImite }) => !connus.has(domaineImite),
    );
    expect(apparieAUnInconnu).toEqual([]);
  });
}, 180_000);
