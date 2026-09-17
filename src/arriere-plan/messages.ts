export interface DemandeDAutorisation {
  readonly type: "autorise-le-domaine";
  readonly domaine: string;
}

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
