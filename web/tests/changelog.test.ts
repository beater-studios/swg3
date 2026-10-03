// Changelog: same version in package.json, pyproject.toml and the first entry; both languages in every highlight.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANGELOG, LATEST_VERSION, changelogDate, isVersionNewer } from "../src/content/changelog";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const pyproject = readFileSync(new URL("../../pyproject.toml", import.meta.url), "utf8");

describe("changelog", () => {
  it("single version: package.json, pyproject.toml and the first entry", () => {
    expect(LATEST_VERSION).toBe(pkg.version);
    expect(pyproject).toMatch(new RegExp(`^version = "${pkg.version.replaceAll(".", "\\.")}"$`, "m"));
  });

  it("newest to oldest, no repeated version, with a valid date", () => {
    for (let i = 1; i < CHANGELOG.length; i++) expect(isVersionNewer(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBe(true);
    for (const entry of CHANGELOG) expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("every highlight in Portuguese and English, without dashes", () => {
    for (const entry of CHANGELOG) {
      expect(entry.highlights.pt.length).toBeGreaterThan(0);
      expect(entry.highlights.en).toHaveLength(entry.highlights.pt.length);
      for (const text of [...entry.highlights.pt, ...entry.highlights.en]) expect(text).not.toMatch(/[–—]/);
    }
  });

  it("compares versions and formats the date in the language", () => {
    expect(isVersionNewer("0.2.0", "0.1.9")).toBe(true);
    expect(isVersionNewer("0.10.0", "0.9.0")).toBe(true);
    expect(isVersionNewer("0.1.0", "0.1.0")).toBe(false);
    expect(changelogDate("2026-10-02", "pt")).toBe("2 de outubro de 2026");
    expect(changelogDate("2026-10-02", "en")).toBe("October 2, 2026");
  });
});
