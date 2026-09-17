import { beforeEach, describe, expect, it, vi } from "vitest";

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

const { ecouteurs, miseAJourDeLOnglet } = vi.hoisted(() => ({
  ecouteurs: [] as ((navigation: unknown) => void)[],
  miseAJourDeLOnglet: vi.fn(),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: (chemin: string) => `moz-extension://test/${chemin}`,
    },
    webNavigation: {
      onBeforeNavigate: {
        addListener: (ecouteur: (navigation: unknown) => void) => {
          ecouteurs.push(ecouteur);
        },
      },
    },
    tabs: { update: miseAJourDeLOnglet },
  },
}));

await import("../../src/arriere-plan/index.ts");

const navigueVers = (url: string, frameId = 0): void => {
  const navigation: Navigation = { tabId: 42, frameId, url };
  for (const ecouteur of ecouteurs) ecouteur(navigation);
};

const pageDAlerteAffichee = (): URLSearchParams | null => {
  const dernierAppel = miseAJourDeLOnglet.mock.calls.at(-1);
  if (dernierAppel === undefined) return null;
  const [, modifications] = dernierAppel as [number, { url: string }];
  return new URL(modifications.url).searchParams;
};

describe("L'arrière-plan", () => {
  beforeEach(() => {
    miseAJourDeLOnglet.mockReset();
    miseAJourDeLOnglet.mockResolvedValue({});
  });

  it("s'abonne aux navigations avant leur chargement", () => {
    expect(ecouteurs).toHaveLength(1);
  });

  it("laisse passer un domaine légitime", () => {
    navigueVers("https://www.belley.fr/mairie");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("laisse passer un domaine hors périmètre", () => {
    navigueVers("https://lemonde.fr/");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("redirige l'onglet vers la page d'alerte sur un domaine suspect", () => {
    navigueVers("https://bellley.fr/");

    expect(miseAJourDeLOnglet).toHaveBeenCalledOnce();
    const [idDeLOnglet] = miseAJourDeLOnglet.mock.calls[0] as [number];
    expect(idDeLOnglet).toBe(42);

    const parametres = pageDAlerteAffichee();
    expect(parametres?.get("domaineVisite")).toBe("bellley.fr");
    expect(parametres?.get("domaineImite")).toBe("belley.fr");
    expect(Number(parametres?.get("score"))).toBeGreaterThan(85);
  });

  it("ignore les navigations d'iframe", () => {
    navigueVers("https://bellley.fr/", 1);
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("ignore les schémas qui ne sont pas du web", () => {
    navigueVers("about:blank");
    navigueVers("moz-extension://test/src/alerte/index.html");
    navigueVers("file:///tmp/bellley.fr");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("ignore les plateformes d'hébergement mutualisé", () => {
    navigueVers("https://bellley.free.fr/");
    navigueVers("https://bellley.wixsite.com/site");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("ramène le domaine visité à son domaine enregistrable", () => {
    navigueVers("https://www.bellley.fr/une/page?a=1");
    expect(pageDAlerteAffichee()?.get("domaineVisite")).toBe("bellley.fr");
  });
});
