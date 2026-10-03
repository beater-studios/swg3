// FRLG wild encounters: slot, level, nature, PID and IVs from the RNG. The project's only RNG implementation (frozen vectors in
// web/tests/vectors/frozen/). Decomp (src/wild_encounter.c): call order slot (ChooseWildMonIndex_*), level (ChooseWildMonLevel),
// nature (GenerateWildMon), PID (CreateMonWithNature), IVs; rates from src/data/wild_encounters.h. Unown: in
// GenerateUnownPersonalityByLetter the Switch binary (0x080861F2) makes the FIRST call the HIGH half, unlike Random32().

import { t } from "../../i18n";
import raw from "@data/frlg_wild.json";
import { STATS, type StatValues } from "./pk3";
import { Rng, Spread, advance, generateIvs, nextSeed, pidForNature, type Method } from "./rng";

// LCG constants copied from rng.ts: in Vitest each read of an import is a getter call, too slow for the long loops.
const MULT = 0x41c64e6d, ADD = 0x6073, NUM_NATURES = 25;

/** Cumulative Random() % 100 thresholds for each slot. */
export const LAND = [20, 40, 50, 60, 70, 80, 85, 90, 94, 98, 99, 100] as const;
export const WATER = [60, 90, 95, 99, 100] as const;
export const ROCKS = WATER;

export type Rod = "old" | "good" | "super";
export type Area = "land" | "water" | "rock_smash" | "fishing";

/** Fishing: Random() % 100 shared by the three rods; each rod uses its own slot group ([thresholds, first slot]). */
export const FISHING: Record<Rod, readonly [readonly number[], number]> = {
  old: [[70, 100], 0],
  good: [[60, 80, 100], 2],
  super: [[40, 80, 95, 99, 100], 5],
};
export const AREAS: Record<Exclude<Area, "fishing">, readonly number[]> = { land: LAND, water: WATER, rock_smash: ROCKS };

export const UNOWN = 201;
export const NUM_UNOWN_FORMS = 28;
/** Chambers in map order (MAP_SEVEN_ISLAND_TANOBY_RUINS_*_CHAMBER, 27 to 33). */
export const TANOBY_CHAMBERS = ["MONEAN", "LIPTOO", "WEEPTH", "DILFORD", "SCUFIB", "RIXY", "VIAPOIS"] as const;
/** sUnownLetterSlots: letter per chamber and slot (0 = A ... 25 = Z, 26 = !, 27 = ?). */
export const UNOWN_LETTER_SLOTS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 27],
  [2, 2, 2, 3, 3, 3, 7, 7, 7, 20, 20, 14],
  [13, 13, 13, 13, 18, 18, 18, 18, 8, 8, 4, 4],
  [15, 15, 11, 11, 9, 9, 17, 17, 17, 16, 16, 16],
  [24, 24, 19, 19, 6, 6, 6, 5, 5, 5, 10, 10],
  [21, 21, 21, 22, 22, 22, 23, 23, 12, 12, 1, 1],
  [25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 26],
];
export const UNOWN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?";

/** Table slot: [SPECIES_ constant name, internal number, min level, max level]. */
export type WildMon = [name: string, speciesId: number, minLevel: number, maxLevel: number];
export interface AreaTable {
  rate: number;
  mons: WildMon[];
}
export type Tables = Record<string, Record<string, Partial<Record<Area, AreaTable>>>>;

const TABLES = raw as unknown as Tables;

/** Missing key error, like Python's KeyError (the service reproduces web.py's message). */
function keyError(message: string): Error {
  const error = new Error(message);
  error.name = "KeyError";
  return error;
}

function valueError(message: string): Error {
  const error = new Error(message);
  error.name = "ValueError";
  return error;
}

/** Python repr() for the values that appear in messages (strings, None). */
function repr(value: unknown): string {
  if (value === undefined || value === null) return "None";
  if (typeof value !== "string") return String(value);
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  return quote + value.replace(/\\/g, "\\\\").replaceAll(quote, "\\" + quote) + quote;
}

/** GET_UNOWN_LETTER (include/pokemon.h). */
export function unownLetter(pid: number): number {
  const value = ((pid & 0x03000000) >>> 18) | ((pid & 0x00030000) >>> 12) | ((pid & 0x00000300) >>> 6) | (pid & 3);
  return value % NUM_UNOWN_FORMS;
}

export function unownPid(rng: Rng, letter: number): number {
  for (;;) {
    const high = rng.random();
    const pid = ((high << 16) | rng.random()) >>> 0;
    if (unownLetter(pid) === letter) return pid;
  }
}

export function chamberIndex(mapName: unknown): number | null {
  const index = TANOBY_CHAMBERS.findIndex((chamber) => mapName === `SEVEN_ISLAND_TANOBY_RUINS_${chamber}_CHAMBER`);
  return index < 0 ? null : index;
}

export function tables(): Tables {
  return TABLES;
}

export function table(version: unknown, mapName: unknown, area: unknown): AreaTable {
  const byVersion = typeof version === "string" && Object.hasOwn(TABLES, version) ? TABLES[version] : undefined;
  const byMap = byVersion && typeof mapName === "string" && Object.hasOwn(byVersion, mapName) ? byVersion[mapName] : undefined;
  const found = byMap && typeof area === "string" && Object.hasOwn(byMap, area) ? byMap[area as Area] : undefined;
  if (!found) throw keyError(t("sem tabela {area} para {map} em {version}", { area: repr(area), map: repr(mapName), version: repr(version) }));
  return found;
}

function pick(roll: number, limits: readonly number[]): number {
  for (let index = 0; index < limits.length; index++) if (roll < limits[index]) return index;
  throw valueError(`roll ${roll} out of bounds (${limits.join(", ")})`);
}

function checkArea(area: unknown, rod: unknown): void {
  if (area === "fishing") {
    if (typeof rod !== "string" || !Object.hasOwn(FISHING, rod))
      throw valueError(t("vara {rod}, esperado um de {options}", { rod: repr(rod), options: Object.keys(FISHING).join(", ") }));
  } else if (typeof area !== "string" || !Object.hasOwn(AREAS, area)) {
    throw valueError(t("área {area}, esperado land, water, rock_smash ou fishing", { area: repr(area) }));
  }
}

export function chooseSlot(rng: Rng, area: Area, rod?: Rod | null): number {
  const roll = rng.random() % 100;
  checkArea(area, rod);
  if (area === "fishing") {
    const [limits, firstSlot] = FISHING[rod as Rod];
    return firstSlot + pick(roll, limits);
  }
  return pick(roll, AREAS[area]);
}

export function chooseLevel(rng: Rng, minLevel: number, maxLevel: number): number {
  const [lo, hi] = maxLevel >= minLevel ? [minLevel, maxLevel] : [maxLevel, minLevel];
  return lo + (rng.random() % (hi - lo + 1));
}

export interface WildEncounter {
  slot: number;
  species: string;
  speciesId: number;
  level: number;
  spread: Spread;
}

/**
 * Encounter generated from state `seed` when the game rolls the slot. `chamber` (0 to 6, TANOBY_CHAMBERS) is required
 * when the rolled slot is Unown.
 */
export function encounter(seed: number, areaTable: AreaTable, area: Area, rod?: Rod | null, chamber?: number | null, method: Method = 1): WildEncounter {
  const rng = new Rng(seed);
  const slot = chooseSlot(rng, area, rod);
  const [species, speciesId, minLevel, maxLevel] = areaTable.mons[slot];
  const level = chooseLevel(rng, minLevel, maxLevel);
  let pid: number;
  if (speciesId === UNOWN) {
    if (chamber === null || chamber === undefined) throw valueError(t("Unown exige a câmara de Tanoby (chamber)"));
    pid = unownPid(rng, UNOWN_LETTER_SLOTS[chamber][slot]);
  } else {
    const nature = rng.random() % NUM_NATURES;
    pid = pidForNature(rng, nature);
  }
  const ivs = generateIvs(rng, method);
  return { slot, species, speciesId, level, spread: new Spread(seed >>> 0, pid, ivs, rng.calls) };
}

export function search(
  initialSeed: number, first: number, last: number, areaTable: AreaTable, area: Area,
  accept: (found: WildEncounter) => boolean, rod?: Rod | null, chamber?: number | null, method: Method = 1,
): [number, WildEncounter][] {
  const found: [number, WildEncounter][] = [];
  let seed = advance(initialSeed, first);
  for (let n = first; n <= last; n++) {
    const result = encounter(seed, areaTable, area, rod, chamber, method);
    if (accept(result)) found.push([n, result]);
    seed = nextSeed(seed);
  }
  return found;
}

/** `encounterInto` result, reused across advances. `ivs` in STATS order. */
export interface EncounterScratch {
  slot: number;
  speciesId: number;
  level: number;
  pid: number;
  ivs: Uint8Array;
  calls: number;
}

export function newScratch(): EncounterScratch {
  return { slot: 0, speciesId: 0, level: 0, pid: 0, ivs: new Uint8Array(STATS.length), calls: 0 };
}

/** Precompiled area table: slot per roll (0 to 99) and per-slot data, with no lookup per advance. */
export interface CompiledArea {
  slotByRoll: Uint8Array;
  speciesIds: Int32Array;
  minLevels: Int32Array;
  spans: Int32Array;
  /** Unown letter per slot (Tanoby chamber), -1 outside the chambers. */
  letters: Int8Array;
  table: AreaTable;
}

export function compileArea(areaTable: AreaTable, area: Area, rod?: Rod | null, chamber?: number | null): CompiledArea {
  checkArea(area, rod);
  const [limits, firstSlot] = area === "fishing" ? FISHING[rod as Rod] : [AREAS[area], 0];
  const slotByRoll = new Uint8Array(100);
  for (let roll = 0; roll < 100; roll++) slotByRoll[roll] = firstSlot + pick(roll, limits);
  const count = areaTable.mons.length;
  const speciesIds = new Int32Array(count), minLevels = new Int32Array(count), spans = new Int32Array(count);
  const letters = new Int8Array(count).fill(-1);
  areaTable.mons.forEach(([, id, min, max], slot) => {
    const [lo, hi] = max >= min ? [min, max] : [max, min];
    speciesIds[slot] = id;
    minLevels[slot] = lo;
    spans[slot] = hi - lo + 1;
    if (id === UNOWN && chamber !== null && chamber !== undefined) letters[slot] = UNOWN_LETTER_SLOTS[chamber][slot];
  });
  return { slotByRoll, speciesIds, minLevels, spans, letters, table: areaTable };
}

/** Same as `encounter(seed, ...)`, writing into `out`. Returns `out`. */
export function encounterInto(seed: number, area: CompiledArea, out: EncounterScratch, method: Method = 1): EncounterScratch {
  let state = seed >>> 0;
  state = (Math.imul(state, MULT) + ADD) >>> 0;
  const slot = area.slotByRoll[(state >>> 16) % 100];
  state = (Math.imul(state, MULT) + ADD) >>> 0;
  const level = area.minLevels[slot] + ((state >>> 16) % area.spans[slot]);
  const speciesId = area.speciesIds[slot];
  let calls = 2;
  let pid: number;
  if (speciesId === UNOWN) {
    const letter = area.letters[slot];
    if (letter < 0) throw valueError(t("Unown exige a câmara de Tanoby (chamber)"));
    for (;;) {
      state = (Math.imul(state, MULT) + ADD) >>> 0;
      const high = state >>> 16;
      state = (Math.imul(state, MULT) + ADD) >>> 0;
      pid = ((high << 16) | (state >>> 16)) >>> 0;
      calls += 2;
      if (unownLetter(pid) === letter) break;
    }
  } else {
    state = (Math.imul(state, MULT) + ADD) >>> 0;
    const nature = (state >>> 16) % NUM_NATURES;
    calls += 1;
    // PID % 25 from the halves (65536 % 25 = 11), in small integers: avoids a floating-point remainder of a u32
    // above 2^31 on every iteration.
    for (;;) {
      state = (Math.imul(state, MULT) + ADD) >>> 0;
      const low = state >>> 16;
      state = (Math.imul(state, MULT) + ADD) >>> 0;
      const high = state >>> 16;
      calls += 2;
      if ((((high % NUM_NATURES) * 11) + low) % NUM_NATURES === nature) {
        pid = (low | (high << 16)) >>> 0;
        break;
      }
    }
  }
  if (method === 2) state = (Math.imul(state, MULT) + ADD) >>> 0;
  state = (Math.imul(state, MULT) + ADD) >>> 0;
  const first = state >>> 16;
  if (method === 4) state = (Math.imul(state, MULT) + ADD) >>> 0;
  state = (Math.imul(state, MULT) + ADD) >>> 0;
  const second = state >>> 16;
  const ivs = out.ivs;
  ivs[0] = first & 0x1f; ivs[1] = (first >>> 5) & 0x1f; ivs[2] = (first >>> 10) & 0x1f;
  ivs[3] = second & 0x1f; ivs[4] = (second >>> 5) & 0x1f; ivs[5] = (second >>> 10) & 0x1f;
  out.slot = slot;
  out.speciesId = speciesId;
  out.level = level;
  out.pid = pid;
  out.calls = calls + (method === 1 ? 2 : 3);
  return out;
}

export function ivsObject(ivs: ArrayLike<number>): StatValues {
  return { hp: ivs[0], attack: ivs[1], defense: ivs[2], speed: ivs[3], sp_attack: ivs[4], sp_defense: ivs[5] };
}
