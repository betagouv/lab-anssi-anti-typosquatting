import { cheminsDesResultats } from "../commun/chemins.ts";
import { creeRedacteurCsv, ecritJson, litEnteteCsv, parcourtLeCsv } from "../commun/fichiers.ts";
import { litLaProvenance } from "../creation-du-dataset/generation.ts";
import { repartitionDuDomaine, type Repartition } from "../creation-du-dataset/repartition.ts";

type Classe = "0" | "1";
type Ligne = Record<string, string>;

const quotas: Record<Repartition, Record<Classe, number>> = {
  entrainement: { "0": 3, "1": 3 },
  validation: { "0": 1, "1": 1 },
  test: { "0": 1, "1": 1 },
};

export const choisitDixLignes = (lignes: readonly Ligne[]): Ligne[] => {
  const comptes: Record<Repartition, Record<Classe, number>> = {
    entrainement: { "0": 0, "1": 0 },
    validation: { "0": 0, "1": 0 },
    test: { "0": 0, "1": 0 },
  };
  const selection: Ligne[] = [];
  for (const ligne of lignes) {
    const domaineSource = ligne.domaine_reference_source;
    const classe = ligne.domaine_trompeur_car_trop_proche_d_un_valide;
    if (!domaineSource || (classe !== "0" && classe !== "1")) {
      throw new Error("Exemple sans domaine source ou classe valide.");
    }
    const repartition = repartitionDuDomaine(domaineSource);
    if (comptes[repartition][classe] < quotas[repartition][classe]) {
      selection.push(ligne);
      comptes[repartition][classe]++;
    }
  }
  if (selection.length !== 10) {
    throw new Error(`Impossible de sélectionner dix lignes équilibrées : ${selection.length} trouvées.`);
  }
  return selection;
};

export const reduitLeJeuADixLignes = async (repertoire: string): Promise<void> => {
  const chemins = cheminsDesResultats(repertoire);
  const colonnes = await litEnteteCsv(chemins.donnees);
  const lignes: Ligne[] = [];
  for await (const ligne of parcourtLeCsv(chemins.donnees)) lignes.push(ligne);
  const selection = choisitDixLignes(lignes);
  const redacteur = await creeRedacteurCsv(chemins.donnees, colonnes);
  try {
    for (const ligne of selection) await redacteur.ecritLigne(ligne);
  } finally {
    await redacteur.ferme();
  }
  const provenance = await litLaProvenance(repertoire);
  await ecritJson(chemins.provenance, { ...provenance, nombreDeLignes: selection.length });
};
