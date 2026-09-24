export const retrouveLUrlAAnalyser = (urlDeLOnglet: string, urlDeLAlerte: string): string | null => {
  try {
    const url = new URL(urlDeLOnglet);
    const alerte = new URL(urlDeLAlerte);
    if (url.origin !== alerte.origin || url.pathname !== alerte.pathname) return urlDeLOnglet;
    const domaine = url.searchParams.get("domaineVisite");
    return domaine === null ? null : `https://${domaine}/`;
  } catch {
    return null;
  }
};
