import { parse } from "tldts";

export interface DomaineNormalise {
  readonly nomDHote: string;
  readonly domaineEnregistrable: string;
  readonly etiquette: string;
  readonly suffixe: string;
  readonly estSousUnSuffixePrive: boolean;
}

const enFormeCanonique = (nomDHote: string): string | null => {
  try {
    const canonique = new URL(`https://${nomDHote.trim().normalize("NFC")}`)
      .hostname;
    return canonique.replace(/\.$/, "");
  } catch {
    return null;
  }
};

export const normaliseLeNomDHote = (
  nomDHote: string,
): DomaineNormalise | null => {
  const canonique = enFormeCanonique(nomDHote);
  if (canonique === null) return null;

  const avecSuffixesPrives = parse(canonique, { allowPrivateDomains: true });
  const avecSuffixesPublics = parse(canonique, { allowPrivateDomains: false });

  const { domain, domainWithoutSuffix, publicSuffix, isIp } = avecSuffixesPrives;
  if (isIp === true) return null;
  if (domain === null || domainWithoutSuffix === null || publicSuffix === null) {
    return null;
  }

  return {
    nomDHote: canonique,
    domaineEnregistrable: domain,
    etiquette: domainWithoutSuffix,
    suffixe: publicSuffix,
    estSousUnSuffixePrive: publicSuffix !== avecSuffixesPublics.publicSuffix,
  };
};

export const normaliseLUrl = (url: string): DomaineNormalise | null => {
  try {
    return normaliseLeNomDHote(new URL(url).hostname);
  } catch {
    return null;
  }
};
