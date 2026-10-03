// A Pokémon in box names for Mettrich's Base64 writer (docs/research/base64-writer.md). Port of src/swg3/gen3/base64box.py.
// Ported from Gen3ACEPokemonBuilder (MankeyMite, GPLv3; `toBase64Emerald` in src/lib/gen3/builder.js), credited in CREDITS.md.
// The writer reading a symbol as the letter's value + 64 comes from the community (not verified here).

import { t } from "../../i18n";
import { pyRepr } from "../pyfmt";
import * as badwords from "./badwords";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?";
export const VALUES: ReadonlyMap<string, number> = new Map([...ALPHABET].map((c, i) => [c, i]));
export const SUBSTITUTIONS: Readonly<Record<string, string>> = {
  A: ".", B: "-", D: "…", E: "“", F: "”", G: "‘", H: "’", I: "♂", J: "♀", L: ",", N: "/",
};
export const SYMBOL_VALUES: ReadonlyMap<string, number> = (() => {
  const values = new Map(Object.entries(SUBSTITUTIONS).map(([letter, symbol]) => [symbol, VALUES.get(letter)! + 64]));
  // Same byte in the game: the keyboard apostrophe is ’ (0xB4) and the hyphen is U+2013 (0xAE).
  values.set("'", values.get("’")!);
  values.set("–", values.get("-")!);
  return values;
})();
export const BOXES = 14;
export const BOX_LENGTH = 8;
export const DATA_SIZE = 80;
const MAX_PASSES = 14;

export interface EncodedDict {
  boxes: string[];
  /** Boxes (1 to 14) shortened by shifting. */
  shortened: number[];
  substitutions: number;
  manual: Record<string, number>;
  blocked: Record<string, string[]>;
}

export class Encoded {
  /** Indices (0 to 13) of the boxes shortened by shifting. */
  readonly shortened = new Set<number>();
  substitutions = 0;
  /** Box (1 to 14) to how many uppercase letters were converted, in conversion order. */
  readonly manual = new Map<number, number>();
  /** Box (1 to 14) to the terms that would still block. */
  blocked = new Map<number, string[]>();

  constructor(readonly boxes: string[]) {}

  asDict(): EncodedDict {
    return {
      boxes: [...this.boxes],
      shortened: [...this.shortened].map((n) => n + 1).sort((a, b) => a - b),
      substitutions: this.substitutions,
      manual: Object.fromEntries([...this.manual].map(([k, v]) => [String(k), v])),
      blocked: Object.fromEntries([...this.blocked].map(([k, v]) => [String(k), v])),
    };
  }
}

const isLetter = (char: string) => /^[A-Za-z]$/.test(char);
const mod = (value: number, n: number) => ((value % n) + n) % n;

function termPositions(original: string, term: string): number[] | null {
  const box = original.toLowerCase();
  for (let start = 0; start < box.length; start++) {
    if (!isLetter(box[start])) continue;
    const positions: number[] = [];
    let k = 0;
    for (let index = start; index < box.length; index++) {
      if (!isLetter(box[index])) continue;
      if (box[index] !== term[k]) break;
      positions.push(index);
      k += 1;
      if (k === term.length) return positions;
    }
  }
  return null;
}

function capacityAfter(boxes: readonly string[], index: number): number {
  return boxes.slice(index + 1).reduce((sum, b) => sum + Math.max(0, BOX_LENGTH - b.length), 0);
}

function push(boxes: string[], index: number, carry: string): string {
  for (let j = index; j < BOXES; j++) {
    if (!carry) break;
    const combined = carry + boxes[j];
    boxes[j] = combined.slice(0, BOX_LENGTH);
    carry = combined.slice(BOX_LENGTH);
  }
  return carry;
}

const replaceAt = (text: string, index: number, char: string) => text.slice(0, index) + char + text.slice(index + 1);

/** Replaces the uppercase letter with a symbol, compensating the previous digit. False if not safe. */
function substitute(boxes: string[], boxIndex: number, charIndex: number): boolean {
  const symbol = SUBSTITUTIONS[boxes[boxIndex][charIndex]];
  if (symbol === undefined) return false;
  const position = (boxes.slice(0, boxIndex).reduce((sum, b) => sum + b.length, 0) + charIndex) % 4;
  if (position === 0) {
    boxes[boxIndex] = replaceAt(boxes[boxIndex], charIndex, symbol);
    return true;
  }
  let prevBox = boxIndex, prevChar = charIndex - 1;
  if (prevChar < 0) {
    prevBox -= 1;
    while (prevBox >= 0 && !boxes[prevBox]) prevBox -= 1;
    if (prevBox < 0) return false;
    prevChar = boxes[prevBox].length - 1;
  }
  const value = VALUES.get(boxes[prevBox][prevChar]);
  if (value === undefined) return false;
  let fixed: number;
  if (position === 1) fixed = mod(value - 1, 64);
  else if (position === 2) fixed = (value & 0x30) | mod((value & 0x0f) - 1, 16);
  else fixed = (value & 0x3c) | mod((value & 0x03) - 1, 4);
  boxes[prevBox] = replaceAt(boxes[prevBox], prevChar, ALPHABET[fixed]);
  boxes[boxIndex] = replaceAt(boxes[boxIndex], charIndex, symbol);
  return true;
}

function borrowPreviousLetter(boxes: string[], index: number): boolean {
  if (index < 1 || !boxes[index - 1] || !isLetter(boxes[index - 1].slice(-1))) return false;
  if (capacityAfter(boxes, index - 1) < 1) return false;
  const borrowed = boxes[index - 1].slice(-1);
  boxes[index - 1] = boxes[index - 1].slice(0, -1);
  return !push(boxes, index, borrowed);
}

function blockedCount(boxes: readonly string[]): number {
  return boxes.reduce((sum, b) => sum + (b ? badwords.matches(b).length : 0), 0);
}

function base64(data: Uint8Array): string {
  const standard = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < data.length; i += 3) {
    const n = (data[i] << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((data.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += standard[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/**
 * 80 bytes (game format) to the 14 box names. `convert`: boxes (1 to 14) whose name the console still rejected, to
 * replace every possible uppercase letter.
 */
export function encode(data: Uint8Array, switchSafe = true, convert: readonly number[] = []): Encoded {
  if (data.length !== DATA_SIZE) {
    throw new Error(t("{size} bytes; o writer grava {expected} (Pokémon de box)", { size: data.length, expected: DATA_SIZE }));
  }
  const stream = base64(data).replaceAll("+", "!").replaceAll("/", "?");
  const boxes: string[] = [];
  for (let i = 0; i < stream.length; i += BOX_LENGTH) boxes.push(stream.slice(i, i + BOX_LENGTH));
  while (boxes.length < BOXES) boxes.push("");
  const result = new Encoded(boxes);
  if (!switchSafe) return result;

  // 1. Shift: cut before the term's last letter, as late as possible.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let shifted = false;
    for (let index = 0; index < BOXES - 1; index++) {
      const box = boxes[index];
      if (!box) continue;
      const cuts: number[] = [];
      for (const term of badwords.matches(box)) {
        const positions = termPositions(box, term);
        if (positions && positions[positions.length - 1] >= 3) cuts.push(positions[positions.length - 1]);
      }
      const capacity = capacityAfter(boxes, index);
      const cut = [...cuts].sort((a, b) => b - a).find((c) => box.length - c <= capacity);
      if (cut === undefined) continue;
      boxes[index] = box.slice(0, cut);
      result.shortened.add(index);
      const leftover = push(boxes, index + 1, box.slice(cut));
      boxes[BOXES - 1] += leftover;
      shifted = true;
      break;
    }
    if (!shifted) break;
  }

  // 2. Symbol replacement on one letter of each remaining term.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (let index = 0; index < boxes.length && !changed; index++) {
      const box = boxes[index];
      if (!box) continue;
      for (const term of badwords.matches(box)) {
        const positions = termPositions(box, term) ?? [];
        if (positions.some((p) => box[p] in SUBSTITUTIONS && substitute(boxes, index, p))) {
          result.substitutions += 1;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }

  // 3. Boundary term at the start of the box: pull the last letter of the previous one.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = blockedCount(boxes);
    let reflowed = false;
    for (let index = 1; index < BOXES && !reflowed; index++) {
      const box = boxes[index];
      for (const term of box ? badwords.matches(box) : []) {
        if (!badwords.isBoundary(term)) continue;
        const positions = termPositions(box, term);
        if (!positions || positions[0] !== 0) continue;
        const candidate = [...boxes];
        if (!borrowPreviousLetter(candidate, index)) continue;
        if (badwords.matches(candidate[index]).includes(term) || blockedCount(candidate) >= before) continue;
        boxes.splice(0, boxes.length, ...candidate);
        result.shortened.add(index - 1);
        reflowed = true;
        break;
      }
    }
    if (!reflowed) break;
  }

  // 4. Manual conversion requested by the player.
  for (const number of [...new Set(convert)].sort((a, b) => a - b)) {
    if (!(number >= 1 && number <= BOXES)) throw new Error(t("box {number} fora de 1 a {max}", { number, max: BOXES }));
    let count = 0;
    for (let charIndex = 0; charIndex < boxes[number - 1].length; charIndex++) {
      if (substitute(boxes, number - 1, charIndex)) count += 1;
    }
    result.manual.set(number, count);
    result.substitutions += count;
  }

  result.blocked = new Map();
  boxes.forEach((box, i) => {
    const found = box ? badwords.matches(box) : [];
    if (found.length) result.blocked.set(i + 1, found);
  });
  return result;
}

/** Box names to the bytes the writer stores (symbol = letter value + 64). */
export function decode(boxes: readonly string[]): Uint8Array {
  const values: number[] = [];
  for (const char of boxes.join("")) {
    const value = VALUES.get(char) ?? SYMBOL_VALUES.get(char);
    if (value === undefined) throw new Error(t("caractere {char} não pertence ao Base64 do writer", { char: pyRepr(char) }));
    values.push(value);
  }
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const chunk = values.slice(i, i + 4);
    const v = [...chunk, 0, 0, 0, 0].slice(0, 4);
    const group = [
      ((v[0] << 2) + (v[1] >> 4)) & 0xff,
      (((v[1] & 0x0f) << 4) + (v[2] >> 2)) & 0xff,
      (((v[2] & 0x03) << 6) + v[3]) & 0xff,
    ];
    out.push(...group.slice(0, Math.max(0, chunk.length - 1)));
  }
  return Uint8Array.from(out);
}

/** Looks like a writer code: up to 14 boxes using only the alphabet and symbols, 107 characters total. */
export function isBase64Code(boxes: readonly string[]): boolean {
  const chars = [...boxes.join("")];
  return boxes.length > 0 && boxes.length <= BOXES && chars.length === 107 && chars.every((c) => VALUES.has(c) || SYMBOL_VALUES.has(c));
}
