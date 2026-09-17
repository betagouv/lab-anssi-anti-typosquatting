const TAILLE_DES_BIGRAMMES = 2;

export type VecteurDeBigrammes = ReadonlyMap<string, number>;

export const vecteurDeBigrammes = (texte: string): VecteurDeBigrammes => {
  const occurrences = new Map<string, number>();
  for (let i = 0; i <= texte.length - TAILLE_DES_BIGRAMMES; i++) {
    const bigramme = texte.slice(i, i + TAILLE_DES_BIGRAMMES);
    occurrences.set(bigramme, (occurrences.get(bigramme) ?? 0) + 1);
  }
  return occurrences;
};

const produitScalaire = (
  gauche: VecteurDeBigrammes,
  droite: VecteurDeBigrammes,
): number => {
  let total = 0;
  for (const [bigramme, occurrences] of gauche) {
    total += occurrences * (droite.get(bigramme) ?? 0);
  }
  return total;
};

const norme = (vecteur: VecteurDeBigrammes): number =>
  Math.sqrt(
    [...vecteur.values()].reduce(
      (total, occurrences) => total + occurrences ** 2,
      0,
    ),
  );

export const similariteCosinus = (
  gauche: VecteurDeBigrammes,
  droite: VecteurDeBigrammes,
): number => {
  const produitDesNormes = norme(gauche) * norme(droite);
  if (produitDesNormes === 0) return 0;
  return produitScalaire(gauche, droite) / produitDesNormes;
};
