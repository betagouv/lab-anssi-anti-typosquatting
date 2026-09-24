import { construitLigneDeCaracteristiques } from "./caracteristiques.ts";
import { preditLeScore, type ModeleExporte } from "./calcul.ts";
import { RechercheDeCandidats } from "./recherche.ts";

export type PredictionDuModele =
  | { readonly decision: "valide"; readonly score: null; readonly seuil: number;
      readonly domaineProche: string; readonly correspondanceExacte: true }
  | { readonly decision: "suspect" | "valide"; readonly score: number; readonly seuil: number;
      readonly domaineProche: string | null; readonly correspondanceExacte: false };

export const preditAvecLeModele = (
  domaine: string,
  domainesLegitimes: ReadonlySet<string>,
  recherche: RechercheDeCandidats,
  modele: ModeleExporte,
  poids: Float32Array,
): PredictionDuModele => {
  if (domainesLegitimes.has(domaine)) {
    return { decision: "valide", score: null, seuil: modele.seuil,
      domaineProche: domaine, correspondanceExacte: true };
  }
  const candidats = recherche.trouveLesPlusProches(domaine, 10);
  const ligne = construitLigneDeCaracteristiques(domaine, candidats, {
    domaine_reference_source: "",
    type_generation: "prediction",
    classe: "",
    domaine_trompeur_car_trop_proche_d_un_valide: 0,
  });
  const score = preditLeScore(ligne, modele, poids);
  return {
    decision: score >= modele.seuil ? "suspect" : "valide",
    score,
    seuil: modele.seuil,
    domaineProche: candidats[0]?.reference.domaine ?? null,
    correspondanceExacte: false,
  };
};
