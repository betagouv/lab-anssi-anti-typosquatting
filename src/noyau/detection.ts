import { classifie, type Verdict } from "./classification.ts";
import type { IndexDeRecherche } from "./index-de-recherche.ts";
import { normaliseLUrl, type DomaineNormalise } from "./normalisation.ts";
import { estTresEloigneDeLaListe } from "./proximite.ts";

export type { Severite, ClasseDeMutation, Verdict } from "./classification.ts";

const normaliseSiAnalysable = (
  domainesExclus: ReadonlySet<string>,
  url: string,
): DomaineNormalise | null => {
  const normalise = normaliseLUrl(url);
  if (normalise === null) return null;
  if (normalise.estSousUnSuffixePrive) return null;
  if (domainesExclus.has(normalise.domaineEnregistrable)) return null;
  return normalise;
};

export const analyseLUrl = (
  index: IndexDeRecherche,
  domainesExclus: ReadonlySet<string>,
  url: string,
): Verdict | null => {
  const normalise = normaliseSiAnalysable(domainesExclus, url);
  if (normalise === null) return null;

  return classifie(index, normalise);
};

export const estNonVerifiable = (
  index: IndexDeRecherche,
  domainesExclus: ReadonlySet<string>,
  url: string,
): boolean => {
  const normalise = normaliseSiAnalysable(domainesExclus, url);
  if (normalise === null) return false;
  if (classifie(index, normalise) !== null) return false;

  return estTresEloigneDeLaListe(index, normalise.domaineEnregistrable);
};
