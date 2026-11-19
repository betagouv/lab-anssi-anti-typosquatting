import { describe, expect, it } from "vitest";

import { etalab } from "../../scripts/sources/etalab.ts";
import { litLeManifeste, verifieLeManifeste } from "../../scripts/sources/manifeste.ts";

const sourceValide = {
  id: "exemple",
  nom: "Exemple",
  url: "https://exemple.fr/donnees",
  licence: "Licence Ouverte 2.0",
  role: "legitime",
  recuperation: "snapshot",
};

describe("Le manifeste des sources", () => {
  it("est valide tel que versionné", () => {
    expect(litLeManifeste().length).toBeGreaterThan(0);
  });

  it("déclare chaque source implémentée par les scripts", () => {
    const identifiants = litLeManifeste().map((source) => source.id);
    expect(identifiants).toContain(etalab.id);
  });

  it("accepte une source complète", () => {
    expect(verifieLeManifeste([sourceValide])).toHaveLength(1);
  });

  it("refuse un manifeste vide", () => {
    expect(() => verifieLeManifeste([])).toThrow("au moins une source");
  });

  it.each(["id", "nom", "url", "licence"])("refuse une source sans « %s »", (champ) => {
    const incomplete: Record<string, string> = { ...sourceValide };
    delete incomplete[champ];
    expect(() => verifieLeManifeste([incomplete])).toThrow(champ);
  });

  it("refuse un rôle inconnu", () => {
    expect(() => verifieLeManifeste([{ ...sourceValide, role: "frauduleux" }])).toThrow("rôle inconnu");
  });

  it("refuse un mode de récupération inconnu", () => {
    expect(() => verifieLeManifeste([{ ...sourceValide, recuperation: "magie" }])).toThrow("récupération");
  });

  it("refuse une URL qui n'est pas en https", () => {
    expect(() => verifieLeManifeste([{ ...sourceValide, url: "http://exemple.fr" }])).toThrow("https");
  });

  it("refuse deux sources de même identifiant", () => {
    expect(() => verifieLeManifeste([sourceValide, sourceValide])).toThrow("uniques");
  });
});
