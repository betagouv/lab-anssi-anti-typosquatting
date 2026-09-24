import { cheminsDesResultats } from "../commun/chemins.ts";
import { entraineLeModele } from "../entrainement/entrainement.ts";
import { evalueLeModele } from "../evaluation/evaluation.ts";
import { genereLesDonnees, type ParametresDeGeneration } from "../creation-du-dataset/generation.ts";
import { calculeLaNormalisation } from "../entrainement/normalisation.ts";
import { litEntier, litNombre, litRepertoire } from "./options.ts";
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
  case "essai": {
    const parametres = parametresDeGeneration(commande === "essai");
    await genereLesDonnees(parametres);
    await repartitLesDonnees(parametres.repertoire);
    await calculeLaNormalisation(parametres.repertoire);
    await entraineLeModele({
      repertoire: parametres.repertoire,
      epoques: litEntier("epoques", commande === "essai" ? 12 : 25),
      tailleDuLot: litEntier("taille-du-lot", commande === "essai" ? 512 : 256),
    });
    await evalueLeModele(parametres.repertoire);
    break;
  }
  default:
    throw new Error(`Commande inconnue : ${commande ?? "aucune"}`);
}
