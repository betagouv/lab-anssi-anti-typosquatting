import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import {
  chercheUneImitation,
  type ImitationSuspectee,
} from "../noyau/detection.ts";
import {
  construisLIndexDeRecherche,
  type IndexDeRecherche,
} from "../noyau/index-de-recherche.ts";
import { litLaListeDeDomaines } from "../noyau/liste-de-domaines.ts";
import { normaliseLUrl } from "../noyau/normalisation.ts";

const ID_DU_CADRE_PRINCIPAL = 0;

const domainesExclus = new Set(litLaListeDeDomaines(domainesExclusBruts));

let indexDeRecherche: IndexDeRecherche | null = null;

const indexDesDomainesLegitimes = (): IndexDeRecherche => {
  indexDeRecherche ??= construisLIndexDeRecherche(
    litLaListeDeDomaines(domainesLegitimesBruts),
  );
  return indexDeRecherche;
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

  const imitation = chercheUneImitation(
    indexDesDomainesLegitimes(),
    domaineVisite,
  );
  if (imitation === null) return;

  redirigeVersLaPageDAlerte(
    navigation.tabId,
    urlDeLaPageDAlerte(domaineVisite, imitation),
  );
});
