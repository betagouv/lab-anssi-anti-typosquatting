import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { dirname } from "node:path";
import readline from "node:readline";

export type LigneCsv = Record<string, string | number>;

export const assureLeRepertoire = async (fichier: string): Promise<void> => {
  await mkdir(dirname(fichier), { recursive: true });
};

export const ecritJson = async (fichier: string, valeur: unknown): Promise<void> => {
  await assureLeRepertoire(fichier);
  await writeFile(fichier, `${JSON.stringify(valeur, null, 2)}\n`);
};

const echappeCsv = (valeur: string | number | undefined): string => {
  const texte = valeur === undefined ? "" : String(valeur);
  return /[",\n\r]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
};

export const decoupeLigneCsv = (ligne: string): string[] => {
  const valeurs: string[] = [];
  let valeur = "";
  let entreGuillemets = false;
  for (let position = 0; position < ligne.length; position++) {
    const caractere = ligne[position];
    if (caractere === '"') {
      if (entreGuillemets && ligne[position + 1] === '"') {
        valeur += '"';
        position++;
      } else entreGuillemets = !entreGuillemets;
    } else if (caractere === "," && !entreGuillemets) {
      valeurs.push(valeur);
      valeur = "";
    } else valeur += caractere;
  }
  valeurs.push(valeur);
  return valeurs;
};

export const creeRedacteurCsv = async (fichier: string, colonnes: readonly string[]) => {
  await assureLeRepertoire(fichier);
  const flux = createWriteStream(fichier, { encoding: "utf8" });
  const ecrit = async (ligne: string): Promise<void> => {
    if (!flux.write(ligne)) await once(flux, "drain");
  };
  await ecrit(`${colonnes.map(echappeCsv).join(",")}\n`);
  return {
    async ecritLigne(ligne: LigneCsv): Promise<void> {
      await ecrit(`${colonnes.map((colonne) => echappeCsv(ligne[colonne])).join(",")}\n`);
    },
    async ferme(): Promise<void> {
      const fermeture = once(flux, "close");
      flux.end();
      await fermeture;
    },
  };
};

export async function* parcourtLeCsv(fichier: string): AsyncGenerator<Record<string, string>> {
  const flux = createReadStream(fichier, { encoding: "utf8" });
  const lignes = readline.createInterface({ input: flux, crlfDelay: Infinity });
  let colonnes: string[] | null = null;
  try {
    for await (const ligne of lignes) {
      if (ligne.length === 0) continue;
      if (colonnes === null) {
        colonnes = decoupeLigneCsv(ligne);
        continue;
      }
      const valeurs = decoupeLigneCsv(ligne);
      yield Object.fromEntries(colonnes.map((colonne, position) => [colonne, valeurs[position] ?? ""]));
    }
  } finally {
    lignes.close();
    flux.destroy();
  }
  if (colonnes === null) throw new Error(`Jeu de données vide : ${fichier}`);
}

export const litEnteteCsv = async (fichier: string): Promise<string[]> => {
  const flux = createReadStream(fichier, { encoding: "utf8" });
  const lignes = readline.createInterface({ input: flux, crlfDelay: Infinity });
  try {
    for await (const ligne of lignes) return decoupeLigneCsv(ligne);
    throw new Error(`Jeu de données vide : ${fichier}`);
  } finally {
    lignes.close();
    flux.destroy();
  }
};
