#!/usr/bin/env python3
"""Generate the initial seed table for English FireRed and LeafGreen on the Switch.

Usage: python tools/gen_switch_seeds.py [folder with FireRed.csv and LeafGreen.csv]
Source: the community spreadsheet used by ten-lines (lincoln-lm, GPLv3; src/wasm/generate_ten_lines_precalc.py),
downloaded when no folder is given. Columns: index, time in 1/16 of a GBA frame, seed per setting.
Output: src/swg3/data/frlg_switch_seeds.json (setting: sound / button mode / seed button).
"""

import csv
import io
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "swg3" / "data" / "frlg_switch_seeds.json"
SHEET = "https://docs.google.com/spreadsheets/d/1mbn2-XAtmV7HZ1p4esgvUG710VX6FlfhN_HYL_zLJSk/gviz/tq?tqx=out:csv&sheet={}"
TABS = {"firered": "FireRed%20Seeds", "leafgreen": "LeafGreen%20Seeds"}
FILES = {"firered": "FireRed.csv", "leafgreen": "LeafGreen.csv"}
# Sheet columns 2 to 15.
SETTINGS = [
    "mono/help/a", "stereo/help/a", "mono/help/start", "stereo/help/start",
    "mono/lr/a", "stereo/lr/a", "mono/lr/start", "stereo/lr/start",
    "mono/l=a/a", "stereo/l=a/a", "mono/l=a/start", "stereo/l=a/start",
    "mono/l=a/l", "stereo/l=a/l",
]


def read(game: str, folder: Path | None) -> str:
    if folder:
        return (folder / FILES[game]).read_text(encoding="utf-8")
    with urllib.request.urlopen(SHEET.format(TABS[game]), timeout=30) as response:
        return response.read().decode("utf-8")


def parse(text: str) -> dict:
    rows = list(csv.reader(io.StringIO(text)))
    header = [c.strip().lower().replace(" ", "") for c in rows[0][2:2 + len(SETTINGS)]]
    if header != SETTINGS:
        raise SystemExit(f"unexpected sheet header: {rows[0][:16]}")
    times, columns = [], {name: [] for name in SETTINGS}
    for row in rows[2:]:
        if not row or not row[0].strip():
            continue
        times.append(int(row[1]))
        for index, name in enumerate(SETTINGS):
            cell = row[2 + index].strip() if len(row) > 2 + index else ""
            value = int(cell, 16) if cell and cell != "-" else None
            # Above 16 bits is a sheet typo: skipped, like ten-lines (add_str_seed).
            columns[name].append(value if value is not None and value <= 0xFFFF else None)
    seeds = {name: values for name, values in columns.items() if any(v is not None for v in values)}
    return {"times": times, "seeds": seeds}


def main():
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    games = {game: parse(read(game, folder)) for game in TABS}
    out = {
        "source": SHEET.split("/gviz", 1)[0],
        "fetched": date.today().isoformat(),
        "time_unit": "1/16 of a GBA frame",
        "time_offset": 5737,
        "games": games,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    for game, data in games.items():
        print(f"{game}: {len(data['times'])} times, settings {', '.join(data['seeds'])}")
    print(f"written to {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
