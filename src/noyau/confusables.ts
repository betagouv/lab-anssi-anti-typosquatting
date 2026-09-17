import punycode from "punycode.js";

const CARACTERES_CONFUSABLES: ReadonlyMap<string, string> = new Map(
  Object.entries({
    а: "a", ᴀ: "a", α: "a", ａ: "a",
    ь: "b", β: "b", Ь: "b",
    с: "c", ϲ: "c", ᴄ: "c",
    ԁ: "d", ᴅ: "d",
    е: "e", ё: "e", ε: "e",
    ɡ: "g", ց: "g",
    һ: "h", հ: "h",
    і: "i", ї: "i", ι: "i", ı: "i",
    ј: "j", ϳ: "j",
    κ: "k", к: "k",
    ӏ: "l",
    м: "m", ᴍ: "m",
    п: "n", ո: "n", η: "n",
    о: "o", ο: "o", ө: "o",
    р: "p", ρ: "p",
    ԛ: "q",
    г: "r", ᴦ: "r",
    ѕ: "s", ѕ̶: "s",
    т: "t", τ: "t",
    υ: "u", ս: "u",
    ν: "v", ѵ: "v",
    ԝ: "w", ա: "w",
    х: "x", χ: "x",
    у: "y", ү: "y", γ: "y",
    ᴢ: "z",
    "0": "o", "1": "l", "5": "s",
  }),
);

const GROUPES_CONFUSABLES: readonly [RegExp, string][] = [
  [/rn/g, "m"],
  [/vv/g, "w"],
];

const enUnicode = (etiquette: string): string => {
  if (!etiquette.startsWith("xn--")) return etiquette;
  try {
    return punycode.toUnicode(etiquette);
  } catch {
    return etiquette;
  }
};

export const squelette = (etiquette: string): string => {
  const caracteresRamenes = [...enUnicode(etiquette).normalize("NFC")]
    .map((caractere) => CARACTERES_CONFUSABLES.get(caractere) ?? caractere)
    .join("");

  return GROUPES_CONFUSABLES.reduce(
    (texte, [motif, remplacant]) => texte.replace(motif, remplacant),
    caracteresRamenes,
  );
};

export const estUnLabelInternationalise = (etiquette: string): boolean =>
  etiquette.startsWith("xn--");
