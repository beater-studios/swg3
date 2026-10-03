// Gen 3 (FRLG) RNG and PID/IV generation: the project's only RNG implementation (frozen vectors in web/tests/vectors/frozen/).
// Decomp: src/random.c (Random(), SeedRng), src/pokemon.c (CreateBoxMon; in the Switch binary at 0x080412A8 the first Random32()
// call is the low 16 bits), src/wild_encounter.c (nature roll), src/main.c (VBlankIntr calls Random() every frame: methods 2
// and 4, as in PokeFinder's Method1/2/4 and ten-lines' H1/H2/H4).

import { STATS, type Stat, type StatValues } from "./pk3";

export const MULT = 1103515245; // 0x41C64E6D
export const ADD = 24691; // 0x6073

/** Inverse: MULT * MULT_INV == 1 (mod 2^32). */
export const MULT_INV = 0xeeb9eb65;
export const ADD_INV = 0x0a3561a1; // (-ADD * MULT_INV) mod 2^32

export const NUM_NATURES = 25;

const TWO_32 = 2 ** 32;

export function nextSeed(seed: number): number {
  return (Math.imul(seed, MULT) + ADD) >>> 0;
}

export function prevSeed(seed: number): number {
  return (Math.imul(seed, MULT_INV) + ADD_INV) >>> 0;
}

/** (mult, add) to advance n steps at once, with 0 <= n < 2^32. */
function jump(n: number): [number, number] {
  let mult = 1, add = 0;
  let stepMult = MULT, stepAdd = ADD;
  while (n) {
    if (n % 2) {
      mult = Math.imul(mult, stepMult) >>> 0;
      add = (Math.imul(add, stepMult) + stepAdd) >>> 0;
    }
    stepAdd = Math.imul(stepAdd, stepMult + 1) >>> 0;
    stepMult = Math.imul(stepMult, stepMult) >>> 0;
    n = Math.floor(n / 2);
  }
  return [mult, add];
}

/** Advances n steps (negative n goes back), in O(log n). `n` must be a safe integer. */
export function advance(seed: number, n: number): number {
  const [mult, add] = jump(((n % TWO_32) + TWO_32) % TWO_32);
  return (Math.imul(seed, mult) + add) >>> 0;
}

/** Smallest n >= 0 with advance(origin, n) == target. The LCRNG period is 2^32. */
export function distance(origin: number, target: number): number {
  let n = 0;
  let stepMult = MULT, stepAdd = ADD;
  let seed = origin >>> 0;
  for (let bit = 0; bit < 32; bit++) {
    const mask = 2 ** bit;
    if (((seed ^ target) >>> bit) & 1) {
      seed = (Math.imul(seed, stepMult) + stepAdd) >>> 0;
      n += mask;
    }
    stepAdd = Math.imul(stepAdd, stepMult + 1) >>> 0;
    stepMult = Math.imul(stepMult, stepMult) >>> 0;
  }
  return n;
}

/** Generator state, like gRngValue. */
export class Rng {
  state: number;
  calls = 0;

  constructor(seed = 0) {
    this.state = seed >>> 0;
  }

  /** Random(): advances and returns the high 16 bits. */
  random(): number {
    this.state = nextSeed(this.state);
    this.calls += 1;
    return this.state >>> 16;
  }

  random32(): number {
    const low = this.random();
    return (low | (this.random() << 16)) >>> 0;
  }
}

export class Spread {
  constructor(
    readonly seed: number,
    readonly pid: number,
    readonly ivs: StatValues,
    readonly calls: number,
  ) {}

  get nature(): number {
    return this.pid % NUM_NATURES;
  }

  isShiny(tid: number, sid: number): boolean {
    return (tid ^ sid ^ (this.pid >>> 16) ^ (this.pid & 0xffff)) < 8;
  }
}

/** 1: uninterrupted; 2: one call skipped before the IVs; 4: one call skipped between the two IV calls. */
export type Method = 1 | 2 | 4;
export const METHODS: readonly Method[] = [1, 2, 4];

export function generateIvs(rng: Rng, method: Method = 1): StatValues {
  if (method === 2) rng.random();
  const first = rng.random();
  if (method === 4) rng.random();
  const second = rng.random();
  const values = [0, 5, 10].map((s) => (first >> s) & 0x1f).concat([0, 5, 10].map((s) => (second >> s) & 0x1f));
  return Object.fromEntries(STATS.map((k, i) => [k, values[i]])) as StatValues;
}

/** CreateBoxMon with random PID and IVs (gifts, starters, static legendaries). */
export function staticSpread(seed: number, method: Method = 1): Spread {
  const rng = new Rng(seed);
  const pid = rng.random32();
  const ivs = generateIvs(rng, method);
  return new Spread(seed >>> 0, pid, ivs, rng.calls);
}

/** CreateMonWithNature: repeats Random32() until the nature matches. */
export function pidForNature(rng: Rng, nature: number): number {
  for (;;) {
    const pid = rng.random32();
    if (pid % NUM_NATURES === nature) return pid;
  }
}

/** PID and IVs of a wild encounter, from the state right after the nature roll. */
export function wildSpreadFromNature(seed: number, nature: number): Spread {
  const rng = new Rng(seed);
  const pid = pidForNature(rng, nature);
  const ivs = generateIvs(rng);
  return new Spread(seed >>> 0, pid, ivs, rng.calls);
}

/**
 * Advances in [first, last] whose static encounter passes `accept(spread)`, counted in Random() calls since
 * SeedRng(initialSeed). The target advance must be calibrated on the console (see ten-lines).
 */
export function searchStatic(initialSeed: number, first: number, last: number, accept: (spread: Spread) => boolean): [number, Spread][] {
  const found: [number, Spread][] = [];
  let seed = advance(initialSeed, first);
  for (let n = first; n <= last; n++) {
    const spread = staticSpread(seed);
    if (accept(spread)) found.push([n, spread]);
    seed = nextSeed(seed);
  }
  return found;
}

/** searchStatic filter: minimum IVs per stat (e.g. minIvs({ hp: 31, speed: 31 })). */
export function minIvs(minimum: Partial<Record<Stat, number>>): (spread: Spread) => boolean {
  const unknown = Object.keys(minimum).filter((k) => !(STATS as readonly string[]).includes(k));
  if (unknown.length) throw new Error(`unknown stats: ${unknown.sort().join(", ")}`);
  const entries = Object.entries(minimum) as [Stat, number][];
  return (spread) => entries.every(([k, v]) => spread.ivs[k] >= v);
}
