import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { litLaListeDeDomaines } from "../src/noyau/liste-de-domaines.ts";
import { selectionneLesDomainesLegitimes } from "./selection.ts";
import { adullact } from "./sources/adullact.ts";
import { dpnt } from "./sources/dpnt.ts";
import { mediametrie } from "./sources/mediametrie.ts";
import type { Source } from "./sources/types.ts";

const SOURCES: readonly Source[] = [adullact, dpnt, mediametrie];

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierGenere = join(racine, "src", "donnees", "domaines-legitimes.txt");
const fichierDesExclusions = join(racine, "src", "donnees", "domaines-exclus.txt");

const domainesExclus = new Set(
  litLaListeDeDomaines(readFileSync(fichierDesExclusions, "utf-8")),
);

const domainesLegitimes = new Set<string>();
for (const source of SOURCES) {
  const selection = selectionneLesDomainesLegitimes(
    await source.litLesNomsDHote(),
    domainesExclus,
  );
  console.log(`Source : ${source.id}`);
  console.table(selection.comptes);
  for (const domaine of selection.domainesLegitimes) domainesLegitimes.add(domaine);
}

mkdirSync(dirname(fichierGenere), { recursive: true });
writeFileSync(fichierGenere, `${[...domainesLegitimes].sort().join("\n")}\n`);

console.log(`${String(domainesLegitimes.size)} domaines au total, issus de ${String(SOURCES.length)} sources.`);
console.log(`Écrit : ${fichierGenere}`);
