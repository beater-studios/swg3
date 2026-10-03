// RNG calibration: which seed and advance the player hit, to adjust the timer (like ten-lines' calibration table).
// This is the project's only RNG implementation (frozen vectors in web/tests/vectors/frozen/).
import { t } from "../../i18n";
import { STATS, type Stat, type StatValues } from "./pk3";
import { advance, type Method } from "./rng";
import * as switchseed from "./switchseed";
import { compileArea, encounterInto, ivsObject, newScratch, type Area, type AreaTable, type Rod } from "./wild";

// LCG constants copied from rng.ts: in Vitest each read of an import is a getter call, too slow for the long loops.
const MULT = 0x41c64e6d, ADD = 0x6073, NUM_NATURES = 25;

export interface Hit {
  entry: switchseed.Entry;
  advance: number;
  pid: number;
  ivs: StatValues;
  speciesId: number | null;
  level: number | null;
  method: Method;
}

export interface SearchOptions {
  nature?: number | null;
  /** Accepted IVs per stat (calculator output). */
  ivOptions?: Partial<Record<Stat, readonly number[]>> | null;
  kind?: "static" | "wild";
  areaTable?: AreaTable;
  area?: Area;
  rod?: Rod | null;
  chamber?: number | null;
  speciesId?: number | null;
  level?: number | null;
  /** Methods tested at each advance (1, 2, 4; see rng.ts). Default: only 1. */
  methods?: readonly Method[];
  progress?: (done: number, total: number) => void;
}

/** `scan` callback: entry position in `entries`, advance, PID, IVs (STATS order), species and level (-1 for static) and method. */
export type OnHit = (position: number, advance: number, pid: number, ivs: Uint8Array, speciesId: number, level: number, method: Method) => void;

/** 6 x 32 mask of accepted IVs, or null for no filter. */
function ivMask(options: SearchOptions["ivOptions"]): Uint8Array | null {
  if (!options || Object.keys(options).length === 0) return null;
  const mask = new Uint8Array(STATS.length * 32);
  STATS.forEach((stat, i) => {
    const allowed = options[stat];
    for (let iv = 0; iv < 32; iv++) mask[i * 32 + iv] = allowed === undefined || allowed.includes(iv) ? 1 : 0;
  });
  return mask;
}

function accepted(pid: number, ivs: Uint8Array, nature: number | null, mask: Uint8Array | null): boolean {
  if (nature !== null && pid % NUM_NATURES !== nature) return false;
  if (mask) for (let i = 0; i < 6; i++) if (!mask[i * 32 + ivs[i]]) return false;
  return true;
}

/** Candidates in `entries` (neighboring seeds) and advances [first, last], handed to `onHit` in order. */
export function scan(entries: readonly switchseed.Entry[], first: number, last: number, options: SearchOptions, onHit: OnHit): void {
  const nature = options.nature ?? null;
  const mask = ivMask(options.ivOptions);
  const wild = (options.kind ?? "static") !== "static";
  const compiled = wild ? compileArea(options.areaTable!, options.area!, options.rod, options.chamber) : null;
  const scratch = newScratch();
  const ivs = scratch.ivs;
  const into = encounterInto;
  const speciesId = options.speciesId ?? null, level = options.level ?? null;
  const methods = options.methods ?? [1];
  entries.forEach((entry, position) => {
    let state = advance(entry.seed, first);
    for (let n = first; n <= last; n++) {
      for (const method of methods) {
        if (compiled) {
          const found = into(state, compiled, scratch, method);
          if ((speciesId === null || found.speciesId === speciesId) && (level === null || found.level === level)
            && accepted(found.pid, ivs, nature, mask)) onHit(position, n, found.pid, ivs, found.speciesId, found.level, method);
        } else {
          // static_spread: PID from Random32() (first call in the low bits) and IVs from two calls, with one call
          // skipped before them (method 2) or between them (method 4).
          const s1 = (Math.imul(state, MULT) + ADD) >>> 0;
          const s2 = (Math.imul(s1, MULT) + ADD) >>> 0;
          let s3 = (Math.imul(s2, MULT) + ADD) >>> 0;
          if (method === 2) s3 = (Math.imul(s3, MULT) + ADD) >>> 0;
          let s4 = (Math.imul(s3, MULT) + ADD) >>> 0;
          if (method === 4) s4 = (Math.imul(s4, MULT) + ADD) >>> 0;
          const pid = ((s1 >>> 16) | ((s2 >>> 16) << 16)) >>> 0;
          const a = s3 >>> 16, b = s4 >>> 16;
          ivs[0] = a & 0x1f; ivs[1] = (a >>> 5) & 0x1f; ivs[2] = (a >>> 10) & 0x1f;
          ivs[3] = b & 0x1f; ivs[4] = (b >>> 5) & 0x1f; ivs[5] = (b >>> 10) & 0x1f;
          if (accepted(pid, ivs, nature, mask)) onHit(position, n, pid, ivs, -1, -1, method);
        }
      }
      state = (Math.imul(state, MULT) + ADD) >>> 0;
    }
    options.progress?.(position + 1, entries.length);
  });
}

export function search(entries: readonly switchseed.Entry[], first: number, last: number, options: SearchOptions = {}): Hit[] {
  const hits: Hit[] = [];
  scan(entries, first, last, options, (position, n, pid, ivs, speciesId, level, method) => {
    hits.push({ entry: entries[position], advance: n, pid, ivs: ivsObject(ivs), speciesId: speciesId < 0 ? null : speciesId, level: level < 0 ? null : level, method });
  });
  return hits;
}

/**
 * For OPTION menu combinations without a table: each entry becomes the seeds `shift - spread` to `shift + spread`
 * around the measured one (another combination shifts the seed by a few dozen cycles; docs/research/rng.md, not
 * verified on the console). Returns the entries and each one's offset, at the same position.
 */
export function shifted(entries: readonly switchseed.Entry[], shift: number, spread: number): [switchseed.Entry[], number[]] {
  const out: switchseed.Entry[] = [];
  const deltas: number[] = [];
  for (const entry of entries) {
    for (let d = shift - spread; d <= shift + spread; d++) {
      out.push({ ...entry, seed: (entry.seed + d) & 0xffff });
      deltas.push(d);
    }
  }
  return [out, deltas];
}

/** Seeds around the target seed (up to `leeway` on each side) and the target entry itself. */
export function window(game: unknown, setting: unknown, console: unknown, targetIndex: number, leeway: number): [readonly switchseed.Entry[], switchseed.Entry] {
  const entries = switchseed.table(game, setting, console);
  if (!(targetIndex >= 0 && targetIndex < entries.length)) {
    const error = new Error(t("seed {index} fora da tabela (0 a {last})", { index: targetIndex, last: entries.length - 1 }));
    error.name = "ValueError";
    throw error;
  }
  return [entries.slice(Math.max(0, targetIndex - leeway), targetIndex + leeway + 1), entries[targetIndex]];
}
