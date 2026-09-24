import { developpeLaNormalisation, normaliseLesCaracteristiques, type NormalisationCompacte } from "./normalisation.ts";

export const DIMENSIONS_DU_MODELE = [157, 32, 16, 1] as const;
export const NOMBRE_DE_POIDS = 5601;

export interface ModeleExporte {
  readonly version: 1;
  readonly empreinteSource: string;
  readonly empreinteModele: string;
  readonly empreintePoids: string;
  readonly parametres: Record<string, string | number>;
  readonly dimensions: readonly number[];
  readonly seuil: number;
  readonly normalisation: NormalisationCompacte;
}

export const verifieLeModeleExporte = (modele: ModeleExporte, nombreDOctets: number): void => {
  if (modele.version !== 1 ||
    JSON.stringify(modele.dimensions) !== JSON.stringify(DIMENSIONS_DU_MODELE) ||
    nombreDOctets !== NOMBRE_DE_POIDS * 4 ||
    !Number.isFinite(modele.seuil) || modele.seuil < 0 || modele.seuil > 1) {
    throw new Error("Export du modèle incompatible.");
  }
};

export const litLesPoids = (octets: ArrayBuffer): Float32Array => {
  if (octets.byteLength !== NOMBRE_DE_POIDS * 4) throw new Error("Taille des poids invalide.");
  const vue = new DataView(octets);
  const poids = Float32Array.from({ length: NOMBRE_DE_POIDS }, (_, position) => vue.getFloat32(position * 4, true));
  if (poids.some((valeur) => !Number.isFinite(valeur))) throw new Error("Poids du modèle invalides.");
  return poids;
};

export const calculeLeScore = (valeurs: readonly number[], poids: Float32Array): number => {
  if (valeurs.length !== DIMENSIONS_DU_MODELE[0] || poids.length !== NOMBRE_DE_POIDS) {
    throw new Error("Dimensions du modèle incompatibles avec les caractéristiques.");
  }
  let entree: readonly number[] = valeurs;
  let decalage = 0;
  for (let couche = 0; couche < DIMENSIONS_DU_MODELE.length - 1; couche++) {
    const nombreDEntrees = DIMENSIONS_DU_MODELE[couche]!;
    const nombreDeSorties = DIMENSIONS_DU_MODELE[couche + 1]!;
    const sortie: number[] = [];
    const decalageDesBiais = decalage + nombreDEntrees * nombreDeSorties;
    for (let neurone = 0; neurone < nombreDeSorties; neurone++) {
      let somme = poids[decalageDesBiais + neurone]!;
      for (let position = 0; position < nombreDEntrees; position++) {
        somme += entree[position]! * poids[decalage + position * nombreDeSorties + neurone]!;
      }
      sortie.push(couche === DIMENSIONS_DU_MODELE.length - 2
        ? 1 / (1 + Math.exp(-somme))
        : Math.max(0, somme));
    }
    entree = sortie;
    decalage = decalageDesBiais + nombreDeSorties;
  }
  const score = entree[0];
  if (score === undefined || !Number.isFinite(score)) throw new Error("Score du modèle invalide.");
  return score;
};

export const preditLeScore = (
  ligne: Record<string, string | number>,
  modele: ModeleExporte,
  poids: Float32Array,
): number => calculeLeScore(normaliseLesCaracteristiques(ligne, developpeLaNormalisation(modele.normalisation)), poids);
