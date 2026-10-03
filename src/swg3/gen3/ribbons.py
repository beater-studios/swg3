"""Gen 3 ribbons (PokemonSubstruct3 in include/pokemon.h) and which games give each one, per the decomp comments.

Low 31 bits: bits 0 to 14 contest ranks (3 bits per category, 0 none to 4 Master), 15 to 26 one ribbon per bit,
27 to 30 unused. Marine, Land and Sky were never distributed.
"""

CONTEST = ("cool", "beauty", "cute", "smart", "tough")
CONTEST_BITS = 3
CONTEST_MAX = 4
FLAGS = ("champion", "winning", "victory", "artist", "effort", "marine", "land", "sky", "country", "national",
         "earth", "world")
FIRST_FLAG = 15
UNUSED_MASK = 0xF << 27
MASK = (1 << 27) - 1

# Origin games (include/constants/global.h, VERSION_*).
RSE = (1, 2, 3)
FRLG = (4, 5)
COLOSSEUM = (15,)
ALL_GAMES = RSE + FRLG + COLOSSEUM

SOURCES: dict[str, tuple[int, ...]] = {
    "contest": RSE,
    "champion": RSE + FRLG,
    "winning": RSE,
    "victory": RSE,
    "artist": RSE,
    "effort": RSE,
    "marine": (),
    "land": (),
    "sky": (),
    "country": ALL_GAMES,
    "national": COLOSSEUM,
    "earth": COLOSSEUM,
    "world": ALL_GAMES,
}
NEVER = tuple(k for k, games in SOURCES.items() if not games)

NAMES = {
    "cool": "Cool", "beauty": "Beauty", "cute": "Cute", "smart": "Smart", "tough": "Tough",
    "champion": "Champion", "winning": "Winning", "victory": "Victory", "artist": "Artist", "effort": "Effort",
    "marine": "Marine", "land": "Land", "sky": "Sky", "country": "Country", "national": "National",
    "earth": "Earth", "world": "World",
}
RANKS = ("", "Normal", "Super", "Hyper", "Master")


def decode(bits: int) -> dict:
    """{"contest": {category: 0 to 7}, "flags": [names], "unused": bits 27 to 30}."""
    return {
        "contest": {k: (bits >> (CONTEST_BITS * i)) & 7 for i, k in enumerate(CONTEST)},
        "flags": [k for i, k in enumerate(FLAGS) if bits >> (FIRST_FLAG + i) & 1],
        "unused": (bits & UNUSED_MASK) >> 27,
    }


def encode(contest: dict | None = None, flags=()) -> int:
    bits = 0
    for i, k in enumerate(CONTEST):
        rank = int((contest or {}).get(k, 0))
        if not 0 <= rank <= CONTEST_MAX:
            raise ValueError(f"{k}: {rank}")
        bits |= rank << (CONTEST_BITS * i)
    for name in flags:
        bits |= 1 << (FIRST_FLAG + FLAGS.index(name))
    return bits


def available(game: int) -> list[str]:
    """"contest" stands for the five categories."""
    return [k for k, games in SOURCES.items() if game in games]
