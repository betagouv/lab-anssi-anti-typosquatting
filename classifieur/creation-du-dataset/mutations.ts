import { choisit, creeGenerateurAleatoire } from "./aleatoire.ts";
import { suffixePublic } from "./domaines.ts";

export interface Variante {
  readonly domaine: string;
  readonly type: string;
}

interface Parties {
  readonly prefixe: string;
  readonly suffixe: string;
}

const CORRESPONDANCES_LEET = new Map([
  ["a", "4"], ["e", "3"], ["g", "9"], ["i", "1"],
  ["l", "1"], ["o", "0"], ["s", "5"], ["t", "7"],
]);

const partiesModifiables = (domaine: string): Parties => {
  const suffixe = suffixePublic(domaine);
  return { prefixe: domaine.slice(0, Math.max(0, domaine.length - suffixe.length - 1)), suffixe };
};

const positionsModifiables = (texte: string): number[] =>
  [...texte].flatMap((caractere, position) => (/^[a-z0-9]$/i.test(caractere) ? [position] : []));

const assemble = ({ prefixe, suffixe }: Parties): string => `${prefixe}.${suffixe}`;

const substitutionLeet = (domaine: string, aleatoire: () => number): Variante | null => {
  const parties = partiesModifiables(domaine);
  const positions = positionsModifiables(parties.prefixe)
    .filter((position) => CORRESPONDANCES_LEET.has(parties.prefixe[position] ?? ""));
  if (positions.length === 0) return null;
  const position = choisit(positions, aleatoire);
  const remplacement = CORRESPONDANCES_LEET.get(parties.prefixe[position] ?? "")!;
  const prefixe = `${parties.prefixe.slice(0, position)}${remplacement}${parties.prefixe.slice(position + 1)}`;
  return { domaine: assemble({ ...parties, prefixe }), type: "substitution_leet" };
};

const suppressionCaractere = (domaine: string, aleatoire: () => number): Variante | null => {
  const parties = partiesModifiables(domaine);
  const positions = positionsModifiables(parties.prefixe)
    .filter((position) => parties.prefixe.split(".").some((etiquette) => etiquette.length > 3) && position < parties.prefixe.length);
  if (positions.length === 0) return null;
  const position = choisit(positions, aleatoire);
  const prefixe = `${parties.prefixe.slice(0, position)}${parties.prefixe.slice(position + 1)}`;
  return { domaine: assemble({ ...parties, prefixe }), type: "suppression_caractere" };
};

const insertionCaractere = (domaine: string, aleatoire: () => number): Variante | null => {
  const parties = partiesModifiables(domaine);
  const positions = positionsModifiables(parties.prefixe);
  if (positions.length === 0) return null;
  const position = choisit(positions, aleatoire);
  const caractere = parties.prefixe[position];
  const prefixe = `${parties.prefixe.slice(0, position)}${caractere}${parties.prefixe.slice(position)}`;
  return { domaine: assemble({ ...parties, prefixe }), type: "insertion_caractere" };
};

const transpositionAdjacente = (domaine: string, aleatoire: () => number): Variante | null => {
  const parties = partiesModifiables(domaine);
  const positions = [...parties.prefixe].flatMap((caractere, position) =>
    /^[a-z0-9]$/i.test(caractere) &&
    /^[a-z0-9]$/i.test(parties.prefixe[position + 1] ?? "") &&
    caractere !== parties.prefixe[position + 1] ? [position] : [],
  );
  if (positions.length === 0) return null;
  const position = choisit(positions, aleatoire);
  const prefixe = `${parties.prefixe.slice(0, position)}${parties.prefixe[position + 1]}${parties.prefixe[position]}${parties.prefixe.slice(position + 2)}`;
  return { domaine: assemble({ ...parties, prefixe }), type: "transposition_adjacente" };
};

const changementTiret = (domaine: string, aleatoire: () => number): Variante | null => {
  const parties = partiesModifiables(domaine);
  const tirets = [...parties.prefixe].flatMap((caractere, position) => caractere === "-" ? [position] : []);
  if (tirets.length > 0) {
    const position = choisit(tirets, aleatoire);
    const prefixe = `${parties.prefixe.slice(0, position)}${parties.prefixe.slice(position + 1)}`;
    return { domaine: assemble({ ...parties, prefixe }), type: "suppression_tiret" };
  }
  const positions = [...parties.prefixe].flatMap((caractere, position) =>
    /^[a-z0-9]$/i.test(caractere) && /^[a-z0-9]$/i.test(parties.prefixe[position + 1] ?? "") ? [position + 1] : [],
  );
  if (positions.length === 0) return null;
  const position = choisit(positions, aleatoire);
  const prefixe = `${parties.prefixe.slice(0, position)}-${parties.prefixe.slice(position)}`;
  return { domaine: assemble({ ...parties, prefixe }), type: "insertion_tiret" };
};

const MUTATIONS = [substitutionLeet, suppressionCaractere, insertionCaractere, transpositionAdjacente, changementTiret];

export const genereVariantesTrompeuses = (domaine: string, nombre: number, graine: string): Variante[] => {
  const variantes: Variante[] = [];
  const dejaVus = new Set([domaine]);
  for (let essai = 0; variantes.length < nombre && essai < nombre * 12; essai++) {
    const aleatoire = creeGenerateurAleatoire(`${graine}:fraude:${essai}`);
    const mutation = MUTATIONS[essai % MUTATIONS.length]!(domaine, aleatoire);
    if (mutation !== null && !dejaVus.has(mutation.domaine)) {
      variantes.push(mutation);
      dejaVus.add(mutation.domaine);
    }
  }
  return variantes;
};

export const genereNomDistant = (domaine: string, essai: number, graine: string): string => {
  const aleatoire = creeGenerateurAleatoire(`${graine}:distant:${essai}`);
  const alphabet = "bcdfghjklmnpqrstvwxz";
  const etiquette = Array.from({ length: 12 }, () => choisit([...alphabet], aleatoire)).join("");
  return `z-${etiquette}-${Math.floor(aleatoire() * 1_000_000)}.${suffixePublic(domaine)}`;
};

export const genereNomIntermediaire = (domaine: string, essai: number, graine: string): string | null => {
  const aleatoire = creeGenerateurAleatoire(`${graine}:intermediaire:${essai}`);
  const parties = partiesModifiables(domaine);
  const caracteres = [...parties.prefixe];
  const positions = positionsModifiables(parties.prefixe);
  if (positions.length < 3) return null;
  const nombreDeChangements = Math.min(positions.length, Math.max(3, Math.ceil(positions.length * 0.32)));
  const disponibles = [...positions];
  const alphabet = "bcdfghjklmnpqrstvwxz";
  for (let changement = 0; changement < nombreDeChangements; changement++) {
    const positionAleatoire = Math.floor(aleatoire() * disponibles.length);
    const position = disponibles.splice(positionAleatoire, 1)[0]!;
    const possibilites = [...alphabet].filter((caractere) => caractere !== caracteres[position]);
    caracteres[position] = choisit(possibilites, aleatoire);
  }
  return assemble({ ...parties, prefixe: caracteres.join("") });
};
