#!/usr/bin/env python3
"""Generate the character tables from the decomp's charmap.txt.

Usage: python tools/gen_charmap.py [path/to/pokefirered]
Outputs: src/swg3/data/charmap_en.tsv (western section) and charmap_jp.tsv (Hiragana, Katakana, Japanese
punctuation), single-byte entries only. When two characters share a byte, the first one decodes.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "src" / "swg3" / "data" / "charmap_en.tsv"
OUT_JP = ROOT / "src" / "swg3" / "data" / "charmap_jp.tsv"
JP_SECTIONS = ("@ Hiragana", "@ Katakana", "@ Japanese punctuation")

LINE = re.compile(r"^'(.+)'\s*=\s*([0-9A-F]{2})\s*$")


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    western, japanese = [], []
    rows = western
    for line in (decomp / "charmap.txt").read_text(encoding="utf-8").splitlines():
        if line.startswith("@ "):
            if line.strip() in JP_SECTIONS:
                rows = japanese
            elif rows is japanese:
                rows = None
            continue
        if rows is None:
            continue
        match = LINE.match(line)
        if not match:
            continue
        char, byte = match.groups()
        if char in ("\\'", "\\\\"):   # apostrophe and backslash are escaped in the charmap
            char = char[1]
        if char.startswith("\\") or len(char) != 1:
            continue
        rows.append(f"{byte}\t{char}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(western) + "\n", encoding="utf-8")
    OUT_JP.write_text("\n".join(japanese) + "\n", encoding="utf-8")
    print(f"{len(western)} characters in {OUT.relative_to(ROOT)}, {len(japanese)} in {OUT_JP.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
