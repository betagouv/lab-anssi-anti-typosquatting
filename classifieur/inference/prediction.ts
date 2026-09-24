import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as tf from "@tensorflow/tfjs";

import { cheminsDesResultats } from "../commun/chemins.ts";
import { construitLigneDeCaracteristiques } from "../../src/noyau/modele/caracteristiques.ts";
import { normaliseLeDomaine } from "../../src/noyau/modele/domaines.ts";
import { RechercheDeCandidats } from "../../src/noyau/modele/recherche.ts";
import { litLesDomaines } from "../creation-du-dataset/domaines.ts";
import { litLaProvenance } from "../creation-du-dataset/generation.ts";
import { chargeLeModele } from "../entrainement/modele.ts";
import { litLaNormalisation, normaliseLesCaracteristiques } from "../entrainement/normalisation.ts";

interface EvaluationEnregistree {
  readonly seuilRecommande: number;
  readonly empreinteModele: string;
}

export interface Verdict {
  readonly decision: "valide" | "suspect";
  readonly domaine: string;
  readonly probabilite: number;
  readonly seuil: number;
  readonly raison: "correspondance_exacte" | "proximite_trompeuse" | "proximite_insuffisante";
  readonly candidatsProches: readonly { domaine: string; scoreSuspicion: number }[];
}

export const preditLeDomaine = async (valeur: string, repertoire: string): Promise<Verdict> => {
  const chemins = cheminsDesResultats(repertoire);
  const domaine = normaliseLeDomaine(valeur);
  const [{ domaines, empreinte }, provenance, normalisation, evaluation, poidsEnregistres] = await Promise.all([
    litLesDomaines(),
    litLaProvenance(repertoire),
    litLaNormalisation(repertoire),
    readFile(chemins.evaluation, "utf8").then((contenu) => JSON.parse(contenu) as EvaluationEnregistree),
    readFile(chemins.modele),
  ]);
  if (empreinte !== provenance.empreinteSource) {
    throw new Error("La liste des domaines a changé depuis l'entraînement du modèle.");
  }
  const empreinteModele = createHash("sha256").update(poidsEnregistres).digest("hex");
  if (empreinteModele !== evaluation.empreinteModele) {
    throw new Error("Le modèle a changé depuis son évaluation ; relancer classifieur:evaluer.");
  }
  const seuil = evaluation.seuilRecommande;
  if (!Number.isFinite(seuil) || seuil < 0 || seuil > 1) {
    throw new Error("Le seuil du rapport d'évaluation est invalide.");
  }
  if (new Set(domaines).has(domaine)) {
    return { decision: "valide", domaine, probabilite: 0, seuil, raison: "correspondance_exacte", candidatsProches: [] };
  }
  const recherche = new RechercheDeCandidats(domaines);
  const candidats = recherche.trouveLesPlusProches(domaine, 10);
  const ligne = construitLigneDeCaracteristiques(domaine, candidats, {
    domaine_reference_source: "",
    type_generation: "prediction",
    classe: "",
    domaine_trompeur_car_trop_proche_d_un_valide: 0,
  });
  const valeurs = normaliseLesCaracteristiques(ligne, normalisation);
  const modele = await chargeLeModele(chemins.modele);
  const entree = tf.tensor2d([valeurs]);
  try {
    const sortie = modele.predict(entree);
    if (Array.isArray(sortie)) throw new Error("Le modèle a plusieurs sorties inattendues.");
    try {
      const probabilite = (await sortie.data())[0];
      if (probabilite === undefined || !Number.isFinite(probabilite)) {
        throw new Error("La prédiction du modèle est invalide.");
      }
      const suspect = probabilite >= seuil;
      return {
        decision: suspect ? "suspect" : "valide",
        domaine,
        probabilite,
        seuil,
        raison: suspect ? "proximite_trompeuse" : "proximite_insuffisante",
        candidatsProches: candidats.map(({ reference, comparaison }) => ({
          domaine: reference.domaine,
          scoreSuspicion: comparaison.scoreSuspicion,
        })),
      };
    } finally {
      sortie.dispose();
    }
  } finally {
    entree.dispose();
    modele.dispose();
  }
};
