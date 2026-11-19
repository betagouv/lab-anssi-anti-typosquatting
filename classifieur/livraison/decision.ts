import type { DecisionDeLivraison } from "../registre/registre.ts";

export interface CriteresDeLivraison {
  readonly plancherDeF1: number;
  readonly tolerance: number;
}

const arrondi = (valeur: number): string => valeur.toFixed(4);

export const decideLaLivraison = (
  f1DuCandidat: number,
  f1DuModeleLivre: number,
  criteres: CriteresDeLivraison,
): DecisionDeLivraison => {
  if (f1DuCandidat < criteres.plancherDeF1) {
    return {
      livre: false,
      raison: `F1 du candidat (${arrondi(f1DuCandidat)}) sous le plancher (${arrondi(criteres.plancherDeF1)})`,
    };
  }
  if (f1DuCandidat < f1DuModeleLivre - criteres.tolerance) {
    return {
      livre: false,
      raison: `F1 du candidat (${arrondi(f1DuCandidat)}) inférieur à celui du modèle livré (${arrondi(f1DuModeleLivre)}), tolérance ${arrondi(criteres.tolerance)}`,
    };
  }
  return {
    livre: true,
    raison: `F1 du candidat (${arrondi(f1DuCandidat)}) au moins égal à celui du modèle livré (${arrondi(f1DuModeleLivre)}), plancher ${arrondi(criteres.plancherDeF1)} respecté`,
  };
};
