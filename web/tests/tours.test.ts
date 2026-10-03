// Interactive tours (content/tours): markers, actions and conditions exist in the code and registry, and both languages
// have the same steps, so a tour does not break silently when the UI changes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guides, tours } from "../src/content";
import { ACTIONS, CONDITIONS, TOUR_PAGES } from "../src/tours/registry";

const SRC = new URL("../src", import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === "design" ? [] : files(path)) : path.endsWith(".tsx") ? [path] : [];
  });
}
const marks = new Set(files(SRC).flatMap((path) => [...readFileSync(path, "utf8").matchAll(/\btour(?:=|: )"([\w-]+)"|data-tour="([\w-]+)"/g)].map((m) => m[1] ?? m[2])));

describe("interactive tours", () => {
  const pt = tours("pt"), en = tours("en");

  it("there are tours, each with its page", () => {
    expect(pt.length).toBeGreaterThan(0);
    for (const tour of pt) expect(TOUR_PAGES[tour.id], tour.id).toBeTruthy();
  });

  it("every marker, action and condition exists", () => {
    for (const tour of [...pt, ...en]) {
      for (const step of tour.steps) {
        if (step.target) expect(marks.has(step.target), `${tour.id}: marca ${step.target}`).toBe(true);
        if (step.go) expect(ACTIONS[step.go], `${tour.id}: ação ${step.go}`).toBeTypeOf("function");
        if (step.wait) expect(CONDITIONS[step.wait], `${tour.id}: condição ${step.wait}`).toBeTypeOf("function");
        expect(step.html.trim(), `${tour.id}: texto`).not.toBe("");
      }
    }
  });

  it("Portuguese and English have the same steps", () => {
    expect(en.map((t) => t.id).sort()).toEqual(pt.map((t) => t.id).sort());
    for (const tour of pt) {
      const other = en.find((t) => t.id === tour.id)!;
      expect(other.steps.map(({ target, go, wait }) => [target, go, wait])).toEqual(tour.steps.map(({ target, go, wait }) => [target, go, wait]));
    }
  });

  it("?tour= links in written guides open an existing tour, on its page", () => {
    for (const lang of ["pt", "en"] as const) {
      for (const guide of guides(lang)) {
        for (const [, page, id] of guide.html.matchAll(/href="#(\/[\w-]*)\?tour=([\w-]+)"/g)) {
          expect(TOUR_PAGES[id], `${guide.slug}: ${id}`).toBe(page);
        }
      }
    }
  });

  it("no dashes in the texts", () => {
    for (const tour of [...pt, ...en]) for (const step of tour.steps) expect(step.html).not.toMatch(/[–—]/);
  });
});
