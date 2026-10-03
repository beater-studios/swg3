// Initial seeds of English FireRed and LeafGreen on the Switch, with the timing of each (data: tools/gen_switch_seeds.py).
// This is the project's only RNG implementation (frozen vectors in web/tests/vectors/frozen/). Timing rules ported from ten-lines
// (lincoln-lm, GPLv3): `FRLGSeedDataStore` (initial_seed.hpp), `SYSTEM_TIMING_DATA` (src/tenLines/index.ts). Not verified: from
// which moment the time counts; in practice the player calibrates (calibration.ts).

import raw from "@data/frlg_switch_seeds.json";
import { N_, t } from "../../i18n";

export const GBA_FPS = 16777216 / 280896;
export const TIME_OFFSET = 5737;
export const CONSOLES: Record<string, number> = { switch1: 0, switch2: -750 };
export const SOUND: Record<string, string> = { mono: N_("som mono"), stereo: N_("som estéreo") };
export const BUTTON_MODE: Record<string, string> = { help: N_("botões Help"), lr: N_("botões LR"), "l=a": N_("botões L=A") };
export const SEED_BUTTON: Record<string, string> = { a: N_("seed no A"), start: N_("seed no START"), l: N_("seed no L") };

export interface Entry {
  /** Position in the list (after merging repeated seeds). */
  index: number;
  row: number;
  seed: number;
  frames: number;
  ms: number;
}

export interface SeedData {
  source: string;
  fetched: string;
  time_unit: string;
  time_offset: number;
  games: Record<string, { times: number[]; seeds: Record<string, (number | null)[]> }>;
}

const DATA = raw as unknown as SeedData;

export function data(): SeedData {
  return DATA;
}

function keyError(message: string): Error {
  const error = new Error(message);
  error.name = "KeyError";
  return error;
}

function valueError(message: string): Error {
  const error = new Error(message);
  error.name = "ValueError";
  return error;
}

/** Python repr() for the values that appear in messages (strings, None). */
function repr(value: unknown): string {
  if (value === undefined || value === null) return "None";
  if (typeof value !== "string") return String(value);
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  return quote + value.replace(/\\/g, "\\\\").replaceAll(quote, "\\" + quote) + quote;
}

const own = <T>(record: Record<string, T>, key: unknown): T | undefined =>
  typeof key === "string" && Object.hasOwn(record, key) ? record[key] : undefined;

export function framesToMs(frames: number): number {
  return Math.floor((frames / GBA_FPS) * 1000);
}

export function describe(setting: string): string {
  const [sound, mode, button] = setting.split("/");
  return `${t(SOUND[sound])}, ${t(BUTTON_MODE[mode])}, ${t(SEED_BUTTON[button])}`;
}

export function settings(game: unknown): string[] {
  const found = own(DATA.games, game);
  if (!found) throw keyError(t("jogo {game} sem tabela de seeds", { game: repr(game) }));
  return Object.keys(found.seeds);
}

const cache = new Map<string, readonly Entry[]>();

/** Valid seeds in time order, without consecutive repeats. */
export function table(game: unknown, setting: unknown, console: unknown = "switch1"): readonly Entry[] {
  const offset = own(CONSOLES, console);
  if (offset === undefined)
    throw valueError(t("console {console}, esperado {options}", { console: repr(console), options: Object.keys(CONSOLES).join(t(" ou ")) }));
  const gameData = own(DATA.games, game);
  if (!gameData) throw keyError(t("jogo {game} sem tabela de seeds", { game: repr(game) }));
  const column = own(gameData.seeds, setting);
  if (!column)
    throw keyError(t("configuração {setting} sem dados para {game}; disponíveis: {options}", {
      setting: repr(setting), game: String(game), options: Object.keys(gameData.seeds).join(", "),
    }));
  const key = `${game}\u0000${setting}\u0000${console}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const out: Entry[] = [];
  let previous: number | null = null;
  // Like Python's zip(): stops at the shorter list.
  const rows = Math.min(gameData.times.length, column.length);
  for (let row = 0; row < rows; row++) {
    const seed = column[row];
    if (seed === null || seed === previous) continue;
    const frames = (gameData.times[row] + TIME_OFFSET) / 16;
    out.push({ index: out.length, row, seed, frames, ms: framesToMs(frames) + offset });
    previous = seed;
  }
  cache.set(key, out);
  return out;
}

export function find(game: string, setting: string, seed: number, console = "switch1"): Entry[] {
  return table(game, setting, console).filter((e) => e.seed === seed);
}
