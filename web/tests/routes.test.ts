// Route registry (app/routes.ts): URLs per language, alternate language pages and unique, short search engine texts.
import { expect, test } from "vitest";
import { counterpart, LANGS, localize, matchRoute, routeKey, routeList, routeOf, splitLang } from "../src/app/routes";
import seoPt from "../src/content/seo/pt.json";
import seoEn from "../src/content/seo/en.json";

test("language in the URL: Portuguese at the root, English under /en", () => {
  expect(localize("/", "pt")).toBe("/");
  expect(localize("/", "en")).toBe("/en");
  expect(localize("/rng", "en")).toBe("/en/rng");
  expect(localize("/codes?tour=codes-typing", "en")).toBe("/en/codes?tour=codes-typing");
  expect(localize("/?x=1", "en")).toBe("/en?x=1");
  expect(splitLang("/en")).toEqual({ lang: "en", path: "/" });
  expect(splitLang("/en/guides/ace")).toEqual({ lang: "en", path: "/guides/ace" });
  expect(splitLang("/engine")).toEqual({ lang: "pt", path: "/engine" });
  for (const lang of LANGS) for (const r of routeList(lang)) expect(splitLang(localize(r.path, lang))).toEqual({ lang, path: r.path });
});

test("same pages in both languages, and the language button leads to the same page", () => {
  expect(routeList("en").map((r) => r.path)).toEqual(routeList("pt").map((r) => r.path));
  expect(routeList("pt").filter((r) => r.id.startsWith("guide:")).length).toBeGreaterThanOrEqual(10);
  expect(counterpart("/guides/ace")).toBe("/en/guides/ace");
  expect(counterpart("/en/guides/ace")).toBe("/guides/ace");
  expect(counterpart("/en")).toBe("/");
  expect(counterpart("/nao-existe")).toBe("/en");
  expect(routeOf("/en/rng/").id).toBe("rng");
  expect(matchRoute("/guides/xyz", "pt").noindex).toBe(true);
  expect(routeKey(routeOf("/en/nada"))).toBe("404:en");
  expect(routeKey(routeOf("/en/rng"))).toBe("/en/rng");
});

test("unique titles and descriptions per language, 50 to 170 characters, without dashes", () => {
  for (const lang of LANGS) {
    const list = routeList(lang);
    expect(new Set(list.map((r) => r.title)).size, lang).toBe(list.length);
    expect(new Set(list.map((r) => r.description)).size, lang).toBe(list.length);
    for (const r of list) {
      expect(r.description.length, `${lang} ${r.id}`).toBeGreaterThanOrEqual(50);
      expect(r.description.length, `${lang} ${r.id}`).toBeLessThanOrEqual(170);
      expect(/[—–]/.test(r.title + r.description), `${lang} ${r.id}`).toBe(false);
    }
  }
});

test("seo/pt.json and seo/en.json have the same keys", () => {
  const keys = (o: object, at = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${at}${k}.`) : [`${at}${k}`]));
  expect(keys(seoEn).sort()).toEqual(keys(seoPt).sort());
});
