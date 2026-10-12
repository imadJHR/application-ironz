// Conversion des montants en lettres (français traditionnel), ex.
// 158112 -> "cent cinquante-huit mille cent douze".
const UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const TENS = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "",
  "quatre-vingt",
  "",
];
function under100(n: number): string {
  if (n < 20) return UNITS[n];
  const q = Math.floor(n / 10),
    r = n % 10;
  if (q === 7 || q === 9) {
    const base = q === 7 ? "soixante" : "quatre-vingt";
    if (n === 71) return "soixante et onze";
    return base + "-" + UNITS[10 + r];
  }
  if (r === 0) return q === 8 ? "quatre-vingts" : TENS[q];
  if (r === 1 && q !== 8) return TENS[q] + " et un";
  return TENS[q] + "-" + UNITS[r];
}
function under1000(n: number): string {
  const q = Math.floor(n / 100),
    r = n % 100;
  if (q === 0) return under100(r);
  const head = q === 1 ? "cent" : UNITS[q] + (r === 0 ? "-cents" : " cent");
  if (r === 0) return head;
  return head + " " + under100(r);
}
const stripFinalS = (s: string) =>
  s.replace(/quatre-vingts$/, "quatre-vingt").replace(/-cents$/, " cent");
const SCALES: [number, string][] = [
  [1e12, "billion"],
  [1e9, "milliard"],
  [1e6, "million"],
  [1e3, "mille"],
];
function words(n: number): string {
  if (n < 1000) return under1000(n);
  for (const [value, name] of SCALES) {
    if (n >= value) {
      const q = Math.floor(n / value),
        rest = n % value;
      const head =
        value === 1e3
          ? q === 1
            ? "mille"
            : stripFinalS(under1000(q)) + " mille"
          : (q === 1 ? "un" : under1000(q)) + " " + name + (q > 1 ? "s" : "");
      return rest === 0 ? head : head + " " + words(rest);
    }
  }
  return "";
}
export function montantEnLettres(amount: number | string): string {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 9999999999999999)
    return "";
  const dh = Math.floor(cents / 100),
    c = cents % 100;
  let out = words(dh) + " DIRHAM" + (dh > 1 ? "S" : "");
  if (c > 0)
    out += " ET " + words(c) + " CENTIME" + (c > 1 ? "S" : "");
  return out;
}
