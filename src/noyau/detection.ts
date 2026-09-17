import { classifie, type Verdict } from "./classification.ts";
import type { IndexDeRecherche } from "./index-de-recherche.ts";
import { normaliseLUrl } from "./normalisation.ts";

export type { Severite, ClasseDeMutation, Verdict } from "./classification.ts";

export const analyseLUrl = (
  index: IndexDeRecherche,
  domainesExclus: ReadonlySet<string>,
  url: string,
): Verdict | null => {
  const normalise = normaliseLUrl(url);
  if (normalise === null) return null;
  if (normalise.estSousUnSuffixePrive) return null;
  if (domainesExclus.has(normalise.domaineEnregistrable)) return null;

  return classifie(index, normalise);
};
