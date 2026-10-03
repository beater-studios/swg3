#!/usr/bin/env python3
"""Build the site's item and ribbon icon sheets from PokéSprite and the decomp.

Usage: uv run --group tools python tools/gen_sprites.py [path/to/pokesprite] [path/to/pokefirered]
Sources: PokéSprite (msikma/pokesprite, MIT code, sprites © Nintendo/Creatures Inc./GAME FREAK inc.) in
references/pokesprite; items from include/constants/items.h, TM/HM types from sTMHMMoves (src/data/party_menu.h) and
src/data/battle_moves.h. Outputs: web/src/assets/items.png, ribbons.png and web/src/ui/itemIcons.json,
ribbonIcons.json (keys as in gen3/ribbons.py).
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SPRITES = ROOT / "references" / "pokesprite"
DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
NAMES = ROOT / "src" / "swg3" / "data" / "frlg_species.json"
OUT_PNG = ROOT / "web" / "src" / "assets" / "items.png"
OUT_JSON = ROOT / "web" / "src" / "ui" / "itemIcons.json"
OUT_RIBBONS_PNG = ROOT / "web" / "src" / "assets" / "ribbons.png"
OUT_RIBBONS_JSON = ROOT / "web" / "src" / "ui" / "ribbonIcons.json"
RIBBON_SOURCE = 40
RIBBON_CELL = 32
RANKS = {"": 1, "super": 2, "hyper": 3, "master": 4}
CONTEST = ("cool", "beauty", "cute", "smart", "tough")
SOURCE = 32
CELL = 28
COLUMNS = 20

# Decomp constant -> PokéSprite file, when the name differs.
ALIASES = {
    "ITEM_X_DEFEND": "battle-item/x-defense",
    "ITEM_X_SPECIAL": "battle-item/x-sp-atk",
    "ITEM_ITEMFINDER": "key-item/dowsing-machine",
    "ITEM_BICYCLE": "key-item/bicycle",
    "ITEM_ROOM_1_KEY": "key-item/rm-1-key",
    "ITEM_ROOM_2_KEY": "key-item/rm-2-key",
    "ITEM_ROOM_4_KEY": "key-item/rm-4-key",
    "ITEM_ROOM_6_KEY": "key-item/rm-6-key",
    "ITEM_MYSTIC_TICKET": "key-item/mysticticket",
    "ITEM_AURORA_TICKET": "key-item/auroraticket",
    "ITEM_SECRET_KEY": "key-item/secret-key-kanto",
}


# Suffix -> folder holding the file without it (master-ball -> ball/master).
FOLDERS = {"-ball": "ball", "-berry": "berry", "-flute": "flute", "-fossil": "fossil", "-shard": "shard", "-incense": "incense", "-scarf": "scarf"}


def item_constants(decomp: Path) -> dict[int, str]:
    out: dict[int, str] = {}
    for line in (decomp / "include" / "constants" / "items.h").read_text().splitlines():
        m = re.match(r"#define (ITEM_\w+)\s+(\d+)\b", line)
        if m:
            out.setdefault(int(m.group(2)), m.group(1))
    return out


def tm_types(decomp: Path) -> list[str]:
    """TM01 to TM50, then HM01 to HM08."""
    table = (decomp / "src" / "data" / "party_menu.h").read_text()
    body = re.search(r"static const u16 sTMHMMoves\[\] =\s*\{(.*?)\};", table, re.S).group(1)
    moves = re.findall(r"MOVE_\w+", body)
    battle = (decomp / "src" / "data" / "battle_moves.h").read_text()
    types = dict(re.findall(r"\[(MOVE_\w+)\]\s*=\s*\{[^}]*?\.type = TYPE_(\w+)", battle, re.S))
    return [types[m].lower() for m in moves]


def resolve(sprites: Path, decomp: Path) -> dict[int, str]:
    items = sprites / "items"
    files: dict[str, str] = {}
    for p in sorted(items.glob("*/*.png")):
        files.setdefault(p.stem, f"{p.parent.name}/{p.stem}")
    consts = item_constants(decomp)
    types = tm_types(decomp)
    names = json.loads(NAMES.read_text())["items"]
    tm01 = next(k for k, v in consts.items() if v == "ITEM_TM01")
    hm01 = next(k for k, v in consts.items() if v == "ITEM_HM01")

    def exists(path: str | None) -> bool:
        return bool(path) and (items / f"{path}.png").exists()

    out: dict[int, str] = {}
    missing: list[str] = []
    for item in range(1, len(names)):
        const = consts.get(item, "")
        if names[item].strip("?") == "" or not const:
            continue
        slug = const[5:].lower().replace("_", "-")
        path = ALIASES.get(const)
        if not path and tm01 <= item < hm01 + 8:
            kind, index = ("tm", item - tm01) if item < hm01 else ("hm", item - hm01 + 50)
            path = f"{kind}/{types[index]}"
        if not exists(path):
            path = files.get(slug)
        for suffix, folder in FOLDERS.items():
            if not exists(path) and slug.endswith(suffix):
                path = f"{folder}/{slug.removesuffix(suffix)}"
        if not exists(path):
            missing.append(f"{item} {const} ({names[item]})")
            continue
        out[item] = path + "-gen3" if exists(path + "-gen3") else path
    if missing:
        raise SystemExit("no icon (add to ALIASES):\n" + "\n".join(missing))
    return out


def ribbon_key(name: str) -> str:
    """"Cool Ribbon Super" -> "cool-2"; "Champion Ribbon" -> "champion"."""
    words = name.lower().split()
    first, rank = words[0], words[2] if len(words) > 2 else ""
    return f"{first}-{RANKS[rank]}" if first in CONTEST else first


def ribbons(sprites: Path) -> None:
    entries = [r for r in json.loads((sprites / "data" / "misc.json").read_text())["ribbon"] if r.get("origin_gen") == 3]
    keys = [ribbon_key(r["name"]["eng"]) for r in entries]
    if len(set(keys)) != 32:
        raise SystemExit(f"expected the 32 Gen 3 ribbons, found {sorted(keys)}")
    sheet = Image.new("RGBA", (COLUMNS * RIBBON_CELL, -(-len(keys) // COLUMNS) * RIBBON_CELL))
    margin = (RIBBON_SOURCE - RIBBON_CELL) // 2
    for i, entry in enumerate(entries):
        icon = Image.open(sprites / "misc" / entry["files"]["gen-3"]).convert("RGBA")
        box = icon.getbbox()
        if box[0] < margin or box[1] < margin or box[2] > RIBBON_SOURCE - margin or box[3] > RIBBON_SOURCE - margin:
            raise SystemExit(f"{entry['name']['eng']} does not fit the {RIBBON_CELL} cell: {box}")
        sheet.paste(icon.crop((margin, margin, margin + RIBBON_CELL, margin + RIBBON_CELL)),
                    ((i % COLUMNS) * RIBBON_CELL, (i // COLUMNS) * RIBBON_CELL))
    sheet.save(OUT_RIBBONS_PNG, optimize=True)
    OUT_RIBBONS_JSON.write_text(json.dumps({
        "cell": RIBBON_CELL, "columns": COLUMNS, "icons": dict(sorted(zip(keys, range(len(keys))))),
    }, separators=(",", ":")) + "\n")
    print(f"{len(keys)} ribbons in {OUT_RIBBONS_PNG.relative_to(ROOT)} and {OUT_RIBBONS_JSON.relative_to(ROOT)}")


def main() -> None:
    sprites = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SPRITES
    decomp = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_DECOMP
    ribbons(sprites)
    paths = resolve(sprites, decomp)
    unique = sorted(set(paths.values()))
    rows = -(-len(unique) // COLUMNS)
    sheet = Image.new("RGBA", (COLUMNS * CELL, rows * CELL))
    margin = (SOURCE - CELL) // 2
    for i, path in enumerate(unique):
        icon = Image.open(sprites / "items" / f"{path}.png").convert("RGBA")
        box = icon.getbbox()
        if box and (box[0] < margin or box[1] < margin or box[2] > SOURCE - margin or box[3] > SOURCE - margin):
            cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
            left, top = min(max(cx - CELL // 2, 0), SOURCE - CELL), min(max(cy - CELL // 2, 0), SOURCE - CELL)
        else:
            left = top = margin
        sheet.paste(icon.crop((left, top, left + CELL, top + CELL)), ((i % COLUMNS) * CELL, (i // COLUMNS) * CELL))
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_PNG, optimize=True)
    index = {path: i for i, path in enumerate(unique)}
    OUT_JSON.write_text(json.dumps({
        "cell": CELL, "columns": COLUMNS, "rows": rows,
        "icons": {str(item): index[path] for item, path in sorted(paths.items())},
    }, separators=(",", ":")) + "\n")
    print(f"{len(paths)} items, {len(unique)} icons in {OUT_PNG.relative_to(ROOT)} and {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
