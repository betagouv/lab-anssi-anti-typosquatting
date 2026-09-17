import browser from "webextension-polyfill";

import "./style.css";

const MOTIFS: Readonly<Record<string, string>> = {
  "sous-domaine-trompeur":
    "Un domaine public est déguisé en sous-domaine d'un autre site",
  homoglyphe: "Des caractères imitent visuellement ceux du site officiel",
  "permutation-de-tld": "L'extension du domaine a été remplacée",
  combosquat: "Le nom du site officiel est noyé dans un nom plus long",
  separateur: "Les tirets du nom officiel ont été déplacés",
  "distance-d-edition": "Le nom diffère de quelques caractères du site officiel",
};

const parametres = new URLSearchParams(window.location.search);
const domaineVisite = parametres.get("domaineVisite") ?? "";
const domaineImite = parametres.get("domaineImite") ?? "";
const classe = parametres.get("classe") ?? "";
const scoreDeSuspicion = Number.parseFloat(parametres.get("score") ?? "0");

const afficheLeTexte = (identifiant: string, texte: string): void => {
  const element = document.getElementById(identifiant);
  if (element !== null) element.textContent = texte;
};

const auClic = (identifiant: string, action: () => void): void => {
  document.getElementById(identifiant)?.addEventListener("click", action);
};

const enPourcentage = (valeur: number): string =>
  `${(Number.isFinite(valeur) ? valeur : 0).toFixed(1)}%`;

const scoreFormate = enPourcentage(scoreDeSuspicion);
const urlDuDomaineImite = `https://${domaineImite}`;

afficheLeTexte("domaine-visite", domaineVisite);
afficheLeTexte("motif", MOTIFS[classe] ?? "Risque");
afficheLeTexte("score", scoreFormate);
afficheLeTexte("domaine-imite", urlDuDomaineImite);
document.body.style.setProperty("--score", scoreFormate);

const lienVersLeDomaineImite = document.getElementById("domaine-imite");
if (lienVersLeDomaineImite instanceof HTMLAnchorElement) {
  lienVersLeDomaineImite.href = urlDuDomaineImite;
}

auClic("retour", () => {
  history.back();
});

auClic("visiter-quand-meme", () => {
  void browser.runtime.sendMessage({
    type: "autorise-le-domaine",
    domaine: domaineVisite,
  });
});
