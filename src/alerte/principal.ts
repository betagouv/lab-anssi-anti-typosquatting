import "./style.css";

const parametres = new URLSearchParams(window.location.search);
const domaineVisite = parametres.get("domaineVisite") ?? "";
const domaineImite = parametres.get("domaineImite") ?? "";
const scoreDeSuspicion = Number.parseFloat(parametres.get("score") ?? "0");
const classe = parametres.get("classe") ?? "";

const MOTIFS: Readonly<Record<string, string>> = {
  "sous-domaine-trompeur":
    "Un domaine public est déguisé en sous-domaine d'un autre site",
  homoglyphe: "Des caractères imitent visuellement ceux du site officiel",
  "permutation-de-tld": "L'extension du domaine a été remplacée",
  combosquat: "Le nom du site officiel est noyé dans un nom plus long",
  separateur: "Les tirets du nom officiel ont été déplacés",
  "distance-d-edition": "Le nom diffère de quelques caractères du site officiel",
};

const afficheLeTexte = (identifiant: string, texte: string): void => {
  const element = document.getElementById(identifiant);
  if (element !== null) element.textContent = texte;
};

const afficheLeLien = (
  identifiant: string,
  url: string,
  libelle?: string,
): void => {
  const element = document.getElementById(identifiant);
  if (!(element instanceof HTMLAnchorElement)) return;
  element.href = url;
  if (libelle !== undefined) element.textContent = libelle;
};

const enPourcentage = (valeur: number): string =>
  `${(Number.isFinite(valeur) ? valeur : 0).toFixed(1)}%`;

const scoreFormate = enPourcentage(scoreDeSuspicion);
const urlDuDomaineImite = `https://${domaineImite}`;

afficheLeTexte("domaine-visite", domaineVisite);
afficheLeTexte("motif", MOTIFS[classe] ?? "Risque");
afficheLeTexte("score", scoreFormate);
document.body.style.setProperty("--score", scoreFormate);

afficheLeLien("domaine-imite", urlDuDomaineImite, urlDuDomaineImite);
afficheLeLien("visiter-quand-meme", `https://${domaineVisite}`);

document.getElementById("retour")?.addEventListener("click", () => {
  history.back();
});
