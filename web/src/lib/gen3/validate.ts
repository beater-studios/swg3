// Basic pk3 validation: rejects data the game would not generate or that could corrupt a save. Port of src/swg3/gen3/validate.py.
// Not a full legality checker. Decomp limits: include/constants/{species,moves,items,global,pokemon}.h.

import speciesTsv from "@data/species.tsv?raw";
import { t } from "../../i18n";
import { STATS, checksum, type Pk3, type StatValues } from "./pk3";
import * as encounters from "./encounters";
import * as ribbonData from "./ribbons";
import * as speciesData from "./species";
import { UNOWN, UNOWN_LETTERS, unownLetter } from "./wild";

export const SPECIES_EGG = 412;
export const MOVES_COUNT = 355;
export const ITEMS_COUNT = 375;
export const MAX_BALL = 12; // ITEM_PREMIER_BALL
export const ITEM_POKE_BALL = 4;
export const MAX_LEVEL = 100;
export const MAX_TOTAL_EVS = 510;
// include/constants/region_map_sections.h and include/constants/version.h
export const KANTO_MAPSEC_START = 88;
export const MAPSEC_SPECIAL_AREA = 196;
export const METLOC_SPECIAL_EGG = 0xfd;
export const RSE_GAMES: readonly number[] = [1, 2, 3];
export const FRLG_GAMES: readonly number[] = [4, 5];
export const EMERALD = 3;
// Emerald-only sections (pokeemerald, src/data/region_map/region_map_sections.json): AQUA_HIDEOUT to TRAINER_HILL.
export const EMERALD_MAPSEC_START = 197;
export const EMERALD_MAPSEC_END = 212;
// Emerald's Battle Frontier (MAPSEC_BATTLE_FRONTIER, pokeemerald) reuses the number of Ruby and Sapphire's Battle Tower
// (MAPSEC_BATTLE_TOWER, 0x3A in pokeruby), where there are no Pokémon to encounter or receive.
export const MAPSEC_BATTLE_FRONTIER = 0x3a;
export const METLOC_SPECIALS: readonly number[] = [0xfd, 0xfe, 0xff]; // egg, in-game trade, event

const range = (start: number, end: number) => Array.from({ length: end - start }, (_, i) => start + i);

/** Met locations that exist in the origin game (plus egg, trade and event); null when unknown (Colosseum/XD). */
export function metLocations(game: number): number[] | null {
  let regions: number[];
  if (FRLG_GAMES.includes(game)) regions = range(KANTO_MAPSEC_START, MAPSEC_SPECIAL_AREA + 1);
  else if (game === EMERALD) regions = [...range(0, KANTO_MAPSEC_START), ...range(EMERALD_MAPSEC_START, EMERALD_MAPSEC_END + 1)];
  else if (RSE_GAMES.includes(game)) regions = range(0, KANTO_MAPSEC_START);
  else return null;
  return [...regions, ...METLOC_SPECIALS];
}
export const LANGUAGES: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 7]); // 6 (Korean) is unused
export const GAME_COLOSSEUM_XD = 15;
export const GAME_NAMES: ReadonlyMap<number, string> = new Map([
  [1, "Sapphire"], [2, "Ruby"], [3, "Emerald"], [4, "FireRed"], [5, "LeafGreen"], [15, "Colosseum/XD"],
]);
// Species that only obey and can only be traded with the fateful flag: IsBattlerModernFatefulEncounter in
// src/battle_util.c and IsDeoxysOrMewUntradable in src/trade.c.
export const SPECIES_MEW = 151;
export const SPECIES_DEOXYS = 410;
export const FATEFUL_SPECIES: readonly number[] = [SPECIES_MEW, SPECIES_DEOXYS];

let names: Map<number, string> | undefined;

export function speciesNames(): Map<number, string> {
  names ??= new Map(
    speciesTsv.split("\n").filter(Boolean).map((line) => {
      const [id, name] = line.split("\t");
      return [Number(id), name] as [number, string];
    }),
  );
  return names;
}

export function validSpecies(species: number): boolean {
  const name = speciesNames().get(species);
  return name !== undefined && species > 0 && species < SPECIES_EGG && !name.startsWith("OLD_UNOWN");
}

/** error and warning are problems; note is informational only (e.g. hatched from an egg). */
export type IssueLevel = "error" | "warning" | "note";

export interface Issue {
  level: IssueLevel;
  field: string;
  message: string;
}

const hex4 = (value: number) => `0x${value.toString(16).padStart(4, "0")}`;
// Same text as a Python tuple: "(33, 45, 0, 0)".
const tuple = (values: readonly number[]) => `(${values.join(", ")})`;

export function check(mon: Pk3): Issue[] {
  const issues: Issue[] = [];
  const error = (field: string, message: string) => issues.push({ level: "error", field, message });
  const warn = (field: string, message: string) => issues.push({ level: "warning", field, message });
  const note = (field: string, message: string) => issues.push({ level: "note", field, message });

  if (!mon.checksumOk) {
    error("checksum", t("gravado {stored}, calculado {computed}", { stored: hex4(mon.storedChecksum), computed: hex4(checksum(mon.data)) }));
  }
  if (mon.isBadEgg) error("flags", t("marcado como Bad Egg"));
  // Eggs store the real species with the isEgg flag; SPECIES_EGG (412) only exists for display.
  if (!validSpecies(mon.species) || mon.species === SPECIES_EGG) {
    error("species", t("espécie {species} inexistente", { species: mon.species }));
  }
  if (mon.hasSpecies !== (mon.species !== 0)) warn("flags", t("flag hasSpecies não bate com a espécie"));
  if (!LANGUAGES.has(mon.language)) error("language", t("idioma {language} inválido", { language: mon.language }));
  if (mon.heldItem >= ITEMS_COUNT) error("held_item", t("item {item} inexistente", { item: mon.heldItem }));
  else if (mon.heldItem && !speciesData.holdable(mon.heldItem)) {
    warn("held_item", t("{item} não pode ser segurado (key item ou HM)", { item: speciesData.itemName(mon.heldItem) }));
  }

  const all = mon.moves;
  const moves = all.filter((m) => m);
  if (!moves.length) error("moves", t("nenhum move"));
  if (all.some((m) => m >= MOVES_COUNT)) error("moves", t("move inexistente em {moves}", { moves: tuple(all) }));
  if (new Set(moves).size !== moves.length) error("moves", t("move repetido em {moves}", { moves: tuple(all) }));
  if (all[0] === 0 && moves.length) warn("moves", t("primeiro slot vazio com moves depois"));

  const evs = mon.evs;
  const total = STATS.reduce((sum, k) => sum + evs[k], 0);
  if (total > MAX_TOTAL_EVS) error("evs", t("soma {total}, máximo {max}", { total, max: MAX_TOTAL_EVS }));

  if (!(mon.ball >= 1 && mon.ball <= MAX_BALL)) error("ball", t("bola {ball} inválida", { ball: mon.ball }));
  if (mon.metLevel > MAX_LEVEL) error("met_level", t("nível de encontro {level}", { level: mon.metLevel }));
  // Met location within the origin game's region (include/constants/region_map_sections.h, metLocations).
  if (!mon.isEgg && mon.metLocation < METLOC_SPECIAL_EGG) {
    const loc = mon.metLocation, game = mon.metGame;
    const allowed = metLocations(game);
    if (FRLG_GAMES.includes(game) && loc < KANTO_MAPSEC_START)
      warn("met_location", t("local de Hoenn num Pokémon marcado como do FireRed ou LeafGreen"));
    else if (RSE_GAMES.includes(game) && loc >= KANTO_MAPSEC_START && loc <= MAPSEC_SPECIAL_AREA)
      warn("met_location", t("local de Kanto num Pokémon marcado como do Ruby, Sapphire ou Emerald"));
    else if (RSE_GAMES.includes(game) && game !== EMERALD && loc >= EMERALD_MAPSEC_START && loc <= EMERALD_MAPSEC_END)
      warn("met_location", t("local só do Emerald num Pokémon marcado como do Ruby ou Sapphire"));
    else if (RSE_GAMES.includes(game) && game !== EMERALD && loc === MAPSEC_BATTLE_FRONTIER)
      warn("met_location", t("Battle Frontier num Pokémon marcado como do Ruby ou Sapphire: lá esse local é a Battle Tower, onde não se encontra Pokémon"));
    else if (allowed !== null && !allowed.includes(loc))
      warn("met_location", t("local de encontro {location} não existe no {game}", { location: loc, game: GAME_NAMES.get(game)! }));
  }

  checkExtras(mon, warn);

  const texts: [string, Uint8Array, string][] = [
    ["nickname", mon.data.subarray(0x08, 0x12), mon.nickname],
    ["ot_name", mon.data.subarray(0x14, 0x1b), mon.otName],
  ];
  for (const [field, raw, text] of texts) {
    if (text.includes("\\x")) error(field, t("caractere fora da tabela do jogo"));
    if (raw[0] === 0xff) error(field, t("vazio"));
  }

  if (mon.isParty) {
    if (!(mon.level >= 1 && mon.level <= MAX_LEVEL)) error("level", t("nível {level}", { level: mon.level }));
    const stats = mon.stats;
    if (STATS.some((k) => stats[k] === 0)) error("stats", t("stat zerado na party"));
    if (stats.current_hp > stats.hp) error("stats", t("HP atual maior que o máximo"));
  }

  if (validSpecies(mon.species)) checkSpeciesData(mon, error, warn, note);
  return issues;
}

type Warn = (field: string, message: string) => void;

function checkExtras(mon: Pk3, warn: Warn) {
  const game = mon.metGame;
  const gameName = GAME_NAMES.get(game) ?? String(game);
  // In FR/LG Pokérus is never caught, spread or cured (RandomlyGivePartyPokerus, PartySpreadPokerus and
  // UpdatePartyPokerusTime are empty in src/pokemon.c): it only reaches a Pokémon that was in Ruby, Sapphire or Emerald.
  if (mon.pokerus && ribbonData.FRLG.includes(game)) {
    warn("pokerus", t("Pokérus num Pokémon do {game}: esse jogo não passa o Pokérus, só vale se ele esteve em Ruby, Sapphire ou Emerald", { game: gameName }));
  }
  // Pokérus byte (pokeemerald src/pokemon.c, RandomlyGivePartyPokerus): strain 1 to 15 (never 0 or 8), days start at
  // strain % 4 + 1 and only go down (UpdatePartyPokerusTime); PartySpreadPokerus copies the whole byte.
  const strain = mon.pokerus >> 4, days = mon.pokerus & 0xf;
  if (mon.pokerus && (strain % 8 === 0 || days > (strain % 4) + 1)) {
    warn("pokerus", t("Pokérus {value} que o jogo não gera (cepa {strain}, {days} dia(s))", { value: `0x${mon.pokerus.toString(16).toUpperCase().padStart(2, "0")}`, strain, days }));
  }
  if (FATEFUL_SPECIES.includes(mon.species) && !mon.fateful) {
    warn("fateful", t("sem a marca de evento: no FR/LG e no Emerald, não obedece em batalha e o jogo não deixa trocar"));
  }

  const ribbons = ribbonData.decode(mon.ribbons);
  const allowed = ribbonData.available(game);
  for (const key of ribbonData.CONTEST) {
    const rank = ribbons.contest[key];
    if (rank > ribbonData.CONTEST_MAX) {
      warn("ribbons", t("{name} Ribbon com valor {value} (máximo {max})", { name: ribbonData.NAMES[key], value: rank, max: ribbonData.CONTEST_MAX }));
    }
  }
  if (Object.values(ribbons.contest).some(Boolean) && !allowed.includes("contest")) {
    warn("ribbons", t("ribbons de concurso num Pokémon do {game}: só valem se ele esteve em Ruby, Sapphire ou Emerald", { game: gameName }));
  }
  for (const key of ribbons.flags) {
    if (ribbonData.NEVER.includes(key)) warn("ribbons", t("{name} Ribbon nunca foi distribuída", { name: ribbonData.NAMES[key] }));
    else if (!allowed.includes(key)) {
      warn("ribbons", t("{name} Ribbon não sai no {game}: só vale se o Pokémon passou por um jogo que dá essa ribbon", { name: ribbonData.NAMES[key], game: gameName }));
    }
  }
  if (ribbons.unused) warn("ribbons", t("bits de ribbon sem uso ligados"));
}

export const STAT_LABELS: Record<(typeof STATS)[number], string> = {
  hp: "HP", attack: "Atk", defense: "Def", speed: "Spe", sp_attack: "SpA", sp_defense: "SpD",
};

const statText = (stats: StatValues) => STATS.map((k) => `${STAT_LABELS[k]} ${stats[k]}`).join(", ");

type Report = (field: string, message: string) => void;

/**
 * Fateful flag against the encounter: the island events (seteventmon, CreateEventMon in src/pokemon.c) set it; other
 * FR/LG encounters never do. Hatched eggs and the event location (0xFF) are skipped: a Mystery Gift egg may have it.
 */
function checkEvent(mon: Pk3, speciesName: string, warn: Report) {
  if (mon.metLevel === 0 || mon.metLocation === encounters.METLOC_FATEFUL_ENCOUNTER) return;
  const here = encounters.sightings(mon.species, mon.metGame).filter((s) => s[0] === mon.metLocation);
  const event = here.some((s) => s[3] === "event");
  const location = speciesData.mapSection(mon.metLocation, mon.metGame).replaceAll("_", " ");
  if (event && !mon.fateful) warn("fateful", t("{species} de {location} sai do evento com a marca de evento, e este está sem", { species: speciesName, location }));
  else if (mon.fateful && here.length && !event) {
    warn("fateful", t("marca de evento num {species} de {location}, que no {game} não sai com ela", { species: speciesName, location, game: GAME_NAMES.get(mon.metGame)! }));
  }
}

// Unown letter (from the PID, GET_UNOWN_LETTER) against the met location's Tanoby chamber: each chamber only gives
// the letters of its slots (sUnownLetterSlots in src/wild_encounter.c, encounters.unownLetters).
function checkUnown(mon: Pk3, warn: Report) {
  if (mon.species !== UNOWN) return;
  const letters = encounters.unownLetters(mon.metGame, mon.metLocation);
  const letter = unownLetter(mon.personality);
  if (letters !== null && !letters.includes(letter)) {
    warn("pid", t("letra {letter} do Unown não sai em {location}: lá saem {letters}. A letra vem do PID.", {
      letter: UNOWN_LETTERS[letter], letters: letters.map((i) => UNOWN_LETTERS[i]).join(", "),
      location: speciesData.mapSection(mon.metLocation, mon.metGame).replaceAll("_", " "),
    }));
  }
}

function checkEncounter(mon: Pk3, speciesName: string, warn: Report) {
  const problem = encounters.check(mon.species, mon.metGame, mon.metLocation, mon.metLevel);
  if (!problem) return;
  const [kind, levels] = problem;
  const fields = {
    species: speciesName, game: GAME_NAMES.get(mon.metGame)!, level: mon.metLevel,
    location: speciesData.mapSection(mon.metLocation, mon.metGame).replaceAll("_", " "), levels,
  };
  if (kind === "trade") warn("met_location", t("{species} não vem de nenhuma troca no jogo do {game}", fields));
  else if (kind === "egg") warn("met_level", t("0 marca o Pokémon como chocado de ovo, mas {species} não sai de ovo.", fields));
  else if (kind === "place") warn("met_location", t("{species} não aparece em {location} no {game}; só se veio de um evento.", fields));
  else warn("met_level", t("{level} não bate com {location}: lá, {species} aparece no nível {levels}.", fields));
}

function checkSpeciesData(mon: Pk3, error: Report, warn: Report, note: Report) {
  const entry = speciesData.info(mon.species);
  const table = speciesData.expTable(mon.species);
  if (mon.experience > table[MAX_LEVEL]) {
    error("experience", t("{experience} acima do máximo {max}", { experience: mon.experience, max: table[MAX_LEVEL] }));
  }
  const level = speciesData.monLevel(mon);
  if (mon.metLevel && !mon.isEgg && mon.metLevel > level)
    warn("met_level", t("encontrado no nível {met}, acima do nível atual ({level})", { met: mon.metLevel, level }));
  if (mon.isParty) {
    if (mon.level !== level) error("level", t("nível {level}, mas a experiência dá {expected}", { level: mon.level, expected: level }));
    const expected = speciesData.monStats(mon, level);
    const stats = mon.stats;
    const got = Object.fromEntries(STATS.map((k) => [k, stats[k]])) as StatValues;
    if (STATS.some((k) => got[k] !== expected[k])) {
      warn("stats", t("stats {got} diferem do cálculo {expected}; o jogo recalcula", { got: statText(got), expected: statText(expected) }));
    }
  }

  const allowed = metLocations(mon.metGame);
  if (!mon.isEgg && allowed !== null && allowed.includes(mon.metLocation)) {
    checkEncounter(mon, entry.name, warn);
    checkUnown(mon, warn);
    checkEvent(mon, entry.name, warn);
  }
  if (!mon.isEgg && encounters.VERSIONS[mon.metGame] && mon.metLevel === 0) {
    if (encounters.sightings(mon.species, mon.metGame).length) note("met_level", t("0, porque o Pokémon está marcado como chocado de ovo: é assim que o jogo registra quem nasceu de um ovo."));
    else {
      note("met_level", t("0, porque o Pokémon está marcado como chocado de ovo. {species} não aparece no {game}, então esse é o único jeito de ter um: de um ovo, com pais trazidos de outro jogo para a Day Care.",
        { species: entry.name, game: GAME_NAMES.get(mon.metGame)! }));
    }
  }
  // A hatched egg always comes in a Poké Ball, with met level 0 (src/daycare.c, on hatching).
  if (!mon.isEgg && allowed !== null && mon.metLevel === 0 && mon.ball !== ITEM_POKE_BALL) {
    warn("ball", t("o Pokémon está marcado como chocado de ovo (nível de encontro 0), e ovo sempre choca em Poké Ball."));
  }

  const hasSecond = entry.abilities[1] !== 0;
  if (mon.abilityNum && !hasSecond) warn("ability", t("2ª Ability marcada, mas a espécie só tem uma"));
  else if (hasSecond && mon.abilityNum !== (mon.personality & 1)) warn("ability", t("Ability não bate com o PID (o jogo usa PID & 1)"));

  const hatched = mon.metLevel === 0;
  // Form it was caught or received as (encounters.who): it never was the earlier pre-evolutions, so moves only they
  // learn do not count (a Pidgeotto caught at 25 was never a Pidgey at 47).
  const caught = !hatched && allowed !== null && allowed.includes(mon.metLocation)
    ? encounters.who(mon.species, mon.metGame, mon.metLocation, mon.metLevel) : null;
  const learnable = speciesData.learnableMoves(mon.species, level, hatched, caught);
  const foreign = mon.moves.filter((m) => m && !learnable.has(m));
  const names = (list: number[]) => list.map(speciesData.moveName).join(", ");
  if (foreign.length && !mon.isEgg) {
    const eggOnly = hatched ? new Set<number>() : speciesData.eggOnlyMoves(mon.species, level);
    const fromEgg = foreign.filter((m) => eggOnly.has(m));
    let others = foreign.filter((m) => !eggOnly.has(m));
    if (fromEgg.length) {
      warn("moves", t("{names} só vem de ovo, e o Pokémon não foi chocado (o nível de encontro é {met}, não 0).", { met: mon.metLevel, names: names(fromEgg) }));
    }
    const everyone = speciesData.learnableMoves(mon.species, level, false);
    const before = others.filter((m) => everyone.has(m));
    others = others.filter((m) => !everyone.has(m));
    if (before.length) {
      warn("moves", t("{names}: só a pré-evolução aprende, e o Pokémon foi pego já como {caught} (nível de encontro {met}), então nunca foi ela.",
        { names: names(before), caught: speciesData.info(caught!).name, met: mon.metLevel }));
    }
    const emerald = speciesData.emeraldTutorMoves(mon.species, caught);
    const tutor = others.filter((m) => emerald.has(m));
    others = others.filter((m) => !emerald.has(m));
    if (tutor.length) {
      note("moves", t("{names} só vem do tutor do Emerald: vale se o Pokémon passou pelo Emerald por troca.", { names: names(tutor) }));
    }
    const xd = speciesData.xdTutorMoves(mon.species, caught);
    const xdTutor = others.filter((m) => xd.has(m));
    others = others.filter((m) => !xd.has(m));
    if (xdTutor.length) {
      if (mon.metGame === GAME_COLOSSEUM_XD) note("moves", t("{names} vem do tutor do XD.", { names: names(xdTutor) }));
      else note("moves", t("{names} só vem do tutor do XD: vale se o Pokémon passou pelo XD por troca.", { names: names(xdTutor) }));
    }
    if (others.length) {
      warn("moves", t("{names} não está no que a espécie aprende até o nível {level} (por nível, TM, tutor ou pré-evolução); só se veio de um evento.", { level, names: names(others) }));
    }
  }
  // Hatched with egg moves: they all come from the same father, who had to know all of them at once.
  if (hatched && !mon.isEgg) {
    const eggOnly = speciesData.eggOnlyMoves(mon.species, level);
    const eggs = [...new Set(mon.moves.filter((m) => m && eggOnly.has(m)))].sort((a, b) => a - b);
    if (eggs.length && speciesData.eggFather(mon.species, eggs) === null) {
      if (eggs.length === 1) warn("moves", t("{names} é golpe de ovo, mas nenhum pai que cruza com {species} consegue ter ele.", { names: names(eggs), species: entry.name }));
      else warn("moves", t("{names} são golpes de ovo, e nenhum pai que cruza com {species} consegue ter todos ao mesmo tempo, então não saem juntos do mesmo ovo.", { names: names(eggs), species: entry.name }));
    }
  }
}

export function isValid(mon: Pk3): boolean {
  return !check(mon).some((issue) => issue.level === "error");
}
