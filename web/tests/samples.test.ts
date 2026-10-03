// Check against real Pokémon, when the files exist locally (they are not in git), like
// tests/test_samples.py: ../pk3-en and ../pk3-jp with .pk3 files exported by PKHeX (unencrypted).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Pk3, load } from "../src/lib/gen3/pk3";
import { check } from "../src/lib/gen3/validate";

const ROOT = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : name.endsWith(".pk3") ? [path] : [];
  });
}

const FILES = ["pk3-en", "pk3-jp"].map((name) => join(ROOT, name)).filter(existsSync).flatMap(files).sort();

test.skipIf(!FILES.length)("PKHeX files: unencrypted, checksum, round trip and no validation error", () => {
  for (const path of FILES) {
    const data = new Uint8Array(readFileSync(path));
    const [mon, encrypted] = load(data);
    expect(encrypted, `${path}: .pk3 do PKHeX deveria ser texto plano`).toBe(false);
    expect(mon.checksumOk, path).toBe(true);
    expect(mon.data, path).toEqual(data);
    expect(Pk3.fromRaw(mon.toRaw()).data, path).toEqual(mon.data);
    expect(check(mon).filter((i) => i.level === "error"), path).toEqual([]);
  }
}, 120_000);
