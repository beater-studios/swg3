// RNG service called by the pages: static and wild encounters, eggs, Switch seeds, IV calculator and calibration. Port of the
// functions in src/swg3/web.py; tools/parity/encounters.py vectors require responses and error messages identical to Python's.
// Parameter errors are ParamError with the message `web.call` returns (Python's KeyError message comes without quotes).

import { t } from "../../i18n";
import * as calibration from "../gen3/calibration";
import { EGG_METHODS, eggGeneratedFast, eggPickupInto, newPickupScratch, type EggMethod } from "../gen3/egg";
import { NATURES, STATS, type Stat, type StatValues } from "../gen3/pk3";
import { METHODS, Spread, advance, distance, type Method } from "../gen3/rng";
import * as species from "../gen3/species";
import * as switchseed from "../gen3/switchseed";
import { speciesNames, validSpecies, SPECIES_EGG } from "../gen3/validate";
import * as wild from "../gen3/wild";

// LCG constants copied from rng.ts: in Vitest each read of an import is a getter call, too slow for the long loops.
const MULT = 0x41c64e6d, ADD = 0x6073, NUM_NATURES = 25;

export const MAX_RANGE = 1_000_000; // advances per call
export const MAX_RESULTS = 1000;

export type Params = Record<string, unknown>;


export function pyRepr(value: unknown): string {
  if (value === undefined || value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") {
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    let out = quote;
    for (const ch of value) {
      const code = ch.codePointAt(0)!;
      if (ch === "\\") out += "\\\\";
      else if (ch === quote) out += "\\" + quote;
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else if (code < 0x20 || (code >= 0x7f && code <= 0xa0)) out += "\\x" + code.toString(16).padStart(2, "0");
      else out += ch;
    }
    return out + quote;
  }
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (typeof value === "object") return `{${Object.entries(value).map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(", ")}}`;
  return String(value);
}

const pyStr = (value: unknown) => (typeof value === "string" ? value : pyRepr(value));

/** Python truthiness (bool(value)) for JSON values. */
function truthy(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/** Python int() for JSON values, or null when Python would reject it. */
function pyInt(value: unknown): number | null {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string") {
    const match = /^\s*([+-]?)(\d+(?:_\d+)*)\s*$/.exec(value);
    if (!match) return null;
    const n = Number(match[2].replaceAll("_", ""));
    return match[1] === "-" ? -n : n;
  }
  return null;
}

function get(params: Params, key: string, fallback: unknown = null): unknown {
  return params[key] === undefined ? fallback : params[key];
}

export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

/** Module KeyError and ValueError become ParamError with Python's `str(error)` text. */
function asParamError(error: unknown): unknown {
  if (error instanceof ParamError || !(error instanceof Error)) return error;
  if (error.name === "KeyError") return new ParamError(error.message);
  if (error.name === "ValueError") return new ParamError(error.message);
  return error;
}

function guard<R>(fn: (params: Params) => R): (params?: Params) => R {
  return (params = {}) => {
    try {
      return fn(params);
    } catch (error) {
      throw asParamError(error);
    }
  };
}

// Parameters (_hex, _int, _ivs, _range, _limit, _species_id, _nature_set, _hp_type, _ids).

const hex = (value: number, width: number) => value.toString(16).toUpperCase().padStart(width, "0");

export function hexParam(params: Params, key: string, bits = 32): number {
  const value = get(params, key);
  if (value === null || value === "") throw new ParamError(t("{key}: obrigatório", { key }));
  let n: number;
  if (typeof value === "string") {
    let text = value.trim();
    if (text.startsWith("0x")) text = text.slice(2);
    if (text.startsWith("0X")) text = text.slice(2);
    // int(text, 16): sign, optional 0x prefix and _ between digits.
    const match = /^\s*([+-]?)(?:0[xX]_?)?([0-9a-fA-F]+(?:_[0-9a-fA-F]+)*)\s*$/.exec(text);
    if (!match) throw new ParamError(t("{key}: {value} não é hexadecimal", { key, value: pyRepr(value) }));
    n = parseInt(match[2].replaceAll("_", ""), 16);
    if (match[1] === "-") n = -n;
  } else if (typeof value === "boolean") {
    n = value ? 1 : 0;
  } else if (typeof value === "number" && Number.isInteger(value)) {
    n = value;
  } else {
    throw new ParamError(t("{key}: {value} não é hexadecimal", { key, value: pyRepr(value) }));
  }
  if (!(n >= 0 && n < 2 ** bits)) throw new ParamError(t("{key}: fora de 0 a {max}", { key, max: hex(2 ** bits - 1, 1) }));
  return n + 0;
}

export function intParam(params: Params, key: string, lo: number, hi: number, fallback: number | null = null): number | null {
  const value = get(params, key, fallback);
  if (value === null || value === "") return fallback;
  const n = pyInt(value);
  if (n === null) throw new ParamError(t("{key}: {value} não é número", { key, value: pyRepr(value) }));
  if (!(lo <= n && n <= hi)) throw new ParamError(t("{key}: fora de {lo} a {hi}", { key, lo, hi }));
  return n + 0;
}

function sequence(values: unknown, key: string): unknown[] {
  if (typeof values === "string") return Array.from(values);
  if (Array.isArray(values)) return values;
  throw new ParamError(t("{key}: esperados {count} valores", { key, count: STATS.length }));
}

/** IVs as a list of 6 (0 to 31), in STATS order, or null. */
function ivsParam(values: unknown, key: string): number[] | null {
  if (values === undefined || values === null) return null;
  const list = sequence(values, key);
  if (list.length !== STATS.length) throw new ParamError(t("{key}: esperados {count} valores", { key, count: STATS.length }));
  return STATS.map((stat, i) => intParam({ [stat]: list[i] }, stat, 0, 31, 0)!);
}

function evsParam(values: unknown, key: string): number[] | null {
  if (values === undefined || values === null) return null;
  const list = sequence(values, key);
  if (list.length !== STATS.length) throw new ParamError(t("{key}: esperados {count} valores", { key, count: STATS.length }));
  return STATS.map((stat, i) => intParam({ [stat]: list[i] }, stat, 0, 255, 0)!);
}

function rangeParam(params: Params): [number, number] {
  const first = intParam(params, "first", 0, 2 ** 32 - 1, 0)!;
  const last = intParam(params, "last", 0, 2 ** 32 - 1, first)!;
  if (last < first) throw new ParamError(t("last: menor que first"));
  if (last - first + 1 > MAX_RANGE) throw new ParamError(t("intervalo acima de {max} avanços por chamada", { max: MAX_RANGE }));
  return [first, last];
}

const limitParam = (params: Params) => intParam(params, "limit", 0, MAX_RESULTS, MAX_RESULTS)!;

function speciesParam(params: Params, key = "species"): number | null {
  const value = intParam(params, key, 0, SPECIES_EGG, null);
  if (value === null || value === 0) return null;
  if (!validSpecies(value)) throw new ParamError(t("{key}: espécie {species} inexistente", { key, species: value }));
  return value;
}

const LOWER_NATURES = NATURES.map((n) => n.toLowerCase());

function natureSet(names: unknown): Set<number> {
  const out = new Set<number>();
  for (const name of truthy(names) ? sequence(names, "natures") : []) {
    const index = typeof name === "string" ? LOWER_NATURES.indexOf(name.toLowerCase()) : -1;
    if (index < 0) throw new ParamError(t("nature desconhecida: {name}", { name: pyStr(name) }));
    out.add(index);
  }
  return out;
}

/** A single nature by name (Python's `_nature_set([name]).pop()`). */
const natureParam = (name: unknown) => natureSet([name]).values().next().value!;

function hpTypeParam(name: unknown): number | null {
  if (!truthy(name)) return null;
  const names = Array.from({ length: species.NUMBER_OF_MON_TYPES }, (_, i) => species.typeName(i));
  const index = typeof name === "string" ? names.indexOf(name) : -1;
  if (index < 0) throw new ParamError(t("tipo desconhecido: {name}", { name: pyStr(name) }));
  return index;
}

function idsParam(params: Params): [number | null, number | null] {
  return [intParam(params, "tid", 0, 0xffff), intParam(params, "sid", 0, 0xffff)];
}

/** Compiled filter: tests PID and IVs (array in STATS order) without allocating. */
export type FastFilter = (pid: number, ivs: ArrayLike<number>, speciesId: number | null) => boolean;

function hiddenPowerOf(ivs: ArrayLike<number>): [number, number] {
  let powerBits = 0, typeBits = 0;
  for (let i = 0; i < 6; i++) {
    powerBits += ((ivs[i] >> 1) & 1) << i;
    typeBits += (ivs[i] & 1) << i;
  }
  let moveType = Math.floor(((species.NUMBER_OF_MON_TYPES - 3) * typeBits) / 63) + 1;
  if (moveType >= species.TYPE_MYSTERY) moveType += 1;
  return [moveType, Math.floor((40 * powerBits) / 63) + 30];
}

/**
 * Filter by the common search fields: min_ivs, max_ivs, natures, shiny (with tid and sid), ability (0 or 1), gender
 * ('M' or 'F', requires the species), hp_type and hp_power (minimum). Validates in Python's order.
 */
export function compileFilter(params: Params): FastFilter {
  const low = ivsParam(get(params, "min_ivs"), "min_ivs");
  const high = ivsParam(get(params, "max_ivs"), "max_ivs");
  const natures = natureSet(get(params, "natures"));
  const [tid, sid] = idsParam(params);
  const shiny = truthy(get(params, "shiny"));
  if (shiny && (tid === null || sid === null)) throw new ParamError(t("shiny: informe TID e SID"));
  const ability = intParam(params, "ability", 0, 1);
  const rawGender = get(params, "gender");
  const gender = truthy(rawGender) ? rawGender : null;
  if (gender !== null && gender !== "M" && gender !== "F") throw new ParamError(t("gender: {gender}, esperado M ou F", { gender: pyRepr(gender) }));
  const hpType = hpTypeParam(get(params, "hp_type"));
  const hpPower = intParam(params, "hp_power", 30, 70, 30)!;
  const genderOf = species.gender;
  const natureMask = natures.size ? new Uint8Array(NUM_NATURES) : null;
  natures.forEach((n) => (natureMask![n] = 1));

  return (pid, ivs, speciesId) => {
    if (low) for (let i = 0; i < 6; i++) if (ivs[i] < low[i]) return false;
    if (high) for (let i = 0; i < 6; i++) if (ivs[i] > high[i]) return false;
    if (natureMask && !natureMask[pid % NUM_NATURES]) return false;
    if (ability !== null && (pid & 1) !== ability) return false;
    if (shiny && (tid! ^ sid! ^ (pid >>> 16) ^ (pid & 0xffff)) >= 8) return false;
    if (gender !== null && (speciesId === null || genderOf(speciesId, pid) !== gender)) return false;
    if (hpType !== null || hpPower > 30) {
      const [moveType, power] = hiddenPowerOf(ivs);
      if (hpType !== null && moveType !== hpType) return false;
      if (power < hpPower) return false;
    }
    return true;
  };
}

const ivList = (ivs: StatValues) => STATS.map((k) => ivs[k]);

export function spreadFilter(params: Params): (spread: Spread, speciesId?: number | null) => boolean {
  const test = compileFilter(params);
  return (spread, speciesId = null) => test(spread.pid, ivList(spread.ivs), speciesId);
}

function abilityName(speciesId: number, pidBit: number): string {
  const [first, second] = species.info(speciesId).abilities;
  return species.abilityName(pidBit && second ? second : first);
}

export interface SpreadDict {
  state: string;
  pid: string;
  nature: string;
  ivs: number[];
  ability: number;
  hidden_power: { type: string; power: number };
  shiny: boolean | null;
  gender?: species.Gender;
  ability_name?: string;
}

export function spreadDict(spread: Spread, tid: number | null = null, sid: number | null = null, speciesId: number | null = null): SpreadDict {
  const [moveType, power] = species.hiddenPower(spread.ivs);
  const out: SpreadDict = {
    state: hex(spread.seed, 8),
    pid: hex(spread.pid, 8),
    nature: NATURES[spread.nature],
    ivs: ivList(spread.ivs),
    ability: spread.pid & 1,
    hidden_power: { type: species.typeName(moveType), power },
    shiny: tid !== null && sid !== null ? spread.isShiny(tid, sid) : null,
  };
  if (speciesId !== null) {
    out.gender = species.gender(speciesId, spread.pid);
    out.ability_name = abilityName(speciesId, spread.pid & 1);
  }
  return out;
}

/** Wraps the filter to count every hit and keep only the first `limit`. */
export function bounded<A extends unknown[]>(accept: (...args: A) => boolean, limit: number): [(...args: A) => boolean, { count: number }] {
  const state = { count: 0 };
  const wrapper = (...args: A) => {
    if (!accept(...args)) return false;
    state.count += 1;
    return state.count <= limit;
  };
  return [wrapper, state];
}

export interface Meta {
  natures: string[];
  stats: string[];
  hp_types: string[];
  maps: Record<string, Record<string, string[]>>;
  rods: string[];
  species: { id: number; name: string }[];
  unown_letters: string;
  limits: { max_range: number; max_results: number };
}

let metaCache: Meta | undefined;

export function meta(_params?: Params): Meta {
  metaCache ??= {
    natures: [...NATURES],
    stats: [...STATS],
    hp_types: Array.from({ length: species.NUMBER_OF_MON_TYPES }, (_, i) => i)
      .filter((i) => i >= 1 && i !== species.TYPE_MYSTERY).map((i) => species.typeName(i)),
    maps: Object.fromEntries(Object.entries(wild.tables()).map(([version, maps]) =>
      [version, Object.fromEntries(Object.entries(maps).map(([name, areas]) => [name, Object.keys(areas).sort()]))])),
    rods: Object.keys(wild.FISHING),
    species: [...speciesNames()].sort((a, b) => a[0] - b[0]).filter(([id]) => validSpecies(id)).map(([id, name]) => ({ id, name })),
    unown_letters: wild.UNOWN_LETTERS,
    limits: { max_range: MAX_RANGE, max_results: MAX_RESULTS },
  };
  return metaCache;
}

function rodParam(params: Params): wild.Rod {
  const rod = get(params, "rod");
  if (typeof rod !== "string" || !Object.hasOwn(wild.FISHING, rod))
    throw new ParamError(t("rod: {rod}, esperado um de {options}", { rod: pyRepr(rod), options: Object.keys(wild.FISHING).join(", ") }));
  return rod as wild.Rod;
}

function methodParam(params: Params): Method | null {
  const value = get(params, "method");
  if (value === null || value === "") return null;
  const n = pyInt(value);
  if (n === null || !(METHODS as readonly number[]).includes(n)) throw new ParamError(t("method: esperado 1, 2 ou 4"));
  return n as Method;
}

function methodsParam(params: Params): Method[] | null {
  const value = get(params, "methods");
  if (value === null) return null;
  const list = sequence(value, "methods").map((v) => methodParam({ method: v }));
  if (!list.length || list.includes(null)) throw new ParamError(t("method: esperado 1, 2 ou 4"));
  return [...new Set(list as Method[])];
}

export interface AreaSlot {
  slot: number;
  species: string;
  species_id: number;
  min_level: number;
  max_level: number;
  chance: number;
  letter?: string;
}

export const area = guard((params): { rate: number; slots: AreaSlot[] } => {
  const version = get(params, "version"), mapName = get(params, "map"), areaName = get(params, "area");
  const table = wild.table(version, mapName, areaName);
  const [limits, firstSlot] = areaName === "fishing" ? wild.FISHING[rodParam(params)] : [wild.AREAS[areaName as keyof typeof wild.AREAS], 0];
  const chamber = wild.chamberIndex(mapName);
  const slots = limits.map((limit, index) => {
    const slot = firstSlot + index;
    const [name, speciesId, minLevel, maxLevel] = table.mons[slot];
    const entry: AreaSlot = { slot, species: name, species_id: speciesId, min_level: minLevel, max_level: maxLevel, chance: limit - (index ? limits[index - 1] : 0) };
    if (speciesId === wild.UNOWN && chamber !== null) entry.letter = wild.UNOWN_LETTERS[wild.UNOWN_LETTER_SLOTS[chamber][slot]];
    return entry;
  });
  return { rate: table.rate, slots };
});

/** Only with `alt_seeds`: in how many of the seeds (main and alternatives) the same frame advance passes the filters. */
export interface Tolerance { tolerance?: number; tolerance_of?: number }

export type StaticResult = SpreadDict & Tolerance & { advance: number; method?: Method };

/** Alternative seeds (values the console may give at the same instant), for tolerance; null without the parameter. */
function altSeedsParam(params: Params): number[] | null {
  const value = get(params, "alt_seeds");
  if (value === null) return null;
  return sequence(value, "alt_seeds").map((v) => hexParam({ alt_seeds: v }, "alt_seeds", 16));
}

function tolerance(alts: number[], n: number, passes: (state: number) => boolean): Tolerance {
  let hits = 1;
  for (const alt of alts) if (passes(advance(alt, n))) hits++;
  return { tolerance: hits, tolerance_of: alts.length + 1 };
}
export interface SearchResult<T> {
  count: number;
  results: T[];
}

export const searchStatic = guard((params): SearchResult<StaticResult> => {
  const seed = hexParam(params, "seed");
  const [first, last] = rangeParam(params);
  const speciesId = speciesParam(params);
  const [tid, sid] = idsParam(params);
  const accept = compileFilter(params);
  const limit = limitParam(params);
  const chosen = methodParam(params);
  const method = chosen ?? 1;
  const alts = altSeedsParam(params);
  const ivs = new Uint8Array(6);
  // Same computation as the loop, for the alternative seeds (own array: does not touch the current result).
  const altIvs = new Uint8Array(6);
  const staticPasses = (from: number) => {
    const s1 = (Math.imul(from, MULT) + ADD) >>> 0;
    const s2 = (Math.imul(s1, MULT) + ADD) >>> 0;
    let s3 = (Math.imul(s2, MULT) + ADD) >>> 0;
    if (method === 2) s3 = (Math.imul(s3, MULT) + ADD) >>> 0;
    let s4 = (Math.imul(s3, MULT) + ADD) >>> 0;
    if (method === 4) s4 = (Math.imul(s4, MULT) + ADD) >>> 0;
    const a = s3 >>> 16, b = s4 >>> 16;
    altIvs[0] = a & 0x1f; altIvs[1] = (a >>> 5) & 0x1f; altIvs[2] = (a >>> 10) & 0x1f;
    altIvs[3] = b & 0x1f; altIvs[4] = (b >>> 5) & 0x1f; altIvs[5] = (b >>> 10) & 0x1f;
    return accept(((s1 >>> 16) | ((s2 >>> 16) << 16)) >>> 0, altIvs, speciesId);
  };
  const results: StaticResult[] = [];
  let count = 0;
  let state = advance(seed, first);
  for (let n = first; n <= last; n++) {
    // static_spread: PID from Random32() (first call in the low bits) and IVs from two calls, with one call skipped
    // before them (method 2) or between them (method 4).
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
    if (accept(pid, ivs, speciesId) && ++count <= limit) {
      const entry: StaticResult = { advance: n, ...spreadDict(new Spread(state, pid, wild.ivsObject(ivs), method === 1 ? 4 : 5), tid, sid, speciesId) };
      if (chosen !== null) entry.method = method;
      if (alts) Object.assign(entry, tolerance(alts, n, staticPasses));
      results.push(entry);
    }
    state = s1;
  }
  return { count, results };
});

export type WildResult = SpreadDict & Tolerance & { advance: number; slot: number; species: string; species_id: number; level: number; letter?: string; method?: Method };

export const searchWild = guard((params): SearchResult<WildResult> => {
  const seed = hexParam(params, "seed");
  const [first, last] = rangeParam(params);
  const version = get(params, "version"), mapName = get(params, "map"), areaName = get(params, "area");
  const table = wild.table(version, mapName, areaName);
  const rod = areaName === "fishing" ? rodParam(params) : null;
  const chamber = wild.chamberIndex(mapName);
  const wantSpecies = speciesParam(params);
  const level = intParam(params, "level", 1, 100);
  const rawLetter = get(params, "letter");
  const letter = truthy(rawLetter) ? rawLetter : null;
  // Python's `letter not in UNOWN_LETTERS` is a substring test.
  if (letter !== null && !(typeof letter === "string" && wild.UNOWN_LETTERS.includes(letter))) throw new ParamError(`letter: ${pyRepr(letter)}`);
  const [tid, sid] = idsParam(params);
  const accept = compileFilter(params);
  const limit = limitParam(params);
  const chosen = methodParam(params);
  const method = chosen ?? 1;
  const alts = altSeedsParam(params);

  const compiled = wild.compileArea(table, areaName as wild.Area, rod, chamber);
  const scratch = wild.newScratch();
  const altScratch = wild.newScratch();
  // Import reads hoisted out of the loop (see MULT above).
  const encounterInto = wild.encounterInto, unownLetter = wild.unownLetter, UNOWN = wild.UNOWN, LETTERS = wild.UNOWN_LETTERS;
  const results: WildResult[] = [];
  let count = 0;
  let state = advance(seed, first);
  for (let n = first; n <= last; n++) {
    const found = encounterInto(state, compiled, scratch, method);
    if ((wantSpecies === null || found.speciesId === wantSpecies)
      && (level === null || found.level === level)
      && (letter === null || (found.speciesId === UNOWN && LETTERS[unownLetter(found.pid)] === letter))
      && accept(found.pid, found.ivs, found.speciesId)
      && ++count <= limit) {
      const entry: WildResult = {
        advance: n, slot: found.slot, species: table.mons[found.slot][0], species_id: found.speciesId, level: found.level,
        ...spreadDict(new Spread(state, found.pid, wild.ivsObject(found.ivs), found.calls), tid, sid, found.speciesId),
      };
      if (found.speciesId === UNOWN) entry.letter = LETTERS[unownLetter(found.pid)];
      if (chosen !== null) entry.method = method;
      if (alts) Object.assign(entry, tolerance(alts, n, (from) => {
        const other = encounterInto(from, compiled, altScratch, method);
        return (wantSpecies === null || other.speciesId === wantSpecies) && (level === null || other.level === level)
          && (letter === null || (other.speciesId === UNOWN && LETTERS[unownLetter(other.pid)] === letter))
          && accept(other.pid, other.ivs, other.speciesId);
      }));
      results.push(entry);
    }
    state = (Math.imul(state, MULT) + ADD) >>> 0;
  }
  return { count, results };
});

export interface EggHeldResult {
  advance: number;
  state: string;
  low: string;
  ability: number;
  gender?: species.Gender;
  ability_name?: string;
}

export const searchEggHeld = guard((params): SearchResult<EggHeldResult> => {
  const seed = hexParam(params, "seed");
  const [first, last] = rangeParam(params);
  const compatibility = intParam(params, "compatibility", 0, 100, 50)!;
  if (compatibility !== 20 && compatibility !== 50 && compatibility !== 70) throw new ParamError(t("compatibility: esperado 20, 50 ou 70"));
  const speciesId = speciesParam(params);
  const rawGender = get(params, "gender");
  const gender = truthy(rawGender) ? rawGender : null;
  if (gender !== null && speciesId === null) throw new ParamError(t("gender: informe a espécie do ovo"));
  const ability = intParam(params, "ability", 0, 1);
  const limit = limitParam(params);
  const results: EggHeldResult[] = [];
  const generated = eggGeneratedFast;
  let count = 0;
  let state = advance(seed, first);
  for (let n = first; n <= last; n++) {
    const low = generated(state, compatibility);
    if (low >= 0) {
      const sex = speciesId !== null ? species.gender(speciesId, low) : null;
      if ((gender === null || sex === gender) && (ability === null || (low & 1) === ability) && ++count <= limit) {
        const entry: EggHeldResult = { advance: n, state: hex(state, 8), low: hex(low, 4), ability: low & 1 };
        if (speciesId !== null) {
          entry.gender = sex!;
          entry.ability_name = abilityName(speciesId, low & 1);
        }
        results.push(entry);
      }
    }
    state = (Math.imul(state, MULT) + ADD) >>> 0;
  }
  return { count, results };
});

export type EggPickupResult = SpreadDict & Tolerance & { advance: number; inherited: { stat: Stat; parent: number }[]; parents_applied: boolean; method?: EggMethod };

export const searchEggPickup = guard((params): SearchResult<EggPickupResult> => {
  const seed = hexParam(params, "seed");
  const [first, last] = rangeParam(params);
  const low = hexParam(params, "low", 16);
  const parent0 = ivsParam(get(params, "parent0"), "parent0");
  const parent1 = ivsParam(get(params, "parent1"), "parent1");
  if ((parent0 === null) !== (parent1 === null)) throw new ParamError(t("informe os IVs dos dois pais ou de nenhum"));
  const parents = parent0 !== null ? ([parent0, parent1!] as const) : null;
  const speciesId = speciesParam(params);
  const [tid, sid] = idsParam(params);
  const accept = compileFilter({ ...params, gender: undefined });
  const limit = limitParam(params);
  // "all": tests the four methods at each advance and tags each result with its method.
  const rawMethod = get(params, "method", "bred");
  const all = rawMethod === "all";
  if (!all && (typeof rawMethod !== "string" || !Object.hasOwn(EGG_METHODS, rawMethod)))
    throw new ParamError(t("method: esperado um de {options}", { options: [...Object.keys(EGG_METHODS), "all"].join(", ") }));
  const methods = all ? (Object.keys(EGG_METHODS) as EggMethod[]) : [rawMethod as EggMethod];
  const alts = altSeedsParam(params);
  const altScratch = newPickupScratch();
  const scratch = newPickupScratch();
  const pickup = eggPickupInto;
  const results: EggPickupResult[] = [];
  let count = 0;
  let state = advance(seed, first);
  for (let n = first; n <= last; n++) {
    for (const method of methods) {
      const found = pickup(state, low, parents, scratch, method);
      if (accept(found.pid, found.ivs, speciesId) && ++count <= limit) {
        const entry: EggPickupResult = {
          advance: n,
          ...spreadDict(new Spread(state, found.pid, wild.ivsObject(found.ivs), found.calls), tid, sid, speciesId),
          inherited: Array.from(found.stats, (stat, i) => ({ stat: STATS[stat], parent: found.parents[i] })),
          parents_applied: parents !== null,
        };
        if (all) entry.method = method;
        if (alts) Object.assign(entry, tolerance(alts, n, (from) => {
          const other = pickup(from, low, parents, altScratch, method);
          return accept(other.pid, other.ivs, speciesId);
        }));
        results.push(entry);
      }
    }
    state = (Math.imul(state, MULT) + ADD) >>> 0;
  }
  return { count, results };
});

export const rngAdvance = guard((params): { state: string; random: string } => {
  const seed = hexParam(params, "seed");
  const n = intParam(params, "advances", -(2 ** 32), 2 ** 32, 0)!;
  const state = advance(seed, n);
  return { state: hex(state, 8), random: hex(state >>> 16, 4) };
});

export const rngDistance = guard((params): { advances: number } => ({
  advances: distance(hexParam(params, "origin"), hexParam(params, "target")),
}));

export interface SeedSettings {
  settings: { key: string; label: string }[];
  consoles: { key: string; label: string }[];
  fetched: string;
}

export const seedSettings = guard((params): SeedSettings => ({
  settings: switchseed.settings(get(params, "game", "firered")).map((key) => ({ key, label: switchseed.describe(key) })),
  consoles: [{ key: "switch1", label: "Switch" }, { key: "switch2", label: t("Switch 2 (750 ms antes)") }],
  fetched: switchseed.data().fetched,
}));

export const seedTable = guard((params): { entries: { index: number; seed: string; ms: number }[] } => {
  const entries = switchseed.table(get(params, "game", "firered"), get(params, "setting", ""), get(params, "console", "switch1"));
  return { entries: entries.map((e) => ({ index: e.index, seed: hex(e.seed, 4), ms: e.ms })) };
});

function ivListsParam(values: unknown, key: string): Record<Stat, number[]> | null {
  if (values === undefined || values === null) return null;
  const list = sequence(values, key);
  if (list.length !== STATS.length) throw new ParamError(t("{key}: esperados {count} valores", { key, count: STATS.length }));
  const out = {} as Record<Stat, number[]>;
  STATS.forEach((stat, i) => {
    out[stat] = sequence(list[i], key).map((v) => {
      const n = pyInt(v);
      // Non-standard Python int(): the message is Python's own (ValueError).
      if (n === null) throw new ParamError(`invalid literal for int() with base 10: ${pyRepr(v)}`);
      return n;
    });
  });
  return out;
}

export const ivCalc = guard((params): { options: number[][]; impossible: boolean } => {
  const speciesId = speciesParam(params);
  if (speciesId === null) throw new ParamError(t("{key}: obrigatório", { key: "species" }));
  const nature = truthy(get(params, "nature")) ? natureParam(get(params, "nature")) : null;
  if (nature === null) throw new ParamError(t("nature: obrigatória"));
  const observations: species.Observation[] = [];
  const rows = get(params, "observations");
  for (const row of (truthy(rows) ? sequence(rows, "observations") : []) as Params[]) {
    const level = intParam(row, "level", 1, 100);
    const stats = truthy(get(row, "stats")) ? sequence(get(row, "stats"), "stats") : [];
    if (level === null || stats.length !== STATS.length) throw new ParamError(t("cada linha precisa de nível e dos 6 stats"));
    const values = {} as StatValues;
    STATS.forEach((k, i) => (values[k] = intParam({ [k]: stats[i] }, k, 1, 999) as number));
    observations.push([level, values]);
  }
  if (!observations.length) throw new ParamError(t("informe pelo menos uma linha de stats"));
  const evs = truthy(get(params, "evs")) ? evsParam(get(params, "evs"), "evs") : null;
  const evSlack = intParam(params, "ev_slack", 0, 255, 0)!;
  const options = species.possibleIvs(speciesId, nature, observations, evs ? wild.ivsObject(evs) : null, evSlack);
  return { options: STATS.map((k) => options[k]), impossible: STATS.some((k) => !options[k].length) };
});

export interface CalibrateResult {
  target: { index: number; seed: string; ms: number; advance: number };
  count: number;
  results: {
    seed_index: number; seed: string; ms: number; dms: number; advance: number; dadv: number;
    pid: string; nature: string; ivs: number[]; species?: string | null; level?: number;
    /** Only with seed_shift or seed_spread: seed offset relative to the reference table's. */
    dseed?: number;
    /** Only with `methods`: the hit's method (1, 2 or 4). */
    method?: Method;
    /** Only with `second`: the second Pokémon of the same attempt, found after the first on the same seed. */
    second?: { advance: number; method: Method; pid: string; nature: string; ivs: number[]; species: string | null; level: number };
  }[];
}

interface WildTarget {
  options: calibration.SearchOptions;
  gender: species.Gender | null;
}

function wildTarget(params: Params, fallbackVersion: unknown, methods: Method[]): WildTarget {
  const version = get(params, "version", fallbackVersion), mapName = get(params, "map"), areaName = get(params, "area");
  const nature = truthy(get(params, "nature")) ? natureParam(get(params, "nature")) : null;
  const rawGender = get(params, "gender");
  if (truthy(rawGender) && rawGender !== "M" && rawGender !== "F") throw new ParamError(t("gender: esperado M ou F"));
  return {
    options: {
      nature, ivOptions: ivListsParam(get(params, "iv_options"), "iv_options"), kind: "wild",
      areaTable: wild.table(version, mapName, areaName), area: areaName as wild.Area,
      rod: areaName === "fishing" ? (get(params, "rod") as wild.Rod) : null, chamber: wild.chamberIndex(mapName),
      speciesId: speciesParam(params), level: intParam(params, "level", 1, 100), methods,
    },
    gender: truthy(rawGender) ? (rawGender as species.Gender) : null,
  };
}

/** Gender matches (or was not requested). Genderless or fixed-gender species accept any matching request. */
function genderMatches(want: species.Gender | null, speciesId: number, pid: number): boolean {
  return want === null || speciesId < 0 || species.gender(speciesId, pid) === want;
}

/**
 * Neighboring seeds and advances around the target that give the Pokémon that came out: all hits, stably sorted by
 * seed distance then advance distance. Each seed keeps only its first MAX_RESULTS by advance distance, and seeds at the
 * same distance are interleaved, which gives the same list without storing everything.
 */
export function calibrate(params: Params = {}, onProgress?: (done: number, total: number) => void): CalibrateResult {
  try {
    return calibrateImpl(params, onProgress);
  } catch (error) {
    throw asParamError(error);
  }
}

function calibrateImpl(params: Params, onProgress?: (done: number, total: number) => void): CalibrateResult {
  const game = get(params, "game", "firered"), setting = get(params, "setting", ""), console = get(params, "console", "switch1");
  const targetIndex = intParam(params, "target_index", 0, 100_000);
  const leeway = intParam(params, "leeway", 0, 200, 10)!;
  const targetAdvance = intParam(params, "target_advance", 0, 2 ** 32 - 1);
  const spread = intParam(params, "window", 0, 20_000, 200)!;
  if (targetIndex === null || targetAdvance === null) throw new ParamError(t("informe a seed e o avanço mirados"));
  const [tableEntries, target] = calibration.window(game, setting, console, targetIndex, leeway);
  // Combination without a table: tests seeds shifted around those of the reference combination.
  const seedShift = intParam(params, "seed_shift", -0x100, 0x100, 0)!;
  const seedSpread = intParam(params, "seed_spread", 0, 0x100, 0)!;
  const shifting = seedShift !== 0 || seedSpread !== 0;
  const [entries, deltas] = shifting ? calibration.shifted(tableEntries, seedShift, seedSpread) : [tableEntries, null];
  const nature = truthy(get(params, "nature")) ? natureParam(get(params, "nature")) : null;
  const ivOptions = ivListsParam(get(params, "iv_options"), "iv_options");
  const first = Math.max(0, targetAdvance - spread), last = targetAdvance + spread;
  const kind = get(params, "kind", "static");
  const methods = methodsParam(params);
  let options: calibration.SearchOptions = { nature, ivOptions, kind: "static", methods: methods ?? [1] };
  let wantGender: species.Gender | null = null;
  if (kind === "wild") {
    ({ options, gender: wantGender } = wildTarget(params, game, methods ?? [1]));
  } else if (kind !== "static") {
    throw new ParamError(t("kind: {kind}, esperado static ou wild", { kind: pyRepr(kind) }));
  }
  // Second Pokémon of the same attempt: must come out on the same seed, after the first (up to `window` advances
  // later). Only hits of the first that have such a second are kept.
  const rawSecond = get(params, "second");
  const second = truthy(rawSecond) ? wildTarget(rawSecond as Params, game, methods ?? [1]) : null;
  const secondWindow = second ? intParam(rawSecond as Params, "window", 1, 200_000, 30_000)! : 0;
  type SecondHit = NonNullable<CalibrateResult["results"][number]["second"]>;
  const findSecond = (seed: number, after: number): SecondHit | null => {
    if (!second) return null;
    let found: SecondHit | null = null;
    const one = [{ index: 0, row: 0, seed, frames: 0, ms: 0 }];
    calibration.scan(one, after + 1, after + secondWindow, second.options, (_p, n, pid, ivs, speciesId, level, method) => {
      if (found || !genderMatches(second.gender, speciesId, pid)) return;
      found = { advance: n, method, pid: hex(pid, 8), nature: NATURES[pid % NUM_NATURES], ivs: [...ivs], species: speciesNames().get(speciesId) ?? null, level };
    });
    return found;
  };
  const seconds = new Map<string, SecondHit>();

  if (onProgress) options = { ...options, progress: onProgress };
  let scanWith = calibration.scan;
  // Hits per seed, in arrays: advance, PID, IVs (5 bits each) and species/level.
  type Kept = { position: number; advance: number; pid: number; ivs: number; species: number; level: number; method: Method }[];
  if (options.kind === "wild" && (wantGender !== null || second)) {
    const inner = calibration.scan;
    const filtered: typeof calibration.scan = (list, a, b, opts, onHit) => inner(list, a, b, opts, (position, n, pid, ivs, speciesId, level, method) => {
      if (!genderMatches(wantGender, speciesId, pid)) return;
      if (second) {
        const key = `${list[position].seed}:${n}`;
        const hit = seconds.has(key) ? seconds.get(key)! : findSecond(list[position].seed, n);
        if (!hit) return;
        seconds.set(key, hit);
      }
      onHit(position, n, pid, ivs, speciesId, level, method);
    });
    scanWith = filtered;
  }
  const kept: Kept[] = entries.map(() => []);
  let count = 0;
  let current = -1;
  let buffer: Kept = [];
  const flush = () => {
    if (current < 0) return;
    buffer.sort((a, b) => Math.abs(a.advance - targetAdvance) - Math.abs(b.advance - targetAdvance));
    kept[current] = buffer.slice(0, MAX_RESULTS);
    buffer = [];
  };
  scanWith(entries, first, last, options, (position, n, pid, ivs, speciesId, level, method) => {
    count++;
    if (position !== current) {
      flush();
      current = position;
    }
    let packed = 0;
    for (let i = 5; i >= 0; i--) packed = packed * 32 + ivs[i];
    buffer.push({ position, advance: n, pid, ivs: packed, species: speciesId, level, method });
  });
  flush();

  // Groups by seed distance (and shift, when present); within a group, advance distance and then the original order.
  // With a shift, 8 seed values weigh as 1 table row: on the measured console the seed landed up to about 20 values
  // off the table (docs/research/rng.md).
  const groups = new Map<number, Kept>();
  entries.forEach((entry, position) => {
    const d = Math.abs(entry.index - target.index) * (deltas ? 8 : 0x400) + (deltas ? Math.abs(deltas[position] - seedShift) : 0);
    groups.set(d, [...(groups.get(d) ?? []), ...kept[position]]);
  });
  const ordered: Kept = [];
  for (const d of [...groups.keys()].sort((a, b) => a - b)) {
    if (ordered.length >= MAX_RESULTS) break;
    const group = groups.get(d)!;
    group.sort((a, b) => Math.abs(a.advance - targetAdvance) - Math.abs(b.advance - targetAdvance) || a.position - b.position || a.advance - b.advance);
    ordered.push(...group.slice(0, MAX_RESULTS - ordered.length));
  }

  const names = speciesNames();
  const results = ordered.map((hit) => {
    const entry = entries[hit.position];
    const out: CalibrateResult["results"][number] = {
      seed_index: entry.index, seed: hex(entry.seed, 4), ms: entry.ms, dms: entry.ms - target.ms,
      advance: hit.advance, dadv: hit.advance - targetAdvance, pid: hex(hit.pid, 8), nature: NATURES[hit.pid % NUM_NATURES],
      ivs: STATS.map((_, i) => Math.floor(hit.ivs / 32 ** i) % 32),
    };
    if (hit.species >= 0) {
      out.species = names.get(hit.species) ?? null;
      out.level = hit.level;
    }
    if (deltas) out.dseed = deltas[hit.position];
    if (methods) out.method = hit.method;
    if (second) out.second = seconds.get(`${entry.seed}:${hit.advance}`);
    return out;
  });
  return { target: { index: target.index, seed: hex(target.seed, 4), ms: target.ms, advance: targetAdvance }, count, results };
}

/** Functions by their web.py name, for the worker and for parity. */
export const FUNCTIONS = {
  meta,
  area,
  search_static: searchStatic,
  search_wild: searchWild,
  search_egg_held: searchEggHeld,
  search_egg_pickup: searchEggPickup,
  rng_advance: rngAdvance,
  rng_distance: rngDistance,
  seed_settings: seedSettings,
  seed_table: seedTable,
  iv_calc: ivCalc,
  calibrate,
} as const;

export type FunctionName = keyof typeof FUNCTIONS;

/** Like `web.call`: {ok: true, result} or {ok: false, error} with the ParamError message. */
export function call(name: string, params: Params = {}): { ok: true; result: unknown } | { ok: false; error: string } {
  if (!Object.hasOwn(FUNCTIONS, name)) return { ok: false, error: t("função desconhecida: {name}", { name }) };
  try {
    return { ok: true, result: FUNCTIONS[name as FunctionName](params) };
  } catch (error) {
    if (error instanceof ParamError) return { ok: false, error: error.message };
    throw error;
  }
}
