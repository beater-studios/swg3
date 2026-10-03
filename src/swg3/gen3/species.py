"""FRLG species data (tools/gen_species_data.py) and game calculations.

src/pokemon.c: CalculateMonStats, ModifyStatByNature (u16 intermediate, sNatureStatTable), GetLevelFromMonExp,
GetGenderFromSpeciesAndPersonality. Hidden Power: src/battle_script_commands.c, Cmd_hiddenpowercalc.
"""

import json
from functools import cache
from importlib.resources import files

from .pk3 import Pk3, STATS
from ..i18n import t

MAX_LEVEL = 100
NATURE_STATS = ("attack", "defense", "speed", "sp_attack", "sp_defense")
# include/constants/pokemon.h.
MON_MALE, MON_FEMALE, MON_GENDERLESS = 0x00, 0xFE, 0xFF
NUMBER_OF_MON_TYPES = 18
TYPE_MYSTERY = 9
ITEM_EVERSTONE = 195          # include/constants/items.h (HOLD_EFFECT_PREVENT_EVOLVE)
KANTO_SPECIES_END = 151       # include/constants/species.h, SPECIES_MEW


@cache
def data() -> dict:
    return json.loads(files("swg3").joinpath("data", "frlg_species.json").read_text(encoding="utf-8"))


def info(species: int) -> dict:
    try:
        return data()["species"][str(species)]
    except KeyError:
        raise KeyError(t("espécie {species} sem dados", species=species)) from None


def move_name(move: int) -> str:
    return data()["moves"].get(str(move), f"#{move}")


def type_name(type_id: int) -> str:
    names = data()["types"]
    return names[type_id] if 0 <= type_id < len(names) else f"#{type_id}"


def ability_name(ability: int) -> str:
    names = data()["abilities"]
    return names[ability] if 0 <= ability < len(names) else f"#{ability}"


def item_name(item: int) -> str:
    names = data()["items"]
    return names[item] if 0 <= item < len(names) else f"#{item}"


def map_section(section: int, game: int | None = None) -> str:
    """With Emerald (3) as the origin game, sections 197 onward are Emerald's (pokeemerald), not FR/LG's."""
    if game == 3 and str(section) in data()["mapsec_emerald"]:
        return data()["mapsec_emerald"][str(section)]
    return data()["mapsec"].get(str(section), f"#{section}")


def holdable(item: int) -> bool:
    """Importance 0 and not a key item (no HMs)."""
    return item in _holdable()


@cache
def _holdable() -> frozenset[int]:
    return frozenset(data()["item_holdable"])


def national_number(species: int) -> int:
    return info(species)["national"]


def gender(species: int, personality: int) -> str:
    """'M', 'F' or '-' (genderless)."""
    ratio = info(species)["gender_ratio"]
    if ratio == MON_GENDERLESS:
        return "-"
    if ratio in (MON_MALE, MON_FEMALE):
        return "M" if ratio == MON_MALE else "F"
    return "F" if ratio > (personality & 0xFF) else "M"


def hidden_power(ivs: dict) -> tuple[int, int]:
    """(type, power)."""
    power_bits = sum(((ivs[k] >> 1) & 1) << i for i, k in enumerate(STATS))
    type_bits = sum((ivs[k] & 1) << i for i, k in enumerate(STATS))
    move_type = (NUMBER_OF_MON_TYPES - 3) * type_bits // 63 + 1
    if move_type >= TYPE_MYSTERY:
        move_type += 1
    return move_type, 40 * power_bits // 63 + 30


def species_id(name: str) -> int:
    name = name.upper()
    for key, value in data()["species"].items():
        if value["name"] == name:
            return int(key)
    raise KeyError(t("espécie '{name}' não encontrada", name=name))


def exp_table(species: int) -> list[int]:
    growth = data()["growth"].index(info(species)["growth"])
    return data()["exp"][growth]


def level_from_exp(species: int, experience: int) -> int:
    table = exp_table(species)
    level = 1
    while level < MAX_LEVEL and table[level + 1] <= experience:
        level += 1
    return level


def nature_modifier(nature: int, stat: str) -> int:
    """+1, -1 or 0, per sNatureStatTable."""
    if stat not in NATURE_STATS:
        return 0
    up, down = divmod(nature, 5)
    index = NATURE_STATS.index(stat)
    if up == down:
        return 0
    return 1 if index == up else -1 if index == down else 0


def _apply_nature(value: int, modifier: int) -> int:
    if modifier == 1:
        return ((value * 110) & 0xFFFF) // 100
    if modifier == -1:
        return ((value * 90) & 0xFFFF) // 100
    return value


def calc_stats(species: int, level: int, ivs: dict, evs: dict, nature: int) -> dict[str, int]:
    base = dict(zip(STATS, info(species)["base"]))
    out = {}
    for stat in STATS:
        core = (2 * base[stat] + ivs[stat] + evs[stat] // 4) * level // 100
        if stat == "hp":
            out[stat] = 1 if info(species)["name"] == "SHEDINJA" else core + level + 10
        else:
            out[stat] = _apply_nature(core + 5, nature_modifier(nature, stat))
    return out


def possible_ivs(species: int, nature: int, observations, evs: dict | None = None, ev_slack: int = 0) -> dict[str, list[int]]:
    """IVs that explain the observed stats (like the IVChecker of ten-lines and PokeFinder).

    `observations`: list of (level, stats by name). `ev_slack`: EVs per stat the Pokémon may have gained after the
    first observation (battles earn EVs), so in later observations the `ev / 4` term may grow by up to `ev_slack / 4`.
    """
    evs = evs or dict.fromkeys(STATS, 0)
    extra = ev_slack // 4
    out = {}
    for stat in STATS:
        # (IV, EVs gained so far in multiples of 4)
        states = {(iv, 0) for iv in range(32)}
        for index, (level, stats) in enumerate(observations):
            fits = set()
            for iv, gained in states:
                for e in range(gained, (extra if index else 0) + 1):
                    ivs = dict.fromkeys(STATS, 0)
                    ivs[stat] = iv
                    effort = {**evs, stat: evs[stat] + 4 * e}
                    if calc_stats(species, level, ivs, effort, nature)[stat] == stats[stat]:
                        fits.add((iv, e))
            states = fits
        out[stat] = sorted({iv for iv, _ in states})
    return out


def evolutions(species: int) -> list[tuple[str, int, int]]:
    """(method, parameter, target species) from gEvolutionTable."""
    methods = data()["evo_methods"]
    return [(methods[str(m)], p, t) for m, p, t in info(species)["evolutions"]]


def trade_evolution(species: int, held_item: int) -> int | None:
    """GetEvolutionTargetSpecies, EVO_MODE_TRADE. Everstone prevents it."""
    if held_item == ITEM_EVERSTONE:
        return None
    target = None
    for method, param, to in evolutions(species):
        if method == "trade" or (method == "trade_item" and param == held_item):
            target = to
    return target


@cache
def _parents() -> dict[int, list[int]]:
    parents: dict[int, list[int]] = {}
    for key, value in data()["species"].items():
        for _, _, target in value["evolutions"]:
            parents.setdefault(target, []).append(int(key))
    return parents


def pre_evolutions(species: int) -> list[int]:
    """From the closest to the base."""
    out, queue = [], list(_parents().get(species, []))
    while queue:
        current = queue.pop(0)
        if current not in out:
            out.append(current)
            queue.extend(_parents().get(current, []))
    return out


def own_learnable_moves(species: int, level: int = MAX_LEVEL, egg: bool = True) -> set[int]:
    entry = info(species)
    moves = {move for lvl, move in entry["levelup"] if lvl <= level}
    return moves | set(entry["tm"]) | set(entry["tutor"]) | (set(entry["egg"]) if egg else set())


def forms_since(species: int, since: int | None = None) -> list[int]:
    """With `since` (the form it was caught as), only forms from that one on: a caught Pidgeotto was never a Pidgey."""
    ancestors = pre_evolutions(species)
    if since is not None and since in ancestors:
        ancestors = ancestors[:ancestors.index(since) + 1]
    elif since == species:
        ancestors = []
    return [species, *ancestors]


def learnable_moves(species: int, level: int = MAX_LEVEL, egg: bool = True, since: int | None = None) -> set[int]:
    """Approximation: a pre-evolution level-up move counts if its level does not exceed the current one. Event moves
    and moves from other generations are not included, so a move outside this set may still be legitimate."""
    moves: set[int] = set()
    for form in forms_since(species, since):
        moves |= own_learnable_moves(form, level, egg)
    return moves


def emerald_tutor_moves(species: int, since: int | None = None) -> set[int]:
    """From pokeemerald; an FR/LG Pokémon that visited Emerald by trade may have them."""
    return {m for form in forms_since(species, since) for m in info(form)["tutor_emerald"]}


def xd_tutor_moves(species: int, since: int | None = None) -> set[int]:
    """From PokeAPI (not verified against the game)."""
    return {m for form in forms_since(species, since) for m in info(form).get("tutor_xd", [])}


# src/daycare.c, BuildEggMoveset: all egg moves of a hatched Pokémon come from one father who knew them at once. A
# male-only or genderless family breeds only with Ditto, so its father is from the same family; Nidoran♀ and Illumise
# eggs can also hatch Nidoran♂ and Volbeat, so those families have a mother.
EGG_GROUP_DITTO, EGG_GROUP_UNDISCOVERED = 13, 15


def _family(species: int) -> list[int]:
    root = ([species, *pre_evolutions(species)])[-1]
    out, queue = [], [root]
    while queue:
        current = queue.pop(0)
        if current not in out:
            out.append(current)
            queue.extend(t for _, _, t in info(current)["evolutions"])
    return out


@cache
def _breeders() -> tuple[int, ...]:
    out = []
    for key, value in data()["species"].items():
        sid = int(key)
        if not value["name"] or value["name"].startswith("?") or value["gender_ratio"] in (MON_FEMALE, MON_GENDERLESS):
            continue
        if set(value["egg_groups"]) - {EGG_GROUP_DITTO, EGG_GROUP_UNDISCOVERED}:
            out.append(sid)
    return tuple(sorted(out))


@cache
def _fathers(species: int) -> frozenset[int]:
    family = _family(species)
    mates = {species_id("NIDORAN♀")} if species_id("NIDORAN♂") in family else {species_id("ILLUMISE")} if species_id("VOLBEAT") in family else set()
    has_mother = mates or any(info(f)["gender_ratio"] not in (MON_MALE, MON_GENDERLESS) for f in family)
    if not has_mother:
        return frozenset(f for f in family if f in _breeders())
    groups = {g for f in family + sorted(mates) for g in info(f)["egg_groups"]} - {EGG_GROUP_DITTO, EGG_GROUP_UNDISCOVERED}
    return frozenset(s for s in _breeders() if set(info(s)["egg_groups"]) & groups)


@cache
def _direct(species: int) -> frozenset[int]:
    """Without hatching: level-up, TM and tutors (including earlier forms)."""
    return frozenset(learnable_moves(species, MAX_LEVEL, egg=False) | emerald_tutor_moves(species) | xd_tutor_moves(species))


@cache
def _family_egg(species: int) -> frozenset[int]:
    return frozenset(m for form in [species, *pre_evolutions(species)] for m in info(form)["egg"])


@cache
def _knowers(moves: frozenset[int]) -> frozenset[int]:
    """Species that can know all `moves` at once, learned or inherited along a father chain."""
    known = {s for s in _breeders() if moves <= _direct(s)}
    changed = True
    while changed:
        changed = False
        for s in _breeders():
            if s in known:
                continue
            rest = moves - _direct(s)
            if not rest <= _family_egg(s):
                continue
            # If the rest is everything, use those found so far (avoids infinite recursion).
            pool = known if rest == moves else _knowers(frozenset(rest))
            if pool & _fathers(s):
                known.add(s)
                changed = True
    return frozenset(known)


def egg_father(species: int, moves) -> int | None:
    """Lowest species number, so the answer is stable."""
    wanted = frozenset(moves)
    candidates = sorted(_knowers(wanted) & _fathers(species)) if wanted <= _family_egg(species) else []
    return candidates[0] if candidates else None


def egg_only_moves(species: int, level: int = MAX_LEVEL) -> set[int]:
    return learnable_moves(species, level) - learnable_moves(species, level, egg=False)


def mon_level(mon: Pk3) -> int:
    return level_from_exp(mon.species, mon.experience)


def mon_stats(mon: Pk3, level: int | None = None) -> dict[str, int]:
    return calc_stats(mon.species, level or mon_level(mon), mon.ivs, mon.evs, mon.personality % 25)
