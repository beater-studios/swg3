#!/usr/bin/env python3
"""Generate the parity vectors between the Python code (source of truth) and the site's TypeScript.

Usage: uv run python tools/gen_parity_vectors.py [area ...]
Each tools/parity/<area>.py defines build() -> dict, written to web/tests/vectors/<area>.json for the Vitest tests.
"""

import importlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))
OUT = ROOT / "web" / "tests" / "vectors"


def main():
    areas = sys.argv[1:] or sorted(p.stem for p in (ROOT / "tools" / "parity").glob("*.py") if p.stem != "__init__")
    OUT.mkdir(parents=True, exist_ok=True)
    for area in areas:
        module = importlib.import_module(f"parity.{area}")
        data = module.build()
        path = OUT / f"{area}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{area}: {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
