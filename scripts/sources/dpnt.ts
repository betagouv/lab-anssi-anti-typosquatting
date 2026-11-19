import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { decoupeLaLigneCsv } from "./csv.ts";
import { nomDHoteOuValeurBrute } from "./nom-d-hote.ts";
import { executeAvecReessais } from "./reessais.ts";
import type { NomDHoteCandidat, Source } from "./types.ts";

const URL_STABLE_VERS_LA_PUBLICATION_DU_JOUR =
  "https://www.data.gouv.fr/api/1/datasets/r/551a41a5-4ac7-40df-99cb-930aedb3c3ac";

const COLONNE_DU_SITE = "site_internet";
const SITE_DECLARE_SANS_TEST_DE_JOIGNABILITE = true;

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fichierTelecharge = join(racine, "donnees-sources", "dpnt-quotidien.csv.gz");

const OPTIONS_DE_REESSAIS = {
  tentatives: 4,
  delaiEntreTentativesEnMs: 2000,
  auraEchec: (erreur: unknown, tentative: number): void => {
    console.warn(`Tentative ${String(tentative)} échouée (${String(erreur)}), nouvelle tentative.`);
  },
};

const telechargeUneFois = async (): Promise<Buffer> => {
  const reponse = await fetch(URL_STABLE_VERS_LA_PUBLICATION_DU_JOUR);
  if (!reponse.ok) {
    throw new Error(
      `Téléchargement impossible : ${String(reponse.status)} ${reponse.statusText}`,
    );
  }
  return Buffer.from(await reponse.arrayBuffer());
};

const telecharge = async (): Promise<Buffer> => {
  if (existsSync(fichierTelecharge)) {
    console.log(`Jeu de données déjà présent : ${fichierTelecharge}`);
    return readFileSync(fichierTelecharge);
  }

  console.log(`Téléchargement de ${URL_STABLE_VERS_LA_PUBLICATION_DU_JOUR}`);
  const contenu = await executeAvecReessais(telechargeUneFois, OPTIONS_DE_REESSAIS);
  mkdirSync(dirname(fichierTelecharge), { recursive: true });
  writeFileSync(fichierTelecharge, contenu);
  return contenu;
};

export const litLeCsv = (csv: string): NomDHoteCandidat[] => {
  const [entete, ...lignes] = csv.split(/\r?\n/);
  if (entete === undefined) throw new Error("Jeu de données vide");

  const colonne = decoupeLaLigneCsv(entete, ";").indexOf(COLONNE_DU_SITE);
  if (colonne < 0) {
    throw new Error(`Colonne « ${COLONNE_DU_SITE} » absente de l'en-tête : ${entete}`);
  }

  return lignes
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => (decoupeLaLigneCsv(ligne, ";")[colonne] ?? "").trim())
    .filter((site) => site.length > 0)
    .map((site) => ({
      nomDHote: nomDHoteOuValeurBrute(site),
      joignable: SITE_DECLARE_SANS_TEST_DE_JOIGNABILITE,
    }));
};

export const dpnt: Source = {
  id: "dpnt",
  litLesNomsDHote: async () => litLeCsv(gunzipSync(await telecharge()).toString("utf-8")),
};
