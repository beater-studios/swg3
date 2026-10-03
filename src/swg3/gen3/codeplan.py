"""Plan to bring a Pokémon into the game without an ESP32 using the community's published `eng10` codes.

Catalog summarized from the EmeraldACE_web collection (study only, no code copied); limits on the Switch in
docs/research/available-ace-codes.md.
"""

from dataclasses import dataclass, field

from ..i18n import N_, t
from . import species as species_data
from .pk3 import NATURES, STATS, Pk3

GENERATOR_URL = "https://e-sh4rk.github.io/CodeGenerator/index_frlg.html"
BOX14_EXIT_URL = "https://pomeg-letterbombers.github.io/pokemon-ace-notes/frlg-box-14-exit/"
OLD_GENTLEMAN = N_("falar com o Old Gentleman do Centro Pokémon de Viridian (NPC = 2, padrão do código; não verificado)")


@dataclass(frozen=True)
class Code:
    name: str       # as listed in the generator
    file: str       # under EmeraldACE_web/files_frlg/
    exit: str
    boxes: str      # estimated, from the exit code's start
    target: str


NEAR_11 = N_("cerca de 11")
PLUS_BOX14 = N_("13, mais a Box 14 já montada")
BOX10_SLOT19 = N_("Box 10, slot 19")

CODES = {
    "wild": Code("Start wild battle with any Pokemon", "pkmn/StartWildBattleWithAnyPokemon.txt",
                 "GrabACEExit", NEAR_11, OLD_GENTLEMAN),
    "gift": Code("Create any Gift Pokemon (Bootstrapped)", "pkmn/CreateAnyGiftPokemonBootstrapped.txt",
                 "Box 14", PLUS_BOX14, OLD_GENTLEMAN),
    "pid_egg": Code("Generate egg with any PID", "pkmn/PIDEggFromNothing.txt", "Box 14",
                    PLUS_BOX14, N_("Box 10, slot 2 vazio")),
    "read_pid": Code("Read Pokemon PID", "pkmn/ReadPIDfromPartySlot4toPartySlot3_SWITCH.txt",
                     "ROM_BX_lr_Box10_Grab", NEAR_11, N_("2º Pokémon da party")),
    "read_ids": Code("Read Pokemon TID and SID", "pkmn/ReadOTIDfromPartySlot4toPartySlot3_SWITCH.txt",
                     "ROM_BX_lr_Box10_Grab", NEAR_11, N_("2º Pokémon da party")),
    "read_ivea": Code("Read Pokemon IVEA field", "pkmn/ReadIvea_SWITCH.txt", "GrabACEExit", NEAR_11,
                      N_("1º Pokémon da party (o 2º recebe a saída)")),
    "read_evs": Code("Read EVs field", "pkmn/ReadEvs_SWITCH.txt", "Box 14", PLUS_BOX14,
                     N_("1º Pokémon da party (o 2º recebe a saída)")),
    "exp": Code("Change experience", "pkmn/ChangeExp.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
    "ivs": Code("Change IVs and ability", "pkmn/ChangeIvs.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
    "evs": Code("Change EVs", "pkmn/ChangeEvs.txt", "Box 14", PLUS_BOX14, BOX10_SLOT19),
    "origin": Code("Change Pokerus and Origin Data", "pkmn/ChangePokerusOrigin.txt", "Box 14",
                   PLUS_BOX14, BOX10_SLOT19),
    "teach": Code("Teach Pokemon Any Move", "pkmn/TeachPokemonAnyMove.txt", "GrabACEExit", NEAR_11,
                  N_("1º Pokémon da party; depois falar com o Old Gentleman do Centro Pokémon de Viridian "
                     "(NPC = 2, padrão do código; não verificado)")),
    "shiny": Code("Make any Pokémon Shiny", "pkmn/MakeMonShiny_SWITCH.txt", N_("nenhum (fill = false)"),
                  N_("não indicado"), N_("Box 10, slot 2")),
    "item": Code("Get any item", "misc/GetAnyItem.txt", "GrabACEExit", NEAR_11, N_("o item vai para o PC")),
}
ORIGIN_GAMES = {1: "Sapphire", 2: "Ruby", 3: "Emerald", 4: "FireRed", 5: "LeafGreen", 15: "Colosseum/XD"}


@dataclass
class Step:
    key: str
    params: list = field(default_factory=list)   # (name, value or None, note)
    notes: list = field(default_factory=list)

    def as_dict(self) -> dict:
        code = CODES[self.key]
        return {
            "code": code.name, "file": code.file, "exit": t(code.exit), "boxes": t(code.boxes),
            "target": t(code.target),
            "params": [{"name": n, "value": v, "note": note} for n, v, note in self.params],
            "notes": self.notes,
        }


def _species_label(species: int) -> str:
    return _numbered(species_data.info(species)["name"], species)


def _numbered(name: str, number: int) -> str:
    return t("{name} (número {number})", name=name, number=number)


def _cur(source: str) -> str:
    return t("valor atual: ler com {source}", source=source)


def plan(target: Pk3, strategy: str = "wild") -> dict:
    """strategy: "wild" (wild battle, game PID) or "egg" (egg with `target`'s PID: keeps nature, gender, ability)."""
    if strategy not in ("wild", "egg"):
        raise ValueError(t("estratégia {strategy!r}, esperado wild ou egg", strategy=strategy))
    species = target.species
    level = species_data.mon_level(target)
    steps: list[Step] = []
    warnings = []

    if strategy == "wild":
        steps.append(Step("wild", [
            ("PokemonHex", _species_label(species), t("escolha pelo nome no autocomplete do gerador")),
            ("PokemonLV", level, None),
            ("NPC", 2, t("padrão do código")),
        ], [t("Capture com a {ball}; a bola não muda depois sem outro código.",
              ball=species_data.item_name(target.ball)) if target.ball else
            t("Capture com a bola que quiser; a bola não muda depois sem outro código."),
            t("A nature sai do jogo. A pedida é {nature}: se precisar dela, use o caminho do ovo.",
              nature=target.nature)]))
        pid_note = _cur("Read Pokemon PID")
        ids_note = t("valor atual: ler com {source} (o OT é você)", source="Read Pokemon TID and SID")
        steps.append(Step("read_pid", [], [t("Anote o PID: os códigos de alteração pedem ele.")]))
        steps.append(Step("read_ids", [], [t("Se você já sabe seu TID e SID, pode pular.")]))
    else:
        steps.append(Step("pid_egg", [
            ("species", _species_label(species), t("escolha pelo nome no autocomplete do gerador")),
            ("pid", f"0x{target.personality:08X}", f"nature {target.nature}"),
            ("inaccurate_emu", 0, t("0 no Switch")),
        ], [t("O ovo sai com os outros dados quase todos zerados. Choque e confira o resultado antes de "
              "seguir. O TID usado pelo código e o que muda ao chocar não estão claros (não verificado).")]))
        pid_note = f"0x{target.personality:08X}"
        ids_note = _cur("Read Pokemon TID and SID")
        steps.append(Step("read_ids", [], [t("Depois de chocar: anote TID e SID do Pokémon.")]))

    ident = [("pid", pid_note, None), ("tid", ids_note, None), ("sid", ids_note, None),
             ("inaccurate_emu", 0, t("0 no Switch"))]
    steps.append(Step("read_ivea", [("pid", pid_note, t("precisa antes de gerar o código"))],
                      [t("Devolve IVs, Ability e o campo codificado usado em Change IVs.")]))
    evs = target.evs
    if any(evs.values()):
        steps.append(Step("read_evs", [], [t("Devolve os EVs atuais e os campos codificados.")]))

    exp = target.experience
    steps.append(Step("exp", ident + [
        ("cur_exp", t("valor atual: tela de resumo (EXP. POINTS)"), None),
        ("new_exp", exp, t("mínimo do nível {level}", level=level) if exp == species_data.exp_table(species)[level] else None),
    ], [t("Suba de nível no jogo (Rare Candy ou batalha) para os stats e moves acompanharem.")]))

    ivs = target.ivs
    abilities = species_data.info(species)["abilities"]
    steps.append(Step("ivs", ident + [
        ("cur_encoded_ivea", _cur("Read Pokemon IVEA field"), t("ou os valores atuais um a um")),
        *[(f"new_{name}", ivs[stat], None) for name, stat in
          zip(("hp", "atk", "def", "speed", "spe_atk", "spe_def"), STATS)],
        ("new_ability", target.ability_num, species_data.ability_name(abilities[target.ability_num] or abilities[0])),
    ], [t("IVs e Ability são gravados juntos: informe todos.")]))

    if any(evs.values()):
        steps.append(Step("evs", ident + [
            ("cur_encoded_evs1/2/3", _cur("Read EVs field"), t("ou os EVs atuais um a um")),
            *[(f"new_{name}", evs[stat], None) for name, stat in
              zip(("hp", "atk", "def", "speed", "spe_atk", "spe_def"), STATS)],
        ]))

    steps.append(Step("origin", ident + [
        ("new_loc", f"{target.met_location} ({species_data.map_section(target.met_location)})", None),
        ("new_met_lvl", target.met_level, None),
        ("new_origin_game", f"{target.met_game} ({ORIGIN_GAMES.get(target.met_game, '?')})", None),
        ("new_ball", f"{target.ball} ({species_data.item_name(target.ball)})", None),
        ("new_ot_gender", target.ot_gender, t("0 masculino, 1 feminino")),
        ("new_pkrs", f"0x{target.pokerus:02X}", None),
        ("cur_*", t("valor atual: tela de resumo (local, nível e jogo de encontro, bola)"), None),
    ], [t("Opcional: só se quiser a origem igual à do Pokémon montado.")]))

    for slot, move in enumerate(target.moves):
        if move:
            steps.append(Step("teach", [
                ("Move", _numbered(species_data.move_name(move), move), t("pelo autocomplete")),
                ("MoveSlot", slot, t("0 a 3")),
                ("NPC", 2, None),
            ]))

    if target.is_shiny:
        steps.append(Step("shiny", [], [
            t("Copia o PID para o OT ID do Pokémon: a nature fica, mas o TID e o SID dele passam a ser as "
              "metades do PID e ele conta como Pokémon de troca (obediência e bônus de experiência)."),
            t("Rode por último, porque os códigos anteriores pedem o TID e o SID originais.")]))
        warnings.append(t("Shiny: o TID e o SID do Pokémon no jogo não vão ser os do arquivo."))

    if target.held_item:
        steps.append(Step("item", [
            ("item_index", _numbered(species_data.item_name(target.held_item), target.held_item), None),
            ("amount", 1, None),
        ], [t("Retire do PC e entregue ao Pokémon pelo menu.")]))

    not_covered = []
    if strategy == "wild":
        not_covered.append(t("Nature {nature}: vem da captura (ou use o caminho do ovo).", nature=target.nature))
    not_covered += [
        t("Apelido {nickname!r}: sem código eng10. O Name Rater (Lavender Town) só renomeia se o OT for você.",
          nickname=target.nickname),
        t("Nome do OT {name!r}: sem código eng10.", name=target.ot_name),
        t("Amizade {friendship}: sem código; sobe jogando.", friendship=target.friendship),
    ]
    if not target.is_shiny:
        not_covered.append(t("TID/SID do OT ({tid}/{sid}): sem código eng10 para um Pokémon; "
                             "o OT será o de quem capturou.", tid=target.tid, sid=target.sid))

    return {
        "strategy": strategy,
        "generator": GENERATOR_URL,
        "requirements": [
            t("Rota de entrada de ACE feita e conferida com o código de verificação."),
            t("Saída pela Box 14 montada para os códigos marcados como Box 14 ({url}).", url=BOX14_EXIT_URL),
            t("Escolher a versão eng10 (English Switch) no gerador."),
            t("Salvar antes de cada código. Box 13 a partir do slot 7 e as boxes seguintes vazias."),
        ],
        "steps": [s.as_dict() for s in steps],
        "not_covered": not_covered,
        "warnings": warnings + [t("Não leve ao Pokémon HOME Pokémon criados ou alterados por ACE.")],
        "nature": NATURES[target.personality % 25],
    }
