// List UI strings still missing from src/i18n/en/*.json (to translate by hand in ui.json).
// Usage: node scripts/fill-ui-i18n.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const UI_DIRS = ["src/app", "src/components", "src/pages", "src/lib/rngflow.ts", "src/lib/timer.ts", "src/lib/worker.ts"];
const CALL = /\b(?:t|N_)\(\s*"((?:\\.|[^"\\])*)"/g;

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name))).filter((p) => /\.(ts|tsx)$/.test(p));
}

const other = Object.assign({}, ...readdirSync("src/i18n/en").filter((n) => n !== "ui.json" && n.endsWith(".json"))
  .map((n) => JSON.parse(readFileSync(join("src/i18n/en", n), "utf8"))));
const ui = JSON.parse(readFileSync("src/i18n/en/ui.json", "utf8"));
const missing = [];
for (const path of UI_DIRS.flatMap(files)) {
  for (const match of readFileSync(path, "utf8").matchAll(CALL)) {
    const text = JSON.parse(`"${match[1]}"`);
    if (text in ui || text in other) continue;
    missing.push(text);
  }
}
console.log(missing.length ? `missing:\n${[...new Set(missing)].join("\n")}` : "ui.json complete");
