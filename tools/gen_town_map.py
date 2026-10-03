#!/usr/bin/env python3
"""Build the site's region map (Town Map): crops from the sprite sheets and the location grid from the decomp.

Usage: uv run --group tools python tools/gen_town_map.py [path/to/pokefirered]
Images: FR/LG "Town Map" sheet on The Spriters Resource, ripped by FrenchOrange
(https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3864/; sprites © Nintendo/Creatures
Inc./GAME FREAK inc.) in references/sprites/frlg_town_map_sheet.png, and the Hoenn sheet (HOENN_SHEET).
Grid: sRegionMapSections_* (src/data/region_map/region_map_layout_*.h), 22 x 15 cells, map and dungeon layers; cell
(x, y) at screen pixel (32 + 8x, 32 + 8y) (src/region_map.c).
Outputs: web/src/assets/townmap/ (map, case halves, cursor, region switch) and src/swg3/data/frlg_region_map.json.
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_species_data import emerald_sections, map_sections  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
SHEET = ROOT / "references" / "sprites" / "frlg_town_map_sheet.png"
OUT_DIR = ROOT / "web" / "src" / "assets" / "townmap"
OUT_JSON = ROOT / "src" / "swg3" / "data" / "frlg_region_map.json"
KEY = (255, 127, 39)
SCREEN = (240, 160)
# Game order (the region switch).
REGIONS = [
    ("kanto", "Kanto", "region_map_layout_kanto.h"),
    ("sevii123", "Sevii 1-3", "region_map_layout_sevii_123.h"),
    ("sevii45", "Sevii 4-5", "region_map_layout_sevii_45.h"),
    ("sevii67", "Sevii 6-7", "region_map_layout_sevii_67.h"),
]
# Sheet positions (top left corner of each 240 x 160 screen).
RAW_MAP_ROW_Y = 1088             # without markers or frame
MARKED_MAP_ROW_Y = 927           # with markers, inside the open case
MAP_AREA = (24, 16, 216, 160)    # between the open case halves, below the bar
SCREEN_X = (8, 249, 490, 731)
CLOSED_CASE = (8, 42)
CASE_X = (91, 120, 149)          # left, middle, right
CASE_Y = (11, 160)               # top at the middle (curves down to 23 at the ends)
CURSOR = ((732, 60), (750, 60))
# The bottom right buttons are covered with the water just to their right: its stripes are horizontal, so each row
# is one color (the left side has an island in Sevii 1-3).
ICON = (196, 116, 213, 148)
WATER_X = 214
WATER = {(156, 214, 255), (165, 181, 255)}
SWITCH_X = (8, 106)              # selected and unselected, 96 x 32
SWITCH_Y = (561, 595, 629, 663)


def keyed(image: Image.Image, key: tuple[int, int, int] = KEY) -> Image.Image:
    out = image.convert("RGBA")
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y][:3] == key:
                px[x, y] = (0, 0, 0, 0)
    return out


def crop(sheet: Image.Image, x: int, y: int, w: int, h: int) -> Image.Image:
    return sheet.crop((x, y, x + w, y + h))


def images(sheet: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for (region, _, _), x in zip(REGIONS, SCREEN_X):
        screen = crop(sheet, x, RAW_MAP_ROW_Y, *SCREEN)
        x0, y0, x1, y1 = MAP_AREA
        screen.paste(crop(sheet, x + x0, MARKED_MAP_ROW_Y + y0, x1 - x0, y1 - y0), (x0, y0))
        px = screen.load()
        x0, y0, x1, y1 = ICON
        for y in range(y0, y1):
            assert px[WATER_X, y][:3] in WATER, (region, y, px[WATER_X, y])
            for xx in range(x0, x1):
                px[xx, y] = px[WATER_X, y]
        screen.save(OUT_DIR / f"map-{region}.png", optimize=True)
    left, middle, right = CASE_X
    top, bottom = CASE_Y
    cx, cy = CLOSED_CASE
    black = (0, 0, 0)
    keyed(crop(sheet, cx + left, cy + top, middle - left, bottom - top), black).save(OUT_DIR / "case-left.png", optimize=True)
    keyed(crop(sheet, cx + middle, cy + top, right - middle, bottom - top), black).save(OUT_DIR / "case-right.png", optimize=True)
    strip = Image.new("RGBA", (16 * len(CURSOR), 16))
    for i, (x, y) in enumerate(CURSOR):
        strip.paste(keyed(crop(sheet, x, y, 16, 16)), (16 * i, 0))
    strip.save(OUT_DIR / "cursor.png", optimize=True)
    for (region, _, _), y in zip(REGIONS, SWITCH_Y):
        crop(sheet, SWITCH_X[0], y, 96, 32).save(OUT_DIR / f"switch-{region}-on.png", optimize=True)
        crop(sheet, SWITCH_X[1], y, 96, 32).save(OUT_DIR / f"switch-{region}-off.png", optimize=True)


# Hoenn: Emerald "Hoenn Map UI" sheet by Zeronutty, sprites © Nintendo/Creatures Inc./GAME FREAK inc.
# (https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/116724/). Grid from pokeemerald
# region_map_layout.h, cell (x, y) at map pixel (8 + 8x, 16 + 8y) (MAPCURSOR_X_MIN, MAPCURSOR_Y_MIN in src/region_map.c).
HOENN = ROOT / "references" / "sprites" / "hoenn"
HOENN_SHEET = ROOT / "references" / "sprites" / "hoenn_map_sheet.png"
HOENN_SECTIONS = ROOT / "references" / "pokeemerald" / "src" / "data" / "region_map" / "region_map_sections.json"
HOENN_SIZE = (28, 15)
HOENN_MAP_AT = (24, 16)
HOENN_SCREEN = (288, 176)
TALL_ROWS = ((72, 8), (120, 8))          # case row repeated and how many times


def tall_case(image: Image.Image) -> Image.Image:
    rows = [image.crop((0, y, image.width, y + 1)) for y in range(image.height)]
    for y, count in sorted(TALL_ROWS, reverse=True):
        assert rows[y].tobytes() == rows[y - 1].tobytes() == rows[y + 1].tobytes(), y
        rows[y:y] = [rows[y]] * count
    out = Image.new("RGBA", (image.width, len(rows)))
    for y, row in enumerate(rows):
        out.paste(row, (0, y))
    return out


def hoenn_images() -> None:
    sheet = Image.open(HOENN_SHEET).convert("RGB")
    crop(sheet, 0, 0, *SCREEN).save(OUT_DIR / "map-hoenn.png", optimize=True)
    for side in ("left", "right"):
        tall_case(Image.open(OUT_DIR / f"case-{side}.png").convert("RGBA")).save(OUT_DIR / f"case-{side}-tall.png", optimize=True)


def hoenn_grid(decomp: Path) -> dict:
    """Sections 0 to 0x57 share FR/LG numbers, the rest are Emerald's (0xC5 on). Collisions go into `extra`."""
    by_name = {name: value for value, name in map_sections(decomp).items() if value < 0x58}
    by_name |= {name: int(value) for value, name in emerald_sections().items()}
    # pokeemerald generates MAPSEC_NONE as MAPSEC_COUNT.
    none = by_name["NONE"] = len(json.loads(HOENN_SECTIONS.read_text())["map_sections"])
    text = (HOENN / "region_map_layout.h").read_text()
    rows = [[by_name[c.strip().removeprefix("MAPSEC_")] for c in row.split(",") if c.strip()] for row in re.findall(r"\{(MAPSEC_[^{}]*)\}", text)]
    width, height = HOENN_SIZE
    assert len(rows) == height and all(len(r) == width for r in rows)
    on_map = {c for row in rows for c in row}
    dungeon = [[none] * width for _ in range(height)]
    extra = []
    for entry in json.loads(HOENN_SECTIONS.read_text())["map_sections"]:
        name = entry["id"].removeprefix("MAPSEC_")
        section = by_name.get(name)
        if section is None or section in on_map or not entry.get("width") or not entry.get("height"):
            continue
        for y in range(entry["y"], entry["y"] + entry["height"]):
            for x in range(entry["x"], entry["x"] + entry["width"]):
                if not (0 <= x < width and 0 <= y < height):
                    continue
                if dungeon[y][x] == none:
                    dungeon[y][x] = section
                elif dungeon[y][x] != section:
                    extra.append([x, y, section])
    mx, my = HOENN_MAP_AT
    sw, sh = HOENN_SCREEN
    middle = sw // 2
    return {"id": "hoenn", "name": "Hoenn", "game": "rse", "screen": [sw, sh], "image": [mx, my],
            "origin": [mx + 8, my + 16], "size": list(HOENN_SIZE), "none": none,
            "label": {"x": mx, "y": my, "width": 120},
            "case": {"closed": [middle - 29, middle], "open": [mx - 29, sw - mx], "top": 11, "height": sh - 11, "tall": True},
            "map": rows, "dungeon": dungeon, "extra": extra}


def grids(decomp: Path) -> dict:
    ids = {f"MAPSEC_{name}": value for value, name in map_sections(decomp).items()}
    out = []
    for region, name, header in REGIONS:
        text = (decomp / "src" / "data" / "region_map" / header).read_text()
        layers = re.findall(r"\[LAYER_(MAP|DUNGEON)\]\s*=\s*\{(.*?)\n    \}", text, re.S)
        grid = {}
        for layer, body in layers:
            rows = re.findall(r"\{([^{}]*)\}", body)
            grid[layer.lower()] = [[ids[cell.strip()] for cell in row.split(",") if cell.strip()] for row in rows]
            assert len(grid[layer.lower()]) == 15 and all(len(r) == 22 for r in grid[layer.lower()]), (header, layer)
        out.append({"id": region, "name": name, "game": "frlg", "screen": list(SCREEN), "image": [0, 0], "origin": [32, 32],
                    "size": [22, 15], "none": ids["MAPSEC_NONE"],
                    "label": {"x": 24, "y": 16, "width": 120},
                    "case": {"closed": [91, 120], "open": [-5, 216], "top": 11, "height": 149, "tall": False},
                    "map": grid["map"], "dungeon": grid["dungeon"], "extra": []})
    out.append(hoenn_grid(decomp))
    return {"cell": 8, "regions": out}


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    images(Image.open(SHEET).convert("RGBA"))
    hoenn_images()
    data = grids(decomp)
    OUT_JSON.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    cells = sum(1 for r in data["regions"] for row in r["map"] + r["dungeon"] for c in row if c != r["none"])
    print(f"{len(data["regions"])} regions, {cells} cells with a location, images in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
