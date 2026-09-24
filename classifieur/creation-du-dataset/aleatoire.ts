export const hache32 = (texte: string): number => {
  let hachage = 0x811c9dc5;
  for (const caractere of texte) {
    hachage ^= caractere.codePointAt(0) ?? 0;
    hachage = Math.imul(hachage, 0x01000193);
  }
  return hachage >>> 0;
};

export const creeGenerateurAleatoire = (graine: string): (() => number) => {
  let etat = hache32(graine);
  return () => {
    etat |= 0;
    etat = (etat + 0x6d2b79f5) | 0;
    let valeur = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), 61 | valeur);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export const choisit = <T>(valeurs: readonly T[], aleatoire: () => number): T => {
  const valeur = valeurs[Math.floor(aleatoire() * valeurs.length)];
  if (valeur === undefined) throw new Error("Aucune valeur à choisir.");
  return valeur;
};
