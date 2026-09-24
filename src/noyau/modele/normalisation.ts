import { colonnesDesCaracteristiques } from "./caracteristiques.ts";

export interface Normalisation {
  readonly colonnes: string[];
  readonly moyennes: Record<string, number>;
  readonly echelles: Record<string, number>;
  readonly constantes: Record<string, boolean>;
  readonly nombreDeLignes: number;
}

export interface NormalisationCompacte {
  readonly colonnes: string[];
  readonly moyennes: number[];
  readonly echelles: number[];
  readonly constantes: boolean[];
  readonly nombreDeLignes: number;
}

export const compacteLaNormalisation = (normalisation: Normalisation): NormalisationCompacte => {
  verifieLaNormalisation(normalisation);
  return {
    colonnes: normalisation.colonnes,
    moyennes: normalisation.colonnes.map((colonne) => normalisation.moyennes[colonne]!),
    echelles: normalisation.colonnes.map((colonne) => normalisation.echelles[colonne]!),
    constantes: normalisation.colonnes.map((colonne) => normalisation.constantes[colonne]!),
    nombreDeLignes: normalisation.nombreDeLignes,
  };
};

export const developpeLaNormalisation = (compacte: NormalisationCompacte): Normalisation => {
  const colonnes = colonnesDesCaracteristiques();
  if (JSON.stringify(compacte.colonnes) !== JSON.stringify(colonnes) ||
    compacte.moyennes.length !== colonnes.length ||
    compacte.echelles.length !== colonnes.length ||
    compacte.constantes.length !== colonnes.length) {
    throw new Error("Normalisation exportée incompatible.");
  }
  const normalisation: Normalisation = {
    colonnes: compacte.colonnes,
    moyennes: Object.fromEntries(colonnes.map((colonne, position) => [colonne, compacte.moyennes[position]!])),
    echelles: Object.fromEntries(colonnes.map((colonne, position) => [colonne, compacte.echelles[position]!])),
    constantes: Object.fromEntries(colonnes.map((colonne, position) => [colonne, compacte.constantes[position]!])),
    nombreDeLignes: compacte.nombreDeLignes,
  };
  verifieLaNormalisation(normalisation);
  return normalisation;
};

export const verifieLaNormalisation = (normalisation: Normalisation): void => {
  const colonnes = colonnesDesCaracteristiques();
  if (JSON.stringify(normalisation.colonnes) !== JSON.stringify(colonnes)) {
    throw new Error("L'ordre des caractéristiques du modèle a changé.");
  }
  for (const colonne of colonnes) {
    if (!Number.isFinite(normalisation.moyennes[colonne]) ||
      !Number.isFinite(normalisation.echelles[colonne]) ||
      normalisation.echelles[colonne]! <= 0 ||
      typeof normalisation.constantes[colonne] !== "boolean") {
      throw new Error(`Normalisation invalide : ${colonne}`);
    }
  }
};

export const normaliseLesCaracteristiques = (
  ligne: Record<string, string | number>,
  normalisation: Normalisation,
): number[] => normalisation.colonnes.map((colonne) => {
  const valeur = Number(ligne[colonne]);
  const normalisee = normalisation.constantes[colonne] ? 0 :
    (valeur - normalisation.moyennes[colonne]!) / normalisation.echelles[colonne]!;
  if (!Number.isFinite(normalisee)) throw new Error(`Caractéristique invalide : ${colonne}`);
  return normalisee;
});
