import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import { litLaListeDeDomaines } from "../noyau/liste-de-domaines.ts";
import { normaliseLUrl } from "../noyau/normalisation.ts";

const SEUIL_DE_SUSPICION = 0.85;
const ID_DU_CADRE_PRINCIPAL = 0;
const TAILLE_DES_BIGRAMMES = 2;

type VecteurDeBigrammes = ReadonlyMap<string, number>;

interface DomaineIndexe {
  readonly domaine: string;
  readonly bigrammes: VecteurDeBigrammes;
}

interface ImitationSuspectee {
  readonly domaineImite: string;
  readonly scoreDeSuspicion: number;
}

const domainesExclus = new Set(litLaListeDeDomaines(domainesExclusBruts));
const domainesLegitimes = litLaListeDeDomaines(domainesLegitimesBruts);

const distanceDeLevenshtein = (gauche: string, droite: string): number => {
  const distances = Array.from({ length: gauche.length + 1 }, () =>
    new Array<number>(droite.length + 1).fill(0),
  );

  for (let i = 0; i <= gauche.length; i++) distances[i]![0] = i;
  for (let j = 0; j <= droite.length; j++) distances[0]![j] = j;

  for (let i = 1; i <= gauche.length; i++) {
    for (let j = 1; j <= droite.length; j++) {
      const caracteresIdentiques = gauche[i - 1] === droite[j - 1];
      const suppression = distances[i - 1]![j]!;
      const insertion = distances[i]![j - 1]!;
      const substitution = distances[i - 1]![j - 1]!;

      distances[i]![j] = caracteresIdentiques
        ? substitution
        : Math.min(suppression, insertion, substitution) + 1;
    }
  }

  return distances[gauche.length]![droite.length]!;
};

const similariteDEdition = (gauche: string, droite: string): number => {
  const longueurLaPlusGrande = Math.max(gauche.length, droite.length);
  return 1 - distanceDeLevenshtein(gauche, droite) / longueurLaPlusGrande;
};

const vecteurDeBigrammes = (domaine: string): VecteurDeBigrammes => {
  const occurrences = new Map<string, number>();
  for (let i = 0; i <= domaine.length - TAILLE_DES_BIGRAMMES; i++) {
    const bigramme = domaine.slice(i, i + TAILLE_DES_BIGRAMMES);
    occurrences.set(bigramme, (occurrences.get(bigramme) ?? 0) + 1);
  }
  return occurrences;
};

const produitScalaire = (
  gauche: VecteurDeBigrammes,
  droite: VecteurDeBigrammes,
): number => {
  let total = 0;
  for (const [bigramme, occurrences] of gauche) {
    total += occurrences * (droite.get(bigramme) ?? 0);
  }
  return total;
};

const norme = (vecteur: VecteurDeBigrammes): number =>
  Math.sqrt(
    [...vecteur.values()].reduce(
      (total, occurrences) => total + occurrences ** 2,
      0,
    ),
  );

const similariteCosinus = (
  gauche: VecteurDeBigrammes,
  droite: VecteurDeBigrammes,
): number => produitScalaire(gauche, droite) / (norme(gauche) * norme(droite));

const scoreDeSuspicion = (
  domaineVisite: string,
  bigrammesDuDomaineVisite: VecteurDeBigrammes,
  candidat: DomaineIndexe,
): number =>
  (similariteCosinus(bigrammesDuDomaineVisite, candidat.bigrammes) +
    similariteDEdition(domaineVisite, candidat.domaine)) /
  2;

let indexDesDomainesLegitimes: DomaineIndexe[] | null = null;

const domainesLegitimesIndexes = (): DomaineIndexe[] => {
  indexDesDomainesLegitimes ??= domainesLegitimes.map((domaine) => ({
    domaine,
    bigrammes: vecteurDeBigrammes(domaine),
  }));
  return indexDesDomainesLegitimes;
};

const chercheUneImitation = (
  domaineVisite: string,
): ImitationSuspectee | null => {
  const bigrammesDuDomaineVisite = vecteurDeBigrammes(domaineVisite);

  for (const candidat of domainesLegitimesIndexes()) {
    const score = scoreDeSuspicion(
      domaineVisite,
      bigrammesDuDomaineVisite,
      candidat,
    );
    const estUneImitation =
      score > SEUIL_DE_SUSPICION && domaineVisite !== candidat.domaine;

    if (estUneImitation) {
      return { domaineImite: candidat.domaine, scoreDeSuspicion: score };
    }
  }

  return null;
};

const domaineAAnalyser = (url: string): string | null => {
  const normalise = normaliseLUrl(url);
  if (normalise === null) return null;
  if (normalise.estSousUnSuffixePrive) return null;
  if (domainesExclus.has(normalise.domaineEnregistrable)) return null;
  return normalise.domaineEnregistrable;
};

const urlDeLaPageDAlerte = (
  domaineVisite: string,
  imitation: ImitationSuspectee,
): string => {
  const parametres = new URLSearchParams({
    domaineVisite,
    domaineImite: imitation.domaineImite,
    score: (imitation.scoreDeSuspicion * 100).toFixed(1),
  });
  return browser.runtime.getURL(`src/alerte/index.html?${parametres.toString()}`);
};

const redirigeVersLaPageDAlerte = (idDeLOnglet: number, url: string): void => {
  void browser.tabs.update(idDeLOnglet, { url }).catch((erreur: unknown) => {
    console.error("Redirection vers la page d'alerte impossible", erreur);
  });
};

browser.webNavigation.onBeforeNavigate.addListener((navigation) => {
  const estUneNavigationPrincipale = navigation.frameId === ID_DU_CADRE_PRINCIPAL;
  if (!estUneNavigationPrincipale) return;

  const domaineVisite = domaineAAnalyser(navigation.url);
  if (domaineVisite === null) return;

  const imitation = chercheUneImitation(domaineVisite);
  if (imitation === null) return;

  redirigeVersLaPageDAlerte(
    navigation.tabId,
    urlDeLaPageDAlerte(domaineVisite, imitation),
  );
});
