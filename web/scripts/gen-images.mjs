// Site icons and Open Graph images in public/, rendered in Playwright's Chromium from public/icon.svg and src/content/seo.
// Usage: node scripts/gen-images.mjs (rerun when the site name, icon or tagline changes)

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(web, "public");
const brand = JSON.parse(readFileSync(join(web, "..", "src", "swg3", "brand.json"), "utf8"));
const icon = readFileSync(join(pub, "icon.svg"), "utf8");
const font = readFileSync(join(web, "src", "assets", "fonts", "pixelify-sans-latin.woff2")).toString("base64");

// src/ui/tokens.css (light theme, Fire).
const C = { bg: "#f5efe3", bgDeep: "#ece3d1", surface: "#fffcf5", ink: "#22252f", muted: "#5d6170", frame: "#3a3f4d", fire: "#d4432c", leaf: "#2f8a4c" };

const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const page = (body, css) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Pixelify; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 400 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; }
${css}
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
async function shot(file, width, height, html, transparent = false) {
  const tab = await browser.newPage({ viewport: { width, height } });
  await tab.setContent(html);
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: join(pub, file), omitBackground: transparent });
  await tab.close();
  console.log(file);
}

const iconOnly = (size, background, scale) => page(`<div class="i">${icon}</div>`, `
body { background: ${background}; display: grid; place-items: center; }
.i { width: ${size * scale}px; height: ${size * scale}px; } .i svg { width: 100%; height: 100%; display: block; }`);

await shot("icon-192.png", 192, 192, iconOnly(192, "transparent", 1), true);
await shot("icon-512.png", 512, 512, iconOnly(512, "transparent", 1), true);
// Maskable: the OS crops a circle or other shape; the art stays within the middle 80%.
await shot("icon-maskable-512.png", 512, 512, iconOnly(512, C.surface, 0.72));
await shot("apple-touch-icon.png", 180, 180, iconOnly(180, C.surface, 0.9));

// Trailing number in Fire color, as in components/BrandName.tsx.
const [, name, num] = brand.name.match(/^(.*?)(\d*)$/);

for (const lang of ["pt", "en"]) {
  const seo = JSON.parse(readFileSync(join(web, "src", "content", "seo", `${lang}.json`), "utf8"));
  const tagline = seo.site.tagline.charAt(0).toUpperCase() + seo.site.tagline.slice(1);
  const note = lang === "en" ? "Runs in your browser · Nintendo Switch" : "Roda no navegador · Nintendo Switch";
  await shot(`og-${lang}.png`, 1200, 630, page(`
<div class="card">
  <div class="icon">${icon}</div>
  <div class="text">
    <h1>${esc(name)}<span class="num">${esc(num)}</span></h1>
    <p class="tag">${esc(tagline)}</p>
    <p class="note">${esc(note)}</p>
  </div>
</div>`, `
body { background: ${C.bg}; display: grid; place-items: center; font-family: Pixelify, monospace; color: ${C.ink}; }
.card { width: 1104px; height: 534px; display: flex; align-items: center; gap: 64px; padding: 0 72px; background: ${C.surface};
  border: 8px solid ${C.frame}; border-radius: 24px; box-shadow: 0 12px 0 ${C.bgDeep}; }
.icon { width: 280px; height: 280px; flex: none; } .icon svg { width: 100%; height: 100%; display: block; }
h1 { font-size: 104px; font-weight: 700; line-height: 1; } .num { color: ${C.fire}; }
.tag { margin-top: 28px; font-size: 44px; line-height: 1.2; }
.note { margin-top: 28px; font-size: 30px; color: ${C.muted}; border-top: 4px dashed ${C.fire}; padding-top: 20px; display: inline-block; }`));
}

await browser.close();
