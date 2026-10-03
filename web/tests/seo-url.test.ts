// With the production URL set (brand.json "url"): canonical, hreflang, Open Graph and breadcrumb with absolute
// URLs, and a sitemap with both versions of each page. The URL here is fake.
import { beforeAll, expect, test, vi } from "vitest";

const URL_ = "https://exemplo.test";
let server: typeof import("../src/entry-server");

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../src/brand", async (original) => ({ ...(await original<typeof import("../src/brand")>()), SITE_URL: URL_ }));
  server = await import("../src/entry-server");
});

test("canonical, hreflang and og with absolute URLs", () => {
  const pages = server.renderAll();
  const ace = pages.find((p) => p.file === "en/guides/ace.html")!;
  expect(ace.head).toContain(`<link data-head rel="canonical" href="${URL_}/en/guides/ace">`);
  expect(ace.head).toContain(`<link data-head rel="alternate" hreflang="pt" href="${URL_}/guides/ace">`);
  expect(ace.head).toContain(`<link data-head rel="alternate" hreflang="en" href="${URL_}/en/guides/ace">`);
  expect(ace.head).toContain(`<link data-head rel="alternate" hreflang="x-default" href="${URL_}/guides/ace">`);
  expect(ace.head).toContain(`<meta data-head property="og:url" content="${URL_}/en/guides/ace">`);
  expect(ace.head).toContain(`<meta data-head property="og:image" content="${URL_}/og-en.png">`);
  expect(ace.head).toContain('"@type":"BreadcrumbList"');
  const home = pages.find((p) => p.file === "index.html")!;
  expect(home.head).toContain(`<link data-head rel="canonical" href="${URL_}/">`);
  expect(home.head).toContain('"@type":"WebSite"');
  expect(home.head).toContain('"@type":"Organization"');
  const missing = pages.find((p) => p.file === "404.html")!;
  expect(missing.head).not.toMatch(/canonical|hreflang|og:url/);
});

test("sitemap with each page in both languages, without the 404", () => {
  const xml = server.sitemapXml();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = ["pt", "en"].flatMap((lang) => server.renderAll().filter((p) => !p.file.endsWith("404.html") && p.file.startsWith("en") === (lang === "en")));
  expect(locs.length).toBe(expected.length);
  expect(locs).toContain(`${URL_}/`);
  expect(locs).toContain(`${URL_}/en`);
  expect(locs).toContain(`${URL_}/en/guides/ace`);
  expect(locs.some((l) => l.includes("404"))).toBe(false);
  expect(server.robotsTxt()).toContain(`Sitemap: ${URL_}/sitemap.xml`);
});
