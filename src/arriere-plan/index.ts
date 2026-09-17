import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import { litLaListeDeDomaines } from "../noyau/liste-de-domaines.ts";
import { normaliseLUrl } from "../noyau/normalisation.ts";
import {
  indexeLeDomaine,
  scoreDeSuspicion,
  type DomaineIndexe,
} from "../noyau/score.ts";

const SEUIL_DE_SUSPICION = 0.85;
const ID_DU_CADRE_PRINCIPAL = 0;

interface ImitationSuspectee {
  readonly domaineImite: string;
  readonly scoreDeSuspicion: number;
}

const domainesExclus = new Set(litLaListeDeDomaines(domainesExclusBruts));
const domainesLegitimes = litLaListeDeDomaines(domainesLegitimesBruts);

let indexDesDomainesLegitimes: DomaineIndexe[] | null = null;

const domainesLegitimesIndexes = (): DomaineIndexe[] => {
  indexDesDomainesLegitimes ??= domainesLegitimes.map(indexeLeDomaine);
  return indexDesDomainesLegitimes;
};

const chercheUneImitation = (
  domaineVisite: string,
): ImitationSuspectee | null => {
  const visite = indexeLeDomaine(domaineVisite);

  for (const candidat of domainesLegitimesIndexes()) {
    const score = scoreDeSuspicion(visite, candidat);
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
