import { describe, expect, it } from "vitest";

import type { ResultatDeComparaison } from "../../src/arriere-plan/comparaison.ts";
import { presenteLeResultat } from "../../src/comparaison/presentation.ts";
import type { Verdict } from "../../src/noyau/detection.ts";

const verdict = (severite: Verdict["severite"]): Verdict => ({
  domaineImite: "impots.gouv.fr",
  classe: "sous-domaine-trompeur",
  severite,
  scoreDeSuspicion: 0.9,
});

const analyse = (regles: Verdict | null, nonVerifiable = false): ResultatDeComparaison => ({
  etat: "analyse",
  domaine: "connexion-securisee.com",
  regles,
  nonVerifiable,
  modele: null,
});

const URL_BLOQUEE = "https://impots.gouv.fr.connexion-securisee.com/";

describe("La présentation du résultat dans la popup", () => {
  it("rassure quand aucune règle ne signale le domaine", () => {
    const presentation = presenteLeResultat(analyse(null), null);
    expect(presentation.type).toBe("success");
    expect(presentation.peutNaviguerQuandMeme).toBe(false);
  });

  it("annonce qu'une vérification est impossible pour un domaine très éloigné de la liste", () => {
    const presentation = presenteLeResultat(analyse(null, true), null);
    expect(presentation.type).toBe("info");
    expect(presentation.titre).toBe("Vérification impossible");
    expect(presentation.description).toContain("connexion-securisee.com");
    expect(presentation.description).toContain("ne pouvons pas confirmer");
    expect(presentation.details).toContainEqual({ libelle: "Couverture", valeur: "Hors de notre liste" });
    expect(presentation.peutNaviguerQuandMeme).toBe(false);
  });

  it("préfère l'avertissement des règles à la vérification impossible", () => {
    const presentation = presenteLeResultat(analyse(verdict("avertissement"), true), null);
    expect(presentation.type).toBe("warning");
  });

  it("avertit sur un domaine suspect, sans proposer de passer outre", () => {
    const presentation = presenteLeResultat(analyse(verdict("avertissement")), null);
    expect(presentation.type).toBe("warning");
    expect(presentation.description).toContain("impots.gouv.fr");
    expect(presentation.peutNaviguerQuandMeme).toBe(false);
  });

  it("signale une erreur et propose de naviguer quand même après une navigation interrompue", () => {
    const presentation = presenteLeResultat(analyse(verdict("blocage")), URL_BLOQUEE);
    expect(presentation.type).toBe("error");
    expect(presentation.peutNaviguerQuandMeme).toBe(true);
    expect(presentation.details).toContainEqual({ libelle: "Adresse bloquée", valeur: URL_BLOQUEE });
    expect(presentation.details).toContainEqual({
      libelle: "Procédé",
      valeur: "Un domaine public est déguisé en sous-domaine d’un autre site.",
    });
  });

  it("ne propose pas de passer outre un blocage déjà autorisé", () => {
    expect(presenteLeResultat(analyse(verdict("blocage")), null).peutNaviguerQuandMeme).toBe(false);
  });

  it("indique quand le modèle d'essai est indisponible", () => {
    expect(presenteLeResultat(analyse(null), null).details)
      .toContainEqual({ libelle: "Modèle d’essai", valeur: "Indisponible" });
  });

  it("informe sans détail quand la page n'est pas analysable", () => {
    const presentation = presenteLeResultat({ etat: "non-analysable", domaine: null }, null);
    expect(presentation.type).toBe("info");
    expect(presentation.details).toHaveLength(0);
  });

  it("informe quand le domaine est hors périmètre", () => {
    const presentation = presenteLeResultat({ etat: "hors-perimetre", domaine: "belley.free.fr" }, null);
    expect(presentation.type).toBe("info");
  });
});
