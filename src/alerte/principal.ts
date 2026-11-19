import browser from "webextension-polyfill";

import { MOTIFS } from "../commun/motifs.ts";
import "./style.css";

const ADRESSE_DE_CONTACT = "contact@anti-typosquatting.beta.gouv.fr";

const parametres = new URLSearchParams(window.location.search);
const domaineVisite = parametres.get("domaineVisite") ?? "";
const domaineImite = parametres.get("domaineImite") ?? "";
const classe = parametres.get("classe") ?? "";
const scoreDeSuspicion = Number.parseFloat(parametres.get("score") ?? "0");

const afficheLeTexte = (identifiant: string, texte: string): void => {
  const element = document.getElementById(identifiant);
  if (element !== null) element.textContent = texte;
};

const definitLaDestination = (identifiant: string, url: string): void => {
  const element = document.getElementById(identifiant);
  if (element instanceof HTMLAnchorElement) element.href = url;
};

const auClic = (identifiant: string, action: () => void): void => {
  document.getElementById(identifiant)?.addEventListener("click", action);
};

const enPourcentage = (valeur: number): string =>
  `${(Number.isFinite(valeur) ? valeur : 0).toFixed(1)} %`;

const sujetDuSignalement = (): string =>
  `Signalement d'une alerte sur ${domaineVisite}`;

const scoreFormate = enPourcentage(scoreDeSuspicion);
const urlDuDomaineImite = `https://${domaineImite}`;

afficheLeTexte("domaine-visite", domaineVisite);
afficheLeTexte("score", scoreFormate);
afficheLeTexte("motif", MOTIFS[classe] ?? "");
afficheLeTexte("domaine-imite", urlDuDomaineImite);

document.body.style.setProperty("--score", scoreFormate.replace(" ", ""));

definitLaDestination("domaine-imite", urlDuDomaineImite);
definitLaDestination(
  "signaler",
  `mailto:${ADRESSE_DE_CONTACT}?subject=${encodeURIComponent(sujetDuSignalement())}`,
);

auClic("retour", () => {
  history.back();
});

auClic("visiter-quand-meme", () => {
  void browser.runtime.sendMessage({
    type: "autorise-le-domaine",
    domaine: domaineVisite,
  });
});
