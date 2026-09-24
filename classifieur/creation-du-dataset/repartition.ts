import { hache32 } from "./aleatoire.ts";
import { cheminsDesResultats } from "../commun/chemins.ts";
import { creeRedacteurCsv, litEnteteCsv, parcourtLeCsv } from "../commun/fichiers.ts";

export type Repartition = "entrainement" | "validation" | "test";

export const repartitionDuDomaine = (domaineSource: string): Repartition => {
  const tranche = hache32(domaineSource) % 100;
  return tranche < 70 ? "entrainement" : tranche < 85 ? "validation" : "test";
};

export const repartitLesDonnees = async (repertoire: string): Promise<Record<Repartition, number>> => {
  const chemins = cheminsDesResultats(repertoire);
  const colonnes = await litEnteteCsv(chemins.donnees);
  const redacteurs = {
    entrainement: await creeRedacteurCsv(chemins.entrainement, colonnes),
    validation: await creeRedacteurCsv(chemins.validation, colonnes),
    test: await creeRedacteurCsv(chemins.test, colonnes),
  };
  const comptes = { entrainement: 0, validation: 0, test: 0 };
  try {
    for await (const ligne of parcourtLeCsv(chemins.donnees)) {
      const domaineSource = ligne.domaine_reference_source;
      if (domaineSource === undefined || domaineSource.length === 0) {
        throw new Error("Ligne sans domaine de référence source.");
      }
      const repartition = repartitionDuDomaine(domaineSource);
      await redacteurs[repartition].ecritLigne(ligne);
      comptes[repartition]++;
    }
  } finally {
    await Promise.all(Object.values(redacteurs).map((redacteur) => redacteur.ferme()));
  }
  if (Object.values(comptes).some((nombre) => nombre === 0)) {
    throw new Error("Une répartition est vide ; augmenter --limite.");
  }
  console.log(`Répartition : entraînement=${comptes.entrainement}, validation=${comptes.validation}, test=${comptes.test}`);
  return comptes;
};
