"""Switch word filter applied to names (svc_BadWordCheck in revision 10). A prediction: the real list is not public.

This is the model from Gen3ACEPokemonBuilder (MankeyMite, GPLv3,
`src/lib/profanityFilter.js`), ported with credit: patterns from PKHeX's `badwords_switch.txt`
(kwsch and contributors, GPLv3), split into two kinds and tuned by tests on a real Switch.

Boundary terms block only with no letter attached (digits are skipped: "12ass34" blocks, "mass" passes); strong
terms block anywhere, looking only at letters.
"""

import re
from functools import cache
from importlib.resources import files

SEPARATORS = re.compile(r"""[\s\-.,!?'"‘’“”…♂♀`~@#$%^&*()_+={}\[\]|\\:;<>/]+""")
LETTER = r"a-zÀ-ɏЀ-ӿ぀-ヿ一-鿿가-힯"
LETTER_RE = re.compile(f"[{LETTER}]", re.IGNORECASE)
LETTER_RUNS = re.compile(f"[{LETTER}]+", re.IGNORECASE)
NON_LETTERS = re.compile(f"[^{LETTER}]", re.IGNORECASE)
BOUNDARY = "\x00"

# Manual overrides from Gen3ACEPokemonBuilder, confirmed or conservative.
MANUAL_BOUNDARY = frozenset({
    "ass", "sa", "ho", "cum", "tit", "nob", "cox", "cok", "pis", "pee", "pad", "gai", "git", "hoe", "hor",
})
MANUAL_STRONG = frozenset({
    "dp", "nlq", "xxx", "fag", "sex", "shit", "fuck", "cunt", "dick", "cock", "nigga", "nigger", "niger",
    "niga", "nigg", "porn", "rape", "nazi", "penis", "vagina", "bitch", "whore", "slut", "wank",
})


def normalize(text: str) -> str:
    return SEPARATORS.sub(BOUNDARY, text.lower())


def _is_letter(char: str) -> bool:
    return bool(LETTER_RE.fullmatch(char))


def parse_pattern(pattern: str) -> tuple[str, str]:
    """kind: exact, substring, prefix, suffix or other."""
    substring = pattern.startswith(".*") and pattern.endswith(".*")
    exact = pattern.startswith("^") and pattern.endswith("$") and ".*" not in pattern
    prefix = pattern.startswith("^") and pattern.endswith(".*")
    suffix = pattern.startswith(".*") and pattern.endswith("$") and not substring
    kind = "exact" if exact else "substring" if substring else "prefix" if prefix else "suffix" if suffix else "other"
    term = re.sub(r"\.\*$", "", re.sub(r"^\.\*", "", pattern))
    term = re.sub(r"\$$", "", re.sub(r"^\^", "", term))
    term = term.replace("\\$", "$").replace("\\.", ".").replace("\\\\", "\\")
    return term.lower(), kind


def classify(pattern: str) -> tuple[str, str]:
    term, kind = parse_pattern(pattern)
    if term in MANUAL_STRONG:
        return term, "strong"
    if term in MANUAL_BOUNDARY:
        return term, "boundary"
    if kind == "exact" or (kind == "substring" and len(term) <= 3):
        return term, "boundary"
    return term, "strong"


@cache
def terms() -> tuple[frozenset, frozenset]:
    """(boundary, strong)."""
    boundary, strong = set(), set()
    text = files("swg3").joinpath("data", "badwords_switch.txt").read_text(encoding="utf-8")
    for pattern in text.splitlines():
        if not pattern:
            continue
        term, kind = classify(pattern)
        if term:
            (boundary if kind == "boundary" else strong).add(term)
    return frozenset(boundary), frozenset(strong)


def _separated_letters(normalized: str, term: str) -> bool:
    tokens = [t.lower() for t in LETTER_RUNS.findall(re.sub(r"[0-9]+", "", normalized))]
    if term in tokens:
        return True
    if len(term) <= 1:
        return False
    singles: list[str] = []
    for token in tokens + [""]:
        if len(token) == 1:
            singles.append(token)
            continue
        if len(singles) >= len(term) and term in "".join(singles):
            return True
        singles = []
    return False


def _boundary_match(normalized: str, term: str) -> bool:
    s = normalized
    for start, char in enumerate(s):
        if char != term[0]:
            continue
        i, j, end = start, 0, start
        while i < len(s) and j < len(term):
            if s[i].isdigit():
                i += 1
                continue
            if s[i] == term[j]:
                end, i, j = i, i + 1, j + 1
                continue
            break
        if j != len(term):
            continue
        before = s[start - 1] if start > 0 else BOUNDARY
        after = s[end + 1] if end + 1 < len(s) else BOUNDARY
        if not _is_letter(before) and not _is_letter(after):
            return True
    return _separated_letters(normalized, term)


def matches(text: str) -> list[str]:
    """Strong first, then boundary."""
    normalized = normalize(text)
    letters = NON_LETTERS.sub("", normalized)
    boundary, strong = terms()
    found = sorted(t for t in strong if t in letters)
    found += sorted(t for t in boundary if t in letters and _boundary_match(normalized, t))
    return found


def is_boundary(term: str) -> bool:
    return term in terms()[0]


def blocked(text: str) -> bool:
    return bool(matches(text))
