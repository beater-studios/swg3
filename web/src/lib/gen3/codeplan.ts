// Plan to bring a Pokémon into the game without an ESP32, using the community's box name codes. Port of src/swg3/gen3/codeplan.py.
// The catalog summarizes the EmeraldACE_web collection, generator `eng10` (study only, no code copied); limits in docs/research/available-ace-codes.md.
import { N_, t } from "../../i18n";
import { hexUpper, pyRepr } from "../pyfmt";
import { NATURES, STATS, type Pk3 } from "./pk3";
import * as speciesData from "./species";

export const GENERATOR_URL = "https://e-sh4rk.github.io/CodeGenerator/index_frlg.html";
export const BOX14_EXIT_URL = "https://pomeg-letterbombers.github.io/pokemon-ace-notes/frlg-box-14-exit/";
const OLD_GENTLEMAN = N_("falar com o Old Gentleman do Centro Pokémon de Viridian (NPC = 2, padrão do código; não verificado)");

/** A code from the collection. `exit` (when it is prose), `boxes` and `target` are UI text: marked with N_ and translated in `step`. */
export interface Code {
  name: string;
  /** Under EmeraldACE_web/files_frlg/. */
  file: string;
  exit: string;
  /** How many boxes, by where the exit code starts (estimated). */
  boxes: string;
  target: string;
}

const NEAR_11 = N_("cerca de 11");
const PLUS_BOX14 = N_("13, mais a Box 14 já montada");
const BOX10_SLOT19 = N_("Box 10, slot 19");

const code = (name: string, file: string, exit: string, boxes: string, target: string): Code => ({ name, file, exit, boxes, target });

export const CODES = {
  wild: code("Start wild battle with any Pokemon", "pkmn/StartWildBattleWithAnyPokemon.txt", "GrabACEExit", NEAR_11, OLD_GENTLEMAN),
  gift: code("Create any Gift Pokemon (Bootstrapped)", "pkmn/CreateAnyGiftPokemonBootstrapped.txt", "Box 14", PLUS_BOX14, OLD_GENTLEMAN),
  pid_egg: code("Generate egg with any PID", "pkmn/PIDEggFromNothing.txt", "Box 14", PLUS_BOX14, N_("Box 10, slot 2 vazio")),
  read_pid: code("Read Pokemon PID", "pkmn/ReadPIDfromPartySlot4toPartySlot3_SWITCH.txt", "ROM_BX_lr_Box10_Grab", NEAR_11, N_("2º Pokémon da party")),
  read_ids: code("Read Pokemon TID and SID", "pkmn/ReadOTIDfromPartySlot4toPartySlot3_SWITCH.txt", "ROM_BX_lr_Box10_Grab", NEAR_11, N_("2º Pokémon da party")),
  read_ivea: code("Read Pokemon IVEA field", "pkmn/ReadIvea_SWITCH.txt", "GrabACEExit", NEAR_11, N_("1º Pokémon da party (o 2º recebe a saída)")),
  read_evs: code("Read EVs field", "pkmn/ReadEvs_SWITCH.txt", "Box 14", PLUS_BOX14, N_("1º Pokémon da party (o 2º recebe a saída)")),
  exp: code("Change experience", "pkmn/ChangeExp.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
  ivs: code("Change IVs and ability", "pkmn/ChangeIvs.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
  evs: code("Change EVs", "pkmn/ChangeEvs.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
  origin: code("Change Pokerus and Origin Data", "pkmn/ChangePokerusOrigin.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
  teach: code("Teach Pokemon Any Move", "pkmn/TeachPokemonAnyMove.txt", "GrabACEExit", NEAR_11,
    N_("1º Pokémon da party; depois falar com o Old Gentleman do Centro Pokémon de Viridian (NPC = 2, padrão do código; não verificado)")),
  shiny: code("Make any Pokémon Shiny", "pkmn/MakeMonShiny_SWITCH.txt", N_("nenhum (fill = false)"), N_("não indicado"), N_("Box 10, slot 2")),
  item: code("Get any item", "misc/GetAnyItem.txt", "GrabACEExit", NEAR_11, N_("o item vai para o PC")),
} as const satisfies Record<string, Code>;

export type CodeKey = keyof typeof CODES;

export const ORIGIN_GAMES: Readonly<Record<number, string>> = { 1: "Sapphire", 2: "Ruby", 3: "Emerald", 4: "FireRed", 5: "LeafGreen", 15: "Colosseum/XD" };

export type ParamValue = string | number | null;
type Param = [name: string, value: ParamValue, note: string | null];

export interface StepDict {
  code: string;
  file: string;
  exit: string;
  boxes: string;
  target: string;
  params: { name: string; value: ParamValue; note: string | null }[];
  notes: string[];
}

export interface Plan {
  strategy: "wild" | "egg";
  generator: string;
  requirements: string[];
  steps: StepDict[];
  not_covered: string[];
  warnings: string[];
  nature: string;
}

function step(key: CodeKey, params: Param[] = [], notes: string[] = []): StepDict {
  const c: Code = CODES[key];
  return {
    code: c.name, file: c.file, exit: t(c.exit), boxes: t(c.boxes), target: t(c.target),
    params: params.map(([name, value, note]) => ({ name, value, note })),
    notes,
  };
}

const numbered = (name: string, number: number) => t("{name} (número {number})", { name, number });
const speciesLabel = (species: number) => numbered(speciesData.info(species).name, species);
const cur = (source: string) => t("valor atual: ler com {source}", { source });
const pidHex = (mon: Pk3) => `0x${hexUpper(mon.personality, 8)}`;
const NEW_STAT_NAMES = ["hp", "atk", "def", "speed", "spe_atk", "spe_def"];

/**
 * Steps to reach `target` from what the codes can create. strategy: "wild" (wild battle, a legitimate Pokémon with a
 * game PID) or "egg" (egg with `target`'s PID, which keeps nature, gender and ability).
 */
export function plan(target: Pk3, strategy: unknown = "wild"): Plan {
  if (strategy !== "wild" && strategy !== "egg") {
    throw new Error(t("estratégia {strategy}, esperado wild ou egg", { strategy: pyRepr(strategy) }));
  }
  const species = target.species;
  const level = speciesData.monLevel(target);
  const steps: StepDict[] = [];
  const warnings: string[] = [];
  let pidNote: string, idsNote: string;

  if (strategy === "wild") {
    steps.push(step("wild", [
      ["PokemonHex", speciesLabel(species), t("escolha pelo nome no autocomplete do gerador")],
      ["PokemonLV", level, null],
      ["NPC", 2, t("padrão do código")],
    ], [
      target.ball
        ? t("Capture com a {ball}; a bola não muda depois sem outro código.", { ball: speciesData.itemName(target.ball) })
        : t("Capture com a bola que quiser; a bola não muda depois sem outro código."),
      t("A nature sai do jogo. A pedida é {nature}: se precisar dela, use o caminho do ovo.", { nature: target.nature }),
    ]));
    pidNote = cur("Read Pokemon PID");
    idsNote = t("valor atual: ler com {source} (o OT é você)", { source: "Read Pokemon TID and SID" });
    steps.push(step("read_pid", [], [t("Anote o PID: os códigos de alteração pedem ele.")]));
    steps.push(step("read_ids", [], [t("Se você já sabe seu TID e SID, pode pular.")]));
  } else {
    steps.push(step("pid_egg", [
      ["species", speciesLabel(species), t("escolha pelo nome no autocomplete do gerador")],
      ["pid", pidHex(target), `nature ${target.nature}`],
      ["inaccurate_emu", 0, t("0 no Switch")],
    ], [t("O ovo sai com os outros dados quase todos zerados. Choque e confira o resultado antes de seguir. O TID usado pelo código e o que muda ao chocar não estão claros (não verificado).")]));
    pidNote = pidHex(target);
    idsNote = cur("Read Pokemon TID and SID");
    steps.push(step("read_ids", [], [t("Depois de chocar: anote TID e SID do Pokémon.")]));
  }

  const ident: Param[] = [["pid", pidNote, null], ["tid", idsNote, null], ["sid", idsNote, null], ["inaccurate_emu", 0, t("0 no Switch")]];
  steps.push(step("read_ivea", [["pid", pidNote, t("precisa antes de gerar o código")]], [t("Devolve IVs, Ability e o campo codificado usado em Change IVs.")]));
  const evs = target.evs;
  const hasEvs = STATS.some((k) => evs[k]);
  if (hasEvs) steps.push(step("read_evs", [], [t("Devolve os EVs atuais e os campos codificados.")]));

  const exp = target.experience;
  steps.push(step("exp", [...ident,
    ["cur_exp", t("valor atual: tela de resumo (EXP. POINTS)"), null],
    ["new_exp", exp, exp === speciesData.expTable(species)[level] ? t("mínimo do nível {level}", { level }) : null],
  ], [t("Suba de nível no jogo (Rare Candy ou batalha) para os stats e moves acompanharem.")]));

  const ivs = target.ivs;
  const abilities = speciesData.info(species).abilities;
  steps.push(step("ivs", [...ident,
    ["cur_encoded_ivea", cur("Read Pokemon IVEA field"), t("ou os valores atuais um a um")],
    ...STATS.map((stat, i): Param => [`new_${NEW_STAT_NAMES[i]}`, ivs[stat], null]),
    ["new_ability", target.abilityNum, speciesData.abilityName(abilities[target.abilityNum] || abilities[0])],
  ], [t("IVs e Ability são gravados juntos: informe todos.")]));

  if (hasEvs) {
    steps.push(step("evs", [...ident,
      ["cur_encoded_evs1/2/3", cur("Read EVs field"), t("ou os EVs atuais um a um")],
      ...STATS.map((stat, i): Param => [`new_${NEW_STAT_NAMES[i]}`, evs[stat], null]),
    ]));
  }

  steps.push(step("origin", [...ident,
    ["new_loc", `${target.metLocation} (${speciesData.mapSection(target.metLocation)})`, null],
    ["new_met_lvl", target.metLevel, null],
    ["new_origin_game", `${target.metGame} (${ORIGIN_GAMES[target.metGame] ?? "?"})`, null],
    ["new_ball", `${target.ball} (${speciesData.itemName(target.ball)})`, null],
    ["new_ot_gender", target.otGender, t("0 masculino, 1 feminino")],
    ["new_pkrs", `0x${hexUpper(target.pokerus, 2)}`, null],
    ["cur_*", t("valor atual: tela de resumo (local, nível e jogo de encontro, bola)"), null],
  ], [t("Opcional: só se quiser a origem igual à do Pokémon montado.")]));

  target.moves.forEach((move, slot) => {
    if (move) {
      steps.push(step("teach", [
        ["Move", numbered(speciesData.moveName(move), move), t("pelo autocomplete")],
        ["MoveSlot", slot, t("0 a 3")],
        ["NPC", 2, null],
      ]));
    }
  });

  if (target.isShiny) {
    steps.push(step("shiny", [], [
      t("Copia o PID para o OT ID do Pokémon: a nature fica, mas o TID e o SID dele passam a ser as metades do PID e ele conta como Pokémon de troca (obediência e bônus de experiência)."),
      t("Rode por último, porque os códigos anteriores pedem o TID e o SID originais."),
    ]));
    warnings.push(t("Shiny: o TID e o SID do Pokémon no jogo não vão ser os do arquivo."));
  }

  if (target.heldItem) {
    steps.push(step("item", [
      ["item_index", numbered(speciesData.itemName(target.heldItem), target.heldItem), null],
      ["amount", 1, null],
    ], [t("Retire do PC e entregue ao Pokémon pelo menu.")]));
  }

  const notCovered: string[] = [];
  if (strategy === "wild") notCovered.push(t("Nature {nature}: vem da captura (ou use o caminho do ovo).", { nature: target.nature }));
  notCovered.push(
    t("Apelido {nickname}: sem código eng10. O Name Rater (Lavender Town) só renomeia se o OT for você.", { nickname: pyRepr(target.nickname) }),
    t("Nome do OT {name}: sem código eng10.", { name: pyRepr(target.otName) }),
    t("Amizade {friendship}: sem código; sobe jogando.", { friendship: target.friendship }),
  );
  if (!target.isShiny) {
    notCovered.push(t("TID/SID do OT ({tid}/{sid}): sem código eng10 para um Pokémon; o OT será o de quem capturou.", { tid: target.tid, sid: target.sid }));
  }

  return {
    strategy,
    generator: GENERATOR_URL,
    requirements: [
      t("Rota de entrada de ACE feita e conferida com o código de verificação."),
      t("Saída pela Box 14 montada para os códigos marcados como Box 14 ({url}).", { url: BOX14_EXIT_URL }),
      t("Escolher a versão eng10 (English Switch) no gerador."),
      t("Salvar antes de cada código. Box 13 a partir do slot 7 e as boxes seguintes vazias."),
    ],
    steps,
    not_covered: notCovered,
    warnings: [...warnings, t("Não leve ao Pokémon HOME Pokémon criados ou alterados por ACE.")],
    nature: NATURES[target.personality % 25],
  };
}
