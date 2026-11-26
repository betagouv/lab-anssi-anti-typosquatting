import { chercheLesCandidats, type IndexDeRecherche } from "./index-de-recherche.ts";
import { indexeLeDomaine, scoreDeSuspicion } from "./score.ts";

export const SEUIL_DE_PROXIMITE = 0.75;

export const scoreDeProximiteMaximal = (
  index: IndexDeRecherche,
  domaine: string,
): number => {
  const visite = indexeLeDomaine(domaine);

  return chercheLesCandidats(index, visite)
    .filter((candidat) => candidat.domaine !== domaine)
    .reduce(
      (meilleurScore, candidat) =>
        Math.max(meilleurScore, scoreDeSuspicion(visite, candidat)),
      0,
    );
};

export const estTresEloigneDeLaListe = (
  index: IndexDeRecherche,
  domaine: string,
): boolean =>
  !index.domaines.has(domaine) &&
  scoreDeProximiteMaximal(index, domaine) < SEUIL_DE_PROXIMITE;
