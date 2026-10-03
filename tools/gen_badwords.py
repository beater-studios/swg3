#!/usr/bin/env python3
"""Generate the Switch word filter patterns used to check box names.

Usage: python tools/gen_badwords.py [path/to/Gen3ACEPokemonBuilder]
Source: src/data/profanity.gen3.js from Gen3ACEPokemonBuilder (MankeyMite, GPLv3), PKHeX's badwords_switch.txt
(kwsch and contributors, GPLv3) revised on a real Switch. Output: src/swg3/data/badwords_switch.txt.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "references" / "Gen3ACEPokemonBuilder"
OUT = ROOT / "src" / "swg3" / "data" / "badwords_switch.txt"


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    text = (source / "src" / "data" / "profanity.gen3.js").read_text(encoding="utf-8")
    body = text[text.index("["):text.rindex("]") + 1]
    patterns = json.loads(re.sub(r",\s*]$", "]", body))
    OUT.write_text("\n".join(patterns) + "\n", encoding="utf-8")
    print(f"{len(patterns)} patterns in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
