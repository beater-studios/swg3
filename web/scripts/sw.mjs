// Builds dist/sw.js from sw-template.js: the precache list of the build and a cache name that changes with any file.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const TEMPLATE = new URL("./sw-template.js", import.meta.url);
const OFFLINE = /\.(html|js|css|woff2|png|svg|json|webmanifest)$/;
// Share images are only fetched by link previews; sw.js is the worker itself.
const SKIP = /^(og-[^/]+\.png|sw\.js)$/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Clean URL of a prerendered page ("index.html" is "/", "en/guides/ace.html" is "/en/guides/ace"). */
export function pageUrl(file) {
  const clean = `/${file.replace(/\.html$/, "")}`;
  return clean === "/index" ? "/" : clean;
}

/** Files of the build that go offline, relative and with forward slashes, sorted. */
export function offlineFiles(outDir) {
  return walk(outDir)
    .map((path) => relative(outDir, path).split(sep).join("/"))
    .filter((file) => OFFLINE.test(file) && !SKIP.test(file))
    .sort();
}

export function serviceWorker(outDir, { slug, version }) {
  const files = offlineFiles(outDir);
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\0").update(readFileSync(join(outDir, file)));
  const pages = files.filter((file) => file.endsWith(".html")).map(pageUrl);
  const config = {
    cache: `${slug}-${version}-${hash.digest("hex").slice(0, 10)}`,
    prefix: `${slug}-`,
    urls: files.map((file) => (file.endsWith(".html") ? pageUrl(file) : `/${file}`)),
    pages,
  };
  return { config, source: readFileSync(TEMPLATE, "utf8").replace("__CONFIG__", () => JSON.stringify(config)) };
}
