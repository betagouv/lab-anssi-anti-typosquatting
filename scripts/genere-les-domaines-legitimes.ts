import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { litLaListeDeDomaines } from "../src/noyau/liste-de-domaines.ts";
import { selectionneLesDomainesLegitimes } from "./selection.ts";
import { adullact } from "./sources/adullact.ts";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierGenere = join(racine, "src", "donnees", "domaines-legitimes.txt");
const fichierDesExclusions = join(racine, "src", "donnees", "domaines-exclus.txt");

const domainesExclus = new Set(
  litLaListeDeDomaines(readFileSync(fichierDesExclusions, "utf-8")),
);
const { domainesLegitimes, comptes } = selectionneLesDomainesLegitimes(
  await adullact.litLesNomsDHote(),
  domainesExclus,
);

mkdirSync(dirname(fichierGenere), { recursive: true });
writeFileSync(fichierGenere, `${domainesLegitimes.join("\n")}\n`);

console.table(comptes);
console.log(`Écrit : ${fichierGenere}`);
