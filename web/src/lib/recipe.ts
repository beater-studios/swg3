// Recipe: a JSON file that tells the PC script what to do with the ESP32 board, and the player what to do at each step.
// Port of src/swg3/recipe.py. Format v1 in docs/project/recipe.md. An offer with a validation error is rejected: it can corrupt the save.

import { t } from "../i18n";
import { BRAND_NAME, SLUG } from "../brand";
import * as pk3 from "./gen3/pk3";
import { Pk3 } from "./gen3/pk3";
import * as species from "./gen3/species";
import * as validate from "./gen3/validate";
import { fromHex, pyEq, pyRepr, pyStr, toHex } from "./pyfmt";

export const FORMAT = `${SLUG}-recipe`;
export const VERSION = 1;
export const ACTIONS: readonly string[] = ["trade"];
export const GAMES: readonly string[] = ["firered", "leafgreen"];
export const LANGUAGE = "eng";
export const REVISION = 10;

export interface RecipeStep {
  who: "pc" | "player";
  text: string;
}

export interface Recipe {
  format: string;
  version: number;
  created: string;
  game: { title: string; language: string; revision: number };
  action: "trade";
  offer: { format: "pk3"; data: string; species: number; species_name: string; nickname: string; evolves_to: string | null };
  receive: { save_as: string } | null;
  steps: RecipeStep[];
  notes: string[];
}

function checkOffer(mon: Pk3) {
  const errors = validate.check(mon).filter((i) => i.level === "error");
  if (errors.length) {
    throw new Error(t("Pokémon com erro, não dá para oferecer: {errors}", { errors: errors.map((i) => `${i.field}: ${i.message}`).join("; ") }));
  }
}

/** Steps of a trade. The in-game entry point follows pokeldn (trade through the Union Room); not verified here. */
export function tradeSteps(offerName: string, saveAs: string | null, evolvesTo: string | null): RecipeStep[] {
  const steps: RecipeStep[] = [
    { who: "player", text: t("Salve o jogo antes de começar.") },
    { who: "player", text: t("Deixe na party o Pokémon que você vai mandar.") },
    { who: "pc", text: t("Conecte a placa ESP32 e abra esta receita no programa de troca do {name}.", { name: BRAND_NAME }) },
    { who: "player", text: t("Suba ao 2º andar de qualquer Centro Pokémon, fale com a recepcionista do meio e entre na Union Room.") },
    { who: "player", text: t("Fale com o treinador que aparecer na sala (é o PC) e escolha trocar.") },
    { who: "player", text: t("Ofereça o seu Pokémon e aceite {name}.", { name: offerName }) },
    { who: "player", text: t("Espere a animação e o jogo salvar. Não desligue nem saia no meio.") },
  ];
  if (saveAs) steps.push({ who: "pc", text: t("O PC guarda o Pokémon que você mandou em {file}.", { file: saveAs }) });
  if (evolvesTo) steps.push({ who: "player", text: t("Ao chegar, {name} evolui para {target} (evolução por troca).", { name: offerName, target: evolvesTo }) });
  return steps;
}

/** UTC date in the recipe format (strftime "%Y-%m-%dT%H:%M:%SZ"). */
const timestamp = (date: Date) => date.toISOString().replace(/\.\d+Z$/, "Z");

export function trade(mon: Pk3, game: unknown = "firered", saveAs: string | null = null, now?: Date): Recipe {
  if (typeof game !== "string" || !GAMES.includes(game)) {
    throw new Error(t("jogo {game}, esperado {options}", { game: pyRepr(game), options: GAMES.join(t(" ou ")) }));
  }
  const box = mon.isParty ? mon.toBox() : new Pk3(mon.data);
  box.updateChecksum();
  checkOffer(box);
  const name = species.info(box.species).name;
  const target = species.tradeEvolution(box.species, box.heldItem);
  const evolvesTo = target ? species.info(target).name : null;
  const notes = [t("O PC recalcula nível e stats ao montar a troca (a receita leva o formato da box).")];
  if (target && target > species.KANTO_SPECIES_END) {
    notes.push(t("Evolução para espécie de fora de Kanto: sem a Pokédex Nacional o comportamento não está confirmado (não verificado)."));
  }
  return {
    format: FORMAT,
    version: VERSION,
    created: timestamp(now ?? new Date()),
    game: { title: game, language: LANGUAGE, revision: REVISION },
    action: "trade",
    offer: { format: "pk3", data: toHex(box.toRaw()), species: box.species, species_name: name, nickname: box.nickname, evolves_to: evolvesTo },
    receive: saveAs ? { save_as: saveAs } : null,
    steps: tradeSteps(box.nickname || name, saveAs, evolvesTo),
    notes: [...notes, t("Não leve ao Pokémon HOME Pokémon criados ou alterados.")],
  };
}

type Json = Record<string, unknown>;
const isDict = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value);
const pyGet = (value: unknown, key: string) => (isDict(value) && Object.hasOwn(value, key) ? value[key] : null);

/** Python `x or {}` for a value that should be an object. */
function orDict(value: unknown): Json {
  if (isDict(value)) return value;
  if (value === null || value === undefined || value === false || value === 0 || value === "" || (Array.isArray(value) && !value.length)) return {};
  throw new TypeError(`'${typeof value}' object has no attribute 'get'`);
}

export function load(text: string): [recipe: Json, mon: Pk3] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    // The message and line come from JavaScript's JSON parser, not Python's.
    const message = (error as Error).message;
    const position = /position (\d+)/.exec(message);
    const line = position ? text.slice(0, Number(position[1])).split("\n").length : 1;
    throw new Error(t("JSON inválido: {error} (linha {line})", { error: message, line }));
  }
  if (!isDict(data) || data.format !== FORMAT) throw new Error(t("não é uma receita do {name}", { name: BRAND_NAME }));
  if (!pyEq(pyGet(data, "version"), VERSION)) {
    throw new Error(t("versão {version} não suportada (esperado {expected})", { version: pyRepr(pyGet(data, "version")), expected: VERSION }));
  }
  const action = pyGet(data, "action");
  if (typeof action !== "string" || !ACTIONS.includes(action)) throw new Error(t("ação {action} desconhecida", { action: pyRepr(action) }));
  const game = orDict(pyGet(data, "game"));
  const title = pyGet(game, "title");
  if (typeof title !== "string" || !GAMES.includes(title) || pyGet(game, "language") !== LANGUAGE || !pyEq(pyGet(game, "revision"), REVISION)) {
    throw new Error(t("jogo não suportado: {game}", { game: pyStr(game) }));
  }
  const offer = orDict(pyGet(data, "offer"));
  if (pyGet(offer, "format") !== "pk3") throw new Error(t("oferta: esperado pk3"));
  const hexText = Object.hasOwn(offer, "data") ? offer.data : "";
  if (typeof hexText !== "string") throw new TypeError("fromhex() argument must be str");
  const raw = fromHex(hexText);
  if (!raw) throw new Error(t("oferta: dados não são hexadecimais"));
  if (raw.length !== pk3.BOX_SIZE) throw new Error(t("oferta: {size} bytes, esperado {expected}", { size: raw.length, expected: pk3.BOX_SIZE }));
  const mon = Pk3.fromRaw(raw);
  checkOffer(mon);
  if (!pyEq(pyGet(offer, "species"), mon.species)) throw new Error(t("oferta: a espécie declarada não bate com os dados"));
  const receive = Object.hasOwn(data, "receive") ? data.receive : null;
  if (receive !== null && !(isDict(receive) && typeof receive.save_as === "string")) {
    throw new Error(t("receive: esperado {example} ou null", { example: `{"save_as": "${t("arquivo.pk3")}"}` }));
  }
  return [data, mon];
}
