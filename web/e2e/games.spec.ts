// Themes with every game enabled (build with VITE_GAMES, "games" project in playwright.config.ts).
import { expect, test } from "./fixtures";

test("with more than two games, the theme becomes a menu; the choice persists", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  await page.locator(".accent-btn").click();
  const items = page.getByRole("menuitemradio");
  await expect(items).toHaveText(["FireRed", "LeafGreen", "Ruby", "Sapphire", "Emerald"]);
  await expect(page.getByRole("menuitemradio", { name: "FireRed" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Emerald" }).click();
  await expect(root).toHaveAttribute("data-accent", "emerald");
  await expect(page.getByRole("menu")).toHaveCount(0);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  const emerald = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--emerald").trim());
  expect(accent).toBe(emerald);
  await page.reload();
  await expect(root).toHaveAttribute("data-accent", "emerald");

  await page.locator(".accent-btn").click();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "FireRed" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-accent", "emerald");
  await expect(page.locator(".accent-btn")).toBeFocused();
});

test("empty state: each theme with its own walking character", async ({ page }) => {
  await page.goto("/nao-existe");
  const sprite = page.locator(".empty-state .walker-sprite");
  const seen = new Set<string>();
  for (const game of ["FireRed", "LeafGreen", "Ruby", "Sapphire", "Emerald"]) {
    await page.locator(".accent-btn").click();
    await page.getByRole("menuitemradio", { name: game }).click();
    seen.add(await sprite.evaluate((el) => getComputedStyle(el).backgroundImage));
  }
  expect(seen.size).toBe(5);
});
