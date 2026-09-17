import { describe, expect, it } from "vitest";

import { analyseLUrl } from "../../src/noyau/detection.ts";
import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";
import {
  domainesExclus,
  listeLegitime,
  litLesTyposquats,
  litUnJeuDeDomaines,
} from "../donnees/lecture.ts";

const index = construisLIndexDeRecherche(listeLegitime());
const exclus = domainesExclus();

const verdictPour = (domaine: string) =>
  analyseLUrl(index, exclus, `https://${domaine}/`);

describe("Les domaines hors périmètre", () => {
  it.each(litUnJeuDeDomaines("../donnees/a-ne-pas-signaler.txt"))(
    "ne déclenchent aucune alerte : %s",
    (domaine) => {
      expect(verdictPour(domaine)).toBeNull();
    },
  );
});

describe("Les typosquats connus", () => {
  const typosquats = litLesTyposquats("../donnees/typosquats.txt");
  const reconnus = typosquats.filter(({ severite }) => severite !== "aucune");
  const nonReconnus = typosquats.filter(({ severite }) => severite === "aucune");

  it.each(reconnus)(
    "$domaineSuspect est classé $classe en $severite",
    ({ domaineSuspect, domaineImite, classe, severite }) => {
      const verdict = verdictPour(domaineSuspect);
      expect(verdict?.severite).toBe(severite);
      expect(verdict?.classe).toBe(classe);
      expect(verdict?.domaineImite).toBe(domaineImite);
    },
  );

  it.each(nonReconnus)(
    "$domaineSuspect échappe encore au détecteur",
    ({ domaineSuspect }) => {
      expect(verdictPour(domaineSuspect)).toBeNull();
    },
  );

  it("bloque tous les sous-domaines trompeurs et tous les homoglyphes", () => {
    const classesToujoursBloquantes = ["sous-domaine-trompeur", "homoglyphe"];
    const severites = typosquats
      .filter(({ classe }) => classesToujoursBloquantes.includes(classe))
      .map(({ domaineSuspect }) => verdictPour(domaineSuspect)?.severite);

    expect([...new Set(severites)]).toEqual(["blocage"]);
  });
});
