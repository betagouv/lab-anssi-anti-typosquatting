import browser from "webextension-polyfill";

export interface AlerteEnCours {
  readonly urlBloquee: string;
  readonly urlDeRetour: string;
}

const cle = (idDeLOnglet: number): string => `alerte-${idDeLOnglet}`;

const estUneAlerte = (valeur: unknown): valeur is AlerteEnCours => {
  if (typeof valeur !== "object" || valeur === null) return false;
  const candidat = valeur as Partial<AlerteEnCours>;
  return typeof candidat.urlBloquee === "string" && typeof candidat.urlDeRetour === "string";
};

export const alerteDeLOnglet = async (idDeLOnglet: number): Promise<AlerteEnCours | null> => {
  const stockage = await browser.storage.session.get(cle(idDeLOnglet));
  const valeur = stockage[cle(idDeLOnglet)];
  return estUneAlerte(valeur) ? valeur : null;
};

export const memoriseLAlerte = async (idDeLOnglet: number, alerte: AlerteEnCours): Promise<void> => {
  await browser.storage.session.set({ [cle(idDeLOnglet)]: alerte });
};

export const oublieLAlerte = async (idDeLOnglet: number): Promise<void> => {
  await browser.storage.session.remove(cle(idDeLOnglet));
};
