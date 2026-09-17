const AU_DELA_DE_LA_BORNE = (distanceMaximale: number): number =>
  distanceMaximale + 1;

export const distanceDeLevenshtein = (
  gauche: string,
  droite: string,
  distanceMaximale: number = Number.POSITIVE_INFINITY,
): number => {
  if (gauche === droite) return 0;
  if (gauche.length === 0) return droite.length;
  if (droite.length === 0) return gauche.length;

  const ecartDeLongueur = Math.abs(gauche.length - droite.length);
  if (ecartDeLongueur > distanceMaximale) {
    return AU_DELA_DE_LA_BORNE(distanceMaximale);
  }

  let lignePrecedente = Array.from({ length: droite.length + 1 }, (_, j) => j);
  let ligneCourante = new Array<number>(droite.length + 1).fill(0);

  for (let i = 1; i <= gauche.length; i++) {
    ligneCourante[0] = i;
    let minimumDeLaLigne = i;
    const caractereGauche = gauche[i - 1];

    for (let j = 1; j <= droite.length; j++) {
      const caracteresIdentiques = caractereGauche === droite[j - 1];
      const suppression = lignePrecedente[j]! + 1;
      const insertion = ligneCourante[j - 1]! + 1;
      const substitution =
        lignePrecedente[j - 1]! + (caracteresIdentiques ? 0 : 1);

      const distance = Math.min(suppression, insertion, substitution);
      ligneCourante[j] = distance;
      if (distance < minimumDeLaLigne) minimumDeLaLigne = distance;
    }

    if (minimumDeLaLigne > distanceMaximale) {
      return AU_DELA_DE_LA_BORNE(distanceMaximale);
    }

    [lignePrecedente, ligneCourante] = [ligneCourante, lignePrecedente];
  }

  return lignePrecedente[droite.length]!;
};

export const similariteDEdition = (gauche: string, droite: string): number => {
  const longueurLaPlusGrande = Math.max(gauche.length, droite.length);
  if (longueurLaPlusGrande === 0) return 1;
  return 1 - distanceDeLevenshtein(gauche, droite) / longueurLaPlusGrande;
};
