import {
  similariteCosinus,
  vecteurDeBigrammes,
  type VecteurDeBigrammes,
} from "./bigrammes.ts";
import { similariteDEdition } from "./levenshtein.ts";

export interface DomaineIndexe {
  readonly domaine: string;
  readonly bigrammes: VecteurDeBigrammes;
}

export const indexeLeDomaine = (domaine: string): DomaineIndexe => ({
  domaine,
  bigrammes: vecteurDeBigrammes(domaine),
});

export const scoreDeSuspicion = (
  domaineVisite: DomaineIndexe,
  domaineLegitime: DomaineIndexe,
): number =>
  (similariteCosinus(domaineVisite.bigrammes, domaineLegitime.bigrammes) +
    similariteDEdition(domaineVisite.domaine, domaineLegitime.domaine)) /
  2;
