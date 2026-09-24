import { vecteurDeBigrammes, similariteCosinus, type VecteurDeBigrammes } from "../../src/noyau/bigrammes.ts";
import { distanceDeLevenshtein, similariteDEdition } from "../../src/noyau/levenshtein.ts";

export interface DomaineIndexe {
  readonly domaine: string;
  readonly bigrammes: VecteurDeBigrammes;
  readonly norme: number;
}

export interface Comparaison {
  readonly distance: number;
  readonly similariteEdition: number;
  readonly produitScalaire: number;
  readonly normeUrl: number;
  readonly normeReference: number;
  readonly similariteCosinus: number;
  readonly scoreSuspicion: number;
}

export interface Candidat {
  readonly reference: DomaineIndexe;
  readonly comparaison: Comparaison;
}

const norme = (vecteur: VecteurDeBigrammes): number =>
  Math.sqrt([...vecteur.values()].reduce((total, nombre) => total + nombre ** 2, 0));

const produitScalaire = (gauche: VecteurDeBigrammes, droite: VecteurDeBigrammes): number => {
  let total = 0;
  for (const [bigramme, nombre] of gauche) total += nombre * (droite.get(bigramme) ?? 0);
  return total;
};

export const indexeLeDomaine = (domaine: string): DomaineIndexe => {
  const bigrammes = vecteurDeBigrammes(domaine);
  return { domaine, bigrammes, norme: norme(bigrammes) };
};

export const compareLaPaire = (url: DomaineIndexe, reference: DomaineIndexe): Comparaison => {
  const similariteEdition = similariteDEdition(url.domaine, reference.domaine);
  const similariteCosinusDesBigrammes = similariteCosinus(url.bigrammes, reference.bigrammes);
  return {
    distance: distanceDeLevenshtein(url.domaine, reference.domaine),
    similariteEdition,
    produitScalaire: produitScalaire(url.bigrammes, reference.bigrammes),
    normeUrl: url.norme,
    normeReference: reference.norme,
    similariteCosinus: similariteCosinusDesBigrammes,
    scoreSuspicion: (similariteEdition + similariteCosinusDesBigrammes) / 2,
  };
};

const groupesDeLettres = (domaine: string, taille: number): string[] =>
  Array.from({ length: Math.max(0, domaine.length - taille + 1) }, (_, position) => domaine.slice(position, position + taille));

const ajoutePosition = (index: Map<string, number[]>, cle: string, position: number): void => {
  const positions = index.get(cle);
  if (positions === undefined) index.set(cle, [position]);
  else positions.push(position);
};

export class RechercheDeCandidats {
  private readonly references: DomaineIndexe[];
  private readonly positionParDomaine = new Map<string, number>();
  private readonly parBigramme = new Map<string, number[]>();
  private readonly parTrigramme = new Map<string, number[]>();
  private readonly parExtension = new Map<string, number[]>();

  constructor(domaines: readonly string[]) {
    this.references = domaines.map(indexeLeDomaine);
    this.references.forEach((reference, position) => {
      this.positionParDomaine.set(reference.domaine, position);
      for (const bigramme of reference.bigrammes.keys()) ajoutePosition(this.parBigramme, bigramme, position);
      for (const trigramme of groupesDeLettres(reference.domaine, 3)) ajoutePosition(this.parTrigramme, trigramme, position);
      ajoutePosition(this.parExtension, reference.domaine.split(".").at(-1) ?? "", position);
    });
  }

  trouveLesPlusProches(domaine: string, nombre = 10, referenceForcee: string | null = null): Candidat[] {
    const url = indexeLeDomaine(domaine);
    const frequences = new Map<number, number>();
    for (const bigramme of url.bigrammes.keys()) {
      const positions = this.parBigramme.get(bigramme) ?? [];
      if (positions.length <= 200) {
        positions.forEach((position) => frequences.set(position, (frequences.get(position) ?? 0) + 1));
      }
    }
    for (const trigramme of groupesDeLettres(domaine, 3)) {
      const positions = this.parTrigramme.get(trigramme) ?? [];
      if (positions.length <= 500) {
        positions.forEach((position) => frequences.set(position, (frequences.get(position) ?? 0) + 3));
      }
    }
    const positionsCandidates = new Set(
      [...frequences.entries()]
        .sort((gauche, droite) =>
          droite[1] - gauche[1] ||
          Math.abs(this.references[gauche[0]]!.domaine.length - domaine.length) -
            Math.abs(this.references[droite[0]]!.domaine.length - domaine.length) ||
          gauche[0] - droite[0],
        )
        .slice(0, nombre * 2)
        .map(([position]) => position),
    );
    const extension = domaine.split(".").at(-1) ?? "";
    for (const position of (this.parExtension.get(extension) ?? []).slice(0, nombre * 2)) {
      positionsCandidates.add(position);
    }
    if (referenceForcee !== null) {
      const position = this.positionParDomaine.get(referenceForcee);
      if (position !== undefined) positionsCandidates.add(position);
    }
    for (let position = 0; positionsCandidates.size < nombre * 2 && position < this.references.length; position++) {
      positionsCandidates.add(position);
    }
    return [...positionsCandidates]
      .map((position) => {
        const reference = this.references[position]!;
        return { reference, comparaison: compareLaPaire(url, reference) };
      })
      .sort((gauche, droite) =>
        droite.comparaison.scoreSuspicion - gauche.comparaison.scoreSuspicion ||
        gauche.comparaison.distance - droite.comparaison.distance ||
        gauche.reference.domaine.localeCompare(droite.reference.domaine),
      )
      .slice(0, nombre);
  }
}
