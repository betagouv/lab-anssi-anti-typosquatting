import { nomSansSuffixe, suffixePublic } from "./domaines.ts";
import { compareLaPaire, indexeLeDomaine, type Candidat } from "./recherche.ts";

type LigneCsv = Record<string, string | number>;

const PAIRES_LEET = new Set(["a4", "4a", "e3", "3e", "g9", "9g", "i1", "1i", "l1", "1l", "o0", "0o", "s5", "5s", "t7", "7t"]);

const comporteUneSubstitutionLeet = (gauche: string, droite: string): number =>
  Number(gauche.length === droite.length && [...gauche].some((caractere, position) =>
    PAIRES_LEET.has(`${caractere}${droite[position]}`)));

const comporteUneTransposition = (gauche: string, droite: string): number => {
  if (gauche.length !== droite.length) return 0;
  for (let position = 0; position < gauche.length - 1; position++) {
    if (gauche[position] !== droite[position] &&
      gauche[position] === droite[position + 1] &&
      gauche[position + 1] === droite[position] &&
      gauche.slice(0, position) === droite.slice(0, position) &&
      gauche.slice(position + 2) === droite.slice(position + 2)) return 1;
  }
  return 0;
};

const comporteUnChangementDeTiret = (gauche: string, droite: string): number =>
  Number(gauche.replaceAll("-", "") === droite.replaceAll("-", "") && gauche !== droite);

const NOMS_DES_CARACTERISTIQUES = [
  "distance_levenshtein_normalisee",
  "similarite_edition",
  "produit_scalaire_bigrammes",
  "norme_bigrammes_reference",
  "similarite_cosinus",
  "score_suspicion",
  "ecart_longueur_normalise",
  "meme_suffixe_public",
  "substitution_leet",
  "transposition_adjacente",
  "changement_tiret",
  "distance_levenshtein_sans_suffixe_normalisee",
  "similarite_edition_sans_suffixe",
  "similarite_cosinus_sans_suffixe",
  "score_suspicion_sans_suffixe",
] as const;

export const colonnesDesCaracteristiques = (nombreDeCandidats = 10): string[] => [
  "longueur_url",
  "norme_bigrammes_url",
  ...Array.from({ length: nombreDeCandidats }, (_, position) =>
    NOMS_DES_CARACTERISTIQUES.map((nom) => `candidat_${position + 1}_${nom}`)).flat(),
  "score_suspicion_max",
  "score_suspicion_moyen",
  "marge_score_1_2",
  "nombre_scores_superieurs_085",
  "distance_minimale_normalisee",
];

export const colonnesDesMetadonnees = (nombreDeCandidats = 10): string[] => [
  "url",
  "domaine_reference_source",
  "type_generation",
  "classe",
  "domaine_trompeur_car_trop_proche_d_un_valide",
  ...Array.from({ length: nombreDeCandidats }, (_, position) => `reference_candidat_${position + 1}`),
];

export interface MetadonneesDeLigne {
  readonly domaine_reference_source: string;
  readonly type_generation: string;
  readonly classe: string;
  readonly domaine_trompeur_car_trop_proche_d_un_valide: number;
}

export const construitLigneDeCaracteristiques = (
  domaine: string,
  candidats: readonly Candidat[],
  metadonnees: MetadonneesDeLigne,
  nombreDeCandidats = 10,
): LigneCsv => {
  const ligne: LigneCsv = {
    ...metadonnees,
    url: domaine,
    longueur_url: domaine.length,
    norme_bigrammes_url: candidats[0]?.comparaison.normeUrl ?? 0,
  };
  const scores: number[] = [];
  const distances: number[] = [];
  for (let position = 0; position < nombreDeCandidats; position++) {
    const rang = position + 1;
    const candidat = candidats[position];
    ligne[`reference_candidat_${rang}`] = candidat?.reference.domaine ?? "";
    if (candidat === undefined) {
      NOMS_DES_CARACTERISTIQUES.forEach((nom) => { ligne[`candidat_${rang}_${nom}`] = 0; });
      continue;
    }
    const { comparaison, reference } = candidat;
    const domaineSansSuffixe = nomSansSuffixe(domaine);
    const referenceSansSuffixe = nomSansSuffixe(reference.domaine);
    const sansSuffixe = compareLaPaire(indexeLeDomaine(domaineSansSuffixe), indexeLeDomaine(referenceSansSuffixe));
    const distanceNormalisee = comparaison.distance / Math.max(domaine.length, reference.domaine.length, 1);
    const prefixe = `candidat_${rang}_`;
    ligne[`${prefixe}distance_levenshtein_normalisee`] = distanceNormalisee;
    ligne[`${prefixe}similarite_edition`] = comparaison.similariteEdition;
    ligne[`${prefixe}produit_scalaire_bigrammes`] = comparaison.produitScalaire;
    ligne[`${prefixe}norme_bigrammes_reference`] = comparaison.normeReference;
    ligne[`${prefixe}similarite_cosinus`] = comparaison.similariteCosinus;
    ligne[`${prefixe}score_suspicion`] = comparaison.scoreSuspicion;
    ligne[`${prefixe}ecart_longueur_normalise`] = Math.abs(domaine.length - reference.domaine.length) / Math.max(domaine.length, reference.domaine.length, 1);
    ligne[`${prefixe}meme_suffixe_public`] = Number(suffixePublic(domaine) === suffixePublic(reference.domaine));
    ligne[`${prefixe}substitution_leet`] = comporteUneSubstitutionLeet(domaine, reference.domaine);
    ligne[`${prefixe}transposition_adjacente`] = comporteUneTransposition(domaine, reference.domaine);
    ligne[`${prefixe}changement_tiret`] = comporteUnChangementDeTiret(domaine, reference.domaine);
    ligne[`${prefixe}distance_levenshtein_sans_suffixe_normalisee`] = sansSuffixe.distance /
      Math.max(domaineSansSuffixe.length, referenceSansSuffixe.length, 1);
    ligne[`${prefixe}similarite_edition_sans_suffixe`] = sansSuffixe.similariteEdition;
    ligne[`${prefixe}similarite_cosinus_sans_suffixe`] = sansSuffixe.similariteCosinus;
    ligne[`${prefixe}score_suspicion_sans_suffixe`] = sansSuffixe.scoreSuspicion;
    scores.push(comparaison.scoreSuspicion);
    distances.push(distanceNormalisee);
  }
  ligne.score_suspicion_max = Math.max(0, ...scores);
  ligne.score_suspicion_moyen = scores.reduce((total, score) => total + score, 0) / Math.max(scores.length, 1);
  ligne.marge_score_1_2 = (scores[0] ?? 0) - (scores[1] ?? 0);
  ligne.nombre_scores_superieurs_085 = scores.filter((score) => score > 0.85).length;
  ligne.distance_minimale_normalisee = Math.min(1, ...distances);
  return ligne;
};
