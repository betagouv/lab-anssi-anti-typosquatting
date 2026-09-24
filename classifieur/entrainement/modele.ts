import { readFile } from "node:fs/promises";
import * as tf from "@tensorflow/tfjs";

import { ecritJson } from "../commun/fichiers.ts";

interface ModeleEnregistre {
  readonly formatTensorflow: string | undefined;
  readonly origine: string | undefined;
  readonly conversion: string | null | undefined;
  readonly topologie: tf.io.ModelArtifacts["modelTopology"];
  readonly specificationsDesPoids: tf.io.WeightsManifestEntry[] | undefined;
  readonly poidsEnBase64: string;
}

export const creeLeModele = (nombreDeCaracteristiques: number, graine: number): tf.Sequential => {
  const initialisation = tf.initializers.glorotUniform({ seed: graine });
  const modele = tf.sequential();
  modele.add(tf.layers.dense({ inputShape: [nombreDeCaracteristiques], units: 32, activation: "relu", kernelInitializer: initialisation }));
  modele.add(tf.layers.dense({ units: 16, activation: "relu", kernelInitializer: initialisation }));
  modele.add(tf.layers.dense({ units: 1, activation: "sigmoid", kernelInitializer: initialisation }));
  modele.compile({ optimizer: tf.train.adam(0.001), loss: "binaryCrossentropy", metrics: ["accuracy"] });
  return modele;
};

export const enregistreLeModele = async (modele: tf.LayersModel, fichier: string): Promise<void> => {
  await modele.save(tf.io.withSaveHandler(async (artefacts) => {
    const donneesDesPoids = artefacts.weightData;
    if (!(donneesDesPoids instanceof ArrayBuffer)) {
      throw new Error("Le modèle ne contient pas un unique bloc de poids.");
    }
    const enregistre: ModeleEnregistre = {
      formatTensorflow: artefacts.format,
      origine: artefacts.generatedBy,
      conversion: artefacts.convertedBy,
      topologie: artefacts.modelTopology,
      specificationsDesPoids: artefacts.weightSpecs,
      poidsEnBase64: Buffer.from(donneesDesPoids).toString("base64"),
    };
    await ecritJson(fichier, enregistre);
    return { modelArtifactsInfo: {
      dateSaved: new Date(),
      modelTopologyType: "JSON",
      modelTopologyBytes: 0,
      weightSpecsBytes: 0,
      weightDataBytes: donneesDesPoids.byteLength,
    } };
  }));
};

export const chargeLeModele = async (fichier: string): Promise<tf.LayersModel> => {
  const enregistre = JSON.parse(await readFile(fichier, "utf8")) as ModeleEnregistre;
  const octets = Buffer.from(enregistre.poidsEnBase64, "base64");
  const donneesDesPoids = octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
  return tf.loadLayersModel(tf.io.fromMemory({
    modelTopology: enregistre.topologie,
    weightSpecs: enregistre.specificationsDesPoids,
    weightData: donneesDesPoids,
  }));
};
