import browser from "webextension-polyfill";

import type { AlerteEnCours } from "../arriere-plan/alertes-en-cours.ts";
import type { ResultatDeComparaison } from "../arriere-plan/comparaison.ts";
import {
  presentationDIndisponibilite,
  presenteLeResultat,
  type Presentation,
} from "./presentation.ts";
import { retrouveLUrlAAnalyser } from "./url-de-comparaison.ts";
import "./style.css";

interface OngletAnalyse {
  readonly idDeLOnglet: number | null;
  readonly url: string | null;
  readonly alerte: AlerteEnCours | null;
}

const element = (identifiant: string): HTMLElement => {
  const trouve = document.getElementById(identifiant);
  if (trouve === null) throw new Error(`Élément #${identifiant} absent de la popup.`);
  return trouve;
};

const ongletAAnalyser = async (): Promise<OngletAnalyse> => {
  const onglet = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  const idDeLOnglet = onglet?.id ?? null;
  if (idDeLOnglet !== null) {
    const alerte: AlerteEnCours | null = await browser.runtime.sendMessage({
      type: "donne-l-alerte-en-cours",
      idDeLOnglet,
    });
    if (alerte !== null) return { idDeLOnglet, url: alerte.urlBloquee, alerte };
  }
  const url = onglet?.url === undefined
    ? null
    : retrouveLUrlAAnalyser(onglet.url, browser.runtime.getURL("src/alerte/index.html"));
  return { idDeLOnglet, url, alerte: null };
};

const naviguerQuandMeme = (idDeLOnglet: number, alerte: AlerteEnCours): void => {
  void browser.runtime.sendMessage({
    type: "autorise-le-domaine",
    domaine: new URL(alerte.urlBloquee).hostname,
    idDeLOnglet,
  }).then(() => { window.close(); });
};

const remplisLesDetails = (presentation: Presentation): void => {
  const liste = element("liste-des-details");
  liste.replaceChildren(...presentation.details.flatMap(({ libelle, valeur }) => {
    const terme = document.createElement("dt");
    terme.textContent = libelle;
    const definition = document.createElement("dd");
    definition.textContent = valeur;
    return [terme, definition];
  }));
  element("details").hidden = presentation.details.length === 0;
};

const affiche = (presentation: Presentation, onglet: OngletAnalyse | null): void => {
  element("alerte").className = `alerte alerte--${presentation.type}`;
  element("titre-de-l-alerte").textContent = presentation.titre;
  element("description-de-l-alerte").textContent = presentation.description;
  remplisLesDetails(presentation);

  const bouton = element("naviguer-quand-meme");
  const alerte = onglet?.alerte ?? null;
  const idDeLOnglet = onglet?.idDeLOnglet ?? null;
  if (!presentation.peutNaviguerQuandMeme || alerte === null || idDeLOnglet === null) return;
  bouton.hidden = false;
  bouton.addEventListener("click", () => { naviguerQuandMeme(idDeLOnglet, alerte); });
};

const analyseLOnglet = async (): Promise<void> => {
  const onglet = await ongletAAnalyser();
  const resultat: ResultatDeComparaison = onglet.url === null
    ? { etat: "non-analysable", domaine: null }
    : await browser.runtime.sendMessage({ type: "compare-les-methodes", url: onglet.url });
  affiche(presenteLeResultat(resultat, onglet.alerte?.urlBloquee ?? null), onglet);
};

void analyseLOnglet().catch((erreur: unknown) => {
  affiche(presentationDIndisponibilite, null);
  console.error("Analyse impossible", erreur);
});
