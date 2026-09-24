import { describe, expect, it } from "vitest";

import { retrouveLUrlAAnalyser } from "../../src/comparaison/url-de-comparaison.ts";

describe("La fenêtre de comparaison", () => {
  it("retrouve le domaine initial après un interstitiel", () => {
    const alerte = "chrome-extension://test/src/alerte/index.html";
    expect(retrouveLUrlAAnalyser(
      `${alerte}?domaineVisite=impots.gouv.fr.connexion-securisee.com`, alerte,
    )).toBe("https://impots.gouv.fr.connexion-securisee.com/");
    expect(retrouveLUrlAAnalyser("https://belley.fr/", alerte)).toBe("https://belley.fr/");
    expect(retrouveLUrlAAnalyser(alerte, alerte)).toBeNull();
  });
});
