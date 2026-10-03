// Check seed, with the same parameters as the tab (src/pages/rng/CheckStep.tsx).
import { expect, test } from "vitest";
import { NATURES, STATS } from "../src/lib/gen3/pk3";
import { advance } from "../src/lib/gen3/rng";
import { calcStats } from "../src/lib/gen3/species";
import * as switchseed from "../src/lib/gen3/switchseed";
import * as wild from "../src/lib/gen3/wild";
import * as rng from "../src/lib/services/rng";

const zero = Object.fromEntries(STATS.map((s) => [s, 0])) as Record<(typeof STATS)[number], number>;

test("with two levels only the real seed remains, with the difference in ms", () => {
  const entries = switchseed.table("firered", "mono/help/a", "switch1");
  const chosen = entries[300];
  const real = entries[303];          // pressed 3 seeds late
  const found = wild.encounter(advance(real.seed, 7_345), wild.table("firered", "ROUTE6", "land"), "land");
  const nature = NATURES[found.spread.nature];
  const at = (level: number) => {
    const stats = calcStats(found.speciesId, level, found.spread.ivs, zero, found.spread.nature);
    return { level, stats: STATS.map((s) => stats[s]) };
  };
  const search = (observations: { level: number; stats: number[] }[]) => {
    const calc = rng.ivCalc({ species: found.speciesId, nature, observations });
    return rng.calibrate({
      game: "firered", setting: "mono/help/a", console: "switch1", target_index: chosen.index,
      target_advance: 10_300, window: 10_000, leeway: 10, nature, iv_options: calc.options,
      kind: "wild", version: "firered", map: "ROUTE6", area: "land", species: found.speciesId, level: found.level,
    }).results;
  };
  const one = search([at(found.level)]);
  expect(one.some((r) => r.seed_index === real.index && r.advance === 7_345)).toBe(true);
  const more = search([at(found.level), at(found.level + 4), at(found.level + 10)]);
  expect(new Set(more.map((r) => r.seed)).size).toBe(1);
  expect(more[0]).toMatchObject({ seed_index: real.index, advance: 7_345, dms: real.ms - chosen.ms });
});

test("recorded times: advance range and advances per frame on the map", async () => {
  const { advanceRange, mapRate } = await import("../src/pages/rng/CheckStep");
  // Real case: CONTINUE at 20 s and battle at 45 s. CDC8 (advance 4,515) fits; E8F0 (7,934) does not.
  const [min, max] = advanceRange(20, 45)!;
  expect(min).toBeLessThanOrEqual(4_515);
  expect(max).toBeGreaterThanOrEqual(4_515);
  expect(max).toBeLessThan(7_934);
  // Without the CONTINUE mark the range is wider (1 to 4 advances per frame the whole time).
  const [wideMin, wideMax] = advanceRange(null, 45)!;
  expect(wideMin).toBeLessThanOrEqual(4_515);
  expect(wideMax).toBeGreaterThan(max);
  expect(advanceRange(20, null)).toBeNull();
  // 20 s of menu at 1 per frame and 25 s of map at 2 per frame give rate 2.
  const fps = 16777216 / 280896;
  expect(mapRate(Math.round(20 * fps + 25 * fps * 2), 20, 45)).toBeCloseTo(2, 2);
  expect(mapRate(4_515, null, 45)).toBeNull();
});

test("real case: Oddish and Pidgey from the same attempt find seed 7160, 16 below the table", async () => {
  const { advanceRange } = await import("../src/pages/rng/CheckStep");
  const entries = switchseed.table("firered", "mono/help/a", "switch1");
  const target = entries.findIndex((e) => e.seed === 0x16a6);
  const iv = (species: number, nature: string, level: number, stats: number[]) =>
    rng.ivCalc({ species, nature, observations: [{ level, stats: [stats[0], stats[1], stats[2], stats[5], stats[3], stats[4]] }] }).options;
  const [low, high] = advanceRange(4.8, 12.6)!;
  const half = Math.ceil((high - low) / 2);
  const params = {
    game: "firered", setting: "mono/help/a", console: "switch1", target_index: target, target_advance: low + half, window: half,
    leeway: 110, seed_shift: 0, seed_spread: 0x20, methods: [1, 2, 4],
    kind: "wild", version: "firered", map: "ROUTE6", area: "land",
    species: 43, level: 16, nature: "Quiet", gender: "M", iv_options: iv(43, "Quiet", 16, [40, 22, 27, 33, 27, 13]),
  };
  const alone = rng.calibrate(params).results;
  expect(new Set(alone.map((r) => `${r.seed_index}:${r.seed}`)).size).toBeGreaterThan(1);
  // With the Pidgey from the same attempt, 7160 remains (table row 7170, at -1.68 s).
  const pair = rng.calibrate({ ...params, second: {
    version: "firered", map: "ROUTE6", area: "land", species: 16, level: 13, nature: "Quirky", gender: "F",
    iv_options: iv(16, "Quirky", 13, [34, 16, 15, 15, 15, 22]), window: 30_000,
  } }).results;
  expect(new Set(pair.map((r) => `${r.seed_index}:${r.seed}`))).toEqual(new Set([`${entries.findIndex((e) => e.seed === 0x7170)}:7160`]));
  // 1,017 and 1,025 give the same Oddish (the PID is rerolled until the nature matches).
  expect(pair[0]).toMatchObject({ seed: "7160", dseed: -16, dms: -1683, method: 1 });
  expect([1017, 1025]).toContain(pair[0].advance);
  expect(pair[0].second).toMatchObject({ advance: 8703, species: "PIDGEY", level: 13 });
}, 60_000);

test("gender in the form: genderless, fixed or variable", async () => {
  const { fixedGender } = await import("../src/pages/rng/CaughtMon");
  expect(fixedGender("81")).toBe("-");     // Magnemite
  expect(fixedGender("29")).toBe("F");     // Nidoran female
  expect(fixedGender("106")).toBe("M");    // Hitmonlee
  expect(fixedGender("16")).toBeNull();    // Pidgey
  expect(fixedGender("")).toBeNull();
});
