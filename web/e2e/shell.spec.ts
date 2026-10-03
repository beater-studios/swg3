import { BRAND, VERSION, expect, noHorizontalScroll, test } from "./fixtures";

test("home, navigation and footer", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".hero h1")).toHaveText(BRAND.name);
  await expect(page).toHaveTitle(`${BRAND.name}: ferramentas de RNG e ACE para FireRed e LeafGreen`);
  await noHorizontalScroll(page);
  await page.locator(".footer-links a", { hasText: "Privacidade" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator(".nav a.active")).toHaveText("Sobre");
});

test("language: the button goes to the English version (/en) and back", async ({ page }) => {
  await page.goto("./");
  await page.locator(".lang-btn").click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator(".hero .eyebrow")).toHaveText("FireRed and LeafGreen on Nintendo Switch");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator(".nav")).toContainText("Guides");
  await page.locator(".nav a", { hasText: "Guides" }).click();
  await expect(page).toHaveURL(/\/en\/guides$/);
  await page.locator(".lang-btn").click();
  await expect(page).toHaveURL(/\/guides$/);
  await expect(page.locator(".nav")).toContainText("Guias");
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/guides$/);
  await expect(page.locator(".nav")).toContainText("Guides");
});

test("dark theme persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  await page.locator(".topbar .icon-btn").last().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Fire and Leaf theme: switches, persists, and the versions keep their game color", async ({ page }) => {
  await page.goto("/rng");
  const root = page.locator("html");
  await expect(root).not.toHaveAttribute("data-accent", "leaf");
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  const fire = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--fire").trim());
  expect(await accent()).toBe(fire);
  await page.locator(".accent-btn").click();
  await expect(root).toHaveAttribute("data-accent", "leaf");
  await page.reload();
  await expect(root).toHaveAttribute("data-accent", "leaf");
  const flame = page.locator(".game-params .segments label.on svg").first();
  const [flameColor, fireRgb] = await flame.evaluate((svg) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--fire)";
    document.body.append(probe);
    const out = [getComputedStyle(svg).color, getComputedStyle(probe).color];
    probe.remove();
    return out;
  });
  expect(flameColor).toBe(fireRgb);
  await page.locator(".accent-btn").click();
  await expect(root).not.toHaveAttribute("data-accent", "leaf");
});

test("not-found page: the walking character and the way back", async ({ page }) => {
  await page.goto("/nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  const sprite = page.locator(".empty-state .walker-sprite");
  await expect(sprite).toBeVisible();
  const red = await sprite.evaluate((el) => getComputedStyle(el).backgroundImage);
  await page.locator(".accent-btn").click();
  await expect.poll(() => sprite.evaluate((el) => getComputedStyle(el).backgroundImage)).not.toBe(red);
  await page.getByRole("link", { name: "Ir para o início" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("flying Mew: appears, changes frames, takes no clicks, adds no scrolling, and leaves", async ({ page }) => {
  await page.goto("./");
  const mew = page.locator(".mew");
  await expect(mew).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event("swg3:mew")));
  await expect(mew).toHaveClass(/\bon\b/);
  const first = await mew.evaluate((el) => el.style.backgroundPosition);
  await expect.poll(() => mew.evaluate((el) => el.style.backgroundPosition)).not.toBe(first);
  expect(await page.locator(".mew-layer").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await noHorizontalScroll(page);
  // Leaves the screen on its own (the full lap takes a few seconds).
  await expect(mew).not.toHaveClass(/\bon\b/, { timeout: 40000 });
});

test("Mew flees the mouse: chasing it never leaves the pointer on top of it", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse only");
  await page.goto("./");
  const mew = page.locator(".mew");
  await page.evaluate(() => window.dispatchEvent(new Event("swg3:mew")));
  await expect(mew).toHaveClass(/\bon\b/);
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const b = await mew.boundingBox();
    return Boolean(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height);
  }, { timeout: 15000 }).toBe(true);
  for (let i = 0; i < 6; i++) {
    const b = (await mew.boundingBox())!;
    const target = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(target.x, target.y, { steps: 4 });
    await page.waitForTimeout(250);
    const after = (await mew.boundingBox())!;
    const inside = target.x > after.x && target.x < after.x + after.width && target.y > after.y && target.y < after.y + after.height;
    expect(inside, `attempt ${i + 1}`).toBe(false);
  }
});

test.describe("version news", () => {
  test.use({ presetChangelog: false });

  test("first visit: the modal does not open (visitors from a search see the page); the footer version leads to the changelog; Ko-fi and the source code link in the footer", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("header").first()).toBeVisible();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `${BRAND.slug}.changelog-seen`)).toBe(JSON.stringify(VERSION));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator(".footer-version").click();
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(page.getByRole("heading", { name: `v${VERSION}` })).toBeVisible();
    await expect(page.locator(".changelog-entry").first()).toContainText("atual");
    const kofi = page.getByRole("link", { name: "Apoie no Ko-fi" });
    await expect(kofi).toHaveAttribute("href", "https://ko-fi.com/beaterstudios");
    await expect(kofi).toHaveAttribute("target", "_blank");
    const repo = page.getByRole("link", { name: "Código-fonte no GitHub" });
    await expect(repo).toHaveAttribute("href", BRAND.repo);
    await expect(repo).toHaveAttribute("target", "_blank");
  });

  test("older seen version: the modal opens; the all-versions button leads to the changelog", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify("0.0.1")), `${BRAND.slug}.changelog-seen`);
    await page.goto("/rng");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ver todas as versões" }).click();
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
