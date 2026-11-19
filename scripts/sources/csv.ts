export const decoupeLaLigneCsv = (ligne: string, separateur: string): string[] => {
  const champs: string[] = [];
  let champ = "";
  let dansDesGuillemets = false;

  for (const caractere of ligne) {
    if (caractere === '"') dansDesGuillemets = !dansDesGuillemets;
    else if (caractere === separateur && !dansDesGuillemets) {
      champs.push(champ);
      champ = "";
    } else champ += caractere;
  }

  champs.push(champ);
  return champs;
};

export const litLaColonneCsv = (csv: string, separateur: string, nomDeLaColonne: string): string[] => {
  const [entete = "", ...lignes] = csv.split(/\r?\n/);
  const colonne = decoupeLaLigneCsv(entete, separateur).indexOf(nomDeLaColonne);
  if (colonne < 0) {
    throw new Error(`Colonne « ${nomDeLaColonne} » absente de l'en-tête : ${entete}`);
  }

  return lignes
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => (decoupeLaLigneCsv(ligne, separateur)[colonne] ?? "").trim())
    .filter((valeur) => valeur.length > 0);
};
