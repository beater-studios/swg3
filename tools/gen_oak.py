#!/usr/bin/env python3
"""Art for the guided tour (Professor Oak), from the FR/LG decomp.

Usage: uv run --group tools python tools/gen_oak.py [path/to/pokefirered]
Sources (sprites © Nintendo/Creatures Inc./GAME FREAK inc.): graphics/oak_speech/oak/pic.png with pal.gbapal
(src/oak_speech.c); graphics/text_window/menu_message.png with stdpal_0, laid out like WindowFunc_DrawDialogueFrame
(src/new_menu_helpers.c); graphics/fonts/down_arrows.png (sDownArrowYCoords, src/text.c).
Output: web/src/assets/oak/oak.png, head.png, dialog.png, arrow.png.
"""

import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_naming_screen import color, palette  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT = ROOT / "web" / "src" / "assets" / "oak"
INNER = 4   # kept small: the site stretches it (border-image, 16 px slices)
HEAD = (22, 4, 54, 36)
# Frame rows: left tiles, middle tile (None = inside), right tiles, vertical flip.
DIALOG_ROWS = [
    ([0, 1], 2, [3, 4], False),
    ([5, 6], None, [8, 9], False),
    ([10, 11], None, [12, 13], False),
    ([10, 11], None, [12, 13], True),
    ([5, 6], None, [8, 9], True),
    ([0, 1], 2, [3, 4], True),
]
ARROW_X = (0, 16, 32)


def oak(decomp: Path) -> Image.Image:
    folder = decomp / "graphics" / "oak_speech" / "oak"
    raw = (folder / "pal.gbapal").read_bytes()
    pal = [color(struct.unpack_from("<H", raw, i)[0]) for i in range(0, len(raw), 2)]
    pic = Image.open(folder / "pic.png")
    px = pic.load()
    out = Image.new("RGBA", pic.size, (0, 0, 0, 0))
    for y in range(pic.height):
        for x in range(pic.width):
            v = px[x, y]
            if v and (v - 0x60) % 16:
                out.putpixel((x, y), pal[v - 0x60])
    return out


def dialog(decomp: Path) -> Image.Image:
    folder = decomp / "graphics" / "text_window"
    pal = palette(folder / "stdpal_0.gbapal")
    sheet = Image.open(folder / "menu_message.png")
    px = sheet.load()

    def tile(n: int, vflip: bool) -> Image.Image:
        out = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        tx, ty = (n % 6) * 8, (n // 6) * 8
        for y in range(8):
            for x in range(8):
                v = px[tx + x, ty + (7 - y if vflip else y)]
                if v:
                    out.putpixel((x, y), pal[v])
        return out

    fill = Image.new("RGBA", (8, 8), pal[1])
    out = Image.new("RGBA", ((INNER + 4) * 8, len(DIALOG_ROWS) * 8), (0, 0, 0, 0))
    for row, (left, middle, right, vflip) in enumerate(DIALOG_ROWS):
        for i, n in enumerate(left):
            out.alpha_composite(tile(n, vflip), (i * 8, row * 8))
        for c in range(INNER):
            out.alpha_composite(tile(middle, vflip) if middle is not None else fill, ((2 + c) * 8, row * 8))
        for i, n in enumerate(right):
            out.alpha_composite(tile(n, vflip), ((2 + INNER + i) * 8, row * 8))
    return out


def arrow(decomp: Path) -> Image.Image:
    pal = palette(decomp / "graphics" / "text_window" / "stdpal_0.gbapal")
    sheet = Image.open(decomp / "graphics" / "fonts" / "down_arrows.png")
    px = sheet.load()
    out = Image.new("RGBA", (10 * len(ARROW_X), 12), (0, 0, 0, 0))
    for i, x0 in enumerate(ARROW_X):
        for y in range(12):
            for x in range(10):
                v = px[x0 + x, y]
                if v:
                    out.putpixel((10 * i + x, y), pal[v])
    return out


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    OUT.mkdir(parents=True, exist_ok=True)
    pic = oak(decomp)
    pic.save(OUT / "oak.png", optimize=True)
    pic.crop(HEAD).save(OUT / "head.png", optimize=True)
    dialog(decomp).save(OUT / "dialog.png", optimize=True)
    arrow(decomp).save(OUT / "arrow.png", optimize=True)
    print(f"Oak, dialog box and arrow in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
