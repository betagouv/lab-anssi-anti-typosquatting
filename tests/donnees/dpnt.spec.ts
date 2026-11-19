import { describe, expect, it } from "vitest";

import { decoupeLaLigneCsv } from "../../scripts/sources/csv.ts";
import { dpnt, litLeCsv } from "../../scripts/sources/dpnt.ts";
import { litLeManifeste } from "../../scripts/sources/manifeste.ts";

const entete = "type;siret;libelle;adresse_messagerie;site_internet;telephone";

describe("La découpe d'une ligne CSV", () => {
  it("sépare sur le séparateur demandé", () => {
    expect(decoupeLaLigneCsv("a;b;;d", ";")).toEqual(["a", "b", "", "d"]);
  });

  it("ne sépare pas à l'intérieur de guillemets", () => {
    expect(decoupeLaLigneCsv('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"]);
  });
});

describe("La lecture de la présence numérique des territoires", () => {
  it("ne garde que la colonne du site, jamais l'adresse de messagerie", () => {
    const csv = [
      entete,
      "commune;1;Aspach;mairie@gmail.com;https://www.aspach.fr/;0102",
      "commune;2;Bischheim;;http://bischheim.alsace/accueil;0304",
    ].join("\n");

    expect(litLeCsv(csv)).toEqual([
      { nomDHote: "www.aspach.fr", joignable: true },
      { nomDHote: "bischheim.alsace", joignable: true },
    ]);
  });

  it("ignore les collectivités sans site et les lignes vides", () => {
    expect(litLeCsv(`${entete}\r\ncommune;1;Sans site;;;0102\r\n\r\n`)).toEqual([]);
  });

  it("garde telle quelle une valeur qui n'est pas une URL, pour qu'elle soit comptée à la sélection", () => {
    expect(litLeCsv(`${entete}\ncommune;1;X;;pas une url;0`)).toEqual([
      { nomDHote: "pas une url", joignable: true },
    ]);
  });

  it("refuse un fichier sans colonne site_internet", () => {
    expect(() => litLeCsv("type;siret\ncommune;1")).toThrow("site_internet");
  });

  it("est déclarée dans le manifeste", () => {
    expect(litLeManifeste().map((source) => source.id)).toContain(dpnt.id);
  });
});
