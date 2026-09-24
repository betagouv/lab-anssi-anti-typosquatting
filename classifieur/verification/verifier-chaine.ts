import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";

import { cheminsDesResultats } from "../commun/chemins.ts";
import { parcourtLeCsv } from "../commun/fichiers.ts";
import { genereLesDonnees } from "../creation-du-dataset/generation.ts";
import { repartitLesDonnees } from "../creation-du-dataset/repartition.ts";
import { entraineLeModele } from "../entrainement/entrainement.ts";
import { calculeLaNormalisation } from "../entrainement/normalisation.ts";
import { evalueLeModele } from "../evaluation/evaluation.ts";
import { preditLeDomaine } from "../inference/prediction.ts";
import { reduitLeJeuADixLignes } from "./echantillon.ts";

const repertoire = await mkdtemp(join(tmpdir(), "classifieur-ci-"));
const repertoireResolu = await realpath(repertoire);
const repertoireTemporaire = await realpath(tmpdir());
if (!repertoireResolu.startsWith(`${repertoireTemporaire}${sep}`) ||
  !basename(repertoireResolu).startsWith("classifieur-ci-")) {
  throw new Error("Répertoire temporaire inattendu : nettoyage interrompu.");
}

try {
  await genereLesDonnees({
    repertoire,
    graine: "20260917",
    limite: 100,
    imitationsParDomaine: 4,
    intermediairesParDomaine: 4,
    distantsParDomaine: 2,
    scoreMinimumImitation: 0.85,
    scoreMinimumIntermediaire: 0.55,
    scoreMaximumIntermediaire: 0.8,
  });
  await reduitLeJeuADixLignes(repertoire);
  const chemins = cheminsDesResultats(repertoire);
  let nombreDeLignes = 0;
  for await (const ligne of parcourtLeCsv(chemins.donnees)) {
    assert.ok(ligne.domaine_reference_source);
    nombreDeLignes++;
  }
  assert.equal(nombreDeLignes, 10);

  const comptes = await repartitLesDonnees(repertoire);
  assert.deepEqual(comptes, { entrainement: 6, validation: 2, test: 2 });
  for (const [repartition, attendu] of Object.entries(comptes)) {
    const classes = new Set<string>();
    for await (const ligne of parcourtLeCsv(chemins[repartition as keyof typeof comptes])) {
      classes.add(ligne.domaine_trompeur_car_trop_proche_d_un_valide ?? "");
    }
    assert.deepEqual(classes, new Set(["0", "1"]));
    assert.ok(attendu > 0);
  }

  await calculeLaNormalisation(repertoire);
  await entraineLeModele({ repertoire, epoques: 1, tailleDuLot: 2 });
  await evalueLeModele(repertoire);
  const evaluation = JSON.parse(await readFile(chemins.evaluation, "utf8")) as {
    nombreDeLignesEvaluees: number;
    seuilRecommande: number;
  };
  assert.equal(evaluation.nombreDeLignesEvaluees, 2);
  assert.ok(Number.isFinite(evaluation.seuilRecommande));

  const prediction = await preditLeDomaine("https://imp0ts.gouv.fr", repertoire);
  assert.ok(Number.isFinite(prediction.probabilite));
  assert.ok(Number.isFinite(prediction.seuil));
  assert.ok(prediction.probabilite >= 0 && prediction.probabilite <= 1);
  assert.ok(prediction.decision === "suspect" || prediction.decision === "valide");
  assert.notEqual(prediction.raison, "correspondance_exacte");

  for (const fichier of [chemins.donnees, chemins.entrainement, chemins.validation, chemins.test,
    chemins.normalisation, chemins.modele, chemins.entrainementRapport, chemins.evaluation, chemins.provenance]) {
    assert.ok((await stat(fichier)).size > 0, `Artefact vide : ${fichier}`);
  }
  console.log("Chaîne du classifieur vérifiée sur dix lignes (6/2/2), une époque et une prédiction.");
} finally {
  await rm(repertoireResolu, { recursive: true, force: true });
}
