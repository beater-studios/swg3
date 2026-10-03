// Markdown sections that depend on Google Analytics being configured.
import { expect, test } from "vitest";
import { withAnalytics } from "../src/content";

const text = "a\n{{#analytics}}\ncom GA\n{{/analytics}}\n{{^analytics}}\nsem GA\n{{/analytics}}\nb\n";

test("with and without Analytics, only the right section remains", () => {
  expect(withAnalytics(text, true)).toBe("a\ncom GA\nb\n");
  expect(withAnalytics(text, false)).toBe("a\nsem GA\nb\n");
});

test("guides highlight game texts, outside links and code", async () => {
  const { markGameWords } = await import("../src/content/glossary");
  expect(markGameWords("<p>Aperte A no PRESS START e depois em CONTINUE.</p>"))
    .toBe('<p>Aperte A no <span class="game-text">PRESS START</span> e depois em <span class="game-text">CONTINUE</span>.</p>');
  expect(markGameWords('<p><code>CONTINUE</code> e <a href="#">OPTION</a></p>')).toBe('<p><code>CONTINUE</code> e <a href="#">OPTION</a></p>');
  const { guides } = await import("../src/content");
  const manual = guides("pt").find((g) => g.html.includes("PRESS START"))!;
  expect(manual.html).toContain('<span class="game-text">PRESS START</span>');
});

test("every :::screen in the guides exists, in both languages", async () => {
  const { guides, SCREEN_MARK } = await import("../src/content");
  const { SCREENS } = await import("../src/components/GuideBody");
  for (const lang of ["pt", "en"] as const) {
    const used = guides(lang).flatMap((g) => [...g.html.matchAll(new RegExp(SCREEN_MARK.source, "g"))].map((m) => m[1]));
    expect(used.length, lang).toBeGreaterThan(0);
    for (const name of used) expect(Object.keys(SCREENS), `${lang}: ${name}`).toContain(name);
  }
  // The marker leaves the Markdown as a single block, outside any paragraph.
  const ace = guides("pt").find((g) => g.slug === "ace")!;
  expect(ace.html).toContain('<div data-screen="mail-glitch"></div>');
  expect(ace.html).not.toContain("<p><div data-screen");
});

test("a list that continues after a screen keeps its numbering", async () => {
  const { guides } = await import("../src/content");
  const ace = guides("pt").find((g) => g.slug === "ace")!;
  expect(ace.html).toContain('<ol start="4" style="counter-reset: step 3">');
});

test("no link with #/ (routes are real URLs) and internal guide links in the right language", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|md|json)$/.test(n) ? [p] : [];
  });
  const found = walk(join(__dirname, "..", "src")).filter((p) => /(?:\]\(|href=["{`]+)#\//.test(readFileSync(p, "utf8")));
  expect(found).toEqual([]);
  const { guides } = await import("../src/content");
  const internal = (lang: "pt" | "en") => guides(lang).flatMap((g) => [...g.html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]));
  expect(internal("en").length).toBeGreaterThan(0);
  for (const href of internal("en")) expect(href).toMatch(/^\/en(\/|$)/);
  for (const href of internal("pt")) expect(href).not.toMatch(/^\/en(\/|$)/);
});
