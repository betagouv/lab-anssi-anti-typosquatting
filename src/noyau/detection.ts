import {
  chercheLesCandidats,
  type IndexDeRecherche,
} from "./index-de-recherche.ts";
import { indexeLeDomaine, scoreDeSuspicion } from "./score.ts";

const SEUIL_DE_SUSPICION = 0.85;

export interface ImitationSuspectee {
  readonly domaineImite: string;
  readonly scoreDeSuspicion: number;
}

export const chercheUneImitation = (
  index: IndexDeRecherche,
  domaineVisite: string,
): ImitationSuspectee | null => {
  const visite = indexeLeDomaine(domaineVisite);
  let meilleureImitation: ImitationSuspectee | null = null;

  for (const candidat of chercheLesCandidats(index, visite)) {
    if (candidat.domaine === domaineVisite) continue;

    const score = scoreDeSuspicion(visite, candidat);
    if (score <= SEUIL_DE_SUSPICION) continue;

    const estMeilleure =
      meilleureImitation === null ||
      score > meilleureImitation.scoreDeSuspicion;

    if (estMeilleure) {
      meilleureImitation = {
        domaineImite: candidat.domaine,
        scoreDeSuspicion: score,
      };
    }
  }

  return meilleureImitation;
};
