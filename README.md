# lab-anssi-anti-typosquatting

Extension navigateur qui avertit l'usager lorsqu'il navigue sur un domaine imitant
celui d'un service public français — commune, collectivité, service de l'État.

Firefox et Chrome, Manifest V3. Toute la détection est locale : aucune donnée de
navigation ne quitte le navigateur, aucune requête réseau n'est émise.

## Démarrer

```bash
npm ci
npm run dev           # Chrome
npm run dev:firefox   # Firefox
```

Le navigateur s'ouvre avec l'extension chargée et se recharge à chaque modification.

Pour charger l'extension à la main : `npm run build:all`, puis
`about:debugging#/runtime/this-firefox` → « Charger un module temporaire » →
`dist/firefox/manifest.json`, ou `chrome://extensions` → mode développeur →
« Charger l'extension non empaquetée » → `dist/chrome/`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` / `dev:firefox` | Navigateur de développement, rechargement automatique |
| `npm run build` / `build:firefox` / `build:all` | Empaquetage dans `dist/<navigateur>/` |
| `npm test` | Tests, échantillon de 3 000 domaines pour la liste légitime |
| `npm run test:complet` | Tests, liste légitime entière — ce que lance la CI |
| `npm run typecheck` / `lint` | TypeScript strict, ESLint typé |
| `npm run genere:domaines` | Régénère la liste légitime |
| `npm run lint:ext` | `web-ext lint` sur le paquet Firefox |

## Comment ça marche

`webNavigation.onBeforeNavigate` donne l'URL avant chargement. Le domaine est ramené à
son domaine enregistrable — `www.belley.fr` et `mairie.belley.fr` deviennent `belley.fr` —
puis comparé à une liste de domaines publics embarquée dans le paquet.

Un index inversé de bigrammes ramène les 23 476 comparaisons à environ 176 candidats
avant tout calcul de distance. Compter : 250 ms pour construire l'index une fois par
vie du service worker, puis 1 à 2 ms par navigation.

Le verdict n'est pas un score mais une **classe de mutation**, chacune décidant du
blocage ou du simple avertissement :

| Classe | Exemple | Effet |
|---|---|---|
| Sous-domaine trompeur | `impots.gouv.fr.secure-login.com` | Blocage |
| Homoglyphe | `аmeli.fr` (cyrillique), `impots.g0uv.fr`, `arneli.fr` | Blocage |
| Permutation de TLD | `impots.xyz`, `belley.xyz` | Blocage |
| Permutation de TLD entre extensions de confiance | `belley.com` | Avertissement |
| Combosquat | `mairie-belley-officiel.xyz` | Selon l'extension |
| Manipulation de séparateurs | `agglosaintnazaire.fr` | Avertissement |
| Distance d'édition | `service-publlic.fr` | Avertissement |

Un **blocage** remplace la page par un interstitiel. Un **avertissement** pose un badge
sur l'icône de l'extension et n'interrompt jamais la navigation.

Un clic sur l'icône ouvre aussi une fenêtre de comparaison pour l'onglet courant. Elle
affiche côte à côte le résultat des règles et celui d'un modèle d'essai, même si les
règles ne signalent rien. Ce modèle a été entraîné sur 1 000 domaines sources et des
exemples synthétiques ; son score est exploratoire. Les règles seules continuent de
déclencher les blocages et avertissements. Le calcul est local et le modèle est chargé
uniquement à l'ouverture de la fenêtre.

Trois invariants : un domaine de la liste légitime n'est jamais signalé, un domaine
explicitement exclu non plus, et le domaine désigné comme imité appartient toujours à la
liste.

Depuis l'interstitiel, « Visiter quand même » enregistre une exception de 24 heures dans
`browser.storage.local` avant de poursuivre la navigation.

## Les données

L'entraînement, l'export du modèle d'essai et sa vérification sont décrits dans [le README du classifieur](classifieur/README.md). Le modèle embarqué et la liste légitime versionnée sont vérifiés ensemble en CI.

`src/donnees/domaines-legitimes.txt` est **généré**, pas édité à la main :

```bash
npm run genere:domaines
```

Le script part de [`etalab/noms-de-domaine-organismes-secteur-public`][etalab], ne retient
que les domaines répondant en HTTP 200, les normalise en domaine enregistrable, écarte les
suffixes privés de la Public Suffix List et les plateformes listées dans
`src/donnees/domaines-exclus.txt`. Résultat : 23 476 domaines, 125 Ko compressés.

`src/donnees/domaines-exclus.txt` est en revanche **maintenu à la main**. Il écarte les
plateformes d'hébergement où de nombreuses communes publient : `free.fr` servait 431
hôtes du jeu de données, `e-monsite.com` 239, `jimdo.com` 220. Les garder produisait des
faux positifs de masse.

La CI vérifie que la liste versionnée est identique à celle que produit le script.

[etalab]: https://github.com/etalab/noms-de-domaine-organismes-secteur-public

## Ce que l'extension ne sait pas faire

Les chiffres ci-dessous sont mesurés en évaluant chacun des 23 476 domaines de la liste
**comme s'il en était absent** — c'est-à-dire la situation d'un site public légitime que
la liste ne couvre pas encore.

- **0,01 % sont bloqués à tort.** Deux cas subsistent : `aisne.com` face à `aisne.gouv.fr`,
  et `mornas.fr` face à `momas.fr` via la confusion `rn` / `m`.
- **6,6 % reçoivent un avertissement à tort.** Essentiellement des communes voisines aux
  noms proches, ou un même organisme possédant plusieurs graphies de son domaine. C'est
  la raison pour laquelle ces classes n'interrompent pas la navigation.
- **La liste ne couvre pas tout le secteur public**, et seuls les domaines répondant en
  HTTP 200 au dernier passage du jeu de données y figurent. Un site légitime absent peut
  donc être signalé, d'où le lien de signalement sur l'interstitiel.
- **Les fautes de frappe sur les noms courts passent au travers.** La classe distance
  d'édition exige une étiquette d'au moins 8 caractères : `amelii.fr` n'est pas détecté.
  Abaisser ce seuil à 6 ferait passer les avertissements à tort de 6,6 % à 9,8 %.

## Licence

Apache-2.0. La police Marianne est distribuée avec le [DSFR][dsfr] sous licence Etalab 2.0.

[dsfr]: https://github.com/GouvernementFR/dsfr
