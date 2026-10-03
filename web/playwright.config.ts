import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the production build (vite preview).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  // On CI: no test.only left behind, and one retry so a flaky test shows up as "flaky" instead of failing the PR.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  // The service worker only runs in e2e/offline.spec.ts, so the other tests always see the network.
  use: { baseURL: "http://127.0.0.1:4173/", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", testIgnore: /games\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", testIgnore: /games\.spec\.ts/, use: { ...devices["Pixel 7"], viewport: { width: 375, height: 800 } } },
    { name: "safari", testIgnore: /games\.spec\.ts/, use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
    { name: "iphone", testIgnore: /games\.spec\.ts/, use: { ...devices["iPhone 13"] } },
    { name: "firefox", testIgnore: /games\.spec\.ts/, use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } } },
    // Build with every game enabled (VITE_GAMES), only for games.spec.ts.
    { name: "games", testMatch: /games\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4174/" } },
  ],
  webServer: [
    {
      // Fake GA ID to exercise the cookie banner (fixtures block Google). --host 127.0.0.1 avoids an IPv6-only
      // localhost that never answers the url wait. VITE_GAMES is explicit so a local web/.env cannot change the build.
      command: "VITE_GA_ID=G-TEST0000 VITE_GAMES=firered,leafgreen node scripts/build.mjs && npx vite preview --port 4173 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "VITE_GA_ID=G-TEST0000 VITE_GAMES=firered,leafgreen,ruby,sapphire,emerald node scripts/build.mjs --outDir dist-games && npx vite preview --outDir dist-games --port 4174 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
