declare module "punycode.js" {
  const punycode: {
    toUnicode(domaine: string): string;
    toASCII(domaine: string): string;
    decode(chaine: string): string;
    encode(chaine: string): string;
  };
  export default punycode;
}
