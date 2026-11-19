---
name: nouvelle-release
description: Prépare et publie une nouvelle version de l'extension (montée de version, vérifications, commit, release GitHub qui déclenche la publication sur les stores Chrome, Firefox et Edge). Utilise ce skill dès que l'utilisateur demande une release, une nouvelle version, de publier l'extension sur les stores, ou de « sortir une version ». Argument optionnel : patch, minor, major ou un numéro de version explicite.
---

# Nouvelle release

Une release GitHub publiée avec le tag `vX.Y.Z` déclenche `.github/workflows/publication.yml`, qui soumet l'extension aux stores. Cette action est visible publiquement et difficile à annuler : on ne crée la release qu'après confirmation explicite de l'utilisateur.

## 1. Vérifier l'état du dépôt

```bash
git switch main
git fetch --tags origin
git status --porcelain
git log --oneline origin/main..main
git log --oneline main..origin/main
```

- L'arbre de travail doit être propre. Sinon, s'arrêter et demander quoi faire des modifications.
- Si `main` est en retard sur `origin/main`, faire `git pull --ff-only`.
- Si `main` a des commits non poussés, les signaler : ils partiront avec la release.

## 2. Résumer les changements depuis la dernière version

```bash
derniere=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null)
git log --format='- %s' ${derniere:+$derniere..}HEAD
```

S'il n'y a aucun commit depuis la dernière version, s'arrêter : il n'y a rien à publier.

## 3. Choisir la nouvelle version

Lire la version actuelle dans `package.json`. Si l'utilisateur n'a pas donné l'incrément en argument, proposer celui qui correspond aux commits (avec AskUserQuestion) :

- **patch** : corrections, mises à jour de données ou de dépendances ;
- **minor** : nouvelle fonctionnalité visible ;
- **major** : changement de comportement important, nouvelles permissions dans le manifeste.

Une nouvelle permission dans `manifeste.config.ts` déclenche une revue plus longue sur les stores, et Chrome désactive l'extension chez les utilisateurs jusqu'à ce qu'ils acceptent : le signaler.

## 4. Monter la version et vérifier

```bash
npm version <patch|minor|major|X.Y.Z> --no-git-tag-version
npm run typecheck
npm run lint
npm run test
npm run build:all
npx web-ext lint --source-dir=dist/firefox --self-hosted
```

`npm version` met à jour `package.json` et `package-lock.json` ; le manifeste lit la version dans `package.json`. Si une vérification échoue, s'arrêter, montrer l'erreur et restaurer les deux fichiers avec `git checkout -- package.json package-lock.json`.

## 5. Rédiger les notes de version

En français, à partir du résumé de l'étape 2, regroupées par thème et formulées pour un utilisateur de l'extension (pas de détails internes comme la CI ou le refactoring). Écrire les notes dans un fichier du dossier scratchpad.

## 6. Confirmer avec l'utilisateur

Présenter : la version (`vA.B.C` → `vX.Y.Z`), les notes de version, et rappeler que la confirmation va pousser sur `main` et soumettre l'extension aux trois stores. Attendre un accord explicite.

## 7. Commit, push et release

```bash
git add package.json package-lock.json
git commit -m "Passe en version X.Y.Z"
git push origin main
gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes-file <fichier-des-notes>
```

Le message de commit suit la convention du dépôt : en français, un verbe à la troisième personne du présent.

## 8. Suivre la publication

```bash
gh run list --workflow=publication.yml --limit 1
gh run watch <id> --exit-status
```

Si un environnement exige une approbation, le signaler à l'utilisateur plutôt que d'attendre indéfiniment. En cas d'échec d'un job de store, montrer le log (`gh run view <id> --log-failed`) : la release et les autres stores ne sont pas affectés, on peut relancer le job seul avec `gh run rerun <id> --job <job-id>`.

Terminer par le lien de la release et l'état de chaque store (soumis à la revue ou en échec).
