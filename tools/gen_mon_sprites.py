#!/usr/bin/env python3
"""Pokémon sprites from the FR/LG decomp: front pictures, palettes, Spinda spots and icons.

Usage: uv run --group tools python tools/gen_mon_sprites.py [path/to/pokefirered]
Sources (sprites © Nintendo/Creatures Inc./GAME FREAK inc.): gMonFrontPicTable and the palette tables
(src/data/pokemon_graphics/), DuplicateDeoxysTiles (src/decompress.c; speed form from pret/pokeemerald), .noFlip
(src/data/pokemon/species_info.h), sSpindaSpotGraphics (src/pokemon.c), gMonIconTable (src/pokemon_icon.c).
Outputs: web/public/mon/front/<id>.png (grayscale, palette index * 16), web/public/mon/palettes.json,
web/src/assets/mon-icons.png and web/src/ui/monIcons.json. Unown B to ? are 413 to 439, after the egg (412).
"""

import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gen_naming_screen import palette  # noqa: E402

DEFAULT_DECOMP = ROOT / "references" / "pokefirered"
FRONT_DIR = ROOT / "web" / "public" / "mon" / "front"
PALETTES = ROOT / "web" / "public" / "mon" / "palettes.json"
ICONS = ROOT / "web" / "src" / "assets" / "mon-icons.png"
ICONS_JSON = ROOT / "web" / "src" / "ui" / "monIcons.json"
ICON_COLUMNS = 24
EGG = 412
RSE_DIR = ROOT / "references" / "sprites" / "rse"
FIRST_UNUSED, LAST_UNUSED = 252, 276    # SPECIES_OLD_UNOWN_B to _Z: empty slots between Celebi and Treecko


def species_ids(decomp: Path) -> dict[str, int]:
    text = (decomp / "include" / "constants" / "species.h").read_text()
    ids = {name: int(value) for name, value in re.findall(r"#define SPECIES_(\w+)\s+(\d+)\b", text)}
    num = ids["EGG"]
    for name, offset in re.findall(r"#define SPECIES_(UNOWN_\w+)\s+\(NUM_SPECIES \+ (\d+)\)", text):
        ids[name] = num + int(offset)
    return ids


def symbol_files(decomp: Path) -> dict[str, str]:
    """Symbol -> file, skipping the LeafGreen block."""
    files, skip = {}, False
    for line in (decomp / "src" / "data" / "graphics" / "pokemon.h").read_text().splitlines():
        if line.startswith("#ifdef LEAFGREEN"):
            skip = True
        elif line.startswith("#endif"):
            skip = False
        elif not skip and (m := re.match(r"const u(?:8|32) (\w+)\[\] = INCBIN_U(?:8|32)\(\s*\"([^\"]+)\"", line)):
            files.setdefault(m.group(1), m.group(2))
    return files


def table(path: Path, macro: str, ids: dict[str, int]) -> dict[int, str]:
    return {ids[name]: symbol for name, symbol in re.findall(rf"{macro}\((\w+), (\w+)\)", path.read_text()) if name in ids}


def png_of(decomp: Path, incbin: str) -> Path:
    return decomp / re.sub(r"\.(4bpp|gbapal)(\.lz)?$", "", incbin)


def gray(image: Image.Image) -> Image.Image:
    return Image.frombytes("L", image.size, bytes(v * 16 for v in image.tobytes()))


def hexes(colors) -> list[str]:
    return ["#%02x%02x%02x" % c[:3] for c in colors]


def main() -> None:
    decomp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DECOMP
    ids = species_ids(decomp)
    files = symbol_files(decomp)
    gfx = decomp / "src" / "data" / "pokemon_graphics"
    fronts = table(gfx / "front_pic_table.h", "SPECIES_SPRITE", ids)
    normal = table(gfx / "palette_table.h", "SPECIES_PAL", ids)
    shiny = table(gfx / "shiny_palette_table.h", "SPECIES_SHINY_PAL", ids)
    wanted = [i for i in fronts if i and not FIRST_UNUSED <= i <= LAST_UNUSED]

    FRONT_DIR.mkdir(parents=True, exist_ok=True)
    palettes = {}
    for sid in wanted:
        path = png_of(decomp, files[fronts[sid]]).with_suffix(".png")
        if not path.exists():
            # Castform: front.4bpp holds all 4 forms; normal/front.png is the one shown, with the first palette.
            path = path.parent / "normal" / "front.png"
        image = Image.open(path)
        if sid == ids["DEOXYS"]:
            forms = {"attack": path, "defense": path.with_name("front_def.png"), "speed": RSE_DIR / "e_deoxys_anim_front.png"}
            for form, source in forms.items():
                pic = Image.open(source)
                assert pic.size == (64, 128), (form, pic.size)
                gray(pic.crop((0, 64, 64, 128))).save(FRONT_DIR / f"{sid}-{form}.png", optimize=True)
            image = image.crop((0, 0, 64, 64))
        assert image.size == (64, 64) and image.mode == "P", (sid, image.size, image.mode)
        gray(image).save(FRONT_DIR / f"{sid}.png", optimize=True)
        # The palette table stops at the egg: Unown forms use Unown's.
        base = sid if sid in normal else ids["UNOWN"]
        pals = [hexes(palette(png_of(decomp, files[normal[base]]).with_suffix(".gbapal")))]
        if base in shiny:
            pals.append(hexes(palette(png_of(decomp, files[shiny[base]]).with_suffix(".gbapal"))))
        palettes[str(sid)] = pals

    info = (decomp / "src" / "data" / "pokemon" / "species_info.h").read_text()
    no_flip = sorted(ids[name] for name, body in re.findall(r"\[SPECIES_(\w+)\]\s*=\s*\{(.*?)\n    \}", info, re.S)
                     if ".noFlip = TRUE" in body)
    spots = []
    pokemon_c = (decomp / "src" / "pokemon.c").read_text()
    for x, y, path in re.findall(r"\{\.x = (\d+), \.y = (\d+), \.image = INCBIN_U16\(\"([^\"]+)\"\)\}", pokemon_c):
        data = (decomp / path).read_bytes()
        spots.append({"x": int(x), "y": int(y), "rows": list(struct.unpack("<16H", data[:32]))})
    assert len(spots) == 4, spots
    PALETTES.write_text(json.dumps({"species": {"unown": ids["UNOWN"], "unownB": ids["UNOWN_B"], "spinda": ids["SPINDA"], "egg": ids["EGG"]},
                                     "palettes": palettes, "noFlip": no_flip, "spinda": spots}, separators=(",", ":")) + "\n")

    icon_pals = [palette(decomp / "graphics" / "pokemon" / "icon_palettes" / f"icon_palette_{n}.gbapal") for n in range(3)]
    icon_c = (decomp / "src" / "pokemon_icon.c").read_text()
    icon_table = {ids[n]: s for n, s in re.findall(r"\[SPECIES_(\w+)\]\s*=\s*(gMonIcon_\w+)", icon_c) if n in ids}
    pal_index = {ids[n]: int(v) for n, v in re.findall(r"\[SPECIES_(\w+)\]\s*=\s*(\d+)\b", icon_c[icon_c.index("gMonIconPaletteIndices"):]) if n in ids}
    deoxys = ids["DEOXYS"]
    deoxys_icons = decomp / "graphics" / "pokemon" / "deoxys"
    files["gMonIcon_Egg"] = "graphics/pokemon/egg/icon.4bpp"   # defined in src/graphics.c, not in pokemon.h
    entries = [(str(i), png_of(decomp, files[icon_table[i]]).with_suffix(".png"), pal_index[i])
               for i in sorted(icon_table) if i and not FIRST_UNUSED <= i <= LAST_UNUSED]
    entries += [(f"{deoxys}-{form}", source, pal_index[deoxys]) for form, source in
                (("attack", deoxys_icons / "icon_attack.png"), ("defense", deoxys_icons / "icon_defense.png"),
                 ("speed", RSE_DIR / "e_deoxys_icon_speed.png"))]
    rows = -(-len(entries) // ICON_COLUMNS)
    sheet = Image.new("RGBA", (32 * ICON_COLUMNS, 32 * rows), (0, 0, 0, 0))
    positions = {}
    for n, (key, source, pal_n) in enumerate(entries):
        image = Image.open(source)
        assert image.size == (32, 64), (key, image.size)
        pal = icon_pals[pal_n]
        frame = image.crop((0, 0, 32, 32))
        px = frame.load()
        out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        for y in range(32):
            for x in range(32):
                if px[x, y]:
                    out.putpixel((x, y), pal[px[x, y]])
        sheet.paste(out, (32 * (n % ICON_COLUMNS), 32 * (n // ICON_COLUMNS)))
        positions[key] = n
    sheet.save(ICONS, optimize=True)
    ICONS_JSON.write_text(json.dumps({"columns": ICON_COLUMNS, "icons": positions}, separators=(",", ":")) + "\n")
    print(f"{len(wanted)} pictures (plus 3 Deoxys forms) in {FRONT_DIR.relative_to(ROOT)}, {len(entries)} icons in {ICONS.relative_to(ROOT)}, "
          f"{len(no_flip)} not mirrored")


if __name__ == "__main__":
    main()
