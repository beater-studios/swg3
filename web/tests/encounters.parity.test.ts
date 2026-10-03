// Parity of the "encounters" area with the former Python RNG (wild, eggs, Switch seeds, calibration, RNG service).
// Frozen vectors: TS is the only RNG implementation now, so these are regression tests. Do not regenerate.
// Exception: egg pickup (egg.pickup and ok responses of search_egg_pickup). The Python version removed the stat by value
// instead of by position (RemoveIVIndexFromList) and missed the VBlank calls (PokeFinder methods); those vectors stay
// unused and pickup is checked in egg.test.ts against a literal simulation of the decomp.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { setLang, type Lang } from "../src/i18n";
import * as calibration from "../src/lib/gen3/calibration";
import * as egg from "../src/lib/gen3/egg";
import { STATS, type Stat, type StatValues } from "../src/lib/gen3/pk3";
import * as switchseed from "../src/lib/gen3/switchseed";
import * as wild from "../src/lib/gen3/wild";
import * as service from "../src/lib/services/rng";

type Out = { ok: true; result: unknown } | { ok: false; error: string };
interface ServiceCase { fn: string; lang: Lang; params: service.Params; out: Out }
type EncounterVector = [string, string, wild.Area, wild.Rod | null, number, number, string, number, number, number, number[], number];

interface Vectors {
  services: ServiceCase[];
  unknown: { lang: Lang; out: Out }[];
  encounter: EncounterVector[];
  wild_search: { version: string; map: string; area: wild.Area; rod: wild.Rod | null; seed: number; first: number; last: number; found: [number, number, number, number][] }[];
  egg: {
    generated: [number, number, number | null][];
    pickup: { seed: number; low: number; parents: [StatValues, StatValues] | null; pid: number; ivs: StatValues; inherited: [Stat, number][]; calls: number }[];
  };
  switchseed: {
    digests: [string, string, string, number, number, [number, number, number, number, number][]][];
    find: [string, string, number, [number, number, number][]][];
    describe: [string, string][];
  };
  calibration: {
    game: string; setting: string; console: string; index: number; leeway: number; window: number[]; target: number; nature: number;
    hits: [number, number, number, number[]][]; wild: [number, number, number, number, number][];
  }[];
}

const V = JSON.parse(readFileSync(join(__dirname, "vectors", "frozen", "encounters.json"), "utf8")) as Vectors;

afterEach(() => setLang("pt"));

describe("service (web.py)", () => {
  const byFunction = new Map<string, ServiceCase[]>();
  for (const c of V.services) byFunction.set(c.fn, [...(byFunction.get(c.fn) ?? []), c]);

  test.each([...byFunction.keys()])("%s", (fn) => {
    for (const c of byFunction.get(fn)!) {
      if (fn === "search_egg_pickup" && c.out.ok) continue;   // documented exception, see the top
      setLang(c.lang);
      expect(service.call(c.fn, c.params), `${c.lang} ${JSON.stringify(c.params)}`).toEqual(c.out);
    }
  });

  test("unknown function", () => {
    for (const c of V.unknown) {
      setLang(c.lang);
      expect(service.call("nope", {})).toEqual(c.out);
    }
  });

  test("covers the web.py functions and both languages in errors", () => {
    expect([...byFunction.keys()].sort()).toEqual(Object.keys(service.FUNCTIONS).sort());
    const errors = V.services.filter((c) => !c.out.ok);
    expect(errors.some((c) => c.lang === "en")).toBe(true);
    expect(() => service.searchStatic({})).toThrow(service.ParamError);
  });
});

describe("wild", () => {
  test("encounter in every area and rod", () => {
    for (const [version, map, area, rod, seed, slot, name, speciesId, level, pid, ivs, calls] of V.encounter) {
      const table = wild.table(version, map, area);
      const chamber = wild.chamberIndex(map);
      const e = wild.encounter(seed, table, area, rod, chamber);
      const label = `${version} ${map} ${area} ${rod} ${seed}`;
      expect([e.slot, e.species, e.speciesId, e.level, e.spread.pid, STATS.map((k) => e.spread.ivs[k]), e.spread.calls], label)
        .toEqual([slot, name, speciesId, level, pid, ivs, calls]);
      const fast = wild.encounterInto(seed, wild.compileArea(table, area, rod, chamber), wild.newScratch());
      expect([fast.slot, fast.speciesId, fast.level, fast.pid, [...fast.ivs], fast.calls], label).toEqual([slot, speciesId, level, pid, ivs, calls]);
    }
  });

  test("search", () => {
    for (const v of V.wild_search) {
      const found = wild.search(v.seed, v.first, v.last, wild.table(v.version, v.map, v.area), v.area, (e) => e.spread.ivs.hp >= 25, v.rod, wild.chamberIndex(v.map));
      expect(found.map(([n, e]) => [n, e.slot, e.level, e.spread.pid])).toEqual(v.found);
    }
  });
});

describe("egg", () => {
  test("eggGenerated", () => {
    for (const [seed, compatibility, low] of V.egg.generated) {
      expect(egg.eggGenerated(seed, compatibility)).toBe(low);
      expect(egg.eggGeneratedFast(seed, compatibility)).toBe(low ?? -1);
    }
  });
});

describe("switchseed", () => {
  test("every table (size, ends and digest)", () => {
    for (const [game, setting, console, length, digest, ends] of V.switchseed.digests) {
      const entries = switchseed.table(game, setting, console);
      let got = 0;
      for (const e of entries) got = (got * 31 + e.row * 7 + e.seed * 3 + e.ms) % 2 ** 32;
      const pick = (e: switchseed.Entry) => [e.index, e.row, e.seed, e.frames, e.ms];
      expect([entries.length, (got + 2 ** 32) % 2 ** 32, [pick(entries[0]), pick(entries[entries.length - 1])]], `${game} ${setting} ${console}`)
        .toEqual([length, digest, ends]);
    }
  });

  test("find and describe", () => {
    for (const [game, setting, seed, found] of V.switchseed.find) {
      expect(switchseed.find(game, setting, seed).map((e) => [e.index, e.row, e.ms])).toEqual(found);
    }
    for (const [setting, text] of V.switchseed.describe) expect(switchseed.describe(setting)).toBe(text);
  });
});

describe("calibration", () => {
  test("window and search (static and wild)", () => {
    for (const v of V.calibration) {
      const [entries, target] = calibration.window(v.game, v.setting, v.console, v.index, v.leeway);
      expect([entries.map((e) => e.index), target.index]).toEqual([v.window, v.target]);
      const hits = calibration.search(entries, 100, 400, { nature: v.nature, ivOptions: { hp: Array.from({ length: 16 }, (_, i) => i + 16) } });
      expect(hits.map((h) => [h.entry.index, h.advance, h.pid, STATS.map((k) => h.ivs[k])])).toEqual(v.hits);
      const wildHits = calibration.search(entries, 50, 120, { kind: "wild", areaTable: wild.table(v.game, "ROUTE1", "land"), area: "land", level: 3 });
      expect(wildHits.map((h) => [h.entry.index, h.advance, h.pid, h.speciesId, h.level])).toEqual(v.wild);
    }
  });
});

describe("performance", () => {
  const time = (label: string, run: () => { count: number }) => {
    const start = performance.now();
    const { count } = run();
    const ms = performance.now() - start;
    console.log(`${label}: ${ms.toFixed(0)} ms (${count} hits)`);
  };

  test("static and wild search over 1,000,000 advances", () => {
    time("search_static 1,000,000", () => service.searchStatic({ seed: "5A5A", first: 0, last: 999_999, min_ivs: [20, 20, 20, 20, 20, 20] }));
    time("search_static 1,000,000 unfiltered", () => service.searchStatic({ seed: "5A5A", first: 0, last: 999_999 }));
    time("search_wild 1,000,000", () => service.searchWild({ seed: "5A5A", first: 0, last: 999_999, version: "firered", map: "ROUTE1", area: "land", min_ivs: [20, 20, 20, 20, 20, 20] }));
    time("search_wild 1,000,000 Tanoby", () => service.searchWild({ seed: "5A5A", first: 0, last: 999_999, version: "firered", map: "SEVEN_ISLAND_TANOBY_RUINS_LIPTOO_CHAMBER", area: "land", natures: ["Adamant"] }));
  }, 120_000);
});
