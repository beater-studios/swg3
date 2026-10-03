// Real URLs and prerendered pages (scripts/build.mjs): raw HTML, the real 404, hydration and language by URL.
import { expect, test } from "./fixtures";

const ROUTES = ["/", "/rng", "/editor", "/codes", "/guides", "/guides/ace", "/guides/safety", "/about", "/credits", "/privacy", "/terms", "/changelog"];
const EN = ROUTES.map((r) => (r === "/" ? "/en" : `/en${r}`));

test("raw HTML of each page: 200, unique title and description, language, one h1 and route marker", async ({ request }) => {
  const titles = { pt: new Set<string>(), en: new Set<string>() };
  const descriptions = { pt: new Set<string>(), en: new Set<string>() };
  for (const path of [...ROUTES, ...EN]) {
    const lang = path.startsWith("/en") ? "en" : "pt";
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const html = await res.text();
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta data-head name="description" content="([^"]+)">/)?.[1];
    expect(title, path).toBeTruthy();
    expect(description, path).toBeTruthy();
    titles[lang].add(title!);
    descriptions[lang].add(description!);
    expect(html, path).toContain(`<html lang="${path.startsWith("/en") ? "en" : "pt-BR"}">`);
    expect(html.match(/<h1[\s>]/g)?.length, path).toBe(1);
    expect(html, path).toContain(`data-route="${path}"`);
  }
  for (const lang of ["pt", "en"] as const) {
    expect(titles[lang].size, lang).toBe(ROUTES.length);
    expect(descriptions[lang].size, lang).toBe(ROUTES.length);
  }
});

test("unknown URL: 404 with the page in its language and noindex", async ({ request }) => {
  for (const [path, title] of [["/nao-existe", "Página não encontrada"], ["/guides/xyz", "Página não encontrada"], ["/en/missing", "Page not found"]]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    const html = await res.text();
    expect(html, path).toContain(title);
    expect(html, path).toContain('<meta data-head name="robots" content="noindex">');
  }
});

test("guide readable without JavaScript, with links in its language", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/guides/ace");
  await expect(page.locator(".guide h1")).toHaveText("Unlock ACE");
  await expect(page.locator(".guide .md")).toContainText("Mail");
  await expect(page.locator(".nav a", { hasText: "Guides" })).toHaveAttribute("href", "/en/guides");
  await expect(page.locator(".lang-btn")).toHaveAttribute("href", "/guides/ace");
  await context.close();
});


test("navigating changes title and description without reloading", async ({ page }) => {
  await page.goto("/guides");
  await page.locator(".guide-card", { hasText: "Como descobrir o SID" }).click();
  await expect(page).toHaveURL(/\/guides\/sid$/);
  await expect(page).toHaveTitle(/^Como descobrir o SID · /);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Secret ID/);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });
  await page.locator(".guide .md a[href='/guides/safety']").first().click();
  await expect(page).toHaveURL(/\/guides\/safety$/);
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
});

test("switching language in a tool keeps what is open", async ({ page }) => {
  await page.goto("/rng");
  const tid = page.locator(".game-params label", { hasText: "TID" }).locator("input");
  await tid.fill("12345");
  await page.locator(".lang-btn").click();
  await expect(page).toHaveURL(/\/en\/rng$/);
  await expect(page.locator(".page-head h1")).toHaveText("RNG");
  await expect(page.locator(".game-params label", { hasText: "TID" }).locator("input")).toHaveValue("12345");
});

test("each page hydrates without errors in both languages", async ({ page }) => {
  // The fixture fails the test on any console error (hydration included).
  for (const path of [...ROUTES, ...EN]) {
    await page.goto(path);
    await expect(page.locator(".page-head h1, .guide h1").first()).toBeVisible();
  }
  await page.goto("/rng");
  await expect(page.locator(".game-params")).toBeVisible();
});

test.describe("language suggestion", () => {
  test.use({ locale: "en-US" });

  test("English browser on a Portuguese page: offers the English version without redirecting", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/guides/ace");
    await expect(page).toHaveURL(/\/guides\/ace$/);
    const offer = page.locator(".lang-suggest");
    await expect(offer).toContainText("This page is also available in English.");
    await offer.getByRole("link", { name: "View in English" }).click();
    await expect(page).toHaveURL(/\/en\/guides\/ace$/);
    await expect(page.locator(".lang-suggest")).toHaveCount(0);
  });
});
