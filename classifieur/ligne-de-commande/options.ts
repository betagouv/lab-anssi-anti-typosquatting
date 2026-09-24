import { fileURLToPath } from "node:url";

const REPERTOIRE_PAR_DEFAUT = fileURLToPath(new URL("../resultats/", import.meta.url));

export const litOption = (nom: string, valeurParDefaut: string): string => {
  const prefixe = `--${nom}=`;
  const argument = process.argv.slice(2).find((valeur) => valeur.startsWith(prefixe));
  return argument === undefined ? valeurParDefaut : argument.slice(prefixe.length);
};

export const litEntier = (nom: string, valeurParDefaut: number): number => {
  const texte = litOption(nom, String(valeurParDefaut));
  const valeur = Number(texte);
  if (!Number.isSafeInteger(valeur) || valeur < 0) {
    throw new Error(`L'option --${nom} doit être un entier positif ou nul.`);
  }
  return valeur;
};

export const litNombre = (nom: string, valeurParDefaut: number): number => {
  const valeur = Number(litOption(nom, String(valeurParDefaut)));
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new Error(`L'option --${nom} doit être un nombre positif ou nul.`);
  }
  return valeur;
};

export const litRepertoire = (): string => {
  const repertoire = litOption("repertoire", REPERTOIRE_PAR_DEFAUT);
  if (repertoire.trim().length === 0) throw new Error("L'option --repertoire ne peut pas être vide.");
  return repertoire;
};
