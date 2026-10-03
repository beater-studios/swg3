#!/usr/bin/env python3
"""FR/LG summary screen parts for the editor card's in-game view.

Usage: uv run --group tools python tools/gen_summary.py [path/to/pokefirered]
Follows src/pokemon_summary_screen.c (PokeSum_DrawPageProgressTiles) with graphics/summary_screen/, the fonts,
sMenuInfoIcons, graphics/interface/ball/ and gAbilityDescriptionPointers (src/data/text/abilities.h); sprites
© Nintendo/Creatures Inc./GAME FREAK inc.
Output: web/src/assets/summary/ (page-<page>[-shiny].png, font mask, icons, bars and summary.json).
"""

import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))

from swg3.gen3 import charset  # noqa: E402
from gen_naming_screen import SCREEN, Font, color, glyph_widths, palette, put_obj, put_tile, tiles  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
OUT_DIR = ROOT / "web" / "src" / "assets" / "summary"
PAGES = ("info", "skills", "moves")
TITLES = {"info": "POKéMON INFO", "skills": "POKéMON SKILLS", "moves": "KNOWN MOVES"}
# Top controls (strings.c).
CONTROLS = {"info": [("icon", 0xF), ("text", "PAGE "), ("icon", 0x0), ("text", "CANCEL")],
            "skills": [("icon", 0x21), ("text", "PAGE")],
            "moves": [("icon", 0xE), ("text", "PAGE "), ("icon", 0x0), ("text", "DETAIL")]}
PROGRESS = {   # PokeSum_DrawPageProgressTiles: n at (x, y), tile 345 + n, palette 0
    "info": [(17, 13, 0), (33, 13, 1), (16, 14, 0), (32, 14, 1), (18, 15, 0), (34, 15, 1), (20, 16, 0), (36, 16, 1), (18, 17, 0), (34, 17, 1), (21, 18, 0), (37, 18, 1)],
    "skills": [(49, 13, 0), (65, 13, 1), (1, 14, 0), (19, 14, 1), (17, 15, 0), (33, 15, 1), (16, 16, 0), (32, 16, 1), (18, 17, 0), (34, 17, 1), (21, 18, 0), (37, 18, 1)],
    "moves": [(49, 13, 0), (65, 13, 1), (1, 14, 0), (19, 14, 1), (49, 15, 0), (65, 15, 1), (1, 16, 0), (19, 16, 1), (17, 17, 0), (33, 17, 1), (48, 18, 0), (64, 18, 1)],
}
# sMenuInfoIcons: first tile of each type icon (type id 0 to 17), 32 x 12.
TYPE_ICONS = [0x20, 0x64, 0x60, 0x80, 0x48, 0x44, 0x6C, 0x68, 0x88, 0xA4, 0x24, 0x28, 0x2C, 0x40, 0x84, 0x4C, 0xA0, 0x8C]
# Item ids 1 (ITEM_MASTER_BALL) to 12 (ITEM_PREMIER_BALL).
BALLS = ["master", "ultra", "great", "poke", "safari", "net", "dive", "nest", "repeat", "timer", "luxury", "premier"]


def palettes(path: Path) -> list:
    data = path.read_bytes()
    return [[color(struct.unpack_from("<H", data, o + i)[0]) for i in range(0, 32, 2)] for o in range(0, len(data) - 31, 32)]


def draw_map(image: Image.Image, entries: list[int], sheet: list, pals: list) -> None:
    for i, entry in enumerate(entries):
        x, y = i % 32, i // 32
        if x < 30 and y < 20 and (entry & 0x3FF) and (entry & 0x3FF) < len(sheet):
            put_tile(image, sheet[entry & 0x3FF], x * 8, y * 8, pals[entry >> 12], bool(entry & 0x400), bool(entry & 0x800))


def read_map(path: Path) -> list[int]:
    data = path.read_bytes()
    return [struct.unpack_from("<H", data, i)[0] for i in range(0, len(data), 2)]


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    gfx = decomp / "graphics"
    ss = gfx / "summary_screen"
    text_c = (decomp / "src" / "text.c").read_text()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bg_pals = palettes(ss / "bg.gbapal")
    sheet = tiles(ss / "bg.4bpp")
    header = palette(ss / "text_header.gbapal")
    normal = Font(gfx / "fonts" / "latin_normal.png", glyph_widths(text_c, "sFontNormalLatinGlyphWidths"), (16, 16), 14)
    small = Font(gfx / "fonts" / "latin_small.png", glyph_widths(text_c, "sFontSmallLatinGlyphWidths"), (8, 16), 13)
    keypad = Image.open(gfx / "fonts" / "keypad_icons.png")
    base = read_map(ss / "moves_info_page.bin")

    def text_width(tokens):
        return sum(8 if kind == "icon" else sum(small.widths[b] for b in charset.encode(value, len(value))) for kind, value in tokens)

    for shiny in (False, True):
        pals = [list(p) for p in bg_pals[:5]] + [[(0, 0, 0, 255)] * 16] * 11
        if shiny:
            pals[0], pals[1] = bg_pals[6], bg_pals[5]
        for page in PAGES:
            image = Image.new("RGBA", SCREEN, pals[0][0])
            entries = list(base)
            for n, x, y in PROGRESS[page]:
                entries[y * 32 + x] = 345 + n
            draw_map(image, entries, sheet, pals)
            draw_map(image, read_map(ss / f"page_{page}.bin"), sheet, pals)
            # Title in FONT_NORMAL at (4, 1), controls in FONT_SMALL right aligned at 236.
            x = 4
            for byte in charset.encode(TITLES[page], len(TITLES[page])):
                x += normal.draw(image, byte, x, 1, header[1], header[2])
            x = 236 - text_width(CONTROLS[page])
            kp, px = keypad.load(), image.load()
            for kind, value in CONTROLS[page]:
                if kind == "icon":
                    for dy in range(12):
                        for dx in range(8):
                            t = value + (dy // 8) * 16 + dx // 8
                            v = kp[(t % 16) * 8 + dx % 8, (t // 16) * 8 + dy % 8]
                            if v:
                                px[x + dx, dy] = header[v]
                    x += 8
                else:
                    for byte in charset.encode(value, len(value)):
                        x += small.draw(image, byte, x, 0, header[1], header[2])
            image.convert("RGB").save(OUT_DIR / f"page-{page}{'-shiny' if shiny else ''}.png", optimize=True)

    mask = Image.new("RGBA", normal.image.size, (0, 0, 0, 0))
    src, dst = normal.image.load(), mask.load()
    for y in range(mask.height):
        for x in range(mask.width):
            if src[x, y] == 1:
                dst[x, y] = (255, 0, 0, 255)
            elif src[x, y] == 2:
                dst[x, y] = (0, 255, 0, 255)
    mask.save(OUT_DIR / "font-normal.png", optimize=True)

    menu = tiles(gfx / "interface" / "menu_info.4bpp")
    types_pal = palette(gfx / "interface" / "pokemon_types.gbapal")
    strip = Image.new("RGBA", (32 * len(TYPE_ICONS), 12), (0, 0, 0, 0))
    for i, start in enumerate(TYPE_ICONS):
        icon = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
        put_obj(icon, menu, 0, 0, 4, 1, types_pal, offset=start)
        put_obj(icon, menu, 0, 8, 4, 1, types_pal, offset=start + 16)
        strip.paste(icon.crop((0, 0, 32, 12)), (32 * i, 0))
    strip.save(OUT_DIR / "types.png", optimize=True)

    balls = Image.new("RGBA", (16 * len(BALLS), 16), (0, 0, 0, 0))
    for i, name in enumerate(BALLS):
        folder = gfx / "interface" / "ball"
        put_obj(balls, tiles(folder / f"{name}.4bpp"), 16 * i, 0, 2, 2, palette(folder / f"{name}.gbapal"))
    balls.save(OUT_DIR / "balls.png", optimize=True)

    extras = Image.new("RGBA", (48, 8), (0, 0, 0, 0))
    put_obj(extras, tiles(ss / "shiny_star.4bpp"), 0, 0, 1, 1, palette(ss / "shiny_star.gbapal"), offset=1)
    put_obj(extras, tiles(ss / "pokerus_cured.4bpp"), 8, 0, 1, 1, palette(ss / "pokerus_cured.gbapal"))
    put_obj(extras, tiles(ss / "status_ailment_icons.4bpp"), 16, 0, 4, 1, palette(ss / "status_ailment_icons.gbapal"), offset=4 * 5)
    extras.save(OUT_DIR / "extras.png", optimize=True)   # star, cured Pokérus, PKRS (32 x 8)

    bar = Image.new("RGBA", (96, 32), (0, 0, 0, 0))
    hp = tiles(ss / "hp_bar.4bpp")
    for row, pal_file in enumerate(("exp_bar.gbapal", "hp_bar_yellow.gbapal", "hp_bar_red.gbapal")):
        put_obj(bar, hp, 0, row * 8, 12, 1, palette(ss / pal_file))
    put_obj(bar, tiles(ss / "exp_bar.4bpp"), 0, 24, 12, 1, palette(ss / "exp_bar.gbapal"))
    bar.save(OUT_DIR / "bars.png", optimize=True)   # rows: HP green, yellow, red; EXP

    abilities_h = (decomp / "src" / "data" / "text" / "abilities.h").read_text()
    texts = dict(re.findall(r"static const u8 (s\w+Description)\[\] = _\(\"(.*?)\"\);", abilities_h))
    constants = (decomp / "include" / "constants" / "abilities.h").read_text()
    ids = {name: int(v) for name, v in re.findall(r"#define (ABILITY_\w+)\s+(\d+)", constants)}
    descs = {ids[name]: texts[sym] for name, sym in re.findall(r"\[(ABILITY_\w+)\] = (s\w+Description)", abilities_h) if name in ids}
    hexes = lambda pal: ["#%02x%02x%02x" % c[:3] for c in pal]
    layout = {
        "colors": {"types": hexes(types_pal), "header": hexes(header), "moves": hexes(palette(ss / "text_moves.gbapal"))},
        "widths": normal.widths,
        "ability_desc": [descs.get(i, "") for i in range(max(descs) + 1)],
        "balls": BALLS,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(layout, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"summary screen in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
