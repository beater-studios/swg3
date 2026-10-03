// Building and editing a pk3 from fields, following what the game writes on creation. Port of src/swg3/gen3/builder.py.
// Decomp (src/pokemon.c): CreateBoxMon, GiveBoxMonInitialMoveset, CreateMon, CreateEventMon. The PID matches the requested
// traits but follows no RNG method's PID/IV correlation, so legality checkers that check the method reject it.
import { t } from "../../i18n";
import { hexUpper, pyInt, pyStr, pyTruthy } from "../pyfmt";
import { BOX_SIZE, NATURES, PARTY_SIZE, Pk3, STATS, type StatValues } from "./pk3";
import { NUM_NATURES } from "./rng";
import * as encounters from "./encounters";
import * as ribbonData from "./ribbons";
import * as speciesData from "./species";
import * as validate from "./validate";
import { UNOWN, UNOWN_LETTERS, unownLetter } from "./wild";

export const VERSIONS: Readonly<Record<string, number>> = { firered: 4, leafgreen: 5 };
export const MAPSEC_PALLET_TOWN = 0x58; // include/constants/region_map_sections.h
export const ITEM_POKE_BALL = 4;
export const LANGUAGE_ENGLISH = 2;
export const MAX_EV = 255;
export const MAX_TOTAL_EVS = validate.MAX_TOTAL_EVS;
export const MAX_PID_TRIES = 2_000_000;

export type Random16 = () => number;

export function systemRandom(): Random16 {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint16Array(1);
    return () => cryptoApi.getRandomValues(buffer)[0];
  }
  return () => Math.floor(Math.random() * 0x10000);
}

/**
 * Python's `random.Random(seed)` as seen through `getrandbits(16)`: MT19937 with the integer seed split into 32-bit
 * words (init_by_array), as in CPython's Modules/_randommodule.c. `getrandbits(16)` is the 32-bit output shifted by
 * 16; `randrange(8)` uses the top 4 bits with rejection, which `randrange8` below reproduces from the same 16 bits.
 */
export function pythonRandom(seed: number): Random16 {
  const mt = new Uint32Array(624);
  let index = 625;
  const initGenrand = (s: number) => {
    mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) mt[i] = (Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
    index = 624;
  };
  let n = BigInt(Math.abs(Math.trunc(seed)));
  const key: number[] = [];
  do {
    key.push(Number(n & 0xffffffffn));
    n >>= 32n;
  } while (n > 0n);
  initGenrand(19650218);
  let i = 1, j = 0;
  for (let k = Math.max(624, key.length); k; k--) {
    mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1664525)) + key[j] + j) >>> 0;
    i++; j++;
    if (i >= 624) { mt[0] = mt[623]; i = 1; }
    if (j >= key.length) j = 0;
  }
  for (let k = 623; k; k--) {
    mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1566083941)) - i) >>> 0;
    i++;
    if (i >= 624) { mt[0] = mt[623]; i = 1; }
  }
  mt[0] = 0x80000000;
  const next = (): number => {
    if (index >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (mt[kk] & 0x80000000) | (mt[(kk + 1) % 624] & 0x7fffffff);
        mt[kk] = (mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
      }
      index = 0;
    }
    let y = mt[index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  };
  return () => next() >>> 16;
}

function randrange8(random: Random16): number {
  for (;;) {
    const value = random() >>> 12;
    if (value < 8) return value;
  }
}

/** Moves the game gives when creating the species at this level (GiveBoxMonInitialMoveset). */
export function initialMoves(species: number, level: number): number[] {
  const moves: number[] = [];
  for (const [moveLevel, move] of speciesData.info(species).levelup) {
    if (moveLevel > level) break;
    if (moves.includes(move)) continue;
    if (moves.length === 4) moves.shift();
    moves.push(move);
  }
  return moves;
}

export type Gender = "M" | "F";

/** PID constraints (null or missing = any). `letter`: Unown letter, 0 to 27. */
export interface PidWanted {
  nature?: number | null;
  shiny?: boolean | null;
  gender?: string | null;
  ability?: number | null;
  letter?: number | null;
  /** Accepted Unown letters (those of the met location's Tanoby chamber). */
  letters?: readonly number[] | null;
}

const given = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

function pidOk(pid: number, species: number, tid: number, sid: number, want: PidWanted): boolean {
  if (given(want.nature) && pid % NUM_NATURES !== want.nature) return false;
  const isShiny = (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8;
  if (given(want.shiny) && isShiny !== Boolean(want.shiny)) return false;
  if (given(want.gender) && speciesData.gender(species, pid) !== want.gender) return false;
  if (given(want.ability) && speciesData.info(species).abilities[1] && (pid & 1) !== Number(want.ability)) return false;
  if (given(want.letter) && species === UNOWN && unownLetter(pid) !== want.letter) return false;
  if (given(want.letters) && species === UNOWN && !want.letters.includes(unownLetter(pid))) return false;
  return true;
}

export function choosePid(species: number, tid: number, sid: number, want: PidWanted = {}, random: Random16 = systemRandom()): number {
  const entry = speciesData.info(species);
  const fixed: Record<number, string> = { [speciesData.MON_MALE]: "M", [speciesData.MON_FEMALE]: "F", [speciesData.MON_GENDERLESS]: "-" };
  const ratio = entry.gender_ratio;
  if (given(want.gender) && ratio in fixed && fixed[ratio] !== want.gender) {
    throw new Error(t("gênero {gender} impossível: a espécie é sempre {fixed}", { gender: want.gender, fixed: fixed[ratio] }));
  }
  if (Number(want.ability) === 1 && !entry.abilities[1]) throw new Error(t("a espécie só tem uma Ability"));
  for (let attempt = 0; attempt < MAX_PID_TRIES; attempt++) {
    const low = random();
    const high = pyTruthy(want.shiny) ? (tid ^ sid ^ low ^ randrange8(random)) & 0xffff : random();
    const pid = ((high << 16) | low) >>> 0;
    if (pidOk(pid, species, tid, sid, want)) return pid;
  }
  throw new Error(t("nenhum PID encontrado com essas restrições"));
}

function checkIvs(values: Record<string, unknown>): StatValues {
  const out = {} as StatValues;
  for (const stat of STATS) {
    const value = pyInt(values[stat]);
    if (!(value >= 0 && value <= 31)) throw new Error(t("IV {stat}={value} fora de 0 a 31", { stat, value: pyStr(values[stat]) }));
    out[stat] = value;
  }
  return out;
}

function checkEvs(values: Record<string, unknown>): StatValues {
  const out = {} as StatValues;
  for (const stat of STATS) {
    const value = pyInt(values[stat]);
    if (!(value >= 0 && value <= MAX_EV)) throw new Error(t("EV {stat}={value} fora de 0 a {max}", { stat, value: pyStr(values[stat]), max: MAX_EV }));
    out[stat] = value;
  }
  const total = STATS.reduce((sum, k) => sum + out[k], 0);
  if (total > MAX_TOTAL_EVS) throw new Error(t("soma dos EVs {total}, máximo {max}", { total, max: MAX_TOTAL_EVS }));
  return out;
}

function checkMoves(values: readonly unknown[]): number[] {
  const moves = values.filter(pyTruthy).map(pyInt);
  if (!moves.length) throw new Error(t("escolha pelo menos um move"));
  if (moves.length > 4) throw new Error(t("no máximo 4 moves"));
  if (new Set(moves).size !== moves.length) throw new Error(t("move repetido"));
  for (const move of moves) {
    if (!(move > 0 && move < validate.MOVES_COUNT)) throw new Error(t("move {move} inexistente", { move }));
  }
  return moves;
}

/**
 * `build` fields, with the Python names. Missing or null keeps the base value or uses the game default. `nature` is
 * the index, `gender` 'M' or 'F', `ability` 0 or 1, `letter` 0 to 27.
 */
export interface BuildFields {
  species?: number | null;
  level?: number | null;
  nature?: number | null;
  shiny?: boolean | null;
  gender?: string | null;
  ability?: number | null;
  letter?: number | null;
  pid?: number | null;
  ivs?: Record<string, unknown> | null;
  evs?: Record<string, unknown> | null;
  moves?: readonly unknown[] | null;
  nickname?: string | null;
  ot_name?: string | null;
  ot_gender?: number | null;
  tid?: number | null;
  sid?: number | null;
  held_item?: number | null;
  ball?: number | null;
  met_level?: number | null;
  met_location?: number | null;
  met_game?: number | null;
  language?: number | null;
  friendship?: number | null;
  /** Pokérus byte: strain in the high 4 bits, days in the low 4. */
  pokerus?: number | null;
  fateful?: boolean | null;
  /** Bits 0 to 26 of the ribbons field (gen3/ribbons.ts). */
  ribbons?: number | null;
  /** False: no automatic choice of met location and level (default: true). */
  auto_met?: boolean | null;
  party?: boolean | null;
  version?: string | null;
}

const DEFAULT_SETTERS = {
  ot_gender: "otGender", held_item: "heldItem", ball: "ball", met_level: "metLevel", met_location: "metLocation",
  met_game: "metGame", language: "language", friendship: "friendship",
} as const;

/** Note about the encounter the site picked. picked: "both", "level" (location given) or "location" (level given). */
function metNote(species: number, speciesName: string, game: number, level: number, location: number, metLevel: number,
  picked: "both" | "level" | "location", egg: boolean): string {
  const place = speciesData.mapSection(location).replaceAll("_", " ");
  const names = { location: place, species: speciesName, game: validate.GAME_NAMES.get(game) ?? String(game), level };
  if (metLevel === 0) {
    if (picked === "location") return t("Local de encontro escolhido pelo site: {location}, onde fica a única Day Care do FR/LG que gera ovos.", names);
    const reason = egg ? t("porque um dos moves só vem de ovo")
      : !encounters.sightings(species, game).length ? t("porque {species} não aparece no {game}: só chega por ovo, de pais trazidos de outro jogo para a Day Care", names)
      : picked === "level" ? t("porque {species} não aparece em {location} de outro jeito até o nível {level}", names)
      : t("porque no {game} {species} só aparece acima do nível {level}", names);
    if (picked === "level") return t("Nível de encontro escolhido pelo site: 0, como ovo chocado em {location}, {reason}.", { ...names, reason });
    return t("Encontro escolhido pelo site: ovo chocado em {location} (nível de encontro 0), {reason}.", { ...names, reason });
  }
  const member = encounters.who(species, game, location, metLevel);
  const who = member === null || member === species ? speciesName : t("{member} (antes de evoluir)", { member: speciesData.info(member).name });
  const found = { ...names, level: metLevel, who };
  if (picked === "level") return t("Nível de encontro escolhido pelo site: {level}, o nível em que o jogo dá {who} em {location}.", found);
  if (picked === "location") return t("Local de encontro escolhido pelo site: {location}, onde o jogo dá {who} no nível {level}.", found);
  return t("Encontro escolhido pelo site: {location}, nível de encontro {level}, onde o jogo dá {who}.", found);
}

/** Creates (without `base`) or edits a Pokémon. Returns the decrypted Pokémon and notes about what was decided. */
export function build(fields: BuildFields, base: Pk3 | null = null, random?: Random16): [Pk3, string[]] {
  const notes: string[] = [];
  const creating = base === null;
  const old = base;
  let mon = creating ? new Pk3(new Uint8Array(pyTruthy(fields.party) ? PARTY_SIZE : BOX_SIZE)) : new Pk3(base.data);
  if (given(fields.party) && !creating) {
    if (pyTruthy(fields.party) && !mon.isParty) {
      const data = new Uint8Array(PARTY_SIZE);
      data.set(mon.data);
      mon = new Pk3(data);
    } else if (!pyTruthy(fields.party) && mon.isParty) mon = mon.toBox();
  }

  const species = given(fields.species) ? fields.species : creating ? null : mon.species;
  if (species === null || !validate.validSpecies(species) || species === validate.SPECIES_EGG) {
    throw new Error(t("espécie {species} inexistente", { species: species ?? "None" }));
  }
  const oldLevel = creating || !validate.validSpecies(old!.species) ? null : speciesData.monLevel(old!);
  const level = given(fields.level) ? fields.level : oldLevel;
  if (level === null) throw new Error(t("informe o nível"));
  if (!(level >= 1 && level <= 100)) throw new Error(t("nível {level} fora de 1 a 100", { level }));

  const tid = given(fields.tid) ? fields.tid : creating ? 0 : mon.tid;
  const sid = given(fields.sid) ? fields.sid : creating ? 0 : mon.sid;
  for (const [name, value] of [["TID", tid], ["SID", sid]] as const) {
    if (!(value >= 0 && value <= 0xffff)) throw new Error(t("{name} {value} fora de 0 a 65535", { name, value }));
  }

  const metGame = given(fields.met_game) ? pyInt(fields.met_game)
    : !creating ? mon.metGame
    : typeof fields.version === "string" && Object.hasOwn(VERSIONS, fields.version) ? VERSIONS[fields.version] : VERSIONS.firered;

  // PID: explicit, kept from the base if it still fits, or random. Unown with no requested letter at a Tanoby
  // location: only that chamber's letters (encounters.unownLetters).
  const want: PidWanted = { nature: fields.nature, shiny: fields.shiny, gender: fields.gender, ability: fields.ability, letter: fields.letter };
  if (species === UNOWN && !given(fields.letter) && given(fields.met_location)) want.letters = encounters.unownLetters(metGame, pyInt(fields.met_location));
  if (given(want.nature) && !(want.nature >= 0 && want.nature < NUM_NATURES)) {
    throw new Error(t("nature {nature} inexistente", { nature: want.nature }));
  }
  let pid: number;
  if (given(fields.pid)) pid = fields.pid >>> 0;
  else if (!creating && pidOk(mon.personality, species, tid, sid, want)) pid = mon.personality;
  else {
    pid = choosePid(species, tid, sid, want, random ?? systemRandom());
    notes.push(t("PID sorteado pelo site: {pid} (nature {nature}).", { pid: hexUpper(pid, 8), nature: NATURES[pid % NUM_NATURES] }));
  }
  mon.personality = pid;
  mon.otId = ((sid << 16) | tid) >>> 0;

  mon.hasSpecies = true;
  const speciesChanged = !creating && species !== old!.species;
  mon.species = species;
  if (creating || level !== oldLevel || speciesChanged) mon.experience = speciesData.expTable(species)[level];

  const entry = speciesData.info(species);
  if (entry.abilities[1]) mon.abilityNum = given(fields.ability) ? Number(fields.ability) : pid & 1;
  else mon.abilityNum = 0;

  if (given(fields.ivs)) mon.ivs = checkIvs(fields.ivs);
  if (given(fields.evs)) mon.evs = checkEvs(fields.evs);

  let moves: readonly unknown[] | null | undefined = fields.moves;
  if (!given(moves) && (creating || speciesChanged)) moves = initialMoves(species, level);
  if (given(moves)) {
    const chosen = checkMoves(moves);
    const previous = new Map<number, number>();
    if (!creating) mon.moves.forEach((m, i) => previous.set(m, mon.pp[i]));
    const padded = [...chosen, 0, 0, 0, 0].slice(0, 4);
    mon.moves = padded;
    mon.pp = padded.map((m) => (m ? previous.get(m) ?? speciesData.data().move_pp[m] : 0));
  }

  const speciesName = entry.name;
  if (fields.nickname) mon.nickname = fields.nickname;
  else if (creating || (speciesChanged && mon.nickname === speciesData.info(old!.species).name)) mon.nickname = speciesName;
  if (fields.ot_name) mon.otName = fields.ot_name;
  else if (creating) throw new Error(t("informe o nome do treinador (OT)"));

  let metLocation = MAPSEC_PALLET_TOWN, metLevel = level;
  // The encounter is picked on creation, on species change and when a location is given without a level. auto_met false:
  // a blank location becomes the game's first one and a blank level the current.
  const autoMet = !given(fields.auto_met) || pyTruthy(fields.auto_met);
  if (!autoMet) metLocation = (validate.metLocations(metGame) ?? [MAPSEC_PALLET_TOWN])[0];
  const repick = creating || speciesChanged || given(fields.met_location);
  let auto: [number, number] | null = null;
  if (autoMet && repick && (!given(fields.met_location) || !given(fields.met_level))) {
    // Egg moves only exist on a hatched Pokémon: with one of them, the picked encounter is the egg.
    const eggOnly = speciesData.eggOnlyMoves(species, level);
    const egg = mon.moves.some((m) => m && eggOnly.has(m));
    const givenLocation = given(fields.met_location) ? pyInt(fields.met_location) : null;
    const givenLevel = given(fields.met_level) ? pyInt(fields.met_level) : null;
    auto = encounters.defaultMet(species, metGame, level, givenLocation, egg, givenLevel, species === UNOWN ? unownLetter(pid) : null);
    if (auto) {
      [metLocation, metLevel] = auto;
      const picked = givenLocation === null && givenLevel === null ? "both" : givenLevel === null ? "level" : "location";
      if (!(picked === "level" && metLevel === level)) notes.push(metNote(species, speciesName, metGame, level, metLocation, metLevel, picked, egg));
    }
  }
  const defaults: Record<keyof typeof DEFAULT_SETTERS, number> = {
    ot_gender: 0, held_item: 0, ball: ITEM_POKE_BALL, met_level: metLevel, met_location: metLocation,
    met_game: VERSIONS.firered, language: LANGUAGE_ENGLISH, friendship: entry.friendship,
  };
  const target = mon as unknown as Record<string, number>;
  for (const [key, setter] of Object.entries(DEFAULT_SETTERS) as [keyof typeof DEFAULT_SETTERS, string][]) {
    let value: unknown = fields[key];
    if (!given(value) && (creating || (auto !== null && (key === "met_location" || key === "met_level")))) value = defaults[key];
    if (given(value)) target[setter] = pyInt(value);
  }
  if (creating && typeof fields.version === "string" && Object.hasOwn(VERSIONS, fields.version) && !given(fields.met_game)) {
    mon.metGame = VERSIONS[fields.version];
  }

  if (given(fields.pokerus)) {
    const value = pyInt(fields.pokerus);
    if (!(value >= 0 && value <= 0xff)) throw new Error(t("Pokérus {value} fora de 0 a 255", { value: pyStr(fields.pokerus) }));
    mon.pokerus = value;
  }
  if (given(fields.ribbons)) {
    const value = pyInt(fields.ribbons);
    if (!(value >= 0 && value <= ribbonData.MASK)) throw new Error(t("ribbons {value} fora do campo", { value }));
    mon.ribbons = value;
  }
  if (given(fields.fateful)) mon.fateful = pyTruthy(fields.fateful);
  else if ((creating || speciesChanged) && validate.FATEFUL_SPECIES.includes(species) && !mon.fateful) {
    mon.fateful = true;
    notes.push(t("Marca de evento ligada pelo site: sem ela, {name} não obedece nem pode ser trocado.", { name: speciesName }));
  } else if (creating && !mon.fateful && encounters.sightings(species, mon.metGame).some((s) => s[0] === mon.metLocation && s[3] === "event")) {
    // Event encounter (Lugia, Ho-Oh and Deoxys on the islands): the game creates it with the flag (CreateEventMon).
    mon.fateful = true;
    notes.push(t("Marca de evento ligada pelo site: {name} sai do evento com ela.", { name: speciesName }));
  }

  if (mon.isParty) {
    const stats = speciesData.monStats(mon, level);
    const keepHp = !creating && old!.isParty && old!.stats.hp === stats.hp;
    mon.setParty(level, stats, keepHp ? old!.stats.current_hp : null);
  }

  mon.updateChecksum();
  if (species === UNOWN) notes.push(t("letra do Unown pelo PID: {letter}", { letter: UNOWN_LETTERS[unownLetter(pid)] }));
  return [mon, notes];
}
