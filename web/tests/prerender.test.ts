// Prerendering (src/entry-server.tsx): each page in both languages comes out with one h1, internal links that
// exist in the same language and the right <head>. Running in Node also proves screens do not use the browser to render.
import { expect, test } from "vitest";
import { renderAll, robotsTxt, sitemapXml } from "../src/entry-server";
import { routeOf, splitLang } from "../src/app/routes";
import { REPO_URL, SITE_URL } from "../src/brand";

const pages = renderAll();

test("each page and language becomes a file, plus the 404 of each language", () => {
  const files = pages.map((p) => p.file);
  expect(new Set(files).size).toBe(files.length);
  expect(files).toContain("index.html");
  expect(files).toContain("en.html");
  expect(files).toContain("en/guides/ace.html");
  expect(files).toContain("404.html");
  expect(files).toContain("en/404.html");
});

test("one h1 per page, in the page's language", () => {
  for (const page of pages) {
    expect(page.app.match(/<h1[\s>]/g)?.length, page.file).toBe(1);
    expect(page.htmlLang, page.file).toBe(page.file.startsWith("en") ? "en" : "pt-BR");
  }
});

test("internal links exist and stay in the page's language; no link with #/", () => {
  for (const page of pages) {
    expect(page.app, page.file).not.toMatch(/href="#\//);
    const lang = page.file.startsWith("en") ? "en" : "pt";
    const toggle = page.app.match(/class="icon-btn lang-btn" href="([^"]+)"/)?.[1];
    for (const [, href] of page.app.matchAll(/href="(\/[^"#?]*)/g)) {
      if (href === toggle || /\.\w+$/.test(href)) continue;
      expect(splitLang(href).lang, `${page.file}: ${href}`).toBe(lang);
      expect(routeOf(href).noindex, `${page.file}: ${href}`).toBeUndefined();
    }
  }
});

test("head with title, description and route marker; 404 with noindex", () => {
  for (const page of pages) {
    expect(page.head, page.file).toMatch(/^<title>[^<]+<\/title>/);
    expect(page.head, page.file).toMatch(/<meta data-head name="description" content="[^"]{20,}">/);
    expect(page.head.includes('name="robots" content="noindex"'), page.file).toBe(page.file.endsWith("404.html"));
    for (const [, json] of page.head.matchAll(/<script data-head type="application\/ld\+json">([^<]*)<\/script>/g)) expect(() => JSON.parse(json)).not.toThrow();
  }
  expect(pages.find((p) => p.file === "404.html")!.route).toBe("404:pt");
  expect(pages.find((p) => p.file === "en/guides/ace.html")!.route).toBe("/en/guides/ace");
});

test("guides and text pages come out with their content; tools, with the shell", () => {
  const ace = pages.find((p) => p.file === "guides/ace.html")!;
  expect(ace.app).toContain("Mail");
  expect(ace.head).toContain('"@type":"TechArticle"');
  const rng = pages.find((p) => p.file === "rng.html")!;
  expect(rng.app).toContain("data-client-pending");
});

test.runIf(!SITE_URL)("no URL in brand.json: no canonical, hreflang, og:url, og:image or sitemap", () => {
  for (const page of pages) expect(page.head, page.file).not.toMatch(/canonical|hreflang|og:url|og:image/);
  expect(sitemapXml()).toBe("");
  expect(robotsTxt()).not.toContain("Sitemap:");
});

test.runIf(REPO_URL)("About and Terms link to the source code in both languages", () => {
  for (const file of ["about.html", "terms.html", "en/about.html", "en/terms.html"]) {
    expect(pages.find((p) => p.file === file)?.app, file).toContain(`href="${REPO_URL}"`);
  }
});
