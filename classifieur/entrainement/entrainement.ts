import * as tf from "@tensorflow/tfjs";

import { cheminsDesResultats } from "../commun/chemins.ts";
import { litLesDomaines } from "../creation-du-dataset/domaines.ts";
import { ecritJson } from "../commun/fichiers.ts";
import { litLaProvenance } from "../creation-du-dataset/generation.ts";
import { creeLeModele, enregistreLeModele } from "./modele.ts";
import { litLaNormalisation, parcourtLesLots, type Normalisation } from "./normalisation.ts";

export interface ParametresDEntrainement {
  readonly repertoire: string;
  readonly epoques: number;
  readonly tailleDuLot: number;
}

const extraitLaPerte = async (resultat: number | tf.Scalar | Array<number | tf.Scalar>): Promise<number> => {
  const valeurs = Array.isArray(resultat) ? resultat : [resultat];
  const premiereValeur = valeurs[0];
  if (premiereValeur === undefined) throw new Error("Aucune perte renvoyée par le modèle.");
  if (typeof premiereValeur === "number") return premiereValeur;
  const donnees = await premiereValeur.data();
  valeurs.forEach((valeur) => { if (typeof valeur !== "number") valeur.dispose(); });
  return donnees[0] ?? Number.NaN;
};

const executeUneEpoque = async (
  modele: tf.LayersModel,
  fichier: string,
  normalisation: Normalisation,
  tailleDuLot: number,
  apprentissage: boolean,
): Promise<{ perte: number; nombreDeLignes: number }> => {
  let pertePonderee = 0;
  let nombreDeLignes = 0;
  for await (const lot of parcourtLesLots(fichier, normalisation, tailleDuLot)) {
    const caracteristiques = tf.tensor2d(lot.caracteristiques);
    const cibles = tf.tensor2d(lot.cibles, [lot.cibles.length, 1]);
    try {
      const resultat = apprentissage
        ? await modele.trainOnBatch(caracteristiques, cibles)
        : modele.evaluate(caracteristiques, cibles);
      const perte = await extraitLaPerte(resultat);
      if (!Number.isFinite(perte)) throw new Error("La perte du modèle n'est pas finie.");
      pertePonderee += perte * lot.caracteristiques.length;
      nombreDeLignes += lot.caracteristiques.length;
    } finally {
      caracteristiques.dispose();
      cibles.dispose();
    }
  }
  if (nombreDeLignes === 0) throw new Error(`Aucune ligne dans ${fichier}`);
  return { perte: pertePonderee / nombreDeLignes, nombreDeLignes };
};

export const entraineLeModele = async (parametres: ParametresDEntrainement): Promise<void> => {
  const { repertoire, epoques, tailleDuLot } = parametres;
  if (epoques < 1 || tailleDuLot < 1) throw new Error("Les époques et la taille du lot doivent être positives.");
  const chemins = cheminsDesResultats(repertoire);
  const provenance = await litLaProvenance(repertoire);
  const source = await litLesDomaines();
  if (source.empreinte !== provenance.empreinteSource) {
    throw new Error("La liste des domaines a changé depuis la génération du jeu de données.");
  }
  const normalisation = await litLaNormalisation(repertoire);
  const graine = Number(provenance.parametres.graine);
  if (!Number.isSafeInteger(graine)) throw new Error("La graine du modèle doit être un entier.");
  const modele = creeLeModele(normalisation.colonnes.length, graine);
  let meilleurePerte = Number.POSITIVE_INFINITY;
  let meilleureEpoque = 0;
  let epoquesSansProgres = 0;
  const historique: Array<{ epoque: number; perteEntrainement: number; perteValidation: number }> = [];
  const enregistreLeRapport = async (): Promise<void> => {
    await ecritJson(chemins.entrainementRapport, {
      empreinteSource: provenance.empreinteSource,
      graine,
      epoquesDemandees: epoques,
      tailleDuLot,
      meilleureEpoque,
      meilleurePerteValidation: meilleurePerte,
      historique,
    });
  };
  try {
    for (let epoque = 1; epoque <= epoques; epoque++) {
      const entrainement = await executeUneEpoque(modele, chemins.entrainement, normalisation, tailleDuLot, true);
      const validation = await executeUneEpoque(modele, chemins.validation, normalisation, tailleDuLot, false);
      historique.push({ epoque, perteEntrainement: entrainement.perte, perteValidation: validation.perte });
      console.log(`Époque ${epoque}/${epoques} — entraînement=${entrainement.perte.toFixed(4)}, validation=${validation.perte.toFixed(4)}`);
      if (validation.perte < meilleurePerte - 1e-5) {
        meilleurePerte = validation.perte;
        meilleureEpoque = epoque;
        epoquesSansProgres = 0;
        await enregistreLeModele(modele, chemins.modele);
        await enregistreLeRapport();
      } else {
        epoquesSansProgres++;
        if (epoquesSansProgres >= 4) {
          console.log("Arrêt anticipé : la validation ne progresse plus.");
          break;
        }
      }
    }
    if (meilleureEpoque === 0) throw new Error("L'entraînement n'a produit aucun modèle.");
    await enregistreLeRapport();
    console.log(`Modèle enregistré : ${chemins.modele}`);
  } finally {
    modele.dispose();
  }
};
