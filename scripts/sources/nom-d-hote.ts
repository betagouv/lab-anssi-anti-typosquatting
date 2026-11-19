export const nomDHoteOuValeurBrute = (valeur: string): string => {
  try {
    return new URL(valeur).hostname;
  } catch {
    return valeur;
  }
};
