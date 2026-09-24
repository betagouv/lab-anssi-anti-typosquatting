# Classifieur de typosquatting

Ce dossier permet de créer un jeu d'exemples, d'entraîner un modèle TensorFlow.js, de l'évaluer et d'essayer localement une URL avec les poids obtenus. Un modèle d'essai exporté est inclus dans l'extension pour comparer son résultat aux règles actuelles.

## Installer le projet

Installer **Node.js 24** et npm. Si le dépôt n'est pas encore présent :

```bash
git clone https://github.com/betagouv/lab-anssi-anti-typosquatting.git
cd lab-anssi-anti-typosquatting
```

Depuis la racine du dépôt, qui contient `package.json`, vérifier Node et installer exactement les dépendances du verrou npm :

```bash
node --version
npm ci
```

Toutes les commandes ci-dessous se lancent depuis cette racine. Elles fonctionnent aussi dans PowerShell.

## D'où viennent les données ?

La seule entrée versionnée est [`src/donnees/domaines-legitimes.txt`](../src/donnees/domaines-legitimes.txt), la liste légitime déjà utilisée par l'extension. La chaîne ne lit ni le CSV externe du projet parent ni les fichiers du prototype `classifier`.

| Étape | Fichier lu | Fichier produit |
| --- | --- | --- |
| Création du jeu | `src/donnees/domaines-legitimes.txt` | `classifieur/resultats/donnees/jeu-entrainement.csv` |
| Répartition | `jeu-entrainement.csv` | `donnees/repartitions/entrainement.csv`, `validation.csv`, `test.csv` |
| Normalisation | `entrainement.csv` | `modele/normalisation.json` |
| Entraînement | `entrainement.csv`, `validation.csv`, `normalisation.json` | `modele/poids.json`, `rapports/entrainement.json` |
| Évaluation | `test.csv`, `poids.json`, `normalisation.json` | `rapports/evaluation.json` et son seuil recommandé |

Les lignes positives sont des variantes synthétiques de domaines légitimes ; les négatives sont des noms intermédiaires ou distants. Le modèle reçoit les caractéristiques numériques calculées à partir des dix domaines de référence les plus proches. Les variantes d'un même domaine source restent dans la même répartition. La normalisation est apprise sur l'entraînement seulement.

Train, la prédiction locale et l'extension emploient la même recherche de candidats, les mêmes 157 caractéristiques et la même normalisation. La génération n'impose plus de référence parmi les candidats. Les URL sont ramenées au domaine enregistrable, comme dans l'extension.

`rapports/provenance.json` contient l'empreinte SHA-256 du contenu source avec des fins de ligne LF, la graine et les paramètres de génération. Les résultats sont régénérables et ignorés par Git. Les poids peuvent varier légèrement d'une plateforme à l'autre.

## Entraîner le modèle

Pour vérifier rapidement toute la chaîne sur 1 000 domaines sources, avec des résultats isolés dans `classifieur/resultats-essai/` :

```bash
npm run classifieur:essai
```

Pour utiliser **toute** la liste légitime et écrire dans `classifieur/resultats/` :

```bash
npm run classifieur:chaine
```

La chaîne complète peut être longue. Pour réduire encore l'essai et suivre deux époques :

```bash
npm run classifieur:essai -- --limite=100 --epoques=2 --taille-du-lot=64
```

Chaque étape peut également être lancée séparément, dans cet ordre :

```bash
npm run classifieur:generer
npm run classifieur:repartir
npm run classifieur:normaliser
npm run classifieur:entrainer
npm run classifieur:evaluer
```

Les paramètres par défaut sont une graine `20260917`, quatre imitations, quatre exemples intermédiaires et deux exemples distants visés par domaine, 25 époques au maximum et des lots de 256. `--limite=0` utilise toute la liste. Les options `--graine`, `--limite`, `--epoques`, `--taille-du-lot` et `--repertoire` se passent après `--` ; `--repertoire` doit être identique pour chaque étape exécutée séparément. La génération accepte aussi `--imitations-par-domaine`, `--intermediaires-par-domaine`, `--distants-par-domaine` et les trois options de seuil `--score-minimum-imitation`, `--score-minimum-intermediaire`, `--score-maximum-intermediaire`.

## Essayer une URL avec les poids entraînés

Après `classifieur:chaine`, interroger le modèle complet :

```bash
npm run classifieur:predire -- https://imp0ts.gouv.fr
npm run classifieur:predire -- https://nouveau-domaine.fr
npm run classifieur:predire -- https://impots.gouv.fr
```

Après `classifieur:essai`, sélectionner les poids de cet essai :

```bash
npm run classifieur:predire -- https://imp0ts.gouv.fr --repertoire=classifieur/resultats-essai
npm run classifieur:predire -- https://nouveau-domaine.fr --repertoire=classifieur/resultats-essai
```

La commande exige `modele/poids.json`, `modele/normalisation.json`, `rapports/evaluation.json` et `rapports/provenance.json` dans le répertoire choisi. Elle vérifie que la liste source et les poids correspondent à ceux de l'évaluation, puis affiche en JSON la décision (`suspect` ou `valide`), la probabilité, le seuil et les références proches. Un domaine présent exactement dans la liste est classé `valide` par la règle de référence, sans calcul neuronal. Tester `imp0ts.gouv.fr` exerce donc le modèle, tandis que `impots.gouv.fr` vérifie la règle de correspondance exacte.

Ici, `valide` signifie seulement qu'aucune proximité trompeuse suffisante n'a été détectée avec la liste de référence. Les exemples d'apprentissage étant synthétiques, le score ne représente pas une probabilité opérationnelle de fraude. Le seuil et le F1 sont choisis sur le jeu de test, comme dans le prototype : le F1 affiché reste une mesure exploratoire.

## Exporter le modèle d'essai pour l'extension

La version embarquée est entraînée avec les paramètres de `classifieur:essai` : 1 000 domaines sources, graine `20260917`, jusqu'à 12 époques. Après un entraînement et son évaluation :

```bash
npm run classifieur:essai
npm run classifieur:exporter-modele
npm run classifieur:verifier-export
```

L'export écrit `public/modele/essai.bin` (poids float32) et `public/modele/essai.json` (ordre des colonnes, normalisation, seuil, empreintes et paramètres). Ces deux fichiers sont versionnés et embarqués dans les paquets Chrome et Firefox. La commande d'export refuse une liste source, des poids, une architecture ou une normalisation incompatibles ; `classifieur:verifier-export` vérifie de nouveau l'export sans entraîner le modèle. Si la liste légitime change, réentraîner et exporter avant de livrer l'extension.

L'inférence de l'extension utilise un calcul TypeScript limité aux trois couches du modèle. Le test de parité compare ses scores à TensorFlow.js. La fenêtre ouverte depuis l'icône affiche le résultat expérimental et celui des règles pour le domaine courant ; seul ce dernier pilote les alertes.

## Vérifier le code

```bash
npm run typecheck
npm run lint
npm test
npm run classifieur:verifier-chaine
npm run classifieur:verifier-export
```

`classifieur:verifier-chaine` est le contrôle de bout en bout exécuté en CI. Il génère des exemples à partir de `src/donnees/domaines-legitimes.txt`, retient exactement dix lignes (six pour l'entraînement, deux pour la validation et deux pour le test), avec les deux classes dans chaque répartition et sans mélanger les variantes d'un domaine source entre répartitions. Il normalise, entraîne pendant une époque, évalue et prédit une URL absente de la liste. La commande vérifie les artefacts et la validité numérique de la prédiction ; elle n'impose aucun score ni verdict. Tous ses fichiers sont créés dans un répertoire temporaire supprimé à la fin.

Le code est organisé par étapes dans `creation-du-dataset/`, `entrainement/`, `evaluation/`, `inference/`, `exportation/` et `verification/`. Le calcul partagé avec l'extension se trouve dans `src/noyau/modele/`. `commun/` regroupe les accès aux fichiers et `ligne-de-commande/` expose les commandes usuelles.
