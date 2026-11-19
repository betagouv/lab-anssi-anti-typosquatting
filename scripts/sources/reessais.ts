export interface OptionsDeReessais {
  readonly tentatives: number;
  readonly delaiEntreTentativesEnMs: number;
  readonly auraEchec?: (erreur: unknown, tentative: number) => void;
}

const attend = (dureeEnMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, dureeEnMs));

export const executeAvecReessais = async <Resultat>(
  operation: () => Promise<Resultat>,
  options: OptionsDeReessais,
): Promise<Resultat> => {
  for (let tentative = 1; ; tentative++) {
    try {
      return await operation();
    } catch (erreur) {
      if (tentative >= options.tentatives) throw erreur;
      options.auraEchec?.(erreur, tentative);
      await attend(options.delaiEntreTentativesEnMs * tentative);
    }
  }
};
