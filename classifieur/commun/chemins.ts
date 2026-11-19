import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE_DU_DEPOT = fileURLToPath(new URL("../../", import.meta.url));
export const FICHIER_DES_DOMAINES = join(
  RACINE_DU_DEPOT,
  "src",
  "donnees",
  "domaines-legitimes.txt",
);

export const REPERTOIRE_DU_MODELE_LIVRE = join(RACINE_DU_DEPOT, "public", "modele");
export const FICHIER_DES_METADONNEES_DU_MODELE_LIVRE = join(REPERTOIRE_DU_MODELE_LIVRE, "essai.json");
export const FICHIER_DES_POIDS_DU_MODELE_LIVRE = join(REPERTOIRE_DU_MODELE_LIVRE, "essai.bin");

export const cheminsDesResultats = (repertoire: string) => {
  const racine = resolve(repertoire);
  return {
    racine,
    donnees: join(racine, "donnees", "jeu-entrainement.csv"),
    entrainement: join(racine, "donnees", "repartitions", "entrainement.csv"),
    validation: join(racine, "donnees", "repartitions", "validation.csv"),
    test: join(racine, "donnees", "repartitions", "test.csv"),
    normalisation: join(racine, "modele", "normalisation.json"),
    modele: join(racine, "modele", "poids.json"),
    entrainementRapport: join(racine, "rapports", "entrainement.json"),
    evaluation: join(racine, "rapports", "evaluation.json"),
    provenance: join(racine, "rapports", "provenance.json"),
  };
};
