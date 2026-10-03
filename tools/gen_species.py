#!/usr/bin/env python3
"""Generate the species table from the decomp (include/constants/species.h).

Usage: python tools/gen_species.py [path/to/pokefirered]
Output: src/swg3/data/species.tsv ("id<TAB>name", 0..SPECIES_EGG). OLD_UNOWN_* (252 to 276) keep their name so
the validator rejects them.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "src" / "swg3" / "data" / "species.tsv"


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    text = (decomp / "include" / "constants" / "species.h").read_text()
    rows = {}
    for name, value in re.findall(r"#define SPECIES_(\w+) (\d+)\b", text):
        value = int(value)
        if value <= 412:
            rows.setdefault(value, name)
    OUT.write_text("".join(f"{i}\t{rows[i]}\n" for i in sorted(rows)), encoding="utf-8")
    print(f"{len(rows)} species in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
