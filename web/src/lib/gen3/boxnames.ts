// PC box names: checking and typing guide for community codes. Port of src/swg3/gen3/boxnames.py.
// Decomp: include/pokemon_storage_system.h `boxNames` (14 boxes of 8 characters + 0xFF, 9 bytes each); src/naming_screen.c
// sKeyboardChars, sPcBoxNamingScreenTemplate, HandleKeyboardEvent; revision 10 runs svc_BadWordCheck in MainState_PressedOKButton.

import { N_, t } from "../../i18n";
import { fromHex, hexUpper, pyRepr } from "../pyfmt";
import * as badwords from "./badwords";
import * as charset from "./charset";

export const TOTAL_BOXES = 14;
export const NAME_LENGTH = 8;
export const BOX_BYTES = NAME_LENGTH + 1;
export const TERMINATOR = charset.TERMINATOR;

/** Select order, starting on uppercase. */
export const PAGES = [N_("maiúsculas"), N_("minúsculas"), N_("símbolos")] as const;
/** sKeyboardChars, in PAGES order. On the letter pages, column 6 of the first two rows is the space. */
export const KEYBOARD: readonly (readonly string[])[] = [
  ["ABCDEF .", "GHIJKL ,", "MNOPQRS", "TUVWXYZ"],
  ["abcdef .", "ghijkl ,", "mnopqrs", "tuvwxyz"],
  ["01234", "56789", "!?♂♀/-", "…“”‘'"],
];
export const LOOKALIKES: Readonly<Record<string, string>> = { "_": " ", "–": "-", "‐": "-", "’": "'", " ": " " };
/** Community research (pokemon-ace-notes, FRLG FAQ): on the Switch, avoid a space in the last three characters of these boxes. */
export const SWITCH_SPACE_BOXES: readonly number[] = [4, 8, 12];

export type Key = [page: number, row: number, col: number];

function buildKeys(): Map<string, Key> {
  const keys = new Map<string, Key>();
  KEYBOARD.forEach((rows, page) => rows.forEach((text, row) => [...text].forEach((char, col) => {
    if (!keys.has(char)) keys.set(char, [page, row, col]);
  })));
  return keys;
}

export const KEYS: ReadonlyMap<string, Key> = buildKeys();

export type IssueLevel = "error" | "warning";
export type Problem = [level: IssueLevel, message: string];

export function normalize(name: string): string {
  return [...name].map((c) => LOOKALIKES[c] ?? c).join("");
}

/** [page, row, column] of the key, or null if the character is not on the box keyboard. */
export function keyOf(char: string): Key | null {
  return KEYS.get(normalize(char)) ?? null;
}

/** Name to the 9 stored bytes (terminator and 0xFF padding). */
export function encodeName(name: string): Uint8Array {
  return charset.encode(normalize(name), BOX_BYTES);
}

const REPORT = /^\s*Box\s*(\d+)\s*:\s*(.*?)\s*(?:\[.*\])?\s*$/gim;

/** Generator output as a JSON list, "Box N: ..." report or one name per line. `_` means space. */
export function parseNames(input: string): string[] {
  const text = input.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    let names: unknown;
    try {
      names = JSON.parse(text);
    } catch (error) {
      throw new Error(t("lista JSON inválida: {error}", { error: (error as Error).message }));
    }
    if (!Array.isArray(names) || !names.every((n) => typeof n === "string")) throw new Error(t("a lista deve ter só textos"));
    return (names as string[]).map(normalize);
  }
  const report = [...text.matchAll(REPORT)];
  if (report.length) {
    const names = new Map<number, string>();
    for (const [, number, spaced] of report) {
      // "_ _ F 9 q": characters separated by single spaces, `_` is a space.
      const chars = spaced.includes(" ") ? spaced.split(" ") : [...spaced];
      names.set(Number(number), normalize(chars.join("")));
    }
    const max = Math.max(...names.keys());
    const expected = Array.from({ length: max }, (_, i) => i + 1);
    const got = [...names.keys()].sort((a, b) => a - b);
    if (got.length !== expected.length || got.some((n, i) => n !== expected[i])) {
      const missing = expected.filter((n) => !names.has(n));
      throw new Error(t("faltam as boxes {boxes} no relatório", { boxes: missing.join(", ") }));
    }
    return expected.map((n) => names.get(n)!);
  }
  return text.split("\n").map((line) => normalize(line.replace(/\r+$/, "")));
}

/** Raw bytes in hex (the generator's "Raw data" section), with or without separators. */
export function parseRaw(text: string): Uint8Array {
  const clean = text.replace(/0x|[\s,]/gi, "");
  const data = fromHex(clean);
  if (!data) throw new Error(t("bytes crus: use hexadecimal"));
  return data;
}

export class Box {
  readonly issues: Problem[] = [];

  constructor(
    readonly number: number,
    readonly name: string,
    public raw: Uint8Array,
  ) {}

  error(message: string) {
    this.issues.push(["error", message]);
  }

  warn(message: string) {
    this.issues.push(["warning", message]);
  }
}

const byCodePoint = (a: string, b: string) => a.codePointAt(0)! - b.codePointAt(0)!;

export function checkNames(names: readonly string[]): [boxes: Box[], general: Problem[]] {
  const general: Problem[] = [];
  if (!names.length) general.push(["error", t("nenhum nome informado")]);
  if (names.length > TOTAL_BOXES) general.push(["error", t("{count} boxes; o PC tem {total}", { count: names.length, total: TOTAL_BOXES })]);
  const boxes = names.map((original, index) => {
    const name = normalize(original);
    const chars = [...name];
    const box = new Box(index + 1, name, new Uint8Array());
    const bad = [...new Set(chars.filter((c) => !KEYS.has(c)))].sort(byCodePoint);
    if (bad.length) box.error(t("fora do teclado de nome de box: {chars}", { chars: bad.map(pyRepr).join(" ") }));
    if (chars.length > NAME_LENGTH) box.error(t("{length} caracteres; o máximo é {max}", { length: chars.length, max: NAME_LENGTH }));
    if (!name.trim()) box.error(t("vazia ou só com espaços: o jogo não aceita"));
    const blocked = name.trim() ? badwords.matches(name) : [];
    if (blocked.length) {
      box.warn(t("o filtro de palavras do Switch deve recusar este nome ({words}); gere de novo com saída para Switch ou converta a box", { words: blocked.join(", ") }));
    }
    if (SWITCH_SPACE_BOXES.includes(box.number) && chars.slice(5, NAME_LENGTH).includes(" ")) {
      box.warn(t("espaço nos três últimos caracteres: no Switch a comunidade recomenda evitar (ver a FAQ do FRLG nas pokemon-ace-notes)"));
    }
    if (!bad.length && chars.length <= NAME_LENGTH) box.raw = encodeName(name);
    return box;
  });
  return [boxes, general];
}

function decodeByte(value: number): string | null {
  const text = charset.decode([value]);
  return text === `\\x${hexUpper(value, 2)}` ? null : text;
}

export function checkRaw(data: Uint8Array): [names: string[], issues: Problem[]] {
  const issues: Problem[] = [];
  if (data.length % BOX_BYTES) {
    issues.push(["warning", t("{size} bytes não é múltiplo de {box}; a última box fica incompleta", { size: data.length, box: BOX_BYTES })]);
  }
  const names: string[] = [];
  for (let start = 0; start < data.length; start += BOX_BYTES) {
    const number = start / BOX_BYTES + 1;
    const chunk = data.subarray(start, start + BOX_BYTES);
    if (chunk.length === BOX_BYTES && chunk[chunk.length - 1] !== TERMINATOR) {
      issues.push(["error", t("Box {number}: o byte {offset} deveria ser o terminador 0xFF, é 0x{value}", {
        number, offset: start + NAME_LENGTH, value: hexUpper(chunk[chunk.length - 1], 2),
      })]);
    }
    const body = chunk.subarray(0, NAME_LENGTH);
    const end = body.indexOf(TERMINATOR);
    if (end !== -1 && body.subarray(end).some((b) => b !== TERMINATOR)) {
      issues.push(["error", t("Box {number}: 0xFF no meio do nome seguido de outro byte; impossível digitar", { number })]);
    }
    const text = end !== -1 ? body.subarray(0, end) : body;
    const chars: string[] = [];
    for (const value of text) {
      const decoded = decodeByte(value);
      let char = decoded !== null ? normalize(decoded) : null;
      if (char === null || !KEYS.has(char)) {
        issues.push(["error", t("Box {number}: byte 0x{value} não está no teclado de nome de box", { number, value: hexUpper(value, 2) })]);
        char = "?";
      }
      chars.push(char);
    }
    names.push(chars.join(""));
  }
  if (names.length > TOTAL_BOXES) issues.push(["error", t("{count} boxes; o PC tem {total}", { count: names.length, total: TOTAL_BOXES })]);
  return [names, issues];
}

// Keyboard cursor (src/naming_screen.c): each page has the sPageColumnCounts key columns plus the button column (PAGE,
// BACK, OK). The saved row is HandleDpadMovement's tButtonId, the key row the cursor returns to from the middle button.
export const COLUMNS: readonly number[] = [8, 8, 6];
export const ROWS = 4;
export const BUTTONS = 3;
const KEY_ROW_TO_BUTTON_ROW = [0, 1, 1, 2];   // sKeyRowToButtonRow
const BUTTON_ROW_TO_KEY_ROW = [0, 0, 3];      // sButtonRowToKeyRow
export type Cursor = readonly [page: number, x: number, y: number, saved: number];
/** Fresh screen: uppercase, cursor on the first key (CreateCursorSprite). */
export const START: Cursor = [0, 0, 0, 0];
export const MOVES = ["select", "up", "down", "left", "right"] as const;
export type Move = (typeof MOVES)[number];
const DELTAS: Record<Exclude<Move, "select">, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function press(cursor: Cursor, key: Move): Cursor {
  let [page, x, y, saved] = cursor;
  const columns = COLUMNS[page];
  if (key === "select") {
    // MainState_WaitPageSwap: on the button column it stays there; on the keys, the column is clamped to the new page.
    page = (page + 1) % PAGES.length;
    if (x === columns) x = COLUMNS[page];
    else if (x >= COLUMNS[page]) x = COLUMNS[page] - 1;
    return [page, x, y, saved];
  }
  // HandleDpadMovement
  const [dx, dy] = DELTAS[key];
  const previous = x;
  x += dx;
  y += dy;
  if (x < 0) x = columns;
  if (x > columns) x = 0;
  if (dx) {
    if (x === columns) {
      saved = y;
      y = KEY_ROW_TO_BUTTON_ROW[y];
    } else if (previous === columns) {
      y = y === Math.floor(BUTTONS / 2) ? saved : BUTTON_ROW_TO_KEY_ROW[y];
    }
  }
  if (x === columns) {
    y = ((y % BUTTONS) + BUTTONS) % BUTTONS;
    if (y === 0) saved = 1;
    else if (y === BUTTONS - 1) saved = 2;
  } else {
    y = ((y % ROWS) + ROWS) % ROWS;
  }
  return [page, x, y, saved];
}

function buildPositions(): Map<string, Key[]> {
  const out = new Map<string, Key[]>();
  KEYBOARD.forEach((rows, page) => rows.forEach((text, row) => [...text].forEach((char, col) => {
    out.set(char, [...(out.get(char) ?? []), [page, row, col]]);
  })));
  return out;
}

const POSITIONS = buildPositions();

const runs = (path: readonly number[]) => path.filter((move, i) => i === 0 || path[i - 1] !== move).length;

// Compares (runs, path) like Python tuple comparison.
function better(a: readonly number[], b: readonly number[]): boolean {
  const ra = runs(a), rb = runs(b);
  if (ra !== rb) return ra < rb;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}

/**
 * Shortest path to a key of the character (it may be on several pages): fewest presses, then fewest direction
 * changes, then MOVES order. Returns the indices into MOVES and the cursor on the key.
 */
export function cursorPath(cursor: Cursor, char: string): [number[], Cursor] {
  const targets = new Set((POSITIONS.get(normalize(char)) ?? []).map(([page, row, col]) => `${page},${col},${row}`));
  const id = (state: Cursor, last: number) => `${state.join(",")}|${last}`;
  let frontier = new Map<string, [Cursor, number[]]>([[id(cursor, -1), [cursor, []]]]);
  const seen = new Set(frontier.keys());
  while (frontier.size) {
    let hit: [number[], Cursor] | null = null;
    for (const [state, path] of frontier.values()) {
      // The same path from the same cursor always ends in the same place: comparing paths is enough.
      if (targets.has(state.slice(0, 3).join(",")) && (!hit || better(path, hit[0]))) hit = [path, state];
    }
    if (hit) return hit;
    const following = new Map<string, [Cursor, number[]]>();
    for (const [state, path] of frontier.values()) {
      MOVES.forEach((key, i) => {
        const next = press(state, key);
        const node = id(next, i);
        if (seen.has(node)) return;
        const candidate = [...path, i];
        const current = following.get(node);
        if (!current || better(candidate, current[1])) following.set(node, [next, candidate]);
      });
    }
    for (const node of following.keys()) seen.add(node);
    frontier = following;
  }
  throw new Error(t("caractere fora do teclado: {char}", { char: pyRepr(char) }));
}

export interface MoveRun {
  key: Move;
  count: number;
}

export interface TypingStep {
  char: string;
  page: string;
  page_index: number;
  row: number;
  col: number;
  select: number;
  /** Cursor path from the previous key, before pressing A. */
  moves: MoveRun[];
}

/**
 * Keys to type the name on a fresh box naming screen. After 8 characters the game moves the cursor to OK by itself;
 * with fewer, Start moves to OK (HandleKeyboardEvent and KeyboardKeyHandler_Character).
 */
export function typingSteps(name: string): TypingStep[] {
  const steps: TypingStep[] = [];
  let cursor = START;
  for (const char of normalize(name)) {
    if (!KEYS.has(char)) throw new Error(t("caractere fora do teclado: {char}", { char: pyRepr(char) }));
    const [path, end] = cursorPath(cursor, char);
    cursor = end;
    const moves: MoveRun[] = [];
    for (const i of path) {
      const last = moves[moves.length - 1];
      if (last && last.key === MOVES[i]) last.count++;
      else moves.push({ key: MOVES[i], count: 1 });
    }
    const [page, x, y] = cursor;
    steps.push({ char, page: t(PAGES[page]), page_index: page, row: y + 1, col: x + 1, select: path.filter((i) => i === 0).length, moves });
  }
  return steps;
}
