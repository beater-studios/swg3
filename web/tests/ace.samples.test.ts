// Base64 writer check against real Pokémon when the local files exist (not in git), like tests/test_samples.py:
// ../pk3-en and ../pk3-jp (PKHeX .pk3, unencrypted) and ../rawpk.txt (public MankeyMite list, hex and Base64 names).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import * as base64box from "../src/lib/gen3/base64box";
import { load } from "../src/lib/gen3/pk3";
import { check } from "../src/lib/gen3/validate";
import { fromHex, toHex } from "../src/lib/pyfmt";

const ROOT = join(__dirname, "..", "..");
const RAWPK = join(ROOT, "rawpk.txt");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : name.endsWith(".pk3") ? [path] : [];
  });
}

const FILES = ["pk3-en", "pk3-jp"].map((name) => join(ROOT, name)).filter(existsSync).flatMap(files).sort();

test.skipIf(!FILES.length)("PKHeX files (1 in 10): Base64 round trip reproduces the bytes", () => {
  for (const path of FILES.filter((_, i) => i % 10 === 0)) {
    const raw = load(new Uint8Array(readFileSync(path)))[0].toRaw();
    for (const switchSafe of [true, false]) {
      const encoded = base64box.encode(raw, switchSafe);
      expect(toHex(base64box.decode(encoded.boxes)), path).toBe(toHex(raw));
    }
  }
}, 120_000);

/** rawpk.txt blocks with 80 bytes of hex and the box names. */
function rawpkBlocks(): [data: Uint8Array, boxes: string[]][] {
  const out: [Uint8Array, string[]][] = [];
  for (const block of readFileSync(RAWPK, "utf8").split(/\n_{20,}\n/)) {
    const match = /Hex code:\s*\n(.*?)\n\s*\n/s.exec(block);
    const boxes = [...block.matchAll(/Box\s+\d+:\s*\(([^)]*)\)/g)].map((m) => m[1]);
    const data = match ? fromHex(match[1].split(/\s+/).join("")) : new Uint8Array();
    if (data && data.length === 80 && boxes.length) out.push([data, boxes]);
  }
  return out;
}

test.skipIf(!existsSync(RAWPK))("rawpk.txt: valid Pokémon and published names reproduced", () => {
  const blocks = rawpkBlocks();
  expect(blocks.length).toBeGreaterThan(25);
  let same = 0;
  for (const [data, boxes] of blocks) {
    const [mon, encrypted] = load(data);
    if (!mon.checksumOk) continue; // the writer's own block is not a Pokémon
    expect(encrypted).toBe(true);
    expect(check(mon).filter((i) => i.level === "error")).toEqual([]);
    if (toHex(base64box.decode(boxes)) === toHex(data)) same += 1;
  }
  // One of the Dittos has hex and names that disagree in the text itself (OT area, outside the checksum).
  expect(same).toBeGreaterThanOrEqual(blocks.length - 2);
});
