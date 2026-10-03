#!/usr/bin/env python3
"""Generate the FR/LG wild encounter tables from the decomp.

Usage: python tools/gen_wild.py [path/to/pokefirered]
Sources: src/data/wild_encounters.json, include/constants/species.h. Output: src/swg3/data/frlg_wild.json as
{"firered"|"leafgreen": {map: {area: {"rate": n, "mons": [[species, id, min, max], ...]}}}}.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "src" / "swg3" / "data" / "frlg_wild.json"
AREAS = ("land_mons", "water_mons", "rock_smash_mons", "fishing_mons")


def species_ids(decomp: Path) -> dict[str, int]:
    text = (decomp / "include" / "constants" / "species.h").read_text()
    return {name: int(value) for name, value in re.findall(r"#define (SPECIES_\w+) (\d+)\b", text)}


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    ids = species_ids(decomp)
    data = json.loads((decomp / "src" / "data" / "wild_encounters.json").read_text())
    out = {"firered": {}, "leafgreen": {}}
    for group in data["wild_encounter_groups"]:
        for entry in group["encounters"]:
            label = entry["base_label"]
            version = "firered" if label.endswith("_FireRed") else "leafgreen" if label.endswith("_LeafGreen") else None
            if version is None:
                continue
            areas = {}
            for area in AREAS:
                if area not in entry:
                    continue
                mons = [
                    [m["species"].removeprefix("SPECIES_"), ids[m["species"]], m["min_level"], m["max_level"]]
                    for m in entry[area]["mons"]
                ]
                areas[area.removesuffix("_mons")] = {"rate": entry[area]["encounter_rate"], "mons": mons}
            out[version][entry["map"].removeprefix("MAP_")] = areas
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"{len(out['firered'])} FireRed maps, {len(out['leafgreen'])} LeafGreen in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
