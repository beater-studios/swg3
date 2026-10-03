// FRLG Day Care eggs: two-step PID and IV inheritance (the project's only RNG implementation, frozen vectors in web/tests/vectors/frozen/).
// Decomp (src/daycare.c): _TriggerPendingDaycareEgg, _GiveEggFromDaycare, SetInitialEggData, InheritIVs. The game's InheritIVs bug
// (RemoveIVIndexFromList takes the rolled value as a position, so a stat can be inherited twice) is reproduced literally, as in
// PokeFinder (EggGenerator3). VBlank (src/main.c) calls Random() every frame: EGG_METHODS models the extra calls during pickup.

import { STATS, type Stat, type StatValues } from "./pk3";
import { Rng } from "./rng";

// LCG constants copied from rng.ts: in Vitest each read of an import is a getter call, too slow for the long loops.
const MULT = 0x41c64e6d, ADD = 0x6073;

export const INHERITED_IV_COUNT = 3;
export const USHRT_MAX = 0xffff;

/** FRLG pickup methods (PokeFinder, EggGenerator3): calls skipped before IV1, before IV2 and before inheritance. */
export const EGG_METHODS = {
  bred: [1, 0, 1],
  split: [0, 1, 1],
  alternate: [1, 0, 2],
  mixed: [0, 0, 2],
} as const;
export type EggMethod = keyof typeof EGG_METHODS;

/**
 * InheritIVs + RemoveIVIndexFromList as in the game: `rolls` are the 3 rolls (Random() % 6, % 5, % 4) and `out`
 * receives the inherited stats (STATS indices), in roll order.
 */
export function inheritedStats(rolls: ArrayLike<number>, out: Uint8Array | number[]): void {
  const available = [0, 1, 2, 3, 4, 5];
  const temp = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < INHERITED_IV_COUNT; i++) {
    const stat = available[rolls[i]];
    out[i] = stat;
    available[stat] = 0xff;
    for (let k = 0; k < 6; k++) temp[k] = available[k];
    let j = 0;
    for (let k = 0; k < 6; k++) if (temp[k] !== 0xff) available[j++] = temp[k];
  }
}

export interface EggPickup {
  pid: number;
  ivs: StatValues;
  /** [stat, parent 0 or 1] in roll order. */
  inherited: [Stat, number][];
  calls: number;
}

/**
 * Low half of the PID if the egg is generated on this step, otherwise null. `compatibility`: 20, 50 or 70
 * (GetDaycareCompatibilityScore); the test is `compatibility > Random() * 100 / 0xFFFF` in unsigned integer arithmetic.
 */
export function eggGenerated(seed: number, compatibility: number): number | null {
  const rng = new Rng(seed);
  if (!(compatibility > Math.floor((rng.random() * 100) / USHRT_MAX))) return null;
  return (rng.random() % 0xfffe) + 1;
}

/** Same as `eggGenerated`, with -1 instead of null. */
export function eggGeneratedFast(seed: number, compatibility: number): number {
  const first = (Math.imul(seed, MULT) + ADD) >>> 0;
  if (!(compatibility > Math.floor(((first >>> 16) * 100) / USHRT_MAX))) return -1;
  const second = (Math.imul(first, MULT) + ADD) >>> 0;
  return ((second >>> 16) % 0xfffe) + 1;
}

/**
 * Egg pickup: high half of the PID, random IVs and inheritance. `parents`: IVs of both parents (Day Care indices);
 * without them, the result lists which stats are inherited and from which parent, without applying the values.
 */
export function eggPickup(seed: number, lowPid: number, parents?: readonly [StatValues, StatValues] | null, method: EggMethod = "bred"): EggPickup {
  const [skipIv1, skipIv2, skipInherit] = EGG_METHODS[method];
  const rng = new Rng(seed);
  const pid = (lowPid | (rng.random() << 16)) >>> 0;
  for (let i = 0; i < skipIv1; i++) rng.random();
  const first = rng.random();
  for (let i = 0; i < skipIv2; i++) rng.random();
  const second = rng.random();
  const values = [first & 0x1f, (first >> 5) & 0x1f, (first >> 10) & 0x1f, second & 0x1f, (second >> 5) & 0x1f, (second >> 10) & 0x1f];
  let ivs = Object.fromEntries(STATS.map((k, i) => [k, values[i]])) as StatValues;
  for (let i = 0; i < skipInherit; i++) rng.random();
  const rolls = Array.from({ length: INHERITED_IV_COUNT }, (_, i) => rng.random() % (STATS.length - i));
  const selected: number[] = [];
  inheritedStats(rolls, selected);
  const which = Array.from({ length: INHERITED_IV_COUNT }, () => rng.random() % 2);
  const inherited = selected.map((s, i) => [STATS[s], which[i]] as [Stat, number]);
  if (parents) {
    ivs = { ...ivs };
    for (const [stat, parent] of inherited) ivs[stat] = parents[parent][stat];
  }
  return { pid, ivs, inherited, calls: rng.calls };
}

/** `eggPickupInto` result, reused across advances. IVs and inheritance by STATS index. */
export interface PickupScratch {
  pid: number;
  ivs: Uint8Array;
  stats: Uint8Array;
  /** Parent (0 or 1) of each inherited stat. */
  parents: Uint8Array;
  calls: number;
}

export function newPickupScratch(): PickupScratch {
  return { pid: 0, ivs: new Uint8Array(6), stats: new Uint8Array(3), parents: new Uint8Array(3), calls: 11 };
}

/** Same as `eggPickup`, writing into `out`. `parents`: parent IVs in STATS order, or null. */
export function eggPickupInto(seed: number, lowPid: number, parents: readonly [ArrayLike<number>, ArrayLike<number>] | null, out: PickupScratch, method: EggMethod = "bred"): PickupScratch {
  const [skipIv1, skipIv2, skipInherit] = EGG_METHODS[method];
  let state = (Math.imul(seed, MULT) + ADD) >>> 0;
  out.pid = (lowPid | ((state >>> 16) << 16)) >>> 0;
  for (let i = 0; i <= skipIv1; i++) state = (Math.imul(state, MULT) + ADD) >>> 0;
  const first = state >>> 16;
  for (let i = 0; i <= skipIv2; i++) state = (Math.imul(state, MULT) + ADD) >>> 0;
  const second = state >>> 16;
  const ivs = out.ivs;
  ivs[0] = first & 0x1f; ivs[1] = (first >>> 5) & 0x1f; ivs[2] = (first >>> 10) & 0x1f;
  ivs[3] = second & 0x1f; ivs[4] = (second >>> 5) & 0x1f; ivs[5] = (second >>> 10) & 0x1f;
  for (let i = 0; i < skipInherit; i++) state = (Math.imul(state, MULT) + ADD) >>> 0;
  const rolls = ROLLS;
  for (let i = 0; i < INHERITED_IV_COUNT; i++) {
    state = (Math.imul(state, MULT) + ADD) >>> 0;
    rolls[i] = (state >>> 16) % (6 - i);
  }
  inheritedStats(rolls, out.stats);
  for (let i = 0; i < INHERITED_IV_COUNT; i++) {
    state = (Math.imul(state, MULT) + ADD) >>> 0;
    out.parents[i] = (state >>> 16) % 2;
  }
  if (parents) for (let i = 0; i < INHERITED_IV_COUNT; i++) ivs[out.stats[i]] = parents[out.parents[i]][out.stats[i]];
  out.calls = 9 + skipIv1 + skipIv2 + skipInherit;
  return out;
}

const ROLLS = new Uint8Array(INHERITED_IV_COUNT);
