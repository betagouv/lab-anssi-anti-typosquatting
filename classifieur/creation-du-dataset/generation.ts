import { readFile } from "node:fs/promises";

import { hache32 } from "./aleatoire.ts";
import { colonnesDesCaracteristiques, colonnesDesMetadonnees, construitLigneDeCaracteristiques } from "../../src/noyau/modele/caracteristiques.ts";
import { normaliseLeDomaine } from "../../src/noyau/modele/domaines.ts";
import { RechercheDeCandidats } from "../../src/noyau/modele/recherche.ts";
import { cheminsDesResultats } from "../commun/chemins.ts";
import { litLesDomaines } from "./domaines.ts";
import { creeRedacteurCsv, ecritJson } from "../commun/fichiers.ts";
import { genereNomDistant, genereNomIntermediaire, genereVariantesTrompeuses } from "./mutations.ts";

export interface ParametresDeGeneration {
  readonly repertoire: string;
  readonly graine: string;
  readonly limite: number;
  readonly imitationsParDomaine: number;
  readonly intermediairesParDomaine: number;
  readonly distantsParDomaine: number;
  readonly scoreMinimumImitation: number;
  readonly scoreMinimumIntermediaire: number;
  readonly scoreMaximumIntermediaire: number;
}

export interface Provenance {
  readonly empreinteSource: string;
  readonly nombreDeDomainesSource: number;
  readonly nombreDeDomainesSelectionnes: number;
  readonly nombreDeLignes: number;
  readonly parametres: Omit<ParametresDeGeneration, "repertoire">;
}

export const genereLesDonnees = async (parametres: ParametresDeGeneration): Promise<Provenance> => {
  const { domaines, empreinte } = await litLesDomaines();
  const { repertoire, graine, limite, imitationsParDomaine, intermediairesParDomaine,
    distantsParDomaine, scoreMinimumImitation, scoreMinimumIntermediaire,
    scoreMaximumIntermediaire } = parametres;
  if (scoreMinimumIntermediaire >= scoreMaximumIntermediaire ||
    scoreMaximumIntermediaire >= scoreMinimumImitation || scoreMinimumImitation > 1) {
    throw new Error("Les seuils de génération doivent être croissants et inférieurs ou égaux à 1.");
  }
  const referencesSelectionnees = limite > 0
    ? [...domaines].sort((gauche, droite) =>
      hache32(`${graine}:${gauche}`) - hache32(`${graine}:${droite}`) || gauche.localeCompare(droite)).slice(0, limite)
    : domaines;
  const ensembleDesReferences = new Set(domaines);
  const recherche = new RechercheDeCandidats(domaines);
  const nombreDeCandidats = 10;
  const chemins = cheminsDesResultats(repertoire);
  const redacteur = await creeRedacteurCsv(chemins.donnees, [
    ...colonnesDesMetadonnees(nombreDeCandidats),
    ...colonnesDesCaracteristiques(nombreDeCandidats),
  ]);
  let nombreDeLignes = 0;
  let nombreDeVariantesIgnorees = 0;

  const ecritExemple = async (
    domaine: string,
    referenceSource: string,
    type: string,
    classe: string,
    cible: number,
  ): Promise<void> => {
    const candidats = recherche.trouveLesPlusProches(domaine, nombreDeCandidats);
    await redacteur.ecritLigne(construitLigneDeCaracteristiques(domaine, candidats, {
      domaine_reference_source: referenceSource,
      type_generation: type,
      classe,
      domaine_trompeur_car_trop_proche_d_un_valide: cible,
    }, nombreDeCandidats));
    nombreDeLignes++;
  };

  try {
    for (const [position, referenceSource] of referencesSelectionnees.entries()) {
      const variantes = genereVariantesTrompeuses(
        referenceSource, imitationsParDomaine + 4, `${graine}:${referenceSource}`,
      );
      let imitationsEcrites = 0;
      for (const variante of variantes) {
        if (imitationsEcrites >= imitationsParDomaine) break;
        let domaine: string;
        try { domaine = normaliseLeDomaine(variante.domaine); }
        catch { nombreDeVariantesIgnorees++; continue; }
        if (ensembleDesReferences.has(domaine)) { nombreDeVariantesIgnorees++; continue; }
        const candidats = recherche.trouveLesPlusProches(domaine, nombreDeCandidats);
        if ((candidats[0]?.comparaison.scoreSuspicion ?? 0) < scoreMinimumImitation) {
          nombreDeVariantesIgnorees++;
          continue;
        }
        await ecritExemple(domaine, referenceSource, variante.type, "typosquatting_synthetique", 1);
        imitationsEcrites++;
      }

      let intermediairesEcrits = 0;
      for (let essai = 0; intermediairesEcrits < intermediairesParDomaine && essai < intermediairesParDomaine * 40; essai++) {
        const genere = genereNomIntermediaire(referenceSource, essai, `${graine}:${referenceSource}`);
        if (genere === null) continue;
        let domaine: string;
        try { domaine = normaliseLeDomaine(genere); }
        catch { continue; }
        if (ensembleDesReferences.has(domaine)) continue;
        const candidats = recherche.trouveLesPlusProches(domaine, nombreDeCandidats);
        const score = candidats[0]?.comparaison.scoreSuspicion ?? 0;
        if (score < scoreMinimumIntermediaire || score >= scoreMaximumIntermediaire) continue;
        await ecritExemple(domaine, referenceSource, "nom_intermediaire_synthetique", "non_trompeur_intermediaire_synthetique", 0);
        intermediairesEcrits++;
      }

      let distantsEcrits = 0;
      for (let essai = 0; distantsEcrits < distantsParDomaine && essai < distantsParDomaine * 30; essai++) {
        const domaine = genereNomDistant(referenceSource, essai, `${graine}:${referenceSource}`);
        if (ensembleDesReferences.has(domaine)) continue;
        const candidats = recherche.trouveLesPlusProches(domaine, nombreDeCandidats);
        if ((candidats[0]?.comparaison.scoreSuspicion ?? 0) >= scoreMinimumIntermediaire) continue;
        await ecritExemple(domaine, referenceSource, "nom_distant_synthetique", "non_trompeur_synthetique", 0);
        distantsEcrits++;
      }
      if ((position + 1) % 500 === 0 || position + 1 === referencesSelectionnees.length) {
        console.log(`Références traitées : ${position + 1}/${referencesSelectionnees.length} ; lignes : ${nombreDeLignes}`);
      }
    }
  } finally {
    await redacteur.ferme();
  }
  if (nombreDeLignes === 0) throw new Error("La génération n'a produit aucun exemple.");
  const parametresEnregistres = {
    graine,
    limite,
    imitationsParDomaine,
    intermediairesParDomaine,
    distantsParDomaine,
    scoreMinimumImitation,
    scoreMinimumIntermediaire,
    scoreMaximumIntermediaire,
  };
  const provenance: Provenance = {
    empreinteSource: empreinte,
    nombreDeDomainesSource: domaines.length,
    nombreDeDomainesSelectionnes: referencesSelectionnees.length,
    nombreDeLignes,
    parametres: parametresEnregistres,
  };
  await ecritJson(chemins.provenance, provenance);
  console.log(`Jeu de données créé : ${chemins.donnees} ; variantes ignorées : ${nombreDeVariantesIgnorees}`);
  return provenance;
};

export const litLaProvenance = async (repertoire: string): Promise<Provenance> => {
  const chemins = cheminsDesResultats(repertoire);
  return JSON.parse(await readFile(chemins.provenance, "utf8")) as Provenance;
};
