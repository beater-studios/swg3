// Gen 3 text encoding (decomp charmap). Port of src/swg3/gen3/charset.py.
// The western table applies to every language except Japanese. For Japanese Pokémon (LANGUAGE_JAPANESE), the
// Japanese section (hiragana, katakana and punctuation) overlays the same bytes.

import enTsv from "@data/charmap_en.tsv?raw";
import jpTsv from "@data/charmap_jp.tsv?raw";
import { t } from "../../i18n";

export const TERMINATOR = 0xff;

interface Tables {
  decode: Map<number, string>;
  encode: Map<string, number>;
}

function read(text: string): Tables {
  const decode = new Map<number, string>();
  const encode = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    const value = parseInt(line.slice(0, tab), 16);
    const char = line.slice(tab + 1);
    // First occurrence wins, like Python's setdefault.
    if (!decode.has(value)) decode.set(value, char);
    if (!encode.has(char)) encode.set(char, value);
  }
  return { decode, encode };
}

let western: Tables | undefined;
let japanese: Tables | undefined;

function tables(jp = false): Tables {
  western ??= read(enTsv);
  if (!jp) return western;
  if (!japanese) {
    const extra = read(jpTsv);
    japanese = { decode: new Map([...western.decode, ...extra.decode]), encode: new Map([...western.encode, ...extra.encode]) };
  }
  return japanese;
}

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/** Game bytes to text, up to the terminator. A byte without a character becomes "\xNN". */
export function decode(data: ArrayLike<number>, jp = false): string {
  const table = tables(jp).decode;
  let out = "";
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value === TERMINATOR) break;
    out += table.get(value) ?? `\\x${hex2(value)}`;
  }
  return out;
}

/** Text to game bytes, terminated and padded to `length`. */
export function encode(text: string, length: number): Uint8Array {
  const table = tables().encode;
  const raw: number[] = [];
  for (const char of text) {
    const value = table.get(char);
    if (value === undefined) throw new Error(t("caractere sem codificação: '{char}'", { char }));
    raw.push(value);
  }
  if (raw.length > length) throw new Error(t("texto com {size} bytes, máximo {max}", { size: raw.length, max: length }));
  const out = new Uint8Array(length).fill(TERMINATOR);
  out.set(raw);
  return out;
}
