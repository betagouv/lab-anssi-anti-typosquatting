import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { litLaListeDeDomaines } from "../src/noyau/liste-de-domaines.ts";
import { formateLaProvenance, fusionneLesSelections, type SelectionDeSource } from "./provenance.ts";
import { selectionneLesDomainesLegitimes } from "./selection.ts";
import { adullact } from "./sources/adullact.ts";
import { dpnt } from "./sources/dpnt.ts";
import { mediametrie } from "./sources/mediametrie.ts";
import type { Source } from "./sources/types.ts";

const SOURCES: readonly Source[] = [adullact, dpnt, mediametrie];

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierGenere = join(racine, "src", "donnees", "domaines-legitimes.txt");
const fichierDeProvenance = join(racine, "donnees", "provenance-des-domaines.csv");
const fichierDesExclusions = join(racine, "src", "donnees", "domaines-exclus.txt");

const domainesExclus = new Set(
  litLaListeDeDomaines(readFileSync(fichierDesExclusions, "utf-8")),
);

const selections: SelectionDeSource[] = [];
for (const source of SOURCES) {
  const selection = selectionneLesDomainesLegitimes(
    await source.litLesNomsDHote(),
    domainesExclus,
  );
  console.log(`Source : ${source.id}`);
  console.table(selection.comptes);
  selections.push({ idDeLaSource: source.id, domaines: selection.domainesLegitimes });
}

const sourcesParDomaine = fusionneLesSelections(selections);
const domainesLegitimes = [...sourcesParDomaine.keys()].sort();

mkdirSync(dirname(fichierGenere), { recursive: true });
mkdirSync(dirname(fichierDeProvenance), { recursive: true });
writeFileSync(fichierGenere, `${domainesLegitimes.join("\n")}\n`);
writeFileSync(fichierDeProvenance, formateLaProvenance(sourcesParDomaine));

console.log(`${String(domainesLegitimes.length)} domaines au total, issus de ${String(SOURCES.length)} sources.`);
console.log(`Écrit : ${fichierGenere}`);
console.log(`Écrit : ${fichierDeProvenance}`);
