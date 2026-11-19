import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { adullact, litLesUrls } from "../../scripts/sources/adullact.ts";
import { litLeManifeste, verifieLeManifeste } from "../../scripts/sources/manifeste.ts";

const sourceValide = {
  id: "exemple",
  nom: "Exemple",
  url: "https://exemple.fr/donnees",
  licence: "Licence Ouverte 2.0",
  role: "legitime",
  recuperation: "snapshot",
  recupereLe: "2026-11-19",
  fichier: "donnees/snapshots/exemple.txt",
};

describe("Le manifeste des sources", () => {
  it("est valide tel que versionné", () => {
    expect(litLeManifeste().length).toBeGreaterThan(0);
  });

  it("déclare chaque source implémentée par les scripts", () => {
    const identifiants = litLeManifeste().map((source) => source.id);
    expect(identifiants).toContain(adullact.id);
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

  it.each(["recupereLe", "fichier"])("refuse un snapshot sans « %s »", (champ) => {
    const incomplete: Record<string, string> = { ...sourceValide };
    delete incomplete[champ];
    expect(() => verifieLeManifeste([incomplete])).toThrow(champ);
  });

  it("refuse une date de récupération mal formée", () => {
    expect(() => verifieLeManifeste([{ ...sourceValide, recupereLe: "19/11/2026" }])).toThrow("recupereLe");
  });

  it("référence des fichiers de snapshot qui existent", () => {
    for (const source of litLeManifeste().filter(({ recuperation }) => recuperation === "snapshot")) {
      expect(existsSync(new URL(`../../${source.fichier ?? ""}`, import.meta.url))).toBe(true);
    }
  });
});

describe("La lecture du snapshot Adullact", () => {
  it("extrait le nom d'hôte de chaque URL et ignore les lignes vides", () => {
    expect(litLesUrls("http://a.alsace\r\n\r\nhttps://www.b.fr\n")).toEqual([
      { nomDHote: "a.alsace", joignable: true },
      { nomDHote: "www.b.fr", joignable: true },
    ]);
  });

  it("garde telle quelle une ligne qui n'est pas une URL, pour qu'elle soit comptée à la sélection", () => {
    expect(litLesUrls("pas une url")).toEqual([{ nomDHote: "pas une url", joignable: true }]);
  });
});
