#!/usr/bin/env python3
"""Extract species, move and item data from the Switch ROM built from the decomp.

Usage: python tools/gen_species_data.py [path/to/pokefirered]
Reads pokefirered_switch.gba at the addresses of src/swg3/data/firered_switch.sym (layouts in include/pokemon.h,
include/item.h); holdable items as in Task_ItemContext_FieldGive (src/item_menu.c), Cape Brink as in
CanLearnTutorMove (src/party_menu.c). Emerald tutors and map sections from pokeemerald. XD tutors from PokeAPI
(BSD 3-clause, pokemon_moves.csv, version group 13, method 3): not verified against the game.
Output: src/swg3/data/frlg_species.json.
"""

import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from swg3.gen3 import charset  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
EMERALD_SECTIONS = ROOT / "references" / "pokeemerald" / "src" / "data" / "region_map" / "region_map_sections.json"
POCKET_KEY_ITEMS = 2   # include/constants/global.h
FIRST_EMERALD_SECTION = 197
SYM = ROOT / "src" / "swg3" / "data" / "firered_switch.sym"
OUT = ROOT / "src" / "swg3" / "data" / "frlg_species.json"
ROM_BASE = 0x08000000
NUM_SPECIES = 412
EGG_SPECIES_OFFSET = 20000
GROWTH = ("medium_fast", "erratic", "fluctuating", "medium_slow", "fast", "slow")
# EVO_* (include/constants/pokemon.h).
EVO_METHODS = {
    1: "friendship", 2: "friendship_day", 3: "friendship_night", 4: "level", 5: "trade",
    6: "trade_item", 7: "item", 8: "level_atk_gt_def", 9: "level_atk_eq_def", 10: "level_atk_lt_def",
    11: "level_silcoon", 12: "level_cascoon", 13: "level_ninjask", 14: "level_shedinja", 15: "beauty",
}


def load_symbols() -> dict[str, tuple[int, int]]:
    symbols = {}
    for line in SYM.read_text().splitlines():
        address, size, _, name = line.split("\t")
        symbols.setdefault(name, (int(address, 16), int(size, 16)))
    return symbols


class Rom:
    def __init__(self, data: bytes, symbols):
        self.data = data
        self.symbols = symbols

    def at(self, address: int, size: int) -> bytes:
        offset = address - ROM_BASE
        return self.data[offset:offset + size]

    def table(self, name: str) -> bytes:
        address, size = self.symbols[name]
        return self.at(address, size)

    def u16_list(self, address: int, end: int = 0xFFFF) -> list[int]:
        out = []
        while True:
            value = struct.unpack_from("<H", self.data, address - ROM_BASE + 2 * len(out))[0]
            if value == end:
                return out
            out.append(value)


def map_sections(decomp: Path) -> dict[int, str]:
    text = (decomp / "include" / "constants" / "region_map_sections.h").read_text()
    body = text[text.index("enum"):text.index("};")]
    out, value = {}, -1
    for name, explicit in re.findall(r"^\s*MAPSEC_(\w+)\s*(?:=\s*([^,]+))?,", body, re.M):
        value = int(explicit, 0) if explicit else value + 1
        out.setdefault(value, name)
    for name, value in re.findall(r"#define METLOC_(\w+)\s+(0x[0-9A-Fa-f]+)", text):
        out.setdefault(int(value, 16), name)
    return out


EMERALD_TUTORS = ROOT / "references" / "pokeemerald" / "src" / "data" / "pokemon" / "tutor_learnsets.h"


def emerald_tutors(decomp: Path) -> dict[int, list[int]]:
    text = EMERALD_TUTORS.read_text()
    species = {n: int(v) for n, v in re.findall(r"#define (SPECIES_\w+) (\d+)\b", (decomp / "include" / "constants" / "species.h").read_text())}
    moves = {n: int(v) for n, v in re.findall(r"#define (MOVE_\w+) (\d+)\b", (decomp / "include" / "constants" / "moves.h").read_text())}
    table = text[text.index("sTutorLearnsets"):]
    out = {}
    parts = re.split(r"\[(SPECIES_\w+)\]\s*=", table)
    for name, body in zip(parts[1::2], parts[2::2]):
        learned = sorted(moves[m] for m in re.findall(r"TUTOR\((MOVE_\w+)\)", body))
        if learned:
            out[species[name]] = learned
    return out


def cape_brink_tutors(decomp: Path) -> dict[int, list[int]]:
    """The special cases of CanLearnTutorMove."""
    species = {n: int(v) for n, v in re.findall(r"#define (SPECIES_\w+) (\d+)\b", (decomp / "include" / "constants" / "species.h").read_text())}
    moves = {n: int(v) for n, v in re.findall(r"#define (MOVE_\w+) (\d+)\b", (decomp / "include" / "constants" / "moves.h").read_text())}
    text = (decomp / "src" / "party_menu.c").read_text()
    body = text[text.index("static bool8 CanLearnTutorMove(u16 species, u8 tutor)\n{"):]
    body = body[:body.index("default:")]
    cases = re.findall(r"case TUTOR_MOVE_(\w+):\s*if \(species == (SPECIES_\w+)\)", body)
    assert len(cases) == 3, cases
    return {species[s]: [moves[f"MOVE_{m}"]] for m, s in cases}


XD_TUTORS = ROOT / "references" / "pokeapi" / "pokemon_moves.csv"


def xd_tutors(national: list[int]) -> dict[int, list[int]]:
    """Species (game number) -> XD tutor moves."""
    import csv
    by_national = {n: sid for sid, n in enumerate(national, start=1) if n}
    out: dict[int, set[int]] = {}
    with XD_TUTORS.open() as f:
        for row in csv.DictReader(f):
            if row["version_group_id"] == "13" and row["pokemon_move_method_id"] == "3" and int(row["pokemon_id"]) in by_national:
                out.setdefault(by_national[int(row["pokemon_id"])], set()).add(int(row["move_id"]))
    return {sid: sorted(moves) for sid, moves in out.items()}


def emerald_sections() -> dict[int, str]:
    """The position in the JSON is the constant value."""
    sections = json.loads(EMERALD_SECTIONS.read_text())["map_sections"]
    return {i: s["id"].removeprefix("MAPSEC_") for i, s in enumerate(sections) if i >= FIRST_EMERALD_SECTION}


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    rom = Rom((decomp / "pokefirered_switch.gba").read_bytes(), load_symbols())

    move_names = rom.table("gMoveNames")
    moves = {i: charset.decode(move_names[i * 13:(i + 1) * 13]) for i in range(len(move_names) // 13)}
    species_names = rom.table("gSpeciesNames")
    type_raw = rom.table("gTypeNames")
    types = [charset.decode(type_raw[i:i + 7]) for i in range(0, len(type_raw), 7)]
    ability_raw = rom.table("gAbilityNames")
    abilities = [charset.decode(ability_raw[i:i + 13]) for i in range(0, len(ability_raw), 13)]
    battle_moves = rom.table("gBattleMoves")
    move_pp = [battle_moves[i * 12 + 4] for i in range(len(battle_moves) // 12)]
    move_power = [battle_moves[i * 12 + 1] for i in range(len(battle_moves) // 12)]
    move_type = [battle_moves[i * 12 + 2] for i in range(len(battle_moves) // 12)]
    item_raw = rom.table("gItems")
    items = [charset.decode(item_raw[i:i + 14]) for i in range(0, len(item_raw), 44)]
    holdable = [i // 44 for i in range(44, len(item_raw), 44) if item_raw[i + 24] == 0 and item_raw[i + 26] != POCKET_KEY_ITEMS]

    exp_raw = rom.table("gExperienceTables")
    exp = [list(struct.unpack_from("<101I", exp_raw, g * 404)) for g in range(6)]

    tm_moves = list(struct.unpack("<58H", rom.table("sTMHMMoves")))
    tutor_moves = list(struct.unpack("<15H", rom.table("sTutorMoves")))
    tm_sets = rom.table("sTMHMLearnsets")
    tutor_sets = rom.table("sTutorLearnsets")
    info = rom.table("gSpeciesInfo")
    levelup_ptrs = struct.unpack(f"<{NUM_SPECIES}I", rom.table("gLevelUpLearnsets"))
    evo_table = rom.table("gEvolutionTable")
    national = struct.unpack(f"<{NUM_SPECIES - 1}H", rom.table("sSpeciesToNationalPokedexNum"))

    egg = {}
    words = struct.unpack(f"<{len(rom.table('gEggMoves')) // 2}H", rom.table("gEggMoves"))
    current = None
    for word in words:
        if word == 0xFFFF:
            break
        if word > EGG_SPECIES_OFFSET:
            current = word - EGG_SPECIES_OFFSET
            egg[current] = []
        elif current is not None:
            egg[current].append(word)

    tutors_emerald = emerald_tutors(decomp)
    cape_brink = cape_brink_tutors(decomp)
    tutors_xd = xd_tutors(list(national))
    species = {}
    for sid in range(1, NUM_SPECIES):
        base = info[sid * 28:(sid + 1) * 28]
        stats = list(base[0:6])
        if not any(stats):
            continue
        tm_bits = struct.unpack_from("<Q", tm_sets, sid * 8)[0]
        tutor_bits = struct.unpack_from("<H", tutor_sets, sid * 2)[0]
        levelup = [[w >> 9, w & 0x1FF] for w in rom.u16_list(levelup_ptrs[sid])]
        species[sid] = {
            "name": charset.decode(species_names[sid * 11:(sid + 1) * 11]),
            "base": stats,   # HP, Atk, Def, Spe, SpA, SpD
            "types": list(base[6:8]),
            "gender_ratio": base[0x10],
            "friendship": base[0x12],
            "national": national[sid - 1],
            "growth": GROWTH[base[0x13]],
            "abilities": list(base[0x16:0x18]),
            "egg_groups": list(base[0x14:0x16]),
            "levelup": levelup,
            "tm": [m for i, m in enumerate(tm_moves) if tm_bits >> i & 1],
            "tutor": [m for i, m in enumerate(tutor_moves) if tutor_bits >> i & 1] + cape_brink.get(sid, []),
            "egg": egg.get(sid, []),
            "tutor_emerald": tutors_emerald.get(sid, []),
            "tutor_xd": tutors_xd.get(sid, []),
            "evolutions": [
                list(struct.unpack_from("<3H", evo_table, sid * 40 + i * 8))
                for i in range(5) if struct.unpack_from("<H", evo_table, sid * 40 + i * 8)[0]
            ],
        }

    out = {
        "evo_methods": EVO_METHODS,
        "growth": list(GROWTH),
        "exp": exp,
        "moves": moves,
        "move_pp": move_pp,
        "move_power": move_power,
        "move_type": move_type,
        "types": types,
        "abilities": abilities,
        "items": items,
        "item_holdable": holdable,
        "mapsec": map_sections(decomp),
        "mapsec_emerald": emerald_sections(),
        "species": species,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(species)} species, {len(moves)} moves, {len(abilities)} abilities, {len(items)} items in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
