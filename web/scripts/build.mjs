// Pre-rendering site build: one HTML file per page and language, plus sitemap.xml, robots.txt, one manifest.webmanifest per
// language and the offline service worker (sw.js, scripts/sw.mjs).
// Usage: node scripts/build.mjs [--outDir dist]

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename as baseName, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { serviceWorker } from "./sw.mjs";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = process.argv.indexOf("--outDir");
const outDir = resolve(web, at > 0 ? process.argv[at + 1] : "dist");
const ssrDir = join(web, "node_modules", ".cache", `ssr-${baseName(outDir)}`);
const brand = JSON.parse(readFileSync(join(web, "..", "src", "swg3", "brand.json"), "utf8"));
const { version } = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));

// Tool bodies (pages/tools.tsx), preloaded on their page.
const TOOLS = { "/rng": "src/pages/rng/RngPage.tsx", "/editor": "src/pages/pokemon/PokemonPage.tsx", "/codes": "src/pages/codes/CodesPage.tsx" };

await build({ root: web, build: { outDir, emptyOutDir: true, manifest: true } });
await build({
  root: web, logLevel: "warn",
  build: { ssr: "src/entry-server.tsx", outDir: ssrDir, emptyOutDir: true, copyPublicDir: false },
});

const server = await import(pathToFileURL(join(ssrDir, "entry-server.js")).href);
const template = readFileSync(join(outDir, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(join(outDir, ".vite", "manifest.json"), "utf8"));

function chunkFiles(key, seen = new Set()) {
  const entry = manifest[key];
  if (!entry || seen.has(key)) return [];
  seen.add(key);
  if (entry.isEntry) return [];
  return [entry.file, ...(entry.imports ?? []).flatMap((k) => chunkFiles(k, seen))];
}

const font = readdirSync(join(outDir, "assets")).find((f) => /^pixelify-sans-latin-(?!ext-)[\w-]+\.woff2$/.test(f));
if (!font) console.warn("warning: latin font not found in assets; no preload");

const pages = server.renderAll();
for (const page of pages) {
  const preload = [
    ...(font ? [`<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin>`] : []),
    ...[...new Set(chunkFiles(TOOLS[page.path]))].map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`),
  ].join("\n");
  // Replacer functions: the page HTML may contain "$&", which a string replacement would interpret.
  const html = template
    .replace('<html lang="pt-BR">', () => `<html lang="${page.htmlLang}">`)
    .replace('<link rel="manifest" href="/manifest.webmanifest">', () => `<link rel="manifest" href="${server.manifestPath(page.lang)}">`)
    .replace("<!--head-->", () => `${page.head}\n${preload}`)
    .replace('<div id="root"><!--app--></div>', () => `<div id="root" data-route="${page.route}">${page.app}</div>`);
  const target = join(outDir, page.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

const sitemap = server.sitemapXml();
if (sitemap) writeFileSync(join(outDir, "sitemap.xml"), sitemap);
else console.warn("warning: brand.json has no url; no sitemap.xml, canonical, hreflang, og:url or og:image");
writeFileSync(join(outDir, "robots.txt"), server.robotsTxt());
for (const lang of server.LANGS) writeFileSync(join(outDir, server.manifestPath(lang).slice(1)), server.manifestJson(lang));

rmSync(join(outDir, ".vite"), { recursive: true, force: true });
rmSync(ssrDir, { recursive: true, force: true });
if (!existsSync(join(outDir, ".htaccess"))) console.warn("warning: .htaccess was not copied to the build");
const worker = serviceWorker(outDir, { slug: brand.slug, version });
writeFileSync(join(outDir, "sw.js"), worker.source);
console.log(`service worker: ${worker.config.urls.length} files offline, cache ${worker.config.cache}`);
console.log(`pre-rendered: ${pages.length} pages in ${outDir}`);
