import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cheminsDesResultats, RACINE_DU_DEPOT } from "../commun/chemins.ts";
import { litLesDomaines } from "../creation-du-dataset/domaines.ts";
import { litLaProvenance } from "../creation-du-dataset/generation.ts";
import { compacteLaNormalisation, developpeLaNormalisation, verifieLaNormalisation, type Normalisation } from "../../src/noyau/modele/normalisation.ts";
import { DIMENSIONS_DU_MODELE, litLesPoids, NOMBRE_DE_POIDS, verifieLeModeleExporte, type ModeleExporte } from "../../src/noyau/modele/calcul.ts";

const REPERTOIRE_DE_L_EXPORT = join(RACINE_DU_DEPOT, "public", "modele");
const FICHIER_DES_METADONNEES = join(REPERTOIRE_DE_L_EXPORT, "essai.json");
const FICHIER_DES_POIDS = join(REPERTOIRE_DE_L_EXPORT, "essai.bin");
const empreinteDe = (contenu: Uint8Array): string => createHash("sha256").update(contenu).digest("hex");

interface ModeleEnregistre {
  readonly topologie: {
    readonly class_name: string;
    readonly config: {
      readonly layers: readonly { readonly class_name: string; readonly config: {
        readonly units: number;
        readonly activation: string;
      } }[];
    };
  };
  readonly specificationsDesPoids: readonly { readonly name: string; readonly shape: readonly number[]; readonly dtype: string }[];
  readonly poidsEnBase64: string;
}

const verifieLArchitecture = (modele: ModeleEnregistre): void => {
  const couches = modele.topologie.config.layers;
  if (modele.topologie.class_name !== "Sequential" || couches.length !== 3 ||
    couches.some((couche, position) => couche.class_name !== "Dense" ||
      couche.config.units !== DIMENSIONS_DU_MODELE[position + 1] ||
      couche.config.activation !== (position === 2 ? "sigmoid" : "relu"))) {
    throw new Error("Architecture du modèle incompatible avec l'extension.");
  }
  const formes = [[157, 32], [32], [32, 16], [16], [16, 1], [1]];
  if (modele.specificationsDesPoids.length !== formes.length ||
    modele.specificationsDesPoids.some((specification, position) =>
      specification.dtype !== "float32" ||
      !specification.name.endsWith(position % 2 === 0 ? "/kernel" : "/bias") ||
      JSON.stringify(specification.shape) !== JSON.stringify(formes[position]))) {
    throw new Error("Ordre ou dimensions des poids incompatibles.");
  }
};

export const verifieLExport = async (): Promise<ModeleExporte> => {
  const [contenu, poids, source] = await Promise.all([
    readFile(FICHIER_DES_METADONNEES, "utf8"),
    readFile(FICHIER_DES_POIDS),
    litLesDomaines(),
  ]);
  const modele = JSON.parse(contenu) as ModeleExporte;
  verifieLeModeleExporte(modele, poids.byteLength);
  litLesPoids(poids.buffer.slice(poids.byteOffset, poids.byteOffset + poids.byteLength));
  developpeLaNormalisation(modele.normalisation);
  if (modele.empreinteSource !== source.empreinte || modele.empreintePoids !== empreinteDe(poids)) {
    throw new Error("L'export ne correspond plus à la liste source ou aux poids.");
  }
  return modele;
};

export const exporteLeModele = async (repertoire: string): Promise<void> => {
  const chemins = cheminsDesResultats(resolve(repertoire));
  const [poidsEnregistres, normalisationBrute, evaluationBrute, provenance, source] = await Promise.all([
    readFile(chemins.modele),
    readFile(chemins.normalisation, "utf8"),
    readFile(chemins.evaluation, "utf8"),
    litLaProvenance(repertoire),
    litLesDomaines(),
  ]);
  const normalisation = JSON.parse(normalisationBrute) as Normalisation;
  const evaluation = JSON.parse(evaluationBrute) as { empreinteModele: string; seuilRecommande: number };
  const modeleEnregistre = JSON.parse(poidsEnregistres.toString("utf8")) as ModeleEnregistre;
  verifieLaNormalisation(normalisation);
  verifieLArchitecture(modeleEnregistre);
  if (source.empreinte !== provenance.empreinteSource ||
    empreinteDe(poidsEnregistres) !== evaluation.empreinteModele) {
    throw new Error("La liste source ou le modèle ont changé depuis l'évaluation.");
  }
  const poids = Buffer.from(modeleEnregistre.poidsEnBase64, "base64");
  const exporte: ModeleExporte = {
    version: 1,
    empreinteSource: source.empreinte,
    empreinteModele: evaluation.empreinteModele,
    empreintePoids: empreinteDe(poids),
    parametres: { ...provenance.parametres },
    dimensions: DIMENSIONS_DU_MODELE,
    seuil: evaluation.seuilRecommande,
    normalisation: compacteLaNormalisation(normalisation),
  };
  verifieLeModeleExporte(exporte, poids.byteLength);
  if (poids.byteLength !== NOMBRE_DE_POIDS * 4) throw new Error("Nombre de poids invalide.");
  litLesPoids(poids.buffer.slice(poids.byteOffset, poids.byteOffset + poids.byteLength));
  await mkdir(REPERTOIRE_DE_L_EXPORT, { recursive: true });
  await writeFile(FICHIER_DES_POIDS, poids);
  await writeFile(FICHIER_DES_METADONNEES, `${JSON.stringify(exporte)}\n`);
  await verifieLExport();
  console.log(`Modèle d'essai exporté : ${FICHIER_DES_POIDS}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv[2] === "verifier") await verifieLExport();
  else await exporteLeModele(process.argv[2] ?? "classifieur/resultats-essai");
}
