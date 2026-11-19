import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import { analyseLUrl, type Verdict } from "../noyau/detection.ts";
import {
  construisLIndexDeRecherche,
  type IndexDeRecherche,
} from "../noyau/index-de-recherche.ts";
import { litLaListeDeDomaines } from "../noyau/liste-de-domaines.ts";
import {
  normaliseLUrl,
  normaliseLeNomDHote,
} from "../noyau/normalisation.ts";
import { autoriseLeDomaine, domainesAutorises } from "./exceptions.ts";
import { MODE_D_ALERTE } from "./configuration.ts";
import { alerteDeLOnglet, memoriseLAlerte, oublieLAlerte } from "./alertes-en-cours.ts";
import { compareLesMethodes } from "./comparaison.ts";
import {
  estUneDemandeDAlerteEnCours,
  estUneDemandeDAutorisation,
  estUneDemandeDeComparaison,
} from "./messages.ts";

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

const urlDeLaPageDAlerte = (verdict: Verdict, nomDHoteVisite: string): string => {
  const parametres = new URLSearchParams({
    domaineVisite: nomDHoteVisite,
    domaineImite: verdict.domaineImite,
    classe: verdict.classe,
    score: (verdict.scoreDeSuspicion * 100).toFixed(1),
  });
  return browser.runtime.getURL(`src/alerte/index.html?${parametres.toString()}`);
};

const afficheLaPageDAlerte = async (
  idDeLOnglet: number,
  verdict: Verdict,
  nomDHoteVisite: string,
): Promise<void> => {
  await browser.tabs.update(idDeLOnglet, {
    url: urlDeLaPageDAlerte(verdict, nomDHoteVisite),
  });
};

const afficheLeBadgeDAvertissement = async (
  idDeLOnglet: number,
  verdict: Verdict,
): Promise<void> => {
  await browser.action.setBadgeText({ tabId: idDeLOnglet, text: "!" });
  await browser.action.setBadgeBackgroundColor({
    tabId: idDeLOnglet,
    color: COULEUR_DU_BADGE,
  });
  await browser.action.setTitle({
    tabId: idDeLOnglet,
    title: `Ce domaine ressemble à ${verdict.domaineImite}`,
  });
};

const estUneUrlWeb = (url: string | undefined): url is string =>
  url !== undefined && /^https?:\/\//.test(url);

const interromptLaNavigation = async (
  navigation: Navigation,
  verdict: Verdict,
): Promise<void> => {
  const onglet = await browser.tabs.get(navigation.tabId);
  const urlDeRetour = estUneUrlWeb(onglet.url) ? onglet.url : "about:blank";
  await memoriseLAlerte(navigation.tabId, { urlBloquee: navigation.url, urlDeRetour });
  await browser.tabs.update(navigation.tabId, { url: urlDeRetour });
  await afficheLeBadgeDAvertissement(navigation.tabId, verdict);
  if (!onglet.active) return;
  try {
    await browser.action.openPopup(
      onglet.windowId === undefined ? undefined : { windowId: onglet.windowId },
    );
  } catch (erreur) {
    console.warn("Ouverture de la popup impossible", erreur);
  }
};

const effaceLeBadge = async (idDeLOnglet: number): Promise<void> => {
  await browser.action.setBadgeText({ tabId: idDeLOnglet, text: "" });
};

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

interface Expediteur {
  readonly tab?: { readonly id?: number };
}

const traiteLaNavigation = async (navigation: Navigation): Promise<void> => {
  if (navigation.frameId !== ID_DU_CADRE_PRINCIPAL) return;

  if (MODE_D_ALERTE === "popup") {
    const alerte = await alerteDeLOnglet(navigation.tabId);
    if (alerte?.urlDeRetour === navigation.url) return;
    if (alerte !== null) await oublieLAlerte(navigation.tabId);
  }

  const visite = normaliseLUrl(navigation.url);
  if (visite === null) return;

  const verdict = analyseLUrl(
    indexDesDomainesLegitimes(),
    domainesExclus,
    navigation.url,
  );

  const autorises = await domainesAutorises();
  const estAutorise = autorises.has(visite.domaineEnregistrable);

  if (verdict === null || estAutorise) {
    await effaceLeBadge(navigation.tabId);
    return;
  }

  if (verdict.severite === "blocage") {
    if (MODE_D_ALERTE === "page") {
      await afficheLaPageDAlerte(navigation.tabId, verdict, visite.nomDHote);
    } else {
      await interromptLaNavigation(navigation, verdict);
    }
    return;
  }

  await afficheLeBadgeDAvertissement(navigation.tabId, verdict);
};

const ecouteLaNavigation = (navigation: Navigation): void => {
  void traiteLaNavigation(navigation).catch((erreur: unknown) => {
    console.error("Analyse de la navigation impossible", erreur);
  });
};

browser.webNavigation.onBeforeNavigate.addListener(ecouteLaNavigation);

browser.runtime.onMessage.addListener(async (
  message: unknown,
  expediteur: Expediteur,
) => {
  if (estUneDemandeDeComparaison(message)) {
    return compareLesMethodes(indexDesDomainesLegitimes(), domainesExclus, message.url);
  }
  if (estUneDemandeDAlerteEnCours(message)) {
    return alerteDeLOnglet(message.idDeLOnglet);
  }
  if (!estUneDemandeDAutorisation(message)) return;

  const demande = normaliseLeNomDHote(message.domaine);
  if (demande === null) return;

  await autoriseLeDomaine(demande.domaineEnregistrable);

  const idDeLOnglet = expediteur.tab?.id ?? message.idDeLOnglet;
  if (idDeLOnglet === undefined) return;

  const alerte = await alerteDeLOnglet(idDeLOnglet);
  await browser.tabs.update(idDeLOnglet, {
    url: alerte?.urlBloquee ?? `https://${demande.nomDHote}/`,
  });
});
