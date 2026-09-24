import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { litLaListeDeDomaines } from "../../src/noyau/liste-de-domaines.ts";
import { FICHIER_DES_DOMAINES } from "../commun/chemins.ts";

export const empreinteDeLaListe = (contenu: string): string =>
  createHash("sha256").update(contenu.replaceAll("\r\n", "\n")).digest("hex");

export const litLesDomaines = async (): Promise<{
  domaines: string[];
  empreinte: string;
}> => {
  const contenu = await readFile(FICHIER_DES_DOMAINES, "utf8");
  const domaines = litLaListeDeDomaines(contenu);
  if (domaines.length === 0) throw new Error("La liste des domaines légitimes est vide.");
  return {
    domaines,
    empreinte: empreinteDeLaListe(contenu),
  };
};
