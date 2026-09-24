import browser from "webextension-polyfill";

import type { ResultatDeComparaison } from "../arriere-plan/comparaison.ts";
import { retrouveLUrlAAnalyser } from "./url-de-comparaison.ts";
import "./style.css";

const affiche = (identifiant: string, texte: string): void => {
  const element = document.getElementById(identifiant);
  if (element !== null) element.textContent = texte;
};

const pourcentage = (valeur: number): string => `${(valeur * 100).toFixed(1)} %`;

const urlDeLOnglet = async (): Promise<string | null> => {
  const onglet = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (onglet?.url === undefined) return null;
  return retrouveLUrlAAnalyser(onglet.url, browser.runtime.getURL("src/alerte/index.html"));
};

const afficheLeResultat = (resultat: ResultatDeComparaison): void => {
  if (resultat.etat === "non-analysable") {
    affiche("domaine", "Aucun domaine web analysable dans cet onglet.");
    affiche("etat", "Page interne, URL non web ou domaine invalide.");
    affiche("decision-regles", "Non analysé");
    affiche("decision-modele", "Non analysé");
    return;
  }
  affiche("domaine", resultat.domaine);
  if (resultat.etat === "hors-perimetre") {
    affiche("etat", "Domaine hors du périmètre de l’analyse.");
    affiche("decision-regles", "Non analysé");
    affiche("decision-modele", "Non analysé");
    return;
  }
  const verdict = resultat.regles;
  affiche("decision-regles", verdict === null ? "Aucune alerte" :
    verdict.severite === "blocage" ? "Blocage" : "Avertissement");
  affiche("details-regles", verdict === null ? "Aucune règle ne signale ce domaine." :
    `Classe : ${verdict.classe}\nDomaine imité : ${verdict.domaineImite}\nScore de proximité : ${pourcentage(verdict.scoreDeSuspicion)}`);

  const prediction = resultat.modele;
  if (prediction === null) {
    affiche("decision-modele", "Indisponible");
    affiche("details-modele", "Le modèle n’a pas pu être chargé.");
    return;
  }
  affiche("decision-modele", prediction.correspondanceExacte ? "Référence légitime" :
    prediction.decision === "suspect" ? "Signalé par le modèle" : "Non signalé par le modèle");
  affiche("details-modele", prediction.correspondanceExacte ? "Domaine présent dans la liste légitime." :
    `Score expérimental : ${pourcentage(prediction.score)}\nSeuil : ${pourcentage(prediction.seuil)}\nDomaine proche : ${prediction.domaineProche ?? "aucun"}`);
  affiche("etat", "Résultats calculés localement dans l’extension.");
};

const compareLOnglet = async (): Promise<void> => {
  const url = await urlDeLOnglet();
  if (url === null) {
    afficheLeResultat({ etat: "non-analysable", domaine: null });
    return;
  }
  const resultat: ResultatDeComparaison = await browser.runtime.sendMessage({ type: "compare-les-methodes", url });
  afficheLeResultat(resultat);
};

void compareLOnglet().catch((erreur: unknown) => {
  affiche("etat", "Comparaison indisponible.");
  affiche("decision-regles", "Indisponible");
  affiche("decision-modele", "Indisponible");
  console.error("Comparaison impossible", erreur);
});
