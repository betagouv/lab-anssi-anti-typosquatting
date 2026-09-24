import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { cheminsDesResultats } from "../../../classifieur/commun/chemins.ts";
import { parcourtLeCsv } from "../../../classifieur/commun/fichiers.ts";
import { litLesDomaines } from "../../../classifieur/creation-du-dataset/domaines.ts";
import { genereLesDonnees } from "../../../classifieur/creation-du-dataset/generation.ts";
import { colonnesDesCaracteristiques, construitLigneDeCaracteristiques } from "../../../src/noyau/modele/caracteristiques.ts";
import { RechercheDeCandidats } from "../../../src/noyau/modele/recherche.ts";

describe("Les caractéristiques de Train et de l'extension", () => {
  it("recalculent les mêmes candidats et valeurs sans référence imposée", async () => {
    const repertoire = await realpath(await mkdtemp(join(tmpdir(), "classifieur-parite-")));
    const temporaire = await realpath(tmpdir());
    if (!repertoire.startsWith(`${temporaire}${sep}`) || !basename(repertoire).startsWith("classifieur-parite-")) {
      throw new Error("Répertoire temporaire inattendu.");
    }
    try {
      await genereLesDonnees({ repertoire, graine: "20260917", limite: 10,
        imitationsParDomaine: 4, intermediairesParDomaine: 4, distantsParDomaine: 2,
        scoreMinimumImitation: 0.85, scoreMinimumIntermediaire: 0.55,
        scoreMaximumIntermediaire: 0.8 });
      const recherche = new RechercheDeCandidats((await litLesDomaines()).domaines);
      let nombreVerifie = 0;
      for await (const ligne of parcourtLeCsv(cheminsDesResultats(repertoire).donnees)) {
        const domaine = ligne.url!;
        const candidats = recherche.trouveLesPlusProches(domaine, 10);
        const recalculee = construitLigneDeCaracteristiques(domaine, candidats, {
          domaine_reference_source: "", type_generation: "prediction", classe: "",
          domaine_trompeur_car_trop_proche_d_un_valide: 0,
        });
        for (let position = 1; position <= 10; position++) {
          expect(ligne[`reference_candidat_${position}`]).toBe(recalculee[`reference_candidat_${position}`]);
        }
        for (const colonne of colonnesDesCaracteristiques()) {
          expect(Number(ligne[colonne])).toBeCloseTo(Number(recalculee[colonne]), 10);
        }
        nombreVerifie++;
        if (nombreVerifie === 10) break;
      }
      expect(nombreVerifie).toBe(10);
    } finally {
      await rm(repertoire, { recursive: true, force: true });
    }
  });
});
