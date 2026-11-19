import { normaliseLeNomDHote } from "../src/noyau/normalisation.ts";
import type { NomDHoteCandidat } from "./sources/types.ts";

const LONGUEUR_MINIMALE_DETIQUETTE = 4;

export interface Comptes {
  lignes: number;
  injoignables: number;
  nonNormalisables: number;
  sousUnSuffixePrive: number;
  surUnePlateforme: number;
  etiquettesTropCourtes: number;
  retenus: number;
}

export const selectionneLesDomainesLegitimes = (
  candidats: readonly NomDHoteCandidat[],
  domainesExclus: ReadonlySet<string>,
): { domainesLegitimes: string[]; comptes: Comptes } => {
  const comptes: Comptes = {
    lignes: candidats.length,
    injoignables: 0,
    nonNormalisables: 0,
    sousUnSuffixePrive: 0,
    surUnePlateforme: 0,
    etiquettesTropCourtes: 0,
    retenus: 0,
  };

  const retenus = new Set<string>();

  for (const { nomDHote, joignable } of candidats) {
    if (!joignable) {
      comptes.injoignables++;
      continue;
    }

    const normalise = normaliseLeNomDHote(nomDHote);
    if (normalise === null) {
      comptes.nonNormalisables++;
      continue;
    }

    if (normalise.estSousUnSuffixePrive) {
      comptes.sousUnSuffixePrive++;
      continue;
    }

    if (domainesExclus.has(normalise.domaineEnregistrable)) {
      comptes.surUnePlateforme++;
      continue;
    }

    if (normalise.etiquette.length < LONGUEUR_MINIMALE_DETIQUETTE) {
      comptes.etiquettesTropCourtes++;
      continue;
    }

    retenus.add(normalise.domaineEnregistrable);
  }

  comptes.retenus = retenus.size;
  return { domainesLegitimes: [...retenus].sort(), comptes };
};
