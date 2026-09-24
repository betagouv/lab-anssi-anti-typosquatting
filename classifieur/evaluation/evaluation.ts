import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as tf from "@tensorflow/tfjs";

import { cheminsDesResultats } from "../commun/chemins.ts";
import { ecritJson } from "../commun/fichiers.ts";
import { litLaProvenance } from "../creation-du-dataset/generation.ts";
import { chargeLeModele } from "../entrainement/modele.ts";
import { litLaNormalisation, parcourtLesLots } from "../entrainement/normalisation.ts";

interface Prediction {
  readonly score: number;
  readonly cible: number;
}

interface Mesures {
  readonly seuil: number;
  readonly vraisPositifs: number;
  readonly fauxPositifs: number;
  readonly fauxNegatifs: number;
  readonly vraisNegatifs: number;
  readonly precision: number;
  readonly rappel: number;
  readonly scoreF1: number;
}

export const mesuresAuSeuil = (predictions: readonly Prediction[], seuil: number): Mesures => {
  let vraisPositifs = 0;
  let fauxPositifs = 0;
  let fauxNegatifs = 0;
  let vraisNegatifs = 0;
  for (const prediction of predictions) {
    const positif = prediction.score >= seuil;
    if (positif && prediction.cible === 1) vraisPositifs++;
    if (positif && prediction.cible === 0) fauxPositifs++;
    if (!positif && prediction.cible === 1) fauxNegatifs++;
    if (!positif && prediction.cible === 0) vraisNegatifs++;
  }
  const precision = vraisPositifs / Math.max(vraisPositifs + fauxPositifs, 1);
  const rappel = vraisPositifs / Math.max(vraisPositifs + fauxNegatifs, 1);
  const scoreF1 = (2 * precision * rappel) / Math.max(precision + rappel, 1e-12);
  return { seuil, vraisPositifs, fauxPositifs, fauxNegatifs, vraisNegatifs, precision, rappel, scoreF1 };
};

export const evalueLeModele = async (repertoire: string): Promise<void> => {
  const chemins = cheminsDesResultats(repertoire);
  const provenance = await litLaProvenance(repertoire);
  const empreinteModele = createHash("sha256").update(await readFile(chemins.modele)).digest("hex");
  const normalisation = await litLaNormalisation(repertoire);
  const modele = await chargeLeModele(chemins.modele);
  const predictions: Prediction[] = [];
  try {
    for await (const lot of parcourtLesLots(chemins.test, normalisation, 512)) {
      const caracteristiques = tf.tensor2d(lot.caracteristiques);
      const resultat = modele.predict(caracteristiques);
      if (Array.isArray(resultat)) throw new Error("Le modèle a plusieurs sorties inattendues.");
      try {
        const scores = await resultat.data();
        scores.forEach((score, position) => {
          const cible = lot.cibles[position];
          if (cible === undefined) throw new Error("Une prédiction ne correspond à aucune cible.");
          predictions.push({ score, cible });
        });
      } finally {
        caracteristiques.dispose();
        resultat.dispose();
      }
    }
  } finally {
    modele.dispose();
  }
  if (predictions.length === 0) throw new Error("Le jeu de test est vide.");
  const mesuresParSeuil = Array.from({ length: 91 }, (_, position) =>
    mesuresAuSeuil(predictions, (position + 5) / 100));
  const meilleuresMesures = mesuresParSeuil.reduce((meilleures, mesures) =>
    mesures.scoreF1 > meilleures.scoreF1 ? mesures : meilleures);
  await ecritJson(chemins.evaluation, {
    empreinteSource: provenance.empreinteSource,
    empreinteModele,
    nombreDeLignesEvaluees: predictions.length,
    seuilRecommande: meilleuresMesures.seuil,
    meilleurScoreF1: meilleuresMesures.scoreF1,
    meilleuresMesures,
    mesuresParSeuil,
  });
  console.log(`Évaluation terminée : seuil=${meilleuresMesures.seuil.toFixed(2)}, F1=${meilleuresMesures.scoreF1.toFixed(4)}`);
};
