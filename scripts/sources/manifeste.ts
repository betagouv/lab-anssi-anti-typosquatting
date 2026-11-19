import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROLES_CONNUS = ["legitime"] as const;
export const RECUPERATIONS_CONNUES = ["telechargement", "snapshot"] as const;

export interface DescriptionDeSource {
  readonly id: string;
  readonly nom: string;
  readonly url: string;
  readonly licence: string;
  readonly role: (typeof ROLES_CONNUS)[number];
  readonly recuperation: (typeof RECUPERATIONS_CONNUES)[number];
  readonly recupereLe?: string;
  readonly fichier?: string;
}

export const FICHIER_DU_MANIFESTE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "donnees",
  "sources.json",
);

const estUneChaineNonVide = (valeur: unknown): valeur is string =>
  typeof valeur === "string" && valeur.trim().length > 0;

const verifieLaSource = (source: unknown, position: number): DescriptionDeSource => {
  const lieu = `Source n°${String(position + 1)} du manifeste`;
  if (typeof source !== "object" || source === null) {
    throw new Error(`${lieu} : objet attendu.`);
  }
  const champs = source as Record<string, unknown>;
  for (const champ of ["id", "nom", "url", "licence"]) {
    if (!estUneChaineNonVide(champs[champ])) {
      throw new Error(`${lieu} : le champ « ${champ} » est obligatoire.`);
    }
  }
  if (!(ROLES_CONNUS as readonly unknown[]).includes(champs["role"])) {
    throw new Error(`${lieu} : rôle inconnu (${String(champs["role"])}).`);
  }
  if (!(RECUPERATIONS_CONNUES as readonly unknown[]).includes(champs["recuperation"])) {
    throw new Error(`${lieu} : mode de récupération inconnu (${String(champs["recuperation"])}).`);
  }
  if (!String(champs["url"]).startsWith("https://")) {
    throw new Error(`${lieu} : l'URL doit commencer par https://.`);
  }
  if (champs["recuperation"] === "snapshot") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(champs["recupereLe"]))) {
      throw new Error(`${lieu} : « recupereLe » (AAAA-MM-JJ) est obligatoire pour un snapshot.`);
    }
    if (!estUneChaineNonVide(champs["fichier"])) {
      throw new Error(`${lieu} : « fichier » est obligatoire pour un snapshot.`);
    }
  }
  return source as DescriptionDeSource;
};

export const verifieLeManifeste = (contenu: unknown): DescriptionDeSource[] => {
  if (!Array.isArray(contenu) || contenu.length === 0) {
    throw new Error("Le manifeste doit contenir au moins une source.");
  }
  const sources = contenu.map(verifieLaSource);
  const identifiants = new Set(sources.map((source) => source.id));
  if (identifiants.size !== sources.length) {
    throw new Error("Les identifiants de sources doivent être uniques.");
  }
  return sources;
};

export const litLeManifeste = (fichier = FICHIER_DU_MANIFESTE): DescriptionDeSource[] =>
  verifieLeManifeste(JSON.parse(readFileSync(fichier, "utf-8")));
