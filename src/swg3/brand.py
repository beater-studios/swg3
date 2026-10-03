"""Site name, slug and production URL from brand.json, the single source shared with web/src/brand.ts."""

import json
from importlib.resources import files

_BRAND = json.loads(files("swg3").joinpath("brand.json").read_text(encoding="utf-8"))

NAME: str = _BRAND["name"]
SLUG: str = _BRAND["slug"]
