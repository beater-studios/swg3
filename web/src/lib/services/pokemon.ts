// Pokémon services called by the pages. Port of the functions in src/swg3/web.py: parameters and results keep web.py's
// keys and formats so the parity tests can compare whole objects. Parameter errors are ParamError; rule errors are Error.

import { N_, t } from "../../i18n";
import * as base64box from "../gen3/base64box";
import * as boxnames from "../gen3/boxnames";
import { build, initialMoves, pythonRandom, systemRandom, type BuildFields, type Random16 } from "../gen3/builder";
import { UNOWN_LETTERS } from "../gen3/wild";
import * as codeplan from "../gen3/codeplan";
import * as pk3 from "../gen3/pk3";
import { NATURES, Pk3, STATS, type StatValues } from "../gen3/pk3";
import * as species from "../gen3/species";
import * as validate from "../gen3/validate";
import { fromHex, hexUpper, pyInt, pyRepr, pyStr, pyTruthy, toHex } from "../pyfmt";
import * as recipe from "../recipe";

export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

export type Params = Record<string, unknown>;

// include/constants/global.h: LANGUAGE_* and VERSION_*. Language names are translated where used (t).
export const LANGUAGES: ReadonlyMap<number, string> = new Map([
  [1, N_("japonês")], [2, N_("inglês")], [3, N_("francês")], [4, N_("italiano")], [5, N_("alemão")], [7, N_("espanhol")],
]);
export const GAMES: ReadonlyMap<number, string> = new Map([
  [1, "Sapphire"], [2, "Ruby"], [3, "Emerald"], [4, "FireRed"], [5, "LeafGreen"], [15, "Colosseum/XD"],
]);

const get = (params: Params, key: string, fallback: unknown = null) => (Object.hasOwn(params, key) ? params[key] : fallback);

// Parameter validation, like web.py's _hex, _int, _species_id and _nature_set.

const HEX_TEXT = /^[+-]?(?:0[xX]_?)?[0-9a-fA-F]+(?:_[0-9a-fA-F]+)*$/;

/** Hex integer (text with or without 0x, or a number), from 0 to 2^bits - 1. */
export function hexParam(params: Params, key: string, bits = 32, fallback: unknown = null): number {
  let value = get(params, key, fallback);
  if (value === null || value === undefined || value === "") throw new ParamError(t("{key}: obrigatório", { key }));
  if (typeof value === "string") {
    let text = value.trim();
    if (text.startsWith("0x")) text = text.slice(2);
    if (text.startsWith("0X")) text = text.slice(2);
    if (!HEX_TEXT.test(text)) throw new ParamError(t("{key}: {value} não é hexadecimal", { key, value: pyRepr(params[key]) }));
    const negative = text.startsWith("-");
    const digits = text.replace(/^[+-]/, "").replace(/^0[xX]/, "").replaceAll("_", "");
    const big = BigInt(`0x${digits}`);
    value = big > BigInt(Number.MAX_SAFE_INTEGER) ? Infinity : Number(big) * (negative ? -1 : 1);
  }
  if (typeof value === "boolean") value = Number(value);
  if (typeof value !== "number") throw new TypeError(`'<=' not supported between instances of 'int' and '${typeof value}'`);
  if (!(value >= 0 && value < 2 ** bits)) throw new ParamError(t("{key}: fora de 0 a {max}", { key, max: (2 ** bits - 1).toString(16).toUpperCase() }));
  return value;
}

export function intParam(params: Params, key: string, lo: number, hi: number, fallback: number | null = null): number | null {
  const value = get(params, key, fallback);
  if (value === null || value === undefined || value === "") return fallback;
  let number: number;
  try {
    number = pyInt(value);
  } catch {
    throw new ParamError(t("{key}: {value} não é número", { key, value: pyRepr(value) }));
  }
  if (!(number >= lo && number <= hi)) throw new ParamError(t("{key}: fora de {lo} a {hi}", { key, lo, hi }));
  return number;
}

/** Species (internal number); 0 or missing is null. */
export function speciesParam(params: Params, key = "species"): number | null {
  const value = intParam(params, key, 0, validate.SPECIES_EGG, null);
  if (value === null || value === 0) return null;
  if (!validate.validSpecies(value)) throw new ParamError(t("{key}: espécie {species} inexistente", { key, species: value }));
  return value;
}

export function natureSet(names: readonly string[] | null | undefined): Set<number> {
  const lowered = NATURES.map((n) => n.toLowerCase());
  const out = new Set<number>();
  for (const name of names ?? []) {
    const index = lowered.indexOf(name.toLowerCase());
    if (index < 0) throw new ParamError(t("nature desconhecida: {name}", { name }));
    out.add(index);
  }
  return out;
}

export function bytesParam(params: Params, key = "hex"): Uint8Array {
  const text = (Object.hasOwn(params, key) ? pyStr(params[key]) : "").split(/\s+/).join("");
  const data = fromHex(text);
  if (!data) throw new ParamError(t("{key}: conteúdo não é hexadecimal", { key }));
  return data;
}

function loadPk3(params: Params, key = "hex"): [Pk3, boolean] {
  const data = bytesParam(params, key);
  if (data.length !== pk3.BOX_SIZE && data.length !== pk3.PARTY_SIZE) {
    throw new ParamError(t("tamanho {size} bytes, esperado {box} (box) ou {party} (party)", { size: data.length, box: pk3.BOX_SIZE, party: pk3.PARTY_SIZE }));
  }
  return pk3.load(data);
}

export interface Named {
  id: number;
  name: string;
}

export interface IssueDict {
  level: validate.IssueLevel;
  field: string;
  message: string;
}

export interface Pk3Description {
  format: "encrypted" | "decrypted";
  size: number;
  party: boolean;
  checksum: { stored: number; computed: number; ok: boolean };
  species: { id: number; name: string; known: boolean; types?: string[]; base?: number[]; national?: number };
  nickname: string;
  ot_name: string;
  ot_gender: "M" | "F";
  nature_index: number;
  tid: number;
  sid: number;
  pid: string;
  nature: string;
  shiny: boolean;
  ivs: number[];
  evs: number[];
  moves: { id: number; name: string; pp: number }[];
  pp_bonuses: number;
  held_item: Named;
  ball: Named;
  met_level: number;
  met_location: Named;
  met_game: Named;
  language: Named;
  friendship: number;
  experience: number;
  pokerus: number;
  is_egg: boolean;
  is_bad_egg: boolean;
  fateful: boolean;
  ribbons: string;
  markings: number;
  contest: pk3.Contest;
  ability_num: number;
  hidden_power: { type: string; power: number };
  gender?: species.Gender;
  ability?: string;
  level?: number;
  stats?: number[];
  party_data?: { level: number; stats: number[]; current_hp: number };
  issues: IssueDict[];
  files?: { game: string; plain: string };
}

const named = (id: number, name: string): Named => ({ id, name });
const statList = (values: StatValues) => STATS.map((k) => values[k]);
const uniqueTypes = (types: readonly number[]) => [...new Set(types.map(species.typeName))];

function abilityLabel(speciesId: number, pidBit: number): string {
  const [first, second] = species.info(speciesId).abilities;
  return species.abilityName(pidBit && second ? second : first);
}

export function describe(mon: Pk3, encrypted = true): Pk3Description {
  const known = validate.validSpecies(mon.species);
  const [hpType, hpPower] = species.hiddenPower(mon.ivs);
  const out: Pk3Description = {
    format: encrypted ? "encrypted" : "decrypted",
    size: mon.data.length,
    party: mon.isParty,
    checksum: { stored: mon.storedChecksum, computed: pk3.checksum(mon.data), ok: mon.checksumOk },
    species: { id: mon.species, name: validate.speciesNames().get(mon.species) ?? "?", known },
    nickname: mon.nickname,
    ot_name: mon.otName,
    ot_gender: mon.otGender ? "F" : "M",
    nature_index: mon.personality % 25,
    tid: mon.tid,
    sid: mon.sid,
    pid: hexUpper(mon.personality, 8),
    nature: mon.nature,
    shiny: mon.isShiny,
    ivs: statList(mon.ivs),
    evs: statList(mon.evs),
    moves: mon.moves.map((m, i) => ({ id: m, name: m ? species.moveName(m) : "-", pp: mon.pp[i] })),
    pp_bonuses: mon.ppBonuses,
    held_item: named(mon.heldItem, mon.heldItem ? species.itemName(mon.heldItem) : "-"),
    ball: named(mon.ball, mon.ball ? species.itemName(mon.ball) : "-"),
    met_level: mon.metLevel,
    met_location: named(mon.metLocation, species.mapSection(mon.metLocation, mon.metGame)),
    met_game: named(mon.metGame, GAMES.get(mon.metGame) ?? "?"),
    language: named(mon.language, t(LANGUAGES.get(mon.language) ?? "?")),
    friendship: mon.friendship,
    experience: mon.experience,
    pokerus: mon.pokerus,
    is_egg: mon.isEgg,
    is_bad_egg: mon.isBadEgg,
    fateful: mon.fateful,
    ribbons: hexUpper(mon.ribbons, 8),
    markings: mon.markings,
    contest: mon.contest,
    ability_num: mon.abilityNum,
    hidden_power: { type: species.typeName(hpType), power: hpPower },
    issues: [],
  };
  if (known) {
    const entry = species.info(mon.species);
    const level = species.monLevel(mon);
    Object.assign(out.species, { types: uniqueTypes(entry.types), base: entry.base, national: entry.national });
    out.gender = species.gender(mon.species, mon.personality);
    out.ability = abilityLabel(mon.species, mon.abilityNum);
    out.level = level;
    out.stats = statList(species.monStats(mon, level));
  }
  if (mon.isParty) {
    const party = mon.stats;
    out.party_data = { level: mon.level, stats: statList(party), current_hp: party.current_hp };
  }
  out.issues = validate.check(mon).map((i) => ({ level: i.level, field: i.field, message: i.message }));
  if (mon.checksumOk) out.files = { game: toHex(mon.toRaw()), plain: toHex(mon.data) };
  return out;
}

/** Reads a pk3 (game format or plain), shows the fields and validates. Parameter: `hex`. */
export function pk3Inspect(params: Params): Pk3Description {
  return describe(...loadPk3(params));
}

export interface Lists {
  moves: Named[];
  items: Named[];
  balls: Named[];
  locations: Named[];
  locations_emerald: Named[];
  /** Met locations of each origin game (null: no filter, Colosseum/XD). */
  game_locations: Record<string, number[] | null>;
  languages: Named[];
  games: Named[];
}

/** Editor lists. Emerald's met locations are kept apart, since they reuse FR/LG numbers. */
export function lists(_params: Params = {}): Lists {
  const d = species.data();
  return {
    moves: Object.entries(d.moves).map(([k, v]) => named(Number(k), v)).filter((m) => m.id).sort((a, b) => a.id - b.id),
    items: d.items.map((n, i) => named(i, n)).filter((m) => m.id && m.name && !m.name.startsWith("?") && species.holdable(m.id)),
    balls: Array.from({ length: validate.MAX_BALL }, (_, i) => named(i + 1, species.itemName(i + 1))),
    locations: Object.entries(d.mapsec).map(([k, v]) => named(Number(k), v)).sort((a, b) => a.id - b.id),
    locations_emerald: Object.entries(d.mapsec_emerald).map(([k, v]) => named(Number(k), v)).sort((a, b) => a.id - b.id),
    game_locations: Object.fromEntries([...GAMES.keys()].map((id) => [String(id), validate.metLocations(id)])),
    languages: [...LANGUAGES].map(([id, name]) => named(id, t(name))),
    games: [...GAMES].map(([id, name]) => named(id, name)),
  };
}

export interface SpeciesInfoResult {
  id: number;
  name: string;
  national: number;
  types: string[];
  base: number[];
  friendship: number;
  gender_ratio: number;
  abilities: string[];
  default_moves: number[];
  learnable: Named[];
  /** Egg-only moves (only a hatched Pokémon can have them). */
  egg_moves: Named[];
  /** Moves only Emerald's tutor teaches (valid if the Pokémon went through Emerald). */
  emerald_tutor: Named[];
  /** Moves only XD's tutor teaches (valid if the Pokémon is from XD or went through it). */
  xd_tutor: Named[];
  evolutions: { method: string; param: number; target: string }[];
}

export function speciesInfo(params: Params): SpeciesInfoResult {
  const speciesId = speciesParam(params);
  if (speciesId === null) throw new ParamError(t("{key}: obrigatório", { key: "species" }));
  const level = intParam(params, "level", 1, 100, 100)!;
  const entry = species.info(speciesId);
  const learnable = [...species.learnableMoves(speciesId, level, false)].sort((a, b) => a - b);
  const eggMoves = [...species.eggOnlyMoves(speciesId, level)].sort((a, b) => a - b);
  const emerald = [...species.emeraldTutorMoves(speciesId)].filter((m) => !learnable.includes(m) && !eggMoves.includes(m)).sort((a, b) => a - b);
  const xd = [...species.xdTutorMoves(speciesId)].filter((m) => !learnable.includes(m) && !eggMoves.includes(m) && !emerald.includes(m)).sort((a, b) => a - b);
  return {
    id: speciesId, name: entry.name, national: entry.national,
    types: uniqueTypes(entry.types),
    base: entry.base, friendship: entry.friendship, gender_ratio: entry.gender_ratio,
    abilities: entry.abilities.filter((a) => a).map(species.abilityName),
    default_moves: initialMoves(speciesId, level),
    learnable: learnable.map((m) => named(m, species.moveName(m))),
    egg_moves: eggMoves.map((m) => named(m, species.moveName(m))),
    emerald_tutor: emerald.map((m) => named(m, species.moveName(m))),
    xd_tutor: xd.map((m) => named(m, species.moveName(m))),
    evolutions: species.evolutions(speciesId).map(([method, param, target]) => ({ method, param, target: species.info(target).name })),
  };
}

function buildFields(params: Params): BuildFields {
  const source = get(params, "fields");
  const fields: Record<string, unknown> = pyTruthy(source) ? { ...(source as Params) } : {};
  if (typeof fields.nature === "string") fields.nature = [...natureSet([fields.nature])][0];
  if (typeof fields.pid === "string") fields.pid = hexParam(fields, "pid");
  for (const key of ["ivs", "evs"]) {
    const values = fields[key];
    if (Array.isArray(values)) {
      if (values.length !== STATS.length) throw new ParamError(t("{key}: esperados {count} valores", { key, count: STATS.length }));
      fields[key] = Object.fromEntries(STATS.map((k, i) => [k, values[i]]));
    }
  }
  if (typeof fields.letter === "string") {
    if (!UNOWN_LETTERS.includes(fields.letter)) throw new ParamError(`letter: ${pyRepr(fields.letter)}`);
    fields.letter = UNOWN_LETTERS.indexOf(fields.letter);
  }
  return fields as BuildFields;
}

/** Generator for the request's `seed`: an integer reproduces Python's random.Random(seed). */
function seededRandom(seed: unknown): Random16 {
  if (seed === null || seed === undefined) return systemRandom();
  if (typeof seed === "number" && Number.isInteger(seed)) return pythonRandom(seed);
  if (typeof seed === "boolean") return pythonRandom(Number(seed));
  // Strings and floats: Python uses sha512 and hash(); here a simple hash (same seed, same PID, no parity).
  let hash = 0;
  for (const char of pyStr(seed)) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
  return pythonRandom(hash);
}

export interface BuildResult {
  mon: Pk3Description;
  notes: string[];
}

/**
 * Creates or edits (with `base`, a hex pk3) a pk3. `fields` are builder.build's, with nature by name, pid in hex, IVs and
 * EVs as lists and the Unown letter as text. `random` replaces the generator (tests).
 */
export function pk3Build(params: Params, random?: Random16): BuildResult {
  const base = pyTruthy(get(params, "base")) ? loadPk3(params, "base")[0] : null;
  const [mon, notes] = build(buildFields(params), base, random ?? seededRandom(get(params, "seed")));
  return { mon: describe(mon), notes };
}

/** Plan with the community codes to reach the Pokémon (without ESP32). Parameters: `hex`, `strategy`. */
export function codePlan(params: Params): codeplan.Plan {
  const [mon] = loadPk3(params);
  if (!validate.validSpecies(mon.species)) throw new ParamError(t("espécie inválida"));
  return codeplan.plan(mon, get(params, "strategy", "wild"));
}

/** Trade recipe for the ESP32 host. Parameters: `hex`, `game`, `save_as`. `now` fixes the date (tests). */
export function recipeTrade(params: Params, now?: Date): recipe.Recipe {
  const [mon] = loadPk3(params);
  const saveAs = get(params, "save_as");
  const name = pyTruthy(saveAs) ? String(saveAs).trim() : "";
  return recipe.trade(mon, get(params, "game", "firered"), name || null, now);
}

export interface RecipeCheckResult {
  recipe: Record<string, unknown>;
  mon: Pk3Description;
}

export function recipeCheck(params: Params): RecipeCheckResult {
  const [data, mon] = recipe.load(pyStr(get(params, "text", "")));
  return { recipe: data, mon: describe(mon) };
}

export interface ProblemDict {
  level: boxnames.IssueLevel;
  message: string;
}

export interface BoxEntry {
  number: number;
  name: string;
  length: number;
  issues: ProblemDict[];
  steps: boxnames.TypingStep[] | null;
  bytes: string | null;
}

export interface BoxNamesResult {
  boxes: BoxEntry[];
  code: { kind: "base64"; mon: Pk3Description } | { kind: "base64"; error: string } | null;
  issues: ProblemDict[];
  ok: boolean;
}

const problems = (list: readonly boxnames.Problem[]): ProblemDict[] => list.map(([level, message]) => ({ level, message }));

/** Checks box names (and raw bytes, if given) and builds the typing guide. Parameters: `names`, `raw`. */
export function boxNames(params: Params): BoxNamesResult {
  let names = boxnames.parseNames(pyStr(get(params, "names", "")));
  const rawText = pyStr(get(params, "raw", "")).trim();
  let general: boxnames.Problem[] = [];
  let rawNames: string[] | null = null;
  if (rawText) {
    const [decoded, rawIssues] = boxnames.checkRaw(boxnames.parseRaw(rawText));
    rawNames = decoded;
    general.push(...rawIssues);
    if (!names.length) names = rawNames;
  }
  const [boxes, nameIssues] = boxnames.checkNames(names);
  general = [...nameIssues, ...general];
  const out = boxes.map((box): BoxEntry => {
    const entry: BoxEntry = {
      number: box.number, name: box.name, length: [...box.name].length, issues: problems(box.issues), steps: null,
      bytes: box.raw.length ? toHex(box.raw, " ").toUpperCase() : null,
    };
    if (!box.issues.some(([level]) => level === "error")) entry.steps = boxnames.typingSteps(box.name);
    if (rawNames !== null && box.number <= rawNames.length && rawNames[box.number - 1] !== box.name) {
      entry.issues.push({ level: "error", message: t("diferente dos bytes crus: {name}", { name: pyRepr(rawNames[box.number - 1]) }) });
    }
    return entry;
  });
  if (rawNames !== null && rawNames.length !== names.length) {
    general.push(["error", t("{names} nomes, mas os bytes crus têm {boxes} boxes", { names: names.length, boxes: rawNames.length })]);
  }
  let code: BoxNamesResult["code"] = null;
  if (base64box.isBase64Code(names)) {
    try {
      const [mon] = pk3.load(base64box.decode(names));
      code = mon.checksumOk
        ? { kind: "base64", mon: describe(mon) }
        : { kind: "base64", error: t("os bytes decodificados não formam um Pokémon válido (checksum): confira a digitação") };
    } catch (error) {
      code = { kind: "base64", error: (error as Error).message };
    }
  }
  return {
    boxes: out, code, issues: problems(general),
    ok: !general.some(([level]) => level === "error") && out.every((b) => !b.issues.some((i) => i.level === "error")),
  };
}

/** `convert` list, like Python's `tuple(int(n) for n in ...)`. */
function convertList(value: unknown): number[] {
  if (!pyTruthy(value)) return [];
  const items = typeof value === "string" ? [...value] : Array.isArray(value) ? value : Object.keys(value as object);
  return items.map(pyInt);
}

/** Pokémon as box names for the Base64 writer. Parameters: `hex`, `switch_safe` (default true), `convert`. */
export function base64Boxes(params: Params): base64box.EncodedDict {
  const [mon] = loadPk3(params);
  if (!mon.checksumOk) throw new ParamError(t("checksum inválido: o writer gravaria um Bad Egg"));
  const errors = validate.check(mon).filter((i) => i.level === "error");
  if (errors.length) {
    throw new ParamError(t("Pokémon com erro, corrija antes: {errors}", { errors: errors.map((i) => `${i.field}: ${i.message}`).join("; ") }));
  }
  const convert = convertList(get(params, "convert"));
  const raw = mon.toBox().toRaw();
  const result = base64box.encode(raw, pyTruthy(get(params, "switch_safe", true)), convert);
  if (toHex(base64box.decode(result.boxes)) !== toHex(raw)) {
    throw new ParamError(t("conferência interna falhou: os nomes não reproduzem os bytes"));
  }
  return result.asDict();
}
