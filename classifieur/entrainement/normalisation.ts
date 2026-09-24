import { readFile } from "node:fs/promises";

import { colonnesDesCaracteristiques } from "../../src/noyau/modele/caracteristiques.ts";
import { normaliseLesCaracteristiques, type Normalisation } from "../../src/noyau/modele/normalisation.ts";
import { cheminsDesResultats } from "../commun/chemins.ts";
import { ecritJson, parcourtLeCsv } from "../commun/fichiers.ts";

export { normaliseLesCaracteristiques };
export type { Normalisation };

export const calculeLaNormalisation = async (repertoire: string): Promise<Normalisation> => {
  const chemins = cheminsDesResultats(repertoire);
  const colonnes = colonnesDesCaracteristiques();
  const sommes = Object.fromEntries(colonnes.map((colonne) => [colonne, 0])) as Record<string, number>;
  const sommesDesCarres = Object.fromEntries(colonnes.map((colonne) => [colonne, 0])) as Record<string, number>;
  let nombreDeLignes = 0;
  for await (const ligne of parcourtLeCsv(chemins.entrainement)) {
    nombreDeLignes++;
    for (const colonne of colonnes) {
      const valeur = Number(ligne[colonne]);
      if (!Number.isFinite(valeur)) throw new Error(`Caractéristique invalide : ${colonne}`);
      sommes[colonne] = (sommes[colonne] ?? 0) + valeur;
      sommesDesCarres[colonne] = (sommesDesCarres[colonne] ?? 0) + valeur ** 2;
    }
  }
  if (nombreDeLignes === 0) throw new Error("Le jeu d'entraînement est vide.");
  const moyennes: Record<string, number> = {};
  const echelles: Record<string, number> = {};
  const constantes: Record<string, boolean> = {};
  for (const colonne of colonnes) {
    moyennes[colonne] = (sommes[colonne] ?? 0) / nombreDeLignes;
    const variance = Math.max(0, (sommesDesCarres[colonne] ?? 0) / nombreDeLignes - moyennes[colonne] ** 2);
    constantes[colonne] = variance < 1e-12;
    echelles[colonne] = constantes[colonne] ? 1 : Math.sqrt(variance);
  }
  const normalisation = { colonnes, moyennes, echelles, constantes, nombreDeLignes };
  await ecritJson(chemins.normalisation, normalisation);
  console.log(`Normalisation calculée sur ${nombreDeLignes} lignes.`);
  return normalisation;
};

export const litLaNormalisation = async (repertoire: string): Promise<Normalisation> =>
  JSON.parse(await readFile(cheminsDesResultats(repertoire).normalisation, "utf8")) as Normalisation;

export interface Lot {
  readonly caracteristiques: number[][];
  readonly cibles: number[];
}

export async function* parcourtLesLots(
  fichier: string,
  normalisation: Normalisation,
  tailleDuLot: number,
): AsyncGenerator<Lot> {
  if (tailleDuLot < 1) throw new Error("La taille du lot doit être positive.");
  let caracteristiques: number[][] = [];
  let cibles: number[] = [];
  for await (const ligne of parcourtLeCsv(fichier)) {
    caracteristiques.push(normaliseLesCaracteristiques(ligne, normalisation));
    const cible = Number(ligne.domaine_trompeur_car_trop_proche_d_un_valide);
    if (cible !== 0 && cible !== 1) throw new Error("Cible invalide dans le jeu de données.");
    cibles.push(cible);
    if (caracteristiques.length === tailleDuLot) {
      yield { caracteristiques, cibles };
      caracteristiques = [];
      cibles = [];
    }
  }
  if (caracteristiques.length > 0) yield { caracteristiques, cibles };
}
