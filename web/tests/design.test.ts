// Design system: the catalog renders every component, and screens use src/ui components instead of their classes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";
import DesignPage, { sampleMon } from "../src/design/DesignPage";
import * as ui from "../src/ui";

const SRC = join(__dirname, "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
  });
}

test("the catalog shows every exported component", () => {
  const html = renderToString(createElement(MemoryRouter, null, createElement(DesignPage)));
  const shown = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]).join(", ");
  const exported = Object.keys(ui).filter((name) => /^[A-Z]/.test(name) && !["ICON_NAMES", "Icon", "Mark", "TYPE_COLORS"].includes(name));
  const missing = exported.filter((name) => !new RegExp(`\\b${name}\\b`).test(shown));
  expect(missing).toEqual([]);
  expect(sampleMon()).not.toBeNull();
});

// Classes that belong to design system components. A screen that needs one uses the component.
const OWNED = ["btn", "btn-primary", "btn-small", "btn-big", "panel", "panel-plain", "panel-prose", "notice", "hint", "note", "fields", "field",
  "check", "radios", "group", "group-body", "details", "tabs", "subtabs", "tab-panel", "tag", "chip", "chips", "progress", "issues", "kv",
  "table-wrap", "grid-table", "stat-table", "steps", "cards", "card", "actions", "stack", "view", "page-head", "lead", "eyebrow", "dropzone", "pad-key", "game-text"];

test("screens do not repeat component classes", () => {
  const found: string[] = [];
  for (const dir of ["pages", "components", "app"]) {
    for (const path of files(join(SRC, dir))) {
      for (const match of readFileSync(path, "utf8").matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const classes = (match[1] ?? match[2]).split(/\s+/);
        for (const cls of classes) if (OWNED.includes(cls)) found.push(`${cls} (${path.slice(SRC.length + 1)})`);
      }
    }
  }
  expect(found).toEqual([]);
});

test("Combobox filters by name without accents and by the hint number", async () => {
  const { filterOptions } = await import("../src/ui");
  const options = [
    { value: "29", label: "Nidoran♀", hint: "#029" }, { value: "122", label: "Mr. Mime", hint: "#122" },
    { value: "25", label: "Pikachu", hint: "#025" }, { value: "277", label: "Treecko", hint: "#252" },
  ];
  expect(filterOptions(options, "mime").map((o) => o.value)).toEqual(["122"]);
  expect(filterOptions(options, "PIKA").map((o) => o.value)).toEqual(["25"]);
  expect(filterOptions(options, "25").map((o) => o.value)).toEqual(["25", "277"]);
  expect(filterOptions(options, "#252").map((o) => o.value)).toEqual(["277"]);
  expect(filterOptions(options, "  ")).toHaveLength(4);
});

test("NumberInput drops anything that is not a number", async () => {
  const { cleanNumber } = await import("../src/ui");
  expect(cleanNumber("12a3", false, false)).toBe("123");
  expect(cleanNumber("-1680", true, false)).toBe("-1680");
  expect(cleanNumber("-1680", false, false)).toBe("1680");
  expect(cleanNumber("1-2", true, false)).toBe("12");
  expect(cleanNumber("35,5.2", false, true)).toBe("35,52");
  expect(cleanNumber("abc", true, true)).toBe("");
  expect(cleanNumber("007", false, false)).toBe("7");
  expect(cleanNumber("0", false, false)).toBe("0");
  expect(cleanNumber("00", false, false)).toBe("0");
  expect(cleanNumber("-0042", true, false)).toBe("-42");
  expect(cleanNumber("0,5", false, true)).toBe("0,5");
});

test("SearchProgress: the ball shakes only while the search runs", async () => {
  const { SearchProgress } = await import("../src/ui");
  expect(renderToString(createElement(SearchProgress, { value: 0.3, running: true }))).toMatch(/search-ball shaking/);
  expect(renderToString(createElement(SearchProgress, { value: 1, running: false }))).not.toMatch(/shaking/);
});

test("summary screen: names as the game writes them (uppercase, POKé, _ becomes a space)", async () => {
  const { gameText } = await import("../src/components/SummaryScreen");
  expect(gameText("PALLET_TOWN")).toBe("PALLET TOWN");
  expect(gameText("Poké Ball")).toBe("POKé BALL");
  expect(gameText("Leech Seed")).toBe("LEECH SEED");
});
