import { readFile } from "node:fs/promises";

import {
  litLesPoids,
  preditLeScore,
  verifieLeModeleExporte,
  type ModeleExporte,
} from "../../src/noyau/modele/calcul.ts";
import {
  cheminsDesResultats,
  FICHIER_DES_METADONNEES_DU_MODELE_LIVRE,
  FICHIER_DES_POIDS_DU_MODELE_LIVRE,
} from "../commun/chemins.ts";
import { parcourtLeCsv } from "../commun/fichiers.ts";
import {
  calculeLesMesuresParSeuil,
  choisitLesMeilleuresMesures,
  type Mesures,
  type Prediction,
} from "../evaluation/evaluation.ts";

const COLONNE_DE_LA_CIBLE = "domaine_trompeur_car_trop_proche_d_un_valide";

export interface ModeleLivreCharge {
  readonly modele: ModeleExporte;
  readonly poids: Float32Array;
}

export const chargeLeModeleLivre = async (
  fichierDesMetadonnees = FICHIER_DES_METADONNEES_DU_MODELE_LIVRE,
  fichierDesPoids = FICHIER_DES_POIDS_DU_MODELE_LIVRE,
): Promise<ModeleLivreCharge> => {
  const [metadonnees, octets] = await Promise.all([
    readFile(fichierDesMetadonnees, "utf8"),
    readFile(fichierDesPoids),
  ]);
  const modele = JSON.parse(metadonnees) as ModeleExporte;
  verifieLeModeleExporte(modele, octets.byteLength);
  const poids = litLesPoids(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
  return { modele, poids };
};

export const evalueLeModeleLivre = async (
  repertoire: string,
  modeleLivre?: ModeleLivreCharge,
): Promise<Mesures> => {
  const { modele, poids } = modeleLivre ?? (await chargeLeModeleLivre());
  const predictions: Prediction[] = [];
  for await (const ligne of parcourtLeCsv(cheminsDesResultats(repertoire).test)) {
    predictions.push({
      score: preditLeScore(ligne, modele, poids),
      cible: Number(ligne[COLONNE_DE_LA_CIBLE]),
    });
  }
  if (predictions.length === 0) throw new Error("Le jeu de test est vide.");
  return choisitLesMeilleuresMesures(calculeLesMesuresParSeuil(predictions));
};
