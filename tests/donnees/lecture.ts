import { readFileSync } from "node:fs";

import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";

export interface Typosquat {
  readonly domaineSuspect: string;
  readonly domaineImite: string;
  readonly classe: string;
}

const contenuDu = (nomDuFichier: string): string =>
  readFileSync(new URL(nomDuFichier, import.meta.url), "utf-8");

export const litUnJeuDeDomaines = (nomDuFichier: string): string[] =>
  litLaListeDeDomaines(contenuDu(nomDuFichier));

export const litLesTyposquats = (nomDuFichier: string): Typosquat[] =>
  litLaListeDeDomaines(contenuDu(nomDuFichier)).map((ligne) => {
    const [domaineSuspect, domaineImite, classe] = ligne
      .split("|")
      .map((champ) => champ.trim());

    if (
      domaineSuspect === undefined ||
      domaineImite === undefined ||
      classe === undefined
    ) {
      throw new Error(`Ligne de typosquat mal formée : ${ligne}`);
    }

    return { domaineSuspect, domaineImite, classe };
  });

export const listeLegitime = (): string[] =>
  litLaListeDeDomaines(
    readFileSync(
      new URL("../../src/donnees/domaines-legitimes.txt", import.meta.url),
      "utf-8",
    ),
  );
