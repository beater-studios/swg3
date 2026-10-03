import { expect, test } from "./fixtures";

test.use({ presetConsent: false });

test("cookies: nothing from Google before accepting, and the choice can be changed", async ({ page, gaRequests }) => {
  await page.goto("./");
  const banner = page.getByRole("region", { name: "Cookies" });
  await expect(banner).toBeVisible();
  expect(gaRequests).toEqual([]);

  await banner.getByRole("link", { name: "Saiba mais" }).click();
  await expect(page.locator(".doc-panel")).toContainText("Google Analytics");
  await expect(page.locator(".doc-panel")).not.toContainText("{{");

  await banner.getByRole("button", { name: "Recusar" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  expect(gaRequests).toEqual([]);

  await page.locator(".footer").getByRole("button", { name: "Cookies" }).click();
  await banner.getByRole("button", { name: "Aceitar" }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => gaRequests.some((url) => url.includes("gtag/js?id=G-TEST0000"))).toBe(true);
});
