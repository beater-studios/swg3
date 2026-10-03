#!/usr/bin/env python3
"""Cut the closed battle Poké Ball for the site's search progress.

Usage: uv run --group tools python tools/gen_ball.py [path/to/pokefirered]
Source: graphics/interface/ball/poke.4bpp and poke.gbapal (gBallGfx_Poke, gBallPal_Poke,
src/data/graphics/interface_pokeballs.h), frame 0 of sBallAnimSeq0 (src/pokeball.c); sprites © Nintendo/Creatures
Inc./GAME FREAK inc. Output: web/src/assets/ball-poke.png (16 x 16).
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_naming_screen import palette, put_obj, tiles  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "web" / "src" / "assets" / "ball-poke.png"


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    ball = decomp / "graphics" / "interface" / "ball"
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    put_obj(image, tiles(ball / "poke.4bpp"), 0, 0, 2, 2, palette(ball / "poke.gbapal"))
    image.save(OUT, optimize=True)
    print(f"Poké Ball in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
