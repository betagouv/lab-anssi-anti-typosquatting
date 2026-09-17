import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import { analyseLUrl, type Verdict } from "../noyau/detection.ts";
import {
  construisLIndexDeRecherche,
  type IndexDeRecherche,
} from "../noyau/index-de-recherche.ts";
import { litLaListeDeDomaines } from "../noyau/liste-de-domaines.ts";

const ID_DU_CADRE_PRINCIPAL = 0;
const COULEUR_DU_BADGE = "#B34000";

const domainesExclus = new Set(litLaListeDeDomaines(domainesExclusBruts));

let indexDeRecherche: IndexDeRecherche | null = null;

const indexDesDomainesLegitimes = (): IndexDeRecherche => {
  indexDeRecherche ??= construisLIndexDeRecherche(
    litLaListeDeDomaines(domainesLegitimesBruts),
  );
  return indexDeRecherche;
};

const urlDeLaPageDAlerte = (verdict: Verdict, domaineVisite: string): string => {
  const parametres = new URLSearchParams({
    domaineVisite,
    domaineImite: verdict.domaineImite,
    classe: verdict.classe,
    score: (verdict.scoreDeSuspicion * 100).toFixed(1),
  });
  return browser.runtime.getURL(`src/alerte/index.html?${parametres.toString()}`);
};

const bloqueLaNavigation = (
  idDeLOnglet: number,
  verdict: Verdict,
  domaineVisite: string,
): void => {
  void browser.tabs
    .update(idDeLOnglet, { url: urlDeLaPageDAlerte(verdict, domaineVisite) })
    .catch((erreur: unknown) => {
      console.error("Redirection vers la page d'alerte impossible", erreur);
    });
};

const avertitSansBloquer = (idDeLOnglet: number, verdict: Verdict): void => {
  void browser.action
    .setBadgeText({ tabId: idDeLOnglet, text: "!" })
    .catch(() => undefined);
  void browser.action
    .setBadgeBackgroundColor({ tabId: idDeLOnglet, color: COULEUR_DU_BADGE })
    .catch(() => undefined);
  void browser.action
    .setTitle({
      tabId: idDeLOnglet,
      title: `Ce domaine ressemble à ${verdict.domaineImite}`,
    })
    .catch(() => undefined);
};

const effaceLAvertissement = (idDeLOnglet: number): void => {
  void browser.action
    .setBadgeText({ tabId: idDeLOnglet, text: "" })
    .catch(() => undefined);
};

browser.webNavigation.onBeforeNavigate.addListener((navigation) => {
  const estUneNavigationPrincipale = navigation.frameId === ID_DU_CADRE_PRINCIPAL;
  if (!estUneNavigationPrincipale) return;

  const verdict = analyseLUrl(
    indexDesDomainesLegitimes(),
    domainesExclus,
    navigation.url,
  );

  if (verdict === null) {
    effaceLAvertissement(navigation.tabId);
    return;
  }

  if (verdict.severite === "blocage") {
    bloqueLaNavigation(
      navigation.tabId,
      verdict,
      new URL(navigation.url).hostname,
    );
    return;
  }

  avertitSansBloquer(navigation.tabId, verdict);
});
