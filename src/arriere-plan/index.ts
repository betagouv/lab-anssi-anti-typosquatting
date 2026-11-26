import browser from "webextension-polyfill";

import domainesExclusBruts from "../donnees/domaines-exclus.txt?raw";
import domainesLegitimesBruts from "../donnees/domaines-legitimes.txt?raw";
import { analyseLUrl, estNonVerifiable, type Verdict } from "../noyau/detection.ts";
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
  afficheLEtat,
  ETAT_NEUTRE,
  etatDuVerdict,
  lePlusGrave,
  type EtatDeLOnglet,
} from "./etat-de-l-onglet.ts";
import {
  estUneDemandeDAlerteEnCours,
  estUneDemandeDAutorisation,
  estUneDemandeDeComparaison,
} from "./messages.ts";

const ID_DU_CADRE_PRINCIPAL = 0;

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

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

interface Expediteur {
  readonly tab?: { readonly id?: number };
}

interface EtatPrevu {
  readonly urlDemandee: string;
  readonly etat: EtatDeLOnglet;
}

const etatPrevuParOnglet = new Map<number, EtatPrevu>();
const etatAfficheParOnglet = new Map<number, EtatDeLOnglet>();

const estUneUrlWeb = (url: string | undefined): url is string =>
  url !== undefined && /^https?:\/\//.test(url);

const estLaPageDAlerte = (url: string): boolean =>
  url.startsWith(browser.runtime.getURL("src/alerte/index.html"));

const etatDeLaPageDAlerte = (url: string): EtatDeLOnglet => ({
  niveau: "alerte",
  domaineImite: new URL(url).searchParams.get("domaineImite") ?? "",
});

const etatDeLAnalyse = (url: string): EtatDeLOnglet =>
  etatDuVerdict(
    analyseLUrl(indexDesDomainesLegitimes(), domainesExclus, url),
    estNonVerifiable(indexDesDomainesLegitimes(), domainesExclus, url),
  );

const etatDeLUrl = (url: string): EtatDeLOnglet => {
  if (estLaPageDAlerte(url)) return etatDeLaPageDAlerte(url);
  if (normaliseLUrl(url) === null) return ETAT_NEUTRE;
  return etatDeLAnalyse(url);
};

const afficheLEtatSansBloquer = async (idDeLOnglet: number, etat: EtatDeLOnglet): Promise<void> => {
  try {
    await afficheLEtat(idDeLOnglet, etat);
  } catch (erreur) {
    console.error("Affichage de l'état de l'onglet impossible", erreur);
  }
};

const ouvreLaPopup = async (idDeLaFenetre: number | undefined): Promise<void> => {
  try {
    await browser.action.openPopup(
      idDeLaFenetre === undefined ? undefined : { windowId: idDeLaFenetre },
    );
  } catch (erreur) {
    console.warn("Ouverture de la popup impossible", erreur);
  }
};

const interromptLaNavigation = async (navigation: Navigation): Promise<void> => {
  const onglet = await browser.tabs.get(navigation.tabId);
  const urlDeRetour = estUneUrlWeb(onglet.url) ? onglet.url : "about:blank";
  await memoriseLAlerte(navigation.tabId, { urlBloquee: navigation.url, urlDeRetour });
  await browser.tabs.update(navigation.tabId, { url: urlDeRetour });
  if (onglet.active) await ouvreLaPopup(onglet.windowId);
};

const traiteLaNavigationAvantChargement = async (navigation: Navigation): Promise<void> => {
  if (navigation.frameId !== ID_DU_CADRE_PRINCIPAL) return;

  if (MODE_D_ALERTE === "popup") {
    const alerte = await alerteDeLOnglet(navigation.tabId);
    if (alerte?.urlDeRetour === navigation.url) return;
    if (alerte !== null) await oublieLAlerte(navigation.tabId);
  }

  const visite = normaliseLUrl(navigation.url);
  if (visite === null) {
    etatPrevuParOnglet.delete(navigation.tabId);
    return;
  }

  const verdict = analyseLUrl(indexDesDomainesLegitimes(), domainesExclus, navigation.url);
  const etat = etatDuVerdict(
    verdict,
    estNonVerifiable(indexDesDomainesLegitimes(), domainesExclus, navigation.url),
  );
  etatPrevuParOnglet.set(navigation.tabId, { urlDemandee: navigation.url, etat });

  if (verdict?.severite !== "blocage") return;
  if ((await domainesAutorises()).has(visite.domaineEnregistrable)) return;

  if (MODE_D_ALERTE === "page") {
    await afficheLaPageDAlerte(navigation.tabId, verdict, visite.nomDHote);
  } else {
    await interromptLaNavigation(navigation);
  }
  await afficheLEtatSansBloquer(navigation.tabId, etat);
};

const etatDeLaNavigationEngagee = async (navigation: Navigation): Promise<EtatDeLOnglet> => {
  const alerte = MODE_D_ALERTE === "popup" ? await alerteDeLOnglet(navigation.tabId) : null;
  if (alerte?.urlDeRetour === navigation.url) return etatDeLUrl(alerte.urlBloquee);

  const etatPrevu = etatPrevuParOnglet.get(navigation.tabId)?.etat ?? ETAT_NEUTRE;
  etatPrevuParOnglet.delete(navigation.tabId);
  return lePlusGrave(etatPrevu, etatDeLUrl(navigation.url));
};

const traiteLaNavigationEnErreur = async (navigation: Navigation): Promise<void> => {
  if (navigation.frameId !== ID_DU_CADRE_PRINCIPAL) return;
  const etatPrevu = etatPrevuParOnglet.get(navigation.tabId);
  if (etatPrevu?.urlDemandee !== navigation.url) return;
  etatPrevuParOnglet.delete(navigation.tabId);
  etatAfficheParOnglet.set(navigation.tabId, etatPrevu.etat);
  await afficheLEtatSansBloquer(navigation.tabId, etatPrevu.etat);
};

const traiteLaNavigationEngagee = async (navigation: Navigation): Promise<void> => {
  if (navigation.frameId !== ID_DU_CADRE_PRINCIPAL) return;
  const etat = await etatDeLaNavigationEngagee(navigation);
  etatAfficheParOnglet.set(navigation.tabId, etat);
  await afficheLEtatSansBloquer(navigation.tabId, etat);
};

const reafficheLEtatApresChargement = async (navigation: Navigation): Promise<void> => {
  if (navigation.frameId !== ID_DU_CADRE_PRINCIPAL) return;
  const etat = etatAfficheParOnglet.get(navigation.tabId);
  if (etat !== undefined) await afficheLEtatSansBloquer(navigation.tabId, etat);
};

const ecoute = (traitement: (navigation: Navigation) => Promise<void>) =>
  (navigation: Navigation): void => {
    void traitement(navigation).catch((erreur: unknown) => {
      console.error("Analyse de la navigation impossible", erreur);
    });
  };

browser.webNavigation.onBeforeNavigate.addListener(ecoute(traiteLaNavigationAvantChargement));
browser.webNavigation.onCommitted.addListener(ecoute(traiteLaNavigationEngagee));
browser.webNavigation.onErrorOccurred.addListener(ecoute(traiteLaNavigationEnErreur));
browser.webNavigation.onCompleted.addListener(ecoute(reafficheLEtatApresChargement));
browser.tabs.onRemoved.addListener((idDeLOnglet) => {
  etatPrevuParOnglet.delete(idDeLOnglet);
  etatAfficheParOnglet.delete(idDeLOnglet);
});

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
