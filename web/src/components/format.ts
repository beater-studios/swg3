
import { locale, t } from "../i18n";

// Stat display order: HP, Atk, Def, SpA, SpD, Spe. The game and the logic use HP, Atk, Def, Spe, SpA, SpD:
// DISPLAY[d] is the index in game order.
export const STAT_LABELS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
export const GAME_STATS = ["hp", "attack", "defense", "speed", "sp_attack", "sp_defense"] as const;
export const DISPLAY = [0, 1, 2, 4, 5, 3];
export const toDisplay = <T,>(values: T[]): T[] => DISPLAY.map((g) => values[g]);
export function toGame<T>(values: T[]): T[] {
  const out = new Array<T>(6);
  DISPLAY.forEach((g, d) => { out[g] = values[d]; });
  return out;
}
// Stats affected by the nature, in sNatureStatTable order (index in game order).
export const NATURE_STATS = [1, 2, 3, 4, 5];
export const NATURE_LABELS = ["Atk", "Def", "Spe", "SpA", "SpD"];

const ACRONYM = /^(PP|HP|TV|VS|S\.S\.|[TH]M\d*)$/i;

// Uppercase game names made readable: "HO-OH" becomes "Ho-Oh", "POKé BALL" becomes "Poké Ball".
export function pretty(name: string): string {
  return String(name).split(" ").map((word) => (ACRONYM.test(word) ? word.toUpperCase()
    : word.toLowerCase().replace(/(^|[.-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()))).join(" ");
}

export function prettyMap(name: string): string {
  return name.split("_").map((word) => word.replace(/^([A-Z]+)(\d+)$/, "$1 $2").split(" ")
    .map((w) => (/\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(" ")).join(" ");
}

export const num = (n: number) => new Intl.NumberFormat(locale()).format(n);
export const seconds = (ms: number) => `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(ms / 1000)} s`;
export const hex = (n: number, width = 4) => n.toString(16).toUpperCase().padStart(width, "0");
export const compare = (a: string, b: string) => new Intl.Collator(locale(), { numeric: true }).compare(a, b);

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const hexToBytes = (text: string) => new Uint8Array((text.match(/../g) ?? []).map((b) => parseInt(b, 16)));
export const bytesToHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function parseHex(text: string, digits: number, label: string): string {
  const clean = String(text ?? "").trim().replace(/^0x/i, "");
  if (!new RegExp(`^[0-9a-f]{1,${digits}}$`, "i").test(clean)) throw new Error(t("{label}: use até {digits} dígitos hexadecimais", { label, digits }));
  return clean.toUpperCase();
}

export function optionalInt(value: string | number | undefined | null, label: string, lo: number, hi: number): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(t("{label}: use um número de {lo} a {hi}", { label, lo, hi }));
  return n;
}
