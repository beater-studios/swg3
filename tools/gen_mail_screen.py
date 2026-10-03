#!/usr/bin/env python3
"""Render the FR/LG Mail writing screen (Mail Easy Chat) with the words of the pre-E4 route.

Usage: uv run --group tools python tools/gen_mail_screen.py [path/to/pokefirered]
Redraws LoadEasyChatGraphics (src/easy_chat_3.c) from the decomp graphics (sprites © Nintendo/Creatures Inc./GAME
FREAK inc.). Words from pokemon-ace-notes (frlg-non-jpn-pre-e4-route), checked against src/data/easy_chat.
Output: web/src/assets/mail/glitch.png, first.png, second.png (240 x 160).
"""

import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))

from swg3.gen3 import charset  # noqa: E402
from gen_naming_screen import SCREEN, Font, glyph_widths, palette, put_tile, tiles, tilemap_layer, window  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT_DIR = ROOT / "web" / "src" / "assets" / "mail"
UNSET = "???"   # gText_ThreeQuestionMarks
# Game order: row by row, 2 columns.
SCREENS = {
    "glitch": [UNSET] * 9,
    "first": [UNSET, "HIGHS", "I CHOOSE YOU", "WANDERING"] + [UNSET] * 5,
    "second": [UNSET, "WANDERING", "I CHOOSE YOU", "HIGHS"] + [UNSET] * 5,
}
FRAME = (3, 0, 24, 10)          # sPhraseFrameDimensions[2]: left, top, width, height in tiles
COLUMNS, ROWS = 2, 5
FOOTER = (4, 11, 24, 2)         # CreateFooterWindow
INSTRUCTIONS = (4, 15, 22, 4)   # sEasyChatWindowTemplates[1]
CLEAR = 17                      # sText_Clear17
WHITE, DARK_GRAY, LIGHT_GRAY = 1, 2, 3


def text(image, font, x, y, tokens, pal) -> None:
    """Tokens: text or ("clear_to", x)."""
    cx = x
    for token in tokens:
        if isinstance(token, tuple):
            cx = max(cx, x + token[1])
            continue
        for byte in charset.encode(token, len(token)):
            cx += font.draw(image, byte, cx, y, pal[DARK_GRAY], pal[LIGHT_GRAY])


def screen(decomp: Path, words: list[str]) -> Image.Image:
    gfx = decomp / "graphics" / "easy_chat"
    text_c = (decomp / "src" / "text.c").read_text()
    font = Font(decomp / "graphics" / "fonts" / "latin_normal.png", glyph_widths(text_c, "sFontNormalCopy1LatinGlyphWidths"), (16, 16), 14)
    window_pal = palette(gfx / "window.gbapal")
    orange = palette(gfx / "text_input_frame_orange.gbapal")
    text_pal = palette(gfx / "text.gbapal")
    user_pal = palette(decomp / "graphics" / "text_window" / "type1.gbapal")
    blank = [(0, 0, 0, 255)] * 16
    bg_pals = [window_pal, orange] + [blank] * 14

    bg3 = tilemap_layer(gfx / "window.bin", tiles(gfx / "window.4bpp"), bg_pals)
    fx, fy = window(bg3, FRAME, text_pal[WHITE])
    for row in range(ROWS):
        tokens, cx = [], CLEAR
        for col in range(COLUMNS):
            index = row * COLUMNS + col
            if index >= len(words):
                break
            tokens += [("clear_to", cx), words[index]]
            cx += sum(font.widths[b] for b in charset.encode(words[index], len(words[index]))) + CLEAR
        text(bg3, font, fx, fy + row * 16 + 2, tokens, text_pal)
    x, y = window(bg3, FOOTER, text_pal[WHITE])
    text(bg3, font, x, y + 2, ["DEL. ALL", ("clear_to", 0x57), "CANCEL", ("clear_to", 0xA4), "OK"], text_pal)

    # BG1: DrawECFrameInTilemapBuffer; Mail has no top or bottom border.
    bg1 = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
    frame = tiles(gfx / "text_input_frame.4bpp")
    left, top, width, height = FRAME
    for ty in range(top, top + height):
        put_tile(bg1, frame[5], (left - 1) * 8, ty * 8, orange)
        for tx in range(left, left + width):
            put_tile(bg1, frame[0], tx * 8, ty * 8, orange)
        put_tile(bg1, frame[7], (left + width) * 8, ty * 8, orange)

    # BG0: DrawTextBorderOuter (tiles 0 to 8 without the middle tile 4).
    bg0 = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
    border = tiles(decomp / "graphics" / "text_window" / "type1.4bpp")
    left, top, width, height = INSTRUCTIONS
    for tx in range(left - 1, left + width + 1):
        for ty in range(top - 1, top + height + 1):
            col = 0 if tx < left else 2 if tx >= left + width else 1
            row = 0 if ty < top else 2 if ty >= top + height else 1
            if (col, row) != (1, 1):
                put_tile(bg0, border[row * 3 + col], tx * 8, ty * 8, user_pal)
    x, y = window(bg0, INSTRUCTIONS, text_pal[WHITE])
    text(bg0, font, x, y + 2, ["Combine nine words or phrases"], text_pal)
    text(bg0, font, x, y + 16 + 2, ["and make a message."], text_pal)

    out = Image.new("RGBA", SCREEN, window_pal[0])
    for layer in (bg3, bg1, bg0):
        out.alpha_composite(layer)
    return out.convert("RGB")


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, words in SCREENS.items():
        screen(decomp, words).save(OUT_DIR / f"{name}.png", optimize=True)
    print(f"Mail screen in {OUT_DIR.relative_to(ROOT)}: {', '.join(SCREENS)}")


if __name__ == "__main__":
    main()
