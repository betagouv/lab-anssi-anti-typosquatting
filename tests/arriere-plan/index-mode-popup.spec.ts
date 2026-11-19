import { beforeEach, describe, expect, it, vi } from "vitest";

interface Navigation {
  readonly tabId: number;
  readonly frameId: number;
  readonly url: string;
}

const ONGLET = 42;
const FENETRE = 7;
const PAGE_PRECEDENTE = "https://www.service-public.fr/";

const { navigations, messages, miseAJourDeLOnglet, onglet, action, session } =
  vi.hoisted(() => ({
    navigations: [] as ((navigation: Navigation) => void)[],
    messages: [] as ((message: unknown, expediteur: unknown) => Promise<unknown>)[],
    miseAJourDeLOnglet: vi.fn(),
    onglet: { active: true, url: "" },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
      setTitle: vi.fn(),
      openPopup: vi.fn(),
    },
    session: { contenu: Object.create(null) as Record<string, unknown> },
  }));

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: (chemin: string) => `moz-extension://test/${chemin}`,
      onMessage: {
        addListener: (ecouteur: (m: unknown, e: unknown) => Promise<unknown>) => {
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
    tabs: {
      update: miseAJourDeLOnglet,
      get: (id: number) =>
        Promise.resolve({ id, windowId: FENETRE, active: onglet.active, url: onglet.url }),
    },
    action,
    storage: {
      session: {
        get: (cle: string) => Promise.resolve({ [cle]: session.contenu[cle] }),
        set: (valeurs: Record<string, unknown>) => {
          Object.assign(session.contenu, valeurs);
          return Promise.resolve();
        },
        remove: (cle: string) => {
           
          delete session.contenu[cle];
          return Promise.resolve();
        },
      },
      local: {
        get: (cle: string) => Promise.resolve({ [cle]: undefined }),
        set: () => Promise.resolve(),
      },
    },
  },
}));

vi.mock("../../src/arriere-plan/configuration.ts", () => ({ MODE_D_ALERTE: "popup" }));

await import("../../src/arriere-plan/index.ts");

const laisseLesPromessesSeResoudre = async (): Promise<void> => {
  for (let tour = 0; tour < 5; tour++) {
    await new Promise((resoud) => setTimeout(resoud, 0));
  }
};

const navigueVers = async (url: string): Promise<void> => {
  for (const ecouteur of navigations) ecouteur({ tabId: ONGLET, frameId: 0, url });
  await laisseLesPromessesSeResoudre();
};

const demandeLAlerteEnCours = async (): Promise<unknown> =>
  await messages[0]!({ type: "donne-l-alerte-en-cours", idDeLOnglet: ONGLET }, {});

const UN_SOUS_DOMAINE_TROMPEUR = "https://impots.gouv.fr.connexion-securisee.com/connexion";

describe("L'arrière-plan en mode popup", () => {
  beforeEach(() => {
    onglet.active = true;
    onglet.url = PAGE_PRECEDENTE;
    session.contenu = {};
    miseAJourDeLOnglet.mockReset();
    miseAJourDeLOnglet.mockResolvedValue({});
    for (const appel of Object.values(action)) {
      appel.mockReset();
      appel.mockResolvedValue(undefined);
    }
  });

  it("interrompt la navigation, avant toute redirection, en revenant à la page précédente", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(miseAJourDeLOnglet).toHaveBeenCalledExactlyOnceWith(ONGLET, { url: PAGE_PRECEDENTE });
    expect(action.openPopup).toHaveBeenCalledWith({ windowId: FENETRE });
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: ONGLET, text: "!" });
  });

  it("revient sur une page vierge quand il n'y avait pas de page web avant", async () => {
    onglet.url = "chrome://newtab/";
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(miseAJourDeLOnglet).toHaveBeenCalledWith(ONGLET, { url: "about:blank" });
  });

  it("transmet à la popup l'URL bloquée", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(await demandeLAlerteEnCours()).toEqual({
      urlBloquee: UN_SOUS_DOMAINE_TROMPEUR,
      urlDeRetour: PAGE_PRECEDENTE,
    });
  });

  it("garde l'alerte pendant le retour à la page précédente, puis l'oublie", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);
    await navigueVers(PAGE_PRECEDENTE);
    expect(await demandeLAlerteEnCours()).not.toBeNull();

    await navigueVers("https://lemonde.fr/");
    expect(await demandeLAlerteEnCours()).toBeNull();
  });

  it("se contente du badge quand l'onglet n'est pas actif", async () => {
    onglet.active = false;
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(miseAJourDeLOnglet).toHaveBeenCalledOnce();
    expect(action.openPopup).not.toHaveBeenCalled();
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: ONGLET, text: "!" });
  });

  it("garde le badge si le navigateur refuse d'ouvrir la popup", async () => {
    const avertissement = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    action.openPopup.mockRejectedValue(new Error("Refusé"));

    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);

    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: ONGLET, text: "!" });
    expect(avertissement).toHaveBeenCalled();
    avertissement.mockRestore();
  });

  it("n'interrompt pas un simple avertissement", async () => {
    await navigueVers("https://belley.com/");

    expect(miseAJourDeLOnglet).not.toHaveBeenCalled();
    expect(action.openPopup).not.toHaveBeenCalled();
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: ONGLET, text: "!" });
  });

  it("reprend la navigation bloquée quand l'utilisateur passe outre depuis la popup", async () => {
    await navigueVers(UN_SOUS_DOMAINE_TROMPEUR);
    miseAJourDeLOnglet.mockClear();

    await messages[0]!({
      type: "autorise-le-domaine",
      domaine: "impots.gouv.fr.connexion-securisee.com",
      idDeLOnglet: ONGLET,
    }, {});
    expect(miseAJourDeLOnglet).toHaveBeenCalledExactlyOnceWith(ONGLET, { url: UN_SOUS_DOMAINE_TROMPEUR });
  });
});
