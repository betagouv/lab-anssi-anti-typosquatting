import { indexeLeDomaine, type DomaineIndexe } from "./score.ts";

const RATIO_MINIMAL_DE_BIGRAMMES_PARTAGES = 0.5;
const ECART_DE_LONGUEUR_MAXIMAL = 4;

export interface IndexDeRecherche {
  readonly domainesIndexes: readonly DomaineIndexe[];
  readonly positionsParBigramme: ReadonlyMap<string, readonly number[]>;
}

export const construisLIndexDeRecherche = (
  domaines: readonly string[],
): IndexDeRecherche => {
  const domainesIndexes = domaines.map(indexeLeDomaine);
  const positionsParBigramme = new Map<string, number[]>();

  domainesIndexes.forEach((domaineIndexe, position) => {
    for (const bigramme of domaineIndexe.bigrammes.keys()) {
      const positions = positionsParBigramme.get(bigramme);
      if (positions === undefined) positionsParBigramme.set(bigramme, [position]);
      else positions.push(position);
    }
  });

  return { domainesIndexes, positionsParBigramme };
};

export const chercheLesCandidats = (
  index: IndexDeRecherche,
  domaineVisite: DomaineIndexe,
): DomaineIndexe[] => {
  const bigrammesRecherches = [...domaineVisite.bigrammes.keys()];
  if (bigrammesRecherches.length === 0) return [];

  const bigrammesPartages = new Int32Array(index.domainesIndexes.length);
  const positionsTouchees: number[] = [];

  for (const bigramme of bigrammesRecherches) {
    const positions = index.positionsParBigramme.get(bigramme);
    if (positions === undefined) continue;

    for (const position of positions) {
      if (bigrammesPartages[position] === 0) positionsTouchees.push(position);
      bigrammesPartages[position]!++;
    }
  }

  const partagesAttendus = Math.ceil(
    bigrammesRecherches.length * RATIO_MINIMAL_DE_BIGRAMMES_PARTAGES,
  );

  const candidats: DomaineIndexe[] = [];

  for (const position of positionsTouchees) {
    if (bigrammesPartages[position]! < partagesAttendus) continue;

    const candidat = index.domainesIndexes[position]!;
    const ecartDeLongueur = Math.abs(
      candidat.domaine.length - domaineVisite.domaine.length,
    );
    if (ecartDeLongueur > ECART_DE_LONGUEUR_MAXIMAL) continue;

    candidats.push(candidat);
  }

  return candidats;
};
