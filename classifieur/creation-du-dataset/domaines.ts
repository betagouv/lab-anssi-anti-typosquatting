import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "tldts";

import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";
import { FICHIER_DES_DOMAINES } from "../commun/chemins.ts";

export const litLesDomaines = async (): Promise<{
  domaines: string[];
  empreinte: string;
}> => {
  const contenu = await readFile(FICHIER_DES_DOMAINES, "utf8");
  const domaines = litLaListeDeDomaines(contenu);
  if (domaines.length === 0) throw new Error("La liste des domaines légitimes est vide.");
  return {
    domaines,
    empreinte: createHash("sha256").update(contenu).digest("hex"),
  };
};

export const normaliseLeDomaine = (valeur: string): string => {
  const url = new URL(valeur.includes("://") ? valeur : `https://${valeur}`);
  let domaine = url.hostname.toLowerCase().replace(/\.$/, "");
  while (domaine.startsWith("www.")) domaine = domaine.slice(4);
  if (domaine.length === 0) throw new Error(`Nom de domaine invalide : ${valeur}`);
  return domaine;
};

export const suffixePublic = (domaine: string): string =>
  parse(domaine, { allowPrivateDomains: true }).publicSuffix ?? domaine.split(".").at(-1) ?? "";

export const nomSansSuffixe = (domaine: string): string => {
  const suffixe = suffixePublic(domaine);
  const terminaison = `.${suffixe}`;
  return domaine.endsWith(terminaison) ? domaine.slice(0, -terminaison.length) : domaine;
};
