// Egg pickup checked against a literal simulation of the decomp (references/pokefirered/src/daycare.c:
// _GiveEggFromDaycare, SetInitialEggData, InheritIVs, RemoveIVIndexFromList), with the VBlank calls
// of the PokeFinder methods (EggGenerator3, RSFRLGBred*). See the exception in encounters.parity.test.ts.
import { expect, test } from "vitest";
import * as egg from "../src/lib/gen3/egg";
import { STATS, type StatValues } from "../src/lib/gen3/pk3";

// Independent generator, sharing nothing with egg.ts.
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 0x41c64e6d) + 0x6073) >>> 0;
    return state >>> 16;
  };
}

// Direct translation of InheritIVs: the 6-slot list, the drawn value used as the position to remove,
// and the compaction that leaves the end of the list as it was.
function decomp(seed: number, low: number, skips: readonly number[], parents: [number[], number[]]) {
  const random = lcg(seed);
  const pid = (low | (random() << 16)) >>> 0;
  for (let i = 0; i < skips[0]; i++) random();
  const iv1 = random();
  for (let i = 0; i < skips[1]; i++) random();
  const iv2 = random();
  const ivs = [iv1 & 31, (iv1 >> 5) & 31, (iv1 >> 10) & 31, iv2 & 31, (iv2 >> 5) & 31, (iv2 >> 10) & 31];
  for (let i = 0; i < skips[2]; i++) random();
  const availableIVs = [0, 1, 2, 3, 4, 5];
  const selectedIvs: number[] = [];
  for (let i = 0; i < 3; i++) {
    selectedIvs[i] = availableIVs[random() % (6 - i)];
    availableIVs[selectedIvs[i]] = 0xff;
    const temp = [...availableIVs];
    let j = 0;
    for (let k = 0; k < 6; k++) if (temp[k] !== 0xff) availableIVs[j++] = temp[k];
  }
  const whichParent = [random() % 2, random() % 2, random() % 2];
  for (let i = 0; i < 3; i++) ivs[selectedIvs[i]] = parents[whichParent[i]][selectedIvs[i]];
  return { pid, ivs, selectedIvs, whichParent };
}

const obj = (v: number[]) => Object.fromEntries(STATS.map((k, i) => [k, v[i]])) as StatValues;

test("pickup matches the decomp in all four methods, including repeated inheritance", () => {
  const next = lcg(0x1234);
  const parents: [number[], number[]] = [[31, 30, 29, 28, 27, 26], [1, 2, 3, 4, 5, 6]];
  const scratch = egg.newPickupScratch();
  let repeated = 0;
  for (const method of Object.keys(egg.EGG_METHODS) as egg.EggMethod[]) {
    for (let n = 0; n < 5000; n++) {
      const seed = ((next() << 16) | next()) >>> 0, low = next();
      const want = decomp(seed, low, egg.EGG_METHODS[method], parents);
      if (new Set(want.selectedIvs).size < 3) repeated++;
      const got = egg.eggPickup(seed, low, [obj(parents[0]), obj(parents[1])], method);
      expect(got.pid).toBe(want.pid);
      expect(STATS.map((k) => got.ivs[k])).toEqual(want.ivs);
      expect(got.inherited).toEqual(want.selectedIvs.map((s, i) => [STATS[s], want.whichParent[i]]));
      const fast = egg.eggPickupInto(seed, low, parents, scratch, method);
      expect([fast.pid, [...fast.ivs], [...fast.stats], [...fast.parents]]).toEqual([want.pid, want.ivs, want.selectedIvs, want.whichParent]);
      expect(fast.calls).toBe(got.calls);
    }
  }
  // The game bug shows up: sometimes the same stat is inherited twice.
  expect(repeated).toBeGreaterThan(0);
});

test("calls per method", () => {
  expect(egg.eggPickup(1, 1, null, "bred").calls).toBe(11);
  expect(egg.eggPickup(1, 1, null, "split").calls).toBe(11);
  expect(egg.eggPickup(1, 1, null, "alternate").calls).toBe(12);
  expect(egg.eggPickup(1, 1, null, "mixed").calls).toBe(11);
});

test("pickup search with all methods: each egg marked, same as each method's search alone", async () => {
  const service = await import("../src/lib/services/rng");
  const base = { seed: "1234ABCD", first: 5000, last: 5040, low: "1A2B", limit: 1000 };
  const all = service.searchEggPickup({ ...base, method: "all" }).results;
  expect(all.length).toBe(41 * 4);
  for (const method of Object.keys(egg.EGG_METHODS)) {
    const one = service.searchEggPickup({ ...base, method }).results;
    expect(all.filter((r) => r.method === method).map(({ method: _m, ...rest }) => rest)).toEqual(one);
  }
  expect(service.searchEggPickup({ ...base, method: "bred" }).results[0].method).toBeUndefined();
});
