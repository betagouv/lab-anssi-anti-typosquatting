import { describe, expect, it } from "vitest";

import {
  normaliseLUrl,
  normaliseLeNomDHote,
} from "../../src/noyau/normalisation.ts";

const domaineEnregistrable = (nomDHote: string): string | null =>
  normaliseLeNomDHote(nomDHote)?.domaineEnregistrable ?? null;

describe("La normalisation d'un nom d'hôte", () => {
  it("ramène les sous-domaines au domaine enregistrable", () => {
    expect(domaineEnregistrable("www.belley.fr")).toBe("belley.fr");
    expect(domaineEnregistrable("belley.fr")).toBe("belley.fr");
    expect(domaineEnregistrable("mairie.www.belley.fr")).toBe("belley.fr");
  });

  it("préserve les suffixes publics à plusieurs niveaux", () => {
    expect(domaineEnregistrable("www.impots.gouv.fr")).toBe("impots.gouv.fr");
    expect(domaineEnregistrable("particulier.impots.gouv.fr")).toBe(
      "impots.gouv.fr",
    );
  });

  it("met en minuscules et retire le point final", () => {
    expect(domaineEnregistrable("WWW.Belley.FR.")).toBe("belley.fr");
  });

  it("convertit les domaines accentués en punycode", () => {
    expect(domaineEnregistrable("égalité-handicap.gouv.fr")).toBe(
      "xn--galit-handicap-9jbf.gouv.fr",
    );
    expect(domaineEnregistrable("mairie-saint-lô.fr")).toBe(
      "xn--mairie-saint-l-epb.fr",
    );
  });

  it("expose l'étiquette et le suffixe séparément", () => {
    const normalise = normaliseLeNomDHote("www.impots.gouv.fr");
    expect(normalise?.etiquette).toBe("impots");
    expect(normalise?.suffixe).toBe("gouv.fr");
  });

  it("signale les domaines sous un suffixe privé", () => {
    expect(normaliseLeNomDHote("macommune.wixsite.com")?.estSousUnSuffixePrive)
      .toBe(true);
    expect(normaliseLeNomDHote("www.belley.fr")?.estSousUnSuffixePrive).toBe(
      false,
    );
  });

  it("rejette ce qui n'est pas un nom de domaine", () => {
    expect(normaliseLeNomDHote("10.0.0.1")).toBeNull();
    expect(normaliseLeNomDHote("localhost")).toBeNull();
    expect(normaliseLeNomDHote("")).toBeNull();
    expect(normaliseLeNomDHote("a b.fr")).toBeNull();
    expect(normaliseLeNomDHote("fr")).toBeNull();
  });
});

describe("La normalisation d'une URL", () => {
  it("extrait le domaine enregistrable d'une URL complète", () => {
    expect(normaliseLUrl("https://www.belley.fr/mairie?a=1")
      ?.domaineEnregistrable).toBe("belley.fr");
  });

  it("rejette une URL invalide", () => {
    expect(normaliseLUrl("pas une url")).toBeNull();
  });

  it("donne le même résultat que la normalisation du nom d'hôte", () => {
    expect(normaliseLUrl("https://WWW.Belley.FR./")).toEqual(
      normaliseLeNomDHote("www.belley.fr"),
    );
  });
});
