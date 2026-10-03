// FRLG species data (generated from the ROM by tools/gen_species_data.py) and game calculations. Port of src/swg3/gen3/species.py.
// Decomp: src/pokemon.c (CalculateMonStats, ModifyStatByNature with a u16 intermediate, GetLevelFromMonExp,
// GetGenderFromSpeciesAndPersonality) and src/battle_script_commands.c (Cmd_hiddenpowercalc; the type skips Normal and ???).

import raw from "@data/frlg_species.json";
import { STATS, type Pk3, type Stat, type StatValues } from "./pk3";
import { t } from "../../i18n";

export const MAX_LEVEL = 100;
export const NATURE_STATS: readonly Stat[] = ["attack", "defense", "speed", "sp_attack", "sp_defense"];
// include/constants/pokemon.h.
export const MON_MALE = 0x00, MON_FEMALE = 0xfe, MON_GENDERLESS = 0xff;
export const NUMBER_OF_MON_TYPES = 18;
export const TYPE_MYSTERY = 9;
export const ITEM_EVERSTONE = 195; // include/constants/items.h (HOLD_EFFECT_PREVENT_EVOLVE)
export const KANTO_SPECIES_END = 151; // include/constants/species.h, SPECIES_MEW

export type Gender = "M" | "F" | "-";

export interface SpeciesInfo {
  name: string;
  /** HP, Atk, Def, Spe, SpA, SpD. */
  base: number[];
  types: number[];
  gender_ratio: number;
  friendship: number;
  national: number;
  growth: string;
  abilities: number[];
  /** EGG_GROUP_* from include/constants/pokemon.h. */
  egg_groups: number[];
  /** [level, move], in game order. */
  levelup: [number, number][];
  tm: number[];
  tutor: number[];
  egg: number[];
  /** Emerald tutor moves (pokeemerald, sTutorLearnsets). */
  tutor_emerald: number[];
  /** XD tutor moves (PokeAPI; not verified against the game). */
  tutor_xd?: number[];
  /** [method, parameter, target species] from gEvolutionTable. */
  evolutions: [number, number, number][];
}

export interface SpeciesData {
  evo_methods: Record<string, string>;
  growth: string[];
  exp: number[][];
  moves: Record<string, string>;
  move_pp: number[];
  move_power: number[];
  move_type: number[];
  types: string[];
  abilities: string[];
  items: string[];
  item_holdable: number[];
  mapsec: Record<string, string>;
  mapsec_emerald: Record<string, string>;
  species: Record<string, SpeciesInfo>;
}

const DATA = raw as unknown as SpeciesData;

export function data(): SpeciesData {
  return DATA;
}

export function info(species: number): SpeciesInfo {
  const key = String(species);
  if (!Object.hasOwn(DATA.species, key)) throw new Error(t("espécie {species} sem dados", { species }));
  return DATA.species[key];
}

function lookup(table: Record<string, string>, id: number): string {
  const key = String(id);
  return Object.hasOwn(table, key) ? table[key] : `#${id}`;
}

function indexed(names: readonly string[], id: number): string {
  return Number.isInteger(id) && id >= 0 && id < names.length ? names[id] : `#${id}`;
}

export const moveName = (move: number) => lookup(DATA.moves, move);

/** Move type name (gBattleMoves), as the game spells it (FIGHT, PSYCHC...). */
export const moveTypeName = (move: number) => indexed(DATA.types, DATA.move_type[move] ?? -1);

export type MoveCategory = "physical" | "special" | "status";

/** Gen 3 move category: status without power; otherwise below TYPE_MYSTERY physical (IS_TYPE_PHYSICAL in include/battle.h). */
export function moveCategory(move: number): MoveCategory | null {
  const type = DATA.move_type[move], power = DATA.move_power[move];
  if (type === undefined || power === undefined) return null;
  if (power === 0) return "status";
  return type < TYPE_MYSTERY ? "physical" : "special";
}
export const typeName = (typeId: number) => indexed(DATA.types, typeId);
export const abilityName = (ability: number) => indexed(DATA.abilities, ability);
export const itemName = (item: number) => indexed(DATA.items, item);

/** Map section name (met location) as the decomp constant. With Emerald (3) as origin game, 197 and up are pokeemerald's. */
export function mapSection(section: number, game: number | null = null): string {
  if (game === 3 && Object.hasOwn(DATA.mapsec_emerald, String(section))) return DATA.mapsec_emerald[String(section)];
  return lookup(DATA.mapsec, section);
}

let holdableSet: Set<number> | undefined;

/** Item the game allows holding: importance 0 and not a key item (HMs excluded). */
export function holdable(item: number): boolean {
  holdableSet ??= new Set(DATA.item_holdable);
  return holdableSet.has(item);
}

export function nationalNumber(species: number): number {
  return info(species).national;
}

export function gender(species: number, personality: number): Gender {
  const ratio = info(species).gender_ratio;
  if (ratio === MON_GENDERLESS) return "-";
  if (ratio === MON_MALE) return "M";
  if (ratio === MON_FEMALE) return "F";
  return ratio > (personality & 0xff) ? "F" : "M";
}

export function hiddenPower(ivs: StatValues): [type: number, power: number] {
  let powerBits = 0, typeBits = 0;
  STATS.forEach((k, i) => {
    powerBits += ((ivs[k] >> 1) & 1) << i;
    typeBits += (ivs[k] & 1) << i;
  });
  let moveType = Math.floor(((NUMBER_OF_MON_TYPES - 3) * typeBits) / 63) + 1;
  if (moveType >= TYPE_MYSTERY) moveType += 1;
  return [moveType, Math.floor((40 * powerBits) / 63) + 30];
}

export function speciesId(name: string): number {
  const upper = name.toUpperCase();
  for (const [key, value] of Object.entries(DATA.species)) if (value.name === upper) return Number(key);
  throw new Error(t("espécie '{name}' não encontrada", { name }));
}

export function expTable(species: number): number[] {
  return DATA.exp[DATA.growth.indexOf(info(species).growth)];
}

export function levelFromExp(species: number, experience: number): number {
  const table = expTable(species);
  let level = 1;
  while (level < MAX_LEVEL && table[level + 1] <= experience) level += 1;
  return level;
}

/** +1, -1 or 0 for the stat, per sNatureStatTable. */
export function natureModifier(nature: number, stat: Stat): number {
  const index = NATURE_STATS.indexOf(stat);
  if (index < 0) return 0;
  const up = Math.floor(nature / 5), down = nature % 5;
  if (up === down) return 0;
  return index === up ? 1 : index === down ? -1 : 0;
}

function applyNature(value: number, modifier: number): number {
  if (modifier === 1) return Math.floor(((value * 110) & 0xffff) / 100);
  if (modifier === -1) return Math.floor(((value * 90) & 0xffff) / 100);
  return value;
}

export function calcStats(species: number, level: number, ivs: StatValues, evs: StatValues, nature: number): StatValues {
  const entry = info(species);
  const out = {} as StatValues;
  STATS.forEach((stat, i) => {
    const core = Math.floor(((2 * entry.base[i] + ivs[stat] + Math.floor(evs[stat] / 4)) * level) / 100);
    if (stat === "hp") out[stat] = entry.name === "SHEDINJA" ? 1 : core + level + 10;
    else out[stat] = applyNature(core + 5, natureModifier(nature, stat));
  });
  return out;
}

const zeroStats = (): StatValues => Object.fromEntries(STATS.map((k) => [k, 0])) as StatValues;

export type Observation = readonly [level: number, stats: StatValues];

/**
 * IVs that explain the stats seen in the game, stat by stat (like the ten-lines/PokeFinder IVChecker, with the game's
 * formula). EVs default to zero. `evSlack`: EVs the Pokémon may have gained per stat after the first observation; in
 * the following ones the `ev / 4` term may grow by up to `evSlack / 4`, never shrinking.
 */
export function possibleIvs(species: number, nature: number, observations: readonly Observation[], evs?: StatValues | null, evSlack = 0): Record<Stat, number[]> {
  const effort = evs ?? zeroStats();
  const extra = Math.floor(evSlack / 4);
  const out = {} as Record<Stat, number[]>;
  for (const stat of STATS) {
    // [IV, EVs gained so far (multiple of 4)] pairs that explain the observations seen so far.
    let states: [number, number][] = Array.from({ length: 32 }, (_, iv) => [iv, 0]);
    observations.forEach(([level, stats], index) => {
      const next = new Map<string, [number, number]>();
      for (const [iv, gained] of states) {
        for (let e = gained; e <= (index ? extra : 0); e++) {
          const ivs = zeroStats();
          ivs[stat] = iv;
          const withEffort = { ...effort, [stat]: effort[stat] + 4 * e };
          if (calcStats(species, level, ivs, withEffort, nature)[stat] === stats[stat]) next.set(`${iv},${e}`, [iv, e]);
        }
      }
      states = [...next.values()];
    });
    out[stat] = [...new Set(states.map(([iv]) => iv))].sort((a, b) => a - b);
  }
  return out;
}

export type Evolution = [method: string, param: number, target: number];

export function evolutions(species: number): Evolution[] {
  return info(species).evolutions.map(([m, p, t]) => [DATA.evo_methods[String(m)], p, t]);
}

/**
 * Species it evolves into when received by trade, or null (GetEvolutionTargetSpecies, EVO_MODE_TRADE). An Everstone
 * prevents it; for EVO_TRADE_ITEM the held item must be the parameter, and it is consumed.
 */
export function tradeEvolution(species: number, heldItem: number): number | null {
  if (heldItem === ITEM_EVERSTONE) return null;
  let target: number | null = null;
  for (const [method, param, to] of evolutions(species)) {
    if (method === "trade" || (method === "trade_item" && param === heldItem)) target = to;
  }
  return target;
}

let parentsCache: Map<number, number[]> | undefined;

function parents(): Map<number, number[]> {
  if (!parentsCache) {
    parentsCache = new Map();
    for (const [key, value] of Object.entries(DATA.species)) {
      for (const [, , target] of value.evolutions) {
        const list = parentsCache.get(target) ?? [];
        list.push(Number(key));
        parentsCache.set(target, list);
      }
    }
  }
  return parentsCache;
}

export function preEvolutions(species: number): number[] {
  const out: number[] = [];
  const queue = [...(parents().get(species) ?? [])];
  while (queue.length) {
    const current = queue.shift()!;
    if (!out.includes(current)) {
      out.push(current);
      queue.push(...(parents().get(current) ?? []));
    }
  }
  return out;
}

export function ownLearnableMoves(species: number, level = MAX_LEVEL, egg = true): Set<number> {
  const entry = info(species);
  const moves = new Set(entry.levelup.filter(([lvl]) => lvl <= level).map(([, move]) => move));
  for (const move of [...entry.tm, ...entry.tutor, ...(egg ? entry.egg : [])]) moves.add(move);
  return moves;
}

/**
 * The species and the pre-evolutions the Pokémon may have been. With `since` (the form it was caught or received
 * as), only the forms from that one on: a caught Pidgeotto was never a Pidgey.
 */
export function formsSince(species: number, since: number | null = null): number[] {
  let ancestors = preEvolutions(species);
  if (since !== null && ancestors.includes(since)) ancestors = ancestors.slice(0, ancestors.indexOf(since) + 1);
  else if (since === species) ancestors = [];
  return [species, ...ancestors];
}

/**
 * Learnset of the species and its pre-evolutions, up to `level`. Approximation: a pre-evolution level-up move counts
 * if its level does not exceed the current one; event moves and cross-generation trades are not included. With
 * `since`, only the forms from the caught one on (formsSince).
 */
export function learnableMoves(species: number, level = MAX_LEVEL, egg = true, since: number | null = null): Set<number> {
  const moves = new Set<number>();
  for (const form of formsSince(species, since)) for (const move of ownLearnableMoves(form, level, egg)) moves.add(move);
  return moves;
}

/** Emerald tutor moves (tutor_emerald, from pokeemerald) for the species or a pre-evolution. */
export function emeraldTutorMoves(species: number, since: number | null = null): Set<number> {
  return new Set(formsSince(species, since).flatMap((form) => info(form).tutor_emerald));
}

/** XD tutor moves (tutor_xd, from PokeAPI; not verified against the game) for the species or a pre-evolution. */
export function xdTutorMoves(species: number, since: number | null = null): Set<number> {
  return new Set(formsSince(species, since).flatMap((form) => info(form).tutor_xd ?? []));
}

// Breeding chain (src/daycare.c, BuildEggMoveset): all egg moves of a hatched Pokémon come from one father who knew them
// at once, by level, TM, tutor or as his own inherited egg move. A male-only (or genderless) family only breeds with Ditto,
// so the father is from the same family; Nidoran♀ and Illumise eggs can also hatch Nidoran♂ and Volbeat (daycare.c).
export const EGG_GROUP_DITTO = 13, EGG_GROUP_UNDISCOVERED = 15;
const noBreed = (g: number) => g === EGG_GROUP_DITTO || g === EGG_GROUP_UNDISCOVERED;

function family(species: number): number[] {
  const root = [species, ...preEvolutions(species)].at(-1)!;
  const out: number[] = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.shift()!;
    if (!out.includes(current)) {
      out.push(current);
      queue.push(...info(current).evolutions.map(([, , t]) => t));
    }
  }
  return out;
}

let breedersCache: number[] | null = null;
function breeders(): number[] {
  breedersCache ??= Object.entries(DATA.species)
    .filter(([, v]) => v.name && !v.name.startsWith("?") && v.gender_ratio !== MON_FEMALE && v.gender_ratio !== MON_GENDERLESS
      && v.egg_groups.some((g) => !noBreed(g)))
    .map(([k]) => Number(k)).sort((a, b) => a - b);
  return breedersCache;
}

const fathersCache = new Map<number, Set<number>>();
function fathers(species: number): Set<number> {
  let out = fathersCache.get(species);
  if (out) return out;
  const fam = family(species);
  const mates = fam.includes(speciesId("NIDORAN♂")) ? [speciesId("NIDORAN♀")] : fam.includes(speciesId("VOLBEAT")) ? [speciesId("ILLUMISE")] : [];
  const hasMother = mates.length > 0 || fam.some((f) => info(f).gender_ratio !== MON_MALE && info(f).gender_ratio !== MON_GENDERLESS);
  if (!hasMother) out = new Set(fam.filter((f) => breeders().includes(f)));
  else {
    const groups = new Set([...fam, ...mates].flatMap((f) => info(f).egg_groups).filter((g) => !noBreed(g)));
    out = new Set(breeders().filter((s) => info(s).egg_groups.some((g) => groups.has(g))));
  }
  fathersCache.set(species, out);
  return out;
}

const directCache = new Map<number, Set<number>>();
/** Moves the species knows without hatching: level-up, TM and tutors (including earlier forms'). */
function direct(species: number): Set<number> {
  let out = directCache.get(species);
  if (!out) {
    out = new Set([...learnableMoves(species, MAX_LEVEL, false), ...emeraldTutorMoves(species), ...xdTutorMoves(species)]);
    directCache.set(species, out);
  }
  return out;
}

const familyEgg = (species: number) => new Set([species, ...preEvolutions(species)].flatMap((f) => info(f).egg));
const subset = (a: Iterable<number>, b: Set<number>) => [...a].every((m) => b.has(m));

const knowersCache = new Map<string, Set<number>>();
/** Species that can know all `moves` at once, by learning or inheriting from the father (chain). */
function knowers(moves: number[]): Set<number> {
  const key = [...moves].sort((a, b) => a - b).join(",");
  const cached = knowersCache.get(key);
  if (cached) return cached;
  const known = new Set(breeders().filter((s) => subset(moves, direct(s))));
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of breeders()) {
      if (known.has(s)) continue;
      const rest = moves.filter((m) => !direct(s).has(m));
      if (!subset(rest, familyEgg(s))) continue;
      // The rest was inherited from the father: one who knows all of it. If the rest is everything: the ones found so far.
      const pool = rest.length === moves.length ? known : knowers(rest);
      if ([...fathers(s)].some((f) => pool.has(f))) {
        known.add(s);
        changed = true;
      }
    }
  }
  knowersCache.set(key, known);
  return known;
}

/**
 * A father that can pass all `moves` (egg moves) together to an offspring of `species`' family, or null if none can.
 * The lowest species number, so the answer is stable.
 */
export function eggFather(species: number, moves: Iterable<number>): number | null {
  const wanted = [...new Set(moves)];
  if (!subset(wanted, familyEgg(species))) return null;
  const pool = knowers(wanted);
  const candidates = [...fathers(species)].filter((f) => pool.has(f)).sort((a, b) => a - b);
  return candidates.length ? candidates[0] : null;
}

/** Moves the species (or family) only gets from an egg: outside level-up, TM and tutor learnsets. */
export function eggOnlyMoves(species: number, level = MAX_LEVEL): Set<number> {
  const without = learnableMoves(species, level, false);
  return new Set([...learnableMoves(species, level)].filter((m) => !without.has(m)));
}

export function monLevel(mon: Pk3): number {
  return levelFromExp(mon.species, mon.experience);
}

export function monStats(mon: Pk3, level?: number | null): StatValues {
  return calcStats(mon.species, level || monLevel(mon), mon.ivs, mon.evs, mon.personality % 25);
}
