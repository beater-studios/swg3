// Offline service worker (scripts/sw.mjs): what goes into the precache and when the cache name changes.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { offlineFiles, pageUrl, serviceWorker } from "../scripts/sw.mjs";

function dist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "sw-"));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return dir;
}

const FILES = {
  "index.html": "pt", "en.html": "en", "rng.html": "rng", "en/guides/ace.html": "ace", "404.html": "404", "en/404.html": "404",
  "assets/index-abc.js": "js", "assets/index-abc.css": "css", "assets/font-abc.woff2": "font", "mon/front/1.png": "png",
  "mon/palettes.json": "{}", "manifest.webmanifest": "{}", "en/manifest.webmanifest": "{}", "icon.svg": "<svg/>",
  "og-pt.png": "share", "sw.js": "old", "todo": "notes", ".htaccess": "rules", "sitemap.xml": "xml", "robots.txt": "txt",
  "fonts/OFL.txt": "license",
};

test("clean URL of each prerendered page", () => {
  expect(pageUrl("index.html")).toBe("/");
  expect(pageUrl("en.html")).toBe("/en");
  expect(pageUrl("en/guides/ace.html")).toBe("/en/guides/ace");
  expect(pageUrl("404.html")).toBe("/404");
});

test("precache: pages, assets, sprites, icons and manifests; not share images, server files or loose files", () => {
  expect(offlineFiles(dist(FILES))).toEqual([
    "404.html", "assets/font-abc.woff2", "assets/index-abc.css", "assets/index-abc.js", "en.html", "en/404.html",
    "en/guides/ace.html", "en/manifest.webmanifest", "icon.svg", "index.html", "manifest.webmanifest", "mon/front/1.png",
    "mon/palettes.json", "rng.html",
  ]);
});

test("the worker gets the clean URLs, and the cache name changes with any file", () => {
  const { config, source } = serviceWorker(dist(FILES), { slug: "x", version: "1.0.0" });
  expect(config.urls).toContain("/");
  expect(config.urls).toContain("/en/guides/ace");
  expect(config.urls).toContain("/mon/front/1.png");
  expect(config.pages).toEqual(["/404", "/en", "/en/404", "/en/guides/ace", "/", "/rng"]);
  expect(config.cache).toMatch(/^x-1\.0\.0-[0-9a-f]{10}$/);
  expect(config.prefix).toBe("x-");
  expect(source).not.toContain("__CONFIG__");
  expect(() => new Function(source)).not.toThrow();
  const changed = serviceWorker(dist({ ...FILES, "rng.html": "rng v2" }), { slug: "x", version: "1.0.0" });
  expect(changed.config.cache).not.toBe(config.cache);
  const ignored = serviceWorker(dist({ ...FILES, "og-pt.png": "new share image" }), { slug: "x", version: "1.0.0" });
  expect(ignored.config.cache).toBe(config.cache);
});
