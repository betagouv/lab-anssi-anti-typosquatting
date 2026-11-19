import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { RACINE_DU_DEPOT, cheminsDesResultats } from "../commun/chemins.ts";
import { executeLaChaine, type ParametresDeLaChaine } from "../chaine/chaine.ts";
import type { ParametresDeGeneration } from "../creation-du-dataset/generation.ts";
import { exporteLeModele } from "../exportation/exporter-modele.ts";
import { ajouteAuRegistre, construitLEntree, type DecisionDeLivraison } from "../registre/registre.ts";
import { decideLaLivraison, type CriteresDeLivraison } from "./decision.ts";
import { chargeLeModeleLivre, evalueLeModeleLivre } from "./modele-livre.ts";

export const REPERTOIRE_DU_REENTRAINEMENT = join(RACINE_DU_DEPOT, "classifieur", "resultats-reentrainement");

export const EPOQUES_DU_REENTRAINEMENT = 12;
export const TAILLE_DU_LOT_DU_REENTRAINEMENT = 512;
export const PLANCHER_DE_F1_PAR_DEFAUT = 0.95;
export const TOLERANCE_PAR_DEFAUT = 0;

export type ParametresDeGenerationSansRepertoire = Omit<ParametresDeGeneration, "repertoire">;

export interface ParametresDeReentrainement extends ParametresDeLaChaine {
  readonly criteres: CriteresDeLivraison;
}

export interface ResultatDuReentrainement {
  readonly decision: DecisionDeLivraison;
  readonly f1DuCandidat: number;
  readonly f1DuModeleLivre: number;
}

const litUnNombre = (valeur: string | number | undefined, nom: string): number => {
  const nombre = Number(valeur);
  if (valeur === undefined || !Number.isFinite(nombre)) {
    throw new Error(`Le modèle livré ne déclare pas de paramètre « ${nom} » valide.`);
  }
  return nombre;
};

export const litLesParametresDuModeleLivre = async (): Promise<ParametresDeGenerationSansRepertoire> => {
  const { modele } = await chargeLeModeleLivre();
  const { parametres } = modele;
  return {
    graine: String(litUnNombre(parametres["graine"], "graine")),
    limite: litUnNombre(parametres["limite"], "limite"),
    imitationsParDomaine: litUnNombre(parametres["imitationsParDomaine"], "imitationsParDomaine"),
    intermediairesParDomaine: litUnNombre(parametres["intermediairesParDomaine"], "intermediairesParDomaine"),
    distantsParDomaine: litUnNombre(parametres["distantsParDomaine"], "distantsParDomaine"),
    scoreMinimumImitation: litUnNombre(parametres["scoreMinimumImitation"], "scoreMinimumImitation"),
    scoreMinimumIntermediaire: litUnNombre(parametres["scoreMinimumIntermediaire"], "scoreMinimumIntermediaire"),
    scoreMaximumIntermediaire: litUnNombre(parametres["scoreMaximumIntermediaire"], "scoreMaximumIntermediaire"),
  };
};

const litLeF1DuCandidat = async (repertoire: string): Promise<number> => {
  const evaluation = JSON.parse(await readFile(cheminsDesResultats(repertoire).evaluation, "utf8")) as {
    readonly meilleurScoreF1: number;
  };
  return evaluation.meilleurScoreF1;
};

export const reentraineEtLivre = async (parametres: ParametresDeReentrainement): Promise<ResultatDuReentrainement> => {
  const { repertoire } = parametres.generation;
  const modeleLivre = await chargeLeModeleLivre();

  await executeLaChaine(parametres);

  const f1DuCandidat = await litLeF1DuCandidat(repertoire);
  const f1DuModeleLivre = (await evalueLeModeleLivre(repertoire, modeleLivre)).scoreF1;
  const decision = decideLaLivraison(f1DuCandidat, f1DuModeleLivre, parametres.criteres);

  if (decision.livre) await exporteLeModele(repertoire);
  await ajouteAuRegistre(await construitLEntree({ repertoire, decision, maintenant: new Date() }));

  console.log(`Candidat : F1 ${f1DuCandidat.toFixed(4)} ; modèle livré : F1 ${f1DuModeleLivre.toFixed(4)}`);
  console.log(`${decision.livre ? "Nouveau modèle livré" : "Modèle livré conservé"} : ${decision.raison}`);
  return { decision, f1DuCandidat, f1DuModeleLivre };
};
