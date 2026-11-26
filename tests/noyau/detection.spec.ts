import { describe, expect, it } from "vitest";

import { analyseLUrl, estNonVerifiable } from "../../src/noyau/detection.ts";
import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";

const SANS_EXCLUSION = new Set<string>();

const analyse = (
  domainesLegitimes: string[],
  url: string,
  domainesExclus = SANS_EXCLUSION,
) => analyseLUrl(construisLIndexDeRecherche(domainesLegitimes), domainesExclus, url);

describe("L'analyse d'une URL", () => {
  it("ne signale rien quand le domaine visité est lui-même légitime", () => {
    expect(analyse(["belley.fr"], "https://www.belley.fr/mairie")).toBeNull();
  });

  it("ne signale rien pour un domaine sans rapport", () => {
    expect(analyse(["belley.fr"], "https://lemonde.fr/")).toBeNull();
  });

  it("ne signale rien pour une URL invalide", () => {
    expect(analyse(["belley.fr"], "pas une url")).toBeNull();
  });

  it("ne signale rien hors des schémas web", () => {
    expect(analyse(["belley.fr"], "about:blank")).toBeNull();
    expect(analyse(["belley.fr"], "file:///tmp/bellley.fr")).toBeNull();
  });

  it("ne signale rien sous un suffixe privé", () => {
    expect(analyse(["belley.fr"], "https://belley.wixsite.com/site")).toBeNull();
  });

  it("ne signale rien pour un domaine explicitement exclu", () => {
    const exclus = new Set(["belley-officiel.xyz"]);
    expect(
      analyse(["belley.fr"], "https://belley-officiel.xyz/", exclus),
    ).toBeNull();
  });

  it("ramène le domaine visité à son domaine enregistrable", () => {
    expect(analyse(["belley.fr"], "https://mairie.belley.fr/")).toBeNull();
  });

  describe("sur un sous-domaine trompeur", () => {
    it("bloque quand un domaine légitime est déguisé en sous-domaine", () => {
      const verdict = analyse(["impots.gouv.fr"], "https://impots.gouv.fr.connexion.com/");
      expect(verdict?.severite).toBe("blocage");
      expect(verdict?.classe).toBe("sous-domaine-trompeur");
      expect(verdict?.domaineImite).toBe("impots.gouv.fr");
    });
  });

  describe("sur un homoglyphe", () => {
    it("bloque un caractère cyrillique déguisé en latin", () => {
      const verdict = analyse(["belley.fr"], "https://bеlley.fr/");
      expect(verdict?.severite).toBe("blocage");
      expect(verdict?.classe).toBe("homoglyphe");
      expect(verdict?.domaineImite).toBe("belley.fr");
    });

    it("bloque un zéro déguisé en o", () => {
      const verdict = analyse(["impots.gouv.fr"], "https://impots.g0uv.fr/");
      expect(verdict?.severite).toBe("blocage");
      expect(verdict?.domaineImite).toBe("impots.gouv.fr");
    });

    it("bloque un rn déguisé en m", () => {
      expect(analyse(["ameli.fr"], "https://arneli.fr/")?.classe).toBe(
        "homoglyphe",
      );
    });

    it("ne bloque pas une graphie accentuée légitime", () => {
      const verdict = analyse(["mairie-luce.fr"], "https://mairie-lucé.fr/");
      expect(verdict?.severite).not.toBe("blocage");
    });
  });

  describe("sur une permutation de TLD", () => {
    it("avertit seulement entre extensions de confiance", () => {
      const verdict = analyse(["belley.fr"], "https://belley.com/");
      expect(verdict?.severite).toBe("avertissement");
      expect(verdict?.classe).toBe("permutation-de-tld");
    });

    it("bloque l'usurpation d'un domaine institutionnel", () => {
      const verdict = analyse(["impots.gouv.fr"], "https://impots.com/");
      expect(verdict?.severite).toBe("blocage");
    });

    it("bloque sous une extension à risque", () => {
      expect(analyse(["belley.fr"], "https://belley.xyz/")?.severite).toBe(
        "blocage",
      );
    });

    it("reconnaît un suffixe absorbé dans l'étiquette", () => {
      expect(analyse(["ameli.fr"], "https://ameli-fr.com/")?.classe).toBe(
        "permutation-de-tld",
      );
    });
  });

  describe("sur un combosquat", () => {
    it("exige un mot d'hameçonnage en plus du nom imité", () => {
      expect(analyse(["belley.fr"], "https://belley-tourisme.com/")).toBeNull();
      expect(
        analyse(["belley.fr"], "https://mairie-belley-officiel.xyz/")?.classe,
      ).toBe("combosquat");
    });

    it("désigne le nom imité plutôt qu'un mot générique", () => {
      const verdict = analyse(
        ["belley.fr", "mairie.com"],
        "https://mairie-belley-officiel.xyz/",
      );
      expect(verdict?.domaineImite).toBe("belley.fr");
    });
  });

  describe("sur une manipulation de séparateurs", () => {
    it("avertit sans bloquer, les graphies multiples étant courantes", () => {
      const verdict = analyse(
        ["agglo-saint-nazaire.fr"],
        "https://agglosaintnazaire.fr/",
      );
      expect(verdict?.severite).toBe("avertissement");
      expect(verdict?.classe).toBe("separateur");
    });
  });

  describe("sur une faute de frappe", () => {
    it("avertit sur un nom suffisamment long", () => {
      const verdict = analyse(
        ["service-public.fr"],
        "https://service-publlic.fr/",
      );
      expect(verdict?.severite).toBe("avertissement");
      expect(verdict?.classe).toBe("distance-d-edition");
    });

    it("se tait sur un nom trop court pour être discriminant", () => {
      expect(analyse(["belley.fr"], "https://bellry.fr/")).toBeNull();
    });
  });
});

describe("La vérification impossible d'une URL", () => {
  const LISTE = ["belley.fr", "impots.gouv.fr"];

  const nonVerifiable = (
    url: string,
    domainesExclus = SANS_EXCLUSION,
    domainesLegitimes = LISTE,
  ) => estNonVerifiable(construisLIndexDeRecherche(domainesLegitimes), domainesExclus, url);

  it("l'est pour un domaine très éloigné de la liste", () => {
    expect(nonVerifiable("https://www.labanquep0stale.fr/")).toBe(true);
  });

  it("ne l'est pas pour un domaine de la liste", () => {
    expect(nonVerifiable("https://www.belley.fr/mairie")).toBe(false);
  });

  it("ne l'est pas pour un domaine proche d'un domaine de la liste", () => {
    expect(nonVerifiable("https://imp0t.gouv.fr/")).toBe(false);
  });

  it("ne l'est pas pour un domaine signalé par les règles", () => {
    expect(nonVerifiable("https://impots.gouv.fr.connexion.com/")).toBe(false);
  });

  it("ne l'est pas sous un suffixe privé", () => {
    expect(nonVerifiable("https://labanquepostale.wixsite.com/site")).toBe(false);
  });

  it("ne l'est pas pour un domaine explicitement exclu", () => {
    expect(nonVerifiable("https://labanquepostale.fr/", new Set(["labanquepostale.fr"]))).toBe(false);
  });

  it("ne l'est pas pour une URL invalide ou hors du web", () => {
    expect(nonVerifiable("pas une url")).toBe(false);
    expect(nonVerifiable("about:blank")).toBe(false);
  });
});
