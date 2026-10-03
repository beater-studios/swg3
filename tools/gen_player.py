#!/usr/bin/env python3
"""Cut the walking player character of each theme, and Mew, for the site's empty states.

Usage: uv run --group tools python tools/gen_player.py [path/to/pokefirered]
Sources (sprites © Nintendo/Creatures Inc./GAME FREAK inc.): graphics/object_events/pics/people/red_normal.4bpp and
green_normal.4bpp with palettes/player.gbapal (sObjectEventSpritePalettes, src/event_object_movement.c), frames of
sAnim_GoWest (src/data/object_events/object_event_anims.h); R/S/E players and Emerald's Mew from pret/pokeruby and
pret/pokeemerald, downloaded to references/sprites/rse/ (not in git).
Output: web/src/assets/player-<theme>.png (64 x 32) and mew.png (all 9 frames, 144 x 32).
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_naming_screen import palette, put_obj, tiles  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT_DIR = ROOT / "web" / "src" / "assets"
WALK_WEST = (7, 2, 8, 2)   # sAnim_GoWest
RSE_DIR = ROOT / "references" / "sprites" / "rse"
# Theme: file in references/sprites/rse/ and the JASC palette when not the PNG's own.
RSE = {"brendan": ("rs_brendan_normal.png", None), "may-rs": ("rs_may_normal.png", None), "brendan-e": ("e_brendan_walking.png", "e_brendan.pal")}


def transparent(png: Path) -> Image.Image:
    image = Image.open(png)
    rgba, idx = image.convert("RGBA"), image.load()
    px = rgba.load()
    for y in range(image.height):
        for x in range(image.width):
            if idx[x, y] == 0:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def indexed_strip(png: Path, pal_file: Path | None) -> Image.Image:
    image = Image.open(png)
    if pal_file:
        rows = pal_file.read_text().split("\n")[3:19]
        image.putpalette([c for row in rows for c in map(int, row.split())])
    rgba, idx = image.convert("RGBA"), image.load()
    px = rgba.load()
    for y in range(image.height):
        for x in range(image.width):
            if idx[x, y] == 0:
                px[x, y] = (0, 0, 0, 0)
    strip = Image.new("RGBA", (16 * len(WALK_WEST), 32), (0, 0, 0, 0))
    for i, frame in enumerate(WALK_WEST):
        strip.paste(rgba.crop((16 * frame, 0, 16 * frame + 16, 32)), (16 * i, 0))
    return strip


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    gfx = decomp / "graphics" / "object_events"
    pal = palette(gfx / "palettes" / "player.gbapal")
    for name, source in (("red", "red_normal"), ("leaf", "green_normal")):
        sheet = tiles(gfx / "pics" / "people" / f"{source}.4bpp")
        strip = Image.new("RGBA", (16 * len(WALK_WEST), 32), (0, 0, 0, 0))
        for i, frame in enumerate(WALK_WEST):
            put_obj(strip, sheet, 16 * i, 0, 2, 4, pal, offset=8 * frame)
        strip.save(OUT_DIR / f"player-{name}.png", optimize=True)
    for name, (png, pal_file) in RSE.items():
        indexed_strip(RSE_DIR / png, RSE_DIR / pal_file if pal_file else None).save(OUT_DIR / f"player-{name}.png", optimize=True)
    mew = transparent(RSE_DIR / "e_mew.png")
    assert mew.size == (16 * 9, 32), mew.size
    mew.save(OUT_DIR / "mew.png", optimize=True)
    print(f"walking characters in {OUT_DIR.relative_to(ROOT)}: red, leaf, {', '.join(RSE)} and Mew")


if __name__ == "__main__":
    main()
