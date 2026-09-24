import { describe, expect, it } from "vitest";

import { repartitionDuDomaine, type Repartition } from "../../../classifieur/creation-du-dataset/repartition.ts";
import { choisitDixLignes } from "../../../classifieur/verification/echantillon.ts";

const exemples = (): Array<Record<string, string>> => {
  const sources: Record<Repartition, string[]> = { entrainement: [], validation: [], test: [] };
  for (let position = 0; Object.values(sources).some((valeurs) => valeurs.length < 4); position++) {
    const source = `domaine-${position}.fr`;
    const repartition = repartitionDuDomaine(source);
    if (sources[repartition].length < 4) sources[repartition].push(source);
  }
  return Object.values(sources).flatMap((domaines) => domaines.flatMap((domaineSource) => ["1", "0"].map((classe) => ({
    domaine_reference_source: domaineSource,
    domaine_trompeur_car_trop_proche_d_un_valide: classe,
  }))));
};

describe("L'échantillon du contrôle CI", () => {
  it("choisit toujours dix lignes équilibrées et garde chaque source dans une seule répartition", () => {
    const lignes = exemples();
    const selection = choisitDixLignes(lignes);
    expect(choisitDixLignes(lignes)).toEqual(selection);
    expect(selection).toHaveLength(10);
    const comptes: Record<Repartition, Record<string, number>> = {
      entrainement: { "0": 0, "1": 0 },
      validation: { "0": 0, "1": 0 },
      test: { "0": 0, "1": 0 },
    };
    const repartitionsParSource = new Map<string, Repartition>();
    for (const ligne of selection) {
      const source = ligne.domaine_reference_source!;
      const repartition = repartitionDuDomaine(source);
      expect(repartitionsParSource.get(source) ?? repartition).toBe(repartition);
      repartitionsParSource.set(source, repartition);
      comptes[repartition][ligne.domaine_trompeur_car_trop_proche_d_un_valide!]!++;
    }
    expect(comptes).toEqual({
      entrainement: { "0": 3, "1": 3 },
      validation: { "0": 1, "1": 1 },
      test: { "0": 1, "1": 1 },
    });
  });

  it("refuse un échantillon incomplet", () => {
    expect(() => choisitDixLignes(exemples().slice(0, 5))).toThrow(/dix lignes équilibrées/);
  });
});
