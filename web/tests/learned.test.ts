// Prediction for unmeasured combinations, learned from stored hits (src/pages/rng/learned.ts).
import { beforeAll, expect, test } from "vitest";
import { NATURES } from "../src/lib/gen3/pk3";
import { advance, staticSpread } from "../src/lib/gen3/rng";
import * as switchseed from "../src/lib/gen3/switchseed";
import * as rng from "../src/lib/services/rng";

let learned: typeof import("../src/pages/rng/learned");

beforeAll(async () => {
  const data = new Map<string, string>();
  globalThis.localStorage = {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  learned = await import("../src/pages/rng/learned");
});

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");

test("the reference is the closest measured combination, from left to right", () => {
  expect(learned.isMeasured("firered", "mono/help/a")).toBe(true);
  expect(learned.reference("firered", "mono/l=a/l")).toBe("mono/help/a");
  expect(learned.reference("firered", "stereo/lr/start")).toBe("stereo/help/a");
  expect(learned.reference("leafgreen", "stereo/lr/start")).toBe("stereo/lr/a");
});

test("without hits the prediction is the reference seed; with hits, exact where it hit and shifted elsewhere", () => {
  const ref = switchseed.table("firered", "mono/help/a", "switch1");
  const before = learned.table("firered", "mono/l=a/l", "switch1");
  expect(before.map((r) => r.seed).slice(0, 5)).toEqual(ref.slice(0, 5).map((e) => hex(e.seed)));
  expect(new Set(before.map((r) => r.source))).toEqual(new Set(["estimated"]));

  learned.record("firered", "mono/l=a/l", "switch1", { index: 10, dseed: -8 });
  learned.record("firered", "mono/l=a/l", "switch1", { index: 20, dseed: -8 });
  expect(learned.record("firered", "mono/l=a/l", "switch1", { index: 30, dseed: 5 })).toBe(3);
  expect(learned.record("firered", "mono/l=a/l", "switch1", { index: 30, dseed: 3 })).toBe(3);
  expect(learned.shift(learned.points("firered", "mono/l=a/l", "switch1"))).toBe(-8);

  const after = learned.table("firered", "mono/l=a/l", "switch1");
  expect(after[30]).toMatchObject({ source: "yours", seed: hex((ref[30].seed + 3) & 0xffff) });
  expect(after[0]).toMatchObject({ source: "estimated", seed: hex((ref[0].seed - 8) & 0xffff), ms: ref[0].ms });
  // Points are per combination and console.
  expect(learned.points("firered", "mono/l=a/l", "switch2")).toEqual([]);
});

test("the Adjust step finds the real seed shifted around the prediction", () => {
  const ref = switchseed.table("firered", "mono/help/a", "switch1");
  const real = (ref[100].seed - 8 + 0x13) & 0xffff;
  const spread = staticSpread(advance(real, 1500));
  const result = rng.calibrate({ game: "firered", setting: "mono/help/a", target_index: 100, target_advance: 1500, leeway: 1, window: 2,
    nature: NATURES[spread.nature], seed_shift: -8, seed_spread: learned.SPREAD });
  const hit = result.results.find((r) => r.seed === hex(real) && r.advance === 1500);
  expect(hit).toMatchObject({ seed_index: 100, dseed: 0x13 - 8 });
});

test("measured combination: without hits it is the community table; with hits the list and the search use the offset", () => {
  const ref = switchseed.table("firered", "mono/help/a", "switch1");
  expect(new Set(learned.table("firered", "mono/help/a", "switch1").map((r) => r.source))).toEqual(new Set(["measured"]));
  expect(learned.estimate("firered", "mono/help/a", "switch1")).toEqual({ setting: "mono/help/a", seed_shift: 0, seed_spread: 0 });
  expect(learned.estimate("firered", "mono/help/a", "switch1", true)).toEqual({ setting: "mono/help/a", seed_shift: 0, seed_spread: learned.MEASURED_SPREAD });
  // The real case: table 7170, hit 7160.
  const row = ref.findIndex((e) => e.seed === 0x7170);
  learned.record("firered", "mono/help/a", "switch1", { index: row, dseed: -16 });
  const after = learned.table("firered", "mono/help/a", "switch1");
  expect(after[row]).toMatchObject({ seed: "7160", source: "yours" });
  expect(after[0]).toMatchObject({ seed: hex((ref[0].seed - 16) & 0xffff), source: "estimated" });
  expect(learned.estimate("firered", "mono/help/a", "switch1")).toMatchObject({ seed_shift: -16, seed_spread: learned.LEARNED_SPREAD });
  // Another attempt was exact: the search covers -16 to 0, with margin.
  learned.record("firered", "mono/help/a", "switch1", { index: 400, dseed: 0 });
  expect(learned.estimate("firered", "mono/help/a", "switch1")).toMatchObject({ seed_shift: -8, seed_spread: 16 });
  expect(learned.estimate("firered", "mono/help/a", "switch1", true)).toMatchObject({ seed_shift: -8, seed_spread: learned.MEASURED_SPREAD });
  learned.clear("firered", "mono/help/a", "switch1");
  learned.record("firered", "mono/help/a", "switch1", { index: row, dseed: -16 });
  const chosen = { index: 259, seed: hex(ref[259].seed), ms: ref[259].ms, game: "firered", setting: "mono/help/a", console: "switch1" };
  expect(learned.refreshed(chosen).seed).toBe(hex((ref[259].seed - 16) & 0xffff));
  learned.clear("firered", "mono/help/a", "switch1");
  expect(learned.points("firered", "mono/help/a", "switch1")).toEqual([]);
  expect(learned.points("firered", "mono/l=a/l", "switch1").length).toBeGreaterThan(0);
});

test("likely seeds for the tolerant target: without hits, from 20 below up to the table itself", () => {
  learned.clear("firered", "mono/help/a", "switch1");
  const ref = switchseed.table("firered", "mono/help/a", "switch1");
  const chosen = { index: 259, seed: hex(ref[259].seed), ms: ref[259].ms, game: "firered", setting: "mono/help/a", console: "switch1" };
  const seeds = learned.likelySeeds(chosen);
  expect(seeds).toHaveLength(20);
  expect(seeds).toContain((ref[259].seed - 20) & 0xffff);
  expect(seeds).not.toContain(ref[259].seed);
});
