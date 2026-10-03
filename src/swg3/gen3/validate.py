"""Basic pk3 validation (not a full legality checker): what the game would not generate or could corrupt a save.

Limits from include/constants/{species,moves,items,global,pokemon}.h.
"""

from dataclasses import dataclass
from functools import cache
from importlib.resources import files

from ..i18n import t
from . import encounters
from . import ribbons as ribbon_data
from . import species as species_data
from .pk3 import Pk3, STATS, UNOWN, UNOWN_LETTERS, checksum, unown_letter

SPECIES_EGG = 412
MOVES_COUNT = 355
ITEMS_COUNT = 375
MAX_BALL = 12   # ITEM_PREMIER_BALL
ITEM_POKE_BALL = 4
MAX_LEVEL = 100
MAX_TOTAL_EVS = 510
# include/constants/region_map_sections.h and include/constants/version.h
KANTO_MAPSEC_START = 88
MAPSEC_SPECIAL_AREA = 196
METLOC_SPECIAL_EGG = 0xFD
RSE_GAMES = (1, 2, 3)
FRLG_GAMES = (4, 5)
EMERALD = 3
# Emerald-only sections (pokeemerald, src/data/region_map/region_map_sections.json): AQUA_HIDEOUT to TRAINER_HILL.
EMERALD_MAPSEC_START = 197
EMERALD_MAPSEC_END = 212
# pokeemerald MAPSEC_BATTLE_FRONTIER reuses pokeruby's MAPSEC_BATTLE_TOWER (0x3A), where no Pokémon can be met.
MAPSEC_BATTLE_FRONTIER = 0x3A
METLOC_SPECIALS = (0xFD, 0xFE, 0xFF)   # egg, in-game trade, event
LANGUAGES = {1, 2, 3, 4, 5, 7}   # 6 (Korean) is unused
GAME_COLOSSEUM_XD = 15
GAME_NAMES = {1: "Sapphire", 2: "Ruby", 3: "Emerald", 4: "FireRed", 5: "LeafGreen", 15: "Colosseum/XD"}
# Obey and trade only with the fateful flag: src/battle_util.c IsBattlerModernFatefulEncounter, src/trade.c
# IsDeoxysOrMewUntradable.
SPECIES_MEW = 151
SPECIES_DEOXYS = 410
FATEFUL_SPECIES = (SPECIES_MEW, SPECIES_DEOXYS)


@cache
def species_names() -> dict[int, str]:
    text = files("swg3").joinpath("data", "species.tsv").read_text(encoding="utf-8")
    return {int(i): name for i, name in (line.split("\t") for line in text.splitlines())}


def valid_species(species: int) -> bool:
    name = species_names().get(species)
    return name is not None and 0 < species < SPECIES_EGG and not name.startswith("OLD_UNOWN")


def met_locations(game: int) -> list[int] | None:
    """None when unknown (Colosseum/XD)."""
    if game in FRLG_GAMES:
        regions = range(KANTO_MAPSEC_START, MAPSEC_SPECIAL_AREA + 1)
    elif game == EMERALD:
        regions = [*range(KANTO_MAPSEC_START), *range(EMERALD_MAPSEC_START, EMERALD_MAPSEC_END + 1)]
    elif game in RSE_GAMES:
        regions = range(KANTO_MAPSEC_START)
    else:
        return None
    return [*regions, *METLOC_SPECIALS]


@dataclass(frozen=True)
class Issue:
    level: str   # "error" or "warning" (problems), "note" (informational)
    field: str
    message: str


def check(mon: Pk3) -> list[Issue]:
    issues = []

    def error(field, message):
        issues.append(Issue("error", field, message))

    def warn(field, message):
        issues.append(Issue("warning", field, message))

    def note(field, message):
        issues.append(Issue("note", field, message))

    if not mon.checksum_ok:
        error("checksum", t("gravado {stored:#06x}, calculado {computed:#06x}", stored=mon._u16(0x1C), computed=checksum(mon.data)))
    if mon.is_bad_egg:
        error("flags", t("marcado como Bad Egg"))
    # Eggs store the real species with the isEgg flag; SPECIES_EGG (412) exists only for display.
    if not valid_species(mon.species) or mon.species == SPECIES_EGG:
        error("species", t("espécie {species} inexistente", species=mon.species))
    if mon.has_species != (mon.species != 0):
        warn("flags", t("flag hasSpecies não bate com a espécie"))
    if mon.language not in LANGUAGES:
        error("language", t("idioma {language} inválido", language=mon.language))
    if mon.held_item >= ITEMS_COUNT:
        error("held_item", t("item {item} inexistente", item=mon.held_item))
    elif mon.held_item and not species_data.holdable(mon.held_item):
        warn("held_item", t("{item} não pode ser segurado (key item ou HM)", item=species_data.item_name(mon.held_item)))

    moves = [m for m in mon.moves if m]
    if not moves:
        error("moves", t("nenhum move"))
    if any(m >= MOVES_COUNT for m in mon.moves):
        error("moves", t("move inexistente em {moves}", moves=mon.moves))
    if len(set(moves)) != len(moves):
        error("moves", t("move repetido em {moves}", moves=mon.moves))
    if mon.moves[0] == 0 and moves:
        warn("moves", t("primeiro slot vazio com moves depois"))

    total = sum(mon.evs.values())
    if total > MAX_TOTAL_EVS:
        error("evs", t("soma {total}, máximo {max}", total=total, max=MAX_TOTAL_EVS))

    if not 1 <= mon.ball <= MAX_BALL:
        error("ball", t("bola {ball} inválida", ball=mon.ball))
    if mon.met_level > MAX_LEVEL:
        error("met_level", t("nível de encontro {level}", level=mon.met_level))
    if not mon.is_egg and mon.met_location < METLOC_SPECIAL_EGG:
        if mon.met_game in FRLG_GAMES and mon.met_location < KANTO_MAPSEC_START:
            warn("met_location", t("local de Hoenn num Pokémon marcado como do FireRed ou LeafGreen"))
        elif mon.met_game in RSE_GAMES and KANTO_MAPSEC_START <= mon.met_location <= MAPSEC_SPECIAL_AREA:
            warn("met_location", t("local de Kanto num Pokémon marcado como do Ruby, Sapphire ou Emerald"))
        elif mon.met_game in RSE_GAMES and mon.met_game != EMERALD and EMERALD_MAPSEC_START <= mon.met_location <= EMERALD_MAPSEC_END:
            warn("met_location", t("local só do Emerald num Pokémon marcado como do Ruby ou Sapphire"))
        elif mon.met_game in RSE_GAMES and mon.met_game != EMERALD and mon.met_location == MAPSEC_BATTLE_FRONTIER:
            warn("met_location", t("Battle Frontier num Pokémon marcado como do Ruby ou Sapphire: lá esse local é a Battle Tower, onde não se encontra Pokémon"))
        elif (allowed := met_locations(mon.met_game)) is not None and mon.met_location not in allowed:
            warn("met_location", t("local de encontro {location} não existe no {game}", location=mon.met_location,
                                   game=GAME_NAMES[mon.met_game]))

    _check_extras(mon, warn)

    for field, raw, text in (("nickname", mon.data[0x08:0x12], mon.nickname),
                             ("ot_name", mon.data[0x14:0x1B], mon.ot_name)):
        if "\\x" in text:
            error(field, t("caractere fora da tabela do jogo"))
        if raw[0] == 0xFF:
            error(field, t("vazio"))

    if mon.is_party:
        if not 1 <= mon.level <= MAX_LEVEL:
            error("level", t("nível {level}", level=mon.level))
        stats = mon.stats
        if any(stats[k] == 0 for k in STATS):
            error("stats", t("stat zerado na party"))
        if stats["current_hp"] > stats["hp"]:
            error("stats", t("HP atual maior que o máximo"))

    if valid_species(mon.species):
        _check_species_data(mon, error, warn, note)
    return issues


def _check_extras(mon: Pk3, warn):
    game = mon.met_game
    game_name = GAME_NAMES.get(game, str(game))
    # FR/LG src/pokemon.c: RandomlyGivePartyPokerus, PartySpreadPokerus and UpdatePartyPokerusTime are empty.
    if mon.pokerus and game in ribbon_data.FRLG:
        warn("pokerus", t("Pokérus num Pokémon do {game}: esse jogo não passa o Pokérus, só vale se ele esteve em Ruby, Sapphire ou Emerald", game=game_name))
    # pokeemerald src/pokemon.c, RandomlyGivePartyPokerus: strain 1 to 15 (never 0 or 8), byte strain << 4 | (strain % 4 + 1).
    strain, days = mon.pokerus >> 4, mon.pokerus & 0xF
    if mon.pokerus and (strain % 8 == 0 or days > strain % 4 + 1):
        warn("pokerus", t("Pokérus {value} que o jogo não gera (cepa {strain}, {days} dia(s))", value=f"0x{mon.pokerus:02X}", strain=strain, days=days))
    if mon.species in FATEFUL_SPECIES and not mon.fateful:
        warn("fateful", t("sem a marca de evento: no FR/LG e no Emerald, não obedece em batalha e o jogo não deixa trocar"))

    ribbons = ribbon_data.decode(mon.ribbons)
    allowed = ribbon_data.available(game)
    for key, rank in ribbons["contest"].items():
        if rank > ribbon_data.CONTEST_MAX:
            warn("ribbons", t("{name} Ribbon com valor {value} (máximo {max})", name=ribbon_data.NAMES[key], value=rank, max=ribbon_data.CONTEST_MAX))
    if any(ribbons["contest"].values()) and "contest" not in allowed:
        warn("ribbons", t("ribbons de concurso num Pokémon do {game}: só valem se ele esteve em Ruby, Sapphire ou Emerald", game=game_name))
    for key in ribbons["flags"]:
        if key in ribbon_data.NEVER:
            warn("ribbons", t("{name} Ribbon nunca foi distribuída", name=ribbon_data.NAMES[key]))
        elif key not in allowed:
            warn("ribbons", t("{name} Ribbon não sai no {game}: só vale se o Pokémon passou por um jogo que dá essa ribbon", name=ribbon_data.NAMES[key], game=game_name))
    if ribbons["unused"]:
        warn("ribbons", t("bits de ribbon sem uso ligados"))


def _check_encounter(mon: Pk3, entry: dict, level: int, warn):
    problem = encounters.check(mon.species, mon.met_game, mon.met_location, mon.met_level)
    if problem is None:
        return
    kind, levels = problem
    fields = {"species": entry["name"], "game": GAME_NAMES[mon.met_game], "level": mon.met_level,
              "location": species_data.map_section(mon.met_location, mon.met_game).replace("_", " "), "levels": levels}
    if kind == "trade":
        warn("met_location", t("{species} não vem de nenhuma troca no jogo do {game}", **fields))
    elif kind == "egg":
        warn("met_level", t("0 marca o Pokémon como chocado de ovo, mas {species} não sai de ovo.", **fields))
    elif kind == "place":
        warn("met_location", t("{species} não aparece em {location} no {game}; só se veio de um evento.", **fields))
    else:
        warn("met_level", t("{level} não bate com {location}: lá, {species} aparece no nível {levels}.", **fields))


def _check_unown(mon: Pk3, warn):
    """Each Tanoby chamber gives only its slots' letters (src/wild_encounter.c, sUnownLetterSlots)."""
    if mon.species != UNOWN:
        return
    letters = encounters.unown_letters(mon.met_game, mon.met_location)
    letter = unown_letter(mon.personality)
    if letters is not None and letter not in letters:
        warn("pid", t("letra {letter} do Unown não sai em {location}: lá saem {letters}. A letra vem do PID.",
                      letter=UNOWN_LETTERS[letter], letters=", ".join(UNOWN_LETTERS[i] for i in letters),
                      location=species_data.map_section(mon.met_location, mon.met_game).replace("_", " ")))


def _check_event(mon: Pk3, entry: dict, warn):
    """Island events set the fateful flag (seteventmon, src/pokemon.c CreateEventMon); route, gift and trade Pokémon
    never have it. Skips hatched eggs and the event location: a Mystery Gift egg may have the flag."""
    if mon.met_level == 0 or mon.met_location == encounters.METLOC_FATEFUL_ENCOUNTER:
        return
    here = [s for s in encounters.sightings(mon.species, mon.met_game) if s[0] == mon.met_location]
    event = any(kind == "event" for _, _, _, kind in here)
    location = species_data.map_section(mon.met_location, mon.met_game).replace("_", " ")
    if event and not mon.fateful:
        warn("fateful", t("{species} de {location} sai do evento com a marca de evento, e este está sem", species=entry["name"], location=location))
    elif mon.fateful and here and not event:
        warn("fateful", t("marca de evento num {species} de {location}, que no {game} não sai com ela", species=entry["name"],
                          location=location, game=GAME_NAMES[mon.met_game]))


STAT_LABELS = {"hp": "HP", "attack": "Atk", "defense": "Def", "speed": "Spe", "sp_attack": "SpA", "sp_defense": "SpD"}


def _stat_text(stats: dict) -> str:
    return ", ".join(f"{STAT_LABELS[k]} {stats[k]}" for k in STATS)


def _check_species_data(mon: Pk3, error, warn, note):
    entry = species_data.info(mon.species)
    table = species_data.exp_table(mon.species)
    if mon.experience > table[MAX_LEVEL]:
        error("experience", t("{experience} acima do máximo {max}", experience=mon.experience, max=table[MAX_LEVEL]))
    level = species_data.mon_level(mon)
    if mon.met_level and not mon.is_egg and mon.met_level > level:
        warn("met_level", t("encontrado no nível {met}, acima do nível atual ({level})", met=mon.met_level, level=level))
    if mon.is_party:
        if mon.level != level:
            error("level", t("nível {level}, mas a experiência dá {expected}", level=mon.level, expected=level))
        expected = species_data.mon_stats(mon, level)
        got = {k: mon.stats[k] for k in STATS}
        if got != expected:
            warn("stats", t("stats {got} diferem do cálculo {expected}; o jogo recalcula",
                                 got=_stat_text(got), expected=_stat_text(expected)))

    allowed = met_locations(mon.met_game)
    if not mon.is_egg and allowed is not None and mon.met_location in allowed:
        _check_encounter(mon, entry, level, warn)
        _check_unown(mon, warn)
        _check_event(mon, entry, warn)
    if not mon.is_egg and mon.met_game in encounters.VERSIONS and mon.met_level == 0:
        game = GAME_NAMES[mon.met_game]
        if encounters.sightings(mon.species, mon.met_game):
            note("met_level", t("0, porque o Pokémon está marcado como chocado de ovo: é assim que o jogo registra quem nasceu de um ovo."))
        else:
            note("met_level", t("0, porque o Pokémon está marcado como chocado de ovo. {species} não aparece no {game}, então esse é o único jeito de ter um: de um ovo, com pais trazidos de outro jogo para a Day Care.",
                                species=entry["name"], game=game))
    # A hatched egg always comes in a Poké Ball, with met level 0 (src/daycare.c, on hatching).
    if not mon.is_egg and allowed is not None and mon.met_level == 0 and mon.ball != ITEM_POKE_BALL:
        warn("ball", t("o Pokémon está marcado como chocado de ovo (nível de encontro 0), e ovo sempre choca em Poké Ball."))

    has_second = entry["abilities"][1] != 0
    if mon.ability_num and not has_second:
        warn("ability", t("2ª Ability marcada, mas a espécie só tem uma"))
    elif has_second and mon.ability_num != mon.personality & 1:
        warn("ability", t("Ability não bate com o PID (o jogo usa PID & 1)"))

    hatched = mon.met_level == 0
    caught = None
    if not hatched and allowed is not None and mon.met_location in allowed:
        caught = encounters.who(mon.species, mon.met_game, mon.met_location, mon.met_level)
    learnable = species_data.learnable_moves(mon.species, level, egg=hatched, since=caught)
    foreign = [m for m in mon.moves if m and m not in learnable]
    if foreign and not mon.is_egg:
        egg_only = species_data.egg_only_moves(mon.species, level) if not hatched else set()
        from_egg = [m for m in foreign if m in egg_only]
        others = [m for m in foreign if m not in egg_only]
        if from_egg:
            names = ", ".join(species_data.move_name(m) for m in from_egg)
            warn("moves", t("{names} só vem de ovo, e o Pokémon não foi chocado (o nível de encontro é {met}, não 0).",
                            met=mon.met_level, names=names))
        everyone = species_data.learnable_moves(mon.species, level, egg=False)
        before = [m for m in others if m in everyone]
        others = [m for m in others if m not in everyone]
        if before:
            names = ", ".join(species_data.move_name(m) for m in before)
            warn("moves", t("{names}: só a pré-evolução aprende, e o Pokémon foi pego já como {caught} (nível de encontro {met}), então nunca foi ela.",
                            names=names, caught=species_data.info(caught)["name"], met=mon.met_level))
        emerald = species_data.emerald_tutor_moves(mon.species, since=caught)
        tutor = [m for m in others if m in emerald]
        others = [m for m in others if m not in emerald]
        if tutor:
            names = ", ".join(species_data.move_name(m) for m in tutor)
            note("moves", t("{names} só vem do tutor do Emerald: vale se o Pokémon passou pelo Emerald por troca.", names=names))
        xd = species_data.xd_tutor_moves(mon.species, since=caught)
        tutor = [m for m in others if m in xd]
        others = [m for m in others if m not in xd]
        if tutor:
            names = ", ".join(species_data.move_name(m) for m in tutor)
            if mon.met_game == GAME_COLOSSEUM_XD:
                note("moves", t("{names} vem do tutor do XD.", names=names))
            else:
                note("moves", t("{names} só vem do tutor do XD: vale se o Pokémon passou pelo XD por troca.", names=names))
        if others:
            names = ", ".join(species_data.move_name(m) for m in others)
            warn("moves", t("{names} não está no que a espécie aprende até o nível {level} (por nível, TM, tutor ou pré-evolução); só se veio de um evento.",
                            level=level, names=names))
    if hatched and not mon.is_egg:
        eggs = sorted({m for m in mon.moves if m} & species_data.egg_only_moves(mon.species, level))
        if eggs and species_data.egg_father(mon.species, eggs) is None:
            names = ", ".join(species_data.move_name(m) for m in eggs)
            if len(eggs) == 1:
                warn("moves", t("{names} é golpe de ovo, mas nenhum pai que cruza com {species} consegue ter ele.", names=names, species=entry["name"]))
            else:
                warn("moves", t("{names} são golpes de ovo, e nenhum pai que cruza com {species} consegue ter todos ao mesmo tempo, então não saem juntos do mesmo ovo.",
                                names=names, species=entry["name"]))


def is_valid(mon: Pk3) -> bool:
    return not any(issue.level == "error" for issue in check(mon))
