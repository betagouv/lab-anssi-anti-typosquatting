import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { litLaProvenance as litLaProvenanceDesDomaines } from "../../scripts/provenance.ts";
import { cheminsDesResultats, RACINE_DU_DEPOT } from "../commun/chemins.ts";
import { assureLeRepertoire } from "../commun/fichiers.ts";
import type { Provenance } from "../creation-du-dataset/generation.ts";

export const FICHIER_DU_REGISTRE = join(RACINE_DU_DEPOT, "classifieur", "registre", "entrainements.jsonl");
export const FICHIER_DE_PROVENANCE_DES_DOMAINES = join(RACINE_DU_DEPOT, "donnees", "provenance-des-domaines.csv");

export interface DecisionDeLivraison {
  readonly livre: boolean;
  readonly raison: string;
}

export interface EntreeDuRegistre {
  readonly date: string;
  readonly donnees: {
    readonly empreinteDeLaListe: string;
    readonly empreinteDeLaProvenance: string;
    readonly nombreDeDomaines: number;
    readonly domainesParSource: Readonly<Record<string, number>>;
  };
  readonly generation: Provenance["parametres"] & {
    readonly nombreDeDomainesSelectionnes: number;
    readonly nombreDeLignes: number;
  };
  readonly entrainement: {
    readonly lignesEntrainement: number;
    readonly epoquesDemandees: number;
    readonly meilleureEpoque: number;
    readonly meilleurePerteValidation: number;
    readonly tailleDuLot: number;
  };
  readonly modele: { readonly empreinte: string };
  readonly evaluation: {
    readonly lignesEvaluees: number;
    readonly seuil: number;
    readonly precision: number;
    readonly rappel: number;
    readonly scoreF1: number;
  };
  readonly decision: DecisionDeLivraison;
}

interface RapportDEntrainement {
  readonly epoquesDemandees: number;
  readonly tailleDuLot: number;
  readonly meilleureEpoque: number;
  readonly meilleurePerteValidation: number;
}

interface RapportDEvaluation {
  readonly empreinteModele: string;
  readonly nombreDeLignesEvaluees: number;
  readonly seuilRecommande: number;
  readonly meilleuresMesures: {
    readonly precision: number;
    readonly rappel: number;
    readonly scoreF1: number;
  };
}

interface NormalisationEnregistree {
  readonly nombreDeLignes: number;
}

export interface ParametresDeLEntree {
  readonly repertoire: string;
  readonly decision: DecisionDeLivraison;
  readonly maintenant: Date;
  readonly fichierDeProvenanceDesDomaines?: string;
}

const litLeJson = async <Type>(fichier: string): Promise<Type> =>
  JSON.parse(await readFile(fichier, "utf8")) as Type;

const empreinteDuTexte = (contenu: string): string =>
  createHash("sha256").update(contenu.replaceAll("\r\n", "\n")).digest("hex");

const compteLesDomainesParSource = (sourcesParDomaine: ReadonlyMap<string, readonly string[]>): Record<string, number> => {
  const comptes: Record<string, number> = {};
  for (const sources of sourcesParDomaine.values()) {
    for (const source of sources) comptes[source] = (comptes[source] ?? 0) + 1;
  }
  return comptes;
};

export const construitLEntree = async (parametres: ParametresDeLEntree): Promise<EntreeDuRegistre> => {
  const { repertoire, decision, maintenant } = parametres;
  const fichierDeProvenanceDesDomaines = parametres.fichierDeProvenanceDesDomaines ?? FICHIER_DE_PROVENANCE_DES_DOMAINES;
  const chemins = cheminsDesResultats(repertoire);
  const [provenance, entrainement, evaluation, normalisation, contenuDeLaProvenance] = await Promise.all([
    litLeJson<Provenance>(chemins.provenance),
    litLeJson<RapportDEntrainement>(chemins.entrainementRapport),
    litLeJson<RapportDEvaluation>(chemins.evaluation),
    litLeJson<NormalisationEnregistree>(chemins.normalisation),
    readFile(fichierDeProvenanceDesDomaines, "utf8"),
  ]);
  const sourcesParDomaine = litLaProvenanceDesDomaines(contenuDeLaProvenance);
  const { nombreDeDomainesSelectionnes, nombreDeLignes, parametres: parametresDeGeneration } = provenance;
  return {
    date: maintenant.toISOString(),
    donnees: {
      empreinteDeLaListe: provenance.empreinteSource,
      empreinteDeLaProvenance: empreinteDuTexte(contenuDeLaProvenance),
      nombreDeDomaines: provenance.nombreDeDomainesSource,
      domainesParSource: compteLesDomainesParSource(sourcesParDomaine),
    },
    generation: { ...parametresDeGeneration, nombreDeDomainesSelectionnes, nombreDeLignes },
    entrainement: {
      lignesEntrainement: normalisation.nombreDeLignes,
      epoquesDemandees: entrainement.epoquesDemandees,
      meilleureEpoque: entrainement.meilleureEpoque,
      meilleurePerteValidation: entrainement.meilleurePerteValidation,
      tailleDuLot: entrainement.tailleDuLot,
    },
    modele: { empreinte: evaluation.empreinteModele },
    evaluation: {
      lignesEvaluees: evaluation.nombreDeLignesEvaluees,
      seuil: evaluation.seuilRecommande,
      precision: evaluation.meilleuresMesures.precision,
      rappel: evaluation.meilleuresMesures.rappel,
      scoreF1: evaluation.meilleuresMesures.scoreF1,
    },
    decision,
  };
};

export const ajouteAuRegistre = async (entree: EntreeDuRegistre, fichier = FICHIER_DU_REGISTRE): Promise<void> => {
  await assureLeRepertoire(fichier);
  await appendFile(fichier, `${JSON.stringify(entree)}\n`);
};

export const litLeRegistre = async (fichier = FICHIER_DU_REGISTRE): Promise<EntreeDuRegistre[]> => {
  const contenu = await readFile(fichier, "utf8");
  return contenu
    .split(/\r?\n/)
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => JSON.parse(ligne) as EntreeDuRegistre);
};
