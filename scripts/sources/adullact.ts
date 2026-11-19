import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NomDHoteCandidat, Source } from "./types.ts";

export const FICHIER_DU_SNAPSHOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "donnees",
  "snapshots",
  "adullact-urls.txt",
);

const TOUTES_LES_LIGNES_REPONDENT_EN_HTTP_200 = true;

const nomDHoteOuValeurBrute = (valeur: string): string => {
  try {
    return new URL(valeur).hostname;
  } catch {
    return valeur;
  }
};

export const litLesUrls = (contenu: string): NomDHoteCandidat[] =>
  contenu
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => ({
      nomDHote: nomDHoteOuValeurBrute(ligne),
      joignable: TOUTES_LES_LIGNES_REPONDENT_EN_HTTP_200,
    }));

export const adullact: Source = {
  id: "adullact",
  litLesNomsDHote: () => {
    if (!existsSync(FICHIER_DU_SNAPSHOT)) {
      return Promise.reject(
        new Error(
          `Snapshot absent : ${FICHIER_DU_SNAPSHOT}. Télécharger urls.txt depuis ` +
            "https://gitlab.adullact.net/dinum/noms-de-domaine-organismes-secteur-public " +
            "dans un navigateur (le dépôt bloque les scripts) puis le placer à cet endroit.",
        ),
      );
    }
    return Promise.resolve(litLesUrls(readFileSync(FICHIER_DU_SNAPSHOT, "utf-8")));
  },
};
