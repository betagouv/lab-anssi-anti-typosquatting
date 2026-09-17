const estUneLigneUtile = (ligne: string): boolean =>
  ligne.length > 0 && !ligne.startsWith("#");

export const litLaListeDeDomaines = (contenu: string): string[] =>
  contenu
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(estUneLigneUtile);
