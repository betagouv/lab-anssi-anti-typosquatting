import browser from "webextension-polyfill";
import { analyseLUrl, type Verdict } from "../noyau/detection.ts";
import type { IndexDeRecherche } from "../noyau/index-de-recherche.ts";
import { normaliseLUrl } from "../noyau/normalisation.ts";
import { litLesPoids, verifieLeModeleExporte, type ModeleExporte } from "../noyau/modele/calcul.ts";
import { developpeLaNormalisation } from "../noyau/modele/normalisation.ts";
import { preditAvecLeModele, type PredictionDuModele } from "../noyau/modele/prediction.ts";
import { RechercheDeCandidats } from "../noyau/modele/recherche.ts";

export type ResultatDeComparaison =
  | { readonly etat: "non-analysable"; readonly domaine: null }
  | { readonly etat: "hors-perimetre"; readonly domaine: string }
  | { readonly etat: "analyse"; readonly domaine: string; readonly regles: Verdict | null;
      readonly modele: PredictionDuModele | null };

let recherche: RechercheDeCandidats | null = null;
let chargementDuModele: Promise<{ modele: ModeleExporte; poids: Float32Array }> | null = null;

const chargeLeModele = (): Promise<{ modele: ModeleExporte; poids: Float32Array }> => {
  chargementDuModele ??= (async () => {
    const [reponseDesMetadonnees, reponseDesPoids] = await Promise.all([
      fetch(browser.runtime.getURL("modele/essai.json")),
      fetch(browser.runtime.getURL("modele/essai.bin")),
    ]);
    if (!reponseDesMetadonnees.ok || !reponseDesPoids.ok) {
      throw new Error("Impossible de charger le modèle embarqué.");
    }
    const [modele, octets] = await Promise.all([
      reponseDesMetadonnees.json() as Promise<ModeleExporte>,
      reponseDesPoids.arrayBuffer(),
    ]);
    verifieLeModeleExporte(modele, octets.byteLength);
    developpeLaNormalisation(modele.normalisation);
    return { modele, poids: litLesPoids(octets) };
  })().catch((erreur: unknown) => {
    chargementDuModele = null;
    throw erreur;
  });
  return chargementDuModele;
};

export const compareLesMethodes = async (
  index: IndexDeRecherche,
  domainesExclus: ReadonlySet<string>,
  url: string,
): Promise<ResultatDeComparaison> => {
  const visite = normaliseLUrl(url);
  if (visite === null) return { etat: "non-analysable", domaine: null };
  if (visite.estSousUnSuffixePrive || domainesExclus.has(visite.domaineEnregistrable)) {
    return { etat: "hors-perimetre", domaine: visite.domaineEnregistrable };
  }
  const regles = analyseLUrl(index, domainesExclus, url);
  let prediction: PredictionDuModele | null = null;
  try {
    const { modele, poids } = await chargeLeModele();
    recherche ??= new RechercheDeCandidats([...index.domaines]);
    prediction = preditAvecLeModele(visite.domaineEnregistrable, index.domaines, recherche, modele, poids);
  } catch (erreur) {
    console.error("Prédiction expérimentale indisponible", erreur);
  }
  return { etat: "analyse", domaine: visite.domaineEnregistrable, regles, modele: prediction };
};
