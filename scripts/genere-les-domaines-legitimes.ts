import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { litLaListeDeDomaines } from "../src/noyau/liste-de-domaines.ts";
import { normaliseLeNomDHote } from "../src/noyau/normalisation.ts";

const URL_DU_JEU_DE_DONNEES =
  "https://raw.githubusercontent.com/etalab/noms-de-domaine-organismes-secteur-public/master/domains.csv";

const LONGUEUR_MINIMALE_DETIQUETTE = 4;

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierSource = join(racine, "donnees-sources", "domains.csv");
const fichierGenere = join(racine, "src", "donnees", "domaines-legitimes.txt");
const fichierDesExclusions = join(racine, "src", "donnees", "domaines-exclus.txt");

const decoupeLaLigneCsv = (ligne: string): string[] => {
  const champs: string[] = [];
  let champ = "";
  let dansDesGuillemets = false;

  for (const caractere of ligne) {
    if (caractere === '"') dansDesGuillemets = !dansDesGuillemets;
    else if (caractere === "," && !dansDesGuillemets) {
      champs.push(champ);
      champ = "";
    } else champ += caractere;
  }

  champs.push(champ);
  return champs;
};

const telechargeLeJeuDeDonnees = async (): Promise<string> => {
  if (existsSync(fichierSource)) {
    console.log(`Jeu de données déjà présent : ${fichierSource}`);
    return readFileSync(fichierSource, "utf-8");
  }

  console.log(`Téléchargement de ${URL_DU_JEU_DE_DONNEES}`);
  const reponse = await fetch(URL_DU_JEU_DE_DONNEES);
  if (!reponse.ok) {
    throw new Error(
      `Téléchargement impossible : ${String(reponse.status)} ${reponse.statusText}`,
    );
  }

  const contenu = await reponse.text();
  mkdirSync(dirname(fichierSource), { recursive: true });
  writeFileSync(fichierSource, contenu);
  return contenu;
};

interface DomaineDuJeuDeDonnees {
  readonly nomDHote: string;
  readonly repondEnHttp: boolean;
}

const litLeJeuDeDonnees = (csv: string): DomaineDuJeuDeDonnees[] => {
  const [entete, ...lignes] = csv.split("\n");
  if (entete === undefined) throw new Error("Jeu de données vide");

  const colonnes = decoupeLaLigneCsv(entete);
  const colonneDuNom = colonnes.indexOf("name");
  const colonneHttp = colonnes.indexOf("http_status");
  const colonneHttps = colonnes.indexOf("https_status");

  if (colonneDuNom < 0 || colonneHttp < 0 || colonneHttps < 0) {
    throw new Error(`Colonnes inattendues : ${colonnes.join(", ")}`);
  }

  const repondEnHttp = (statut: string | undefined): boolean =>
    statut !== undefined && statut.startsWith("200");

  return lignes
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => decoupeLaLigneCsv(ligne))
    .map((champs) => ({
      nomDHote: champs[colonneDuNom] ?? "",
      repondEnHttp:
        repondEnHttp(champs[colonneHttp]) || repondEnHttp(champs[colonneHttps]),
    }));
};

interface Comptes {
  lignes: number;
  injoignables: number;
  nonNormalisables: number;
  sousUnSuffixePrive: number;
  surUnePlateforme: number;
  etiquettesTropCourtes: number;
  retenus: number;
}

const selectionneLesDomainesLegitimes = (
  domaines: DomaineDuJeuDeDonnees[],
  domainesExclus: ReadonlySet<string>,
): { domainesLegitimes: string[]; comptes: Comptes } => {
  const comptes: Comptes = {
    lignes: domaines.length,
    injoignables: 0,
    nonNormalisables: 0,
    sousUnSuffixePrive: 0,
    surUnePlateforme: 0,
    etiquettesTropCourtes: 0,
    retenus: 0,
  };

  const retenus = new Set<string>();

  for (const { nomDHote, repondEnHttp } of domaines) {
    if (!repondEnHttp) {
      comptes.injoignables++;
      continue;
    }

    const normalise = normaliseLeNomDHote(nomDHote);
    if (normalise === null) {
      comptes.nonNormalisables++;
      continue;
    }

    if (normalise.estSousUnSuffixePrive) {
      comptes.sousUnSuffixePrive++;
      continue;
    }

    if (domainesExclus.has(normalise.domaineEnregistrable)) {
      comptes.surUnePlateforme++;
      continue;
    }

    if (normalise.etiquette.length < LONGUEUR_MINIMALE_DETIQUETTE) {
      comptes.etiquettesTropCourtes++;
      continue;
    }

    retenus.add(normalise.domaineEnregistrable);
  }

  comptes.retenus = retenus.size;
  return { domainesLegitimes: [...retenus].sort(), comptes };
};

const csv = await telechargeLeJeuDeDonnees();
const domainesExclus = new Set(
  litLaListeDeDomaines(readFileSync(fichierDesExclusions, "utf-8")),
);
const { domainesLegitimes, comptes } = selectionneLesDomainesLegitimes(
  litLeJeuDeDonnees(csv),
  domainesExclus,
);

mkdirSync(dirname(fichierGenere), { recursive: true });
writeFileSync(fichierGenere, `${domainesLegitimes.join("\n")}\n`);

console.table(comptes);
console.log(`Écrit : ${fichierGenere}`);
