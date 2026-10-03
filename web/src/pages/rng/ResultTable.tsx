// Search result tables per kind, with CSV export.

import { Fragment, type ReactNode } from "react";
import { locale, t } from "../../i18n";
import { Gender, Tag, Term, TypeBadge } from "../../ui";
import * as speciesData from "../../lib/gen3/species";
import { NATURES, STATS, type StatValues } from "../../lib/gen3/pk3";
import { GBA_FPS, MIN_CONTINUE_FRAMES, continueFramesFor } from "../../lib/rngflow";
import { DISPLAY, GAME_STATS, STAT_LABELS, num, pretty, toDisplay } from "../../components/format";

export type SearchKind = "static" | "wild" | "held" | "pickup";

export interface ResultRow {
  advance: number;
  state?: string;
  pid?: string;
  nature?: string;
  ability?: number;
  ability_name?: string;
  gender?: string;
  ivs?: number[];
  hidden_power?: { type: string; power: number };
  shiny?: boolean | null;
  slot?: number;
  species?: string;
  species_id?: number;
  level?: number;
  letter?: string;
  low?: string;
  inherited?: Array<{ stat: string; parent: number }>;
  method?: string;
  /** In how many of the likely seeds the same advance passes the filters. */
  tolerance?: number;
  tolerance_of?: number;
}

const EGG_METHOD_NAMES: Record<string, string> = { bred: "Bred", split: "Split", alternate: "Alternate", mixed: "Mixed" };

interface Column {
  head: () => string | string[];
  /** Glossary term for the header tooltip. */
  tip?: string;
  csvOnly?: boolean;
  cls?: string;
  cell: (r: ResultRow) => ReactNode | ReactNode[];
  csv: (r: ResultRow) => string | number | Array<string | number>;
  ivs?: boolean;
}

const COL: Record<string, Column> = {
  advance: { head: () => t("Avanço de frame"), cell: (r) => num(r.advance), csv: (r) => r.advance },
  state: { head: () => t("Estado"), cls: "mono muted", cell: (r) => r.state, csv: (r) => r.state ?? "" },
  pid: { head: () => "PID", cls: "mono", cell: (r) => r.pid, csv: (r) => r.pid ?? "" },
  shiny: { head: () => "Shiny", cls: "l", cell: (r) => (r.shiny ? <Tag tone="shiny">shiny</Tag> : ""), csv: (r) => (r.shiny ? t("sim") : "") },
  nature: { head: () => "Nature", cls: "l", cell: (r) => r.nature, csv: (r) => r.nature ?? "" },
  gender: { head: () => t("Gênero"), cls: "c", cell: (r) => <Gender value={r.gender} />, csv: (r) => r.gender ?? "" },
  ivs: {
    head: () => STAT_LABELS, ivs: true,
    cell: (r) => toDisplay(r.ivs ?? []).map((v, i) => <td key={i} className={v === 31 ? "iv31" : v === 0 ? "iv0" : undefined}>{v}</td>),
    csv: (r) => toDisplay(r.ivs ?? []),
  },
  hp: {
    head: () => "Hidden Power", tip: "hiddenpower", cls: "l",
    cell: (r) => (r.hidden_power ? <><TypeBadge type={r.hidden_power.type} /> {t("poder {n}", { n: r.hidden_power.power })}</> : ""),
    csv: (r) => (r.hidden_power ? `${r.hidden_power.type} ${r.hidden_power.power}` : ""),
  },
  slot: { head: () => "Slot", tip: "slot", cell: (r) => r.slot, csv: (r) => r.slot ?? "", csvOnly: true },
  // Without EVs (as caught).
  stats: {
    head: () => t("Stats no nível"), tip: "stats", cls: "mono",
    cell: (r) => statsText(r), csv: (r) => statsText(r),
  },
  species: {
    head: () => t("Espécie"), cls: "l",
    cell: (r) => (r.species ? pretty(r.species) : "") + (r.letter ? ` ${r.letter}` : ""),
    csv: (r) => (r.species ?? "") + (r.letter ? ` ${r.letter}` : ""),
  },
  level: { head: () => t("Nível"), cell: (r) => r.level, csv: (r) => r.level ?? "" },
  low: { head: () => t("1ª parte do PID"), cls: "mono", cell: (r) => r.low, csv: (r) => r.low ?? "" },
  chance: {
    head: () => t("Chance"), tip: "chance", cls: "l",
    cell: (r) => t("{n} de {total}", { n: r.tolerance ?? 1, total: r.tolerance_of ?? 1 }),
    csv: (r) => `${r.tolerance ?? 1}/${r.tolerance_of ?? 1}`,
  },
  method: {
    head: () => t("Método"), cls: "l",
    cell: (r) => EGG_METHOD_NAMES[r.method ?? ""] ?? r.method ?? "", csv: (r) => EGG_METHOD_NAMES[r.method ?? ""] ?? r.method ?? "",
  },
  inherited: {
    head: () => t("Herança"), cls: "l",
    cell: (r) => inherited(r), csv: (r) => inherited(r),
  },
};

function abilityText(r: ResultRow, speciesId: number | null, pretty_: boolean): string {
  const id = r.species_id ?? speciesId;
  const nth = r.ability === 1 ? t("2ª") : t("1ª");
  if (!r.ability_name || id === null) return nth;
  const name = pretty_ ? pretty(r.ability_name) : r.ability_name;
  const [, second] = speciesData.info(id).abilities;
  return second ? `${name} (${nth})` : name;
}

function statsText(r: ResultRow): string {
  if (r.species_id === undefined || r.level === undefined || !r.ivs || !r.nature) return "";
  const nature = NATURES.indexOf(r.nature as (typeof NATURES)[number]);
  const ivs = Object.fromEntries(STATS.map((k, i) => [k, r.ivs![i]])) as StatValues;
  const zero = Object.fromEntries(STATS.map((k) => [k, 0])) as StatValues;
  const stats = speciesData.calcStats(r.species_id, r.level, ivs, zero, nature);
  return toDisplay(STATS.map((k) => stats[k])).join("/");
}

function inherited(r: ResultRow): string {
  return (r.inherited ?? []).map((i) => t("{stat} do {parent}", {
    stat: STAT_LABELS[DISPLAY.indexOf(GAME_STATS.indexOf(i.stat as (typeof GAME_STATS)[number]))], parent: i.parent + 1,
  })).join(", ");
}

function waitColumn(overworld: number): Column {
  const format = (seconds: number) => {
    const n = (value: number, digits: number) => value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return seconds < 60 ? t("{s} s", { s: n(seconds, 1) }) : t("{m} min {s} s", { m: Math.floor(seconds / 60), s: n(Math.floor(seconds % 60), 0) });
  };
  return {
    head: () => t("Espera no CONTINUE"), cls: "l",
    cell: (r) => {
      const frames = continueFramesFor(r.advance, overworld);
      return frames < MIN_CONTINUE_FRAMES ? <Tag tone="warn">{t("curta demais")}</Tag> : format(frames / GBA_FPS);
    },
    csv: (r) => { const frames = continueFramesFor(r.advance, overworld); return frames < MIN_CONTINUE_FRAMES ? t("curta demais") : format(frames / GBA_FPS); },
  };
}

function columns(kind: SearchKind, rows: ResultRow[], overworld: number, speciesId: number | null): Column[] {
  const gender = rows.some((r) => r.gender) ? [COL.gender] : [];
  const chance = rows.some((r) => r.tolerance_of) ? [COL.chance] : [];
  const wait = waitColumn(overworld);
  const ability: Column = {
    head: () => "Ability", tip: "ability", cls: "l",
    cell: (r) => abilityText(r, speciesId, true), csv: (r) => abilityText(r, speciesId, false),
  };
  switch (kind) {
    case "static": return [COL.advance, wait, ...chance, COL.pid, COL.shiny, COL.nature, ability, ...gender, COL.ivs, COL.hp, COL.state];
    case "wild": return [COL.advance, wait, ...chance, COL.slot, COL.species, COL.level, COL.stats, COL.pid, COL.shiny, COL.nature, ability, ...gender, COL.ivs, COL.hp, COL.state];
    case "held": return [COL.advance, COL.low, ...gender, ability, COL.state];
    case "pickup": return [COL.advance, wait, ...chance, ...(rows.some((r) => r.method) ? [COL.method] : []), COL.pid, COL.shiny, COL.nature, ability, COL.ivs, COL.hp, COL.inherited, COL.state];
  }
}

export function ResultTable({ kind, rows, action, overworld, speciesId = null }: {
  kind: SearchKind; rows: ResultRow[]; action?: (row: ResultRow) => ReactNode; overworld: number; speciesId?: number | null;
}) {
  const cols = columns(kind, rows, overworld, speciesId).filter((col) => !col.csvOnly);
  return (
    <table className="res-table">
      <thead>
        <tr>
          {action && <th scope="col" className="act" />}
          {cols.flatMap((col, c) => {
            const head = col.head();
            return Array.isArray(head)
              ? head.map((label) => <th key={`${c}${label}`} scope="col">{label}</th>)
              : [<th key={c} scope="col" className={col.cls?.split(" ").find((k) => k === "l" || k === "c")}>{col.tip ? <Term k={col.tip}>{head}</Term> : head}</th>];
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.advance}-${row.method ?? ""}`}>
            {action && <td className="act">{action(row)}</td>}
            {cols.map((col, c) => (col.ivs ? <Fragment key={c}>{col.cell(row)}</Fragment> : <td key={c} className={col.cls}>{col.cell(row)}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function toCsv(kind: SearchKind, rows: ResultRow[], overworld: number, speciesId: number | null = null): string {
  const cols = columns(kind, rows, overworld, speciesId);
  const quote = (v: unknown) => (/[",\n;]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  const head = cols.flatMap((c) => { const h = c.head(); return Array.isArray(h) ? h : [h]; });
  const lines = [head.map(quote).join(",")];
  for (const row of rows) {
    lines.push(cols.flatMap((c) => { const v = c.csv(row); return Array.isArray(v) ? v : [v]; }).map(quote).join(","));
  }
  return lines.join("\n") + "\n";
}
