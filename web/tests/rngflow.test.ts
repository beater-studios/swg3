import { describe, expect, test } from "vitest";
import { buildPhases, correction, DEFAULT_TIMER, framesToMs, type ChosenSeed, type Target } from "../src/lib/rngflow";
import { schedule } from "../src/lib/timer";

const chosen: ChosenSeed = { index: 259, seed: "16A6", ms: 35004, game: "firered", setting: "mono/help/a", console: "switch1" };
const target: Target = { kind: "static", advance: 2000, label: "Bulbasaur", species: 1, wild: null };

describe("RNG flow", () => {
  test("steps with map time (same numbers as the old site)", () => {
    const phases = buildPhases(chosen, target, DEFAULT_TIMER);
    expect(phases.map((p) => p.ms)).toEqual([35004, 13394, 10046]);
    expect(phases[0].label).toContain("A");
  });

  test("no map time: two steps", () => {
    expect(buildPhases(chosen, target, { ...DEFAULT_TIMER, overworld: 0 }).map((p) => p.ms)).toEqual([35004, framesToMs(2000)]);
  });

  test("target too early and missing selections", () => {
    expect(() => buildPhases(chosen, { ...target, advance: 1000 }, DEFAULT_TIMER)).toThrow(/1000/);
    expect(() => buildPhases(null, target, DEFAULT_TIMER)).toThrow();
    expect(() => buildPhases(chosen, null, DEFAULT_TIMER)).toThrow();
  });

  test("correction: landed 34 ms and 30 frames early", () => {
    expect(correction(34, -30)).toEqual({ cal1: -34, cal2: 502 });
  });

  test("beeps: the last one at the end of each step, none before the start", () => {
    const { ends, beepTimes } = schedule([{ label: "a", ms: 1200 }, { label: "b", ms: 3000 }], 5, 500);
    expect(ends).toEqual([1200, 4200]);
    expect(beepTimes.filter((b) => b.last).map((b) => b.at)).toEqual([1200, 4200]);
    expect(beepTimes.every((b) => b.at >= 0)).toBe(true);
    expect(beepTimes.filter((b) => b.at <= 1200)).toHaveLength(3);
  });
});

test("press chance: up to about 2 frames does not correct the timer", async () => {
  const { withinChance } = await import("../src/lib/rngflow");
  expect(withinChance(0, 0)).toBe(true);
  expect(withinChance(-34, 2)).toBe(true);       // 2 table rows and 2 frame advances
  expect(withinChance(51, 0)).toBe(false);       // 3 rows
  expect(withinChance(0, -3)).toBe(false);
});

test("minimum window and wait on CONTINUE", async () => {
  const { minAdvanceFor, continueFramesFor, MIN_CONTINUE_FRAMES } = await import("../src/lib/rngflow");
  expect(minAdvanceFor(600)).toBe(1200 + MIN_CONTINUE_FRAMES);
  expect(minAdvanceFor(500)).toBe(1450);
  expect(continueFramesFor(5000, 500)).toBe(4000);
});

test("results table: Ability as 1st and 2nd only for species with two; gender as a symbol", async () => {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { ResultTable } = await import("../src/pages/rng/ResultTable");
  const row = { advance: 3000, pid: "00000001", nature: "Hardy", ability: 1, ivs: [1, 2, 3, 4, 5, 6], gender: "F" };
  // Geodude (74) has Rock Head and Sturdy; Bulbasaur (1) only Overgrow.
  const geodude = renderToString(createElement(ResultTable, { kind: "static", overworld: 600, speciesId: 74, rows: [{ ...row, ability_name: "STURDY" }] }));
  expect(geodude).toMatch(/Sturdy \(2ª\)/);
  expect(geodude).toContain("gender-f");
  const bulba = renderToString(createElement(ResultTable, { kind: "static", overworld: 600, speciesId: 1, rows: [{ ...row, ability: 0, ability_name: "OVERGROW" }] }));
  expect(bulba).toMatch(/>Overgrow</);
  expect(renderToString(createElement(ResultTable, { kind: "static", overworld: 600, rows: [row] }))).toContain("2ª");
});

test("TID and SID with a leading zero (as the Trainer Card shows, 01234) are the same number", async () => {
  const { optionalInt } = await import("../src/components/format");
  const service = await import("../src/lib/services/rng");
  expect(optionalInt("01234", "TID", 0, 65535)).toBe(1234);
  expect(optionalInt("00042", "SID", 0, 65535)).toBe(42);
  const base = { seed: "16A6", first: 3000, last: 3050, limit: 100 };
  const padded = service.searchStatic({ ...base, tid: "01234", sid: "00042" }).results;
  const plain = service.searchStatic({ ...base, tid: 1234, sid: 42 }).results;
  expect(padded.map((r) => r.shiny)).toEqual(plain.map((r) => r.shiny));
});

test("wild table: stats at the level on screen, slot only in the CSV", async () => {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { ResultTable, toCsv } = await import("../src/pages/rng/ResultTable");
  // Quiet Oddish at level 16 with IVs 3/10/30/7/11/4 (HP/Atk/Def/SpA/SpD/Spe): the real case of seed 7160.
  const ivsGame = [3, 10, 30, 4, 7, 11];   // game order: HP, Atk, Def, Spe, SpA, SpD
  const row = { advance: 1017, slot: 6, species: "ODDISH", species_id: 43, level: 16, pid: "00000000", nature: "Quiet", ivs: ivsGame };
  const html = renderToString(createElement(ResultTable, { kind: "wild", overworld: 600, rows: [row] }));
  expect(html).toContain("40/22/27/33/27/13");
  expect(html).not.toMatch(/>Slot</);
  expect(toCsv("wild", [row], 600).split("\n")[0]).toContain("Slot");
});
