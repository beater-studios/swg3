// Seed offset of the visitor's console relative to the table, learned from confirmed hits (docs/research/rng.md).
// Unmeasured OPTION settings use the closest measured one as reference (shift not verified on console). Points stay
// local with no export, so nobody can feed made up data into the table.

import { load, save } from "../../app/prefs";
import { storageKey } from "../../brand";
import * as rng from "../../lib/services/rng";
import * as switchseed from "../../lib/gen3/switchseed";

/** Seed values to try on each side, for an unmeasured setting. */
export const SPREAD = 0x40;
/** Measured setting in the Check seed tab without a learned offset (observed: a few dozen at most). */
export const MEASURED_SPREAD = 0x20;
/** The seed varied between attempts on the same console. */
export const LEARNED_SPREAD = 8;

export interface Point {
  index: number;   // position in the reference table
  dseed: number;   // real seed minus the reference seed at that instant
}

type Store = Record<string, Point[]>;
const KEY = storageKey("learned");
const pointsKey = (version: string, setting: string, console: string) => `${version}|${setting}|${console}`;

export const measuredSettings = (version: string) => rng.seedSettings({ game: version }).settings.map((s) => s.key);
export const isMeasured = (version: string, setting: string) => measuredSettings(version).includes(setting);

// Decides left to right: keeps SOUND if possible, then BUTTON MODE, then the button.
export function closest(version: string, wanted: string[]): string {
  let options = measuredSettings(version).map((key) => key.split("/"));
  for (let i = 0; i < 3; i++) {
    const same = options.filter((o) => o[i] === wanted[i]);
    options = same.length ? same : options.filter((o) => o[i] === options[0][i]);
  }
  return options[0].join("/");
}

export const reference = (version: string, setting: string) => (isMeasured(version, setting) ? setting : closest(version, setting.split("/")));

export function points(version: string, setting: string, console: string): Point[] {
  return load<Store>(KEY, {})[pointsKey(version, setting, console)] ?? [];
}

/** On a tie, the smallest in absolute value. No hits, 0. */
export function shift(list: Point[]): number {
  const count = new Map<number, number>();
  for (const p of list) count.set(p.dseed, (count.get(p.dseed) ?? 0) + 1);
  let best = 0, times = 0;
  for (const [d, n] of count) if (n > times || (n === times && Math.abs(d) < Math.abs(best))) [best, times] = [d, n];
  return best;
}

export function record(version: string, setting: string, console: string, point: Point): number {
  const all = load<Store>(KEY, {});
  const key = pointsKey(version, setting, console);
  const list = (all[key] ?? []).filter((p) => p.index !== point.index);
  list.push(point);
  all[key] = list;
  save(KEY, all);
  return list.length;
}

export interface Row {
  index: number;
  seed: string;
  ms: number;
  /** measured: community table; yours: an instant you already hit; estimated: prediction. */
  source: "measured" | "yours" | "estimated";
}

export function table(version: string, setting: string, console: string): Row[] {
  if (isMeasured(version, setting) && !points(version, setting, console).length) {
    return rng.seedTable({ game: version, setting, console }).entries.map((e) => ({ ...e, source: "measured" as const }));
  }
  const own = new Map(points(version, setting, console).map((p) => [p.index, p.dseed]));
  const d = shift([...own].map(([index, dseed]) => ({ index, dseed })));
  return switchseed.table(version, reference(version, setting), console).map((e) => {
    const exact = own.get(e.index);
    const seed = (e.seed + (exact ?? d)) & 0xffff;
    return { index: e.index, seed: seed.toString(16).toUpperCase().padStart(4, "0"), ms: e.ms, source: exact === undefined ? "estimated" as const : "yours" as const };
  });
}

/**
 * `discover` (Check seed tab) searches further for a measured setting with no hits. Otherwise only the exact table
 * value is tried: with a single Pokémon, many values per row fill the list with chance matches.
 */
export function estimate(version: string, setting: string, console: string, discover = false) {
  const list = points(version, setting, console);
  if (!isMeasured(version, setting)) return { setting: reference(version, setting), seed_shift: shift(list), seed_spread: SPREAD };
  if (!list.length) return { setting, seed_shift: 0, seed_spread: discover ? MEASURED_SPREAD : 0 };
  // When checking, never less than the no-hit search, so an attempt outside what was seen is still found.
  const values = list.map((p) => p.dseed);
  const low = Math.min(...values), high = Math.max(...values);
  const spread = Math.ceil((high - low) / 2) + LEARNED_SPREAD;
  return { setting, seed_shift: Math.round((low + high) / 2), seed_spread: discover ? Math.max(MEASURED_SPREAD, spread) : spread };
}

/** Offsets seen on the tested console (app 1.0.0, docs/research/rng.md). Not verified on other consoles. */
export const DEFAULT_JITTER: readonly [number, number] = [-20, 0];

/** Seed values the console may give at the chosen seed's instant, besides the seed itself. */
export function likelySeeds(chosen: { index: number; seed: string; game: string; setting: string; console: string }): number[] {
  const base = parseInt(chosen.seed, 16);
  const list = points(chosen.game, chosen.setting, chosen.console);
  const table = (base - (list.find((p) => p.index === chosen.index)?.dseed ?? shift(list))) & 0xffff;
  const est = estimate(chosen.game, chosen.setting, chosen.console);
  const [low, high] = list.length || !isMeasured(chosen.game, chosen.setting)
    ? [est.seed_shift - est.seed_spread, est.seed_shift + est.seed_spread]
    : DEFAULT_JITTER;
  const out = new Set<number>();
  for (let d = low; d <= high; d++) out.add((table + d) & 0xffff);
  out.delete(base);
  return [...out];
}

export function refreshed<T extends { index: number; seed: string; game: string; setting: string; console: string }>(chosen: T): T {
  const row = table(chosen.game, chosen.setting, chosen.console).find((r) => r.index === chosen.index);
  return row ? { ...chosen, seed: row.seed } : chosen;
}

export function hasPoints(): boolean {
  return Object.values(load<Store>(KEY, {})).some((list) => list.length > 0);
}

export function clearAll() {
  save(KEY, {});
}

export function clear(version: string, setting: string, console: string) {
  const all = load<Store>(KEY, {});
  delete all[pointsKey(version, setting, console)];
  save(KEY, all);
}
