import browser from "webextension-polyfill";

const CLE_DE_STOCKAGE = "exceptions";
const DUREE_DUNE_EXCEPTION = 24 * 60 * 60 * 1000;

type ExceptionsStockees = Record<string, number>;

const sontDesExceptions = (valeur: unknown): valeur is ExceptionsStockees =>
  typeof valeur === "object" &&
  valeur !== null &&
  Object.values(valeur).every((expiration) => typeof expiration === "number");

const sansLesExpirees = (
  exceptions: ExceptionsStockees,
  maintenant: number,
): ExceptionsStockees =>
  Object.fromEntries(
    Object.entries(exceptions).filter(
      ([, expiration]) => expiration > maintenant,
    ),
  );

const litLesExceptions = async (): Promise<ExceptionsStockees> => {
  try {
    const stockage = await browser.storage.local.get(CLE_DE_STOCKAGE);
    const valeur = stockage[CLE_DE_STOCKAGE];
    return sontDesExceptions(valeur) ? valeur : {};
  } catch {
    return {};
  }
};

export const domainesAutorises = async (): Promise<ReadonlySet<string>> => {
  const exceptions = await litLesExceptions();
  return new Set(Object.keys(sansLesExpirees(exceptions, Date.now())));
};

export const autoriseLeDomaine = async (domaine: string): Promise<void> => {
  const maintenant = Date.now();
  const exceptions = sansLesExpirees(await litLesExceptions(), maintenant);
  exceptions[domaine] = maintenant + DUREE_DUNE_EXCEPTION;

  await browser.storage.local.set({ [CLE_DE_STOCKAGE]: exceptions });
};
