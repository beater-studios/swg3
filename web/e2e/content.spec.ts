import { expect, noHorizontalScroll, test } from "./fixtures";

test("guides: index, guide with steps and warnings, navigation", async ({ page }) => {
  await page.goto("/guides");
  await expect(page.locator(".guide-card")).toHaveCount(10);
  await expect(page.locator(".path-steps li")).toHaveCount(4);
  await page.locator(".guide-card", { hasText: "Instale o Base64 writer" }).click();
  await expect(page).toHaveURL(/\/guides\/base64$/);
  await expect(page.locator(".guide .md ol > li").first()).toBeVisible();
  await expect(page.locator(".guide .notice-tip")).toHaveCount(1);
  await expect(page.locator(".guide-side a.active")).toHaveText("Instale o Base64 writer");
  await expect(page.locator(".guide a[href^='https://']").first()).toHaveAttribute("target", "_blank");
  await noHorizontalScroll(page);
  await page.locator(".pager.next").click();
  await expect(page).toHaveURL(/\/guides\/codes$/);
  await expect(page.locator(".guide .grid-table")).toBeVisible();
});

test("text pages in both languages", async ({ page }) => {
  for (const [route, title] of [["about", "Sobre"], ["credits", "Créditos"], ["privacy", "Privacidade"], ["terms", "Termos de uso"]]) {
    await page.goto(`/${route}`);
    await expect(page.locator(".page-head h1")).toHaveText(title);
    await expect(page.locator(".doc-panel")).not.toBeEmpty();
  }
  await page.locator(".lang-btn").click();
  await expect(page).toHaveURL(/\/en\/terms$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".page-head h1")).toHaveText("Terms of use");
  await page.goto("/en/guides/ace");
  await expect(page.locator(".guide h1")).toHaveText("Unlock ACE");
});

test("guide terms explain what they mean", async ({ page }, info) => {
  await page.goto("/guides/safety");
  const term = page.locator(".guide .term", { hasText: "ACE" }).first();
  if (info.project.name === "mobile") await term.tap();
  else await term.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Execução de código arbitrário");
  await expect(tip.getByRole("link", { name: "Ver o guia" })).toHaveAttribute("href", "/guides/ace");
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
});

