// Site name: comes only from src/swg3/brand.json. No code writes the name by hand.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import brand from "@brand";
import { BRAND_NAME, fileName, REPO_URL, SITE_URL, storageKey } from "../src/brand";

const ROOT = join(__dirname, "..", "..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}

test("the name only exists in brand.json", () => {
  const sources = [
    ...files(join(ROOT, "web", "src"), /\.(ts|tsx|css|md)$/),
    ...files(join(ROOT, "web", "e2e"), /\.ts$/),
    join(ROOT, "web", "index.html"),
    ...files(join(ROOT, "src", "swg3"), /\.py$/),
  ];
  const found = sources.filter((path) => {
    const text = readFileSync(path, "utf8");
    return text.includes(brand.name) || text.includes(`"${brand.slug}.`) || text.includes(`${brand.slug}-`);
  });
  expect(found.map((p) => p.slice(ROOT.length + 1))).toEqual([]);
  expect(BRAND_NAME).toBe(brand.name);
  expect(storageKey("rng")).toBe(`${brand.slug}.rng`);
  expect(fileName("static.csv")).toBe(`${brand.slug}-static.csv`);
});


test("site URL: empty or https without a trailing slash, written only in brand.json", () => {
  const url: string = brand.url;
  expect(url === "" || /^https:\/\/[^/]+$/.test(url), url).toBe(true);
  expect(SITE_URL).toBe(url);
  if (!url) return;
  const host = new URL(url).host;
  const sources = [
    ...files(join(ROOT, "web", "src"), /\.(ts|tsx|css|md|json)$/),
    ...files(join(ROOT, "web", "e2e"), /\.ts$/),
    ...files(join(ROOT, "web", "scripts"), /\.mjs$/),
    join(ROOT, "web", "index.html"),
    join(ROOT, "web", "public", ".htaccess"),
  ];
  expect(sources.filter((path) => readFileSync(path, "utf8").includes(host)).map((p) => p.slice(ROOT.length + 1))).toEqual([]);
});

test("source repository: empty or an https URL without a trailing slash, written only in brand.json", () => {
  const repo: string = brand.repo ?? "";
  expect(repo === "" || /^https:\/\/[^/]+\/\S+[^/]$/.test(repo), repo).toBe(true);
  expect(REPO_URL).toBe(repo);
});
