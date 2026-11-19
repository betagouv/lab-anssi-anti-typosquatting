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
