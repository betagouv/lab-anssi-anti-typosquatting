import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cheminsDesResultats } from "../../../classifieur/commun/chemins.ts";
import { creeRedacteurCsv } from "../../../classifieur/commun/fichiers.ts";
import { chargeLeModeleLivre, evalueLeModeleLivre } from "../../../classifieur/livraison/modele-livre.ts";
import {
  colonnesDesCaracteristiques,
  colonnesDesMetadonnees,
  construitLigneDeCaracteristiques,
} from "../../../src/noyau/modele/caracteristiques.ts";
import { RechercheDeCandidats } from "../../../src/noyau/modele/recherche.ts";

const domainesDeReference = ["impots.gouv.fr", "ameli.fr", "service-public.fr", "belley.fr", "education.gouv.fr"];
const exemples: readonly (readonly [string, number])[] = [
  ["imp0ts.gouv.fr", 1],
  ["amelli.fr", 1],
  ["service-publlc.fr", 1],
  ["boulangerie-du-coin.fr", 0],
  ["club-de-judo.com", 0],
  ["photographe-mariage.net", 0],
];

let dossier: string;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), "modele-livre-"));
  const recherche = new RechercheDeCandidats(domainesDeReference);
  const redacteur = await creeRedacteurCsv(cheminsDesResultats(dossier).test, [
    ...colonnesDesMetadonnees(),
    ...colonnesDesCaracteristiques(),
  ]);
  for (const [domaine, cible] of exemples) {
    await redacteur.ecritLigne(construitLigneDeCaracteristiques(domaine, recherche.trouveLesPlusProches(domaine, 10), {
      domaine_reference_source: "x",
      type_generation: "test",
      classe: String(cible),
      domaine_trompeur_car_trop_proche_d_un_valide: cible,
    }));
  }
  await redacteur.ferme();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

describe("Le modèle livré", () => {
  it("se charge depuis les fichiers embarqués dans l'extension", async () => {
    const { modele, poids } = await chargeLeModeleLivre();
    expect(modele.dimensions).toEqual([157, 32, 16, 1]);
    expect(poids.length).toBe(5601);
  });

  it("est évalué sur le jeu de test d'un autre entraînement avec les mêmes mesures", async () => {
    const mesures = await evalueLeModeleLivre(dossier);
    const total = mesures.vraisPositifs + mesures.fauxPositifs + mesures.fauxNegatifs + mesures.vraisNegatifs;
    expect(total).toBe(exemples.length);
    expect(mesures.scoreF1).toBeGreaterThanOrEqual(0);
    expect(mesures.scoreF1).toBeLessThanOrEqual(1);
  });

  it("refuse d'être évalué sur un jeu de test vide", async () => {
    const redacteur = await creeRedacteurCsv(cheminsDesResultats(dossier).test, colonnesDesMetadonnees());
    await redacteur.ferme();
    await expect(evalueLeModeleLivre(dossier)).rejects.toThrow("vide");
  });
});
