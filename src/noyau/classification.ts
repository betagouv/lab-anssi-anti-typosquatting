import { squelette } from "./confusables.ts";
import {
  chercheLesCandidats,
  sansSeparateurs,
  type IndexDeRecherche,
} from "./index-de-recherche.ts";
import { distanceDeLevenshtein } from "./levenshtein.ts";
import type { DomaineNormalise } from "./normalisation.ts";
import { indexeLeDomaine, scoreDeSuspicion } from "./score.ts";

const LONGUEUR_MINIMALE_POUR_UNE_INCLUSION = 5;
const LONGUEUR_MINIMALE_POUR_UNE_FAUTE_DE_FRAPPE = 8;
const DISTANCE_MAXIMALE_DUNE_FAUTE_DE_FRAPPE = 1;
const LONGUEUR_MAXIMALE_DUNE_SEQUENCE_DE_LABELS = 4;

const MOTS_DHAMECONNAGE: ReadonlySet<string> = new Set([
  "officiel", "officielle", "secure", "securise", "securite", "login",
  "connexion", "connection", "compte", "paiement", "payer", "verification",
  "verifier", "support", "assistance", "alerte", "urgent", "remboursement",
  "amende", "actualisation", "authentification", "identification", "portail",
]);

const SUFFIXES_INSTITUTIONNELS: ReadonlySet<string> = new Set([
  "gouv.fr", "gouv.nc", "gouv.pf", "asso.fr",
]);

const SUFFIXES_DE_CONFIANCE: ReadonlySet<string> = new Set([
  "fr", "gouv.fr", "gouv.nc", "gouv.pf", "asso.fr", "cci.fr", "paris",
  "bzh", "corsica", "alsace", "re", "yt", "gp", "mq", "gf", "pm", "wf",
  "nc", "pf",
]);

const SUFFIXES_A_RISQUE: ReadonlySet<string> = new Set([
  "xyz", "top", "online", "icu", "click", "link", "buzz", "monster",
  "quest", "rest", "tk", "ml", "ga", "cf", "gq", "work", "fit", "sbs", "cfd",
]);

const MOTS_GENERIQUES: ReadonlySet<string> = new Set([
  "mairie", "ville", "commune", "communaute", "agglo", "agglomeration",
  "departement", "region", "prefecture", "conseil", "syndicat", "office",
  "centre", "maison", "service", "services", "site", "www", "asso",
  "association", "intercom", "cdc", "ccas",
]);

export type Severite = "blocage" | "avertissement";

export type ClasseDeMutation =
  | "sous-domaine-trompeur"
  | "homoglyphe"
  | "permutation-de-tld"
  | "combosquat"
  | "separateur"
  | "distance-d-edition";

export interface Verdict {
  readonly severite: Severite;
  readonly classe: ClasseDeMutation;
  readonly domaineImite: string;
  readonly scoreDeSuspicion: number;
}

interface Reconnaissance {
  readonly domaineImite: string;
  readonly severite: Severite;
}

const bloque = (domaineImite: string | null): Reconnaissance | null =>
  domaineImite === null ? null : { domaineImite, severite: "blocage" };

const avertit = (domaineImite: string | null): Reconnaissance | null =>
  domaineImite === null ? null : { domaineImite, severite: "avertissement" };

const premierDomaineLegitime = (
  table: ReadonlyMap<string, readonly string[]>,
  cle: string,
  saufLeDomaine: string,
): string | null => {
  const domaines = table.get(cle);
  if (domaines === undefined) return null;
  return domaines.find((domaine) => domaine !== saufLeDomaine) ?? null;
};

const sequencesDeLabels = (nomDHote: string): string[] => {
  const labels = nomDHote.split(".");
  const sequences: string[] = [];

  for (let debut = 0; debut < labels.length; debut++) {
    for (
      let longueur = 2;
      longueur <= LONGUEUR_MAXIMALE_DUNE_SEQUENCE_DE_LABELS &&
      debut + longueur <= labels.length;
      longueur++
    ) {
      sequences.push(labels.slice(debut, debut + longueur).join("."));
    }
  }

  return sequences;
};

const sousDomaineTrompeur = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null =>
  bloque(
    sequencesDeLabels(visite.nomDHote).find(
      (sequence) =>
        sequence !== visite.domaineEnregistrable && index.domaines.has(sequence),
    ) ?? null,
  );

const squeletteDuNomDHote = (nomDHote: string): string =>
  nomDHote.split(".").map(squelette).join(".");

const homoglyphe = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null => {
  const nomDHoteRamene = squeletteDuNomDHote(visite.nomDHote);
  if (nomDHoteRamene !== visite.nomDHote && index.domaines.has(nomDHoteRamene)) {
    return bloque(nomDHoteRamene);
  }

  const etiquetteRamenee = squelette(visite.etiquette);
  if (etiquetteRamenee === visite.etiquette) return null;

  const candidats = index.parSquelette.get(etiquetteRamenee) ?? [];
  const imite = candidats.find(
    (domaine) =>
      domaine !== visite.domaineEnregistrable &&
      !domaine.startsWith(`${visite.etiquette}.`),
  );

  return bloque(imite ?? null);
};

const suffixeAbsorbeDansLEtiquette = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): string | null => {
  const tokens = visite.etiquette.split("-");
  if (tokens.length < 2) return null;

  const etiquetteSansDernierToken = tokens.slice(0, -1).join("-");
  const suffixeSuppose = tokens.at(-1)!;

  const candidats = index.parEtiquette.get(etiquetteSansDernierToken);
  return (
    candidats?.find(
      (domaine) => domaine === `${etiquetteSansDernierToken}.${suffixeSuppose}`,
    ) ?? null
  );
};

const suffixeDe = (domaine: string): string =>
  domaine.slice(domaine.indexOf(".") + 1);

const permutationDeTld = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null => {
  const imite =
    premierDomaineLegitime(
      index.parEtiquette,
      visite.etiquette,
      visite.domaineEnregistrable,
    ) ?? suffixeAbsorbeDansLEtiquette(index, visite);

  if (imite === null) return null;

  const usurpeUneInstitution =
    SUFFIXES_INSTITUTIONNELS.has(suffixeDe(imite)) &&
    !SUFFIXES_DE_CONFIANCE.has(visite.suffixe);

  return usurpeUneInstitution || SUFFIXES_A_RISQUE.has(visite.suffixe)
    ? bloque(imite)
    : avertit(imite);
};

const combosquat = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null => {
  const tokens = visite.etiquette.split("-");
  const contientUnMotDHameconnage = tokens.some((token) =>
    MOTS_DHAMECONNAGE.has(token),
  );
  if (!contientUnMotDHameconnage) return null;

  const inclusions: string[] = [];
  for (let debut = 0; debut < tokens.length; debut++) {
    for (let fin = debut + 1; fin <= tokens.length; fin++) {
      const inclusion = tokens.slice(debut, fin).join("-");
      if (inclusion === visite.etiquette) continue;
      if (inclusion.length < LONGUEUR_MINIMALE_POUR_UNE_INCLUSION) continue;
      if (MOTS_DHAMECONNAGE.has(inclusion)) continue;
      if (MOTS_GENERIQUES.has(inclusion)) continue;
      inclusions.push(inclusion);
    }
  }

  inclusions.sort((gauche, droite) => droite.length - gauche.length);

  for (const inclusion of inclusions) {
    const imite = premierDomaineLegitime(
      index.parEtiquette,
      inclusion,
      visite.domaineEnregistrable,
    );
    if (imite === null) continue;

    const usurpeUneInstitution =
      SUFFIXES_INSTITUTIONNELS.has(suffixeDe(imite)) &&
      !SUFFIXES_DE_CONFIANCE.has(visite.suffixe);

    return usurpeUneInstitution || SUFFIXES_A_RISQUE.has(visite.suffixe)
      ? bloque(imite)
      : avertit(imite);
  }

  return null;
};

const separateur = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null =>
  avertit(
    premierDomaineLegitime(
      index.parEtiquetteSansSeparateurs,
      sansSeparateurs(visite.etiquette),
      visite.domaineEnregistrable,
    ),
  );

const fauteDeFrappe = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Reconnaissance | null => {
  if (visite.etiquette.length < LONGUEUR_MINIMALE_POUR_UNE_FAUTE_DE_FRAPPE) {
    return null;
  }

  const indexe = indexeLeDomaine(visite.domaineEnregistrable);
  let meilleur: { domaine: string; distance: number } | null = null;

  for (const candidat of chercheLesCandidats(index, indexe)) {
    if (candidat.domaine === visite.domaineEnregistrable) continue;

    const distance = distanceDeLevenshtein(
      visite.domaineEnregistrable,
      candidat.domaine,
      DISTANCE_MAXIMALE_DUNE_FAUTE_DE_FRAPPE,
    );
    if (distance > DISTANCE_MAXIMALE_DUNE_FAUTE_DE_FRAPPE) continue;

    if (meilleur === null || distance < meilleur.distance) {
      meilleur = { domaine: candidat.domaine, distance };
    }
  }

  return avertit(meilleur?.domaine ?? null);
};

const CLASSES: readonly {
  classe: ClasseDeMutation;
  reconnait: (
    index: IndexDeRecherche,
    visite: DomaineNormalise,
  ) => Reconnaissance | null;
}[] = [
  { classe: "sous-domaine-trompeur", reconnait: sousDomaineTrompeur },
  { classe: "homoglyphe", reconnait: homoglyphe },
  { classe: "permutation-de-tld", reconnait: permutationDeTld },
  { classe: "combosquat", reconnait: combosquat },
  { classe: "separateur", reconnait: separateur },
  { classe: "distance-d-edition", reconnait: fauteDeFrappe },
];

export const classifie = (
  index: IndexDeRecherche,
  visite: DomaineNormalise,
): Verdict | null => {
  if (index.domaines.has(visite.domaineEnregistrable)) return null;

  for (const { classe, reconnait } of CLASSES) {
    const reconnaissance = reconnait(index, visite);
    if (reconnaissance === null) continue;

    const { domaineImite, severite } = reconnaissance;

    return {
      severite,
      classe,
      domaineImite,
      scoreDeSuspicion: scoreDeSuspicion(
        indexeLeDomaine(visite.domaineEnregistrable),
        indexeLeDomaine(domaineImite),
      ),
    };
  }

  return null;
};
