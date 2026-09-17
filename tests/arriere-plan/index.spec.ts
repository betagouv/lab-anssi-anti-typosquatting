import { beforeEach, describe, expect, it, vi } from "vitest";

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

const ONGLET = 42;

const { navigations, messages, miseAJourDeLOnglet, badge, stockage } = vi.hoisted(
  () => ({
    navigations: [] as ((navigation: Navigation) => void)[],
    messages: [] as ((
      message: unknown,
      expediteur: unknown,
    ) => Promise<void>)[],
    miseAJourDeLOnglet: vi.fn(),
    badge: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
      setTitle: vi.fn(),
    },
    stockage: { contenu: Object.create(null) as Record<string, unknown> },
  }),
);

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: (chemin: string) => `moz-extension://test/${chemin}`,
      onMessage: {
        addListener: (ecouteur: (m: unknown, e: unknown) => Promise<void>) => {
          messages.push(ecouteur);
        },
      },
    },
    webNavigation: {
      onBeforeNavigate: {
        addListener: (ecouteur: (navigation: Navigation) => void) => {
          navigations.push(ecouteur);
        },
      },
    },
    tabs: { update: miseAJourDeLOnglet },
    action: badge,
    storage: {
      local: {
        get: (cle: string) => Promise.resolve({ [cle]: stockage.contenu[cle] }),
        set: (valeurs: Record<string, unknown>) => {
          Object.assign(stockage.contenu, valeurs);
          return Promise.resolve();
        },
      },
    },
  },
}));

await import("../../src/arriere-plan/index.ts");

const laisseLesPromessesSeResoudre = async (): Promise<void> => {
  for (let tour = 0; tour < 5; tour++) {
    await new Promise((resoud) => setTimeout(resoud, 0));
  }
};

const navigueVers = async (url: string, frameId = 0): Promise<void> => {
  for (const ecouteur of navigations) ecouteur({ tabId: ONGLET, frameId, url });
  await laisseLesPromessesSeResoudre();
};

const demandeLAutorisation = async (domaine: string): Promise<void> => {
  for (const ecouteur of messages) {
    await ecouteur(
      { type: "autorise-le-domaine", domaine },
      { tab: { id: ONGLET } },
    );
  }
};

const pageDAlerteAffichee = (): URLSearchParams | null => {
  const dernierAppel = miseAJourDeLOnglet.mock.calls.at(-1);
  if (dernierAppel === undefined) return null;
  const [, modifications] = dernierAppel as [number, { url: string }];
  return new URL(modifications.url).searchParams;
};

const UN_SOUS_DOMAINE_TROMPEUR = "https://impots.gouv.fr.connexion-securisee.com/";

describe("L'arrière-plan", () => {
  beforeEach(() => {
    stockage.contenu = {};
    miseAJourDeLOnglet.mockReset();
    miseAJourDeLOnglet.mockResolvedValue({});
    for (const appel of Object.values(badge)) {
      appel.mockReset();
      appel.mockResolvedValue(undefined);
    }
  });

  it("s'abonne aux navigations et aux messages", () => {
    expect(navigations).toHaveLength(1);
    expect(messages).toHaveLength(1);
  });

  it("laisse passer un domaine légitime", async () => {
    await navigueVers("https://www.belley.fr/mairie");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("laisse passer un domaine hors périmètre", async () => {
    await navigueVers("https://lemonde.fr/");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("affiche la page d'alerte sur un domaine à bloquer", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(miseAJourDeLOnglet).toHaveBeenCalledOnce();
    const [idDeLOnglet] = miseAJourDeLOnglet.mock.calls[0] as [number];
    expect(idDeLOnglet).toBe(ONGLET);

    const parametres = pageDAlerteAffichee();
    expect(parametres?.get("domaineVisite")).toBe(
      "impots.gouv.fr.connexion-securisee.com",
    );
    expect(parametres?.get("domaineImite")).toBe("impots.gouv.fr");
    expect(parametres?.get("classe")).toBe("sous-domaine-trompeur");
  });

  it("se contente d'un badge sur un domaine à avertir", async () => {
    await navigueVers("https://belley.com/");

    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    expect(badge.setBadgeText).toHaveBeenCalledWith({
      tabId: ONGLET,
      text: "!",
    });
    expect(badge.setTitle).toHaveBeenCalledWith({
      tabId: ONGLET,
      title: "Ce domaine ressemble à belley.fr",
    });
  });

  it("efface le badge en revenant sur un domaine sain", async () => {
    await navigueVers("https://lemonde.fr/");
    expect(badge.setBadgeText).toHaveBeenCalledWith({ tabId: ONGLET, text: "" });
  });

  it("ignore les navigations d'iframe", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR, 1);
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    expect(badge.setBadgeText).not.toHaveBeenCalled();
  });

  it("ignore les schémas qui ne sont pas du web", async () => {
    await navigueVers("about:blank");
    await navigueVers("moz-extension://test/src/alerte/index.html");
    await navigueVers("file:///tmp/belley.com");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  it("ignore les plateformes d'hébergement mutualisé", async () => {
    await navigueVers("https://belley.free.fr/");
    await navigueVers("https://belley.wixsite.com/site");
    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
  });

  describe("quand l'utilisateur passe outre", () => {
    it("navigue vers le domaine demandé", async () => {
      await demandeLAutorisation("impots.gouv.fr.connexion-securisee.com");

      expect(miseAJourDeLOnglet).toHaveBeenCalledWith(ONGLET, {
        url: "https://impots.gouv.fr.connexion-securisee.com/",
      });
    });

    it("ne rebloque plus ce domaine, sans quoi la navigation bouclerait", async () => {
      await demandeLAutorisation("impots.gouv.fr.connexion-securisee.com");
      miseAJourDeLOnglet.mockClear();

      await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

      expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    });

    it("continue de bloquer les autres domaines", async () => {
      await demandeLAutorisation("un-autre-domaine.com");
      miseAJourDeLOnglet.mockClear();

      await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

      expect(miseAJourDeLOnglet).toHaveBeenCalledOnce();
    });

    it("ignore un message mal formé", async () => {
      for (const ecouteur of messages) {
        await ecouteur({ type: "autre" }, { tab: { id: ONGLET } });
      }
      expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    });
  });
});
