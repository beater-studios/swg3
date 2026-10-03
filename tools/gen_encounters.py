#!/usr/bin/env python3
"""Generate the non-wild FR/LG encounters and the link from each map to its met location.

Usage: python tools/gen_encounters.py [path/to/pokefirered]
Sources: data/maps/*/map.json (region_map_section, the pk3 met location), data/maps/*/scripts.inc (setwildbattle,
givemon, seteventmon, giveegg), src/roamer.c (sRoamerLocations, level 50), sUnownLetterSlots (src/wild_encounter.c)
and src/data/ingame_trades.h (any level, CreateInGameTradePokemonInternal in src/trade_scene.c).
Output: src/swg3/data/frlg_encounters.json ("map_sections", "fixed", "unown", "trades").
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_species_data import map_sections  # noqa: E402
from gen_wild import species_ids  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "src" / "swg3" / "data" / "frlg_encounters.json"
VERSIONS = {"firered": "FIRERED", "leafgreen": "LEAFGREEN"}
COMMANDS = {"setwildbattle": "static", "givemon": "gift", "seteventmon": "event", "giveegg": "egg"}
ROAMERS = ("SPECIES_RAIKOU", "SPECIES_ENTEI", "SPECIES_SUICUNE")
ROAMER_LEVEL = 50


def preprocess(text: str, define: str) -> str:
    """Resolve .ifdef/.else/.endif (scripts) and #if defined()/#elif/#else/#endif (C) for one version."""
    out, stack = [], []   # (active, some branch already taken)
    for line in text.splitlines():
        s = line.strip()
        active = all(a for a, _ in stack)
        if m := re.match(r"\.ifdef (\w+)|#if defined\((\w+)\)", s):
            cond = (m.group(1) or m.group(2)) == define
            stack.append((cond, cond))
        elif m := re.match(r"#elif defined\((\w+)\)", s):
            _, taken = stack.pop()
            cond = not taken and m.group(1) == define
            stack.append((cond, taken or cond))
        elif s in (".else", "#else"):
            _, taken = stack.pop()
            stack.append((not taken, True))
        elif s in (".endif", "#endif"):
            stack.pop()
        elif active:
            out.append(line)
    return "\n".join(out)


def fixed_encounters(decomp: Path, ids: dict[str, int], sections: dict[str, int], define: str) -> list[list]:
    out = []
    for script in sorted((decomp / "data" / "maps").glob("*/scripts.inc")):
        section = sections[script.parent.name]
        text = preprocess(script.read_text(), define)
        aliases = dict(re.findall(r"^\.equ (\w+),\s*(\w+)", text, re.M))
        variable = lambda name: aliases.get(name, name)
        assigned: dict[str, list[str]] = {}
        for var, species in re.findall(r"setvar (\w+), (SPECIES_\w+)", text):
            assigned.setdefault(variable(var), []).append(species)
        label = ""
        for line in text.splitlines():
            if m := re.match(r"^(\w+)::", line):
                label = m.group(1)
            m = re.match(r"\s+(setwildbattle|givemon|seteventmon|giveegg) (\w+)(?:, (\d+))?", line)
            if not m:
                continue
            command, what, level = m.group(1), m.group(2), int(m.group(3) or 0)
            if what.startswith("SPECIES_"):
                names = [what]
            else:
                choices = assigned[variable(what)]
                named = "SPECIES_" + re.sub(r"(?<!^)(?=[A-Z])", "_", label.rsplit("Give", 1)[-1]).upper()
                if named in ids:
                    # Label the version never sets in the variable (GivePinsir in FireRed): never runs.
                    names = [named] if named in choices else []
                else:
                    names = sorted(set(choices))
            for name in names:
                entry = [ids[name], level, section, COMMANDS[command]]
                if entry not in out:
                    out.append(entry)
    return out


def roamers(decomp: Path, ids: dict[str, int], maps: dict[str, int]) -> list[list]:
    text = (decomp / "src" / "roamer.c").read_text()
    table = text[text.index("sRoamerLocations"):text.index("};", text.index("sRoamerLocations"))]
    routes = re.findall(r"\{MAP_NUM\(MAP_(\w+)\)", table)
    return [[ids[s], ROAMER_LEVEL, maps[m], "roamer"] for s in ROAMERS for m in routes]


def trades(decomp: Path, ids: dict[str, int], define: str) -> list[int]:
    text = preprocess((decomp / "src" / "data" / "ingame_trades.h").read_text(), define)
    return sorted({ids[name] for name in re.findall(r"\.species = (SPECIES_\w+)", text)})


def unown_letters(decomp: Path, folders: dict[str, int]) -> dict[str, list[int]]:
    text = (decomp / "src" / "wild_encounter.c").read_text()
    body = text[text.index("sUnownLetterSlots"):]
    body = body[body.index("{") + 1:body.index("};")]
    rows = [[int(v) for v in re.findall(r"\d+", row)] for row in re.findall(r"\{([^{}]*)\}", body)]
    groups = json.loads((decomp / "data" / "maps" / "map_groups.json").read_text())
    special = groups["gMapGroup_SpecialArea"]
    first = special.index("SevenIsland_TanobyRuins_MoneanChamber")
    chambers = special[first:first + len(rows)]
    assert all("TanobyRuins" in c and c.endswith("Chamber") for c in chambers), chambers
    assert all(len(r) == 12 for r in rows), rows
    return {str(folders[c]): sorted(set(row)) for c, row in zip(chambers, rows)}


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    ids = species_ids(decomp)
    mapsec = {f"MAPSEC_{name}": value for value, name in map_sections(decomp).items()}
    maps, folders = {}, {}
    for path in sorted((decomp / "data" / "maps").glob("*/map.json")):
        info = json.loads(path.read_text())
        section = mapsec[info["region_map_section"]]
        maps[info["id"].removeprefix("MAP_")] = section
        folders[path.parent.name] = section
    out = {
        "map_sections": maps,
        "fixed": {v: fixed_encounters(decomp, ids, folders, d) + roamers(decomp, ids, maps) for v, d in VERSIONS.items()},
        "trades": {v: trades(decomp, ids, d) for v, d in VERSIONS.items()},
        "unown": unown_letters(decomp, folders),
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    counts = ", ".join(f"{v}: {len(out['fixed'][v])} fixed, {len(out['trades'][v])} trades" for v in VERSIONS)
    print(f"{len(maps)} maps, {counts} in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
