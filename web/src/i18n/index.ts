// Portuguese text is the key; English comes from src/i18n/en/*.json. `N_` marks constants for the coverage check
// (tests/i18n.test.ts) without translating.

export type Lang = "pt" | "en";

const dictionaries = import.meta.glob<Record<string, string>>("./en/*.json", { eager: true, import: "default" });
const english: Record<string, string> = Object.assign({}, ...Object.values(dictionaries));

let current: Lang = "pt";

export function setLang(lang: Lang) {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function locale(): string {
  return current === "en" ? "en-US" : "pt-BR";
}

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = current === "en" ? (english[text] ?? text) : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  return out;
}

export const N_ = (text: string) => text;

/** Text in a language other than the current one. Mark the text with N_. */
export function translate(lang: Lang, text: string): string {
  return lang === "en" ? (english[text] ?? text) : text;
}
