export interface DemandeDAutorisation {
  readonly type: "autorise-le-domaine";
  readonly domaine: string;
}

export interface DemandeDeComparaison {
  readonly type: "compare-les-methodes";
  readonly url: string;
}

export const estUneDemandeDeComparaison = (message: unknown): message is DemandeDeComparaison => {
  if (typeof message !== "object" || message === null) return false;
  const candidat = message as Partial<DemandeDeComparaison>;
  return candidat.type === "compare-les-methodes" && typeof candidat.url === "string";
};

export const estUneDemandeDAutorisation = (
  message: unknown,
): message is DemandeDAutorisation => {
  if (typeof message !== "object" || message === null) return false;
  const candidat = message as Partial<DemandeDAutorisation>;
  return (
    candidat.type === "autorise-le-domaine" &&
    typeof candidat.domaine === "string" &&
    candidat.domaine.length > 0
  );
};
