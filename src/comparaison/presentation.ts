import type { ResultatDeComparaison } from "../arriere-plan/comparaison.ts";
import { MOTIFS } from "../commun/motifs.ts";
import type { PredictionDuModele } from "../noyau/modele/prediction.ts";

export type TypeDAlerte = "info" | "success" | "warning" | "error";

export interface Detail {
  readonly libelle: string;
  readonly valeur: string;
}

export interface Presentation {
  readonly type: TypeDAlerte;
  readonly titre: string;
  readonly description: string;
  readonly details: readonly Detail[];
  readonly peutNaviguerQuandMeme: boolean;
}

const pourcentage = (valeur: number): string => `${(valeur * 100).toFixed(1)} %`;

const detailsDuModele = (prediction: PredictionDuModele | null): Detail[] => {
  if (prediction === null) {
    return [{ libelle: "Modèle d’essai", valeur: "Indisponible" }];
  }
  if (prediction.correspondanceExacte) {
    return [{ libelle: "Modèle d’essai", valeur: "Domaine présent dans la liste légitime" }];
  }
  return [
    {
      libelle: "Modèle d’essai",
      valeur: prediction.decision === "suspect" ? "Signalé" : "Non signalé",
    },
    { libelle: "Score du modèle", valeur: pourcentage(prediction.score) },
    { libelle: "Seuil du modèle", valeur: pourcentage(prediction.seuil) },
    { libelle: "Domaine le plus proche", valeur: prediction.domaineProche ?? "Aucun" },
  ];
};

export const presentationDIndisponibilite: Presentation = {
  type: "info",
  titre: "Analyse indisponible",
  description: "L’analyse de cet onglet n’a pas pu aboutir.",
  details: [],
  peutNaviguerQuandMeme: false,
};

export const presenteLeResultat = (
  resultat: ResultatDeComparaison,
  urlBloquee: string | null,
): Presentation => {
  if (resultat.etat === "non-analysable") {
    return {
      type: "info",
      titre: "Page non analysée",
      description: "Cet onglet n’affiche pas de site web analysable.",
      details: [],
      peutNaviguerQuandMeme: false,
    };
  }

  const domaine: Detail = { libelle: "Domaine analysé", valeur: resultat.domaine };

  if (resultat.etat === "hors-perimetre") {
    return {
      type: "info",
      titre: "Domaine non analysé",
      description: `${resultat.domaine} est hors du périmètre de l’analyse.`,
      details: [domaine],
      peutNaviguerQuandMeme: false,
    };
  }

  const verdict = resultat.regles;
  const navigationInterrompue: Detail[] = urlBloquee === null
    ? []
    : [{ libelle: "Adresse bloquée", valeur: urlBloquee }];
  const modele = detailsDuModele(resultat.modele);

  if (verdict === null && resultat.nonVerifiable) {
    return {
      type: "info",
      titre: "Vérification impossible",
      description: `${resultat.domaine} ne fait pas partie des sites publics que nous observons et ne ressemble à aucun d’eux : nous ne pouvons pas confirmer qu’il est légitime. Ce n’est ni un signe de danger, ni une garantie.`,
      details: [
        domaine,
        { libelle: "Règles", valeur: "Aucune alerte" },
        { libelle: "Couverture", valeur: "Hors de notre liste" },
        ...modele,
      ],
      peutNaviguerQuandMeme: false,
    };
  }

  if (verdict === null) {
    return {
      type: "success",
      titre: "Aucune imitation détectée",
      description: `${resultat.domaine} n’imite aucun site public de notre liste.`,
      details: [domaine, { libelle: "Règles", valeur: "Aucune alerte" }, ...modele],
      peutNaviguerQuandMeme: false,
    };
  }

  const estBloque = verdict.severite === "blocage";
  const detailsDesRegles: Detail[] = [
    { libelle: "Règles", valeur: estBloque ? "Blocage" : "Avertissement" },
    { libelle: "Site imité", valeur: verdict.domaineImite },
    { libelle: "Procédé", valeur: MOTIFS[verdict.classe] ?? verdict.classe },
    { libelle: "Score de proximité", valeur: pourcentage(verdict.scoreDeSuspicion) },
  ];

  if (!estBloque) {
    return {
      type: "warning",
      titre: "Domaine suspect",
      description: `${resultat.domaine} ressemble à ${verdict.domaineImite}. Vérifiez l’adresse avant de saisir des informations.`,
      details: [domaine, ...detailsDesRegles, ...modele],
      peutNaviguerQuandMeme: false,
    };
  }

  return {
    type: "error",
    titre: "Site potentiellement frauduleux",
    description: urlBloquee === null
      ? `${resultat.domaine} imite ${verdict.domaineImite}.`
      : `${resultat.domaine} imite ${verdict.domaineImite}. La navigation a été interrompue.`,
    details: [domaine, ...navigationInterrompue, ...detailsDesRegles, ...modele],
    peutNaviguerQuandMeme: urlBloquee !== null,
  };
};
