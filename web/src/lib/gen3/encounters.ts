// Where each species appears in FR/LG, to check a pk3's species, met location and met level. Port of src/swg3/gen3/encounters.py.
// Data from tools/gen_wild.py (frlg_wild.json) and tools/gen_encounters.py (frlg_encounters.json). Met location is the map's
// region section (CreateBoxMon); eggs have met level 0 (src/daycare.c); trades store METLOC_IN_GAME_TRADE (src/trade_scene.c).

import wildRaw from "@data/frlg_wild.json";
import otherRaw from "@data/frlg_encounters.json";
import * as speciesData from "./species";
import { UNOWN } from "./wild";

export const VERSIONS: Readonly<Record<number, "firered" | "leafgreen">> = { 4: "firered", 5: "leafgreen" };
export const EGG_GROUP_DITTO = 13; // include/constants/pokemon.h
export const EGG_GROUP_UNDISCOVERED = 15;
export const METLOC_SPECIAL_EGG = 0xfd;
export const METLOC_IN_GAME_TRADE = 0xfe;
export const METLOC_FATEFUL_ENCOUNTER = 0xff;
// The egg hatches wherever the player is walking, so any location works; the default is Four Island, home of the only
// FR/LG Day Care that produces eggs (data/maps/FourIsland/scripts.inc; the Route 5 one only holds a single Pokémon).
export const HATCH_LOCATION = 146; // MAPSEC_FOUR_ISLAND

type Version = "firered" | "leafgreen";
interface Other {
  map_sections: Record<string, number>;
  fixed: Record<Version, [number, number, number, string][]>;
  trades: Record<Version, number[]>;
  /** Unown letters of each Tanoby chamber, by section (sUnownLetterSlots in src/wild_encounter.c). */
  unown: Record<string, number[]>;
}
type Wild = Record<Version, Record<string, Record<string, { rate: number; mons: [string, number, number, number][] }>>>;

const WILD = wildRaw as unknown as Wild;
const OTHER = otherRaw as unknown as Other;

/** A place where the species appears: [section, min level, max level, kind]. */
export type Sighting = [number, number, number, string];

const byVersion = new Map<Version, Map<number, Sighting[]>>();

const compareSighting = (a: Sighting, b: Sighting) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);

function uniqueSorted(list: Sighting[]): Sighting[] {
  const seen = new Map(list.map((s) => [s.join("|"), s]));
  return [...seen.values()].sort(compareSighting);
}

function table(version: Version): Map<number, Sighting[]> {
  let out = byVersion.get(version);
  if (out) return out;
  const raw = new Map<number, Sighting[]>();
  const add = (species: number, s: Sighting) => raw.set(species, [...(raw.get(species) ?? []), s]);
  for (const [mapName, areas] of Object.entries(WILD[version])) {
    for (const [area, entry] of Object.entries(areas)) {
      for (const [, species, low, high] of entry.mons) add(species, [OTHER.map_sections[mapName], low, high, area]);
    }
  }
  for (const [species, level, section, kind] of OTHER.fixed[version]) add(species, [section, level, level, kind]);
  out = new Map([...raw].map(([k, v]) => [k, uniqueSorted(v)]));
  byVersion.set(version, out);
  return out;
}

const family = (species: number) => [species, ...speciesData.preEvolutions(species)];

/** Where the species (or a pre-evolution) appears in the game, excluding eggs. Empty outside FR/LG. */
export function sightings(species: number, game: number): Sighting[] {
  const version = VERSIONS[game];
  if (!version) return [];
  const found = table(version);
  return uniqueSorted(family(species).flatMap((m) => found.get(m) ?? []).filter((s) => s[3] !== "egg"));
}

export function sectionOfMap(map: string): number | null {
  return OTHER.map_sections[map] ?? null;
}

export function mapsInSection(section: number, among: readonly string[]): string[] {
  return among.filter((m) => OTHER.map_sections[m] === section);
}

/** Which family member (the species or a pre-evolution) the game gives at this location and level; null if none. */
export function who(species: number, game: number, section: number, level: number): number | null {
  const version = VERSIONS[game];
  if (!version) return null;
  const found = table(version);
  for (const member of family(species)) {
    if ((found.get(member) ?? []).some((s) => s[0] === section && s[1] <= level && level <= s[2] && s[3] !== "egg")) return member;
  }
  return null;
}

function descendants(species: number): number[] {
  const out: number[] = [];
  const queue = [species];
  while (queue.length) {
    const current = queue.shift()!;
    out.push(current);
    for (const [, , target] of speciesData.info(current).evolutions) if (!out.includes(target)) queue.push(target);
  }
  return out;
}

/** Whether the species (or what it evolved from) can hatch in the game: a breeding family, or the gift egg. */
export function hatchable(species: number, game: number): boolean {
  const members = family(species);
  const root = members[members.length - 1];
  const breeds = descendants(root).some((m) => speciesData.info(m).egg_groups.some((g) => g !== EGG_GROUP_DITTO && g !== EGG_GROUP_UNDISCOVERED));
  const version = VERSIONS[game];
  const gift = Boolean(version) && OTHER.fixed[version].some(([s, , , kind]) => kind === "egg" && members.includes(s));
  return breeds || gift;
}

export function traded(species: number, game: number): boolean {
  const version = VERSIONS[game];
  return Boolean(version) && family(species).some((m) => OTHER.trades[version].includes(m));
}

/** Levels of a list of places, with adjacent ranges merged: "2-5, 30". */
export function levelsText(found: readonly Sighting[]): string {
  const pairs = [...new Map(found.map((s) => [`${s[1]}-${s[2]}`, [s[1], s[2]] as const])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [low, high] of pairs) {
    const last = merged[merged.length - 1];
    if (last && low <= last[1] + 1) last[1] = Math.max(last[1], high);
    else merged.push([low, high]);
  }
  return merged.map(([low, high]) => (low === high ? String(low) : `${low}-${high}`)).join(", ");
}

export type Problem = ["trade" | "egg" | "place" | "level", string];

/** Species, met location and met level problem, or null if it matches or cannot be checked. "level" carries the location's levels. */
export function check(species: number, game: number, location: number, level: number): Problem | null {
  if (!VERSIONS[game] || location === METLOC_FATEFUL_ENCOUNTER) return null;
  if (location === METLOC_IN_GAME_TRADE) return traded(species, game) ? null : ["trade", ""];
  if (level === 0 || location === METLOC_SPECIAL_EGG) return hatchable(species, game) ? null : ["egg", ""];
  const here = sightings(species, game).filter((s) => s[0] === location);
  if (!here.length) return ["place", ""];
  if (!here.some(([, low, high]) => low <= level && level <= high)) return ["level", levelsText(here)];
  return null;
}

/**
 * Unown letters (0 = A ... 27 = ?) that this location's Tanoby chamber gives; null outside the chambers or FR/LG.
 * The letter comes from the PID (GET_UNOWN_LETTER), and each chamber only gives the letters of its slots.
 */
export function unownLetters(game: number, section: number): number[] | null {
  if (!VERSIONS[game]) return null;
  return OTHER.unown[String(section)] ?? null;
}

function letterOk(species: number, game: number, section: number, letter: number | null): boolean {
  const letters = species === UNOWN && letter !== null ? unownLetters(game, section) : null;
  return letters === null || letters.includes(letter!);
}

/**
 * Met location and level the game would give for the species to reach `level`: the highest-level encounter (of any
 * pre-evolution), else hatched (level 0) if it comes from an egg. `location`, `egg` (has an egg move), `metLevel` and
 * `letter` (Unown) narrow the choice. null when there is no data (another game) or no path.
 */
export function defaultMet(species: number, game: number, level: number, location: number | null = null, egg = false,
  metLevel: number | null = null, letter: number | null = null): [number, number] | null {
  if (!VERSIONS[game]) return null;
  if (metLevel !== null) {
    if (metLevel === 0) return hatchable(species, game) ? [location ?? HATCH_LOCATION, 0] : null;
    const places = sightings(species, game).filter((s) => s[1] <= metLevel && metLevel <= s[2] && (location === null || s[0] === location)
      && letterOk(species, game, s[0], letter))
      .map((s) => s[0]).sort((a, b) => a - b);
    return places.length ? [places[0], metLevel] : null;
  }
  if (egg) return hatchable(species, game) ? [location ?? HATCH_LOCATION, 0] : null;
  let best: [number, number] | null = null; // [level, section]
  for (const [section, low, high] of sightings(species, game)) {
    if (low > level || (location !== null && section !== location) || !letterOk(species, game, section, letter)) continue;
    const metLevel = Math.min(high, level);
    // Highest level, lowest section on a tie (like Python's max() over (level, -section)).
    if (!best || metLevel > best[0] || (metLevel === best[0] && section < best[1])) best = [metLevel, section];
  }
  if (best) return [best[1], best[0]];
  if (hatchable(species, game)) return [location ?? HATCH_LOCATION, 0];
  return null;
}

export interface FixedEncounter {
  species: number;
  level: number;
  /** Region section; null for the roaming dogs, which wander Kanto's routes. */
  section: number | null;
  kind: "static" | "gift" | "event" | "roamer";
}

/** The version's static encounters, gifts, events and roaming dogs, for static RNG (without the gift egg). */
export function fixedEncounters(game: number): FixedEncounter[] {
  const version = VERSIONS[game];
  if (!version) return [];
  const out = new Map<string, FixedEncounter>();
  for (const [species, level, section, kind] of OTHER.fixed[version]) {
    if (kind === "egg") continue;
    const roamer = kind === "roamer";
    out.set(`${species}|${roamer ? "" : section}`, { species, level, section: roamer ? null : section, kind: kind as FixedEncounter["kind"] });
  }
  return [...out.values()];
}
