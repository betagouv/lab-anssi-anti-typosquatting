import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NomDHoteCandidat, Source } from "./types.ts";

const URL_DU_JEU_DE_DONNEES =
  "https://raw.githubusercontent.com/etalab/noms-de-domaine-organismes-secteur-public/master/domains.csv";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fichierSource = join(racine, "donnees-sources", "domains.csv");

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

const litLeJeuDeDonnees = (csv: string): NomDHoteCandidat[] => {
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
      joignable:
        repondEnHttp(champs[colonneHttp]) || repondEnHttp(champs[colonneHttps]),
    }));
};

export const etalab: Source = {
  id: "etalab",
  litLesNomsDHote: async () => litLeJeuDeDonnees(await telechargeLeJeuDeDonnees()),
};
