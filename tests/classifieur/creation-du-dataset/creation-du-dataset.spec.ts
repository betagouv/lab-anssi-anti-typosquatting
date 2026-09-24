import { describe, expect, it } from "vitest";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";

import { construitLigneDeCaracteristiques } from "../../../src/noyau/modele/caracteristiques.ts";
import { cheminsDesResultats } from "../../../classifieur/commun/chemins.ts";
import { empreinteDeLaListe, litLesDomaines } from "../../../classifieur/creation-du-dataset/domaines.ts";
import { creeRedacteurCsv, parcourtLeCsv } from "../../../classifieur/commun/fichiers.ts";
import { genereVariantesTrompeuses } from "../../../classifieur/creation-du-dataset/mutations.ts";
import { RechercheDeCandidats } from "../../../src/noyau/modele/recherche.ts";
import { repartitLesDonnees } from "../../../classifieur/creation-du-dataset/repartition.ts";

describe("La préparation de l'entraînement", () => {
  it("calcule la même empreinte pour les fins de ligne Windows et Unix", () => {
    expect(empreinteDeLaListe("belley.fr\r\nimpots.gouv.fr\r\n"))
      .toBe(empreinteDeLaListe("belley.fr\nimpots.gouv.fr\n"));
  });

  it("part de la liste légitime versionnée", async () => {
    const { domaines, empreinte } = await litLesDomaines();
    expect(domaines.length).toBeGreaterThan(20_000);
    expect(domaines).toContain("impots.gouv.fr");
    expect(empreinte).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reproduit les mêmes variantes avec la même graine", () => {
    const premieres = genereVariantesTrompeuses("impots.gouv.fr", 8, "20260917");
    const secondes = genereVariantesTrompeuses("impots.gouv.fr", 8, "20260917");
    expect(secondes).toEqual(premieres);
    expect(premieres.length).toBeGreaterThan(0);
    expect(premieres.every((variante) => variante.domaine !== "impots.gouv.fr")).toBe(true);
  });

  it("rapproche un exemple synthétique de sa référence et construit les caractéristiques", () => {
    const recherche = new RechercheDeCandidats(["impots.gouv.fr", "belley.fr"]);
    const candidats = recherche.trouveLesPlusProches("imp0ts.gouv.fr", 2);
    expect(candidats[0]?.reference.domaine).toBe("impots.gouv.fr");
    const ligne = construitLigneDeCaracteristiques("imp0ts.gouv.fr", candidats, {
      domaine_reference_source: "impots.gouv.fr",
      type_generation: "substitution_leet",
      classe: "typosquatting_synthetique",
      domaine_trompeur_car_trop_proche_d_un_valide: 1,
    }, 2);
    expect(ligne.candidat_1_score_suspicion).toBeGreaterThan(0.85);
    expect(ligne.reference_candidat_1).toBe("impots.gouv.fr");
  });

  it("place toutes les variantes d'un même domaine dans la même répartition", async () => {
    const repertoire = await mkdtemp(join(tmpdir(), "classifieur-"));
    const repertoireResolu = await realpath(repertoire);
    const repertoireTemporaire = await realpath(tmpdir());
    if (!repertoireResolu.startsWith(`${repertoireTemporaire}${sep}`) ||
      !basename(repertoireResolu).startsWith("classifieur-")) {
      throw new Error("Répertoire temporaire inattendu : nettoyage interrompu.");
    }
    try {
      const chemins = cheminsDesResultats(repertoire);
      const redacteur = await creeRedacteurCsv(chemins.donnees, ["domaine_reference_source", "url"]);
      try {
        for (let position = 0; position < 30; position++) {
          const domaineSource = `domaine-${position}.fr`;
          await redacteur.ecritLigne({ domaine_reference_source: domaineSource, url: `variante-a-${position}.fr` });
          await redacteur.ecritLigne({ domaine_reference_source: domaineSource, url: `variante-b-${position}.fr` });
        }
      } finally {
        await redacteur.ferme();
      }
      await repartitLesDonnees(repertoire);
      const repartitions = new Map<string, string>();
      for (const nom of ["entrainement", "validation", "test"] as const) {
        for await (const ligne of parcourtLeCsv(chemins[nom])) {
          const domaineSource = ligne.domaine_reference_source!;
          const precedente = repartitions.get(domaineSource);
          if (precedente !== undefined) expect(precedente).toBe(nom);
          repartitions.set(domaineSource, nom);
        }
      }
      expect(repartitions.size).toBe(30);
    } finally {
      await rm(repertoireResolu, { recursive: true, force: true });
    }
  });
});
