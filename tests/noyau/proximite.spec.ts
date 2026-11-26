import { describe, expect, it } from "vitest";

import { construisLIndexDeRecherche } from "../../src/noyau/index-de-recherche.ts";
import {
  estTresEloigneDeLaListe,
  scoreDeProximiteMaximal,
  SEUIL_DE_PROXIMITE,
} from "../../src/noyau/proximite.ts";

const indexDe = (...domaines: string[]) => construisLIndexDeRecherche(domaines);

describe("La proximité d'un domaine avec la liste", () => {
  describe("score de proximité maximal", () => {
    it("vaut 0 quand aucun domaine de la liste n'est candidat", () => {
      expect(scoreDeProximiteMaximal(indexDe("belley.fr"), "labanquep0stale.fr")).toBe(0);
    });

    it("vaut 0 quand la liste est vide", () => {
      expect(scoreDeProximiteMaximal(indexDe(), "belley.fr")).toBe(0);
    });

    it("est élevé face à un domaine voisin", () => {
      const score = scoreDeProximiteMaximal(indexDe("impots.gouv.fr"), "imp0ts.gouv.fr");
      expect(score).toBeGreaterThan(SEUIL_DE_PROXIMITE);
    });

    it("ignore le domaine lui-même", () => {
      expect(scoreDeProximiteMaximal(indexDe("belley.fr"), "belley.fr")).toBe(0);
    });
  });

  describe("très éloigné de la liste", () => {
    it("l'est quand aucun domaine de la liste n'est proche", () => {
      const index = indexDe("belley.fr", "impots.gouv.fr");
      expect(estTresEloigneDeLaListe(index, "labanquep0stale.fr")).toBe(true);
    });

    it("ne l'est pas quand un domaine de la liste est voisin", () => {
      expect(estTresEloigneDeLaListe(indexDe("impots.gouv.fr"), "imp0t.gouv.fr")).toBe(false);
    });

    it("ne l'est pas quand le domaine est dans la liste", () => {
      expect(estTresEloigneDeLaListe(indexDe("belley.fr"), "belley.fr")).toBe(false);
    });
  });
});
