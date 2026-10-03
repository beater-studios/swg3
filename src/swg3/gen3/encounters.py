"""Where each species appears in FR/LG (frlg_wild.json from tools/gen_wild.py, frlg_encounters.json from
tools/gen_encounters.py), to check a pk3's species, met location and met level. Other games are not checked.

Met location: CreateBoxMon, GetCurrentRegionMapSectionId; hatched eggs: src/daycare.c; in-game trades: src/trade_scene.c.
"""

import json
from functools import cache
from importlib.resources import files

from . import species as species_data
from .pk3 import UNOWN

VERSIONS = {4: "firered", 5: "leafgreen"}
EGG_GROUP_DITTO = 13          # include/constants/pokemon.h
EGG_GROUP_UNDISCOVERED = 15
METLOC_SPECIAL_EGG = 0xFD
METLOC_IN_GAME_TRADE = 0xFE
METLOC_FATEFUL_ENCOUNTER = 0xFF
# The only FR/LG Day Care that produces eggs (data/maps/FourIsland/scripts.inc); an egg can hatch anywhere.
HATCH_LOCATION = 146   # MAPSEC_FOUR_ISLAND


@cache
def _load(name: str) -> dict:
    return json.loads(files("swg3").joinpath("data", name).read_text(encoding="utf-8"))


@cache
def _sightings(version: str) -> dict[int, list[tuple[int, int, int, str]]]:
    """Species -> [(section, min level, max level, kind)]."""
    wild, other = _load("frlg_wild.json")[version], _load("frlg_encounters.json")
    sections = other["map_sections"]
    out: dict[int, set] = {}
    for map_name, areas in wild.items():
        for area, table in areas.items():
            for _, species, low, high in table["mons"]:
                out.setdefault(species, set()).add((sections[map_name], low, high, area))
    for species, level, section, kind in other["fixed"][version]:
        out.setdefault(species, set()).add((section, level, level, kind))
    return {k: sorted(v) for k, v in out.items()}


def unown_letters(game: int, section: int) -> list[int] | None:
    """Letters (0 = A ... 27 = ?) of this location's Tanoby chamber; None outside the chambers or FR/LG."""
    if game not in VERSIONS:
        return None
    return _load("frlg_encounters.json")["unown"].get(str(section))


def _letter_ok(species: int, game: int, section: int, letter: int | None) -> bool:
    letters = unown_letters(game, section) if species == UNOWN and letter is not None else None
    return letters is None or letter in letters


def _family(species: int) -> list[int]:
    return [species, *species_data.pre_evolutions(species)]


def sightings(species: int, game: int) -> list[tuple[int, int, int, str]]:
    """Species or a pre-evolution (an evolved Pokémon keeps its catch location): [(section, min, max, kind)], no eggs."""
    version = VERSIONS.get(game)
    if version is None:
        return []
    table = _sightings(version)
    return sorted({s for member in _family(species) for s in table.get(member, []) if s[3] != "egg"})


def who(species: int, game: int, section: int, level: int) -> int | None:
    """The species or pre-evolution the game gives at this location and level."""
    version = VERSIONS.get(game)
    if version is None:
        return None
    table = _sightings(version)
    for member in _family(species):
        if any(s[0] == section and s[1] <= level <= s[2] and s[3] != "egg" for s in table.get(member, [])):
            return member
    return None


def _descendants(species: int) -> list[int]:
    out, queue = [], [species]
    while queue:
        current = queue.pop(0)
        out.append(current)
        queue.extend(target for _, _, target in species_data.info(current)["evolutions"] if target not in out)
    return out


def hatchable(species: int, game: int) -> bool:
    """Breeding family (neither Undiscovered nor Ditto) or gift egg."""
    family = _family(species)
    root = family[-1]
    breeds = any(set(species_data.info(m)["egg_groups"]) - {EGG_GROUP_DITTO, EGG_GROUP_UNDISCOVERED}
                 for m in _descendants(root))
    version = VERSIONS.get(game)
    gift = version is not None and any(s in family and k == "egg" for s, _, _, k in _load("frlg_encounters.json")["fixed"][version])
    return breeds or gift


def traded(species: int, game: int) -> bool:
    version = VERSIONS.get(game)
    return version is not None and any(m in _load("frlg_encounters.json")["trades"][version] for m in _family(species))


def check(species: int, game: int, location: int, level: int) -> tuple[str, str] | None:
    """("trade" | "egg" | "place" | "level", detail), or None if it matches or cannot be checked."""
    if game not in VERSIONS or location == METLOC_FATEFUL_ENCOUNTER:
        return None
    if location == METLOC_IN_GAME_TRADE:
        return None if traded(species, game) else ("trade", "")
    if level == 0 or location == METLOC_SPECIAL_EGG:
        return None if hatchable(species, game) else ("egg", "")
    here = [s for s in sightings(species, game) if s[0] == location]
    if not here:
        return "place", ""
    if not any(low <= level <= high for _, low, high, _ in here):
        return "level", levels_text(here)
    return None


def levels_text(found) -> str:
    """Adjacent ranges merged: "2-5, 30"."""
    merged: list[list[int]] = []
    for low, high in sorted({(s[1], s[2]) for s in found}):
        if merged and low <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], high)
        else:
            merged.append([low, high])
    return ", ".join(str(low) if low == high else f"{low}-{high}" for low, high in merged)


def default_met(species: int, game: int, level: int, location: int | None = None,
                egg: bool = False, met_level: int | None = None, letter: int | None = None) -> tuple[int, int] | None:
    """Encounter with the highest level up to `level`, else hatched (level 0). `egg`: the Pokémon has an egg move.
    `letter`: Unown letter from the PID. None when there is no data or no path."""
    if game not in VERSIONS:
        return None
    if met_level is not None:
        if met_level == 0:
            return ((HATCH_LOCATION if location is None else location), 0) if hatchable(species, game) else None
        places = sorted(s[0] for s in sightings(species, game) if s[1] <= met_level <= s[2] and (location is None or s[0] == location)
                        and _letter_ok(species, game, s[0], letter))
        return (places[0], met_level) if places else None
    if egg:
        return ((HATCH_LOCATION if location is None else location), 0) if hatchable(species, game) else None
    found = [(min(high, level), -section, section) for section, low, high, _ in sightings(species, game)
             if low <= level and (location is None or section == location) and _letter_ok(species, game, section, letter)]
    if found:
        met_level, _, section = max(found)
        return section, met_level
    if hatchable(species, game):
        return (HATCH_LOCATION if location is None else location), 0
    return None
