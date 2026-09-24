import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";

import { creeLeModele } from "../../../classifieur/entrainement/modele.ts";
import { litLesDomaines } from "../../../classifieur/creation-du-dataset/domaines.ts";
import { construitLigneDeCaracteristiques } from "../../../src/noyau/modele/caracteristiques.ts";
import { calculeLeScore, litLesPoids, type ModeleExporte } from "../../../src/noyau/modele/calcul.ts";
import { developpeLaNormalisation, normaliseLesCaracteristiques } from "../../../src/noyau/modele/normalisation.ts";
import { RechercheDeCandidats } from "../../../src/noyau/modele/recherche.ts";

const litLExport = async (): Promise<{ modele: ModeleExporte; poids: Float32Array }> => {
  const [metadonnees, octets] = await Promise.all([
    readFile(new URL("../../../public/modele/essai.json", import.meta.url), "utf8"),
    readFile(new URL("../../../public/modele/essai.bin", import.meta.url)),
  ]);
  return { modele: JSON.parse(metadonnees) as ModeleExporte,
    poids: litLesPoids(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength)) };
};

describe("L'inférence embarquée", () => {
  it("donne le même score que TensorFlow.js pour des domaines variés", async () => {
    const { modele: exporte, poids } = await litLExport();
    const { domaines } = await litLesDomaines();
    const recherche = new RechercheDeCandidats(domaines);
    const modeleTensorflow = creeLeModele(157, 20260917);
    const formes = [[157, 32], [32], [32, 16], [16], [16, 1], [1]];
    let decalage = 0;
    const tenseurs = formes.map((forme) => {
      const taille = forme.reduce((produit, dimension) => produit * dimension, 1);
      const tenseur = tf.tensor(poids.slice(decalage, decalage + taille), forme);
      decalage += taille;
      return tenseur;
    });
    modeleTensorflow.setWeights(tenseurs);
    tenseurs.forEach((tenseur) => tenseur.dispose());
    try {
      for (const domaine of ["imp0ts.gouv.fr", "belley.com", "nouveau-domaine.fr", "ameli-secure.xyz"]) {
        const candidats = recherche.trouveLesPlusProches(domaine, 10);
        const ligne = construitLigneDeCaracteristiques(domaine, candidats, {
          domaine_reference_source: "", type_generation: "prediction", classe: "",
          domaine_trompeur_car_trop_proche_d_un_valide: 0,
        });
        const valeurs = normaliseLesCaracteristiques(ligne, developpeLaNormalisation(exporte.normalisation));
        const entree = tf.tensor2d([valeurs]);
        const sortie = modeleTensorflow.predict(entree);
        if (Array.isArray(sortie)) throw new Error("Plusieurs sorties inattendues.");
        try {
          const attendu = (await sortie.data())[0]!;
          expect(Math.abs(calculeLeScore(valeurs, poids) - attendu)).toBeLessThan(1e-4);
        } finally {
          entree.dispose();
          sortie.dispose();
        }
      }
    } finally {
      modeleTensorflow.dispose();
    }
  });
});
