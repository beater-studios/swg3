import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, expect, test } from "./fixtures";

test.use({ serviceWorkers: "allow" });

const flow = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "files", "flow.json"), "utf8"));

test("offline: after one visit, every page, the tools and the sprites work without network", async ({ page, context, browserName }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cached = await page.evaluate(async (slug) => {
    const key = (await caches.keys()).find((k) => k.startsWith(`${slug}-`));
    return key ? (await (await caches.open(key)).keys()).length : 0;
  }, BRAND.slug);
  expect(cached).toBeGreaterThan(400);
  // WebKit registers and fills the cache, but Playwright's offline mode there fails navigations before the worker answers.
  test.skip(browserName === "webkit", "offline emulation in Playwright WebKit bypasses the service worker");
  await context.setOffline(true);

  // RNG: lazy tool chunk and the search worker.
  await page.goto("/rng");
  await page.locator(".seed-list tr", { hasText: flow.target_seed }).getByRole("button", { name: "Usar" }).click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const form = page.locator(".search-form").first();
  await form.locator("label", { hasText: "Do avanço" }).locator("input").fill("2000");
  await form.locator("label", { hasText: "Até o avanço" }).locator("input").fill("2000");
  await form.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".res-table tbody tr").first()).toBeVisible();

  // Editor in English, and the summary sprites (public/mon), which the page fetches on demand.
  await page.goto("/en/editor");
  await page.getByRole("tab", { name: "Create or edit" }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  expect(await page.evaluate(async () => {
    const [palettes, front] = await Promise.all([fetch("/mon/palettes.json"), fetch("/mon/front/25.png")]);
    return palettes.ok && front.ok && (await front.blob()).size > 0;
  })).toBe(true);

  // A guide with a query string and an unknown URL.
  await page.goto("/guides/ace?x=1");
  await expect(page.locator("h1")).toBeVisible();
  await page.goto("/en/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("one manifest per language, with its start URL", async ({ page }) => {
  for (const [path, start, lang] of [["/rng", "/", "pt-BR"], ["/en/rng", "/en", "en"]] as const) {
    await page.goto(path);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await page.request.get(href!)).json();
    expect(manifest).toMatchObject({ id: start, start_url: start, scope: "/", lang, name: BRAND.name, display: "standalone" });
  }
});
