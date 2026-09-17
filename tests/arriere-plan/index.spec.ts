import { beforeEach, describe, expect, it, vi } from "vitest";

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

const { ecouteurs, miseAJourDeLOnglet, badge } = vi.hoisted(() => ({
  ecouteurs: [] as ((navigation: unknown) => void)[],
  miseAJourDeLOnglet: vi.fn(),
  badge: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setTitle: vi.fn(),
  },
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
    action: badge,
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
    for (const appel of Object.values(badge)) {
      appel.mockReset();
      appel.mockResolvedValue(undefined);
    }
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

  it("redirige l'onglet vers la page d'alerte sur un domaine à bloquer", () => {
    navigueVers("https://impots.gouv.fr.connexion-securisee.com/");

    expect(miseAJourDeLOnglet).toHaveBeenCalledOnce();
    const [idDeLOnglet] = miseAJourDeLOnglet.mock.calls[0] as [number];
    expect(idDeLOnglet).toBe(42);

    const parametres = pageDAlerteAffichee();
    expect(parametres?.get("domaineImite")).toBe("impots.gouv.fr");
    expect(parametres?.get("classe")).toBe("sous-domaine-trompeur");
  });

  it("se contente d'un badge sur un domaine à avertir", () => {
    navigueVers("https://belley.com/");

    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    expect(badge.setBadgeText).toHaveBeenCalledWith({ tabId: 42, text: "!" });
    expect(badge.setTitle).toHaveBeenCalledWith({
      tabId: 42,
      title: "Ce domaine ressemble à belley.fr",
    });
  });

  it("efface le badge en revenant sur un domaine sain", () => {
    navigueVers("https://lemonde.fr/");
    expect(badge.setBadgeText).toHaveBeenCalledWith({ tabId: 42, text: "" });
  });

  it("ignore les navigations d'iframe", () => {
    navigueVers("https://impots.gouv.fr.connexion-securisee.com/", 1);
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    expect(badge.setBadgeText).not.toHaveBeenCalled();
  });

  it("ignore les schémas qui ne sont pas du web", () => {
    navigueVers("about:blank");
    navigueVers("moz-extension://test/src/alerte/index.html");
    navigueVers("file:///tmp/belley.com");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("ignore les plateformes d'hébergement mutualisé", () => {
    navigueVers("https://belley.free.fr/");
    navigueVers("https://belley.wixsite.com/site");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });
});
