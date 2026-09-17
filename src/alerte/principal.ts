import "./style.css";

const parametres = new URLSearchParams(window.location.search);
const domaineVisite = parametres.get("domaineVisite") ?? "";
const domaineImite = parametres.get("domaineImite") ?? "";
const scoreDeSuspicion = Number.parseFloat(parametres.get("score") ?? "0");

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
afficheLeTexte("score", scoreFormate);
document.body.style.setProperty("--score", scoreFormate);

afficheLeLien("domaine-imite", urlDuDomaineImite, urlDuDomaineImite);
afficheLeLien("visiter-quand-meme", `https://${domaineVisite}`);

document.getElementById("retour")?.addEventListener("click", () => {
  history.back();
});
