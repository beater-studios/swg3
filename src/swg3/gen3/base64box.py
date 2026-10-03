"""Pokémon in box names for the Base64 writer (by Mettrich): the 80 box-format bytes in Base64, 8 characters per box.

Ported from Gen3ACEPokemonBuilder (MankeyMite, GPLv3; `toBase64Emerald` in src/lib/gen3/builder.js), credited in
CREDITS.md. Writer setup: docs/research/base64-writer.md. The writer reads a symbol as the letter's value + 64 (from
the community, not verified here).
"""

import base64
from dataclasses import dataclass, field

from ..i18n import t
from . import badwords

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?"
VALUES = {c: i for i, c in enumerate(ALPHABET)}
SUBSTITUTIONS = {"A": ".", "B": "-", "D": "…", "E": "“", "F": "”", "G": "‘", "H": "’", "I": "♂", "J": "♀",
                 "L": ",", "N": "/"}
SYMBOL_VALUES = {symbol: VALUES[letter] + 64 for letter, symbol in SUBSTITUTIONS.items()}
# Same byte in the game: the keyboard apostrophe is ’ (0xB4) and the hyphen is – (0xAE).
SYMBOL_VALUES["'"] = SYMBOL_VALUES["’"]
SYMBOL_VALUES["–"] = SYMBOL_VALUES["-"]
BOXES = 14
BOX_LENGTH = 8
DATA_SIZE = 80
MAX_PASSES = 14


@dataclass
class Encoded:
    boxes: list[str]
    shortened: set = field(default_factory=set)
    substitutions: int = 0
    manual: dict = field(default_factory=dict)        # box -> uppercase letters converted
    blocked: dict = field(default_factory=dict)       # box -> terms that would still block

    def as_dict(self) -> dict:
        return {"boxes": self.boxes, "shortened": sorted(n + 1 for n in self.shortened),
                "substitutions": self.substitutions, "manual": self.manual,
                "blocked": {str(k): v for k, v in self.blocked.items()}}


def _is_letter(char: str) -> bool:
    return char.isascii() and char.isalpha()


def _term_positions(box: str, term: str) -> list[int] | None:
    box = box.lower()
    for start, char in enumerate(box):
        if not _is_letter(char):
            continue
        positions, t = [], 0
        for index in range(start, len(box)):
            if not _is_letter(box[index]):
                continue
            if box[index] != term[t]:
                break
            positions.append(index)
            t += 1
            if t == len(term):
                return positions
    return None


def _capacity_after(boxes: list[str], index: int) -> int:
    return sum(max(0, BOX_LENGTH - len(b)) for b in boxes[index + 1:])


def _push(boxes: list[str], index: int, carry: str) -> str:
    for j in range(index, BOXES):
        if not carry:
            break
        combined = carry + boxes[j]
        boxes[j], carry = combined[:BOX_LENGTH], combined[BOX_LENGTH:]
    return carry


def _substitute(boxes: list[str], box_index: int, char_index: int) -> bool:
    """The symbol's +64 carries into the previous digit, compensated by position in the 4-character group."""
    box = boxes[box_index]
    symbol = SUBSTITUTIONS.get(box[char_index])
    if symbol is None:
        return False
    position = (sum(len(b) for b in boxes[:box_index]) + char_index) % 4
    if position == 0:
        boxes[box_index] = box[:char_index] + symbol + box[char_index + 1:]
        return True
    prev_box, prev_char = box_index, char_index - 1
    if prev_char < 0:
        prev_box -= 1
        while prev_box >= 0 and not boxes[prev_box]:
            prev_box -= 1
        if prev_box < 0:
            return False
        prev_char = len(boxes[prev_box]) - 1
    value = VALUES.get(boxes[prev_box][prev_char])
    if value is None:
        return False
    if position == 1:
        fixed = (value - 1) % 64
    elif position == 2:
        fixed = (value & 0x30) | ((value & 0x0F) - 1) % 16
    else:
        fixed = (value & 0x3C) | ((value & 0x03) - 1) % 4
    replaced = boxes[prev_box]
    boxes[prev_box] = replaced[:prev_char] + ALPHABET[fixed] + replaced[prev_char + 1:]
    box = boxes[box_index]
    boxes[box_index] = box[:char_index] + symbol + box[char_index + 1:]
    return True


def _borrow_previous_letter(boxes: list[str], index: int) -> bool:
    if index < 1 or not boxes[index - 1] or not _is_letter(boxes[index - 1][-1]):
        return False
    if _capacity_after(boxes, index - 1) < 1:
        return False
    borrowed = boxes[index - 1][-1]
    boxes[index - 1] = boxes[index - 1][:-1]
    return not _push(boxes, index, borrowed)


def _blocked_count(boxes: list[str]) -> int:
    return sum(len(badwords.matches(b)) for b in boxes if b)


def encode(data: bytes, switch_safe: bool = True, convert: tuple[int, ...] = ()) -> Encoded:
    """`convert`: boxes (1 to 14) the console still rejected, to replace every uppercase letter possible."""
    if len(data) != DATA_SIZE:
        raise ValueError(t("{size} bytes; o writer grava {expected} (Pokémon de box)", size=len(data), expected=DATA_SIZE))
    stream = base64.b64encode(data).decode().rstrip("=").replace("+", "!").replace("/", "?")
    boxes = [stream[i:i + BOX_LENGTH] for i in range(0, len(stream), BOX_LENGTH)]
    boxes += [""] * (BOXES - len(boxes))
    result = Encoded(boxes)
    if not switch_safe:
        return result

    # 1. Shift: cut before the term's last letter, as late as possible.
    for _ in range(MAX_PASSES):
        shifted = False
        for index in range(BOXES - 1):
            box = boxes[index]
            if not box:
                continue
            cuts = []
            for term in badwords.matches(box):
                positions = _term_positions(box, term)
                if positions and positions[-1] >= 3:
                    cuts.append(positions[-1])
            capacity = _capacity_after(boxes, index)
            cut = next((c for c in sorted(cuts, reverse=True) if len(box) - c <= capacity), None)
            if cut is None:
                continue
            boxes[index], displaced = box[:cut], box[cut:]
            result.shortened.add(index)
            leftover = _push(boxes, index + 1, displaced)
            boxes[BOXES - 1] += leftover
            shifted = True
            break
        if not shifted:
            break

    # 2. Symbol substitution on one letter of each remaining term.
    for _ in range(MAX_PASSES):
        changed = False
        for index, box in enumerate(boxes):
            if not box:
                continue
            for term in badwords.matches(box):
                positions = _term_positions(box, term) or []
                if any(box[p] in SUBSTITUTIONS and _substitute(boxes, index, p) for p in positions):
                    result.substitutions += 1
                    changed = True
                    break
            if changed:
                break
        if not changed:
            break

    # 3. Boundary term at the start of a box: pull the last letter of the previous one.
    for _ in range(MAX_PASSES):
        before = _blocked_count(boxes)
        reflowed = False
        for index in range(1, BOXES):
            box = boxes[index]
            for term in badwords.matches(box) if box else []:
                if not badwords.is_boundary(term):
                    continue
                positions = _term_positions(box, term)
                if not positions or positions[0] != 0:
                    continue
                candidate = list(boxes)
                if not _borrow_previous_letter(candidate, index):
                    continue
                if term in badwords.matches(candidate[index]) or _blocked_count(candidate) >= before:
                    continue
                boxes[:] = candidate
                result.shortened.add(index - 1)
                reflowed = True
                break
            if reflowed:
                break
        if not reflowed:
            break

    # 4. Manual conversion requested by the player.
    for number in sorted(set(convert)):
        if not 1 <= number <= BOXES:
            raise ValueError(t("box {number} fora de 1 a {max}", number=number, max=BOXES))
        count = 0
        for char_index in range(len(boxes[number - 1])):
            if _substitute(boxes, number - 1, char_index):
                count += 1
        result.manual[number] = count
        result.substitutions += count

    result.blocked = {n: m for n, box in enumerate(boxes, 1) if box and (m := badwords.matches(box))}
    return result


def decode(boxes: list[str]) -> bytes:
    values = []
    for char in "".join(boxes):
        if char in VALUES:
            values.append(VALUES[char])
        elif char in SYMBOL_VALUES:
            values.append(SYMBOL_VALUES[char])
        else:
            raise ValueError(t("caractere {char!r} não pertence ao Base64 do writer", char=char))
    out = bytearray()
    for i in range(0, len(values), 4):
        v = values[i:i + 4] + [0] * (4 - len(values[i:i + 4]))
        group = [((v[0] << 2) + (v[1] >> 4)) & 0xFF,
                 (((v[1] & 0x0F) << 4) + (v[2] >> 2)) & 0xFF,
                 (((v[2] & 0x03) << 6) + v[3]) & 0xFF]
        out += bytes(group[:max(0, len(values[i:i + 4]) - 1)])
    return bytes(out)


def is_base64_code(boxes: list[str]) -> bool:
    """80 bytes give 107 characters."""
    text = "".join(boxes)
    return (0 < len(boxes) <= BOXES and len(text) == 107
            and all(c in VALUES or c in SYMBOL_VALUES for c in text))
