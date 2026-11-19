import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cheminsDesResultats } from "../../../classifieur/commun/chemins.ts";
import { ecritJson } from "../../../classifieur/commun/fichiers.ts";
import {
  ajouteAuRegistre,
  construitLEntree,
  litLeRegistre,
  type DecisionDeLivraison,
} from "../../../classifieur/registre/registre.ts";

const maintenant = new Date("2026-11-19T10:30:00.000Z");
const decision: DecisionDeLivraison = { livre: true, raison: "F1 au moins égal à celui du modèle livré" };

let dossier: string;
let fichierDeProvenanceDesDomaines: string;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), "registre-"));
  const chemins = cheminsDesResultats(join(dossier, "resultats"));
  await ecritJson(chemins.provenance, {
    empreinteSource: "empreinte-de-la-liste",
    nombreDeDomainesSource: 3,
    nombreDeDomainesSelectionnes: 2,
    nombreDeLignes: 20,
    parametres: { graine: "1", limite: 2, imitationsParDomaine: 4 },
  });
  await ecritJson(chemins.entrainementRapport, {
    epoquesDemandees: 12,
    tailleDuLot: 256,
    meilleureEpoque: 9,
    meilleurePerteValidation: 0.02,
  });
  await ecritJson(chemins.evaluation, {
    empreinteModele: "empreinte-du-modele",
    nombreDeLignesEvaluees: 5,
    seuilRecommande: 0.4,
    meilleuresMesures: { precision: 0.9, rappel: 0.8, scoreF1: 0.85 },
  });
  await ecritJson(chemins.normalisation, { nombreDeLignes: 14 });
  fichierDeProvenanceDesDomaines = join(dossier, "provenance.csv");
  await writeFile(fichierDeProvenanceDesDomaines, "domaine;sources\na.fr;x\nb.fr;x|y\nc.fr;y\n");
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const entree = () =>
  construitLEntree({
    repertoire: join(dossier, "resultats"),
    decision,
    maintenant,
    fichierDeProvenanceDesDomaines,
  });

describe("L'entrée du registre", () => {
  it("rassemble ce sur quoi, quand et avec quelles performances le modèle a été entraîné", async () => {
    expect(await entree()).toMatchObject({
      date: "2026-11-19T10:30:00.000Z",
      donnees: { empreinteDeLaListe: "empreinte-de-la-liste", nombreDeDomaines: 3 },
      generation: { graine: "1", nombreDeLignes: 20, nombreDeDomainesSelectionnes: 2 },
      entrainement: { lignesEntrainement: 14, epoquesDemandees: 12, meilleureEpoque: 9 },
      modele: { empreinte: "empreinte-du-modele" },
      evaluation: { lignesEvaluees: 5, seuil: 0.4, precision: 0.9, rappel: 0.8, scoreF1: 0.85 },
      decision,
    });
  });

  it("compte les domaines fournis par chaque source", async () => {
    expect((await entree()).donnees.domainesParSource).toEqual({ x: 2, y: 2 });
  });

  it("empreint le fichier de provenance sans tenir compte des fins de ligne", async () => {
    const empreinteLf = (await entree()).donnees.empreinteDeLaProvenance;
    await writeFile(fichierDeProvenanceDesDomaines, "domaine;sources\r\na.fr;x\r\nb.fr;x|y\r\nc.fr;y\r\n");
    expect((await entree()).donnees.empreinteDeLaProvenance).toBe(empreinteLf);
  });

  it("échoue si un rapport manque plutôt que d'enregistrer une entrée incomplète", async () => {
    await rm(cheminsDesResultats(join(dossier, "resultats")).evaluation);
    await expect(entree()).rejects.toThrow();
  });
});

describe("Le registre", () => {
  it("ajoute une ligne JSON par entraînement sans toucher aux précédentes", async () => {
    const fichier = join(dossier, "registre", "entrainements.jsonl");
    const premiere = await entree();
    const seconde = { ...premiere, decision: { livre: false, raison: "F1 inférieur au modèle livré" } };

    await ajouteAuRegistre(premiere, fichier);
    await ajouteAuRegistre(seconde, fichier);

    expect((await readFile(fichier, "utf8")).split("\n").filter(Boolean)).toHaveLength(2);
    expect(await litLeRegistre(fichier)).toEqual([premiere, seconde]);
  });
});
