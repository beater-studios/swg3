"""PC box names: checking and typing guide for community codes (does not assemble code).

Sources: include/pokemon_storage_system.h (boxNames, 9 bytes per box), src/naming_screen.c (sKeyboardChars,
HandleKeyboardEvent), MainState_PressedOKButton (revision 10 calls svc_BadWordCheck), docs/research/codegenerator.md.
"""

import json
import re
from dataclasses import dataclass, field

from ..i18n import N_, t
from . import badwords, charset

TOTAL_BOXES = 14
NAME_LENGTH = 8
BOX_BYTES = NAME_LENGTH + 1
TERMINATOR = charset.TERMINATOR

PAGES = (N_("maiúsculas"), N_("minúsculas"), N_("símbolos"))   # Select order, starting on uppercase
# sKeyboardChars, in PAGES order. On the letter pages, column 6 of the first two rows is the space.
KEYBOARD = (
    ("ABCDEF .", "GHIJKL ,", "MNOPQRS", "TUVWXYZ"),
    ("abcdef .", "ghijkl ,", "mnopqrs", "tuvwxyz"),
    ("01234", "56789", "!?♂♀/-", "…“”‘'"),
)
LOOKALIKES = {"_": " ", "–": "-", "‐": "-", "’": "'", " ": " "}
# pokemon-ace-notes, FRLG FAQ: on the Switch, avoid a space in the last three characters of these boxes.
SWITCH_SPACE_BOXES = (4, 8, 12)


def _keys() -> dict[str, tuple[int, int, int]]:
    keys = {}
    for page, rows in enumerate(KEYBOARD):
        for row, text in enumerate(rows):
            for col, char in enumerate(text):
                keys.setdefault(char, (page, row, col))
    return keys


KEYS = _keys()


def normalize(name: str) -> str:
    return "".join(LOOKALIKES.get(c, c) for c in name)


def key_of(char: str) -> tuple[int, int, int] | None:
    """(page, row, column), or None if not on the box keyboard."""
    return KEYS.get(normalize(char))


def encode_name(name: str) -> bytes:
    return charset.encode(normalize(name), BOX_BYTES)


def parse_names(text: str) -> list[str]:
    """JSON list, "Box N: ..." report or one name per line. `_` is a space."""
    text = text.strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            names = json.loads(text)
        except json.JSONDecodeError as error:
            raise ValueError(t("lista JSON inválida: {error}", error=error.msg)) from None
        if not all(isinstance(n, str) for n in names):
            raise ValueError(t("a lista deve ter só textos"))
        return [normalize(n) for n in names]
    report = re.findall(r"^\s*Box\s*(\d+)\s*:\s*(.*?)\s*(?:\[.*\])?\s*$", text, re.MULTILINE | re.IGNORECASE)
    if report:
        names = {}
        for number, spaced in report:
            chars = spaced.split(" ") if " " in spaced else list(spaced)
            names[int(number)] = normalize("".join(chars))
        expected = list(range(1, max(names) + 1))
        if sorted(names) != expected:
            missing = sorted(set(expected) - set(names))
            raise ValueError(t("faltam as boxes {boxes} no relatório", boxes=", ".join(map(str, missing))))
        return [names[n] for n in expected]
    return [normalize(line.rstrip("\r")) for line in text.split("\n")]


def parse_raw(text: str) -> bytes:
    """The generator's "Raw data" section, with or without separators."""
    clean = re.sub(r"0x|[\s,]", "", text, flags=re.IGNORECASE)
    try:
        return bytes.fromhex(clean)
    except ValueError:
        raise ValueError(t("bytes crus: use hexadecimal")) from None


@dataclass
class Box:
    number: int
    name: str
    raw: bytes
    issues: list = field(default_factory=list)   # (level, message)

    def error(self, message):
        self.issues.append(("error", message))

    def warn(self, message):
        self.issues.append(("warning", message))


def check_names(names: list[str]) -> tuple[list[Box], list[tuple[str, str]]]:
    """Returns the boxes and the general issues."""
    general = []
    if not names:
        general.append(("error", t("nenhum nome informado")))
    if len(names) > TOTAL_BOXES:
        general.append(("error", t("{count} boxes; o PC tem {total}", count=len(names), total=TOTAL_BOXES)))
    boxes = []
    for number, name in enumerate(names, 1):
        name = normalize(name)
        box = Box(number, name, b"")
        bad = sorted({c for c in name if c not in KEYS})
        if bad:
            box.error(t("fora do teclado de nome de box: {chars}", chars=" ".join(repr(c) for c in bad)))
        if len(name) > NAME_LENGTH:
            box.error(t("{length} caracteres; o máximo é {max}", length=len(name), max=NAME_LENGTH))
        if not name.strip():
            box.error(t("vazia ou só com espaços: o jogo não aceita"))
        blocked = badwords.matches(name) if name.strip() else []
        if blocked:
            box.warn(t("o filtro de palavras do Switch deve recusar este nome ({words}); gere de novo com saída "
                       "para Switch ou converta a box", words=", ".join(blocked)))
        if number in SWITCH_SPACE_BOXES and " " in name[5:NAME_LENGTH]:
            box.warn(t("espaço nos três últimos caracteres: no Switch a comunidade recomenda evitar "
                       "(ver a FAQ do FRLG nas pokemon-ace-notes)"))
        if not bad and len(name) <= NAME_LENGTH:
            box.raw = encode_name(name)
        boxes.append(box)
    return boxes, general


def check_raw(data: bytes) -> tuple[list[str], list[tuple[str, str]]]:
    """Returns (names, issues)."""
    issues = []
    if len(data) % BOX_BYTES:
        issues.append(("warning", t("{size} bytes não é múltiplo de {box}; a última box fica incompleta",
                                   size=len(data), box=BOX_BYTES)))
    names = []
    decode_table, _ = charset._tables()
    for start in range(0, len(data), BOX_BYTES):
        number = start // BOX_BYTES + 1
        chunk = data[start:start + BOX_BYTES]
        if len(chunk) == BOX_BYTES and chunk[-1] != TERMINATOR:
            issues.append(("error", t("Box {number}: o byte {offset} deveria ser o terminador 0xFF, é 0x{value:02X}",
                                     number=number, offset=start + NAME_LENGTH, value=chunk[-1])))
        body = chunk[:NAME_LENGTH]
        end = body.find(TERMINATOR)
        if end != -1 and any(b != TERMINATOR for b in body[end:]):
            issues.append(("error", t("Box {number}: 0xFF no meio do nome seguido de outro byte; impossível digitar",
                                     number=number)))
        text = body[:end] if end != -1 else body
        chars = []
        for value in text:
            char = decode_table.get(value)
            char = normalize(char) if char is not None else None
            if char is None or char not in KEYS:
                issues.append(("error", t("Box {number}: byte 0x{value:02X} não está no teclado de nome de box",
                                         number=number, value=value)))
                char = "?"
            chars.append(char)
        names.append("".join(chars))
    if len(names) > TOTAL_BOXES:
        issues.append(("error", t("{count} boxes; o PC tem {total}", count=len(names), total=TOTAL_BOXES)))
    return names, issues


# Keyboard cursor (src/naming_screen.c): sPageColumnCounts key columns, then the button column (PAGE, BACK, OK).
# Cursor state: (page, column, row, saved row), where the saved row is HandleDpadMovement's tButtonId.
COLUMNS = (8, 8, 6)
ROWS = 4
BUTTONS = 3
KEY_ROW_TO_BUTTON_ROW = (0, 1, 1, 2)   # sKeyRowToButtonRow
BUTTON_ROW_TO_KEY_ROW = (0, 0, 3)      # sButtonRowToKeyRow
START = (0, 0, 0, 0)                   # new screen: uppercase, cursor on the first key (CreateCursorSprite)
MOVES = ("select", "up", "down", "left", "right")
_DELTAS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def press(cursor: tuple[int, int, int, int], key: str) -> tuple[int, int, int, int]:
    page, x, y, saved = cursor
    columns = COLUMNS[page]
    if key == "select":
        # MainState_WaitPageSwap: on the button column it stays there; on keys, the column is clamped to the new page.
        page = (page + 1) % len(PAGES)
        if x == columns:
            x = COLUMNS[page]
        elif x >= COLUMNS[page]:
            x = COLUMNS[page] - 1
        return page, x, y, saved
    # HandleDpadMovement
    dx, dy = _DELTAS[key]
    previous = x
    x, y = x + dx, y + dy
    if x < 0:
        x = columns
    if x > columns:
        x = 0
    if dx:
        if x == columns:
            saved, y = y, KEY_ROW_TO_BUTTON_ROW[y]
        elif previous == columns:
            y = saved if y == BUTTONS // 2 else BUTTON_ROW_TO_KEY_ROW[y]
    if x == columns:
        y %= BUTTONS
        if y == 0:
            saved = 1
        elif y == BUTTONS - 1:
            saved = 2
    else:
        y %= ROWS
    return page, x, y, saved


def _positions() -> dict[str, list[tuple[int, int, int]]]:
    out: dict[str, list[tuple[int, int, int]]] = {}
    for page, rows in enumerate(KEYBOARD):
        for row, text in enumerate(rows):
            for col, char in enumerate(text):
                out.setdefault(char, []).append((page, row, col))
    return out


POSITIONS = _positions()


def _runs(path: tuple[int, ...]) -> int:
    return sum(1 for i, move in enumerate(path) if i == 0 or path[i - 1] != move)


def cursor_path(cursor: tuple[int, int, int, int], char: str) -> tuple[list[int], tuple[int, int, int, int]]:
    """Fewest presses; on a tie, fewest direction changes, then MOVES order. Returns (indexes into MOVES, cursor)."""
    targets = {(page, col, row) for page, row, col in POSITIONS[normalize(char)]}
    frontier = {(cursor, -1): ()}
    seen = set(frontier)
    while frontier:
        hits = sorted((_runs(path), path, state) for (state, _), path in frontier.items() if state[:3] in targets)
        if hits:
            _, path, state = hits[0]
            return list(path), state
        following: dict = {}
        for (state, _), path in frontier.items():
            for i, key in enumerate(MOVES):
                node = (press(state, key), i)
                if node in seen:
                    continue
                candidate = path + (i,)
                current = following.get(node)
                if current is None or (_runs(candidate), candidate) < (_runs(current), current):
                    following[node] = candidate
        seen |= following.keys()
        frontier = following
    raise ValueError(t("caractere fora do teclado: {char!r}", char=char))


def typing_steps(name: str) -> list[dict]:
    """Keys from a fresh box naming screen. `moves`: cursor path from the previous key in runs {"key", "count"}.
    After 8 characters the game moves the cursor to OK itself (KeyboardKeyHandler_Character)."""
    steps = []
    cursor = START
    for char in normalize(name):
        if char not in KEYS:
            raise ValueError(t("caractere fora do teclado: {char!r}", char=char))
        path, cursor = cursor_path(cursor, char)
        moves = []
        for i in path:
            if moves and moves[-1]["key"] == MOVES[i]:
                moves[-1]["count"] += 1
            else:
                moves.append({"key": MOVES[i], "count": 1})
        page, x, y, _ = cursor
        steps.append({"char": char, "page": t(PAGES[page]), "page_index": page, "row": y + 1, "col": x + 1,
                      "select": path.count(0), "moves": moves})
    return steps
