import browser from "webextension-polyfill";

import type { Verdict } from "../noyau/detection.ts";

export type EtatDeLOnglet =
  | { readonly niveau: "neutre" }
  | { readonly niveau: "sain" }
  | { readonly niveau: "non-verifiable" }
  | { readonly niveau: "suspicion" | "alerte"; readonly domaineImite: string };

export const ETAT_NEUTRE: EtatDeLOnglet = { niveau: "neutre" };
export const ETAT_SAIN: EtatDeLOnglet = { niveau: "sain" };
export const ETAT_NON_VERIFIABLE: EtatDeLOnglet = { niveau: "non-verifiable" };

const GRAVITE = { neutre: 0, sain: 1, "non-verifiable": 2, suspicion: 3, alerte: 4 } as const;

const ROUGE_ERREUR_DSFR = "#CE0500";
const TITRE_PAR_DEFAUT = "Détection de typosquatting";
const TAILLES_DES_ICONES = [16, 32, 48, 128] as const;

const icones = (dossier: string): Record<number, string> =>
  Object.fromEntries(TAILLES_DES_ICONES.map((taille) => [taille, `${dossier}/${taille}.png`]));

const DOSSIER_DES_ICONES = {
  neutre: "/icone",
  sain: "/icone/sain",
  "non-verifiable": "/icone",
  suspicion: "/icone/suspicion",
  alerte: "/icone/alerte",
} as const;

export const etatDuVerdict = (
  verdict: Verdict | null,
  nonVerifiable: boolean,
): EtatDeLOnglet => {
  if (verdict === null) return nonVerifiable ? ETAT_NON_VERIFIABLE : ETAT_SAIN;
  return {
    niveau: verdict.severite === "blocage" ? "alerte" : "suspicion",
    domaineImite: verdict.domaineImite,
  };
};

export const lePlusGrave = (premier: EtatDeLOnglet, second: EtatDeLOnglet): EtatDeLOnglet =>
  GRAVITE[second.niveau] > GRAVITE[premier.niveau] ? second : premier;

const titreDeLEtat = (etat: EtatDeLOnglet): string => {
  if (etat.niveau === "suspicion" || etat.niveau === "alerte") {
    return `Ce domaine ressemble à ${etat.domaineImite}`;
  }
  if (etat.niveau === "sain") return "Aucune imitation détectée";
  if (etat.niveau === "non-verifiable") return "Domaine hors de notre liste : vérification impossible";
  return TITRE_PAR_DEFAUT;
};

export const afficheLEtat = async (idDeLOnglet: number, etat: EtatDeLOnglet): Promise<void> => {
  const estUneAlerte = etat.niveau === "alerte";
  await Promise.all([
    browser.action.setIcon({ tabId: idDeLOnglet, path: icones(DOSSIER_DES_ICONES[etat.niveau]) }),
    browser.action.setBadgeText({ tabId: idDeLOnglet, text: estUneAlerte ? "!" : "" }),
    estUneAlerte
      ? browser.action.setBadgeBackgroundColor({ tabId: idDeLOnglet, color: ROUGE_ERREUR_DSFR })
      : Promise.resolve(),
    browser.action.setTitle({ tabId: idDeLOnglet, title: titreDeLEtat(etat) }),
  ]);
};
