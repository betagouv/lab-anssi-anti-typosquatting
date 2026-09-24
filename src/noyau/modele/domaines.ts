import { parse } from "tldts";

import { normaliseLeNomDHote } from "../normalisation.ts";

export const normaliseLeDomaine = (valeur: string): string => {
  const url = new URL(valeur.includes("://") ? valeur : `https://${valeur}`);
  const normalise = normaliseLeNomDHote(url.hostname);
  if (normalise === null) throw new Error(`Nom de domaine invalide : ${valeur}`);
  return normalise.domaineEnregistrable;
};

export const suffixePublic = (domaine: string): string =>
  parse(domaine, { allowPrivateDomains: true }).publicSuffix ?? domaine.split(".").at(-1) ?? "";

export const nomSansSuffixe = (domaine: string): string => {
  const suffixe = suffixePublic(domaine);
  const terminaison = `.${suffixe}`;
  return domaine.endsWith(terminaison) ? domaine.slice(0, -terminaison.length) : domaine;
};
