#!/usr/bin/env python3
"""Render the FR/LG box naming screen (the in-game keyboard) from the decomp graphics.

Usage: uv run --group tools python tools/gen_naming_screen.py [path/to/pokefirered]
Redraws src/naming_screen.c (LoadPalettes, DrawKeyboardPageOnDeck, PrintKeyboardKeys, PrintControls, CreateSprites)
with graphics/naming_screen/, graphics/fonts/ and the rows of src/keyboard_text.c; box headers from
graphics/pokemon_storage/wallpapers/ (SetBoxWallpaper, DrawWallpaper in src/pokemon_storage_system_menu.c). Sprites
© Nintendo/Creatures Inc./GAME FREAK inc.
Output: web/src/assets/naming/ (screen-<page>.png, cursor, lit buttons, glyphs, box headers and naming.json).
"""

import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from swg3.gen3 import boxnames, charset  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT_DIR = ROOT / "web" / "src" / "assets" / "naming"
SCREEN = (240, 160)
PAGES = ("upper", "lower", "symbols")            # order of boxnames.PAGES
KEYBOARD_TILEMAPS = ("keyboard_upper", "keyboard_lower", "keyboard_symbols")
FILL = (13, 14, 15)                              # sFillValues, palette 10 index
PAGE_SWAP = ("page_swap_upper", "page_swap_lower", "page_swap_others")
NEXT_SWAP = (1, 2, 0)                            # the button shows the next page
TEXT_ENTRY_PAL = 10
WHITE, DARK_GRAY, LIGHT_GRAY = 1, 2, 3           # include/characters.h, TEXT_COLOR_*
# sWindowTemplates: (x, y, width, height) in tiles.
WIN_KEYBOARD = (3, 10, 19, 8)
WIN_TEXT_ENTRY = (8, 6, 14, 2)
WIN_TEXT_ENTRY_BOX = (9, 4, 16, 2)
WIN_BANNER = (0, 0, 30, 2)
MAX_CHARS = 8                                    # BOX_NAME_LENGTH
INPUT_BASE_X = (SCREEN[0] - MAX_CHARS * 8) // 2 + 6   # inputCharBaseXPos (NamingScreen_Init)
# sKeypadIcons in src/text.c: first tile, width, height.
KEYPAD = {"A": (0x0, 8, 12), "B": (0x1, 8, 12), "DPAD": (0x22, 8, 12)}
WALLPAPERS = ("forest", "city", "desert", "savanna")   # WALLPAPER_FOREST to MAX_DEFAULT_WALLPAPER
HEADER_ROWS = 3


def color(value: int) -> tuple[int, int, int, int]:
    r, g, b = value & 31, (value >> 5) & 31, (value >> 10) & 31
    return (r << 3 | r >> 2, g << 3 | g >> 2, b << 3 | b >> 2, 255)


def palette(path: Path) -> list[tuple[int, int, int, int]]:
    """16 colors; shorter files are padded with black."""
    data = path.read_bytes()[:32]
    colors = [color(struct.unpack_from("<H", data, i)[0]) for i in range(0, len(data) - 1, 2)]
    return colors + [(0, 0, 0, 255)] * (16 - len(colors))


def tiles(path: Path) -> list[list[int]]:
    """8 x 8 4bpp tiles (left pixel in the low nibble)."""
    data = path.read_bytes()
    out = []
    for start in range(0, len(data), 32):
        pixels = []
        for byte in data[start:start + 32]:
            pixels += [byte & 15, byte >> 4]
        out.append(pixels)
    return out


def put_tile(image: Image.Image, tile: list[int], x: int, y: int, pal, hflip=False, vflip=False) -> None:
    px = image.load()
    for ty in range(8):
        for tx in range(8):
            value = tile[(7 - ty if vflip else ty) * 8 + (7 - tx if hflip else tx)]
            sx, sy = x + tx, y + ty
            if value and 0 <= sx < image.width and 0 <= sy < image.height:
                px[sx, sy] = pal[value]


def put_obj(image, sheet, x, y, width, height, pal, offset=0) -> None:
    """Sprite with 1D mapping: tiles follow in order, row by row."""
    for row in range(height):
        for col in range(width):
            put_tile(image, sheet[offset + row * width + col], x + col * 8, y + row * 8, pal)


def tilemap_layer(path: Path, sheet, palettes) -> Image.Image:
    layer = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
    data = path.read_bytes()
    for i in range(len(data) // 2):
        entry = struct.unpack_from("<H", data, i * 2)[0]
        tx, ty = i % 32, i // 32
        if tx * 8 >= SCREEN[0] or ty * 8 >= SCREEN[1]:
            continue
        number = entry & 0x3FF
        if number < len(sheet):
            put_tile(layer, sheet[number], tx * 8, ty * 8, palettes[entry >> 12], bool(entry & 0x400), bool(entry & 0x800))
    return layer


class Font:
    """Game font from the decomp PNG (gbagfx: 0 background, 1 color, 2 shadow, 3 glyph box)."""

    def __init__(self, png: Path, widths: list[int], cell: tuple[int, int], height: int):
        self.image = Image.open(png)
        self.widths = widths
        self.cell = cell
        self.height = height
        self.per_row = self.image.width // cell[0]

    def draw(self, image, glyph: int, x: int, y: int, fg, shadow) -> int:
        px = image.load()
        src = self.image.load()
        gx, gy = (glyph % self.per_row) * self.cell[0], (glyph // self.per_row) * self.cell[1]
        width = self.widths[glyph]
        for dy in range(self.height):
            for dx in range(width):
                value = src[gx + dx, gy + dy]
                if value in (1, 2) and 0 <= x + dx < image.width and 0 <= y + dy < image.height:
                    px[x + dx, y + dy] = fg if value == 1 else shadow
        return width


def glyph_widths(text_c: str, name: str) -> list[int]:
    body = re.search(rf"{name}\[\]\s*=\s*\{{(.*?)\}};", text_c, re.S).group(1)
    return [int(v, 0) for v in re.findall(r"0x[0-9A-Fa-f]+|\d+", body)]


def keyboard_rows(decomp: Path) -> dict[str, list]:
    """Tokens: ("clear", n) or ("char", byte)."""
    text = (decomp / "src" / "keyboard_text.c").read_text()
    rows = {}
    for name, body in re.findall(r"gText_NamingScreenKeyboard_(\w+)\[\]\s*=\s*_\(\"(.*?)\"\);", text):
        tokens = []
        for clear, char in re.findall(r"\{CLEAR (\d+)\}|(.)", body):
            tokens.append(("clear", int(clear)) if clear else ("char", charset.encode(char, 1)[0]))
        rows[name] = tokens
    return rows


ROW_NAMES = (("ABCDEF", "GHIJKL", "MNOPQRS", "TUVWXYZ"), ("abcdef", "ghijkl", "mnopqrs", "tuvwxyz"),
             ("01234", "56789", "Symbols1", "Symbols2"))


def window(layer, rect, fill) -> tuple[int, int]:
    x, y, w, h = rect
    Image.Image.paste(layer, fill, (x * 8, y * 8, (x + w) * 8, (y + h) * 8))
    return x * 8, y * 8


def column_x(source: str) -> list[list[int]]:
    """sPageColumnXPos in PAGES order (the file has lower, upper, symbols)."""
    body = re.search(r"sPageColumnXPos\[KBPAGE_COUNT\]\[KBCOL_COUNT\]\s*=\s*\{(.*?)\};", source, re.S).group(1)
    found = {k: [int(v) for v in vals.split(",")] for k, vals in re.findall(r"\[KEYBOARD_(\w+)\]\s*=\s*\{([^}]*)\}", body)}
    return [found["LETTERS_UPPER"], found["LETTERS_LOWER"], found["SYMBOLS"]]


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    gfx = decomp / "graphics" / "naming_screen"
    text_c = (decomp / "src" / "text.c").read_text()
    source = (decomp / "src" / "naming_screen.c").read_text()

    menu_pals = [palette(gfx / f"{n}.gbapal") for n in ("menu", *PAGE_SWAP, "buttons", "cursor")]
    keyboard_pal = palette(gfx / "keyboard.gbapal")
    banner_pal = palette(decomp / "graphics" / "text_window" / "stdpal_2.gbapal")
    bg_pals = {i: p for i, p in enumerate(menu_pals)} | {TEXT_ENTRY_PAL: keyboard_pal, 11: banner_pal}
    bg_pals = [bg_pals.get(i, [(0, 0, 0, 255)] * 16) for i in range(16)]
    menu = tiles(gfx / "menu.4bpp")

    normal_copy = Font(decomp / "graphics" / "fonts" / "latin_normal.png",
                       glyph_widths(text_c, "sFontNormalCopy1LatinGlyphWidths"), (16, 16), 14)
    normal = Font(decomp / "graphics" / "fonts" / "latin_normal.png",
                  glyph_widths(text_c, "sFontNormalLatinGlyphWidths"), (16, 16), 14)
    small = Font(decomp / "graphics" / "fonts" / "latin_small.png",
                 glyph_widths(text_c, "sFontSmallLatinGlyphWidths"), (8, 16), 13)
    keypad = Image.open(decomp / "graphics" / "fonts" / "keypad_icons.png")
    rows = keyboard_rows(decomp)

    def keyboard_layer(page: int) -> Image.Image:
        layer = tilemap_layer(gfx / f"{KEYBOARD_TILEMAPS[page]}.bin", menu, bg_pals)
        x, y = window(layer, WIN_KEYBOARD, keyboard_pal[FILL[page]])
        for i, name in enumerate(ROW_NAMES[page]):
            cx = x
            for kind, value in rows[name]:
                cx += value if kind == "clear" else normal_copy.draw(layer, value, cx, y + i * 16 + 1, keyboard_pal[WHITE], keyboard_pal[DARK_GRAY])
        return layer

    bg3 = tilemap_layer(gfx / "background.bin", menu, bg_pals)
    window(bg3, WIN_TEXT_ENTRY, keyboard_pal[WHITE])
    x, y = window(bg3, WIN_TEXT_ENTRY_BOX, keyboard_pal[WHITE])
    cx = x + 1
    for byte in charset.encode("BOX NAME?", 9):
        cx += normal_copy.draw(bg3, byte, cx, y + 1, keyboard_pal[DARK_GRAY], keyboard_pal[LIGHT_GRAY])

    bg0 = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
    bx, by = window(bg0, WIN_BANNER, banner_pal[15])
    banner = [("icon", "DPAD"), *[("char", b) for b in charset.encode("MOVE ", 5)], ("icon", "A"),
              *[("char", b) for b in charset.encode("OK ", 3)], ("icon", "B"), *[("char", b) for b in charset.encode("BACK", 4)]]
    width = sum(KEYPAD[v][1] if k == "icon" else small.widths[v] for k, v in banner)
    cx = bx + SCREEN[0] - 4 - width
    kp = keypad.load()
    for kind, value in banner:
        if kind == "char":
            cx += small.draw(bg0, value, cx, by, banner_pal[WHITE], banner_pal[DARK_GRAY])
            continue
        start, w, h = KEYPAD[value]
        px = bg0.load()
        for dy in range(h):
            for dx in range(w):
                t = start + (dy // 8) * 16 + dx // 8
                v = kp[(t % 16) * 8 + dx % 8, (t // 16) * 8 + dy % 8]
                if v:
                    px[cx + dx, by + dy] = banner_pal[v]
        cx += w

    sheets = {n: tiles(gfx / f"{n}.4bpp") for n in ("back_button", "ok_button", "page_swap_frame", "page_swap_button",
                                                     *PAGE_SWAP, "cursor", "cursor_squished", "cursor_filled",
                                                     "input_arrow", "underscore", "pc_icon_off", "pc_icon_on")}
    buttons_pal = menu_pals[4]

    for name in ("underscore", "input_arrow"):
        image = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        put_obj(image, sheets[name], 0, 0, 1, 1, menu_pals[3])
        image.save(OUT_DIR / f"{name.replace('_', '-')}.png", optimize=True)

    # Priority 1 sprites, bottom to top (CreatePageSwapButtonSprites, CreateBackOkSprites).
    def high(page: int) -> Image.Image:
        layer = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
        nxt = NEXT_SWAP[page]
        put_obj(layer, sheets["page_swap_button"], 204 - 16, 83 - 8, 4, 2, menu_pals[1 + nxt])
        put_obj(layer, sheets[PAGE_SWAP[nxt]], 204 - 12, 84 - 4, 3, 1, buttons_pal)
        put_obj(layer, sheets["page_swap_frame"], 204 - 20, 88 - 16, 5, 4, buttons_pal)
        put_obj(layer, sheets["back_button"], 204 - 20, 116 - 12, 5, 3, buttons_pal)
        put_obj(layer, sheets["ok_button"], 204 - 20, 140 - 12, 5, 3, buttons_pal)
        return layer

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    backdrop = menu_pals[0][0]
    for page, name in enumerate(PAGES):
        screen = Image.new("RGBA", SCREEN, backdrop)
        for layer in (bg3, keyboard_layer((page + 1) % 3), keyboard_layer(page), high(page), bg0):
            screen.alpha_composite(layer)
        screen.convert("RGB").save(OUT_DIR / f"screen-{name}.png", optimize=True)

    # Task_UpdateButtonFlash brightens color 14 up to white.
    lit_pal = [(0, 0, 0, 0)] * 14 + [(255, 255, 255, 255), (0, 0, 0, 0)]
    for name, sheet, (x, y, w, h) in (("page", "page_swap_frame", (0, 0, 5, 4)), ("back", "back_button", (0, 0, 5, 3)),
                                      ("ok", "ok_button", (0, 0, 5, 3))):
        image = Image.new("RGBA", (w * 8, h * 8), (0, 0, 0, 0))
        put_obj(image, sheets[sheet], x, y, w, h, lit_pal)
        image.save(OUT_DIR / f"lit-{name}.png", optimize=True)

    cursor_pal = menu_pals[5]
    lit_cursor = list(cursor_pal)
    lit_cursor[1] = (255, 255, 255, 255)
    strip = Image.new("RGBA", (16 * 4, 16), (0, 0, 0, 0))
    for i, (sheet, pal) in enumerate((("cursor", cursor_pal), ("cursor_squished", cursor_pal), ("cursor_filled", cursor_pal),
                                      ("cursor", lit_cursor))):
        put_obj(strip, sheets[sheet], 16 * i, 0, 2, 2, pal)
    strip.save(OUT_DIR / "cursor.png", optimize=True)

    pc = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    put_obj(pc, sheets["pc_icon_off"], 0, 0, 2, 3, menu_pals[0])
    put_obj(pc, sheets["pc_icon_on"], 16, 0, 2, 3, menu_pals[0])
    pc.save(OUT_DIR / "pc.png", optimize=True)

    chars = "".join(boxnames.KEYS)
    glyph_w = max(normal.widths[charset.encode(c, 1)[0]] for c in chars)
    atlas = Image.new("RGBA", (glyph_w * len(chars), normal.height), (0, 0, 0, 0))
    for i, char in enumerate(chars):
        normal.draw(atlas, charset.encode(char, 1)[0], i * glyph_w, 0, keyboard_pal[DARK_GRAY], keyboard_pal[LIGHT_GRAY])
    atlas.save(OUT_DIR / "glyphs.png", optimize=True)

    # Box title centered on the wallpaper (GetBoxTitleBaseX: x 176 on screen, wallpaper at x 80); sprite at y 28,
    # text 2 below its top, wallpaper at y 16.
    storage = decomp / "graphics" / "pokemon_storage"
    scrolling = palette(storage / "scrolling_bg.gbapal")
    for wallpaper in WALLPAPERS:
        folder = storage / "wallpapers" / wallpaper
        data = (folder / "tiles.gbapal").read_bytes()
        pals = [scrolling] + [[color(struct.unpack_from("<H", data, i)[0]) for i in range(start, start + 32, 2)] for start in (0, 32)]
        sheet = tiles(folder / "tiles.4bpp")
        header = Image.new("RGBA", (20 * 8, HEADER_ROWS * 8), (0, 0, 0, 0))
        tilemap = (folder / "tilemap.bin").read_bytes()
        for i in range(20 * HEADER_ROWS):
            entry = struct.unpack_from("<H", tilemap, i * 2)[0]
            if (entry & 0x3FF) < len(sheet):
                put_tile(header, sheet[entry & 0x3FF], (i % 20) * 8, (i // 20) * 8, pals[entry >> 12], bool(entry & 0x400), bool(entry & 0x800))
        header.save(OUT_DIR / f"box-{wallpaper}.png", optimize=True)
    title_w = max(normal_copy.widths[charset.encode(c, 1)[0]] for c in chars)
    title = Image.new("RGBA", (title_w * len(chars), normal_copy.height), (0, 0, 0, 0))
    shadow = color(7 | 7 << 5 | 7 << 10)
    for i, char in enumerate(chars):
        normal_copy.draw(title, charset.encode(char, 1)[0], i * title_w, 0, (255, 255, 255, 255), shadow)
    title.save(OUT_DIR / "title-glyphs.png", optimize=True)

    layout = {
        "screen": list(SCREEN),
        # SetCursorPos centers the 16 x 16 cursor at (column + 38, row * 16 + 88).
        "columns": column_x(source),
        "cursor": [38 - 8, 88 - 8],
        "row": 16,
        # Corner and size: page swap frame, BACK, OK.
        "buttons": [[184, 72, 40, 32], [184, 104, 40, 24], [184, 128, 40, 24]],
        # Character i at (x + 8i, y) (DrawTextEntry).
        "text": [INPUT_BASE_X, WIN_TEXT_ENTRY[1] * 8 + 1],
        "pc": [56 - 8, 41 - 12],
        # Sprite centers (CreateTextEntrySprites): underscore i at (x + 3 + 8i, 60), arrow at (x - 5, 56).
        "underscore": [INPUT_BASE_X + 3 - 4, 60 - 4],
        "arrow": [INPUT_BASE_X - 5 - 4, 56 - 4],
        "glyphs": {"chars": chars, "width": glyph_w, "height": normal.height},
        "box": {"wallpapers": list(WALLPAPERS), "size": [20 * 8, HEADER_ROWS * 8], "center": 80, "y": 28 - 8 + 2 - 16,
                "glyph": title_w, "widths": [normal_copy.widths[charset.encode(c, 1)[0]] for c in chars]},
    }
    (OUT_DIR / "naming.json").write_text(json.dumps(layout, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"box naming screen in {OUT_DIR.relative_to(ROOT)}: {len(PAGES)} pages, {len(chars)} letters")


if __name__ == "__main__":
    main()
