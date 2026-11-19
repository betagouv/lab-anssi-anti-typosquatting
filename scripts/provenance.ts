export interface SelectionDeSource {
  readonly idDeLaSource: string;
  readonly domaines: readonly string[];
}

export type SourcesParDomaine = ReadonlyMap<string, readonly string[]>;

const ENTETE_DE_LA_PROVENANCE = "domaine;sources";
const SEPARATEUR_DE_SOURCES = "|";

export const fusionneLesSelections = (
  selections: readonly SelectionDeSource[],
): SourcesParDomaine => {
  const sourcesParDomaine = new Map<string, string[]>();
  for (const { idDeLaSource, domaines } of selections) {
    for (const domaine of domaines) {
      const sources = sourcesParDomaine.get(domaine) ?? [];
      if (!sources.includes(idDeLaSource)) sources.push(idDeLaSource);
      sourcesParDomaine.set(domaine, sources);
    }
  }
  return sourcesParDomaine;
};

export const formateLaProvenance = (sourcesParDomaine: SourcesParDomaine): string => {
  const lignes = [...sourcesParDomaine.keys()]
    .sort()
    .map((domaine) => `${domaine};${(sourcesParDomaine.get(domaine) ?? []).join(SEPARATEUR_DE_SOURCES)}`);
  return `${[ENTETE_DE_LA_PROVENANCE, ...lignes].join("\n")}\n`;
};

export const litLaProvenance = (contenu: string): Map<string, string[]> => {
  const [entete, ...lignes] = contenu.split(/\r?\n/).filter((ligne) => ligne.length > 0);
  if (entete !== ENTETE_DE_LA_PROVENANCE) {
    throw new Error(`En-tête de provenance inattendu : ${entete ?? "fichier vide"}`);
  }
  return new Map(
    lignes.map((ligne) => {
      const [domaine, sources] = ligne.split(";");
      if (domaine === undefined || sources === undefined || sources.length === 0) {
        throw new Error(`Ligne de provenance mal formée : ${ligne}`);
      }
      return [domaine, sources.split(SEPARATEUR_DE_SOURCES)];
    }),
  );
};
