// Prerendering entry (scripts/build.mjs): pages, sitemap, robots and manifest. Not part of the browser bundle.

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AppRoutes } from "./app/App";
import { followLang } from "./app/prefs";
import { basename, LANGS, localize, notFound, routeKey, routeList, type RouteMeta } from "./app/routes";
import { headTags, htmlLang } from "./app/head";
import { BRAND_NAME, SITE_URL } from "./brand";
import type { Lang } from "./i18n";

export { LANGS, SITE_URL };

export interface Rendered {
  /** File in dist ("rng.html", "en/guides/ace.html", "404.html"). */
  file: string;
  /** Without language; used to find the page's tool JS. */
  path: string;
  lang: Lang;
  htmlLang: string;
  head: string;
  route: string;
  app: string;
}

function fileOf(meta: RouteMeta): string {
  if (meta.noindex) return meta.lang === "en" ? "en/404.html" : "404.html";
  const url = localize(meta.path, meta.lang);
  return url === "/" ? "index.html" : `${url.slice(1)}.html`;
}

function render(meta: RouteMeta, location: string): Rendered {
  followLang(meta.lang);
  const app = renderToString(
    <StrictMode>
      <StaticRouter basename={basename(meta.lang)} location={location}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  );
  return { file: fileOf(meta), path: meta.path, lang: meta.lang, htmlLang: htmlLang(meta), head: headTags(meta), route: routeKey(meta), app };
}

export function renderAll(): Rendered[] {
  return LANGS.flatMap((lang: Lang) => [
    ...routeList(lang).map((meta) => render(meta, localize(meta.path, lang))),
    render(notFound(lang), localize("/404", lang)),
  ]);
}

/** Empty without SITE_URL. */
export function sitemapXml(): string {
  if (!SITE_URL) return "";
  const urls = routeList("pt").flatMap((pt) => LANGS.map((lang) => {
    const alternates = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}${localize(pt.path, l)}"/>`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${localize(pt.path, "pt")}"/>`);
    return `  <url>\n    <loc>${SITE_URL}${localize(pt.path, lang)}</loc>\n${alternates.join("\n")}\n  </url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n${SITE_URL ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : ""}`;
}

/** Web app manifest of a language (its own start URL; the scope covers both languages). */
export function manifestPath(lang: Lang): string {
  return localize("/manifest.webmanifest", lang);
}

export function manifestJson(lang: Lang): string {
  const home = routeList(lang).find((meta) => meta.path === "/");
  const start = localize("/", lang);
  return `${JSON.stringify({
    id: start,
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: home?.description,
    lang: lang === "en" ? "en" : "pt-BR",
    start_url: start,
    scope: "/",
    display: "standalone",
    // tokens.css: --bg and --surface (the header), like the theme-color meta tags.
    background_color: "#f5efe3",
    theme_color: "#fffcf5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, null, 2)}\n`;
}
