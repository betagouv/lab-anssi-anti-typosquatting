import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { litLaColonneCsv } from "./csv.ts";
import { nomDHoteOuValeurBrute } from "./nom-d-hote.ts";
import type { NomDHoteCandidat, Source } from "./types.ts";

export const FICHIER_DES_MARQUES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "donnees",
  "sources",
  "mediametrie-2026-07.csv",
);

const COLONNE_DU_DOMAINE = "domaine";
const DOMAINE_SAISI_SANS_TEST_DE_JOIGNABILITE = true;

export const litLesMarques = (csv: string): NomDHoteCandidat[] =>
  litLaColonneCsv(csv, ";", COLONNE_DU_DOMAINE).map((domaine) => ({
    nomDHote: nomDHoteOuValeurBrute(domaine),
    joignable: DOMAINE_SAISI_SANS_TEST_DE_JOIGNABILITE,
  }));

export const mediametrie: Source = {
  id: "mediametrie",
  litLesNomsDHote: () => Promise.resolve(litLesMarques(readFileSync(FICHIER_DES_MARQUES, "utf-8"))),
};
