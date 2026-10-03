// Methods 1, 2 and 4 (VBlank in the middle of CreateBoxMon) and EV slack in the IV calculator.
import { expect, test } from "vitest";
import { STATS } from "../src/lib/gen3/pk3";
import { advance, nextSeed, staticSpread } from "../src/lib/gen3/rng";
import * as species from "../src/lib/gen3/species";
import * as switchseed from "../src/lib/gen3/switchseed";
import * as wild from "../src/lib/gen3/wild";
import * as service from "../src/lib/services/rng";

const ivsOf = (a: number, b: number) => [a & 31, (a >> 5) & 31, (a >> 10) & 31, b & 31, (b >> 5) & 31, (b >> 10) & 31];
const out = (s: number) => s >>> 16;

test("H2 skips one call before the IVs and H4 between them, the same in both paths", () => {
  const table = wild.table("firered", "ROUTE6", "land");
  const compiled = wild.compileArea(table, "land");
  const scratch = wild.newScratch();
  let seed = 0xdeadbeef;
  for (let n = 0; n < 2000; n++) {
    const h1 = wild.encounter(seed, table, "land");
    // State right after the PID: the H1 calls minus the 2 for the IVs.
    const afterPid = advance(seed, h1.spread.calls - 2);
    const s1 = nextSeed(afterPid), s2 = nextSeed(s1), s3 = nextSeed(s2);
    for (const [method, ivs] of [[2, ivsOf(out(s2), out(s3))], [4, ivsOf(out(s1), out(s3))]] as const) {
      const e = wild.encounter(seed, table, "land", null, null, method);
      expect([e.slot, e.level, e.spread.pid]).toEqual([h1.slot, h1.level, h1.spread.pid]);
      expect(STATS.map((k) => e.spread.ivs[k])).toEqual(ivs);
      expect(e.spread.calls).toBe(h1.spread.calls + 1);
      const fast = wild.encounterInto(seed, compiled, scratch, method);
      expect([fast.pid, [...fast.ivs], fast.calls]).toEqual([e.spread.pid, ivs, e.spread.calls]);
    }
    seed = nextSeed(seed);
  }
});

test("static M2 and M4 in the service and in staticSpread", () => {
  const seed = 0x0badf00d;
  for (const method of [2, 4] as const) {
    const found = service.searchStatic({ seed: seed.toString(16), first: 0, last: 50, method, limit: 100 }).results;
    expect(found.length).toBe(51);
    for (const r of found) {
      const spread = staticSpread(advance(seed, r.advance), method);
      expect(r.ivs).toEqual(STATS.map((k) => spread.ivs[k]));
      expect(r.method).toBe(method);
    }
  }
  expect(service.searchStatic({ seed: "1", first: 0, last: 0 }).results[0].method).toBeUndefined();
});

test("calibrate finds an H4 encounter and reports the method", () => {
  const entries = switchseed.table("firered", "mono/help/a", "switch1");
  const real = entries[500];
  const table = wild.table("firered", "ROUTE6", "land");
  const e = wild.encounter(advance(real.seed, 2_345), table, "land", null, null, 4);
  const iv_options = STATS.map((k) => [e.spread.ivs[k]]);
  const params = {
    game: "firered", setting: "mono/help/a", console: "switch1", target_index: 500, target_advance: 2_345, window: 10, leeway: 0,
    nature: service.meta().natures[e.spread.nature], iv_options, kind: "wild", version: "firered", map: "ROUTE6", area: "land",
    species: e.speciesId, level: e.level,
  };
  expect(service.calibrate(params).results.some((r) => r.advance === 2_345)).toBe(false);
  const hits = service.calibrate({ ...params, methods: [1, 2, 4] }).results;
  expect(hits.find((r) => r.advance === 2_345)).toMatchObject({ method: 4, dms: 0 });
});

test("EV slack: a Pidgey that gained EVs in battle is still explained", () => {
  // Adamant Pidgey with Speed IV 14, 0 EVs at level 13 and 4 Speed EVs afterwards.
  const nature = 3;
  const ivs = { hp: 2, attack: 24, defense: 16, speed: 14, sp_attack: 12, sp_defense: 15 };
  const zero = { hp: 0, attack: 0, defense: 0, speed: 0, sp_attack: 0, sp_defense: 0 };
  const obs: species.Observation[] = [
    [13, species.calcStats(16, 13, ivs, zero, nature)],
    [14, species.calcStats(16, 14, ivs, { ...zero, speed: 4 }, nature)],
    [15, species.calcStats(16, 15, ivs, { ...zero, speed: 8 }, nature)],
  ];
  expect(species.possibleIvs(16, nature, obs).speed).not.toContain(14);
  const slack = species.possibleIvs(16, nature, obs, null, 20);
  for (const k of STATS) expect(slack[k]).toContain(ivs[k]);
  // No slack on the first row: the catch level still holds without EVs.
  expect(species.possibleIvs(16, nature, obs.slice(0, 1), null, 20)).toEqual(species.possibleIvs(16, nature, obs.slice(0, 1)));
});

test("calibrate reports progress until the end", () => {
  const seen: [number, number][] = [];
  service.calibrate({ game: "firered", setting: "mono/help/a", target_index: 100, target_advance: 1000, window: 5, leeway: 3,
    seed_shift: 0, seed_spread: 4, nature: "Hardy" }, (done, total) => seen.push([done, total]));
  expect(seen.length).toBe(7 * 9);
  expect(seen[seen.length - 1]).toEqual([63, 63]);
});

test("tolerant target: counts in how many likely seeds the same frame advance passes", () => {
  const base = { seed: "16A6", first: 3000, last: 3200, nature: "Adamant", limit: 1000 };
  const plain = service.searchStatic(base).results;
  expect(plain[0].tolerance).toBeUndefined();
  const same = service.searchStatic({ ...base, alt_seeds: [0x16a6] }).results;
  expect(same.every((r) => r.tolerance === 2 && r.tolerance_of === 2)).toBe(true);
  const other = 0x16a4;
  const withAlt = service.searchStatic({ ...base, alt_seeds: [other] }).results;
  const inOther = new Set(service.searchStatic({ ...base, seed: "16A4" }).results.map((r) => r.advance));
  for (const r of withAlt) expect(r.tolerance).toBe(inOther.has(r.advance) ? 2 : 1);
});
