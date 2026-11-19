import { genereLesDonnees, type ParametresDeGeneration } from "../creation-du-dataset/generation.ts";
import { repartitLesDonnees } from "../creation-du-dataset/repartition.ts";
import { entraineLeModele } from "../entrainement/entrainement.ts";
import { calculeLaNormalisation } from "../entrainement/normalisation.ts";
import { evalueLeModele } from "../evaluation/evaluation.ts";

export interface ParametresDeLaChaine {
  readonly generation: ParametresDeGeneration;
  readonly epoques: number;
  readonly tailleDuLot: number;
}

export const executeLaChaine = async (parametres: ParametresDeLaChaine): Promise<void> => {
  const { generation, epoques, tailleDuLot } = parametres;
  await genereLesDonnees(generation);
  await repartitLesDonnees(generation.repertoire);
  await calculeLaNormalisation(generation.repertoire);
  await entraineLeModele({ repertoire: generation.repertoire, epoques, tailleDuLot });
  await evalueLeModele(generation.repertoire);
};
