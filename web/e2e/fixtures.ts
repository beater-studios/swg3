import { readFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";

export const BRAND = JSON.parse(readFileSync(new URL("../../src/swg3/brand.json", import.meta.url), "utf8")) as { name: string; slug: string; repo: string };
export const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

// Fails the test if the page logs a console error or throws.
export const test = base.extend<{ page: Page; presetConsent: boolean; presetChangelog: boolean; gaRequests: string[] }>({
  // By default the cookie choice is already made (declined), so the banner does not cover the screen.
  presetConsent: [true, { option: true }],
  presetChangelog: [true, { option: true }],
  // Nothing really reaches Google: requests are recorded and answered with an empty script.
  gaRequests: async ({ page }, use) => {
    const requests: string[] = [];
    await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => {
      requests.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
    });
    await use(requests);
  },
  page: async ({ page, presetConsent, presetChangelog }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // The not-found page returns status 404 on purpose and the browser warns in the console (WebKit before
    // page.url() changes): the warning only counts as an error if the open document is not a 404.
    let notFoundDocument = "";
    page.on("response", (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) notFoundDocument = response.status() === 404 ? response.url() : "";
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const url = message.location().url;
      if (notFoundDocument && /status of 404/.test(message.text()) && (!url || url === notFoundDocument)) return;
      errors.push(message.text());
    });
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify("pt"));
    }, `${BRAND.slug}.lang`);
    if (presetConsent) {
      await page.addInitScript((key) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify("denied"));
      }, `${BRAND.slug}.consent`);
    }
    if (presetChangelog) {
      await page.addInitScript(([key, version]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(version));
      }, [`${BRAND.slug}.changelog-seen`, VERSION]);
    }
    await use(page);
    expect(errors, "console errors").toEqual([]);
  },
});

export { expect };

export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
