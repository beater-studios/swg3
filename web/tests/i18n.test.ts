// Every text passed to t("...") or N_("...") in src/ needs a translation in src/i18n/en/*.json,
// with the same {name} fields, without dashes, and with no leftover keys.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const SRC = join(__dirname, "..", "src");
const CALL = /\b(?:t|tx|N_)\(\s*"((?:\\.|[^"\\])*)"/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// src/design is the internal design system catalog: its t("...") calls are code examples.
function used(): Map<string, string> {
  const out = new Map<string, string>();
  for (const path of files(SRC).filter((p) => !p.startsWith(join(SRC, "design")))) {
    for (const match of readFileSync(path, "utf8").matchAll(CALL)) out.set(JSON.parse(`"${match[1]}"`), path);
  }
  return out;
}

function dictionary(): Record<string, string> {
  const dir = join(SRC, "i18n", "en");
  return Object.assign({}, ...readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => JSON.parse(readFileSync(join(dir, n), "utf8"))));
}

const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("every text has English, with the same fields and without dashes", () => {
  const dict = dictionary();
  const missing = [...used()].filter(([text]) => !(text in dict)).map(([text, path]) => `${text}  (${path})`);
  expect(missing).toEqual([]);
  for (const [pt, en] of Object.entries(dict)) {
    expect(fields(en), pt).toBe(fields(pt));
    expect(/[—–]/.test(en), pt).toBe(false);
  }
});

test("no leftover translations", () => {
  const keys = used();
  expect(Object.keys(dictionary()).filter((k) => !keys.has(k))).toEqual([]);
});
