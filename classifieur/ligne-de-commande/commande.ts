import { executeLaChaine } from "../chaine/chaine.ts";
import { cheminsDesResultats } from "../commun/chemins.ts";
import { entraineLeModele } from "../entrainement/entrainement.ts";
import { evalueLeModele } from "../evaluation/evaluation.ts";
import { genereLesDonnees, type ParametresDeGeneration } from "../creation-du-dataset/generation.ts";
import { calculeLaNormalisation } from "../entrainement/normalisation.ts";
import {
  EPOQUES_DU_REENTRAINEMENT,
  litLesParametresDuModeleLivre,
  PLANCHER_DE_F1_PAR_DEFAUT,
  reentraineEtLivre,
  REPERTOIRE_DU_REENTRAINEMENT,
  TAILLE_DU_LOT_DU_REENTRAINEMENT,
  TOLERANCE_PAR_DEFAUT,
} from "../livraison/reentrainement.ts";
import { litEntier, litNombre, litOption, litRepertoire } from "./options.ts";
import { repartitLesDonnees } from "../creation-du-dataset/repartition.ts";
import { preditLeDomaine } from "../inference/prediction.ts";

const commande = process.argv[2];
const repertoire = litRepertoire();
const parametresDeGeneration = (essai: boolean): ParametresDeGeneration => ({
  repertoire: essai && process.argv.every((argument) => !argument.startsWith("--repertoire="))
    ? `${cheminsDesResultats(repertoire).racine}-essai`
    : repertoire,
  graine: String(litEntier("graine", 20260917)),
  limite: litEntier("limite", essai ? 1000 : 0),
  imitationsParDomaine: litEntier("imitations-par-domaine", 4),
  intermediairesParDomaine: litEntier("intermediaires-par-domaine", 4),
  distantsParDomaine: litEntier("distants-par-domaine", 2),
  scoreMinimumImitation: litNombre("score-minimum-imitation", 0.85),
  scoreMinimumIntermediaire: litNombre("score-minimum-intermediaire", 0.55),
  scoreMaximumIntermediaire: litNombre("score-maximum-intermediaire", 0.8),
});

switch (commande) {
  case "generer":
    await genereLesDonnees(parametresDeGeneration(false));
    break;
  case "repartir":
    await repartitLesDonnees(repertoire);
    break;
  case "normaliser":
    await calculeLaNormalisation(repertoire);
    break;
  case "entrainer":
    await entraineLeModele({
      repertoire,
      epoques: litEntier("epoques", 25),
      tailleDuLot: litEntier("taille-du-lot", 256),
    });
    break;
  case "evaluer":
    await evalueLeModele(repertoire);
    break;
  case "predire": {
    const valeur = process.argv[3];
    if (valeur === undefined || valeur.startsWith("--")) {
      throw new Error("Usage : npm run classifieur:predire -- https://exemple.fr [--repertoire=chemin]");
    }
    console.log(JSON.stringify(await preditLeDomaine(valeur, repertoire), null, 2));
    break;
  }
  case "chaine":
  case "essai":
    await executeLaChaine({
      generation: parametresDeGeneration(commande === "essai"),
      epoques: litEntier("epoques", commande === "essai" ? 12 : 25),
      tailleDuLot: litEntier("taille-du-lot", commande === "essai" ? 512 : 256),
    });
    break;
  case "reentrainer": {
    const parametresDuModeleLivre = await litLesParametresDuModeleLivre();
    await reentraineEtLivre({
      generation: {
        repertoire: litOption("repertoire", REPERTOIRE_DU_REENTRAINEMENT),
        graine: String(litEntier("graine", Number(parametresDuModeleLivre.graine))),
        limite: litEntier("limite", parametresDuModeleLivre.limite),
        imitationsParDomaine: litEntier("imitations-par-domaine", parametresDuModeleLivre.imitationsParDomaine),
        intermediairesParDomaine: litEntier("intermediaires-par-domaine", parametresDuModeleLivre.intermediairesParDomaine),
        distantsParDomaine: litEntier("distants-par-domaine", parametresDuModeleLivre.distantsParDomaine),
        scoreMinimumImitation: litNombre("score-minimum-imitation", parametresDuModeleLivre.scoreMinimumImitation),
        scoreMinimumIntermediaire: litNombre("score-minimum-intermediaire", parametresDuModeleLivre.scoreMinimumIntermediaire),
        scoreMaximumIntermediaire: litNombre("score-maximum-intermediaire", parametresDuModeleLivre.scoreMaximumIntermediaire),
      },
      epoques: litEntier("epoques", EPOQUES_DU_REENTRAINEMENT),
      tailleDuLot: litEntier("taille-du-lot", TAILLE_DU_LOT_DU_REENTRAINEMENT),
      criteres: {
        plancherDeF1: litNombre("plancher-f1", PLANCHER_DE_F1_PAR_DEFAUT),
        tolerance: litNombre("tolerance", TOLERANCE_PAR_DEFAUT),
      },
    });
    break;
  }
  default:
    throw new Error(`Commande inconnue : ${commande ?? "aucune"}`);
}
