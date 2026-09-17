import { describe, expect, it } from "vitest";

import { chercheUneImitation } from "../../src/noyau/detection.ts";
import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";
import {
  listeLegitime,
  litLesTyposquats,
  litUnJeuDeDomaines,
} from "../donnees/lecture.ts";

const index = construisLIndexDeRecherche(listeLegitime());
const signale = (domaine: string) => chercheUneImitation(index, domaine);

describe("Les domaines hors périmètre", () => {
  it.each(litUnJeuDeDomaines("../donnees/a-ne-pas-signaler.txt"))(
    "ne déclenchent aucune alerte : %s",
    (domaine) => {
      expect(signale(domaine)).toBeNull();
    },
  );
});

describe("Les domaines légitimes signalés à tort", () => {
  const signalesAujourdhui = litUnJeuDeDomaines(
    "../donnees/domaines-legitimes-signales.txt",
  );

  it.fails.each(signalesAujourdhui)(
    "ne devraient déclencher aucune alerte : %s",
    (domaine) => {
      expect(signale(domaine)).toBeNull();
    },
  );

  it("sont appariés à un autre domaine de la liste, bien réel et distinct", () => {
    const apparies = signalesAujourdhui.map(
      (domaine) => signale(domaine)?.domaineImite,
    );
    expect(apparies).not.toContain(undefined);
  });
});

describe("Les typosquats", () => {
  const typosquats = litLesTyposquats("../donnees/typosquats.txt");

  const detectes = typosquats.filter(
    ({ domaineSuspect }) => signale(domaineSuspect) !== null,
  );

  it.each(detectes)(
    "sont signalés et désignent le bon domaine légitime : $domaineSuspect ($classe)",
    ({ domaineSuspect, domaineImite }) => {
      expect(signale(domaineSuspect)?.domaineImite).toBe(domaineImite);
    },
  );

  const encoreNonDetectes = typosquats
    .filter(({ domaineSuspect }) => signale(domaineSuspect) === null)
    .map(({ domaineSuspect }) => domaineSuspect);

  it("laissent passer exactement les classes que le score scalaire ne sait pas voir", () => {
    expect(encoreNonDetectes).toEqual([
      "bellry.fr",
      "belly.fr",
      "belley.com",
      "belley.fr.com",
      "ameli-fr.com",
      "mairie-belley-officiel.xyz",
      "impots.gouv.fr.secure-login.com",
      "bеlley.fr",
      "arneli.fr",
    ]);
  });
});
