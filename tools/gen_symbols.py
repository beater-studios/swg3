#!/usr/bin/env python3
"""Generate the symbol table of the Switch build from the decomp's .elf.

Usage: python tools/gen_symbols.py [path/to/pokefirered] [build]
Default build "pokefirered_switch"; needs arm-none-eabi-nm and the built .elf (make compare_firered_switch).
Output: src/swg3/data/<build without "poke">.sym.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECOMP = ROOT / "references" / "pokefirered"


def main():
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    build = sys.argv[2] if len(sys.argv) > 2 else "pokefirered_switch"
    elf = decomp / f"{build}.elf"
    out = ROOT / "src" / "swg3" / "data" / f"{build.removeprefix('poke')}.sym"

    nm = subprocess.run(
        ["arm-none-eabi-nm", "-S", "-n", str(elf)],
        check=True, capture_output=True, text=True,
    ).stdout

    rows = []
    for line in nm.splitlines():
        parts = line.split()
        if len(parts) == 4:
            address, size, kind, name = parts
        elif len(parts) == 3:
            address, kind, name = parts
            size = "0"
        else:
            continue
        if kind in "aAUw" or name.startswith("$"):
            continue
        rows.append(f"{int(address, 16):08X}\t{int(size, 16):X}\t{kind}\t{name}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"{len(rows)} symbols in {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
